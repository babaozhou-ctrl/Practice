import type { CompanionChatContext, CompanionMemorySnapshot } from '../types/chat'
import {
  getCompanionProfile,
  getContextBehavior,
  getSystemPrompt,
  normalizeActivity,
} from './Personality'
import { resolveSelectedPetCapabilities } from '../pets/resolveSelectedPetCapabilities'
import { resolveCompanionScene } from '../domain/companion/CompanionScene'
import type {
  InteractionMode,
  CompanionEmotion,
  CompanionActivity,
} from '../domain/companion/types'

export function buildCompanionChatContext(
  activity: string,
  windowTitle: string,
  windowProcess: string,
): CompanionChatContext {
  const profile = getCompanionProfile()
  const activityLabel = normalizeActivity(activity)
  const scene = resolveCompanionScene({
    activity: activityLabel as CompanionActivity,
    emotion: inferEmotionFromActivity(activityLabel),
    mode: inferModeFromActivity(activityLabel),
    activeWindow: {
      title: windowTitle || '',
      process: windowProcess || '',
      idleMs: 0,
    },
  })
  const contextBehavior = resolveContextBehavior(activityLabel, scene.tone)

  return {
    profile,
    activity,
    activityLabel,
    sceneId: scene.id,
    sceneLabel: scene.label,
    sceneEnergy: scene.energy,
    windowTitle: windowTitle || 'unknown',
    windowProcess: windowProcess || 'unknown',
    recommendedTone: contextBehavior.tone || scene.tone,
    samplePrompts: contextBehavior.samplePrompts,
    contextFlags: buildContextFlags(activityLabel, scene.id, profile.speechRules),
    capabilityFlags: Object.entries(resolveSelectedPetCapabilities())
      .filter(([, enabled]) => enabled)
      .map(([name]) => name),
  }
}

function resolveContextBehavior(activityLabel: string, fallbackTone: string) {
  const hour = new Date().getHours()
  const isLateNight = hour >= 23 || hour < 6
  if (isLateNight) {
    const lateNightBehavior = getContextBehavior('late_night')
    if (lateNightBehavior.samplePrompts.length > 0 || lateNightBehavior.tone !== 'observant_soft') {
      return lateNightBehavior
    }
  }

  const direct = getContextBehavior(activityLabel)
  if (direct.samplePrompts.length > 0 || direct.tone !== 'observant_soft') {
    return direct
  }

  return {
    ...direct,
    tone: fallbackTone,
  }
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
    `scene=${context.sceneId}`,
    `scene_label=${context.sceneLabel}`,
    `scene_energy=${context.sceneEnergy}`,
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
  if (memory.lastScene) {
    lines.push(`last_scene=${memory.lastScene}`)
  }
  if (memory.lastWindowTitle) {
    lines.push(`last_window_title=${memory.lastWindowTitle}`)
  }

  return lines.join('\n')
}

function buildContextFlags(
  activity: string,
  sceneId: string,
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
  if (sceneId === 'deep_focus') {
    flags.push('deep_focus')
  }
  if (sceneId === 'late_night_wind_down') {
    flags.push('wind_down')
  }
  if (sceneId === 'social_corner') {
    flags.push('companion_social')
  }
  if (sceneId === 'quiet_idle' || sceneId === 'ambient_presence') {
    flags.push('ambient_presence')
  }

  const hour = new Date().getHours()
  if (hour >= 23 || hour < 6) {
    flags.push('late_night')
  }

  return flags
}

function inferEmotionFromActivity(activityLabel: string): CompanionEmotion {
  switch (activityLabel) {
    case 'coding':
    case 'reading':
    case 'watching_video':
      return 'thinking'
    case 'chatting':
      return 'happy'
    case 'gaming':
      return 'excited'
    case 'idle':
      return 'sleepy'
    default:
      return 'idle'
  }
}

function inferModeFromActivity(activityLabel: string): InteractionMode {
  switch (activityLabel) {
    case 'coding':
    case 'reading':
      return 'focus_guardian'
    case 'watching_video':
    case 'chatting':
      return 'reactive'
    case 'gaming':
      return 'quiet'
    case 'idle':
      return 'observing'
    default:
      return 'observing'
  }
}
