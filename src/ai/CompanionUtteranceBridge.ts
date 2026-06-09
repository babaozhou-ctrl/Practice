export interface CompanionUtterancePayload {
  message: string
  duration?: number
  source?: 'chat' | 'file-analysis' | 'ai-summary'
}

const COMPANION_UTTERANCE_EVENT = 'deep-pet:companion-utterance'
const COMPANION_UTTERANCE_CHANNEL = 'deep-pet:companion-utterance'

let broadcastChannel: BroadcastChannel | null = null

export function emitCompanionUtterance(payload: CompanionUtterancePayload) {
  const normalized = normalizePayload(payload)
  if (!normalized) return

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COMPANION_UTTERANCE_EVENT, { detail: normalized }))
    window.electronAPI?.emitCompanionUtteranceBridgePayload?.(normalized)
  }

  getBroadcastChannel()?.postMessage(normalized)
}

export function subscribeCompanionUtterance(
  listener: (payload: CompanionUtterancePayload) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<CompanionUtterancePayload>).detail
    const normalized = normalizePayload(detail)
    if (normalized) {
      listener(normalized)
    }
  }

  window.addEventListener(COMPANION_UTTERANCE_EVENT, onInternal as EventListener)

  const channel = getBroadcastChannel()
  const onMessage = (event: MessageEvent<CompanionUtterancePayload>) => {
    const normalized = normalizePayload(event.data)
    if (normalized) {
      listener(normalized)
    }
  }
  channel?.addEventListener('message', onMessage as EventListener)

  const onElectronBridge = (payload: CompanionUtterancePayload) => {
    const normalized = normalizePayload(payload)
    if (normalized) {
      listener(normalized)
    }
  }
  window.electronAPI?.onCompanionUtteranceBridgePayload?.(onElectronBridge)

  return () => {
    window.removeEventListener(COMPANION_UTTERANCE_EVENT, onInternal as EventListener)
    channel?.removeEventListener('message', onMessage as EventListener)
  }
}

function normalizePayload(payload: CompanionUtterancePayload | null | undefined): CompanionUtterancePayload | null {
  if (!payload || typeof payload.message !== 'string') {
    return null
  }

  const message = payload.message.replace(/\s+/g, ' ').trim()
  if (!message) {
    return null
  }

  return {
    message,
    duration:
      typeof payload.duration === 'number' && Number.isFinite(payload.duration)
        ? Math.max(1_600, Math.round(payload.duration))
        : undefined,
    source: payload.source ?? 'chat',
  }
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(COMPANION_UTTERANCE_CHANNEL)
    } catch {
      broadcastChannel = null
    }
  }
  return broadcastChannel
}
