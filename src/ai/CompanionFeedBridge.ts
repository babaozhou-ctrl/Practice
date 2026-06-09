import type { ChatMessageAction, CompanionChatContext } from '../types/chat'
import type { CompanionFeedAnalysisResult } from '../services/companionFeedAnalysis'

export interface CompanionFeedAnalysisPayload {
  id: string
  fileName: string
  briefSummary: string
  detailedAnalysis: string
  context: CompanionChatContext
  actions: ChatMessageAction[]
  desktopUtterance: string
  createdAt: number
}

export function emitCompanionFeedAnalysisResult(
  result: CompanionFeedAnalysisResult,
  options?: {
    idPrefix?: string
    createdAt?: number
  },
) {
  const createdAt = options?.createdAt ?? Date.now()
  const idPrefix = options?.idPrefix ?? 'feed'

  emitCompanionFeedAnalysis({
    id: `${idPrefix}-${createdAt}`,
    fileName: result.fileName,
    briefSummary: result.briefSummary,
    detailedAnalysis: result.detailedAnalysis,
    context: result.context,
    actions: result.actions,
    desktopUtterance: result.desktopUtterance,
    createdAt,
  })
}

const COMPANION_FEED_EVENT = 'deep-pet:companion-feed-analysis'
const COMPANION_FEED_CHANNEL = 'deep-pet:companion-feed-analysis'
const COMPANION_FEED_STORAGE_KEY = 'deep-pet:companion-feed-analysis-history'
const MAX_HISTORY = 12

let broadcastChannel: BroadcastChannel | null = null

export function emitCompanionFeedAnalysis(payload: CompanionFeedAnalysisPayload) {
  const normalized = normalizePayload(payload)
  if (!normalized) return

  persistPayload(normalized)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COMPANION_FEED_EVENT, { detail: normalized }))
    window.electronAPI?.emitCompanionFeedBridgePayload?.(normalized)
  }

  getBroadcastChannel()?.postMessage(normalized)
}

export function subscribeCompanionFeedAnalysis(
  listener: (payload: CompanionFeedAnalysisPayload) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<CompanionFeedAnalysisPayload>).detail
    const normalized = normalizePayload(detail)
    if (normalized) {
      listener(normalized)
    }
  }

  window.addEventListener(COMPANION_FEED_EVENT, onInternal as EventListener)

  const channel = getBroadcastChannel()
  const onMessage = (event: MessageEvent<CompanionFeedAnalysisPayload>) => {
    const normalized = normalizePayload(event.data)
    if (normalized) {
      listener(normalized)
    }
  }
  channel?.addEventListener('message', onMessage as EventListener)

  const onElectronBridge = (payload: CompanionFeedAnalysisPayload) => {
    const normalized = normalizePayload(payload)
    if (normalized) {
      persistPayload(normalized)
      listener(normalized)
    }
  }
  window.electronAPI?.onCompanionFeedBridgePayload?.(onElectronBridge)

  return () => {
    window.removeEventListener(COMPANION_FEED_EVENT, onInternal as EventListener)
    channel?.removeEventListener('message', onMessage as EventListener)
  }
}

export function readCompanionFeedAnalyses(): CompanionFeedAnalysisPayload[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return []
    }

    const raw = window.localStorage.getItem(COMPANION_FEED_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as CompanionFeedAnalysisPayload[]
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item) => normalizePayload(item))
      .filter((item): item is CompanionFeedAnalysisPayload => Boolean(item))
      .sort((left, right) => left.createdAt - right.createdAt)
  } catch {
    return []
  }
}

export async function readCompanionFeedAnalysesFromBridge(): Promise<CompanionFeedAnalysisPayload[]> {
  try {
    const payloads = await window.electronAPI?.readCompanionFeedBridgeHistory?.()
    if (!Array.isArray(payloads)) {
      return []
    }

    return payloads
      .map((item) => normalizePayload(item))
      .filter((item): item is CompanionFeedAnalysisPayload => Boolean(item))
      .sort((left, right) => left.createdAt - right.createdAt)
  } catch {
    return []
  }
}

function normalizePayload(
  payload: CompanionFeedAnalysisPayload | null | undefined,
): CompanionFeedAnalysisPayload | null {
  if (
    !payload ||
    typeof payload.fileName !== 'string' ||
    typeof payload.briefSummary !== 'string' ||
    typeof payload.detailedAnalysis !== 'string' ||
    !payload.context
  ) {
    return null
  }

  const fileName = payload.fileName.trim()
  const briefSummary = payload.briefSummary.trim()
  const detailedAnalysis = payload.detailedAnalysis.trim()
  if (!fileName || !briefSummary || !detailedAnalysis) {
    return null
  }

  return {
    id: typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : `feed-${Date.now()}`,
    fileName,
    briefSummary,
    detailedAnalysis,
    context: payload.context,
    actions: Array.isArray(payload.actions) ? payload.actions : [],
    desktopUtterance:
      typeof payload.desktopUtterance === 'string' && payload.desktopUtterance.trim()
        ? payload.desktopUtterance.trim()
        : briefSummary,
    createdAt:
      typeof payload.createdAt === 'number' && Number.isFinite(payload.createdAt)
        ? payload.createdAt
        : Date.now(),
  }
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(COMPANION_FEED_CHANNEL)
    } catch {
      broadcastChannel = null
    }
  }
  return broadcastChannel
}

function persistPayload(payload: CompanionFeedAnalysisPayload) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    const existing = readCompanionFeedAnalyses().filter((entry) => entry.id !== payload.id)
    existing.push(payload)
    const next = existing.slice(-MAX_HISTORY)
    window.localStorage.setItem(COMPANION_FEED_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage failures and still broadcast live events.
  }
}
