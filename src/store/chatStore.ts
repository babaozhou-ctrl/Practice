import { create } from 'zustand'
import { ChatMessage, AIConfig } from '../types/chat'

const CHAT_CONFIG_STORAGE_KEY = 'deep-pet.chat-config.v1'
const CHAT_CONFIG_EVENT = 'deep-pet:chat-config-sync'

const DEFAULT_CHAT_CONFIG: AIConfig = {
  endpoint: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.8,
  maxTokens: 1024,
  enabled: false,
}

interface ChatStore {
  messages: ChatMessage[]
  config: AIConfig
  isStreaming: boolean
  isConnected: boolean

  addMessage: (msg: ChatMessage) => void
  appendToLastMessage: (content: string) => void
  updateMessageActions: (messageId: string, actions: ChatMessage['actions']) => void
  clearMessages: () => void
  setConfig: (config: Partial<AIConfig>) => void
  setStreaming: (v: boolean) => void
  setConnected: (v: boolean) => void
}

function normalizeChatConfig(value: Partial<AIConfig> | null | undefined): AIConfig {
  return {
    endpoint:
      typeof value?.endpoint === 'string' && value.endpoint.trim()
        ? value.endpoint.trim()
        : DEFAULT_CHAT_CONFIG.endpoint,
    apiKey: typeof value?.apiKey === 'string' ? value.apiKey.trim() : DEFAULT_CHAT_CONFIG.apiKey,
    model:
      typeof value?.model === 'string' && value.model.trim()
        ? value.model.trim()
        : DEFAULT_CHAT_CONFIG.model,
    temperature:
      typeof value?.temperature === 'number' && Number.isFinite(value.temperature)
        ? value.temperature
        : DEFAULT_CHAT_CONFIG.temperature,
    maxTokens:
      typeof value?.maxTokens === 'number' && Number.isFinite(value.maxTokens)
        ? Math.max(128, Math.round(value.maxTokens))
        : DEFAULT_CHAT_CONFIG.maxTokens,
    enabled: Boolean(value?.enabled ?? DEFAULT_CHAT_CONFIG.enabled),
  }
}

export function readChatConfig(): AIConfig {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_CHAT_CONFIG }
    }

    const raw = window.localStorage.getItem(CHAT_CONFIG_STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_CHAT_CONFIG }
    }

    return normalizeChatConfig(JSON.parse(raw) as Partial<AIConfig>)
  } catch {
    return { ...DEFAULT_CHAT_CONFIG }
  }
}

function writeChatConfig(config: AIConfig) {
  const normalized = normalizeChatConfig(config)

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CHAT_CONFIG_STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // Ignore persistence failures and keep the in-memory state usable.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHAT_CONFIG_EVENT, { detail: normalized }))
  }
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  config: readChatConfig(),
  isStreaming: false,
  isConnected: false,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendToLastMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last) {
        msgs[msgs.length - 1] = { ...last, content: last.content + content }
      }
      return { messages: msgs }
    }),
  updateMessageActions: (messageId, actions) =>
    set((s) => ({
      messages: s.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              actions,
            }
          : message,
      ),
    })),
  clearMessages: () => set({ messages: [] }),
  setConfig: (partial) =>
    set((s) => {
      const nextConfig = normalizeChatConfig({ ...s.config, ...partial })
      writeChatConfig(nextConfig)
      return { config: nextConfig }
    }),
  setStreaming: (v) => set({ isStreaming: v }),
  setConnected: (v) => set({ isConnected: v }),
}))
