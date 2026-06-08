import { create } from 'zustand'
import { normalizeProviderId } from './PluginCapabilityRegistry'
import type { PluginCapabilityProvider } from './types'

export interface SelectedProviderState {
  aiChatProviderId: string
  fileAnalysisProviderId: string
  screenPerceptionProviderId: string
}

const STORAGE_KEY = 'deep-pet.plugin-providers.v1'
const CHANNEL_NAME = 'deep-pet:plugin-providers'
const EVENT_NAME = 'deep-pet:plugin-providers-sync'

let broadcastChannel: BroadcastChannel | null = null

function getDefaultProviderState(): SelectedProviderState {
  return {
    aiChatProviderId: 'builtin.ai-chat.deepseek',
    fileAnalysisProviderId: 'builtin.file-analysis.default',
    screenPerceptionProviderId: 'builtin.screen-perception.placeholder',
  }
}

function readProviderState(): SelectedProviderState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return getDefaultProviderState()
    }

    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return getDefaultProviderState()
    }

    const parsed = JSON.parse(raw) as Partial<SelectedProviderState>
    return normalizeSelectedProviderState({
      aiChatProviderId:
        typeof parsed.aiChatProviderId === 'string'
          ? parsed.aiChatProviderId
          : 'builtin.ai-chat.deepseek',
      fileAnalysisProviderId:
        typeof parsed.fileAnalysisProviderId === 'string'
          ? parsed.fileAnalysisProviderId
          : 'builtin.file-analysis.default',
      screenPerceptionProviderId:
        typeof parsed.screenPerceptionProviderId === 'string'
          ? parsed.screenPerceptionProviderId
          : 'builtin.screen-perception.placeholder',
    })
  } catch {
    return getDefaultProviderState()
  }
}

function writeProviderState(state: SelectedProviderState) {
  const normalized = normalizeSelectedProviderState(state)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // ignore persistence failures
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: normalized }))
  }
  getBroadcastChannel()?.postMessage(normalized)
}

function subscribeProviderState(listener: (state: SelectedProviderState) => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener(readProviderState())
    }
  }
  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<SelectedProviderState>).detail
    if (detail) {
      listener(detail)
      return
    }
    listener(readProviderState())
  }
  const onBroadcast = (event: MessageEvent<SelectedProviderState>) => {
    listener(event.data ?? readProviderState())
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(EVENT_NAME, onInternal as EventListener)
  getBroadcastChannel()?.addEventListener('message', onBroadcast as EventListener)

  listener(readProviderState())

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EVENT_NAME, onInternal as EventListener)
    getBroadcastChannel()?.removeEventListener('message', onBroadcast as EventListener)
  }
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

interface PluginProviderStore extends SelectedProviderState {
  hydrate: () => void
  setProvider: (capability: PluginCapabilityProvider, providerId: string) => void
  rehydrateAfterPluginDiscovery: () => void
}

const initial = readProviderState()

export const usePluginProviderStore = create<PluginProviderStore>((set, get) => ({
  ...initial,
  hydrate: () => {
    set(readProviderState())
  },
  rehydrateAfterPluginDiscovery: () => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return
      }

      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        set(getDefaultProviderState())
        return
      }

      const parsed = JSON.parse(raw) as Partial<SelectedProviderState>
      set(normalizeSelectedProviderState({
        aiChatProviderId:
          typeof parsed.aiChatProviderId === 'string'
            ? parsed.aiChatProviderId
            : 'builtin.ai-chat.deepseek',
        fileAnalysisProviderId:
          typeof parsed.fileAnalysisProviderId === 'string'
            ? parsed.fileAnalysisProviderId
            : 'builtin.file-analysis.default',
        screenPerceptionProviderId:
          typeof parsed.screenPerceptionProviderId === 'string'
            ? parsed.screenPerceptionProviderId
            : 'builtin.screen-perception.placeholder',
      }))
    } catch {
      set(getDefaultProviderState())
    }
  },
  setProvider: (capability, providerId) => {
    const next = normalizeSelectedProviderState({
      ...get(),
      aiChatProviderId:
        capability === 'aiChat' ? providerId : get().aiChatProviderId,
      fileAnalysisProviderId:
        capability === 'fileAnalysis' ? providerId : get().fileAnalysisProviderId,
      screenPerceptionProviderId:
        capability === 'screenPerception' ? providerId : get().screenPerceptionProviderId,
    })
    writeProviderState(next)
    set(next)
  },
}))

let subscribed = false

export function ensurePluginProviderStoreSubscription() {
  if (subscribed) return
  subscribed = true

  subscribeProviderState((state) => {
    usePluginProviderStore.setState(normalizeSelectedProviderState(state))
  })
}

function normalizeSelectedProviderState(state: SelectedProviderState): SelectedProviderState {
  return {
    aiChatProviderId: normalizeProviderId('aiChat', state.aiChatProviderId),
    fileAnalysisProviderId: normalizeProviderId('fileAnalysis', state.fileAnalysisProviderId),
    screenPerceptionProviderId: normalizeProviderId('screenPerception', state.screenPerceptionProviderId),
  }
}
