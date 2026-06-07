import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  movePet: (x: number, y: number) => ipcRenderer.send('pet:moved', x, y),
  getPosition: (): Promise<{x:number,y:number}> => ipcRenderer.invoke('pet:get-position'),
  toggleClickThrough: () => ipcRenderer.send('pet:toggle-clickthrough'),
  openChat: () => ipcRenderer.send('pet:open-chat'),
  openSettings: () => ipcRenderer.send('pet:open-settings'),
  onShowSettings: (callback: () => void) => { ipcRenderer.on('ui:show-settings', function() { callback() }) },
  quitApp: () => ipcRenderer.send('app:quit'),
  getActiveWindow: (): Promise<{title:string,process:string,idleMs?:number}> => ipcRenderer.invoke('context:get-active-window'),
  extractDocumentText: (payload: { fileName: string; mimeType?: string; buffer: ArrayBuffer | Uint8Array }) =>
    ipcRenderer.invoke('documents:extract-text', payload),
  onSpeech: (callback: (msg: string, dur: number) => void) => {
    ipcRenderer.on('speech:show', (_e, msg, dur) => callback(msg, dur))
  },
  onStateChange: (callback: (state: string) => void) => {
    ipcRenderer.on('pet:state', (_e, state) => callback(state))
  },
  onWindowUpdate: (callback: (info: {title:string,process:string,idleMs?:number}) => void) => {
    ipcRenderer.on('context:window-update', (_e, info) => callback(info))
  },
  onContextUpdate: (callback: (info: {title:string,process:string,idleMs?:number}) => void) => {
    ipcRenderer.on('context:update', (_e, info) => callback(info))
  },
  onClickThroughChanged: (callback: (v: boolean) => void) => {
    ipcRenderer.on('clickthrough-changed', (_e, v) => callback(v))
  },
  listImportedPets: () => ipcRenderer.invoke('pets:list-imported'),
  saveImportedPet: (record: unknown) => ipcRenderer.invoke('pets:save-imported', record),
})
