import type { ChatMessageAction } from '../types/chat'

export interface CompanionActionPayload {
  id: string
  title: string
  message: string
  source: 'proactive' | 'work-mode'
  actions?: ChatMessageAction[]
}

const COMPANION_ACTION_EVENT = 'deep-pet:companion-action'
const COMPANION_ACTION_CHANNEL = 'deep-pet:companion-action'

let broadcastChannel: BroadcastChannel | null = null

export function emitCompanionAction(payload: CompanionActionPayload) {
  const normalized = normalizePayload(payload)
  if (!normalized) return

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COMPANION_ACTION_EVENT, { detail: normalized }))
  }

  getBroadcastChannel()?.postMessage(normalized)
}

export function subscribeCompanionAction(
  listener: (payload: CompanionActionPayload) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<CompanionActionPayload>).detail
    const normalized = normalizePayload(detail)
    if (normalized) {
      listener(normalized)
    }
  }

  window.addEventListener(COMPANION_ACTION_EVENT, onInternal as EventListener)

  const channel = getBroadcastChannel()
  const onMessage = (event: MessageEvent<CompanionActionPayload>) => {
    const normalized = normalizePayload(event.data)
    if (normalized) {
      listener(normalized)
    }
  }
  channel?.addEventListener('message', onMessage as EventListener)

  return () => {
    window.removeEventListener(COMPANION_ACTION_EVENT, onInternal as EventListener)
    channel?.removeEventListener('message', onMessage as EventListener)
  }
}

function normalizePayload(payload: CompanionActionPayload | null | undefined): CompanionActionPayload | null {
  if (
    !payload ||
    typeof payload.id !== 'string' ||
    typeof payload.title !== 'string' ||
    typeof payload.message !== 'string'
  ) {
    return null
  }

  const id = payload.id.trim()
  const title = payload.title.trim()
  const message = payload.message.trim()
  if (!id || !title || !message) {
    return null
  }

  return {
    id,
    title,
    message,
    source: payload.source,
    actions: Array.isArray(payload.actions)
      ? payload.actions
          .filter((action) => action && typeof action.id === 'string' && typeof action.label === 'string' && typeof action.prompt === 'string')
          .map((action) => ({
            id: action.id.trim(),
            label: action.label.trim(),
            prompt: action.prompt,
            fillOnly: action.fillOnly ?? false,
          }))
          .filter((action) => action.id && action.label && action.prompt.trim())
      : undefined,
  }
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(COMPANION_ACTION_CHANNEL)
    } catch {
      broadcastChannel = null
    }
  }
  return broadcastChannel
}
