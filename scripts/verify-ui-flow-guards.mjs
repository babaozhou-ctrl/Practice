import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appSource = readFileSync(resolve('src/App.tsx'), 'utf8')
const settingsSource = readFileSync(resolve('src/components/settings/AISettingsPanel.tsx'), 'utf8')
const customPetLoaderSource = readFileSync(resolve('src/components/pet/CustomPetLoader.tsx'), 'utf8')
const chatPanelSource = readFileSync(resolve('src/components/chat/ChatPanel.tsx'), 'utf8')
const petHtmlSource = readFileSync(resolve('pet.html'), 'utf8')

const appChecks = [
  'const openChatView = () => {',
  'const openSettingsView = () => {',
  'const openImportView = () => {',
  'window.electronAPI.onShowSettings(() => openSettingsView())',
  'window.electronAPI.onShowChat(() => openChatView())',
  'window.electronAPI.onShowImport(() => openImportView())',
  "if (flags?.smokeTarget === 'import' || flags?.scenario === 'stability-import') {",
  'openImportView()',
  'if (isChatOpen && !showSettings && !showCustomPetLoader) {',
]

const settingsChecks = [
  "import { usePetStore } from '../../store/petStore'",
  'const refreshCatalog = useSelectedPetStore((state) => state.refreshCatalog)',
  'const setShowCustomPetLoader = usePetStore((state) => state.setShowCustomPetLoader)',
  'onClick={() => setShowCustomPetLoader(true)}',
  'onClick={() => refreshCatalog()}',
]

const customPetLoaderChecks = [
  "input.setAttribute('webkitdirectory', '')",
  "input.setAttribute('directory', '')",
  "if (event.key === 'Escape') {",
  "maxHeight: 'calc(100vh - 24px)'",
  "overflowY: 'auto'",
  "gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'",
  'onChange={handleDirectoryInput}',
]

const chatPanelChecks = [
  'const textareaRef = useRef<HTMLTextAreaElement>(null)',
  "textareaRef.current?.focus()",
  "const timer = window.setTimeout(focusInput, 180)",
  "if (event.key === 'Escape') {",
  '<textarea',
  'ref={textareaRef}',
  'const chatReady = config.enabled && isConnected',
  'const chatInputDisabled = isStreaming || !chatReady',
  'placeholder={chatInputPlaceholder}',
  'disabled={chatInputDisabled}',
]

const petMainSource = readFileSync(resolve('src/pet-main.ts'), 'utf8')
const preloadSource = readFileSync(resolve('electron/preload.ts'), 'utf8')
const electronMainSource = readFileSync(resolve('electron/main.ts'), 'utf8')

const petMainChecks = [
  "createItem('\\u5bfc\\u5165\\u89d2\\u8272'",
  'window.electronAPI?.openImport?.()',
  'const menuPreferredWidth = 320',
  "menu.style.width = `${measuredWidth}px`",
]

const preloadChecks = [
  "openImport: () => ipcRenderer.send('pet:open-import')",
  "ipcRenderer.on('ui:show-import', () => callback())",
]

const electronMainChecks = [
  "showUIWindowAndNotify(channel?: 'ui:show-settings' | 'ui:show-chat' | 'ui:show-import')",
  "ipcMain.on('pet:open-import', () => {",
  "showUIWindowAndNotify('ui:show-import')",
  "label: '导入角色'",
]

const layeringChecks = [
  {
    source: chatPanelSource,
    snippet: 'zIndex: 10000',
    label: 'chat-panel-z-index',
  },
  {
    source: settingsSource,
    snippet: 'zIndex: 10001',
    label: 'settings-panel-z-index',
  },
  {
    source: customPetLoaderSource,
    snippet: 'zIndex: 10003',
    label: 'custom-pet-loader-z-index',
  },
]

const petHtmlChecks = [
  'width: min(320px, calc(100vw - 28px));',
  'min-width: 300px;',
  'overflow-x: hidden;',
]

for (const snippet of appChecks) {
  if (!appSource.includes(snippet)) {
    console.error(`[deep-pet] ui flow verification failed: missing App snippet ${snippet}`)
    process.exit(1)
  }
}

for (const snippet of settingsChecks) {
  if (!settingsSource.includes(snippet)) {
    console.error(`[deep-pet] ui flow verification failed: missing settings snippet ${snippet}`)
    process.exit(1)
  }
}

for (const snippet of customPetLoaderChecks) {
  if (!customPetLoaderSource.includes(snippet)) {
    console.error(`[deep-pet] ui flow verification failed: missing custom pet loader snippet ${snippet}`)
    process.exit(1)
  }
}

for (const snippet of chatPanelChecks) {
  if (!chatPanelSource.includes(snippet)) {
    console.error(`[deep-pet] ui flow verification failed: missing chat panel snippet ${snippet}`)
    process.exit(1)
  }
}

for (const snippet of petMainChecks) {
  if (!petMainSource.includes(snippet)) {
    console.error(`[deep-pet] ui flow verification failed: missing pet-main snippet ${snippet}`)
    process.exit(1)
  }
}

for (const snippet of preloadChecks) {
  if (!preloadSource.includes(snippet)) {
    console.error(`[deep-pet] ui flow verification failed: missing preload snippet ${snippet}`)
    process.exit(1)
  }
}

for (const snippet of electronMainChecks) {
  if (!electronMainSource.includes(snippet)) {
    console.error(`[deep-pet] ui flow verification failed: missing electron-main snippet ${snippet}`)
    process.exit(1)
  }
}

for (const check of layeringChecks) {
  if (!check.source.includes(check.snippet)) {
    console.error(`[deep-pet] ui flow verification failed: missing ${check.label}`)
    process.exit(1)
  }
}

for (const snippet of petHtmlChecks) {
  if (!petHtmlSource.includes(snippet)) {
    console.error(`[deep-pet] ui flow verification failed: missing pet.html snippet ${snippet}`)
    process.exit(1)
  }
}

console.log('[deep-pet] ui flow guards verified')
