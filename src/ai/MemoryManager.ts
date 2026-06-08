import type { ChatMessage, CompanionChatContext, CompanionMemorySnapshot } from '../types/chat'
import { EMPTY_COMPANION_MEMORY, cloneCompanionMemory, readCompanionMemory, writeCompanionMemory } from './CompanionMemoryStore'

const MAX_MEMORY_TOKENS = 4000

export class MemoryManager {
  private messages: ChatMessage[] = []
  private maxTokens: number
  private companionMemory: CompanionMemorySnapshot

  constructor(maxTokens = MAX_MEMORY_TOKENS) {
    this.maxTokens = maxTokens
    this.companionMemory = readCompanionMemory()
  }

  add(message: ChatMessage) {
    this.messages.push(message)
    this.prune()
  }

  syncTranscript(messages: ChatMessage[]) {
    this.messages = [...messages]
    this.prune()
    this.companionMemory = readCompanionMemory()
  }

  getMessages(): ChatMessage[] {
    return [...this.messages]
  }

  clear() {
    this.messages = []
  }

  clearCompanionMemory() {
    this.companionMemory = writeCompanionMemory(cloneCompanionMemory(EMPTY_COMPANION_MEMORY))
  }

  getCompanionMemory(): CompanionMemorySnapshot {
    this.companionMemory = readCompanionMemory()
    return cloneCompanionMemory(this.companionMemory)
  }

  rememberFromUserMessage(content: string, context: CompanionChatContext) {
    const text = content.trim()
    if (!text) return

    this.companionMemory = readCompanionMemory()
    const next = cloneCompanionMemory(this.companionMemory)

    const policy = context.profile.memoryPolicy
    if (!policy.rememberSensitiveDataByDefault && containsSensitiveInfo(text)) {
      this.captureContext(context, next)
      this.companionMemory = writeCompanionMemory(next)
      return
    }

    const preferredName = extractPreferredName(text)
    if (preferredName) {
      next.preferredName = preferredName
    }

    if (policy.rememberPreferences) {
      for (const preference of extractPreferencePhrases(text)) {
        pushUnique(next.preferences, preference, 6)
      }
      for (const avoidance of extractAvoidancePhrases(text)) {
        pushUnique(next.avoidances, avoidance, 6)
      }
    }

    if (policy.rememberRituals) {
      for (const ritual of extractRitualPhrases(text)) {
        pushUnique(next.rituals, ritual, 6)
      }
    }

    this.captureContext(context, next)
    this.companionMemory = writeCompanionMemory(next)
  }

  captureContext(context: CompanionChatContext, target?: CompanionMemorySnapshot) {
    const next = target ?? cloneCompanionMemory(readCompanionMemory())
    next.lastActivity = context.activityLabel
    next.lastScene = context.sceneId
    next.lastWindowTitle = sanitizeWindowTitle(context.windowTitle)

    const topic = buildRecentTopic(context)
    if (topic) {
      pushUnique(next.recentTopics, topic, 6)
    }

    next.updatedAt = Date.now()

    if (!target) {
      this.companionMemory = writeCompanionMemory(next)
    }
  }

  estimateTokens(message: ChatMessage): number {
    return Math.ceil(message.content.length / 4)
  }

  private prune() {
    let total = 0
    for (const msg of this.messages) {
      total += this.estimateTokens(msg)
    }

    while (total > this.maxTokens && this.messages.length > 1) {
      const removed = this.messages.shift()
      if (removed) {
        total -= this.estimateTokens(removed)
      }
    }
  }
}

function pushUnique(items: string[], value: string, max: number) {
  const normalized = value.trim()
  if (!normalized) return

  const index = items.findIndex((item) => item === normalized)
  if (index >= 0) {
    items.splice(index, 1)
  }

  items.unshift(normalized)
  if (items.length > max) {
    items.length = max
  }
}

function extractPreferredName(text: string): string | null {
  const patterns = [
    /(?:叫我|可以叫我|你可以叫我|以后叫我)\s*([^\s，。！？、,.!?\n]{1,12})/u,
    /(?:我的名字是|我叫)\s*([^\s，。！？、,.!?\n]{1,12})/u,
    /call me\s+([a-zA-Z0-9_-]{1,16})/i,
    /my name is\s+([a-zA-Z0-9_-]{1,16})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    const value = match?.[1]?.trim()
    if (value) {
      return value
    }
  }

  return null
}

function extractPreferencePhrases(text: string): string[] {
  const results = extractPhrases(text, [
    /(?:我喜欢|我很喜欢|最喜欢)([^，。！？、,.!?\n]{1,20})/gu,
    /我对([^，。！？、,.!?\n]{1,20})很感兴趣/gu,
    /I like\s+([^,.!?\n]{1,20})/gi,
    /I love\s+([^,.!?\n]{1,20})/gi,
  ])

  return results.map((value) => `喜欢${value}`)
}

function extractAvoidancePhrases(text: string): string[] {
  const results = extractPhrases(text, [
    /(?:我不喜欢|我讨厌)([^，。！？、,.!?\n]{1,20})/gu,
    /我受不了([^，。！？、,.!?\n]{1,20})/gu,
    /I don't like\s+([^,.!?\n]{1,20})/gi,
    /I hate\s+([^,.!?\n]{1,20})/gi,
  ])

  return results.map((value) => `不喜欢${value}`)
}

function extractRitualPhrases(text: string): string[] {
  return extractPhrases(text, [
    /(?:我一般会|我通常|我习惯|我经常)([^，。！？、,.!?\n]{1,24})/gu,
    /(?:我每天)([^，。！？、,.!?\n]{1,24})/gu,
    /I usually\s+([^,.!?\n]{1,24})/gi,
    /I often\s+([^,.!?\n]{1,24})/gi,
  ])
}

function extractPhrases(text: string, patterns: RegExp[]): string[] {
  const results: string[] = []
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1]?.trim()
      if (value) {
        results.push(value)
      }
    }
  }
  return results
}

function containsSensitiveInfo(text: string): boolean {
  return (
    /sk-[A-Za-z0-9_-]{10,}/.test(text) ||
    /api[_\s-]*key/i.test(text) ||
    /password|passwd|token|secret/i.test(text) ||
    /\b\d{11,}\b/.test(text) ||
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)
  )
}

function sanitizeWindowTitle(windowTitle: string): string | null {
  const trimmed = windowTitle.trim()
  if (!trimmed || trimmed === 'unknown') return null
  return trimmed.slice(0, 80)
}

function buildRecentTopic(context: CompanionChatContext): string | null {
  const activityLabels: Record<string, string> = {
    coding: '最近在写代码',
    gaming: '最近在打游戏',
    watching_video: '最近在看视频',
    chatting: '最近在聊天',
    browsing: '最近在浏览内容',
    reading: '最近在阅读',
    idle: '最近在安静待着',
  }

  const base = activityLabels[context.activityLabel]
  if (!base) return null

  const sceneLabel = context.sceneLabel && context.sceneLabel !== 'unknown' ? context.sceneLabel : null
  const screenSummary = context.screenSummary?.trim() || null

  if (screenSummary) {
    return sceneLabel
      ? `${base}（${sceneLabel}）：${screenSummary.slice(0, 24)}`
      : `${base}：${screenSummary.slice(0, 24)}`
  }

  if (context.windowTitle && context.windowTitle !== 'unknown') {
    return sceneLabel
      ? `${base}（${sceneLabel}）：${context.windowTitle.slice(0, 20)}`
      : `${base}：${context.windowTitle.slice(0, 24)}`
  }

  return sceneLabel ? `${base}（${sceneLabel}）` : base
}
