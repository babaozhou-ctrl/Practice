import { contextBridge, ipcRenderer } from 'electron'
import type { CompanionActionPayload } from '../src/ai/CompanionActionBridge'
import type { CompanionFeedAnalysisPayload } from '../src/ai/CompanionFeedBridge'
import type { CompanionUtterancePayload } from '../src/ai/CompanionUtteranceBridge'
import type { PluginAIChatExecutionRequest } from '../src/plugins/types'
import type { AIConfig } from '../src/types/chat'

contextBridge.exposeInMainWorld('electronAPI', {
  movePet: (x: number, y: number) => ipcRenderer.send('pet:moved', x, y),
  getPosition: (): Promise<{ x: number; y: number }> => ipcRenderer.invoke('pet:get-position'),
  setMenuExpanded: (
    expandedOrOptions:
      | boolean
      | {
          expanded: boolean
          width?: number
          height?: number
        },
  ): Promise<boolean> => ipcRenderer.invoke('pet:set-menu-expanded', expandedOrOptions),
  toggleClickThrough: () => ipcRenderer.send('pet:toggle-clickthrough'),
  openChat: () => ipcRenderer.send('pet:open-chat'),
  openSettings: () => ipcRenderer.send('pet:open-settings'),
  openImport: () => ipcRenderer.send('pet:open-import'),
  onShowSettings: (callback: () => void) => {
    ipcRenderer.on('ui:show-settings', () => callback())
  },
  onShowChat: (callback: () => void) => {
    ipcRenderer.on('ui:show-chat', () => callback())
  },
  onShowImport: (callback: () => void) => {
    ipcRenderer.on('ui:show-import', () => callback())
  },
  getRuntimeFlags: (): Promise<{
    smokeTarget: string | null
    scenario: string | null
    isDev: boolean
    smokeRunId: string | null
    automationRunId: string | null
    autoExitMs: number | null
  }> =>
    ipcRenderer.invoke('app:get-runtime-flags'),
  emitCompanionFeedBridgePayload: (payload: CompanionFeedAnalysisPayload) =>
    ipcRenderer.send('bridge:feed:emit', payload),
  readCompanionFeedBridgeHistory: (): Promise<CompanionFeedAnalysisPayload[]> =>
    ipcRenderer.invoke('bridge:feed:list'),
  onCompanionFeedBridgePayload: (callback: (payload: CompanionFeedAnalysisPayload) => void) => {
    ipcRenderer.on('bridge:companion-feed-analysis', (_event, payload) => callback(payload))
  },
  emitCompanionActionBridgePayload: (payload: CompanionActionPayload) =>
    ipcRenderer.send('bridge:action:emit', payload),
  onCompanionActionBridgePayload: (callback: (payload: CompanionActionPayload) => void) => {
    ipcRenderer.on('bridge:companion-action', (_event, payload) => callback(payload))
  },
  emitCompanionUtteranceBridgePayload: (payload: CompanionUtterancePayload) =>
    ipcRenderer.send('bridge:utterance:emit', payload),
  onCompanionUtteranceBridgePayload: (callback: (payload: CompanionUtterancePayload) => void) => {
    ipcRenderer.on('bridge:companion-utterance', (_event, payload) => callback(payload))
  },
  emitSmokeCheckpoint: (label: string) => ipcRenderer.send('smoke:checkpoint', label),
  emitAutomationMetricsEvent: (payload: unknown) => ipcRenderer.send('metrics:event', payload),
  hideUIWindow: () => ipcRenderer.send('app:hide-ui'),
  quitApp: () => ipcRenderer.send('app:quit'),
  getActiveWindow: (): Promise<{ title: string; process: string; idleMs?: number; mediaPlaying?: boolean; mediaTitle?: string; mediaArtist?: string; mediaSource?: string }> =>
    ipcRenderer.invoke('context:get-active-window'),
  capturePrimaryScreen: (): Promise<string | null> =>
    ipcRenderer.invoke('screen:capture-primary'),
  extractDocumentText: (payload: { fileName: string; mimeType?: string; buffer: ArrayBuffer | Uint8Array }) =>
    ipcRenderer.invoke('documents:extract-text', payload),
  runPluginFileAnalysis: (payload: { providerId: string; fileName: string; content: string }) =>
    ipcRenderer.invoke('plugins:run-file-analysis', payload),
  runPluginAISummary: (payload: { providerId: string; config: AIConfig; fileName: string; content: string }) =>
    ipcRenderer.invoke('plugins:run-ai-summary', payload),
  runPluginScreenCapture: (payload: { providerId: string }) =>
    ipcRenderer.invoke('plugins:run-screen-capture', payload),
  runPluginScreenOCR: (payload: { providerId: string; imageData: string }) =>
    ipcRenderer.invoke('plugins:run-screen-ocr', payload),
  runPluginScreenLocalVision: (payload: { providerId: string; imageData: string }) =>
    ipcRenderer.invoke('plugins:run-screen-local-vision', payload),
  runPluginScreenCloudVision: (payload: { providerId: string; imageData: string }) =>
    ipcRenderer.invoke('plugins:run-screen-cloud-vision', payload),
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
  runPluginAIHealthCheck: (payload: { providerId: string; config: AIConfig }) =>
    ipcRenderer.invoke('plugins:run-ai-health-check', payload),
  onSpeech: (callback: (msg: string, dur: number) => void) => {
    ipcRenderer.on('speech:show', (_event, msg, dur) => callback(msg, dur))
  },
  onStateChange: (callback: (state: string) => void) => {
    ipcRenderer.on('pet:state', (_event, state) => callback(state))
  },
  onWindowUpdate: (callback: (info: { title: string; process: string; idleMs?: number; mediaPlaying?: boolean; mediaTitle?: string; mediaArtist?: string; mediaSource?: string }) => void) => {
    ipcRenderer.on('context:window-update', (_event, info) => callback(info))
  },
  onContextUpdate: (callback: (info: { title: string; process: string; idleMs?: number; mediaPlaying?: boolean; mediaTitle?: string; mediaArtist?: string; mediaSource?: string }) => void) => {
    ipcRenderer.on('context:update', (_event, info) => callback(info))
  },
  onClickThroughChanged: (callback: (value: boolean) => void) => {
    ipcRenderer.on('clickthrough-changed', (_event, value) => callback(value))
  },
  listImportedPets: () => ipcRenderer.invoke('pets:list-imported'),
  saveImportedPet: (record: unknown) => ipcRenderer.invoke('pets:save-imported', record),
  listLocalPlugins: () => ipcRenderer.invoke('plugins:list-local'),
})
