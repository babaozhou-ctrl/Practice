import { looksLikeMusicPlayback } from '../../context/ActivityClassifier'
import type { ActiveWindowInfo } from '../../types/context'
import type { WorkModeSignals } from '../../types/workMode'
import type { ScreenContextSignals } from './ScreenPerceptionSemantics'
import type { CompanionActivity, CompanionEmotion, InteractionMode } from './types'

export type CompanionSceneId =
  | 'away'
  | 'deep_focus'
  | 'steady_focus'
  | 'watch_together'
  | 'social_corner'
  | 'play_session'
  | 'reading_nook'
  | 'late_night_wind_down'
  | 'quiet_idle'
  | 'soft_browsing'
  | 'ambient_presence'

export type CompanionSceneEnergy = 'low' | 'steady' | 'bright'

export interface CompanionSceneSnapshot {
  id: CompanionSceneId
  label: string
  energy: CompanionSceneEnergy
  tone: string
  flags: string[]
}

export interface ResolveCompanionSceneInput {
  activity: CompanionActivity
  emotion: CompanionEmotion
  mode: InteractionMode
  activeWindow: ActiveWindowInfo | null
  screenContext?: ScreenContextSignals | null
  workMode?: WorkModeSignals | null
  now?: number
}

const AWAY_IDLE_MS = 90_000

export function resolveCompanionScene(
  input: ResolveCompanionSceneInput,
): CompanionSceneSnapshot {
  const now = input.now ?? Date.now()
  const idleMs = input.activeWindow?.idleMs ?? 0
  const lateNight = isLateNight(now)
  const focusMinutes = Math.floor((input.workMode?.phaseElapsedMs ?? 0) / 60_000)
  const screenContext = input.screenContext ?? null
  const musicListening = input.activeWindow ? looksLikeMusicPlayback(input.activeWindow) : false
  const flags = new Set<string>()

  if (lateNight) flags.add('late_night')
  if (input.workMode?.enabled) flags.add('work_mode')
  if (input.workMode?.isFocusActive) flags.add('focus_session')
  if (input.workMode?.isBreakActive) flags.add('break_window')
  if (input.mode === 'focus_guardian') flags.add('quiet_company')
  if (input.emotion === 'sleepy') flags.add('low_energy')
  if (screenContext?.domain && screenContext.domain !== 'none') {
    flags.add(`screen_${screenContext.domain}`)
  }
  if (musicListening) {
    flags.add('music_listening')
  }

  if (idleMs >= AWAY_IDLE_MS) {
    return createScene('away', '暂时离开', 'low', 'silent_guard', flags)
  }

  if (lateNight && ['coding', 'reading', 'browsing', 'idle', 'other'].includes(input.activity)) {
    flags.add('wind_down')
    return createScene('late_night_wind_down', '深夜收尾', 'low', 'hushed_warm', flags)
  }

  if (input.activity === 'coding') {
    if (input.workMode?.isFocusActive && (focusMinutes >= 20 || input.workMode.totalFocusMsToday >= 75 * 60_000)) {
      flags.add('deep_work')
      if (musicListening) {
        flags.add('rhythmic_focus')
        return createScene('deep_focus', '听着写东西', 'steady', 'rhythmic_focus', flags)
      }
      return createScene('deep_focus', '沉浸编程', 'steady', 'soft_focus', flags)
    }

    flags.add('productive')
    if (musicListening) {
      flags.add('rhythmic_focus')
      return createScene('steady_focus', '听着写东西', 'steady', 'rhythmic_focus', flags)
    }
    return createScene('steady_focus', '专注工作', 'steady', 'calm_focus', flags)
  }

  if (input.activity === 'reading') {
    flags.add('reading_flow')
    return createScene('reading_nook', '安静阅读', 'low', 'quiet_observing', flags)
  }

  if (screenContext?.domain === 'video' && input.activity !== 'gaming') {
    flags.add('co_viewing')
    return createScene('watch_together', musicListening ? '一起听着' : '一起看内容', 'steady', musicListening ? 'shared_rhythm' : 'shared_reaction', flags)
  }

  if (screenContext?.domain === 'social' && input.activity !== 'gaming') {
    flags.add('social_presence')
    return createScene('social_corner', '聊天陪伴', 'bright', 'warm_social', flags)
  }

  if (screenContext?.domain === 'reading' && input.activity === 'browsing') {
    flags.add('reading_flow')
    return createScene('reading_nook', '安静阅读', 'low', 'quiet_observing', flags)
  }

  if (input.activity === 'watching_video') {
    flags.add('co_viewing')
    return createScene('watch_together', musicListening ? '一起听着' : '一起看内容', 'steady', musicListening ? 'shared_rhythm' : 'shared_reaction', flags)
  }

  if (input.activity === 'chatting') {
    flags.add('social_presence')
    return createScene('social_corner', '聊天陪伴', 'bright', 'warm_social', flags)
  }

  if (input.activity === 'gaming') {
    flags.add('do_not_interrupt')
    return createScene('play_session', '游戏时间', 'bright', 'quiet_hype', flags)
  }

  if (input.activity === 'idle' && input.mode === 'quiet') {
    flags.add('resting')
    if (musicListening) {
      flags.add('soft_listening')
      return createScene('quiet_idle', '安静听着', 'low', 'soft_listening', flags)
    }
    return createScene('quiet_idle', '安静待机', 'low', 'gentle_idle', flags)
  }

  if (input.activity === 'idle') {
    flags.add('low_intrusion')
    if (musicListening) {
      flags.add('soft_listening')
      return createScene('quiet_idle', '安静听着', 'low', 'soft_listening', flags)
    }
    return createScene('quiet_idle', '静静陪着', 'low', 'gentle_idle', flags)
  }

  if (input.activity === 'browsing') {
    flags.add('light_exploration')
    if (musicListening) {
      flags.add('soft_listening')
      return createScene('soft_browsing', '边听边看', 'steady', 'shared_rhythm', flags)
    }
    return createScene('soft_browsing', '轻度浏览', 'steady', 'observant_soft', flags)
  }

  return createScene('ambient_presence', '桌面陪伴', 'steady', 'ambient_soft', flags)
}

function createScene(
  id: CompanionSceneId,
  label: string,
  energy: CompanionSceneEnergy,
  tone: string,
  flags: Set<string>,
): CompanionSceneSnapshot {
  return {
    id,
    label,
    energy,
    tone,
    flags: [...flags],
  }
}

function isLateNight(now: number): boolean {
  const hour = new Date(now).getHours()
  return hour >= 23 || hour < 6
}
