import { create } from 'zustand'
import { ChatMessage, AIConfig } from '../types/chat'

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

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  config: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.8,
    maxTokens: 1024,
    enabled: false,
  },
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
  setConfig: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),
  setStreaming: (v) => set({ isStreaming: v }),
  setConnected: (v) => set({ isConnected: v }),
}))
