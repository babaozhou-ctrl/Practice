import type { WorkModeSignals } from '../../types/workMode'
import type { SpeechIntent } from './types'
import type { CompanionActivity, CompanionRuntimeSignals, CompanionSnapshot, InteractionMode } from './types'
import type { BuiltInPetPackage } from '../../shared/types/petPackage'
import { buildProactiveTemplateContext, renderProactiveTemplate, resolveSharedAttention } from './CompanionProactiveTemplate'

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
    petPackage: BuiltInPetPackage | null,
    snapshot: CompanionSnapshot,
    signals: CompanionRuntimeSignals,
    workMode: WorkModeSignals,
    lowDistractionMode = false,
    now = Date.now(),
  ): SpeechIntent | undefined {
    const candidate = this.pickCandidate(petPackage, snapshot, signals, workMode, lowDistractionMode, now)
    if (!candidate) {
      return undefined
    }

    this.state.lastPromptAt = now
    this.state.lastPromptCategory = candidate.category
    this.state.lastPromptContextKey = candidate.contextKey
    return candidate.intent
  }

  private pickCandidate(
    petPackage: BuiltInPetPackage | null,
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
    const recentFile = resolveRecentFile(snapshot)
    const activeTitle = snapshot.activeWindow?.title?.trim() || null
    const sceneId = snapshot.scene.id
    const screenShort = snapshot.screenContext.shortSummary
    const screenDomain = snapshot.screenContext.domain
    const sharedAttention = resolveSharedAttention(snapshot)
    const templateContext = buildProactiveTemplateContext(petPackage, snapshot, workMode, name)

    const baseContextKey = [
      sceneId,
      snapshot.activity,
      snapshot.emotion,
      snapshot.mode,
      recentTopic ? trimForSpeech(recentTopic, 18) : '',
      activeTitle ? trimForSpeech(activeTitle, 18) : '',
      screenShort ? trimForSpeech(screenShort, 18) : '',
      sharedAttention ? trimForSpeech(sharedAttention, 18) : '',
      recentFile ? trimForSpeech(recentFile.fileName, 18) : '',
      screenDomain,
    ].join('|')

    const shouldSkipForRepeat = (category: string) =>
      this.state.lastPromptCategory === category &&
      this.state.lastPromptContextKey === `${category}|${baseContextKey}`

    if (workMode.enabled && workMode.isFocusActive && workMode.msRemaining !== null && workMode.msRemaining <= 2 * 60_000) {
      const configuredSpeech = resolveConfiguredProactiveSpeech(petPackage, 'focusEnding', templateContext)
      return {
        category: 'focus-ending',
        contextKey: `focus-ending|${baseContextKey}`,
        intent: configuredSpeech ?? {
          message: name
            ? `${name}，这一轮快收尾了。我们再稳一会儿，就去休息。`
            : '这一轮快收尾了。我们再稳一会儿，就去休息。',
          duration: 3400,
        },
      }
    }

    if (workMode.enabled && workMode.isBreakActive && workMode.msRemaining !== null && workMode.msRemaining <= 90_000) {
      const configuredSpeech = resolveConfiguredProactiveSpeech(petPackage, 'breakEnding', templateContext)
      return {
        category: 'break-ending',
        contextKey: `break-ending|${baseContextKey}`,
        intent: configuredSpeech ?? {
          message: name
            ? `${name}，休息差不多了。等你准备好，我们慢慢回到节奏里。`
            : '休息差不多了。等你准备好，我们慢慢回到节奏里。',
          duration: 3400,
        },
      }
    }

    if (workMode.enabled && workMode.overworkLevel === 'firm') {
      const configuredSpeech = resolveConfiguredProactiveSpeech(petPackage, 'overworkFirm', templateContext)
      return {
        category: 'overwork-firm',
        contextKey: `overwork-firm|${baseContextKey}`,
        intent: configuredSpeech ?? {
          message: name
            ? `${name}，你今天已经撑很久了。这次我想认真提醒你，先停一下也没关系。`
            : '你今天已经撑很久了。这次我想认真提醒你，先停一下也没关系。',
          duration: 4200,
        },
      }
    }

    if (workMode.enabled && workMode.overworkLevel === 'gentle' && workMode.isFocusActive) {
      const configuredSpeech = resolveConfiguredProactiveSpeech(petPackage, 'overworkGentle', templateContext)
      return {
        category: 'overwork-gentle',
        contextKey: `overwork-gentle|${baseContextKey}`,
        intent: configuredSpeech ?? {
          message: name
            ? `${name}，你今天已经很努力了。下一个空档里，我们认真歇一会儿吧。`
            : '你今天已经很努力了。下一个空档里，我们认真歇一会儿吧。',
          duration: 3800,
        },
      }
    }

    if (lowDistractionMode) {
      return null
    }

    if (
      recentFile &&
      ['reading_nook', 'soft_browsing', 'quiet_idle', 'ambient_presence'].includes(sceneId) &&
      signals.timeSinceLastContextMs > 3 * 60_000
    ) {
      if (shouldSkipForRepeat('recent-file-checkin')) {
        return null
      }

      const configuredSpeech = resolveConfiguredProactiveSpeech(petPackage, 'recentFileCheckin', templateContext)
      return {
        category: 'recent-file-checkin',
        contextKey: `recent-file-checkin|${baseContextKey}`,
        intent: configuredSpeech ?? {
          message: name
            ? `${name}，我还记得我们刚一起看过《${trimForSpeech(recentFile.fileName, 20)}》。如果你想继续，我可以接着陪你顺下去。`
            : `我还记得我们刚一起看过《${trimForSpeech(recentFile.fileName, 20)}》。如果你想继续，我可以接着陪你顺下去。`,
          duration: 3600,
        },
      }
    }

    if (signals.productiveSessionMs >= 52 * 60_000 && isProductiveScene(snapshot)) {
      const configuredSpeech = resolveConfiguredProactiveSpeech(petPackage, 'productiveSession', templateContext)
      if (ritual) {
        if (shouldSkipForRepeat('productive-ritual')) {
          return null
        }
        return {
          category: 'productive-ritual',
          contextKey: `productive-ritual|${baseContextKey}`,
          intent: configuredSpeech ?? {
            message: name
              ? `${name}，你已经专注挺久了。要不要按你平时“${trimForSpeech(ritual, 18)}”的节奏缓一缓？`
              : `你已经专注挺久了。要不要按你平时“${trimForSpeech(ritual, 18)}”的节奏缓一缓？`,
            duration: 3800,
          },
        }
      }

      if (sharedAttention && screenDomain === 'code') {
        if (shouldSkipForRepeat('productive-screen-code')) {
          return null
        }
        return {
          category: 'productive-screen-code',
          contextKey: `productive-screen-code|${baseContextKey}`,
          intent: configuredSpeech ?? {
            message: `你已经盯着“${trimForSpeech(sharedAttention, 22)}”挺久了。要不要先动一动，再回来把它收干净？`,
            duration: 3800,
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
          intent: configuredSpeech ?? {
            message: name
              ? `${name}，这阵子你一直在忙“${trimForSpeech(recentTopic, 20)}”。起身松一下，我继续陪你收尾。`
              : `这阵子你一直在忙“${trimForSpeech(recentTopic, 20)}”。起身松一下，我继续陪你收尾。`,
            duration: 3800,
          },
        }
      }

      if (shouldSkipForRepeat('productive-default')) {
        return null
      }

      return {
        category: 'productive-default',
        contextKey: `productive-default|${baseContextKey}`,
        intent: configuredSpeech ?? {
          message: name
            ? `${name}，你已经专注很久了。要不要起来活动一下？`
            : '你已经专注很久了。要不要起来活动一下？',
          duration: 3600,
        },
      }
    }

    if (
      sceneId === 'late_night_wind_down' ||
      (lateNight && ['coding', 'browsing', 'idle', 'other', 'reading'].includes(snapshot.activity))
    ) {
      const configuredSpeech = resolveConfiguredProactiveSpeech(petPackage, 'lateNight', templateContext)
      if (ritual) {
        if (shouldSkipForRepeat('late-night-ritual')) {
          return null
        }
        return {
          category: 'late-night-ritual',
          contextKey: `late-night-ritual|${baseContextKey}`,
          intent: configuredSpeech ?? {
            message: name
              ? `${name}，已经有点晚了。如果你准备按“${trimForSpeech(ritual, 18)}”的节奏慢慢收尾，我会轻一点陪着你。`
              : `已经有点晚了。如果你准备按“${trimForSpeech(ritual, 18)}”的节奏慢慢收尾，我会轻一点陪着你。`,
            duration: 4000,
          },
        }
      }

      if (sharedAttention) {
        if (shouldSkipForRepeat('late-night-attention')) {
          return null
        }
        return {
          category: 'late-night-attention',
          contextKey: `late-night-attention|${baseContextKey}`,
          intent: configuredSpeech ?? {
            message: `已经有点晚了。我看到你还陪在“${trimForSpeech(sharedAttention, 20)}”这边，我们慢一点也没关系。`,
            duration: 4000,
          },
        }
      }

      if (shouldSkipForRepeat('late-night-default')) {
        return null
      }

      return {
        category: 'late-night-default',
        contextKey: `late-night-default|${baseContextKey}`,
        intent: configuredSpeech ?? {
          message: name
            ? `${name}，已经有点晚了。我会轻一点陪着你，但也想提醒你别太累。`
            : '已经有点晚了。我会轻一点陪着你，但也想提醒你别太累。',
          duration: 4000,
        },
      }
    }

    if (
      (sceneId === 'watch_together' || screenDomain === 'video') &&
      snapshot.mode === 'reactive' &&
      signals.timeSinceLastContextMs > 4 * 60_000
    ) {
      if (shouldSkipForRepeat('watch-together')) {
        return null
      }

      const sharedViewTopic = sharedAttention || recentTopic || activeTitle
      const configuredSpeech = resolveConfiguredProactiveSpeech(petPackage, 'watchTogether', templateContext)
      return {
        category: 'watch-together',
        contextKey: `watch-together|${baseContextKey}`,
        intent: configuredSpeech ?? {
          message: sharedViewTopic
            ? `这会儿像是在一起看“${trimForSpeech(sharedViewTopic, 22)}”。我就在旁边陪你。`
            : '这会儿像是在一起看点什么。我就在旁边陪你。',
          duration: 3200,
        },
      }
    }

    if (
      (sceneId === 'social_corner' || screenDomain === 'social') &&
      snapshot.mode === 'reactive' &&
      signals.timeSinceLastContextMs > 4 * 60_000
    ) {
      if (shouldSkipForRepeat('social-corner')) {
        return null
      }

      const socialTopic = sharedAttention || activeTitle
      const configuredSpeech = resolveConfiguredProactiveSpeech(petPackage, 'socialCorner', templateContext)
      return {
        category: 'social-corner',
        contextKey: `social-corner|${baseContextKey}`,
        intent: configuredSpeech ?? {
          message: socialTopic
            ? `你像是在围着“${trimForSpeech(socialTopic, 20)}”聊天。我轻一点待在旁边，不打乱你的节奏。`
            : '你像是在和谁聊天。我轻一点待在旁边，不打乱你的节奏。',
          duration: 3200,
        },
      }
    }

    if (
      isIdlePresenceScene(snapshot) &&
      snapshot.mode === 'observing' &&
      signals.timeSinceLastContextMs > 10 * 60_000 &&
      signals.interruptionBudget >= 70
    ) {
      if (shouldSkipForRepeat('gentle-check-in')) {
        return null
      }

      const configuredSpeech = resolveConfiguredProactiveSpeech(petPackage, 'gentleIdle', templateContext)
      return {
        category: 'gentle-check-in',
        contextKey: `gentle-check-in|${baseContextKey}`,
        intent: configuredSpeech ?? {
          message: sharedAttention
            ? `桌面现在很安静，我就陪你待在“${trimForSpeech(sharedAttention, 20)}”旁边。`
            : activeTitle
              ? `桌面现在很安静，我就陪你待在“${trimForSpeech(activeTitle, 20)}”旁边。`
              : '桌面现在很安静，我就这样陪你待着。',
          duration: 3000,
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
    return lowDistractionMode ? 24 * 60_000 : 14 * 60_000
  }

  switch (mode) {
    case 'quiet':
      return lowDistractionMode ? 46 * 60_000 : 32 * 60_000
    case 'focus_guardian':
      return lowDistractionMode ? 34 * 60_000 : 24 * 60_000
    case 'reactive':
      return lowDistractionMode ? 30 * 60_000 : 20 * 60_000
    case 'proactive':
      return lowDistractionMode ? 26 * 60_000 : 16 * 60_000
    default:
      return lowDistractionMode ? 28 * 60_000 : 18 * 60_000
  }
}

function isLateNight(now: number): boolean {
  const hour = new Date(now).getHours()
  return hour >= 23 || hour < 6
}

function isProductive(activity: CompanionActivity): boolean {
  return activity === 'coding' || activity === 'reading' || activity === 'browsing'
}

function isProductiveScene(snapshot: CompanionSnapshot): boolean {
  return (
    ['deep_focus', 'steady_focus', 'reading_nook', 'soft_browsing'].includes(snapshot.scene.id) ||
    isProductive(snapshot.activity)
  )
}

function isIdlePresenceScene(snapshot: CompanionSnapshot): boolean {
  return snapshot.scene.id === 'quiet_idle' || snapshot.scene.id === 'ambient_presence' || snapshot.activity === 'idle'
}

function trimForSpeech(value: string, maxLength: number): string {
  const normalized = value.trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength).trim()}...`
}

function resolveRecentFile(snapshot: CompanionSnapshot) {
  const recent = snapshot.memory?.recentFileAnalyses?.[0]
  if (!recent?.fileName) {
    return null
  }

  if (Date.now() - recent.capturedAt > 40 * 60_000) {
    return null
  }

  return recent
}

function resolveConfiguredProactiveSpeech(
  petPackage: BuiltInPetPackage | null,
  key:
    | 'focusEnding'
    | 'breakEnding'
    | 'overworkFirm'
    | 'overworkGentle'
    | 'productiveSession'
    | 'lateNight'
    | 'watchTogether'
    | 'socialCorner'
    | 'recentFileCheckin'
    | 'gentleIdle',
  templateContext: Parameters<typeof renderProactiveTemplate>[1],
): SpeechIntent | null {
  const speech = petPackage?.companionContent?.proactive?.[key]?.speech
  if (!speech?.message?.trim()) {
    return null
  }

  return {
    message: renderProactiveTemplate(speech.message, templateContext),
    duration: speech.durationMs && speech.durationMs > 0 ? speech.durationMs : 3400,
  }
}
