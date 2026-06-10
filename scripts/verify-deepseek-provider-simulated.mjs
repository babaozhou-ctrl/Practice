import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

function loadDeepSeekProvider() {
  const sourcePath = resolve('src/ai/providers/DeepSeekChatProvider.ts')
  const source = readFileSync(sourcePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
    fileName: sourcePath,
  }).outputText

  const module = { exports: {} }
  const context = {
    module,
    exports: module.exports,
    AbortController,
    TextDecoder,
    fetch: (...args) => globalThis.fetch(...args),
    console,
    setTimeout,
    clearTimeout,
  }

  vm.createContext(context)
  new vm.Script(transpiled, { filename: sourcePath }).runInContext(context)
  return context.module.exports.DeepSeekChatProvider
}

function createJsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: null,
    async text() {
      return JSON.stringify(body)
    },
    async json() {
      return body
    },
  }
}

function createStreamResponse(chunks, status = 200) {
  const encoder = new TextEncoder()
  let index = 0

  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) {
              return { done: true, value: undefined }
            }

            const value = encoder.encode(chunks[index])
            index += 1
            return { done: false, value }
          },
        }
      },
    },
    async text() {
      return chunks.join('')
    },
    async json() {
      return {}
    },
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const DeepSeekChatProvider = loadDeepSeekProvider()
const provider = new DeepSeekChatProvider()

const baseConfig = {
  endpoint: 'https://unit.test/v1/chat/completions',
  apiKey: 'test-key',
  model: 'deepseek-chat',
  temperature: 0.6,
  maxTokens: 256,
  enabled: true,
}

const originalFetch = globalThis.fetch

try {
  {
    const streamedChunks = []
    globalThis.fetch = async () =>
      createStreamResponse([
        'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"，现在状态正常。"}}]}\n\n',
        'data: [DONE]\n\n',
      ])

    const result = await provider.streamChat(
      {
        config: baseConfig,
        systemPrompt: 'stay warm',
        messages: [{ role: 'user', content: 'ping' }],
      },
      {
        onChunk(chunk) {
          streamedChunks.push(chunk)
        },
      },
    )

    assert(result === '你好，现在状态正常。', 'streamChat should merge streamed chunks')
    assert(streamedChunks.join('') === result, 'streamChat should forward chunks to callback')
  }

  {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body)
      assert(body.stream === false, 'summarizeDocument should use non-stream mode')
      assert(body.messages[0].content.includes('文件名：notes.txt'), 'summarizeDocument should include file name in prompt')
      return createJsonResponse({
        choices: [{ message: { content: '一句话总览\n- 重点一\n- 重点二' } }],
      })
    }

    const result = await provider.summarizeDocument({
      config: baseConfig,
      fileName: 'notes.txt',
      content: 'hello world',
    })

    assert(result.includes('一句话总览'), 'summarizeDocument should return model content')
  }

  {
    let requestCount = 0
    globalThis.fetch = async (_url, options) => {
      requestCount += 1
      const body = JSON.parse(options.body)
      assert(body.messages[0].content === 'ping', 'healthCheck should send a lightweight ping message')
      return createJsonResponse({
        choices: [{ message: { content: 'pong' } }],
      })
    }

    const result = await provider.healthCheck(baseConfig)
    assert(result.ok === true, 'healthCheck should report ok on successful response')
    assert(result.message.includes('可以正常返回内容'), 'healthCheck should surface a ready message')
    assert(requestCount === 1, 'healthCheck should perform exactly one request')
  }

  {
    globalThis.fetch = async () => createJsonResponse({ error: 'bad key' }, 401)
    const result = await provider.healthCheck(baseConfig)
    assert(result.ok === false, 'healthCheck should fail on unauthorized response')
    assert(result.message.includes('401'), 'healthCheck should include failing status code')
  }

  {
    const result = await provider.healthCheck({
      ...baseConfig,
      endpoint: '   ',
    })
    assert(result.ok === false, 'healthCheck should fail on empty endpoint')
    assert(result.message.includes('接口地址'), 'healthCheck should mention missing endpoint')
  }

  console.log('[deep-pet] deepseek provider simulated checks verified')
} finally {
  globalThis.fetch = originalFetch
}
