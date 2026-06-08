import { contextBridge, ipcRenderer } from 'electron'
import type { PluginAIChatExecutionRequest } from '../src/plugins/types'

contextBridge.exposeInMainWorld('electronAPI', {
  movePet: (x: number, y: number) => ipcRenderer.send('pet:moved', x, y),
  getPosition: (): Promise<{ x: number; y: number }> => ipcRenderer.invoke('pet:get-position'),
  toggleClickThrough: () => ipcRenderer.send('pet:toggle-clickthrough'),
  openChat: () => ipcRenderer.send('pet:open-chat'),
  openSettings: () => ipcRenderer.send('pet:open-settings'),
  onShowSettings: (callback: () => void) => {
    ipcRenderer.on('ui:show-settings', () => callback())
  },
  quitApp: () => ipcRenderer.send('app:quit'),
  getActiveWindow: (): Promise<{ title: string; process: string; idleMs?: number }> =>
    ipcRenderer.invoke('context:get-active-window'),
  extractDocumentText: (payload: { fileName: string; mimeType?: string; buffer: ArrayBuffer | Uint8Array }) =>
    ipcRenderer.invoke('documents:extract-text', payload),
  runPluginFileAnalysis: (payload: { providerId: string; fileName: string; content: string }) =>
    ipcRenderer.invoke('plugins:run-file-analysis', payload),
  runPluginAIChat: async (
    payload: PluginAIChatExecutionRequest,
    onChunk?: (chunk: string) => void,
  ) => {
    const requestId = payload.requestId || `plugin-ai-chat:${Date.now()}:${Math.random().toString(16).slice(2)}`
    const channel = `plugins:ai-chat-chunk:${requestId}`
    const listener = (_event: Electron.IpcRendererEvent, chunk: string) => {
      onChunk?.(chunk)
    }

    if (onChunk) {
      ipcRenderer.on(channel, listener)
    }

    try {
      return await ipcRenderer.invoke('plugins:run-ai-chat', {
        ...payload,
        requestId,
      })
    } finally {
      if (onChunk) {
        ipcRenderer.removeListener(channel, listener)
      }
    }
  },
  cancelPluginAIChat: (requestId: string) =>
    ipcRenderer.invoke('plugins:cancel-ai-chat', { requestId }),
  onSpeech: (callback: (msg: string, dur: number) => void) => {
    ipcRenderer.on('speech:show', (_event, msg, dur) => callback(msg, dur))
  },
  onStateChange: (callback: (state: string) => void) => {
    ipcRenderer.on('pet:state', (_event, state) => callback(state))
  },
  onWindowUpdate: (callback: (info: { title: string; process: string; idleMs?: number }) => void) => {
    ipcRenderer.on('context:window-update', (_event, info) => callback(info))
  },
  onContextUpdate: (callback: (info: { title: string; process: string; idleMs?: number }) => void) => {
    ipcRenderer.on('context:update', (_event, info) => callback(info))
  },
  onClickThroughChanged: (callback: (value: boolean) => void) => {
    ipcRenderer.on('clickthrough-changed', (_event, value) => callback(value))
  },
  listImportedPets: () => ipcRenderer.invoke('pets:list-imported'),
  saveImportedPet: (record: unknown) => ipcRenderer.invoke('pets:save-imported', record),
  listLocalPlugins: () => ipcRenderer.invoke('plugins:list-local'),
})
