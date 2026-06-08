function normalizeText(value: string): string {
  return value.replace(/\r/g, '').replace(/\s+/g, ' ').trim()
}

function meaningfulLines(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
}

function clipSentence(value: string, maxChars = 34): string {
  const normalized = normalizeText(value)
  if (normalized.length <= maxChars) {
    return normalized
  }

  const punctuation = '，。；、！？,.;!? '
  for (let index = maxChars; index >= Math.max(10, Math.floor(maxChars * 0.6)); index -= 1) {
    if (punctuation.includes(normalized[index] ?? '')) {
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

  const firstLine = meaningfulLines(normalized)[0]
  if (firstLine) {
    return clipSentence(firstLine, maxChars)
  }

  return clipSentence(normalized, maxChars)
}

export function buildCompanionBriefSummary(text: string, fallback: string, maxChars = 110): string {
  const lines = meaningfulLines(text)
  if (lines.length === 0) {
    return clipSentence(fallback, maxChars)
  }

  const stitched = lines.slice(0, 2).join(' ')
  return clipSentence(stitched, maxChars)
}

function resolveFileAnalysisLead(fileName: string, sceneId?: string | null): string {
  switch (sceneId) {
    case 'deep_focus':
    case 'steady_focus':
      return `我轻轻帮你顺过了一遍《${fileName}》`
    case 'watch_together':
      return `我先陪你一起看了看《${fileName}》`
    case 'late_night_wind_down':
      return `这么晚了，我先替你看了看《${fileName}》`
    case 'quiet_idle':
    case 'ambient_presence':
      return `我先安静帮你看了一遍《${fileName}》`
    default:
      return `我先帮你看了一遍《${fileName}》`
  }
}

export function buildFileAnalysisUtterance(
  fileName: string,
  briefSummary: string,
  sceneId?: string | null,
): string {
  const lead = summarizeForCompanionSpeech(briefSummary, `我先看了看《${fileName}》。`, 30)
  return `${resolveFileAnalysisLead(fileName, sceneId)}。${lead}`
}

export function buildChatReplyUtterance(reply: string): string {
  return summarizeForCompanionSpeech(reply, '我想好了，轻轻和你说。', 30)
}
