import type { AnimationState } from '../../types/animation'
import type { CompanionMemorySnapshot } from '../../types/chat'
import type { ActivityType, ActiveWindowInfo } from '../../types/context'
import type { WorkModeSignals } from '../../types/workMode'

export type CompanionActivity =
  | 'idle'
  | 'coding'
  | 'gaming'
  | 'watching_video'
  | 'chatting'
  | 'browsing'
  | 'reading'
  | 'other'

export type CompanionEmotion =
  | 'idle'
  | 'sleepy'
  | 'happy'
  | 'thinking'
  | 'excited'

export type InteractionMode =
  | 'quiet'
  | 'observing'
  | 'reactive'
  | 'proactive'
  | 'focus_guardian'

export interface SpeechIntent {
  message: string
  duration: number
}

export interface ProactiveIntent {
  category: string
  contextKey: string
  message: string
  duration: number
}

export interface CompanionRuntimeSignals {
  interruptionBudget: number
  productiveSessionMs: number
  currentActivityDurationMs: number
  currentEmotionDurationMs: number
  currentModeDurationMs: number
  userIdleMs: number
  timeSinceLastContextMs: number
  timeSinceLastReactionMs: number
  timeSinceLastTapMs: number
}

export interface CompanionSnapshot {
  activity: CompanionActivity
  emotion: CompanionEmotion
  mode: InteractionMode
  transientAction: 'none' | 'tap_affection' | 'dragging' | 'welcome_back'
  interruptionBudget: number
  activeWindow: ActiveWindowInfo | null
  memory: CompanionMemorySnapshot | null
  workMode?: WorkModeSignals | null
  timestamp: number
}

export interface StabilizedCompanionSnapshot extends CompanionSnapshot {
  rawActivity: CompanionActivity
  rawEmotion: CompanionEmotion
  rawMode: InteractionMode
  stabilizedAt: number
}

export interface CompanionTransitionResult {
  snapshot: CompanionSnapshot
  speech?: SpeechIntent
}

export function mapActivityType(activity: ActivityType): CompanionActivity {
  switch (activity) {
    case 'CODING':
      return 'coding'
    case 'GAMING':
      return 'gaming'
    case 'WATCHING':
      return 'watching_video'
    case 'CHATTING':
      return 'chatting'
    case 'BROWSING':
      return 'browsing'
    case 'READING':
      return 'reading'
    case 'IDLE':
      return 'idle'
    default:
      return 'other'
  }
}
