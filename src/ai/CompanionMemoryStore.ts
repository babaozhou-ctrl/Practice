import type { CompanionMemorySnapshot } from '../types/chat'

export const COMPANION_MEMORY_STORAGE_KEY = 'deep-pet.companion-memory.v1'

const COMPANION_MEMORY_CHANNEL = 'deep-pet:companion-memory'
const COMPANION_MEMORY_EVENT = 'deep-pet:companion-memory-sync'

export const EMPTY_COMPANION_MEMORY: CompanionMemorySnapshot = {
  preferredName: null,
  preferences: [],
  avoidances: [],
  rituals: [],
  recentTopics: [],
  lastActivity: null,
  lastWindowTitle: null,
  updatedAt: null,
}

let broadcastChannel: BroadcastChannel | null = null

export function cloneCompanionMemory(memory: CompanionMemorySnapshot): CompanionMemorySnapshot {
  return {
    preferredName: memory.preferredName,
    preferences: [...memory.preferences],
    avoidances: [...memory.avoidances],
    rituals: [...memory.rituals],
    recentTopics: [...memory.recentTopics],
    lastActivity: memory.lastActivity,
    lastWindowTitle: memory.lastWindowTitle,
    updatedAt: memory.updatedAt,
  }
}

export function readCompanionMemory(): CompanionMemorySnapshot {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return cloneCompanionMemory(EMPTY_COMPANION_MEMORY)
    }

    const raw = window.localStorage.getItem(COMPANION_MEMORY_STORAGE_KEY)
    if (!raw) {
      return cloneCompanionMemory(EMPTY_COMPANION_MEMORY)
    }

    return normalizeCompanionMemory(JSON.parse(raw) as Partial<CompanionMemorySnapshot>)
  } catch {
    return cloneCompanionMemory(EMPTY_COMPANION_MEMORY)
  }
}

export function writeCompanionMemory(memory: CompanionMemorySnapshot): CompanionMemorySnapshot {
  const normalized = normalizeCompanionMemory(memory)

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(COMPANION_MEMORY_STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // ignore storage failures and still notify in-memory listeners
  }

  notifyCompanionMemory(normalized)
  return normalized
}

export function updateCompanionMemory(
  updater: (memory: CompanionMemorySnapshot) => CompanionMemorySnapshot,
): CompanionMemorySnapshot {
  return writeCompanionMemory(updater(readCompanionMemory()))
}

export function subscribeCompanionMemory(
  listener: (memory: CompanionMemorySnapshot) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const emitCurrent = () => listener(readCompanionMemory())
  const onStorage = (event: StorageEvent) => {
    if (event.key === COMPANION_MEMORY_STORAGE_KEY) {
      emitCurrent()
    }
  }
  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<CompanionMemorySnapshot>).detail
    if (detail) {
      listener(normalizeCompanionMemory(detail))
      return
    }
    emitCurrent()
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(COMPANION_MEMORY_EVENT, onInternal as EventListener)

  const channel = getBroadcastChannel()
  const onMessage = (event: MessageEvent<CompanionMemorySnapshot>) => {
    listener(normalizeCompanionMemory(event.data))
  }
  channel?.addEventListener('message', onMessage as EventListener)

  emitCurrent()

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(COMPANION_MEMORY_EVENT, onInternal as EventListener)
    channel?.removeEventListener('message', onMessage as EventListener)
  }
}

export function captureCompanionRuntimeContext(
  activity: string,
  windowTitle: string | null | undefined,
): CompanionMemorySnapshot {
  return updateCompanionMemory((memory) => {
    const next = cloneCompanionMemory(memory)
    next.lastActivity = activity || memory.lastActivity
    next.lastWindowTitle = sanitizeWindowTitle(windowTitle)

    const topic = buildRecentTopic(activity, windowTitle)
    if (topic) {
      pushUnique(next.recentTopics, topic, 6)
    }

    next.updatedAt = Date.now()
    return next
  })
}

function normalizeCompanionMemory(
  memory: Partial<CompanionMemorySnapshot> | CompanionMemorySnapshot,
): CompanionMemorySnapshot {
  return {
    preferredName: normalizeOptionalString(memory.preferredName, 24),
    preferences: normalizeStringList(memory.preferences, 6, 32),
    avoidances: normalizeStringList(memory.avoidances, 6, 32),
    rituals: normalizeStringList(memory.rituals, 6, 40),
    recentTopics: normalizeStringList(memory.recentTopics, 6, 48),
    lastActivity: normalizeOptionalString(memory.lastActivity, 24),
    lastWindowTitle: normalizeOptionalString(memory.lastWindowTitle, 80),
    updatedAt: typeof memory.updatedAt === 'number' ? memory.updatedAt : null,
  }
}

function normalizeStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []

  const items: string[] = []
  for (const item of value) {
    const normalized = normalizeOptionalString(item, maxLength)
    if (normalized && !items.includes(normalized)) {
      items.push(normalized)
    }
    if (items.length >= maxItems) {
      break
    }
  }
  return items
}

function normalizeOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function pushUnique(items: string[], value: string, max: number) {
  const normalized = value.trim()
  if (!normalized) return

  const index = items.findIndex((item) => item === normalized)
  if (index >= 0) {
    items.splice(index, 1)
  }
  items.unshift(normalized)

  if (items.length > max) {
    items.length = max
  }
}

function sanitizeWindowTitle(windowTitle: string | null | undefined): string | null {
  if (typeof windowTitle !== 'string') return null
  const trimmed = windowTitle.trim()
  if (!trimmed || trimmed === 'unknown') return null
  return trimmed.slice(0, 80)
}

function buildRecentTopic(activity: string, windowTitle: string | null | undefined): string | null {
  const activityLabels: Record<string, string> = {
    coding: '\u6700\u8fd1\u5728\u5199\u4ee3\u7801',
    gaming: '\u6700\u8fd1\u5728\u6253\u6e38\u620f',
    watching_video: '\u6700\u8fd1\u5728\u770b\u89c6\u9891',
    chatting: '\u6700\u8fd1\u5728\u804a\u5929',
    browsing: '\u6700\u8fd1\u5728\u6d4f\u89c8\u5185\u5bb9',
    reading: '\u6700\u8fd1\u5728\u9605\u8bfb',
    idle: '\u6700\u8fd1\u5728\u5b89\u9759\u5f85\u7740',
  }

  const base = activityLabels[activity]
  if (!base) return null

  const title = sanitizeWindowTitle(windowTitle)
  if (title) {
    return `${base}\uff1a${title.slice(0, 28)}`
  }

  return base
}

function notifyCompanionMemory(memory: CompanionMemorySnapshot) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COMPANION_MEMORY_EVENT, { detail: memory }))
  }
  getBroadcastChannel()?.postMessage(memory)
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(COMPANION_MEMORY_CHANNEL)
    } catch {
      broadcastChannel = null
    }
  }
  return broadcastChannel
}
