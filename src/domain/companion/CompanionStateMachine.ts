import { classifyActivity } from '../../context/ActivityClassifier'
import { FSM, type FSMTransition } from '../../engine/FSM'
import type { CompanionFileAnalysisMemory, CompanionMemorySnapshot } from '../../types/chat'
import type { ActiveWindowInfo, ScreenPerceptionSnapshot } from '../../types/context'
import type {
  CompanionActivity,
  CompanionEmotion,
  CompanionRuntimeSignals,
  CompanionSnapshot,
  CompanionTransitionResult,
  InteractionMode,
  SpeechIntent,
} from './types'
import { mapActivityType } from './types'
import { resolveCompanionScene } from './CompanionScene'
import { inferScreenContextSignals } from './ScreenPerceptionSemantics'

type ActivityEvent =
  | 'to_idle'
  | 'to_coding'
  | 'to_gaming'
  | 'to_watching_video'
  | 'to_chatting'
  | 'to_browsing'
  | 'to_reading'
  | 'to_other'

type EmotionEvent =
  | 'to_idle'
  | 'to_sleepy'
  | 'to_happy'
  | 'to_thinking'
  | 'to_excited'

type ModeEvent =
  | 'to_quiet'
  | 'to_observing'
  | 'to_reactive'
  | 'to_proactive'
  | 'to_focus_guardian'

const ACTIVITY_STATES: CompanionActivity[] = [
  'idle',
  'coding',
  'gaming',
  'watching_video',
  'chatting',
  'browsing',
  'reading',
  'other',
]

const EMOTION_STATES: CompanionEmotion[] = ['idle', 'sleepy', 'happy', 'thinking', 'excited']
const MODE_STATES: InteractionMode[] = ['quiet', 'observing', 'reactive', 'proactive', 'focus_guardian']
const SOFT_AWAY_IDLE_MS = 90_000
const DEEP_AWAY_IDLE_MS = 6 * 60_000
const RETURN_FROM_AWAY_IDLE_MS = 20_000
const RECENT_FILE_WINDOW_MS = 40 * 60_000

const ACTIVITY_TO_EVENT: Record<CompanionActivity, ActivityEvent> = {
  idle: 'to_idle',
  coding: 'to_coding',
  gaming: 'to_gaming',
  watching_video: 'to_watching_video',
  chatting: 'to_chatting',
  browsing: 'to_browsing',
  reading: 'to_reading',
  other: 'to_other',
}

const EMOTION_TO_EVENT: Record<CompanionEmotion, EmotionEvent> = {
  idle: 'to_idle',
  sleepy: 'to_sleepy',
  happy: 'to_happy',
  thinking: 'to_thinking',
  excited: 'to_excited',
}

const MODE_TO_EVENT: Record<InteractionMode, ModeEvent> = {
  quiet: 'to_quiet',
  observing: 'to_observing',
  reactive: 'to_reactive',
  proactive: 'to_proactive',
  focus_guardian: 'to_focus_guardian',
}

function buildTransitions<S extends string, E extends string>(
  states: readonly S[],
  eventMap: Record<S, E>,
): Array<FSMTransition<S, E>> {
  const transitions: Array<FSMTransition<S, E>> = []
  for (const from of states) {
    for (const to of states) {
      transitions.push({
        from,
        event: eventMap[to],
        to,
      })
    }
  }
  return transitions
}

export class CompanionStateMachine {
  private readonly activityFsm = new FSM<CompanionActivity, ActivityEvent>(
    'idle',
    buildTransitions(ACTIVITY_STATES, ACTIVITY_TO_EVENT),
  )
  private readonly emotionFsm = new FSM<CompanionEmotion, EmotionEvent>(
    'idle',
    buildTransitions(EMOTION_STATES, EMOTION_TO_EVENT),
  )
  private readonly modeFsm = new FSM<InteractionMode, ModeEvent>(
    'observing',
    buildTransitions(MODE_STATES, MODE_TO_EVENT),
  )

  private interruptionBudget = 100
  private activeWindow: ActiveWindowInfo | null = null
  private screenPerception: ScreenPerceptionSnapshot | null = null
  private memory: CompanionMemorySnapshot | null = null
  private lastContextAt = Date.now()
  private lastBudgetRecoveryAt = Date.now()
  private lastReactionAt = 0
  private lastTapAt = 0
  private transientActionUntil = 0
  private transientAction: CompanionSnapshot['transientAction'] = 'none'
  private productiveSessionStartedAt: number | null = null
  private lastProductiveActivity: CompanionActivity = 'idle'
  private activityEnteredAt = Date.now()
  private emotionEnteredAt = Date.now()
  private modeEnteredAt = Date.now()
  private wasAway = false

  setMemory(memory: CompanionMemorySnapshot | null) {
    this.memory = memory
  }

  setScreenPerception(snapshot: ScreenPerceptionSnapshot | null) {
    this.screenPerception = snapshot
  }

  handleContext(info: ActiveWindowInfo, now = Date.now()): CompanionTransitionResult {
    const previousIdleMs = this.activeWindow?.idleMs ?? 0
    this.activeWindow = info
    const classified = classifyActivity(info)
    const activity = mapActivityType(classified)
    const prevActivity = this.activityFsm.state
    const prevEmotion = this.emotionFsm.state
    const prevMode = this.modeFsm.state
    const wasAway = previousIdleMs >= SOFT_AWAY_IDLE_MS
    const isPresentAgain = wasAway && (info.idleMs ?? 0) <= RETURN_FROM_AWAY_IDLE_MS

    this.syncActivity(activity)
    this.syncWorkSession(activity, now)
    this.recoverInterruptionBudget(now)

    const emotion = this.deriveEmotion(activity, now)
    const mode = this.deriveMode(activity, emotion, now)

    this.syncEmotion(emotion)
    this.syncMode(mode)
    this.syncEnteredAt(prevActivity, prevEmotion, prevMode, now)
    this.syncReturnFromAwayFlag(wasAway, info.idleMs ?? 0, now)

    let speech: SpeechIntent | undefined
    if (activity !== prevActivity || emotion !== prevEmotion || mode !== prevMode) {
      this.lastContextAt = now
      speech = this.maybeCreateReaction(activity, emotion, mode, now)
    }

    if (!speech && isPresentAgain) {
      speech = this.createReturnFromAwaySpeech(activity, now)
    }

    return {
      snapshot: this.getSnapshot(now),
      speech,
    }
  }

  handleTap(now = Date.now()): CompanionTransitionResult {
    this.lastTapAt = now
    this.interruptionBudget = Math.max(20, this.interruptionBudget - 8)
    this.syncEmotion('happy')
    this.syncMode('reactive')
    this.transientAction = 'tap_affection'
    this.transientActionUntil = now + 900

    const name = this.resolveUserName()
    const pool = name
      ? [`${name}，我在呢。`, `摸摸收到了，${name}。`, '这样我会更开心一点。']
      : ['我在呢。', '摸摸收到了。', '这样我会更开心一点。']

    return {
      snapshot: this.getSnapshot(now),
      speech: {
        message: randomFrom(pool),
        duration: 2200,
      },
    }
  }

  handleDragStart(now = Date.now()): CompanionTransitionResult {
    this.transientAction = 'dragging'
    this.transientActionUntil = now + 60_000
    return { snapshot: this.getSnapshot(now) }
  }

  handleDragEnd(now = Date.now()): CompanionTransitionResult {
    this.transientAction = 'none'
    this.transientActionUntil = 0
    return { snapshot: this.getSnapshot(now) }
  }

  handleTick(now = Date.now()): CompanionTransitionResult {
    this.recoverInterruptionBudget(now)
    return {
      snapshot: this.getSnapshot(now),
    }
  }

  getSnapshot(now = Date.now()): CompanionSnapshot {
    const activity = this.activityFsm.state
    const emotion = this.emotionFsm.state
    const mode = this.modeFsm.state
    const screenContext = inferScreenContextSignals(this.screenPerception)

    return {
      activity,
      emotion,
      mode,
      scene: resolveCompanionScene({
        activity,
        emotion,
        mode,
        activeWindow: this.activeWindow,
        screenContext,
        now,
      }),
      transientAction: this.resolveTransientAction(now),
      interruptionBudget: Math.round(this.interruptionBudget),
      activeWindow: this.activeWindow,
      screenPerception: this.screenPerception,
      screenContext,
      memory: this.memory,
      timestamp: now,
    }
  }

  getRuntimeSignals(now = Date.now()): CompanionRuntimeSignals {
    return {
      interruptionBudget: Math.round(this.interruptionBudget),
      productiveSessionMs: this.productiveSessionStartedAt ? Math.max(0, now - this.productiveSessionStartedAt) : 0,
      currentActivityDurationMs: Math.max(0, now - this.activityEnteredAt),
      currentEmotionDurationMs: Math.max(0, now - this.emotionEnteredAt),
      currentModeDurationMs: Math.max(0, now - this.modeEnteredAt),
      userIdleMs: this.activeWindow?.idleMs ?? 0,
      timeSinceLastContextMs: Math.max(0, now - this.lastContextAt),
      timeSinceLastReactionMs: this.lastReactionAt ? Math.max(0, now - this.lastReactionAt) : Number.MAX_SAFE_INTEGER,
      timeSinceLastTapMs: this.lastTapAt ? Math.max(0, now - this.lastTapAt) : Number.MAX_SAFE_INTEGER,
    }
  }

  private syncActivity(activity: CompanionActivity) {
    this.activityFsm.send(ACTIVITY_TO_EVENT[activity])
  }

  private syncEmotion(emotion: CompanionEmotion) {
    this.emotionFsm.send(EMOTION_TO_EVENT[emotion])
  }

  private syncMode(mode: InteractionMode) {
    this.modeFsm.send(MODE_TO_EVENT[mode])
  }

  private syncWorkSession(activity: CompanionActivity, now: number) {
    if (isProductive(activity)) {
      if (!this.productiveSessionStartedAt || !isProductive(this.lastProductiveActivity)) {
        this.productiveSessionStartedAt = now
      }
    } else {
      this.productiveSessionStartedAt = null
    }
    this.lastProductiveActivity = activity
  }

  private deriveEmotion(activity: CompanionActivity, now: number): CompanionEmotion {
    const hour = new Date(now).getHours()
    const lateNight = hour >= 23 || hour < 6
    const recentlyTapped = now - this.lastTapAt < 2000
    const userIdleMs = this.activeWindow?.idleMs ?? 0
    const screenContext = inferScreenContextSignals(this.screenPerception)

    if (recentlyTapped) return 'happy'
    if (userIdleMs >= DEEP_AWAY_IDLE_MS) return 'sleepy'
    if (userIdleMs >= SOFT_AWAY_IDLE_MS && activity === 'idle') return 'sleepy'
    if (activity === 'gaming' || screenContext.domain === 'game') return 'excited'
    if (activity === 'coding' || activity === 'reading' || screenContext.domain === 'code') return 'thinking'
    if (activity === 'chatting' || screenContext.domain === 'social') return 'happy'
    if (activity === 'watching_video' || screenContext.domain === 'video') return 'thinking'
    if (lateNight && (activity === 'idle' || activity === 'browsing' || activity === 'other')) {
      return 'sleepy'
    }
    return 'idle'
  }

  private deriveMode(activity: CompanionActivity, emotion: CompanionEmotion, now: number): InteractionMode {
    const userIdleMs = this.activeWindow?.idleMs ?? 0
    const screenContext = inferScreenContextSignals(this.screenPerception)

    if (userIdleMs >= SOFT_AWAY_IDLE_MS) {
      return 'quiet'
    }
    if (activity === 'coding' || screenContext.domain === 'code') {
      if (this.productiveSessionStartedAt && now - this.productiveSessionStartedAt > 45 * 60_000) {
        return 'proactive'
      }
      return 'focus_guardian'
    }
    if (activity === 'gaming' || screenContext.domain === 'game') return 'quiet'
    if (activity === 'chatting' || screenContext.domain === 'social') return 'reactive'
    if (activity === 'watching_video' || screenContext.domain === 'video') return 'reactive'
    if (emotion === 'sleepy') return 'quiet'
    if (emotion === 'happy') return 'reactive'
    return 'observing'
  }

  private resolveTransientAction(now: number): CompanionSnapshot['transientAction'] {
    if (now < this.transientActionUntil) {
      return this.transientAction
    }
    this.transientAction = 'none'
    this.transientActionUntil = 0
    return 'none'
  }

  private recoverInterruptionBudget(now: number) {
    const recovery = Math.max(0, now - this.lastBudgetRecoveryAt) / 20_000
    this.interruptionBudget = Math.min(100, this.interruptionBudget + recovery)
    this.lastBudgetRecoveryAt = now
  }

  private syncEnteredAt(
    prevActivity: CompanionActivity,
    prevEmotion: CompanionEmotion,
    prevMode: InteractionMode,
    now: number,
  ) {
    if (this.activityFsm.state !== prevActivity) {
      this.activityEnteredAt = now
    }
    if (this.emotionFsm.state !== prevEmotion) {
      this.emotionEnteredAt = now
    }
    if (this.modeFsm.state !== prevMode) {
      this.modeEnteredAt = now
    }
  }

  private syncReturnFromAwayFlag(previousWasAway: boolean, currentIdleMs: number, now: number) {
    this.wasAway = previousWasAway || currentIdleMs >= SOFT_AWAY_IDLE_MS
    if (this.wasAway && currentIdleMs <= RETURN_FROM_AWAY_IDLE_MS) {
      this.transientAction = 'welcome_back'
      this.transientActionUntil = now + 1_600
      this.wasAway = false
    }
  }

  private maybeCreateReaction(
    activity: CompanionActivity,
    emotion: CompanionEmotion,
    mode: InteractionMode,
    now: number,
  ): SpeechIntent | undefined {
    if (!this.shouldSpeakOnTransition(activity, emotion, mode, now)) {
      return undefined
    }

    const cooldownMs = mode === 'quiet' ? 90_000 : 20_000
    if (now - this.lastReactionAt < cooldownMs) return undefined
    if (mode === 'quiet' && this.interruptionBudget < 60) return undefined
    if (this.interruptionBudget < 22) return undefined

    this.lastReactionAt = now
    this.interruptionBudget = Math.max(0, this.interruptionBudget - (mode === 'quiet' ? 8 : 14))

    const message =
      this.pickMemoryAwareReaction(activity, emotion) ??
      randomFrom(
        REACTION_LIBRARY[activity][emotion] ??
          REACTION_LIBRARY[activity].idle ??
          REACTION_LIBRARY.other.idle ??
          ['我会一直陪着你。'],
      )

    return {
      message,
      duration: activity === 'gaming' ? 2400 : 3400,
    }
  }

  private shouldSpeakOnTransition(
    activity: CompanionActivity,
    emotion: CompanionEmotion,
    mode: InteractionMode,
    now: number,
  ): boolean {
    const activeTitle = this.activeWindow?.title?.trim() ?? ''
    const userIdleMs = this.activeWindow?.idleMs ?? 0
    const likelyNoisyContext = activeTitle.length > 0 && activeTitle.length < 4
    const lateNight = isLateNight(now)

    if (this.transientAction === 'dragging') return false
    if (userIdleMs >= SOFT_AWAY_IDLE_MS) return false
    if (likelyNoisyContext && activity === 'other') return false
    if (activity === 'gaming' && mode === 'quiet') return false
    if (activity === 'browsing' && emotion === 'idle') return false
    if (activity === 'other' && emotion === 'idle') return false
    if (activity === 'idle' && emotion === 'idle' && mode === 'observing') return false
    if (lateNight && emotion === 'sleepy' && activity !== 'coding' && activity !== 'reading') return false
    return true
  }

  private createReturnFromAwaySpeech(activity: CompanionActivity, now: number): SpeechIntent | undefined {
    const idleMs = this.activeWindow?.idleMs ?? 0
    if (idleMs > RETURN_FROM_AWAY_IDLE_MS) return undefined
    if (now - this.lastReactionAt < 60_000) return undefined

    const name = this.resolveUserName()
    const recentFile = resolveRecentFileAnalysis(this.memory)
    const fileHint = recentFile ? ` 我还记得我们刚刚一起看过《${trimForSpeech(recentFile.fileName, 18)}》。` : ''

    const message =
      activity === 'coding'
        ? name
          ? `${name}，你回来啦。我继续安静陪你写。${fileHint}`
          : `你回来啦。我继续安静陪你写。${fileHint}`
        : activity === 'watching_video'
          ? name
            ? `${name}，欢迎回来。我还在这儿陪你。${fileHint}`
            : `欢迎回来。我还在这儿陪你。${fileHint}`
          : name
            ? `${name}，欢迎回来。我在这儿。${fileHint}`
            : `欢迎回来。我在这儿。${fileHint}`

    this.lastReactionAt = now
    this.interruptionBudget = Math.max(0, this.interruptionBudget - 6)
    return {
      message: message.trim(),
      duration: 2400,
    }
  }

  private pickMemoryAwareReaction(
    activity: CompanionActivity,
    emotion: CompanionEmotion,
  ): string | null {
    const memory = this.memory
    const name = this.resolveUserName()
    const screenContext = inferScreenContextSignals(this.screenPerception)
    const recentFile = resolveRecentFileAnalysis(memory)
    const sharedAttention =
      screenContext.shortSummary ||
      (recentFile ? `《${recentFile.fileName}》` : null) ||
      memory?.recentTopics?.[0] ||
      this.activeWindow?.title?.trim() ||
      null

    if (!memory) {
      if (screenContext.domain === 'code' && sharedAttention) {
        return `你现在像是在认真盯着“${trimForSpeech(sharedAttention, 22)}”。我会安静陪着你。`
      }
      if (screenContext.domain === 'video' && sharedAttention) {
        return `这会儿像是在一起看“${trimForSpeech(sharedAttention, 22)}”。我就在旁边陪你。`
      }
      return null
    }

    if (recentFile && activity === 'coding' && emotion === 'thinking') {
      return name
        ? `${name}，你像是在一边看着眼前的内容，一边消化刚刚一起看过的《${trimForSpeech(recentFile.fileName, 18)}》。`
        : `你像是在一边看着眼前的内容，一边消化刚刚一起看过的《${trimForSpeech(recentFile.fileName, 18)}》。`
    }

    if (
      recentFile &&
      (activity === 'reading' || activity === 'browsing') &&
      (emotion === 'thinking' || emotion === 'idle')
    ) {
      return name
        ? `${name}，你现在像是还顺着《${trimForSpeech(recentFile.fileName, 18)}》继续看着。我会轻一点陪着你。`
        : `你现在像是还顺着《${trimForSpeech(recentFile.fileName, 18)}》继续看着。我会轻一点陪着你。`
    }

    if (recentFile && activity === 'idle' && emotion !== 'sleepy') {
      return name
        ? `${name}，我还记得我们刚刚一起看过《${trimForSpeech(recentFile.fileName, 18)}》。想继续的话，我就在这儿。`
        : `我还记得我们刚刚一起看过《${trimForSpeech(recentFile.fileName, 18)}》。想继续的话，我就在这儿。`
    }

    if (activity === 'coding' && emotion === 'thinking' && sharedAttention) {
      return name
        ? `${name}，你现在像是在认真盯着“${trimForSpeech(sharedAttention, 22)}”。我会安静陪着你。`
        : `你现在像是在认真盯着“${trimForSpeech(sharedAttention, 22)}”。我会安静陪着你。`
    }

    if ((activity === 'watching_video' || screenContext.domain === 'video') && sharedAttention) {
      return `这次也像是在一起看“${trimForSpeech(sharedAttention, 22)}”。我就在旁边陪你。`
    }

    if ((activity === 'chatting' || screenContext.domain === 'social') && sharedAttention) {
      return name
        ? `${name}，你像是在围着“${trimForSpeech(sharedAttention, 20)}”聊天。我轻一点陪着你。`
        : `你像是在围着“${trimForSpeech(sharedAttention, 20)}”聊天。我轻一点陪着你。`
    }

    if ((activity === 'chatting' || screenContext.domain === 'social') && memory.preferredName) {
      return `今天也想好好陪着你，${memory.preferredName}。`
    }

    return null
  }

  private resolveUserName(): string | null {
    return this.memory?.preferredName?.trim() || null
  }
}

type ReactionLibrary = Record<CompanionActivity, Partial<Record<CompanionEmotion, string[]>>>

const REACTION_LIBRARY: ReactionLibrary = {
  idle: {
    idle: ['我在这里陪着你。', '安静一点也很好。', '想说话的时候就叫我。'],
    sleepy: ['有点晚了，我会轻一点陪着你。', '如果你累了，我也会提醒你休息。'],
  },
  coding: {
    thinking: ['又在写代码呀，我陪你慢慢来。', '调试辛苦了，记得活动一下手腕。', '我在这边守着，你继续。'],
    happy: ['这一段好像顺起来了。', '看起来比刚才顺利一点了。'],
  },
  gaming: {
    excited: ['我先安静看你操作。', '这一波看起来很紧张。', '你专心玩，我不打扰。'],
  },
  watching_video: {
    thinking: ['这一段看起来很有意思。', '我也在悄悄陪你一起看。', '像是在陪你追点什么。'],
    idle: ['这一段看起来很有意思。', '我也在悄悄陪你一起看。', '像是在陪你追点什么。'],
  },
  chatting: {
    happy: ['今天好像聊得很热闹。', '你看起来心情还不错。', '我在旁边陪你。'],
  },
  browsing: {
    idle: ['找到感兴趣的东西了吗？', '慢慢看，我在。', '今天的桌面气氛很安静。'],
  },
  reading: {
    thinking: ['我会轻一点，不打扰你读。', '这一段看起来很认真。', '需要休息时我提醒你。'],
  },
  other: {
    idle: ['我看着你忙。', '今天也一起待在桌面上吧。', '我会一直在。'],
    sleepy: ['夜已经有点深了，我会安静陪着你。'],
  },
}

function randomFrom(items: string[]): string {
  return items[Math.floor(Math.random() * items.length)]
}

function resolveRecentFileAnalysis(memory: CompanionMemorySnapshot | null): CompanionFileAnalysisMemory | null {
  if (!memory?.recentFileAnalyses?.length) {
    return null
  }

  const recent = memory.recentFileAnalyses[0]
  if (!recent?.fileName) {
    return null
  }

  if (Date.now() - recent.capturedAt > RECENT_FILE_WINDOW_MS) {
    return null
  }

  return recent
}

function trimForSpeech(value: string, maxLength: number): string {
  const normalized = value.trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength).trim()}...`
}

function isLateNight(now: number): boolean {
  const hour = new Date(now).getHours()
  return hour >= 23 || hour < 6
}

function isProductive(activity: CompanionActivity): boolean {
  return activity === 'coding' || activity === 'reading' || activity === 'browsing'
}
