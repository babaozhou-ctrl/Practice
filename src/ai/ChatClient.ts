import { AIConfig, ChatMessage, CompanionChatContext } from '../types/chat'
import { resolveAIChatProvider } from '../plugins/PluginCapabilityRegistry'
import { buildCompanionPrompt } from './CompanionContextAdapter'
import { MemoryManager } from './MemoryManager'

export type StreamCallback = (chunk: string) => void
export type DoneCallback = (fullContent: string) => void
export type ErrorCallback = (err: Error) => void

export class ChatClient {
  private config: AIConfig
  private memory: MemoryManager
  private providerId: string
  private abortController: AbortController | null = null

  constructor(config: AIConfig, providerId = 'builtin.ai-chat.deepseek') {
    this.config = config
    this.memory = new MemoryManager()
    this.providerId = providerId
  }

  updateConfig(config: Partial<AIConfig>) {
    this.config = { ...this.config, ...config }
  }

  updateProvider(providerId: string) {
    this.providerId = providerId
  }

  syncTranscript(messages: ChatMessage[]) {
    this.memory.syncTranscript(messages)
  }

  async sendMessage(
    content: string,
    context: CompanionChatContext,
    onStream: StreamCallback,
    onDone: DoneCallback,
    onError: ErrorCallback,
  ) {
    if (!this.config.enabled || !this.config.apiKey) {
      onError(new Error('AI not configured. Set API key in settings.'))
      return
    }

    this.abortController = new AbortController()

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    this.memory.add(userMsg)
    this.memory.rememberFromUserMessage(content, context)

    const systemPrompt = buildCompanionPrompt(context, this.memory.getCompanionMemory())
    const provider = resolveAIChatProvider(this.providerId)

    try {
      const fullContent = await provider.streamChat(
        {
          config: this.config,
          systemPrompt,
          messages: this.memory.getMessages(),
          signal: this.abortController.signal,
        },
        {
          onChunk: onStream,
        },
      )

      if (fullContent) {
        const assistantMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now(),
        }
        this.memory.add(assistantMsg)
      }

      onDone(fullContent)
    } catch (err: any) {
      if (err.name === 'AbortError') {
        onDone('')
      } else {
        onError(err)
      }
    }
  }

  cancel() {
    this.abortController?.abort()
  }

  clearMemory() {
    this.memory.clear()
  }

  getMemory(): ChatMessage[] {
    return this.memory.getMessages()
  }

  getCompanionMemory() {
    return this.memory.getCompanionMemory()
  }
}
