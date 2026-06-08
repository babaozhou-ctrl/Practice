import { app, BrowserWindow, desktopCapturer, ipcMain, Menu, Tray, nativeImage, protocol, screen } from 'electron'
import { mkdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
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
let lastWindowInfo = ''
let lastAwayBucket = ''
let isClickThrough = false

const AWAY_BUCKET_IDLE_MS = 90_000
const APP_ID = 'com.deep.pet'
const APP_ICON_PATH = join(__dirname, '../build/icon.png')
const PET_WINDOW_WIDTH = 300
const PET_WINDOW_HEIGHT = 420
const IMPORTED_PET_PROTOCOL = 'deep-pet'

prepareRuntimePaths()

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})

function prepareRuntimePaths() {
  try {
    const sessionDataPath = join(app.getPath('userData'), 'session-data')
    mkdirSync(sessionDataPath, { recursive: true })
    app.setPath('sessionData', sessionDataPath)
  } catch (error) {
    console.warn('Failed to prepare runtime paths:', error)
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

function createPetWindow() {
  const { x, y } = getDefaultPosition()
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

  petWindow.setIgnoreMouseEvents(false)

  if (process.env.VITE_DEV_SERVER_URL) {
    petWindow.loadURL(process.env.VITE_DEV_SERVER_URL + 'pet.html')
  } else {
    petWindow.loadFile(join(__dirname, '../dist/pet.html'))
  }

  petWindow.on('closed', () => {
    petWindow = null
    app.quit()
  })

  if (process.argv.includes('--dev')) {
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

  if (process.env.VITE_DEV_SERVER_URL) {
    uiWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    uiWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  uiWindow.on('closed', () => {
    uiWindow = null
  })

  uiWindow.webContents.on('did-finish-load', () => {
    const info = detectActiveWindow()
    broadcastContextUpdate(info)
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

function getDefaultPosition() {
  const primary = screen.getPrimaryDisplay()
  const { width, height } = primary.workAreaSize
  return {
    x: Math.floor(width / 2 - PET_WINDOW_WIDTH / 2),
    y: Math.floor(height / 2 - PET_WINDOW_HEIGHT / 2),
  }
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
  ipcMain.on('app:quit', () => app.quit())
}

function setupTray() {
  const trayIcon = nativeImage.createFromPath(APP_ICON_PATH)
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon)
  tray.setToolTip('Deep Pet · bb7')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '允许点击穿透',
        type: 'checkbox',
        checked: isClickThrough,
        click: () => {
          isClickThrough = !isClickThrough
          if (petWindow) {
            petWindow.setIgnoreMouseEvents(isClickThrough, { forward: true })
          }
          broadcastClickThroughChanged(isClickThrough)
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
      { label: '退出 Deep Pet', click: () => app.quit() },
    ]),
  )
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
          if (petWindow) {
            petWindow.setIgnoreMouseEvents(isClickThrough, { forward: true })
          }
          broadcastClickThroughChanged(isClickThrough)
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
      if (key !== lastWindowInfo || awayBucket !== lastAwayBucket) {
        lastWindowInfo = key
        lastAwayBucket = awayBucket
        broadcastContextUpdate(info)
      }
    } catch {
      // Ignore transient context polling failures.
    }
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

const gotSingleInstanceLock = app.requestSingleInstanceLock()

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
    createPetWindow()
    setupIPC()
    setupStableTray()
    startContextPolling()
  })
}

app.on('window-all-closed', () => {
  if (contextPollInterval) clearInterval(contextPollInterval)
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
