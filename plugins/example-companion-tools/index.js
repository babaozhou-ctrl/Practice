const providers = {
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
