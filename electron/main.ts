import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen } from 'electron'
import { join } from 'path'
import { listImportedPetPackages, saveImportedPetPackage } from './imported-pet-storage'
import { extractDocumentText } from './services/document-reader'
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

process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err.message) })
process.on('unhandledRejection', (reason) => { console.error('Unhandled rejection:', reason) })

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
  })

  ipcMain.on('pet:open-settings', () => {
    if (uiWindow) {
      uiWindow.show()
      uiWindow.focus()
      uiWindow.webContents.send('ui:show-settings')
      return
    }

    createUIWindow()
    setTimeout(() => {
      if (uiWindow) {
        uiWindow.show()
        uiWindow.focus()
        uiWindow.webContents.send('ui:show-settings')
      }
    }, 300)
  })

  ipcMain.on('pet:open-chat', () => {
    if (uiWindow) {
      uiWindow.show()
      uiWindow.focus()
      return
    }

    createUIWindow()
    setTimeout(() => {
      if (uiWindow) {
        uiWindow.show()
        uiWindow.focus()
      }
    }, 200)
  })

  ipcMain.handle('context:get-active-window', async () => detectActiveWindow())
  ipcMain.handle('documents:extract-text', async (_event, payload) => extractDocumentText(payload))
  ipcMain.handle('pets:list-imported', async () => listImportedPetPackages())
  ipcMain.handle('pets:save-imported', async (_event, record) => saveImportedPetPackage(record))
  ipcMain.on('app:quit', () => app.quit())
}

function setupTray() {
  const trayIcon = nativeImage.createFromPath(APP_ICON_PATH)
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon)
  tray.setToolTip('Deep Pet')
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Toggle Click-Through',
      type: 'checkbox',
      checked: isClickThrough,
      click: () => {
        isClickThrough = !isClickThrough
        if (petWindow) {
          petWindow.setIgnoreMouseEvents(isClickThrough, { forward: true })
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Open Chat',
      click: () => {
        if (uiWindow) {
          uiWindow.show()
          uiWindow.focus()
          return
        }
        createUIWindow()
        setTimeout(() => {
          if (uiWindow) {
            uiWindow.show()
            uiWindow.focus()
          }
        }, 200)
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]))
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
        petWindow.webContents.send('context:update', info)
      }
    } catch {
      // ignore transient context polling failures
    }
  }, 5000)
}

app.whenReady().then(() => {
  app.setAppUserModelId(APP_ID)
  createPetWindow()
  setupIPC()
  setupTray()
  startContextPolling()
})

app.on('window-all-closed', () => {
  if (contextPollInterval) clearInterval(contextPollInterval)
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!petWindow) createPetWindow()
})
