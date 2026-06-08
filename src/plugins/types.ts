import type { AIConfig, ChatMessage } from '../types/chat'

export type PluginCapabilityProvider =
  | 'aiChat'
  | 'fileAnalysis'
  | 'screenPerception'

export interface ProviderDescriptor {
  id: string
  label: string
  capability: PluginCapabilityProvider
  kind: 'builtin' | 'plugin'
  availability?: 'active' | 'discovered'
  description?: string
}

export interface CapabilityProviderRegistration {
  descriptor: ProviderDescriptor
  aiChatProvider?: AIChatProvider
  fileAnalysisProvider?: FileAnalysisProvider
  screenPerceptionProvider?: ScreenPerceptionProvider
}

export interface AIChatStreamRequest {
  config: AIConfig
  systemPrompt: string
  messages: ChatMessage[]
  signal?: AbortSignal
}

export interface AIChatStreamCallbacks {
  onChunk: (chunk: string) => void
}

export interface DocumentSummaryRequest {
  config: AIConfig
  fileName: string
  content: string
}

export interface AIProviderHealthStatus {
  ok: boolean
  message: string
}

export interface AIChatProvider {
  id: string
  label: string
  streamChat(
    request: AIChatStreamRequest,
    callbacks: AIChatStreamCallbacks,
  ): Promise<string>
  summarizeDocument(request: DocumentSummaryRequest): Promise<string>
  healthCheck(config: AIConfig): Promise<AIProviderHealthStatus>
}

export interface FileAnalysisProvider {
  id: string
  label: string
  readFile(file: File): Promise<string>
  summarize(request: { fileName: string; content: string }): Promise<string>
}

export interface ScreenPerceptionProvider {
  id: string
  label: string
  captureScreenshot(): Promise<string | null>
  analyzeWithOCR(imageData: string): Promise<string>
  analyzeWithLocalVision(imageData: string): Promise<string>
  analyzeWithCloudVision(imageData: string): Promise<string>
}
