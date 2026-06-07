import type { CompanionPreferencesState } from '../types/companionPreferences'

export const COMPANION_PREFERENCES_STORAGE_KEY = 'deep-pet.companion-preferences.v1'

const COMPANION_PREFERENCES_CHANNEL = 'deep-pet:companion-preferences'
const COMPANION_PREFERENCES_EVENT = 'deep-pet:companion-preferences-sync'

const DEFAULT_STATE: CompanionPreferencesState = {
  lowDistractionMode: true,
}

let broadcastChannel: BroadcastChannel | null = null

export function getDefaultCompanionPreferencesState(): CompanionPreferencesState {
  return { ...DEFAULT_STATE }
}

export function cloneCompanionPreferencesState(
  state: CompanionPreferencesState,
): CompanionPreferencesState {
  return {
    lowDistractionMode: state.lowDistractionMode,
  }
}

export function readCompanionPreferencesState(): CompanionPreferencesState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return getDefaultCompanionPreferencesState()
    }

    const raw = window.localStorage.getItem(COMPANION_PREFERENCES_STORAGE_KEY)
    if (!raw) {
      return getDefaultCompanionPreferencesState()
    }

    return normalizeCompanionPreferencesState(JSON.parse(raw) as Partial<CompanionPreferencesState>)
  } catch {
    return getDefaultCompanionPreferencesState()
  }
}

export function writeCompanionPreferencesState(
  state: CompanionPreferencesState,
): CompanionPreferencesState {
  const normalized = normalizeCompanionPreferencesState(state)

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(COMPANION_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // ignore persistence failures and still notify listeners
  }

  notifyCompanionPreferences(normalized)
  return normalized
}

export function updateCompanionPreferencesState(
  updater: (state: CompanionPreferencesState) => CompanionPreferencesState,
): CompanionPreferencesState {
  return writeCompanionPreferencesState(updater(readCompanionPreferencesState()))
}

export function subscribeCompanionPreferences(
  listener: (state: CompanionPreferencesState) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const emitCurrent = () => listener(readCompanionPreferencesState())
  const onStorage = (event: StorageEvent) => {
    if (event.key === COMPANION_PREFERENCES_STORAGE_KEY) {
      emitCurrent()
    }
  }
  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<CompanionPreferencesState>).detail
    if (detail) {
      listener(normalizeCompanionPreferencesState(detail))
      return
    }
    emitCurrent()
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(COMPANION_PREFERENCES_EVENT, onInternal as EventListener)

  const channel = getBroadcastChannel()
  const onMessage = (event: MessageEvent<CompanionPreferencesState>) => {
    listener(normalizeCompanionPreferencesState(event.data))
  }
  channel?.addEventListener('message', onMessage as EventListener)

  emitCurrent()

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(COMPANION_PREFERENCES_EVENT, onInternal as EventListener)
    channel?.removeEventListener('message', onMessage as EventListener)
  }
}

function normalizeCompanionPreferencesState(
  state: Partial<CompanionPreferencesState>,
): CompanionPreferencesState {
  return {
    lowDistractionMode: Boolean(state.lowDistractionMode ?? DEFAULT_STATE.lowDistractionMode),
  }
}

function notifyCompanionPreferences(state: CompanionPreferencesState) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COMPANION_PREFERENCES_EVENT, { detail: state }))
  }
  getBroadcastChannel()?.postMessage(state)
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(COMPANION_PREFERENCES_CHANNEL)
    } catch {
      broadcastChannel = null
    }
  }
  return broadcastChannel
}
