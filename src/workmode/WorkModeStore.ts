import type { WorkModeConfig, WorkModeSnapshot, WorkModeState } from '../types/workMode'

export const WORK_MODE_STORAGE_KEY = 'deep-pet.work-mode.v1'

const WORK_MODE_CHANNEL = 'deep-pet:work-mode'
const WORK_MODE_EVENT = 'deep-pet:work-mode-sync'

const DEFAULT_CONFIG: WorkModeConfig = {
  enabled: false,
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  overworkReminderMinutes: 90,
}

const DEFAULT_SNAPSHOT: WorkModeSnapshot = {
  phase: 'idle',
  phaseStartedAt: null,
  phaseEndsAt: null,
  completedFocusSessions: 0,
  totalFocusMsToday: 0,
  isMutedUntilBreak: false,
  updatedAt: null,
}

let broadcastChannel: BroadcastChannel | null = null

type PartialWorkModeState = {
  config?: Partial<WorkModeConfig>
  snapshot?: Partial<WorkModeSnapshot>
}

export function getDefaultWorkModeState(): WorkModeState {
  return {
    config: { ...DEFAULT_CONFIG },
    snapshot: { ...DEFAULT_SNAPSHOT },
  }
}

export function cloneWorkModeState(state: WorkModeState): WorkModeState {
  return {
    config: { ...state.config },
    snapshot: { ...state.snapshot },
  }
}

export function readWorkModeState(): WorkModeState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return getDefaultWorkModeState()
    }

    const raw = window.localStorage.getItem(WORK_MODE_STORAGE_KEY)
    if (!raw) {
      return getDefaultWorkModeState()
    }

    return normalizeWorkModeState(JSON.parse(raw) as PartialWorkModeState)
  } catch {
    return getDefaultWorkModeState()
  }
}

export function writeWorkModeState(state: WorkModeState): WorkModeState {
  const normalized = normalizeWorkModeState(state)

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(WORK_MODE_STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // ignore persistence failures and still notify in-memory listeners
  }

  notifyWorkMode(normalized)
  return normalized
}

export function updateWorkModeState(updater: (state: WorkModeState) => WorkModeState): WorkModeState {
  return writeWorkModeState(updater(readWorkModeState()))
}

export function subscribeWorkMode(listener: (state: WorkModeState) => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const emitCurrent = () => listener(readWorkModeState())
  const onStorage = (event: StorageEvent) => {
    if (event.key === WORK_MODE_STORAGE_KEY) {
      emitCurrent()
    }
  }
  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<WorkModeState>).detail
    if (detail) {
      listener(normalizeWorkModeState(detail))
      return
    }
    emitCurrent()
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(WORK_MODE_EVENT, onInternal as EventListener)

  const channel = getBroadcastChannel()
  const onMessage = (event: MessageEvent<WorkModeState>) => {
    listener(normalizeWorkModeState(event.data))
  }
  channel?.addEventListener('message', onMessage as EventListener)

  emitCurrent()

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(WORK_MODE_EVENT, onInternal as EventListener)
    channel?.removeEventListener('message', onMessage as EventListener)
  }
}

function normalizeWorkModeState(value: PartialWorkModeState): WorkModeState {
  const config = value.config ?? {}
  const snapshot = value.snapshot ?? {}

  return {
    config: {
      enabled: Boolean(config.enabled ?? DEFAULT_CONFIG.enabled),
      focusMinutes: normalizeMinutes(config.focusMinutes, DEFAULT_CONFIG.focusMinutes, 15, 120),
      shortBreakMinutes: normalizeMinutes(config.shortBreakMinutes, DEFAULT_CONFIG.shortBreakMinutes, 1, 30),
      longBreakMinutes: normalizeMinutes(config.longBreakMinutes, DEFAULT_CONFIG.longBreakMinutes, 5, 60),
      longBreakEvery: normalizeMinutes(config.longBreakEvery, DEFAULT_CONFIG.longBreakEvery, 2, 8),
      autoStartBreaks: Boolean(config.autoStartBreaks ?? DEFAULT_CONFIG.autoStartBreaks),
      autoStartFocus: Boolean(config.autoStartFocus ?? DEFAULT_CONFIG.autoStartFocus),
      overworkReminderMinutes: normalizeMinutes(
        config.overworkReminderMinutes,
        DEFAULT_CONFIG.overworkReminderMinutes,
        30,
        240,
      ),
    },
    snapshot: {
      phase: normalizePhase(snapshot.phase),
      phaseStartedAt: normalizeTimestamp(snapshot.phaseStartedAt),
      phaseEndsAt: normalizeTimestamp(snapshot.phaseEndsAt),
      completedFocusSessions: normalizeInteger(snapshot.completedFocusSessions, 0, 0, 9999),
      totalFocusMsToday: normalizeInteger(snapshot.totalFocusMsToday, 0, 0, 24 * 60 * 60 * 1000),
      isMutedUntilBreak: Boolean(snapshot.isMutedUntilBreak ?? DEFAULT_SNAPSHOT.isMutedUntilBreak),
      updatedAt: normalizeTimestamp(snapshot.updatedAt),
    },
  }
}

function normalizePhase(value: unknown): WorkModeSnapshot['phase'] {
  const allowed: WorkModeSnapshot['phase'][] = ['idle', 'focus', 'short_break', 'long_break', 'paused']
  return typeof value === 'string' && allowed.includes(value as WorkModeSnapshot['phase'])
    ? (value as WorkModeSnapshot['phase'])
    : DEFAULT_SNAPSHOT.phase
}

function normalizeMinutes(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return null
  return value
}

function notifyWorkMode(state: WorkModeState) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORK_MODE_EVENT, { detail: state }))
  }
  getBroadcastChannel()?.postMessage(state)
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(WORK_MODE_CHANNEL)
    } catch {
      broadcastChannel = null
    }
  }
  return broadcastChannel
}
