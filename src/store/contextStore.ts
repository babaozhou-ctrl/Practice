import { create } from 'zustand'
import { ActiveWindowInfo, ActivityType, ScreenCaptureConfig } from '../types/context'

interface ContextStore {
  activeWindow: ActiveWindowInfo
  activity: ActivityType
  captureConfig: ScreenCaptureConfig
  isAnalyzing: boolean
  isScreenMonitoring: boolean

  setActiveWindow: (info: ActiveWindowInfo) => void
  setActivity: (type: ActivityType) => void
  setCaptureConfig: (config: Partial<ScreenCaptureConfig>) => void
  setAnalyzing: (v: boolean) => void
  setScreenMonitoring: (v: boolean) => void
}

export const useContextStore = create<ContextStore>((set) => ({
  activeWindow: { title: '', process: '' },
  activity: 'OTHER',
  captureConfig: {
    enabled: false,
    interval: 10000,
    ocrEnabled: false,
    localVisionEnabled: false,
    cloudVisionEnabled: false,
  },
  isAnalyzing: false,
  isScreenMonitoring: false,

  setActiveWindow: (info) => set({ activeWindow: info }),
  setActivity: (type) => set({ activity: type }),
  setCaptureConfig: (partial) =>
    set((s) => ({ captureConfig: { ...s.captureConfig, ...partial } })),
  setAnalyzing: (v) => set({ isAnalyzing: v }),
  setScreenMonitoring: (v) => set({ isScreenMonitoring: v }),
}))
