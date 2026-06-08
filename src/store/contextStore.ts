import { create } from 'zustand'
import {
  ActiveWindowInfo,
  ActivityType,
  ScreenCaptureConfig,
  ScreenPerceptionSnapshot,
} from '../types/context'

interface ContextStore {
  activeWindow: ActiveWindowInfo
  activity: ActivityType
  captureConfig: ScreenCaptureConfig
  screenPerception: ScreenPerceptionSnapshot | null
  isAnalyzing: boolean
  isScreenMonitoring: boolean

  setActiveWindow: (info: ActiveWindowInfo) => void
  setActivity: (type: ActivityType) => void
  setCaptureConfig: (config: Partial<ScreenCaptureConfig>) => void
  setScreenPerception: (snapshot: ScreenPerceptionSnapshot | null) => void
  setAnalyzing: (v: boolean) => void
  setScreenMonitoring: (v: boolean) => void
}

export const useContextStore = create<ContextStore>((set) => ({
  activeWindow: { title: '', process: '' },
  activity: 'OTHER',
  captureConfig: {
    enabled: true,
    interval: 10000,
    ocrEnabled: true,
    localVisionEnabled: true,
    cloudVisionEnabled: false,
  },
  screenPerception: null,
  isAnalyzing: false,
  isScreenMonitoring: true,

  setActiveWindow: (info) => set({ activeWindow: info }),
  setActivity: (type) => set({ activity: type }),
  setCaptureConfig: (partial) =>
    set((s) => ({ captureConfig: { ...s.captureConfig, ...partial } })),
  setScreenPerception: (snapshot) => set({ screenPerception: snapshot }),
  setAnalyzing: (v) => set({ isAnalyzing: v }),
  setScreenMonitoring: (v) => set({ isScreenMonitoring: v }),
}))
