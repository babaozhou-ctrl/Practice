export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessageAction {
  id: string
  label: string
  prompt: string
  fillOnly?: boolean
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  actions?: ChatMessageAction[]
}

export interface AIConfig {
  endpoint: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  enabled: boolean
}

export interface CompanionProfile {
  id: string
  name: string
  roleIdentity: string
  presenceStyle: string[]
  toneStyle: string[]
  verbosity: string
  emojiUsage: string
  affectionLevel: number
  responseStyle: string[]
  speechRules: {
    avoidAssistantTone: boolean
    preferCompanionTone: boolean
    defaultProactiveFrequency: string
    respectFocusMode: boolean
    respectGamingQuietMode: boolean
  }
  promptDirectives: {
    core: string[]
    avoid: string[]
    do: string[]
  }
  memoryPolicy: {
    rememberPreferences: boolean
    rememberRituals: boolean
    rememberSensitiveDataByDefault: boolean
  }
}

export interface CompanionMemorySnapshot {
  preferredName: string | null
  preferences: string[]
  avoidances: string[]
  rituals: string[]
  recentTopics: string[]
  lastActivity: string | null
  lastScene: string | null
  lastWindowTitle: string | null
  updatedAt: number | null
}

export interface CompanionChatContext {
  profile: CompanionProfile
  activity: string
  activityLabel: string
  sceneId: string
  sceneLabel: string
  sceneEnergy: string
  sceneTone: string
  windowTitle: string
  windowProcess: string
  recommendedTone: string
  responsePacing: string
  interruptionStyle: string
  samplePrompts: string[]
  sceneGuidance: string[]
  contextFlags: string[]
  capabilityFlags?: string[]
}

export interface ChatSession {
  id: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}
