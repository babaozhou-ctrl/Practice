import type { CompanionSnapshot, SpeechIntent } from './types'

export type SpeechSource = 'startup' | 'tap' | 'context' | 'proactive' | 'external'

export interface SpeechPolicyInput {
  source: SpeechSource
  intent: SpeechIntent
  snapshot: CompanionSnapshot
  lowDistractionMode?: boolean
  now?: number
}

export interface SpeechPolicyDecision {
  source: SpeechSource
  intent: SpeechIntent
  interrupted: boolean
}

interface ActiveSpeechState {
  source: SpeechSource
  priority: number
  messageKey: string
  startedAt: number
  endsAt: number
}

interface RecentSpeechState {
  messageKey: string
  shownAt: number
}

const SPEECH_PRIORITY: Record<SpeechSource, number> = {
  startup: 2,
  tap: 5,
  context: 3,
  proactive: 1,
  external: 4,
}

const SOURCE_COOLDOWN_MS: Record<SpeechSource, number> = {
  startup: 60_000,
  tap: 900,
  context: 24_000,
  proactive: 42_000,
  external: 4_500,
}

const GLOBAL_GAP_MS = 3_800
const REPLACE_AFTER_MS = 650
const DUPLICATE_WINDOW_MS = 90_000
const MAX_RECENT_ITEMS = 10

export class CompanionSpeechPolicy {
  private activeSpeech: ActiveSpeechState | null = null
  private lastShownAt = 0
  private lastShownBySource: Partial<Record<SpeechSource, number>> = {}
  private recentMessages: RecentSpeechState[] = []

  evaluate(input: SpeechPolicyInput): SpeechPolicyDecision | null {
    const now = input.now ?? Date.now()
    const lowDistractionMode = Boolean(input.lowDistractionMode)
    const normalizedMessage = normalizeMessage(input.intent.message)
    if (!normalizedMessage) {
      return null
    }

    const refinedMessage = refineMessage(normalizedMessage, input.snapshot, input.source)
    const refinedKey = buildMessageKey(refinedMessage)
    const priority = SPEECH_PRIORITY[input.source]
    const activeSpeech = this.resolveActiveSpeech(now)

    this.pruneRecentMessages(now)

    if (this.wasRecentlyShown(refinedKey, now)) {
      return null
    }

    const lastShownForSource = this.lastShownBySource[input.source] ?? 0
    const sourceCooldown = Math.round(
      SOURCE_COOLDOWN_MS[input.source] *
        (lowDistractionMode ? resolveLowDistractionCooldownMultiplier(input.source) : 1),
    )
    if (lastShownForSource && now - lastShownForSource < sourceCooldown) {
      return null
    }

    const globalGapMs = lowDistractionMode ? 2_600 : GLOBAL_GAP_MS
    if (!activeSpeech && this.lastShownAt && now - this.lastShownAt < globalGapMs && priority < SPEECH_PRIORITY.tap) {
      return null
    }

    if (activeSpeech) {
      if (activeSpeech.messageKey === refinedKey) {
        return null
      }

      const canInterrupt = priority > activeSpeech.priority && now - activeSpeech.startedAt >= REPLACE_AFTER_MS
      if (!canInterrupt) {
        return null
      }
    }

    const duration = refineDuration(
      refinedMessage,
      input.intent.duration,
      input.snapshot,
      input.source,
      lowDistractionMode,
    )

    this.activeSpeech = {
      source: input.source,
      priority,
      messageKey: refinedKey,
      startedAt: now,
      endsAt: now + duration,
    }
    this.lastShownAt = now
    this.lastShownBySource[input.source] = now
    this.recentMessages.unshift({ messageKey: refinedKey, shownAt: now })
    if (this.recentMessages.length > MAX_RECENT_ITEMS) {
      this.recentMessages.length = MAX_RECENT_ITEMS
    }

    return {
      source: input.source,
      interrupted: Boolean(activeSpeech),
      intent: {
        message: refinedMessage,
        duration,
      },
    }
  }

  private resolveActiveSpeech(now: number): ActiveSpeechState | null {
    if (this.activeSpeech && now >= this.activeSpeech.endsAt) {
      this.activeSpeech = null
    }
    return this.activeSpeech
  }

  private wasRecentlyShown(messageKey: string, now: number): boolean {
    return this.recentMessages.some(
      (entry) => entry.messageKey === messageKey && now - entry.shownAt < DUPLICATE_WINDOW_MS,
    )
  }

  private pruneRecentMessages(now: number) {
    this.recentMessages = this.recentMessages.filter((entry) => now - entry.shownAt < DUPLICATE_WINDOW_MS)
  }
}

function refineMessage(message: string, snapshot: CompanionSnapshot, source: SpeechSource): string {
  const maxChars = resolveMaxChars(snapshot, source)
  const preferSingleSentence =
    source === 'proactive' ||
    snapshot.mode === 'focus_guardian' ||
    snapshot.mode === 'quiet' ||
    Boolean(snapshot.workMode?.isFocusActive)

  const preferredSentence = firstSentence(message)
  if (preferSingleSentence && preferredSentence && preferredSentence.length >= 5 && preferredSentence.length <= maxChars + 8) {
    return preferredSentence
  }

  if (message.length <= maxChars) {
    return message
  }

  const cutIndex = findSoftBreak(message, maxChars)
  const shortened = message.slice(0, cutIndex).trim()
  return `${shortened}...`
}

function resolveMaxChars(snapshot: CompanionSnapshot, source: SpeechSource): number {
  if (source === 'tap') return 18
  if (snapshot.mode === 'focus_guardian' || snapshot.workMode?.isFocusActive) return 22
  if (snapshot.mode === 'quiet' || snapshot.emotion === 'sleepy') return 24
  if (source === 'proactive') return 26
  if (snapshot.activity === 'watching_video' || snapshot.activity === 'chatting') return 30
  return 28
}

function refineDuration(
  message: string,
  requestedDuration: number,
  snapshot: CompanionSnapshot,
  source: SpeechSource,
  lowDistractionMode: boolean,
): number {
  const maxDuration =
    source === 'tap'
      ? 2_200
      : source === 'proactive'
        ? snapshot.workMode?.isFocusActive
          ? 2_800
          : 3_400
        : snapshot.mode === 'focus_guardian'
          ? 2_600
          : snapshot.mode === 'quiet'
            ? 3_000
            : 3_600

  const readingDuration = 1_500 + message.length * 72
  const boundedRequested = Math.max(1_600, Math.round(requestedDuration))
  const resolvedDuration = clamp(
    Math.min(boundedRequested, maxDuration, Math.round(readingDuration)),
    1_600,
    maxDuration,
  )

  if (!lowDistractionMode) {
    return resolvedDuration
  }

  const minimumDuration = source === 'tap' ? 1_400 : 1_500
  return clamp(Math.round(resolvedDuration * 0.84), minimumDuration, Math.max(minimumDuration, maxDuration - 200))
}

function normalizeMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim()
}

function buildMessageKey(message: string): string {
  return normalizeMessage(message).replace(/[。！？，?!;；、.\s]+$/u, '').toLowerCase()
}

function firstSentence(message: string): string | null {
  const symbols = ['。', '！', '？', '!', '?']
  let cutIndex = -1

  for (const symbol of symbols) {
    const index = message.indexOf(symbol)
    if (index >= 0 && (cutIndex === -1 || index < cutIndex)) {
      cutIndex = index
    }
  }

  if (cutIndex <= 0) {
    return null
  }

  return message.slice(0, cutIndex + 1).trim()
}

function findSoftBreak(message: string, maxChars: number): number {
  const minChars = Math.max(8, Math.floor(maxChars * 0.55))
  const softSymbols = ['。', '！', '？', '、', '，', '.', ',', ';', ':', ' ']

  for (let index = Math.min(maxChars, message.length - 1); index >= minChars; index -= 1) {
    if (softSymbols.includes(message[index])) {
      return index
    }
  }

  return Math.min(maxChars, message.length)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function resolveLowDistractionCooldownMultiplier(source: SpeechSource): number {
  switch (source) {
    case 'proactive':
      return 3.1
    case 'context':
      return 2.8
    case 'external':
      return 1.35
    case 'startup':
      return 1.1
    default:
      return 1
  }
}
