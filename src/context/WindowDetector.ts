import { ActiveWindowInfo } from '../types/context'

declare global {
  interface Window {
    electronAPI?: {
      getActiveWindow: () => Promise<{ title: string; process: string; idleMs?: number }>
      onWindowUpdate: (callback: (info: { title: string; process: string; idleMs?: number }) => void) => void
      [key: string]: any
    }
  }
}

export class WindowDetector {
  private listeners: Array<(info: ActiveWindowInfo) => void> = []
  private polling = false
  private intervalId: ReturnType<typeof setInterval> | null = null

  async getCurrentWindow(): Promise<ActiveWindowInfo> {
    if (window.electronAPI?.getActiveWindow) {
      return await window.electronAPI.getActiveWindow()
    }
    return { title: '', process: '', idleMs: 0 }
  }

  onUpdate(callback: (info: ActiveWindowInfo) => void) {
    this.listeners.push(callback)
  }

  startPolling(intervalMs = 2000) {
    if (this.polling) return
    this.polling = true

    if (window.electronAPI?.onWindowUpdate) {
      window.electronAPI.onWindowUpdate((info) => {
        for (const listener of this.listeners) {
          listener(info)
        }
      })
    } else {
      this.intervalId = setInterval(async () => {
        const info = await this.getCurrentWindow()
        for (const listener of this.listeners) {
          listener(info)
        }
      }, intervalMs)
    }
  }

  stopPolling() {
    this.polling = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
