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
  private activePluginRequestId: string | null = null

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
      onError(new Error('还没有完成 AI 对话配置。去陪伴设置里填好 API Key 之后，我就能继续陪你聊天了。'))
      return
    }

    this.abortController = new AbortController()
    this.activePluginRequestId = `plugin-ai-chat:${Date.now()}:${Math.random().toString(16).slice(2)}`

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
          requestId: this.activePluginRequestId,
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
    } finally {
      this.abortController = null
      this.activePluginRequestId = null
    }
  }

  cancel() {
    this.abortController?.abort()

    if (this.activePluginRequestId && window.electronAPI?.cancelPluginAIChat) {
      void window.electronAPI.cancelPluginAIChat(this.activePluginRequestId)
    }
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

  rememberFileAnalysis(
    fileName: string,
    briefSummary: string,
    detailedAnalysis?: string | null,
    sceneId?: string | null,
  ) {
    this.memory.rememberFileAnalysis(fileName, briefSummary, detailedAnalysis, sceneId)
  }

  getActivePluginRequestId(): string | null {
    return this.activePluginRequestId
  }
}
