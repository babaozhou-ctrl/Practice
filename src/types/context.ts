export type ActivityType = 'CODING' | 'GAMING' | 'WATCHING' | 'CHATTING' | 'BROWSING' | 'READING' | 'IDLE' | 'OTHER'

export interface ActiveWindowInfo {
  title: string
  process: string
  idleMs?: number
  mediaPlaying?: boolean
  mediaTitle?: string
  mediaArtist?: string
  mediaSource?: string
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

export type ScreenPerceptionSource =
  | 'ocr'
  | 'local_vision'
  | 'cloud_vision'
  | 'capture_only'
  | 'idle'

export interface ScreenPerceptionSnapshot {
  summary: string | null
  source: ScreenPerceptionSource
  providerId: string
  imageAvailable: boolean
  updatedAt: number
  windowTitle: string
  windowProcess: string
}
