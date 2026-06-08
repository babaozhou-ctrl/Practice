function buildChatReply(systemPrompt, messages) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  const promptTone = systemPrompt.includes('陪伴') ? '我会更像陪伴角色地回应你。' : '我会尽量自然一点回应你。'
  const userLine = lastUserMessage?.content?.trim() || '我在这里陪着你。'

  return [
    '我在。',
    promptTone,
    `你刚刚提到的是：${userLine}`,
    '如果你想继续往下聊，我可以顺着这个思路陪你拆开讲，不会一下子变成很硬的工具口吻。',
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
          bullets.length > 0
            ? '先看这几处：'
            : '当前内容比较短，可以直接继续细看原文。',
          ...bullets,
          '如果你愿意，我更适合继续帮你做“快速提炼重点”这一类轻量陪读。',
        ].join('\n')
      },
    },
  },
}

module.exports = {
  providers,
}
