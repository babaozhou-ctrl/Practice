export interface CompanionSettingsPreviewState {
  active: boolean
  selectedPetId: string | null
  lowDistractionMode: boolean | null
  chatEnabled: boolean | null
  chatConnected: boolean | null
  exitReason: 'applied' | 'dismissed' | 'idle' | 'stale' | null
  updatedAt: number | null
}

const STORAGE_KEY = 'deep-pet.settings-preview.v1'
const EVENT_NAME = 'deep-pet:settings-preview-sync'
const CHANNEL_NAME = 'deep-pet:settings-preview'
const ACTIVE_TTL_MS = 4_500

const DEFAULT_STATE: CompanionSettingsPreviewState = {
  active: false,
  selectedPetId: null,
  lowDistractionMode: null,
  chatEnabled: null,
  chatConnected: null,
  exitReason: null,
  updatedAt: null,
}

let broadcastChannel: BroadcastChannel | null = null

export function readCompanionSettingsPreviewState(): CompanionSettingsPreviewState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_STATE }
    }

    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_STATE }
    }

    return normalizeCompanionSettingsPreviewState(JSON.parse(raw) as Partial<CompanionSettingsPreviewState>)
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function writeCompanionSettingsPreviewState(
  state: Partial<CompanionSettingsPreviewState>,
): CompanionSettingsPreviewState {
  const normalized = normalizeCompanionSettingsPreviewState(state)

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // Ignore persistence failures and keep broadcast sync available.
  }

  notifyCompanionSettingsPreview(normalized)
  return normalized
}

export function publishCompanionSettingsPreviewState(
  state: Omit<CompanionSettingsPreviewState, 'updatedAt' | 'exitReason'>,
): CompanionSettingsPreviewState {
  return writeCompanionSettingsPreviewState({
    ...state,
    exitReason: null,
    updatedAt: Date.now(),
  })
}

export function clearCompanionSettingsPreviewState(
  reason: CompanionSettingsPreviewState['exitReason'] = 'dismissed',
): CompanionSettingsPreviewState {
  return writeCompanionSettingsPreviewState({
    ...DEFAULT_STATE,
    exitReason: reason,
    updatedAt: Date.now(),
  })
}

export function subscribeCompanionSettingsPreview(
  listener: (state: CompanionSettingsPreviewState) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const emitCurrent = () => listener(readCompanionSettingsPreviewState())
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      emitCurrent()
    }
  }
  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<CompanionSettingsPreviewState>).detail
    if (detail) {
      listener(normalizeCompanionSettingsPreviewState(detail))
      return
    }
    emitCurrent()
  }
  const onBroadcast = (event: MessageEvent<CompanionSettingsPreviewState>) => {
    listener(normalizeCompanionSettingsPreviewState(event.data))
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(EVENT_NAME, onInternal as EventListener)
  getBroadcastChannel()?.addEventListener('message', onBroadcast as EventListener)

  emitCurrent()

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EVENT_NAME, onInternal as EventListener)
    getBroadcastChannel()?.removeEventListener('message', onBroadcast as EventListener)
  }
}

function normalizeCompanionSettingsPreviewState(
  state: Partial<CompanionSettingsPreviewState>,
): CompanionSettingsPreviewState {
  const updatedAt = typeof state.updatedAt === 'number' && state.updatedAt > 0 ? state.updatedAt : null
  const isFresh = updatedAt !== null && Date.now() - updatedAt <= ACTIVE_TTL_MS
  const active = Boolean(state.active) && isFresh

  return {
    active,
    selectedPetId: active && typeof state.selectedPetId === 'string' && state.selectedPetId.trim()
      ? state.selectedPetId.trim()
      : null,
    lowDistractionMode: active && typeof state.lowDistractionMode === 'boolean' ? state.lowDistractionMode : null,
    chatEnabled: active && typeof state.chatEnabled === 'boolean' ? state.chatEnabled : null,
    chatConnected: active && typeof state.chatConnected === 'boolean' ? state.chatConnected : null,
    exitReason: active
      ? null
      : state.exitReason === 'applied' || state.exitReason === 'dismissed' || state.exitReason === 'idle' || state.exitReason === 'stale'
        ? state.exitReason
        : isFresh
          ? 'idle'
          : 'stale',
    updatedAt,
  }
}

function notifyCompanionSettingsPreview(state: CompanionSettingsPreviewState) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: state }))
  }
  getBroadcastChannel()?.postMessage(state)
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME)
    } catch {
      broadcastChannel = null
    }
  }
  return broadcastChannel
}
