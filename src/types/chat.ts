export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
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
  toneStyle: string[]
  verbosity: string
  emojiUsage: string
  affectionLevel: number
  speechRules: {
    avoidAssistantTone: boolean
    preferCompanionTone: boolean
    defaultProactiveFrequency: string
    respectFocusMode: boolean
    respectGamingQuietMode: boolean
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
  lastWindowTitle: string | null
  updatedAt: number | null
}

export interface CompanionChatContext {
  profile: CompanionProfile
  activity: string
  activityLabel: string
  windowTitle: string
  windowProcess: string
  recommendedTone: string
  samplePrompts: string[]
  contextFlags: string[]
  capabilityFlags?: string[]
}

export interface ChatSession {
  id: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}
