import type { CompanionChatContext, CompanionMemorySnapshot } from '../types/chat'
import {
  getCompanionProfile,
  getContextBehavior,
  getSystemPrompt,
  normalizeActivity,
} from './Personality'
import { resolveSelectedPetCapabilities } from '../pets/resolveSelectedPetCapabilities'

export function buildCompanionChatContext(
  activity: string,
  windowTitle: string,
  windowProcess: string,
): CompanionChatContext {
  const profile = getCompanionProfile()
  const activityLabel = normalizeActivity(activity)
  const contextBehavior = resolveContextBehavior(activityLabel)

  return {
    profile,
    activity,
    activityLabel,
    windowTitle: windowTitle || 'unknown',
    windowProcess: windowProcess || 'unknown',
    recommendedTone: contextBehavior.tone,
    samplePrompts: contextBehavior.samplePrompts,
    contextFlags: buildContextFlags(activityLabel, profile.speechRules),
    capabilityFlags: Object.entries(resolveSelectedPetCapabilities())
      .filter(([, enabled]) => enabled)
      .map(([name]) => name),
  }
}

function resolveContextBehavior(activityLabel: string) {
  const hour = new Date().getHours()
  const isLateNight = hour >= 23 || hour < 6
  if (isLateNight) {
    const lateNightBehavior = getContextBehavior('late_night')
    if (lateNightBehavior.samplePrompts.length > 0 || lateNightBehavior.tone !== 'observant_soft') {
      return lateNightBehavior
    }
  }

  return getContextBehavior(activityLabel)
}

export function buildCompanionPrompt(
  context: CompanionChatContext,
  memory?: CompanionMemorySnapshot,
): string {
  const sections = [getSystemPrompt(context), renderCompanionContextBlock(context)]

  if (memory) {
    sections.push(renderCompanionMemoryBlock(memory))
  }

  return sections.join('\n\n')
}

export function renderCompanionContextBlock(context: CompanionChatContext): string {
  const lines = [
    '[Desktop companion context]',
    `activity=${context.activityLabel}`,
    `window_title=${context.windowTitle}`,
    `window_process=${context.windowProcess}`,
    `recommended_tone=${context.recommendedTone}`,
    `context_flags=${context.contextFlags.join(', ') || 'none'}`,
  ]

  if (context.samplePrompts.length > 0) {
    lines.push(`mood_examples=${context.samplePrompts.join(' | ')}`)
  }
  if (context.capabilityFlags && context.capabilityFlags.length > 0) {
    lines.push(`capabilities=${context.capabilityFlags.join(', ')}`)
  }

  return lines.join('\n')
}

export function renderCompanionMemoryBlock(memory: CompanionMemorySnapshot): string {
  const lines = ['[Companion memory]']

  if (memory.preferredName) {
    lines.push(`preferred_name=${memory.preferredName}`)
  }
  if (memory.preferences.length > 0) {
    lines.push(`preferences=${memory.preferences.join(' | ')}`)
  }
  if (memory.avoidances.length > 0) {
    lines.push(`avoidances=${memory.avoidances.join(' | ')}`)
  }
  if (memory.rituals.length > 0) {
    lines.push(`rituals=${memory.rituals.join(' | ')}`)
  }
  if (memory.recentTopics.length > 0) {
    lines.push(`recent_topics=${memory.recentTopics.join(' | ')}`)
  }
  if (memory.lastActivity) {
    lines.push(`last_activity=${memory.lastActivity}`)
  }
  if (memory.lastWindowTitle) {
    lines.push(`last_window_title=${memory.lastWindowTitle}`)
  }

  return lines.join('\n')
}

function buildContextFlags(
  activity: string,
  speechRules: CompanionChatContext['profile']['speechRules'],
): string[] {
  const flags: string[] = []

  if (activity === 'coding' && speechRules.respectFocusMode) {
    flags.push('focus_mode')
  }
  if (activity === 'gaming' && speechRules.respectGamingQuietMode) {
    flags.push('gaming_quiet_mode')
  }
  if (activity === 'watching_video') {
    flags.push('watch_together')
  }
  if (activity === 'chatting') {
    flags.push('social_warmth')
  }
  if (activity === 'idle') {
    flags.push('low_intrusion')
  }

  const hour = new Date().getHours()
  if (hour >= 23 || hour < 6) {
    flags.push('late_night')
  }

  return flags
}
