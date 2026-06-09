import { app, BrowserWindow, desktopCapturer, ipcMain, Menu, Tray, nativeImage, protocol, screen } from 'electron'
import { mkdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { CompanionActionPayload } from '../src/ai/CompanionActionBridge'
import type { CompanionFeedAnalysisPayload } from '../src/ai/CompanionFeedBridge'
import type { CompanionUtterancePayload } from '../src/ai/CompanionUtteranceBridge'
import {
  listImportedPetPackages,
  resolveImportedPetAssetPath,
  saveImportedPetPackage,
} from './imported-pet-storage'
import { extractDocumentText } from './services/document-reader'
import {
  cancelPluginAIChat,
  listLocalPluginManifests,
  runPluginAIChat,
  runPluginAIHealthCheck,
  runPluginAISummary,
  runPluginFileAnalysis,
  runPluginScreenCapture,
  runPluginScreenCloudVision,
  runPluginScreenLocalVision,
  runPluginScreenOCR,
} from './services/plugin-host-service'
import { detectActiveWindow } from './window-detector'

let petWindow: BrowserWindow | null = null
let uiWindow: BrowserWindow | null = null
let tray: Tray | null = null
let contextPollInterval: ReturnType<typeof setInterval> | null = null
let automationMetricsInterval: ReturnType<typeof setInterval> | null = null
let lastWindowInfo = ''
let lastAwayBucket = ''
let lastMediaPlaybackSignature = ''
let isClickThrough = false

const AWAY_BUCKET_IDLE_MS = 90_000
const APP_ID = 'com.deep.pet'
const APP_ICON_PATH = join(__dirname, '../build/icon.png')
const PET_WINDOW_WIDTH = 300
const PET_WINDOW_HEIGHT = 420
const PET_MENU_MIN_EXPANDED_WIDTH = 360
const PET_MENU_MIN_EXPANDED_HEIGHT = 560
const IMPORTED_PET_PROTOCOL = 'deep-pet'
const IS_DEV_RUNTIME = process.argv.includes('--dev') || Boolean(process.env.VITE_DEV_SERVER_URL)
const SMOKE_TARGET = process.env.DEEP_PET_SMOKE ?? ''
const RUNTIME_SCENARIO = process.env.DEEP_PET_SCENARIO ?? ''
const AUTO_EXIT_MS = parsePositiveInteger(process.env.DEEP_PET_AUTO_EXIT_MS)
const IS_SMOKE_RUNTIME = SMOKE_TARGET.length > 0
const IS_AUTOMATED_RUNTIME = IS_SMOKE_RUNTIME || RUNTIME_SCENARIO.length > 0 || AUTO_EXIT_MS !== null
const REQUIRES_SMOKE_UI =
  SMOKE_TARGET === 'chat' ||
  SMOKE_TARGET === 'feed' ||
  SMOKE_TARGET === 'settings' ||
  SMOKE_TARGET === 'workmode' ||
  SMOKE_TARGET === 'import'
const SMOKE_RUN_ID = IS_SMOKE_RUNTIME ? `smoke-${Date.now()}` : null
const AUTOMATION_RUN_ID = IS_AUTOMATED_RUNTIME ? `auto-${Date.now()}` : null
const COMPANION_FEED_RELAY_CHANNEL = 'bridge:companion-feed-analysis'
const COMPANION_ACTION_RELAY_CHANNEL = 'bridge:companion-action'
const COMPANION_UTTERANCE_RELAY_CHANNEL = 'bridge:companion-utterance'
const MAX_COMPANION_FEED_HISTORY = 24
const AUTOMATION_METRICS_EVENT_CHANNEL = 'metrics:event'

let smokePetReady = false
let smokeUiReady = false
let smokeFeedResultReady = false
let smokeFeedChatReceived = false
let smokeSettingsPanelReady = false
let smokeWorkModeReady = false
let smokeImportReady = false
let companionFeedHistory: CompanionFeedAnalysisPayload[] = []
let smokeFinishing = false
let petWindowMenuExpanded = false

prepareRuntimePaths()
configureAutomatedGpuRuntime()

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message)
  if (IS_SMOKE_RUNTIME) {
    finishSmoke(1)
  }
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
  if (IS_SMOKE_RUNTIME) {
    finishSmoke(1)
  }
})

function finishSmoke(code = 0) {
  if (!IS_SMOKE_RUNTIME || smokeFinishing) {
    return
  }

  smokeFinishing = true

  setTimeout(() => {
    app.exit(code)
  }, 2_000)

  if (uiWindow && !uiWindow.isDestroyed()) {
    uiWindow.close()
  }

  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.close()
  }

  setTimeout(() => {
    app.quit()
  }, 100)
}

function markSmokeReady(kind: 'pet' | 'ui') {
  if (!IS_SMOKE_RUNTIME) {
    return
  }

  if (kind === 'pet') {
    smokePetReady = true
  } else {
    smokeUiReady = true
  }

  if (!REQUIRES_SMOKE_UI && smokePetReady) {
    console.log('[deep-pet] smoke-ready')
    finishSmoke()
    return
  }

  if (REQUIRES_SMOKE_UI && smokePetReady && smokeUiReady) {
    if (SMOKE_TARGET === 'feed') {
      return
    }
    if (SMOKE_TARGET === 'settings') {
      return
    }
    if (SMOKE_TARGET === 'workmode') {
      return
    }
    if (SMOKE_TARGET === 'import') {
      return
    }
    console.log('[deep-pet] smoke-ui-ready')
    finishSmoke()
  }
}

function markSmokeCheckpoint(label: string) {
  if (!IS_SMOKE_RUNTIME) {
    return
  }

  console.log(`[deep-pet] smoke:${label}`)

  if (label === 'feed-result-ready') {
    smokeFeedResultReady = true
  }

  if (label === 'feed-chat-received') {
    smokeFeedChatReceived = true
  }

  if (label === 'settings-panel-ready') {
    smokeSettingsPanelReady = true
  }

  if (label === 'workmode-ready') {
    smokeWorkModeReady = true
  }

  if (label === 'import-ready') {
    smokeImportReady = true
  }

  if (SMOKE_TARGET === 'settings' && smokePetReady && smokeUiReady && smokeSettingsPanelReady) {
    console.log('[deep-pet] smoke-settings-ready')
    finishSmoke()
    return
  }

  if (SMOKE_TARGET === 'workmode' && smokePetReady && smokeUiReady && smokeWorkModeReady) {
    console.log('[deep-pet] smoke-workmode-ready')
    finishSmoke()
    return
  }

  if (SMOKE_TARGET === 'import' && smokePetReady && smokeUiReady && smokeImportReady) {
    console.log('[deep-pet] smoke-import-ready')
    finishSmoke()
    return
  }

  if (SMOKE_TARGET !== 'feed') {
    return
  }

  if (smokePetReady && smokeUiReady && smokeFeedResultReady && smokeFeedChatReceived) {
    console.log('[deep-pet] smoke-feed-ready')
    finishSmoke()
  }
}

function prepareRuntimePaths() {
  try {
    if (IS_SMOKE_RUNTIME) {
      const smokeUserDataPath = join(
        app.getPath('temp'),
        'deep-pet-smoke',
        SMOKE_TARGET || 'default',
        SMOKE_RUN_ID ?? 'run',
      )
      mkdirSync(smokeUserDataPath, { recursive: true })
      app.setPath('userData', smokeUserDataPath)
    }

    const userDataPath = app.getPath('userData')
    const sessionDataPath = join(userDataPath, 'session-data')

    mkdirSync(sessionDataPath, { recursive: true })

    app.setPath('sessionData', sessionDataPath)
  } catch (error) {
    console.warn('Failed to prepare runtime paths:', error)
  }
}

function configureAutomatedGpuRuntime() {
  if (!IS_AUTOMATED_RUNTIME) {
    return
  }

  // Automated runs are short-lived and don't benefit from Chromium's GPU
  // shader/program cache, but cache flushes can add noisy warnings on exit.
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
  app.commandLine.appendSwitch('disable-gpu-program-cache')
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function normalizeCompanionFeedPayload(
  payload: CompanionFeedAnalysisPayload | null | undefined,
): CompanionFeedAnalysisPayload | null {
  if (
    !payload ||
    typeof payload.id !== 'string' ||
    typeof payload.fileName !== 'string' ||
    typeof payload.briefSummary !== 'string' ||
    typeof payload.detailedAnalysis !== 'string' ||
    typeof payload.desktopUtterance !== 'string' ||
    typeof payload.createdAt !== 'number' ||
    !payload.context
  ) {
    return null
  }

  const id = payload.id.trim()
  const fileName = payload.fileName.trim()
  const briefSummary = payload.briefSummary.trim()
  const detailedAnalysis = payload.detailedAnalysis.trim()
  const desktopUtterance = payload.desktopUtterance.trim()

  if (!id || !fileName || !briefSummary || !detailedAnalysis || !desktopUtterance || !Number.isFinite(payload.createdAt)) {
    return null
  }

  return {
    ...payload,
    id,
    fileName,
    briefSummary,
    detailedAnalysis,
    desktopUtterance,
    actions: Array.isArray(payload.actions) ? payload.actions : [],
  }
}

function normalizeCompanionActionPayload(
  payload: CompanionActionPayload | null | undefined,
): CompanionActionPayload | null {
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
    ...payload,
    id,
    title,
    message,
    actions: Array.isArray(payload.actions) ? payload.actions : [],
  }
}

function normalizeCompanionUtterancePayload(
  payload: CompanionUtterancePayload | null | undefined,
): CompanionUtterancePayload | null {
  if (!payload || typeof payload.message !== 'string') {
    return null
  }

  const message = payload.message.replace(/\s+/g, ' ').trim()
  if (!message) {
    return null
  }

  return {
    ...payload,
    message,
    duration:
      typeof payload.duration === 'number' && Number.isFinite(payload.duration)
        ? Math.max(1_600, Math.round(payload.duration))
        : undefined,
  }
}

function normalizeAutomationMetricsEvent(
  payload: unknown,
): { name: string; value?: number | null; tags?: Record<string, string | number | boolean | null> } | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as {
    name?: unknown
    value?: unknown
    tags?: unknown
  }

  if (typeof candidate.name !== 'string' || !candidate.name.trim()) {
    return null
  }

  const normalizedValue =
    typeof candidate.value === 'number' && Number.isFinite(candidate.value) ? candidate.value : null
  const normalizedTags: Record<string, string | number | boolean | null> = {}

  if (candidate.tags && typeof candidate.tags === 'object') {
    for (const [key, rawValue] of Object.entries(candidate.tags as Record<string, unknown>)) {
      if (!key.trim()) {
        continue
      }

      if (
        typeof rawValue === 'string' ||
        typeof rawValue === 'number' ||
        typeof rawValue === 'boolean' ||
        rawValue === null
      ) {
        normalizedTags[key] = rawValue
      }
    }
  }

  return {
    name: candidate.name.trim(),
    value: normalizedValue,
    tags: Object.keys(normalizedTags).length > 0 ? normalizedTags : undefined,
  }
}

function upsertCompanionFeedHistory(payload: CompanionFeedAnalysisPayload) {
  companionFeedHistory = [...companionFeedHistory.filter((entry) => entry.id !== payload.id), payload]
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(-MAX_COMPANION_FEED_HISTORY)
}

function getOpenRendererWindows(): BrowserWindow[] {
  return [petWindow, uiWindow].filter((windowRef): windowRef is BrowserWindow => Boolean(windowRef && !windowRef.isDestroyed()))
}

function relayToOtherWindows(
  channel: string,
  payload: unknown,
  senderId?: number,
) {
  for (const windowRef of getOpenRendererWindows()) {
    if (typeof senderId === 'number' && windowRef.webContents.id === senderId) {
      continue
    }
    windowRef.webContents.send(channel, payload)
  }
}

function registerImportedPetProtocol() {
  protocol.handle(IMPORTED_PET_PROTOCOL, async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'imported') {
        return new Response('Not found', { status: 404 })
      }

      const segments = url.pathname
        .split('/')
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment))

      const petId = segments.shift()
      const relativePath = segments.join('/')

      if (!petId || !relativePath) {
        return new Response('Bad request', { status: 400 })
      }

      const filePath = resolveImportedPetAssetPath(petId, relativePath)
      const bytes = await readFile(filePath)
      const contentType = getMimeType(relativePath)

      return new Response(bytes, {
        headers: {
          'content-type': contentType,
          'cache-control': 'no-cache',
        },
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

function attachWindowDiagnostics(windowRef: BrowserWindow, label: 'pet' | 'ui') {
  if (!IS_AUTOMATED_RUNTIME && !IS_DEV_RUNTIME) {
    return
  }

  windowRef.webContents.on('console-message', (_event, level, message) => {
    const prefix = `[deep-pet] ${label} console:${level}`
    if (level >= 2) {
      console.error(prefix, message)
      return
    }
    console.log(prefix, message)
  })

  windowRef.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[deep-pet] ${label} render gone:`, details.reason)
  })

  windowRef.webContents.on('unresponsive', () => {
    console.error(`[deep-pet] ${label} became unresponsive`)
  })
}

function createPetWindow() {
  const { x, y } = getDefaultPosition()
  lastWindowInfo = ''
  lastAwayBucket = ''
  lastMediaPlaybackSignature = ''
  petWindow = new BrowserWindow({
    width: PET_WINDOW_WIDTH,
    height: PET_WINDOW_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    icon: APP_ICON_PATH,
    backgroundThrottling: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  petWindowMenuExpanded = false

  petWindow.setIgnoreMouseEvents(false)
  attachWindowDiagnostics(petWindow, 'pet')

  if (process.env.VITE_DEV_SERVER_URL) {
    petWindow.loadURL(process.env.VITE_DEV_SERVER_URL + 'pet.html')
  } else {
    petWindow.loadFile(join(__dirname, '../dist/pet.html'))
  }

  petWindow.webContents.on('did-finish-load', () => {
    if (IS_DEV_RUNTIME) {
      console.log('[deep-pet] pet window loaded')
    }
    markSmokeReady('pet')
  })

  petWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('[deep-pet] pet window failed to load:', code, description)
    if (IS_SMOKE_RUNTIME) {
      app.exit(1)
    }
  })

  petWindow.on('closed', () => {
    petWindow = null
    app.quit()
  })

  if (IS_DEV_RUNTIME) {
    petWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

function createUIWindow() {
  uiWindow = new BrowserWindow({
    width: 340,
    height: 460,
    frame: true,
    transparent: false,
    show: false,
    resizable: false,
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  attachWindowDiagnostics(uiWindow, 'ui')

  if (process.env.VITE_DEV_SERVER_URL) {
    uiWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    uiWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  uiWindow.webContents.on('did-finish-load', () => {
    if (IS_DEV_RUNTIME) {
      console.log('[deep-pet] ui window loaded')
    }
    const info = detectActiveWindow()
    broadcastContextUpdate(info)
    markSmokeReady('ui')
  })

  uiWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('[deep-pet] ui window failed to load:', code, description)
    if (IS_SMOKE_RUNTIME) {
      app.exit(1)
    }
  })

  uiWindow.on('closed', () => {
    uiWindow = null
  })
}

function showUIWindowAndNotify(channel?: 'ui:show-settings' | 'ui:show-chat') {
  const notify = () => {
    if (!uiWindow || uiWindow.isDestroyed()) {
      return
    }

    uiWindow.show()
    uiWindow.focus()

    if (channel) {
      uiWindow.webContents.send(channel)
    }
  }

  if (uiWindow && !uiWindow.isDestroyed()) {
    if (uiWindow.webContents.isLoadingMainFrame()) {
      uiWindow.webContents.once('did-finish-load', notify)
      return
    }

    notify()
    return
  }

  createUIWindow()

  if (!uiWindow || uiWindow.isDestroyed()) {
    return
  }

  uiWindow.webContents.once('did-finish-load', notify)
}

function startRuntimeScenario() {
  if (IS_SMOKE_RUNTIME) {
    return
  }

  switch (RUNTIME_SCENARIO) {
    case 'stability-chat':
      setTimeout(() => {
        showUIWindowAndNotify('ui:show-chat')
      }, 250)
      break
    case 'stability-feed':
      setTimeout(() => {
        showUIWindowAndNotify('ui:show-chat')
      }, 250)
      break
    case 'stability-settings':
      setTimeout(() => {
        showUIWindowAndNotify('ui:show-settings')
      }, 250)
      break
    case 'stability-import':
      setTimeout(() => {
        showUIWindowAndNotify('ui:show-settings')
      }, 250)
      break
    default:
      break
  }
}

function scheduleAutomatedRuntimeExit() {
  if (AUTO_EXIT_MS === null || IS_SMOKE_RUNTIME) {
    return
  }

  setTimeout(() => {
    if (uiWindow && !uiWindow.isDestroyed()) {
      uiWindow.close()
    }

    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.close()
    }

    setTimeout(() => {
      app.quit()
    }, 100)
  }, AUTO_EXIT_MS)
}

function getDefaultPosition() {
  const primary = screen.getPrimaryDisplay()
  const { width, height } = primary.workAreaSize
  return {
    x: Math.floor(width / 2 - PET_WINDOW_WIDTH / 2),
    y: Math.floor(height / 2 - PET_WINDOW_HEIGHT / 2),
  }
}

function constrainPetWindowBounds(bounds: Electron.Rectangle): Electron.Rectangle {
  const display = screen.getDisplayMatching(bounds)
  const workArea = display.workArea

  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, workArea.height)
  const maxX = workArea.x + workArea.width - width
  const maxY = workArea.y + workArea.height - height

  return {
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY),
    width,
    height,
  }
}

function setPetWindowMenuExpanded(
  expandedOrOptions:
    | boolean
    | {
        expanded: boolean
        width?: number
        height?: number
      },
) {
  const options =
    typeof expandedOrOptions === 'boolean'
      ? { expanded: expandedOrOptions }
      : expandedOrOptions
  const expanded = Boolean(options.expanded)

  if (!petWindow || petWindow.isDestroyed() || petWindowMenuExpanded === expanded) {
    return
  }
  const currentBounds = petWindow.getBounds()
  const nextWidth = expanded
    ? Math.max(PET_MENU_MIN_EXPANDED_WIDTH, Math.round(options.width ?? PET_MENU_MIN_EXPANDED_WIDTH))
    : PET_WINDOW_WIDTH
  const nextHeight = expanded
    ? Math.max(PET_MENU_MIN_EXPANDED_HEIGHT, Math.round(options.height ?? PET_MENU_MIN_EXPANDED_HEIGHT))
    : PET_WINDOW_HEIGHT
  const anchorX = currentBounds.x + Math.round((currentBounds.width - PET_WINDOW_WIDTH) / 2)
  const anchorY = currentBounds.y + Math.max(0, currentBounds.height - PET_WINDOW_HEIGHT)
  const nextBounds = constrainPetWindowBounds({
    x: anchorX - Math.round((nextWidth - PET_WINDOW_WIDTH) / 2),
    y: anchorY - Math.max(0, nextHeight - PET_WINDOW_HEIGHT),
    width: nextWidth,
    height: nextHeight,
  })

  petWindow.setBounds(nextBounds, false)
  petWindowMenuExpanded = expanded
}

function setupIPC() {
  let lastMoveTime = 0

  ipcMain.on('pet:moved', (_event, x: number, y: number) => {
    const now = Date.now()
    if (now - lastMoveTime < 16) return
    lastMoveTime = now
    if (petWindow) {
      petWindow.setPosition(Math.round(x), Math.round(y))
    }
  })

  ipcMain.handle('pet:get-position', () => {
    if (!petWindow) return { x: 0, y: 0 }
    const [x, y] = petWindow.getPosition()
    return { x, y }
  })

  ipcMain.handle(
    'pet:set-menu-expanded',
    (
      _event,
      expandedOrOptions:
        | boolean
        | {
            expanded: boolean
            width?: number
            height?: number
          },
    ) => {
      setPetWindowMenuExpanded(expandedOrOptions)
    return petWindowMenuExpanded
    },
  )

  ipcMain.on('pet:toggle-clickthrough', () => {
    isClickThrough = !isClickThrough
    if (petWindow) {
      petWindow.setIgnoreMouseEvents(isClickThrough, { forward: true })
    }
    broadcastClickThroughChanged(isClickThrough)
  })

  ipcMain.on('pet:open-settings', () => {
    showUIWindowAndNotify('ui:show-settings')
  })

  ipcMain.on('pet:open-chat', () => {
    showUIWindowAndNotify('ui:show-chat')
  })

  ipcMain.on('app:hide-ui', () => {
    if (uiWindow && !uiWindow.isDestroyed()) {
      uiWindow.hide()
    }
  })

  ipcMain.handle('context:get-active-window', async () => detectActiveWindow())
  ipcMain.handle('screen:capture-primary', async () => capturePrimaryDisplay())
  ipcMain.handle('documents:extract-text', async (_event, payload) => extractDocumentText(payload))
  ipcMain.handle('pets:list-imported', async () => listImportedPetPackages())
  ipcMain.handle('pets:save-imported', async (_event, record) => saveImportedPetPackage(record))
  ipcMain.handle('plugins:list-local', async () => listLocalPluginManifests())
  ipcMain.handle('plugins:run-file-analysis', async (_event, payload) => runPluginFileAnalysis(payload))
  ipcMain.handle('plugins:run-ai-summary', async (_event, payload) => runPluginAISummary(payload))
  ipcMain.handle('plugins:run-screen-capture', async (_event, payload) => runPluginScreenCapture(payload))
  ipcMain.handle('plugins:run-screen-ocr', async (_event, payload) => runPluginScreenOCR(payload))
  ipcMain.handle('plugins:run-screen-local-vision', async (_event, payload) => runPluginScreenLocalVision(payload))
  ipcMain.handle('plugins:run-screen-cloud-vision', async (_event, payload) => runPluginScreenCloudVision(payload))
  ipcMain.handle('plugins:run-ai-chat', async (event, payload) =>
    runPluginAIChat({
      ...payload,
      emitChunk: (chunk) => {
        event.sender.send(`plugins:ai-chat-chunk:${payload.requestId}`, chunk)
      },
    }),
  )
  ipcMain.handle('plugins:run-ai-health-check', async (_event, payload) => runPluginAIHealthCheck(payload))
  ipcMain.handle('plugins:cancel-ai-chat', async (_event, payload) => cancelPluginAIChat(payload.requestId))
  ipcMain.handle('app:get-runtime-flags', async () => ({
    smokeTarget: SMOKE_TARGET || null,
    scenario: RUNTIME_SCENARIO || null,
    isDev: IS_DEV_RUNTIME,
    smokeRunId: SMOKE_RUN_ID,
    automationRunId: AUTOMATION_RUN_ID,
    autoExitMs: AUTO_EXIT_MS,
  }))
  ipcMain.handle('bridge:feed:list', async () => companionFeedHistory)
  ipcMain.on(AUTOMATION_METRICS_EVENT_CHANNEL, (_event, payload) => {
    if (!IS_AUTOMATED_RUNTIME) {
      return
    }

    const normalized = normalizeAutomationMetricsEvent(payload)
    if (!normalized) {
      return
    }

    const valueSegment =
      typeof normalized.value === 'number' && Number.isFinite(normalized.value)
        ? ` value:${normalized.value}`
        : ''
    const tagSegment = normalized.tags
      ? ` tags:${JSON.stringify(normalized.tags)}`
      : ''

    console.log(`[deep-pet] event name:${normalized.name}${valueSegment}${tagSegment}`)
  })
  ipcMain.on('bridge:feed:emit', (event, payload: CompanionFeedAnalysisPayload) => {
    const normalized = normalizeCompanionFeedPayload(payload)
    if (!normalized) {
      return
    }
    upsertCompanionFeedHistory(normalized)
    relayToOtherWindows(COMPANION_FEED_RELAY_CHANNEL, normalized, event.sender.id)
  })
  ipcMain.on('bridge:action:emit', (event, payload: CompanionActionPayload) => {
    const normalized = normalizeCompanionActionPayload(payload)
    if (!normalized) {
      return
    }
    relayToOtherWindows(COMPANION_ACTION_RELAY_CHANNEL, normalized, event.sender.id)
  })
  ipcMain.on('bridge:utterance:emit', (event, payload: CompanionUtterancePayload) => {
    const normalized = normalizeCompanionUtterancePayload(payload)
    if (!normalized) {
      return
    }
    relayToOtherWindows(COMPANION_UTTERANCE_RELAY_CHANNEL, normalized, event.sender.id)
  })
  ipcMain.on('smoke:checkpoint', (_event, label: string) => {
    if (typeof label === 'string' && label.trim()) {
      markSmokeCheckpoint(label.trim())
    }
  })
  ipcMain.on('app:quit', () => app.quit())
}

function syncClickThroughState() {
  if (petWindow) {
    petWindow.setIgnoreMouseEvents(isClickThrough, { forward: true })
  }
  broadcastClickThroughChanged(isClickThrough)
}

function setupStableTray() {
  const trayIcon = nativeImage.createFromPath(APP_ICON_PATH)
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon)
  tray.setToolTip('Deep Pet | bb7')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '允许点击穿透',
        type: 'checkbox',
        checked: isClickThrough,
        click: () => {
          isClickThrough = !isClickThrough
          syncClickThroughState()
        },
      },
      { type: 'separator' },
      {
        label: '打开聊天',
        click: () => {
          showUIWindowAndNotify('ui:show-chat')
        },
      },
      {
        label: '打开设置',
        click: () => {
          showUIWindowAndNotify('ui:show-settings')
        },
      },
      { type: 'separator' },
      {
        label: '退出 Deep Pet',
        click: () => {
          app.quit()
        },
      },
    ]),
  )
}

function startContextPolling() {
  contextPollInterval = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return
    try {
      const info = detectActiveWindow()
      const key = info.title + '||' + info.process
      const awayBucket = (info.idleMs ?? 0) >= AWAY_BUCKET_IDLE_MS ? 'away' : 'present'
      const mediaSignature = [
        info.mediaPlaying ? 'playing' : 'silent',
        info.mediaSource ?? '',
        info.mediaTitle ?? '',
        info.mediaArtist ?? '',
      ].join('||')
      if (
        key !== lastWindowInfo ||
        awayBucket !== lastAwayBucket ||
        mediaSignature !== lastMediaPlaybackSignature
      ) {
        lastWindowInfo = key
        lastAwayBucket = awayBucket
        lastMediaPlaybackSignature = mediaSignature
        broadcastContextUpdate(info)
      }
    } catch {
      // Ignore transient context polling failures.
    }
  }, 5000)
}

function startAutomationMetricsLogging() {
  if (!IS_AUTOMATED_RUNTIME) {
    return
  }

  if (automationMetricsInterval) {
    clearInterval(automationMetricsInterval)
  }

  const logMetrics = async () => {
    try {
      const metrics = await app.getAppMetrics()
      const processMetrics = metrics.filter((entry) => entry.type === 'Browser' || entry.type === 'Tab')
      const workingSetKb = processMetrics.reduce(
        (sum, entry) => sum + (entry.memory?.workingSetSize ?? 0),
        0,
      )
      const workingSetMb = workingSetKb / 1024
      console.log(
        `[deep-pet] metrics process-count:${processMetrics.length} memory-mb:${workingSetMb.toFixed(2)}`,
      )
    } catch (error) {
      console.warn('[deep-pet] metrics collection failed:', error)
    }
  }

  void logMetrics()
  automationMetricsInterval = setInterval(() => {
    void logMetrics()
  }, 5000)
}

function broadcastContextUpdate(info: ReturnType<typeof detectActiveWindow>) {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('context:update', info)
    petWindow.webContents.send('context:window-update', info)
  }

  if (uiWindow && !uiWindow.isDestroyed()) {
    uiWindow.webContents.send('context:update', info)
    uiWindow.webContents.send('context:window-update', info)
  }
}

function broadcastClickThroughChanged(value: boolean) {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('clickthrough-changed', value)
  }

  if (uiWindow && !uiWindow.isDestroyed()) {
    uiWindow.webContents.send('clickthrough-changed', value)
  }
}

async function capturePrimaryDisplay(): Promise<string | null> {
  try {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size
    const maxWidth = 1280
    const scale = width > maxWidth ? maxWidth / width : 1
    const thumbnailSize = {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    }

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize,
      fetchWindowIcons: false,
    })

    const matched = sources.find((source) => source.display_id === String(primaryDisplay.id)) ?? sources[0]

    if (!matched || matched.thumbnail.isEmpty()) {
      return null
    }

    return matched.thumbnail.toDataURL()
  } catch {
    return null
  }
}

const gotSingleInstanceLock = IS_SMOKE_RUNTIME ? true : app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!petWindow || petWindow.isDestroyed()) {
      createPetWindow()
    } else {
      petWindow.show()
      petWindow.focus()
    }

    if (uiWindow && !uiWindow.isDestroyed()) {
      uiWindow.show()
      uiWindow.focus()
    }
  })

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID)
    registerImportedPetProtocol()
    setupIPC()
    createPetWindow()
    setupStableTray()
    startContextPolling()
    startAutomationMetricsLogging()
    startRuntimeScenario()
    scheduleAutomatedRuntimeExit()
    if (REQUIRES_SMOKE_UI) {
      setTimeout(() => {
        if (SMOKE_TARGET === 'settings') {
          showUIWindowAndNotify('ui:show-settings')
          return
        }
        if (SMOKE_TARGET === 'workmode') {
          showUIWindowAndNotify('ui:show-settings')
          return
        }
        if (SMOKE_TARGET === 'import') {
          showUIWindowAndNotify('ui:show-settings')
          return
        }

        showUIWindowAndNotify('ui:show-chat')
      }, 250)
    }
  })
}

app.on('window-all-closed', () => {
  if (contextPollInterval) clearInterval(contextPollInterval)
  if (automationMetricsInterval) clearInterval(automationMetricsInterval)
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!petWindow) createPetWindow()
})

function getMimeType(relativePath: string): string {
  const lower = relativePath.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}
