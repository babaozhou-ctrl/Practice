function buildChatReply(systemPrompt, messages) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  const promptTone = systemPrompt.includes('companion')
    ? '我会更像陪伴角色一样接住你。'
    : '我会尽量自然一点回应你。'
  const userLine = lastUserMessage?.content?.trim() || '我在这里陪着你。'

  return [
    '我在。',
    promptTone,
    `你刚刚提到的是：${userLine}`,
    '如果你想继续往下聊，我可以顺着这个思路陪你慢慢拆开，不会一下子变成很硬的工具口吻。',
  ].join('\n')
}

const providers = {
  aiChat: {
    'cozy-chat': {
      async streamChat(context, tools) {
        const reply = buildChatReply(context.systemPrompt, context.messages)
        const chunks = reply.match(/.{1,18}/g) || [reply]

        for (const chunk of chunks) {
          tools.emitChunk(chunk)
          await new Promise((resolve) => setTimeout(resolve, 8))
        }

        return reply
      },
      summarizeDocument(fileName, content, context) {
        const lines = content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
        const preview = lines.slice(0, 4).map((line) => `- ${line.slice(0, 72)}`)

        return [
          `这是 ${context.pluginName} 给《${fileName}》准备的轻量陪读总结。`,
          lines.length > 0
            ? `我先看到 ${lines.length} 行内容。`
            : '这个文件内容很短，我先按轻量方式陪你看。',
          preview.length > 0 ? '先抓这几处：' : '目前没有明显可展开的段落。',
          ...preview,
          '如果你愿意，我可以继续把它顺成更像聊天的讲法。',
        ].join('\n')
      },
      healthCheck(config) {
        if (!config.enabled) {
          return {
            ok: false,
            message: '因为 AI 对话还没开启，所以这个示例插件也先安静待命。',
          }
        }

        return {
          ok: true,
          message: '示例温柔对话已经在插件运行时里待命了。',
        }
      },
    },
  },
  fileAnalysis: {
    'notes-file-analyzer': {
      summarize(content, context) {
        const lines = content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)

        const preview = lines.slice(0, 5)
        const bullets = preview.map((line) => `- ${line.slice(0, 72)}`)
        const wordCount = content.split(/\s+/).filter(Boolean).length

        return [
          `这是来自 ${context.pluginName} 的陪读摘要。`,
          `文件：${context.fileName}`,
          `大约 ${lines.length} 行，约 ${wordCount} 个词。`,
          bullets.length > 0 ? '先看这几处：' : '当前内容比较短，可以直接继续细看原文。',
          ...bullets,
          '如果你愿意，我更适合继续帮你做“快速提炼重点”这类轻量陪读。',
        ].join('\n')
      },
    },
  },
  screenPerception: {
    'soft-screen-observer': {
      async captureScreenshot() {
        return null
      },
      async analyzeWithOCR(imageData) {
        return imageData
          ? '屏幕 OCR 插件示例：当前拿到了截图数据，但还没有接入真正的 OCR 引擎。'
          : '屏幕 OCR 插件示例：当前没有可分析的截图。'
      },
      async analyzeWithLocalVision(imageData) {
        return imageData
          ? '本地视觉插件示例：已经拿到截图输入，后续可以在这里挂接本地模型。'
          : '本地视觉插件示例：当前没有截图输入。'
      },
      async analyzeWithCloudVision(imageData) {
        return imageData
          ? '云端视觉插件示例：已经拿到截图输入，后续可以在这里挂接远程视觉服务。'
          : '云端视觉插件示例：当前没有截图输入。'
      },
    },
  },
}

module.exports = {
  providers,
}
