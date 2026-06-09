import { classifyActivity } from './ActivityClassifier'
import { resolveScreenPerceptionProvider } from '../plugins/PluginCapabilityRegistry'
import { usePluginProviderStore } from '../plugins/PluginProviderStore'
import { useContextStore } from '../store/contextStore'
import type { ScreenPerceptionSnapshot } from '../types/context'

const STORAGE_KEY = 'deep-pet.screen-perception.v1'
const CHANNEL_NAME = 'deep-pet:screen-perception'
const EVENT_NAME = 'deep-pet:screen-perception-sync'

let broadcastChannel: BroadcastChannel | null = null
let loopTimer: number | null = null
let loopRunning = false
let loopIteration = 0

function buildIdleSnapshot(): ScreenPerceptionSnapshot {
  const state = useContextStore.getState()
  return {
    summary: null,
    source: 'idle',
    providerId: usePluginProviderStore.getState().screenPerceptionProviderId,
    imageAvailable: false,
    updatedAt: Date.now(),
    windowTitle: state.activeWindow.title,
    windowProcess: state.activeWindow.process,
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

function normalizeSnapshot(value: Partial<ScreenPerceptionSnapshot> | null | undefined): ScreenPerceptionSnapshot {
  const idle = buildIdleSnapshot()
  if (!value) {
    return idle
  }

  return {
    summary: typeof value.summary === 'string' && value.summary.trim() ? value.summary.trim() : null,
    source: value.source ?? idle.source,
    providerId: typeof value.providerId === 'string' && value.providerId.trim() ? value.providerId : idle.providerId,
    imageAvailable: Boolean(value.imageAvailable),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
    windowTitle: typeof value.windowTitle === 'string' ? value.windowTitle : idle.windowTitle,
    windowProcess: typeof value.windowProcess === 'string' ? value.windowProcess : idle.windowProcess,
  }
}

export function readScreenPerceptionSnapshot(): ScreenPerceptionSnapshot | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null
    }

    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    return normalizeSnapshot(JSON.parse(raw) as Partial<ScreenPerceptionSnapshot>)
  } catch {
    return null
  }
}

export function writeScreenPerceptionSnapshot(snapshot: ScreenPerceptionSnapshot) {
  const normalized = normalizeSnapshot(snapshot)

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // Ignore persistence failures and keep in-memory flow alive.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: normalized }))
  }
  getBroadcastChannel()?.postMessage(normalized)
}

export function subscribeScreenPerception(
  listener: (snapshot: ScreenPerceptionSnapshot) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    const snapshot = readScreenPerceptionSnapshot()
    if (snapshot) {
      listener(snapshot)
    }
  }

  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<ScreenPerceptionSnapshot>).detail
    if (detail) {
      listener(normalizeSnapshot(detail))
      return
    }

    const snapshot = readScreenPerceptionSnapshot()
    if (snapshot) {
      listener(snapshot)
    }
  }

  const onBroadcast = (event: MessageEvent<ScreenPerceptionSnapshot>) => {
    if (event.data) {
      listener(normalizeSnapshot(event.data))
    }
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(EVENT_NAME, onInternal as EventListener)
  getBroadcastChannel()?.addEventListener('message', onBroadcast as EventListener)

  const initial = readScreenPerceptionSnapshot()
  if (initial) {
    listener(initial)
  }

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EVENT_NAME, onInternal as EventListener)
    getBroadcastChannel()?.removeEventListener('message', onBroadcast as EventListener)
  }
}

async function captureScreenPerception(): Promise<ScreenPerceptionSnapshot> {
  const contextState = useContextStore.getState()
  const providerId = usePluginProviderStore.getState().screenPerceptionProviderId
  const provider = resolveScreenPerceptionProvider(providerId)

  const imageData = await provider.captureScreenshot()
  const imageAvailable = Boolean(imageData)
  const { title, process, idleMs } = contextState.activeWindow
  const fallbackSummary = buildWindowContextSummary({
    title,
    process,
    idleMs,
  })

  if (!imageData) {
    return {
      summary: fallbackSummary,
      source: 'capture_only',
      providerId,
      imageAvailable: false,
      updatedAt: Date.now(),
      windowTitle: title,
      windowProcess: process,
    }
  }

  const { localVisionEnabled, cloudVisionEnabled, ocrEnabled } = contextState.captureConfig

  let summary = ''
  let source: ScreenPerceptionSnapshot['source'] = 'capture_only'

  if (localVisionEnabled) {
    summary = await provider.analyzeWithLocalVision(imageData)
    if (summary.trim()) {
      source = 'local_vision'
    }
  } else if (cloudVisionEnabled) {
    summary = await provider.analyzeWithCloudVision(imageData)
    if (summary.trim()) {
      source = 'cloud_vision'
    }
  } else if (ocrEnabled) {
    summary = await provider.analyzeWithOCR(imageData)
    if (summary.trim()) {
      source = 'ocr'
    }
  }

  return {
    summary: summary.trim() || fallbackSummary,
    source,
    providerId,
    imageAvailable,
    updatedAt: Date.now(),
    windowTitle: title,
    windowProcess: process,
  }
}

async function runSingleLoop(iteration: number) {
  const state = useContextStore.getState()
  const shouldRun = state.isScreenMonitoring && state.captureConfig.enabled

  if (!shouldRun) {
    state.setAnalyzing(false)
    writeScreenPerceptionSnapshot(buildIdleSnapshot())
    return
  }

  state.setAnalyzing(true)

  try {
    const snapshot = await captureScreenPerception()
    if (loopRunning && iteration === loopIteration) {
      writeScreenPerceptionSnapshot(snapshot)
    }
  } catch {
    if (loopRunning && iteration === loopIteration) {
      writeScreenPerceptionSnapshot(buildIdleSnapshot())
    }
  } finally {
    state.setAnalyzing(false)
  }
}

function scheduleNextLoop() {
  if (!loopRunning) {
    return
  }

  const interval = Math.max(3000, useContextStore.getState().captureConfig.interval)
  loopTimer = window.setTimeout(async () => {
    const iteration = ++loopIteration
    await runSingleLoop(iteration)
    scheduleNextLoop()
  }, interval)
}

export function startScreenPerceptionLoop() {
  if (typeof window === 'undefined' || loopRunning) {
    return
  }

  loopRunning = true
  const iteration = ++loopIteration
  void runSingleLoop(iteration)
  scheduleNextLoop()
}

export function stopScreenPerceptionLoop() {
  loopRunning = false
  if (loopTimer) {
    window.clearTimeout(loopTimer)
    loopTimer = null
  }
}

function buildWindowContextSummary(info: {
  title: string
  process: string
  idleMs?: number
  mediaPlaying?: boolean
  mediaTitle?: string
  mediaArtist?: string
  mediaSource?: string
}): string | null {
  const title = normalizeTitle(info.title)
  const process = (info.process || '').trim()
  const activity = classifyActivity({
    title,
    process,
    idleMs: info.idleMs,
    mediaPlaying: info.mediaPlaying,
    mediaTitle: info.mediaTitle,
    mediaArtist: info.mediaArtist,
    mediaSource: info.mediaSource,
  })

  const mediaTitle = normalizeTitle(info.mediaTitle ?? '')
  const mediaArtist = normalizeTitle(info.mediaArtist ?? '')
  const mediaSource = normalizeTitle(info.mediaSource ?? '')
  const mediaDescription = mediaTitle
    ? mediaArtist
      ? `${mediaTitle} by ${mediaArtist}`
      : mediaTitle
    : mediaSource

  if (!title && !process) {
    return null
  }

  switch (activity) {
    case 'CODING':
      if (info.mediaPlaying && mediaDescription) {
        return title
          ? `coding in ${title} while listening to ${mediaDescription}`
          : `coding while listening to ${mediaDescription}`
      }
      return title
        ? `code editor focused on ${title}`
        : `code editor in ${process || 'development workspace'}`
    case 'WATCHING':
      if (info.mediaPlaying && mediaDescription) {
        return `music playback active around ${mediaDescription}`
      }
      return title
        ? `video content playing around ${title}`
        : `video player active in ${process || 'media app'}`
    case 'CHATTING':
      return title
        ? `chat conversation open around ${title}`
        : `chat window active in ${process || 'messaging app'}`
    case 'READING':
      return title
        ? `reading document or article: ${title}`
        : `reading document inside ${process || 'reader app'}`
    case 'GAMING':
      return title
        ? `game session active around ${title}`
        : `game session open in ${process || 'game launcher'}`
    case 'BROWSING':
      if (info.mediaPlaying && mediaDescription) {
        return title
          ? `browsing ${title} while listening to ${mediaDescription}`
          : `browsing while listening to ${mediaDescription}`
      }
      return title
        ? `browsing page about ${title}`
        : `browser tab active in ${process || 'browser'}`
    case 'IDLE':
      return title
        ? `desktop is quiet, last window was ${title}`
        : 'desktop is quiet right now'
    default:
      return title
        ? `desktop window focused on ${title}`
        : `desktop app active in ${process}`
  }
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
