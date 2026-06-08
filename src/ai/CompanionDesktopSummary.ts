function normalizeText(value: string): string {
  return value.replace(/\r/g, '').replace(/\s+/g, ' ').trim()
}

function firstMeaningfulLine(content: string): string | null {
  const candidates = content
    .split('\n')
    .map((line) => line.replace(/^[-*•\d.\s]+/, '').trim())
    .filter(Boolean)

  return candidates[0] ?? null
}

function clipSentence(value: string, maxChars = 34): string {
  const normalized = normalizeText(value)
  if (normalized.length <= maxChars) {
    return normalized
  }

  for (let index = maxChars; index >= Math.max(10, Math.floor(maxChars * 0.6)); index -= 1) {
    if ('，。；、,.!?！？ '.includes(normalized[index] ?? '')) {
      return `${normalized.slice(0, index).trim()}...`
    }
  }

  return `${normalized.slice(0, maxChars).trim()}...`
}

export function summarizeForCompanionSpeech(text: string, fallback: string, maxChars = 34): string {
  const normalized = normalizeText(text)
  if (!normalized) {
    return clipSentence(fallback, maxChars)
  }

  const directSentence = firstMeaningfulLine(normalized)
  if (directSentence) {
    return clipSentence(directSentence, maxChars)
  }

  return clipSentence(normalized, maxChars)
}

export function buildFileAnalysisUtterance(fileName: string, summary: string): string {
  const lead = summarizeForCompanionSpeech(summary, `我先看了看《${fileName}》`, 30)
  return `我先帮你看了一遍《${fileName}》。${lead}`
}

export function buildChatReplyUtterance(reply: string): string {
  return summarizeForCompanionSpeech(reply, '我想好了，轻轻和你说。', 30)
}
