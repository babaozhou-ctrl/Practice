import { create } from 'zustand'
import { ChatMessage, AIConfig } from '../types/chat'

const CHAT_CONFIG_STORAGE_KEY = 'deep-pet.chat-config.v1'
const CHAT_CONFIG_EVENT = 'deep-pet:chat-config-sync'
const CHAT_RUNTIME_STORAGE_KEY = 'deep-pet.chat-runtime.v1'
const CHAT_RUNTIME_EVENT = 'deep-pet:chat-runtime-sync'

const DEFAULT_CHAT_CONFIG: AIConfig = {
  endpoint: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.8,
  maxTokens: 1024,
  enabled: false,
}

export interface ChatRuntimeState {
  enabled: boolean
  isConnected: boolean
}

const DEFAULT_CHAT_RUNTIME_STATE: ChatRuntimeState = {
  enabled: DEFAULT_CHAT_CONFIG.enabled,
  isConnected: false,
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

function normalizeChatRuntimeState(value: Partial<ChatRuntimeState> | null | undefined): ChatRuntimeState {
  return {
    enabled: Boolean(value?.enabled ?? DEFAULT_CHAT_RUNTIME_STATE.enabled),
    isConnected: Boolean(value?.isConnected ?? DEFAULT_CHAT_RUNTIME_STATE.isConnected),
  }
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

export function readChatRuntimeState(): ChatRuntimeState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        ...DEFAULT_CHAT_RUNTIME_STATE,
        enabled: readChatConfig().enabled,
      }
    }

    const raw = window.localStorage.getItem(CHAT_RUNTIME_STORAGE_KEY)
    if (!raw) {
      return {
        ...DEFAULT_CHAT_RUNTIME_STATE,
        enabled: readChatConfig().enabled,
      }
    }

    return normalizeChatRuntimeState(JSON.parse(raw) as Partial<ChatRuntimeState>)
  } catch {
    return {
      ...DEFAULT_CHAT_RUNTIME_STATE,
      enabled: readChatConfig().enabled,
    }
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

function writeChatRuntimeState(state: ChatRuntimeState) {
  const normalized = normalizeChatRuntimeState(state)

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CHAT_RUNTIME_STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // Ignore persistence failures and keep the in-memory state usable.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHAT_RUNTIME_EVENT, { detail: normalized }))
  }
}

export function subscribeChatRuntimeState(listener: (state: ChatRuntimeState) => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const emitCurrent = () => listener(readChatRuntimeState())
  const onStorage = (event: StorageEvent) => {
    if (event.key === CHAT_RUNTIME_STORAGE_KEY || event.key === CHAT_CONFIG_STORAGE_KEY) {
      emitCurrent()
    }
  }
  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<ChatRuntimeState>).detail
    if (detail) {
      listener(normalizeChatRuntimeState(detail))
      return
    }
    emitCurrent()
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(CHAT_RUNTIME_EVENT, onInternal as EventListener)
  window.addEventListener(CHAT_CONFIG_EVENT, emitCurrent as EventListener)
  emitCurrent()

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CHAT_RUNTIME_EVENT, onInternal as EventListener)
    window.removeEventListener(CHAT_CONFIG_EVENT, emitCurrent as EventListener)
  }
}

function syncChatRuntimeState(partial: Partial<ChatRuntimeState>) {
  const current = readChatRuntimeState()
  writeChatRuntimeState({
    ...current,
    ...partial,
  })
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  config: readChatConfig(),
  isStreaming: false,
  isConnected: readChatRuntimeState().isConnected,

  addMessage: (msg) =>
    set((s) => {
      if (s.messages.some((message) => message.id === msg.id)) {
        return s
      }

      return { messages: [...s.messages, msg] }
    }),
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
      syncChatRuntimeState({ enabled: nextConfig.enabled })
      return { config: nextConfig }
    }),
  setStreaming: (v) => set({ isStreaming: v }),
  setConnected: (v) =>
    set((s) => {
      syncChatRuntimeState({
        enabled: s.config.enabled,
        isConnected: v,
      })
      return { isConnected: v }
    }),
}))
