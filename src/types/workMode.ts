export type WorkModePhase = 'idle' | 'focus' | 'short_break' | 'long_break' | 'paused'

export interface WorkModeConfig {
  enabled: boolean
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  overworkReminderMinutes: number
}

export interface WorkModeSnapshot {
  phase: WorkModePhase
  phaseStartedAt: number | null
  phaseEndsAt: number | null
  completedFocusSessions: number
  totalFocusMsToday: number
  isMutedUntilBreak: boolean
  updatedAt: number | null
}

export interface WorkModeState {
  config: WorkModeConfig
  snapshot: WorkModeSnapshot
}

export interface WorkModeSignals {
  enabled: boolean
  phase: WorkModePhase
  isFocusActive: boolean
  isBreakActive: boolean
  isPaused: boolean
  phaseStartedAt: number | null
  phaseElapsedMs: number
  msRemaining: number | null
  totalFocusMsToday: number
  consecutiveFocusSessions: number
  overworkLevel: 'none' | 'gentle' | 'firm'
}
