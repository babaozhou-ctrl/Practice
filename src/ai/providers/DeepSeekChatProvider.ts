import type { AIConfig, ChatMessage } from '../../types/chat'
import type {
  AIChatProvider,
  AIChatStreamCallbacks,
  AIChatStreamRequest,
  AIProviderHealthStatus,
  DocumentSummaryRequest,
} from '../../plugins/types'

function buildRequestBody(config: AIConfig, systemPrompt: string, messages: ChatMessage[]) {
  return {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
  }
}

async function streamSseResponse(
  response: Response,
  callbacks: AIChatStreamCallbacks,
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('AI provider returned no response body.')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const event of events) {
      const dataLines = event
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))

      for (const data of dataLines) {
        if (data === '[DONE]') {
          continue
        }

        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
            callbacks.onChunk(delta)
          }
        } catch {
          // Ignore malformed partial chunks.
        }
      }
    }
  }

  return fullContent
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return 'Unknown provider error'
  }
}

export class DeepSeekChatProvider implements AIChatProvider {
  readonly id = 'builtin.ai-chat.deepseek'
  readonly label = 'DeepSeek Chat Provider'

  async streamChat(
    request: AIChatStreamRequest,
    callbacks: AIChatStreamCallbacks,
  ): Promise<string> {
    const { config, systemPrompt, messages, signal } = request

    if (!config.enabled || !config.apiKey) {
      throw new Error('AI not configured. Set API key in settings.')
    }

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(buildRequestBody(config, systemPrompt, messages)),
      signal,
    })

    if (!response.ok) {
      const errText = await readErrorMessage(response)
      throw new Error(`API error ${response.status}: ${errText}`)
    }

    return streamSseResponse(response, callbacks)
  }

  async summarizeDocument(request: DocumentSummaryRequest): Promise<string> {
    const { config, fileName, content } = request

    if (!config.enabled || !config.apiKey) {
      return `已读取文件 ${fileName}，但当前没有启用 AI，总结暂时使用本地预览。`
    }

    const prompt = [
      '你是桌面陪伴宠物应用中的文档理解模块。',
      '请用简洁、温暖、伴随式的语气总结用户拖入的文件内容。',
      '输出必须包含：',
      '1. 一句话总结',
      '2. 3-5 条重点',
      '3. 如果是代码或技术文档，再补一条“建议接下来关注什么”',
      '',
      `文件名：${fileName}`,
      '文件内容：',
      content.slice(0, 12000),
    ].join('\n')

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: Math.min(config.temperature, 0.7),
        max_tokens: Math.min(config.maxTokens, 900),
        stream: false,
      }),
    })

    if (!response.ok) {
      const errText = await readErrorMessage(response)
      throw new Error(`Document summary failed ${response.status}: ${errText}`)
    }

    const json = await response.json()
    return (
      json.choices?.[0]?.message?.content?.trim() ||
      `已读取文件 ${fileName}，但模型没有返回有效总结。`
    )
  }

  async healthCheck(config: AIConfig): Promise<AIProviderHealthStatus> {
    if (!config.enabled) {
      return {
        ok: false,
        message: 'AI chat is disabled.',
      }
    }

    if (!config.apiKey) {
      return {
        ok: false,
        message: 'API key is missing.',
      }
    }

    return {
      ok: true,
      message: `Ready to call ${config.model}.`,
    }
  }
}
