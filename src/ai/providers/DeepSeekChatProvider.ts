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
    throw new Error('对话服务没有返回可读取的内容。')
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
    return '未知服务错误'
  }
}

function normalizeEndpoint(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function buildHealthCheckBody(config: AIConfig) {
  return {
    model: config.model,
    messages: [{ role: 'user', content: 'ping' }],
    temperature: 0,
    max_tokens: 1,
    stream: false,
  }
}

export class DeepSeekChatProvider implements AIChatProvider {
  readonly id = 'builtin.ai-chat.deepseek'
  readonly label = 'DeepSeek 对话'

  async streamChat(
    request: AIChatStreamRequest,
    callbacks: AIChatStreamCallbacks,
  ): Promise<string> {
    const { config, systemPrompt, messages, signal } = request

    if (!config.enabled || !config.apiKey) {
      throw new Error('还没有完成 AI 对话配置，请先在设置里填好 API Key。')
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
      throw new Error(`对话服务请求失败（${response.status}）：${errText}`)
    }

    return streamSseResponse(response, callbacks)
  }

  async summarizeDocument(request: DocumentSummaryRequest): Promise<string> {
    const { config, fileName, content } = request

    if (!config.enabled || !config.apiKey) {
      return `已经读完《${fileName}》，但当前没有启用 AI，总结先使用本地预览结果。`
    }

    const prompt = [
      '你是桌面陪伴宠物应用里的文档理解模块。',
      '请用自然、温和、有陪伴感的中文，帮用户整理刚刚“投喂”给 companion 的文件内容。',
      '不要写成客服口吻、报告体，避免模板化 AI 腔，也不要过分热情。',
      '输出尽量包含以下三部分：',
      '1. 一句话总览',
      '2. 3 到 5 条值得注意的重点',
      '3. 如果是代码、技术文档或工作材料，再补一小段“接下来最值得看什么”',
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
      throw new Error(`文件总结请求失败（${response.status}）：${errText}`)
    }

    const json = await response.json()
    return json.choices?.[0]?.message?.content?.trim() || `已经读完《${fileName}》，但模型没有返回有效总结。`
  }

  async healthCheck(config: AIConfig): Promise<AIProviderHealthStatus> {
    if (!config.enabled) {
      return {
        ok: false,
        message: 'AI 对话还没有开启。',
      }
    }

    if (!config.apiKey) {
      return {
        ok: false,
        message: '还没有填写 API Key。',
      }
    }

    const endpoint = normalizeEndpoint(config.endpoint)
    if (!endpoint) {
      return {
        ok: false,
        message: '还没有填写可用的接口地址。',
      }
    }

    try {
      const controller = new AbortController()
      const timeoutId = globalThis.setTimeout(() => {
        controller.abort()
      }, 6_000)

      let response: Response
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(buildHealthCheckBody(config)),
          signal: controller.signal,
        })
      } finally {
        globalThis.clearTimeout(timeoutId)
      }

      if (!response.ok) {
        const errText = await readErrorMessage(response)
        return {
          ok: false,
          message: `接口可达，但请求未通过（${response.status}）。${errText}`,
        }
      }

      const json = await response.json().catch(() => null)
      const content = json?.choices?.[0]?.message?.content

      return {
        ok: true,
        message: content
          ? `接口已连通，${config.model} 可以正常返回内容。`
          : `接口已连通，${config.model} 已返回响应。`,
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return {
          ok: false,
          message: '接口检查超时了，可能是网络慢，或者当前 endpoint 无响应。',
        }
      }

      return {
        ok: false,
        message: `接口检查失败：${error?.message ?? '无法连接到聊天服务。'}`,
      }
    }
  }
}
