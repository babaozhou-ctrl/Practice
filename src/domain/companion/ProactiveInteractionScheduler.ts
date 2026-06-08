import type { WorkModeSignals } from '../../types/workMode'
import type { SpeechIntent } from './types'
import type { CompanionActivity, CompanionRuntimeSignals, CompanionSnapshot, InteractionMode } from './types'

interface SchedulerState {
  lastPromptAt: number
  lastPromptCategory: string | null
  lastPromptContextKey: string | null
}

interface PromptCandidate {
  category: string
  contextKey: string
  intent: SpeechIntent
}

export class ProactiveInteractionScheduler {
  private state: SchedulerState = {
    lastPromptAt: 0,
    lastPromptCategory: null,
    lastPromptContextKey: null,
  }

  evaluate(
    snapshot: CompanionSnapshot,
    signals: CompanionRuntimeSignals,
    workMode: WorkModeSignals,
    lowDistractionMode = false,
    now = Date.now(),
  ): SpeechIntent | undefined {
    const candidate = this.pickCandidate(snapshot, signals, workMode, lowDistractionMode, now)
    if (!candidate) {
      return undefined
    }

    this.state.lastPromptAt = now
    this.state.lastPromptCategory = candidate.category
    this.state.lastPromptContextKey = candidate.contextKey
    return candidate.intent
  }

  private pickCandidate(
    snapshot: CompanionSnapshot,
    signals: CompanionRuntimeSignals,
    workMode: WorkModeSignals,
    lowDistractionMode: boolean,
    now: number,
  ): PromptCandidate | null {
    if (!isEligibleForPrompt(snapshot, signals, workMode, lowDistractionMode, now, this.state.lastPromptAt)) {
      return null
    }

    const lateNight = isLateNight(now)
    const memory = snapshot.memory
    const name = memory?.preferredName?.trim() || null
    const ritual = memory?.rituals[0]?.trim() || null
    const recentTopic = memory?.recentTopics[0]?.trim() || null
    const activeTitle = snapshot.activeWindow?.title?.trim() || null

    const baseContextKey = [
      snapshot.activity,
      snapshot.emotion,
      snapshot.mode,
      recentTopic ? trimForSpeech(recentTopic, 18) : '',
      activeTitle ? trimForSpeech(activeTitle, 18) : '',
    ].join('|')

    const shouldSkipForRepeat = (category: string) =>
      this.state.lastPromptCategory === category &&
      this.state.lastPromptContextKey === `${category}|${baseContextKey}`

    if (workMode.enabled && workMode.isFocusActive && workMode.msRemaining !== null && workMode.msRemaining <= 2 * 60_000) {
      return {
        category: 'focus-ending',
        contextKey: `focus-ending|${baseContextKey}`,
        intent: {
          message: name
            ? `${name}，这一轮专注快收尾了。再稳一小会儿，我们就去休息。`
            : '这一轮专注快收尾了。再稳一小会儿，我们就去休息。',
          duration: 3600,
        },
      }
    }

    if (workMode.enabled && workMode.isBreakActive && workMode.msRemaining !== null && workMode.msRemaining <= 90_000) {
      return {
        category: 'break-ending',
        contextKey: `break-ending|${baseContextKey}`,
        intent: {
          message: name
            ? `${name}，休息差不多了。等你准备好，我们再慢慢回到专注里。`
            : '休息差不多了。等你准备好，我们再慢慢回到专注里。',
          duration: 3600,
        },
      }
    }

    if (workMode.enabled && workMode.overworkLevel === 'firm') {
      return {
        category: 'overwork-firm',
        contextKey: `overwork-firm|${baseContextKey}`,
        intent: {
          message: name
            ? `${name}，你今天已经撑很久了。这次我想认真提醒你，先停一下也没关系。`
            : '你今天已经撑很久了。这次我想认真提醒你，先停一下也没关系。',
          duration: 4600,
        },
      }
    }

    if (workMode.enabled && workMode.overworkLevel === 'gentle' && workMode.isFocusActive) {
      return {
        category: 'overwork-gentle',
        contextKey: `overwork-gentle|${baseContextKey}`,
        intent: {
          message: name
            ? `${name}，你今天已经很努力了。下一个空档里，我们认真休息一下吧。`
            : '你今天已经很努力了。下一个空档里，我们认真休息一下吧。',
          duration: 4000,
        },
      }
    }

    if (lowDistractionMode) {
      return null
    }

    if (signals.productiveSessionMs >= 52 * 60_000 && isProductive(snapshot.activity)) {
      if (ritual) {
        if (shouldSkipForRepeat('productive-ritual')) {
          return null
        }
        return {
          category: 'productive-ritual',
          contextKey: `productive-ritual|${baseContextKey}`,
          intent: {
            message: name
              ? `${name}，你已经专注挺久了。要不要按你平时“${trimForSpeech(ritual, 18)}”的节奏休息一下？`
              : `你已经专注挺久了。要不要按你平时“${trimForSpeech(ritual, 18)}”的节奏休息一下？`,
            duration: 4200,
          },
        }
      }

      if (recentTopic) {
        if (shouldSkipForRepeat('productive-topic')) {
          return null
        }
        return {
          category: 'productive-topic',
          contextKey: `productive-topic|${baseContextKey}`,
          intent: {
            message: name
              ? `${name}，这阵子你一直在忙“${trimForSpeech(recentTopic, 20)}”。起来活动一下，我继续陪你收尾。`
              : `这阵子你一直在忙“${trimForSpeech(recentTopic, 20)}”。起来活动一下，我继续陪你收尾。`,
            duration: 4200,
          },
        }
      }

      if (shouldSkipForRepeat('productive-default')) {
        return null
      }

      return {
        category: 'productive-default',
        contextKey: `productive-default|${baseContextKey}`,
        intent: {
          message: name
            ? `${name}，你已经专注很久了，要不要起来活动一下？`
            : '你已经专注很久了，要不要起来活动一下？',
          duration: 4000,
        },
      }
    }

    if (lateNight && ['coding', 'browsing', 'idle', 'other', 'reading'].includes(snapshot.activity)) {
      if (ritual) {
        if (shouldSkipForRepeat('late-night-ritual')) {
          return null
        }
        return {
          category: 'late-night-ritual',
          contextKey: `late-night-ritual|${baseContextKey}`,
          intent: {
            message: name
              ? `${name}，已经有点晚了。如果你准备按“${trimForSpeech(ritual, 18)}”慢慢收尾，我会轻一点陪着你。`
              : `已经有点晚了。如果你准备按“${trimForSpeech(ritual, 18)}”慢慢收尾，我会轻一点陪着你。`,
            duration: 4200,
          },
        }
      }

      if (shouldSkipForRepeat('late-night-default')) {
        return null
      }

      return {
        category: 'late-night-default',
        contextKey: `late-night-default|${baseContextKey}`,
        intent: {
          message: name
            ? `${name}，已经有点晚了。我会轻一点陪着你，但也想提醒你别太累。`
            : '已经有点晚了。我会轻一点陪着你，但也想提醒你别太累。',
          duration: 4200,
        },
      }
    }

    if (
      snapshot.activity === 'watching_video' &&
      snapshot.mode === 'reactive' &&
      signals.timeSinceLastContextMs > 4 * 60_000 &&
      recentTopic
    ) {
      if (shouldSkipForRepeat('watch-together')) {
        return null
      }

      return {
        category: 'watch-together',
        contextKey: `watch-together|${baseContextKey}`,
        intent: {
          message: `这一段像是在一起看“${trimForSpeech(recentTopic, 22)}”。我在旁边陪你。`,
          duration: 3400,
        },
      }
    }

    if (
      snapshot.activity === 'idle' &&
      snapshot.mode === 'observing' &&
      signals.timeSinceLastContextMs > 10 * 60_000 &&
      signals.interruptionBudget >= 70
    ) {
      if (shouldSkipForRepeat('gentle-check-in')) {
        return null
      }

      return {
        category: 'gentle-check-in',
        contextKey: `gentle-check-in|${baseContextKey}`,
        intent: {
          message: activeTitle
            ? `桌面现在很安静，我就陪你待在“${trimForSpeech(activeTitle, 20)}”旁边。`
            : '桌面现在很安静，我就这样陪你待着。',
          duration: 3200,
        },
      }
    }

    return null
  }
}

function isEligibleForPrompt(
  snapshot: CompanionSnapshot,
  signals: CompanionRuntimeSignals,
  workMode: WorkModeSignals,
  lowDistractionMode: boolean,
  now: number,
  lastPromptAt: number,
): boolean {
  if (snapshot.transientAction !== 'none') return false
  if (signals.userIdleMs >= 90_000) return false
  if (snapshot.mode === 'quiet' && signals.interruptionBudget < 80) return false
  if (signals.interruptionBudget < (lowDistractionMode ? 58 : 35)) return false
  if (signals.timeSinceLastTapMs < 90_000) return false
  if (signals.timeSinceLastReactionMs < (lowDistractionMode ? 180_000 : 90_000)) return false
  if (signals.currentActivityDurationMs < (lowDistractionMode ? 120_000 : 45_000) && snapshot.activity !== 'idle') return false
  if (signals.currentModeDurationMs < (lowDistractionMode ? 90_000 : 35_000) && snapshot.mode !== 'observing') return false

  const modeCooldown = getModeCooldown(snapshot.mode, workMode, lowDistractionMode)
  if (lastPromptAt && now - lastPromptAt < modeCooldown) return false

  if (snapshot.activity === 'gaming') return false
  if (snapshot.mode === 'focus_guardian' && signals.productiveSessionMs < 45 * 60_000) return false

  return true
}

function getModeCooldown(
  mode: InteractionMode,
  workMode: WorkModeSignals,
  lowDistractionMode: boolean,
): number {
  if (workMode.enabled && workMode.isFocusActive) {
    return lowDistractionMode ? 22 * 60_000 : 12 * 60_000
  }

  switch (mode) {
    case 'quiet':
      return lowDistractionMode ? 42 * 60_000 : 28 * 60_000
    case 'focus_guardian':
      return lowDistractionMode ? 32 * 60_000 : 22 * 60_000
    case 'reactive':
      return lowDistractionMode ? 28 * 60_000 : 18 * 60_000
    case 'proactive':
      return lowDistractionMode ? 24 * 60_000 : 14 * 60_000
    default:
      return lowDistractionMode ? 26 * 60_000 : 16 * 60_000
  }
}

function isLateNight(now: number): boolean {
  const hour = new Date(now).getHours()
  return hour >= 23 || hour < 6
}

function isProductive(activity: CompanionActivity): boolean {
  return activity === 'coding' || activity === 'reading' || activity === 'browsing'
}

function trimForSpeech(value: string, maxLength: number): string {
  const normalized = value.trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength).trim()}...`
}
