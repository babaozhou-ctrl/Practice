import {
  emitCompanionAction,
  type CompanionActionPayload,
} from './ai/CompanionActionBridge'
import { captureCompanionRuntimeContext, readCompanionMemory, subscribeCompanionMemory } from './ai/CompanionMemoryStore'
import { subscribeCompanionUtterance } from './ai/CompanionUtteranceBridge'
import { attachWorkModeToSnapshot } from './domain/companion/attachWorkModeToSnapshot'
import { CompanionBehaviorStabilizer } from './domain/companion/CompanionBehaviorStabilizer'
import { CompanionSpeechPolicy, type SpeechSource } from './domain/companion/CompanionSpeechPolicy'
import { ProactiveInteractionScheduler } from './domain/companion/ProactiveInteractionScheduler'
import { CompanionStateMachine } from './domain/companion/CompanionStateMachine'
import type { CompanionSnapshot } from './domain/companion/types'
import { subscribeSelectedPet } from './pets/PetSelectionStore'
import { resolvePetPresentation } from './pets/loader/resolvePetPresentation'
import { resolveSelectedPetPackage } from './pets/resolveSelectedPetPackage'
import { readCompanionPreferencesState, subscribeCompanionPreferences } from './preferences/CompanionPreferencesStore'
import { PetDragController } from './rendering/controllers/PetDragController'
import { ensurePixiLoaded } from './rendering/pixi/pixiVendor'
import { PixiPetRuntime } from './rendering/pixi/PixiPetRuntime'
import { buildRuntimeTextureSetForPetPackage } from './rendering/pixi/pixelTextureFactory'
import type { ChatMessageAction } from './types/chat'
import type { WorkModeSignals } from './types/workMode'
import { readWorkModeState, subscribeWorkMode } from './workmode/WorkModeStore'
import { WorkModeRuntime } from './workmode/WorkModeRuntime'

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) {
    throw new Error(`Missing required element: #${id}`)
  }
  return element as T
}

const LATE_NIGHT_MESSAGE = '已经有点晚了，我会安静陪着你，也想轻轻提醒你早点休息。'
const DESKTOP_GREETING = '我已经在桌面这边安顿好了，今天也会好好陪着你。'
const DEFAULT_SPEECH_KICKER = 'SOFT COMPANY'

type SpeechTone = 'quiet' | 'focus' | 'warm' | 'playful'

interface SpeechPresentation {
  tone: SpeechTone
  kicker: string
}

function formatSpeechKicker(name?: string | null): string {
  const trimmed = name?.trim()
  if (!trimmed) {
    return DEFAULT_SPEECH_KICKER
  }

  return `WITH ${trimmed.toUpperCase()}`
}

class SpeechBubbleController {
  private readonly element: HTMLElement
  private readonly kickerEl: HTMLDivElement
  private readonly textEl: HTMLDivElement
  private activeUntil = 0
  private timer: number | null = null

  constructor(
    element: HTMLElement,
    anchor?: {
      x: number
      y: number
    },
  ) {
    this.element = element
    this.element.innerHTML = `
      <div class="speech-shell">
        <div class="speech-kicker"><span class="speech-dot"></span><span class="speech-kicker-text"></span></div>
        <div class="speech-text"></div>
        <div class="speech-ambient"></div>
      </div>
    `
    const kickerEl = this.element.querySelector<HTMLDivElement>('.speech-kicker-text')
    const textEl = this.element.querySelector<HTMLDivElement>('.speech-text')
    if (!kickerEl || !textEl) {
      throw new Error('Speech bubble elements failed to initialize.')
    }
    this.kickerEl = kickerEl
    this.textEl = textEl

    if (anchor) {
      this.element.style.left = `${Math.round(anchor.x * 100)}%`
      this.element.style.top = `${Math.round(anchor.y * 100)}%`
    }
  }

  setAnchor(anchor?: { x: number; y: number }) {
    if (!anchor) return
    this.element.style.left = `${Math.round(anchor.x * 100)}%`
    this.element.style.top = `${Math.round(anchor.y * 100)}%`
  }

  show(message: string, duration = 4000, presentation?: Partial<SpeechPresentation>) {
    const resolved = presentation ?? {}
    this.element.dataset.tone = resolved.tone ?? 'quiet'
    this.kickerEl.textContent = resolved.kicker ?? DEFAULT_SPEECH_KICKER
    this.textEl.textContent = message
    this.element.classList.add('show')
    this.activeUntil = Date.now() + duration
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      this.element.classList.remove('show')
      this.timer = null
      this.activeUntil = 0
    }, duration)
  }

  getActiveUntil() {
    return this.activeUntil
  }
}

function deriveSpeechPresentation(
  snapshot: ReturnType<CompanionStateMachine['getSnapshot']>,
  message: string,
): SpeechPresentation {
  if (snapshot.transientAction === 'tap_affection') {
    return { tone: 'warm', kicker: 'A LITTLE NUDGE' }
  }
  if (snapshot.transientAction === 'welcome_back') {
    return { tone: 'warm', kicker: 'YOU ARE BACK' }
  }
  if (snapshot.transientAction === 'dragging') {
    return { tone: 'playful', kicker: 'FLOATING ALONG' }
  }
  if (snapshot.mode === 'focus_guardian') {
    return { tone: 'focus', kicker: 'SOFT FOCUS' }
  }
  if (snapshot.mode === 'proactive') {
    return { tone: 'warm', kicker: 'GENTLE CHECK-IN' }
  }
  if (snapshot.mode === 'reactive' && snapshot.emotion === 'happy') {
    return { tone: 'playful', kicker: 'LITTLE SPARK' }
  }
  if (snapshot.emotion === 'sleepy') {
    return { tone: 'quiet', kicker: 'LOW LIGHT' }
  }
  if (snapshot.activity === 'coding' || snapshot.activity === 'reading') {
    return { tone: 'focus', kicker: 'STAYING NEARBY' }
  }
  if (snapshot.activity === 'watching_video' || snapshot.activity === 'chatting') {
    return { tone: 'warm', kicker: 'RIGHT HERE' }
  }
  if (message.length <= 8) {
    return { tone: 'playful', kicker: 'TINY REPLY' }
  }
  return { tone: 'quiet', kicker: DEFAULT_SPEECH_KICKER }
}

function setupContextMenu(menu: HTMLElement) {
  const items: Array<{ label?: string; action?: () => void; divider?: boolean; danger?: boolean }> = [
    { label: 'Chat', action: () => window.electronAPI?.openChat?.() },
    { label: 'Settings', action: () => window.electronAPI?.openSettings?.() },
    { divider: true },
    { label: 'Toggle Click-Through', action: () => window.electronAPI?.toggleClickThrough?.() },
    { divider: true },
    { label: 'Quit', action: () => window.electronAPI?.quitApp?.(), danger: true },
  ]

  const hide = () => menu.classList.remove('show')
  menu.innerHTML = ''

  for (const item of items) {
    if ('divider' in item) {
      const divider = document.createElement('div')
      divider.className = 'd'
      menu.appendChild(divider)
      continue
    }

    const entry = document.createElement('div')
    entry.className = 'i'
    entry.textContent = item.label ?? ''
    if (item.danger) {
      entry.style.color = 'rgba(255, 170, 170, 0.95)'
    }
    entry.onclick = () => {
      hide()
      item.action?.()
    }
    menu.appendChild(entry)
  }

  return {
    show(x: number, y: number) {
      menu.style.left = `${x}px`
      menu.style.top = `${y}px`
      menu.classList.add('show')
    },
    hide,
  }
}

function buildCompanionActions(
  snapshot: CompanionSnapshot,
  workMode: WorkModeSignals,
  message: string,
): CompanionActionPayload | null {
  const memory = snapshot.memory
  const name = memory?.preferredName?.trim() || '我'
  const recentTopic = memory?.recentTopics?.[0]?.trim()

  if (workMode.enabled && workMode.isFocusActive && workMode.msRemaining !== null && workMode.msRemaining <= 2 * 60_000) {
    return {
      id: `focus-ending-${snapshot.timestamp}-${Math.round(workMode.msRemaining / 1000)}`,
      title: '专注快收尾了',
      message,
      source: 'work-mode',
      actions: [
        {
          id: 'focus-finish-strong',
          label: '再陪我收个尾',
          prompt: `我这轮专注快结束了，请继续陪我把最后一点内容收干净，帮我判断现在最值得先完成的事。`,
        },
        {
          id: 'focus-start-break',
          label: '开始休息',
          prompt: `我准备开始休息了，陪我做一个轻一点的收尾，然后提醒我怎么把注意力放下来。`,
        },
        {
          id: 'focus-next-step',
          label: '帮我整理下一步',
          prompt: `请根据我刚才这段专注状态，帮我整理一个自然、轻量的下一步顺序，让我不用硬切换。`,
        },
      ],
    }
  }

  if (workMode.enabled && workMode.isBreakActive && workMode.msRemaining !== null && workMode.msRemaining <= 90_000) {
    return {
      id: `break-ending-${snapshot.timestamp}-${Math.round(workMode.msRemaining / 1000)}`,
      title: '休息快结束了',
      message,
      source: 'work-mode',
      actions: [
        {
          id: 'break-return-gently',
          label: '轻一点回到专注',
          prompt: `休息差不多结束了。请陪我温柔一点回到专注，不要一下子变得很紧绷。`,
        },
        {
          id: 'break-decide-first-step',
          label: '帮我决定先做什么',
          prompt: `我要回到工作里了。请帮我决定重启时第一步做什么，尽量让我容易重新进入状态。`,
        },
      ],
    }
  }

  if (workMode.enabled && workMode.overworkLevel === 'firm') {
    return {
      id: `overwork-firm-${snapshot.timestamp}`,
      title: '该认真歇一下了',
      message,
      source: 'work-mode',
      actions: [
        {
          id: 'overwork-wrap-up',
          label: '先帮我收尾',
          prompt: `我已经有点过劳了。请帮我做一个尽量轻的收尾，只保留今晚一定要结束的点。`,
        },
        {
          id: 'overwork-pause-reminder',
          label: '提醒我暂停',
          prompt: `我现在需要停一下。请用温和但坚定的方式提醒我为什么应该先休息，并帮我放下手头的内容。`,
        },
      ],
    }
  }

  if (workMode.enabled && workMode.overworkLevel === 'gentle' && workMode.isFocusActive) {
    return {
      id: `overwork-gentle-${snapshot.timestamp}`,
      title: '该松一口气了',
      message,
      source: 'work-mode',
      actions: [
        {
          id: 'overwork-gentle-wrap',
          label: '先帮我收个口',
          prompt: `我有点撑太久了。请帮我把当前这段工作收个口，让我能比较自然地停下来。`,
        },
        {
          id: 'overwork-gentle-break',
          label: '提醒我休息一下',
          prompt: `请提醒我认真休息一下，但语气轻一点，像陪伴而不是说教。`,
        },
      ],
    }
  }

  if (workMode.enabled && workMode.totalFocusMsToday >= 52 * 60_000 && snapshot.activity !== 'gaming') {
    return {
      id: `productive-session-${snapshot.timestamp}`,
      title: '今天已经很努力了',
      message,
      source: 'proactive',
      actions: [
        {
          id: 'productive-check-progress',
          label: '帮我看看进度',
          prompt: `我今天已经专注挺久了。请陪我快速看一下现在的进度感，帮我判断接下来是继续冲还是适合缓一缓。`,
        },
        {
          id: 'productive-soft-plan',
          label: '整理轻一点的后续',
          prompt: `请根据我现在这段投入状态，帮我整理一个轻一点的后续安排，不要太工具化。`,
        },
      ],
    }
  }

  const hour = new Date().getHours()
  if ((hour >= 23 || hour < 6) && ['coding', 'reading', 'browsing', 'idle', 'other'].includes(snapshot.activity)) {
    return {
      id: `late-night-${snapshot.timestamp}`,
      title: '夜深了',
      message,
      source: 'proactive',
      actions: [
        {
          id: 'late-night-soft-wrap',
          label: '帮我温柔收尾',
          prompt: `有点晚了。请陪我做一个温柔的收尾，把今晚的内容放到一个能安心停下的位置。`,
        },
        {
          id: 'late-night-save-for-tomorrow',
          label: '只留明天继续的点',
          prompt: `请帮我只保留明天最值得继续的点，用很轻的方式整理出来，让我现在能安心休息。`,
        },
      ],
    }
  }

  if (snapshot.activity === 'watching_video' && recentTopic) {
    return {
      id: `watch-together-${snapshot.timestamp}`,
      title: '一起看着呢',
      message,
      source: 'proactive',
      actions: [
        {
          id: 'watch-highlight',
          label: '聊聊刚才那段',
          prompt: `我们刚才像是在一起看“${recentTopic}”。请陪我用自然一点的方式聊聊最值得继续说的点。`,
        },
      ],
    }
  }

  if (snapshot.activity === 'idle' && snapshot.mode === 'observing') {
    return {
      id: `gentle-idle-${snapshot.timestamp}`,
      title: '静静陪着',
      message,
      source: 'proactive',
      actions: [
        {
          id: 'idle-soft-checkin',
          label: `${name}在想什么`,
          prompt: `我现在有点安静。你可以像陪伴角色一样，轻一点地问问我现在在想什么或想做什么。`,
        },
      ],
    }
  }

  return null
}

async function bootstrap() {
  await ensurePixiLoaded()

  const mount = requireElement<HTMLDivElement>('pet-root')
  const speechEl = requireElement<HTMLDivElement>('speech')
  const contextMenuEl = requireElement<HTMLDivElement>('ctx')

  let petPackage = resolveSelectedPetPackage()
  const speech = new SpeechBubbleController(speechEl, petPackage.productionProfile?.anchors.speechBubble)
  const speechPolicy = new CompanionSpeechPolicy()
  const contextMenu = setupContextMenu(contextMenuEl)
  const proceduralScale = 15
  let textureSet = await buildRuntimeTextureSetForPetPackage(petPackage, proceduralScale)
  let currentSpeechKicker = formatSpeechKicker(petPackage.manifest.name)
  let lowDistractionMode = readCompanionPreferencesState().lowDistractionMode
  const companion = new CompanionStateMachine()
  const stabilizer = new CompanionBehaviorStabilizer()
  const proactiveScheduler = new ProactiveInteractionScheduler()
  const workModeRuntime = new WorkModeRuntime(readWorkModeState())

  companion.setMemory(readCompanionMemory())

  const runtime = new PixiPetRuntime({
    mount,
    textureSet,
    speech,
  })

  await runtime.init()
  runtime.setLowDistractionMode(lowDistractionMode)
  const initialSnapshot = stabilizer.stabilize(
    attachWorkModeToSnapshot(companion.getSnapshot(), workModeRuntime.getSignals()),
  )
  let latestSnapshot = initialSnapshot

  const speakWithPolicy = (
    source: SpeechSource,
    snapshot: typeof latestSnapshot,
    message: string,
    duration: number,
    override?: Partial<SpeechPresentation>,
  ) => {
    const decision = speechPolicy.evaluate({
      source,
      snapshot,
      intent: { message, duration },
      now: Date.now(),
    })

    if (!decision) {
      return false
    }

    speech.show(
      decision.intent.message,
      decision.intent.duration,
      override ?? deriveSpeechPresentation(snapshot, decision.intent.message),
    )
    return true
  }

  runtime.applyPresentation(resolvePetPresentation(initialSnapshot, petPackage))

  const unsubscribeMemory = subscribeCompanionMemory((memory) => {
    companion.setMemory(memory)
    const stabilizedSnapshot = stabilizer.stabilize(
      attachWorkModeToSnapshot(companion.getSnapshot(), workModeRuntime.getSignals()),
    )
    latestSnapshot = stabilizedSnapshot
    runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))
  })

  const unsubscribeWorkMode = subscribeWorkMode((state) => {
    workModeRuntime.setState(state)
    const stabilizedSnapshot = stabilizer.stabilize(
      attachWorkModeToSnapshot(companion.getSnapshot(), workModeRuntime.getSignals()),
    )
    latestSnapshot = stabilizedSnapshot
    runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))
  })

  const unsubscribeSelectedPet = subscribeSelectedPet(async () => {
    petPackage = resolveSelectedPetPackage()
    textureSet = await buildRuntimeTextureSetForPetPackage(petPackage, proceduralScale)
    currentSpeechKicker = formatSpeechKicker(petPackage.manifest.name)
    runtime.replaceTextureSet(textureSet)
    speech.setAnchor(petPackage.productionProfile?.anchors.speechBubble)
    const stabilizedSnapshot = stabilizer.stabilize(
      attachWorkModeToSnapshot(companion.getSnapshot(), workModeRuntime.getSignals()),
    )
    latestSnapshot = stabilizedSnapshot
    runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))
  })

  const unsubscribeCompanionPreferences = subscribeCompanionPreferences((state) => {
    lowDistractionMode = state.lowDistractionMode
    runtime.setLowDistractionMode(lowDistractionMode)
  })

  const unsubscribeCompanionUtterance = subscribeCompanionUtterance((payload) => {
    speakWithPolicy(
      'external',
      latestSnapshot,
      payload.message,
      payload.duration ?? 2800,
      {
        tone: payload.source === 'file-analysis' ? 'focus' : 'warm',
        kicker: payload.source === 'file-analysis' ? 'I TOOK A LOOK' : 'FROM MOCHI',
      },
    )
  })

  const dragController = new PetDragController({
    element: runtime.canvas,
    onDragStart: () => {
      const result = companion.handleDragStart()
      const stabilizedSnapshot = stabilizer.stabilize(
        attachWorkModeToSnapshot(result.snapshot, workModeRuntime.getSignals()),
      )
      latestSnapshot = stabilizedSnapshot
      runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))
    },
    onDragEnd: () => {
      const result = companion.handleDragEnd()
      const stabilizedSnapshot = stabilizer.stabilize(
        attachWorkModeToSnapshot(result.snapshot, workModeRuntime.getSignals()),
      )
      latestSnapshot = stabilizedSnapshot
      runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))
    },
    onTap: () => {
      const result = companion.handleTap()
      const stabilizedSnapshot = stabilizer.stabilize(
        attachWorkModeToSnapshot(result.snapshot, workModeRuntime.getSignals()),
      )
      latestSnapshot = stabilizedSnapshot
      runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))
      if (result.speech) {
        speakWithPolicy(
          'tap',
          stabilizedSnapshot,
          result.speech.message,
          result.speech.duration,
          deriveSpeechPresentation(stabilizedSnapshot, result.speech.message),
        )
      }
    },
  })

  dragController.mount()

  runtime.canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    contextMenu.show(event.clientX, event.clientY)
  })

  document.addEventListener('mousedown', (event) => {
    if (contextMenuEl.classList.contains('show') && !contextMenuEl.contains(event.target as Node)) {
      contextMenu.hide()
    }
  })

  window.electronAPI?.onSpeech?.((msg: string, dur: number) => {
    speakWithPolicy('external', latestSnapshot, msg, dur, {
      tone: 'warm',
      kicker: currentSpeechKicker,
    })
  })

  window.electronAPI?.onContextUpdate?.((info: { title: string; process: string; idleMs?: number }) => {
    const result = companion.handleContext(info)
    captureCompanionRuntimeContext(result.snapshot.activity, info.title)
    const snapshotWithWorkMode = attachWorkModeToSnapshot(result.snapshot, workModeRuntime.getSignals())
    const stabilizedSnapshot = stabilizer.stabilize(snapshotWithWorkMode)
    latestSnapshot = stabilizedSnapshot
    runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))
    if (result.speech) {
      speakWithPolicy(
        'context',
        stabilizedSnapshot,
        result.speech.message,
        result.speech.duration,
        deriveSpeechPresentation(stabilizedSnapshot, result.speech.message),
      )
    }
  })

  const proactiveTimer = window.setInterval(() => {
    const result = companion.handleTick()
    workModeRuntime.tick()
    const workModeSignals = workModeRuntime.getSignals()
    const snapshotWithWorkMode = attachWorkModeToSnapshot(result.snapshot, workModeSignals)
    const stabilizedSnapshot = stabilizer.stabilize(snapshotWithWorkMode)
    latestSnapshot = stabilizedSnapshot
    runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))

    const proactiveSpeech = proactiveScheduler.evaluate(
      stabilizedSnapshot,
      companion.getRuntimeSignals(),
      workModeSignals,
      lowDistractionMode,
    )

    if (proactiveSpeech) {
      const didSpeak = speakWithPolicy(
        'proactive',
        stabilizedSnapshot,
        proactiveSpeech.message,
        proactiveSpeech.duration,
        deriveSpeechPresentation(stabilizedSnapshot, proactiveSpeech.message),
      )

      if (didSpeak) {
        const actionPayload = buildCompanionActions(stabilizedSnapshot, workModeSignals, proactiveSpeech.message)
        if (actionPayload) {
          emitCompanionAction(actionPayload)
        }
      }
    }
  }, 20_000)

  window.addEventListener('beforeunload', () => {
    window.clearInterval(proactiveTimer)
    unsubscribeMemory()
    unsubscribeWorkMode()
    unsubscribeSelectedPet()
    unsubscribeCompanionPreferences()
    unsubscribeCompanionUtterance()
    dragController.destroy()
    runtime.destroy()
  })

  const hour = new Date().getHours()
  const preferredName = readCompanionMemory().preferredName
  if (hour >= 23 || hour < 6) {
    speakWithPolicy(
      'startup',
      latestSnapshot,
      preferredName ? `${preferredName}，${LATE_NIGHT_MESSAGE}` : LATE_NIGHT_MESSAGE,
      4200,
      { tone: 'quiet', kicker: 'LOW LIGHT' },
    )
  } else {
    speakWithPolicy(
      'startup',
      latestSnapshot,
      preferredName ? `${DESKTOP_GREETING} 欢迎回来，${preferredName}。` : DESKTOP_GREETING,
      2600,
      { tone: 'warm', kicker: 'SETTLING IN' },
    )
  }
}

void bootstrap()
