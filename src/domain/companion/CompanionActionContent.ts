import type { CompanionActionPayload } from '../../ai/CompanionActionBridge'
import type {
  BuiltInPetPackage,
  PetCompanionContentEntry,
  PetCompanionContentProfile,
  PetCompanionProactiveTemplateContext,
} from '../../shared/types/petPackage'
import type { WorkModeSignals } from '../../types/workMode'
import type { CompanionSnapshot } from './types'
import {
  buildProactiveTemplateContext,
  renderProactiveTemplate,
  resolveSharedAttention,
} from './CompanionProactiveTemplate'

function createAction(
  id: string,
  label: string,
  prompt: string,
): NonNullable<CompanionActionPayload['actions']>[number] {
  return {
    id,
    label,
    prompt,
  }
}

type ProactiveContentKey = keyof PetCompanionContentProfile['proactive']

interface ResolvedActionScenario {
  key: ProactiveContentKey
  id: string
  source: CompanionActionPayload['source']
}

function isLateNightActivity(snapshot: CompanionSnapshot): boolean {
  return ['coding', 'reading', 'browsing', 'idle', 'other'].includes(snapshot.activity)
}

function isProductiveScene(snapshot: CompanionSnapshot): boolean {
  return ['deep_focus', 'steady_focus', 'reading_nook', 'soft_browsing'].includes(snapshot.scene.id)
}

function isLateNightScene(snapshot: CompanionSnapshot, now: number): boolean {
  const hour = new Date(now).getHours()
  return snapshot.scene.id === 'late_night_wind_down' || ((hour >= 23 || hour < 6) && isLateNightActivity(snapshot))
}

function isWatchTogetherScene(snapshot: CompanionSnapshot): boolean {
  return (
    snapshot.scene.id === 'watch_together' ||
    snapshot.activity === 'watching_video' ||
    snapshot.screenContext.domain === 'video'
  )
}

function isSocialCornerScene(snapshot: CompanionSnapshot): boolean {
  return snapshot.scene.id === 'social_corner' || snapshot.screenContext.domain === 'social'
}

function isIdlePresenceScene(snapshot: CompanionSnapshot): boolean {
  return (
    snapshot.scene.id === 'quiet_idle' ||
    snapshot.scene.id === 'ambient_presence' ||
    (snapshot.activity === 'idle' && snapshot.mode === 'observing')
  )
}

function getProductiveTitle(snapshot: CompanionSnapshot): string {
  switch (snapshot.scene.id) {
    case 'deep_focus':
      return '这段专注已经很深了'
    case 'reading_nook':
      return '你安静看了挺久'
    case 'soft_browsing':
      return '这会儿看得有点久了'
    default:
      return '今天已经很努力了'
  }
}

function getRecentFileName(snapshot: CompanionSnapshot): string | null {
  const recent = snapshot.memory?.recentFileAnalyses?.[0]
  if (!recent?.fileName) {
    return null
  }

  if (Date.now() - recent.capturedAt > 40 * 60_000) {
    return null
  }

  return recent.fileName
}

function entryToPayload(
  id: string,
  source: CompanionActionPayload['source'],
  message: string,
  entry: PetCompanionContentEntry | null | undefined,
  templateContext: PetCompanionProactiveTemplateContext,
): CompanionActionPayload | null {
  if (!entry || !entry.title || !Array.isArray(entry.actions) || entry.actions.length === 0) {
    return null
  }

  return {
    id,
    title: renderProactiveTemplate(entry.title, templateContext),
    message,
    source,
    actions: entry.actions
      .filter((action) => action && action.id && action.label && action.prompt)
      .map((action) =>
        createAction(
          action.id,
          renderProactiveTemplate(action.label, templateContext),
          renderProactiveTemplate(action.prompt, templateContext),
        ),
      ),
  }
}

function buildFallbackContent(
  scenario: ResolvedActionScenario,
  snapshot: CompanionSnapshot,
  workMode: WorkModeSignals,
  message: string,
  now = Date.now(),
): CompanionActionPayload | null {
  const memory = snapshot.memory
  const preferredName = memory?.preferredName?.trim() || '你'
  const sharedAttention = resolveSharedAttention(snapshot)
  const recentFileName = getRecentFileName(snapshot)

  switch (scenario.key) {
    case 'focusEnding':
      return {
        id: scenario.id,
        title: '这一轮快收尾了',
        message,
        source: scenario.source,
        actions: [
          createAction(
            'focus-finish-strong',
            '陪我收个尾',
            '我这一轮专注快结束了。请继续陪我把最后一点内容收干净，帮我判断现在最值得先完成的事。',
          ),
          createAction(
            'focus-start-break',
            '陪我去休息',
            '我准备开始休息了。陪我做一个轻一点的收尾，然后提醒我怎么把注意力慢慢放下来。',
          ),
          createAction(
            'focus-next-step',
            '帮我顺一下',
            `请根据我刚才这段专注状态${sharedAttention ? `，尤其是眼前这块“${sharedAttention}”` : ''}，帮我整理一个自然、轻量的下一步顺序，让我不用硬切换。`,
          ),
        ],
      }
    case 'breakEnding':
      return {
        id: scenario.id,
        title: '休息快结束了',
        message,
        source: scenario.source,
        actions: [
          createAction(
            'break-return-gently',
            '轻一点回去',
            '休息差不多结束了。请陪我温柔一点回到专注，不要一下子变得很紧绷。',
          ),
          createAction(
            'break-decide-first-step',
            '帮我定第一步',
            '我要回到工作里了。请帮我决定重启时第一步做什么，尽量让我容易重新进入状态。',
          ),
        ],
      }
    case 'overworkFirm':
      return {
        id: scenario.id,
        title: '这次真的该歇一会儿了',
        message,
        source: scenario.source,
        actions: [
          createAction(
            'overwork-wrap-up',
            '帮我轻点收尾',
            '我已经有点过劳了。请帮我做一个尽量轻的收尾，只保留今晚一定要结束的点。',
          ),
          createAction(
            'overwork-pause-reminder',
            '提醒我停一下',
            '我现在需要停一停。请用温和但坚定的方式提醒我为什么该先休息，并帮我放下手头的内容。',
          ),
        ],
      }
    case 'overworkGentle':
      return {
        id: scenario.id,
        title: '该松一口气了',
        message,
        source: scenario.source,
        actions: [
          createAction(
            'overwork-gentle-wrap',
            '先帮我收个口',
            '我有点绷太久了。请帮我把当前这段工作收个口，让我能比较自然地停下来。',
          ),
          createAction(
            'overwork-gentle-break',
            '提醒我歇会儿',
            '请提醒我认真休息一下，但语气轻一点，像陪伴而不是说教。',
          ),
        ],
      }
    case 'productiveSession':
      return {
        id: scenario.id,
        title: getProductiveTitle(snapshot),
        message,
        source: scenario.source,
        actions: [
          createAction(
            'productive-check-progress',
            '陪我看看进度',
            '我今天已经专注挺久了。请陪我快速看一眼现在的进度感，帮我判断接下来是继续冲还是适合缓一缓。',
          ),
          createAction(
            'productive-soft-plan',
            '帮我理轻一点',
            `请根据我现在这段投入状态${sharedAttention ? `，尤其是眼前这部分“${sharedAttention}”` : ''}，帮我整理一个轻一点的后续安排，不要太工具化。`,
          ),
        ],
      }
    case 'lateNight':
      return {
        id: scenario.id,
        title: '夜深了',
        message,
        source: scenario.source,
        actions: [
          createAction(
            'late-night-soft-wrap',
            '陪我温柔收尾',
            '有点晚了。请陪我做一个温柔的收尾，把今晚的内容放到一个能安心停下的位置。',
          ),
          createAction(
            'late-night-save-for-tomorrow',
            '只留明天继续的点',
            `请帮我只保留明天最值得继续的点${sharedAttention ? `，尤其是和“${sharedAttention}”有关的部分` : ''}，用很轻的方式整理出来，让我现在能安心休息。`,
          ),
        ],
      }
    case 'watchTogether':
      if (!sharedAttention) {
        return null
      }
      return {
        id: scenario.id,
        title: '像在一起看呢',
        message,
        source: scenario.source,
        actions: [
          createAction(
            'watch-highlight',
            '聊聊刚才那段',
            `我们刚才像是在一起看“${sharedAttention}”。请陪我用自然一点的方式聊聊最值得继续说的点。`,
          ),
        ],
      }
    case 'socialCorner':
      return {
        id: scenario.id,
        title: '轻轻陪着你聊天',
        message,
        source: scenario.source,
        actions: [
          createAction(
            'social-soft-reflect',
            '帮我顺一下感觉',
            sharedAttention
              ? `我刚才一直围着“${sharedAttention}”在聊天。请陪我用自然一点的方式顺一下刚才的感觉，不要太像总结报告。`
              : '我刚才在和别人聊天。请陪我用自然一点的方式顺一下刚才的感觉，不要太像总结报告。',
          ),
        ],
      }
    case 'recentFileCheckin':
      if (!recentFileName) {
        return null
      }
      return {
        id: scenario.id,
        title: '还记得刚才那份内容',
        message,
        source: scenario.source,
        actions: [
          createAction(
            'recent-file-continue',
            '继续顺下去',
            `我们刚才一起看过《${recentFileName}》。请陪我接着顺下去，先用几句自然的话提醒我最值得继续看的点。`,
          ),
        ],
      }
    case 'gentleIdle':
      return {
        id: scenario.id,
        title: '安静陪着你',
        message,
        source: scenario.source,
        actions: [
          createAction(
            'idle-soft-checkin',
            `${preferredName}在想什么`,
            sharedAttention
              ? `我现在有点安静，就陪你待在“${sharedAttention}”旁边。你可以像和陪伴角色说话一样，轻一点地问问我现在在想什么，或者想继续做什么。`
              : '我现在有点安静。你可以像和陪伴角色说话一样，轻一点地问问我现在在想什么，或者想继续做什么。',
          ),
        ],
      }
    default:
      return null
  }
}

export function buildCompanionActionPayload(
  petPackage: BuiltInPetPackage,
  snapshot: CompanionSnapshot,
  workMode: WorkModeSignals,
  message: string,
  now = Date.now(),
): CompanionActionPayload | null {
  const content = petPackage.companionContent?.proactive
  const memory = snapshot.memory
  const preferredName = memory?.preferredName?.trim() || '你'
  const templateContext = buildProactiveTemplateContext(petPackage, snapshot, workMode, preferredName)
  const scenario = resolveActionScenario(snapshot, workMode, now)
  if (!scenario) {
    return null
  }

  const payload =
    entryToPayload(scenario.id, scenario.source, message, content?.[scenario.key], templateContext) ??
    buildFallbackContent(scenario, snapshot, workMode, message, now)

  if (!payload) {
    return null
  }

  if (scenario.key !== 'gentleIdle') {
    return payload
  }

  return {
    ...payload,
    actions: payload.actions?.map((action) =>
      action.id === 'idle-soft-checkin'
        ? {
            ...action,
            label: action.label.includes('在想什么') ? `${preferredName}在想什么` : action.label,
          }
        : action,
    ),
  }
}

function resolveActionScenario(
  snapshot: CompanionSnapshot,
  workMode: WorkModeSignals,
  now: number,
): ResolvedActionScenario | null {
  if (workMode.enabled && workMode.isFocusActive && workMode.msRemaining !== null && workMode.msRemaining <= 2 * 60_000) {
    return {
      key: 'focusEnding',
      id: `focus-ending-${snapshot.timestamp}-${Math.round(workMode.msRemaining / 1000)}`,
      source: 'work-mode',
    }
  }

  if (workMode.enabled && workMode.isBreakActive && workMode.msRemaining !== null && workMode.msRemaining <= 90_000) {
    return {
      key: 'breakEnding',
      id: `break-ending-${snapshot.timestamp}-${Math.round(workMode.msRemaining / 1000)}`,
      source: 'work-mode',
    }
  }

  if (workMode.enabled && workMode.overworkLevel === 'firm') {
    return {
      key: 'overworkFirm',
      id: `overwork-firm-${snapshot.timestamp}`,
      source: 'work-mode',
    }
  }

  if (workMode.enabled && workMode.overworkLevel === 'gentle' && workMode.isFocusActive) {
    return {
      key: 'overworkGentle',
      id: `overwork-gentle-${snapshot.timestamp}`,
      source: 'work-mode',
    }
  }

  if (
    workMode.enabled &&
    workMode.totalFocusMsToday >= 52 * 60_000 &&
    snapshot.activity !== 'gaming' &&
    isProductiveScene(snapshot)
  ) {
    return {
      key: 'productiveSession',
      id: `productive-session-${snapshot.timestamp}`,
      source: 'proactive',
    }
  }

  if (isLateNightScene(snapshot, now)) {
    return {
      key: 'lateNight',
      id: `late-night-${snapshot.timestamp}`,
      source: 'proactive',
    }
  }

  if (isWatchTogetherScene(snapshot)) {
    return {
      key: 'watchTogether',
      id: `watch-together-${snapshot.timestamp}`,
      source: 'proactive',
    }
  }

  if (isSocialCornerScene(snapshot)) {
    return {
      key: 'socialCorner',
      id: `social-corner-${snapshot.timestamp}`,
      source: 'proactive',
    }
  }

  if (getRecentFileName(snapshot)) {
    return {
      key: 'recentFileCheckin',
      id: `recent-file-checkin-${snapshot.timestamp}`,
      source: 'proactive',
    }
  }

  if (isIdlePresenceScene(snapshot)) {
    return {
      key: 'gentleIdle',
      id: `gentle-idle-${snapshot.timestamp}`,
      source: 'proactive',
    }
  }

  return null
}
