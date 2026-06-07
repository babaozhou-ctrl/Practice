export type ActivityType = 'CODING' | 'GAMING' | 'WATCHING' | 'CHATTING' | 'BROWSING' | 'READING' | 'IDLE' | 'OTHER'

export interface ActiveWindowInfo {
  title: string
  process: string
  idleMs?: number
}

export interface ContextSnapshot {
  activeWindow: ActiveWindowInfo
  activity: ActivityType
  timestamp: number
}

export interface ScreenCaptureConfig {
  enabled: boolean
  interval: number
  ocrEnabled: boolean
  localVisionEnabled: boolean
  cloudVisionEnabled: boolean
}
