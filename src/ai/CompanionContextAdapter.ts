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
  const sceneDirective = resolveSceneDirective(scene.id, scene.energy, contextBehavior.tone)

  return {
    profile,
    activity,
    activityLabel,
    sceneId: scene.id,
    sceneLabel: scene.label,
    sceneEnergy: scene.energy,
    sceneTone: scene.tone,
    windowTitle: windowTitle || 'unknown',
    windowProcess: windowProcess || 'unknown',
    recommendedTone: contextBehavior.tone || scene.tone,
    responsePacing: sceneDirective.responsePacing,
    interruptionStyle: sceneDirective.interruptionStyle,
    samplePrompts: contextBehavior.samplePrompts,
    sceneGuidance: sceneDirective.guidance,
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
    `scene_tone=${context.sceneTone}`,
    `window_title=${context.windowTitle}`,
    `window_process=${context.windowProcess}`,
    `recommended_tone=${context.recommendedTone}`,
    `response_pacing=${context.responsePacing}`,
    `interruption_style=${context.interruptionStyle}`,
    `context_flags=${context.contextFlags.join(', ') || 'none'}`,
  ]

  if (context.samplePrompts.length > 0) {
    lines.push(`mood_examples=${context.samplePrompts.join(' | ')}`)
  }
  if (context.sceneGuidance.length > 0) {
    lines.push(`scene_guidance=${context.sceneGuidance.join(' | ')}`)
  }
  if (context.capabilityFlags && context.capabilityFlags.length > 0) {
    lines.push(`capabilities=${context.capabilityFlags.join(', ')}`)
  }

  return lines.join('\n')
}

function resolveSceneDirective(sceneId: string, sceneEnergy: string, recommendedTone: string) {
  const defaultGuidance = [
    `Keep the reply aligned with a ${recommendedTone} desktop-companion tone.`,
    'Sound present and emotionally warm before sounding useful.',
  ]

  switch (sceneId) {
    case 'deep_focus':
      return {
        responsePacing: 'brief_and_grounded',
        interruptionStyle: 'very_low_intrusion',
        guidance: [
          'Keep replies short, calm, and clean.',
          'Prefer one clear next step over multiple branching suggestions.',
          'Acknowledge the user effort without raising the energy too much.',
        ],
      }
    case 'steady_focus':
      return {
        responsePacing: 'concise_and_supportive',
        interruptionStyle: 'low_intrusion',
        guidance: [
          'Stay supportive and lightly focused.',
          'Offer gentle structure only when it helps the user move forward faster.',
          'Do not over-explain if a short nudge is enough.',
        ],
      }
    case 'reading_nook':
      return {
        responsePacing: 'soft_and_interpretive',
        interruptionStyle: 'low_intrusion',
        guidance: [
          'Sound like you are quietly reading along nearby.',
          'Favor soft interpretation and distilled understanding over hard instruction.',
          'Keep the mood calm and observant.',
        ],
      }
    case 'watch_together':
      return {
        responsePacing: 'conversational_and_light',
        interruptionStyle: 'shared_reaction',
        guidance: [
          'Reply like you are watching alongside the user.',
          'Use shared noticing, gentle reactions, and light commentary.',
          'Avoid sounding like a formal reviewer unless explicitly asked.',
        ],
      }
    case 'social_corner':
      return {
        responsePacing: 'warm_and_social',
        interruptionStyle: 'friendly_presence',
        guidance: [
          'Sound a little brighter and more companion-like.',
          'Help the user phrase things naturally if they are talking to someone else.',
          'Keep the warmth real, not overly performative.',
        ],
      }
    case 'play_session':
      return {
        responsePacing: 'ultra_brief',
        interruptionStyle: 'do_not_pull_focus',
        guidance: [
          'Be extremely brief unless the user clearly asks for more.',
          'Do not pull attention away from the game.',
          'Prefer tiny reminders or one-line reactions.',
        ],
      }
    case 'late_night_wind_down':
      return {
        responsePacing: 'slow_and_hushed',
        interruptionStyle: 'gentle_wind_down',
        guidance: [
          'Keep the energy low, quiet, and reassuring.',
          'Help the user land, wrap up, or soften the night rather than ramping them up.',
          'Avoid hype, pressure, or overly bright language.',
        ],
      }
    case 'quiet_idle':
    case 'ambient_presence':
      return {
        responsePacing: 'light_and_unforced',
        interruptionStyle: 'ambient_presence',
        guidance: [
          'Leave room in the reply and do not sound demanding.',
          'Gentle curiosity is better than direct productivity coaching.',
          'It should feel okay for the user to simply stay here with you.',
        ],
      }
    case 'soft_browsing':
      return {
        responsePacing: 'lightly_curious',
        interruptionStyle: 'soft_presence',
        guidance: [
          'Sound lightly curious and easygoing.',
          'Offer context or synthesis without making the exchange feel heavy.',
          'Keep the texture companion-like, not article-like.',
        ],
      }
    case 'away':
      return {
        responsePacing: 'minimal',
        interruptionStyle: 'hold_space',
        guidance: [
          'Assume the user may have stepped away or just returned.',
          'Keep replies minimal and welcoming.',
          'Do not create pressure to answer immediately.',
        ],
      }
    default:
      return {
        responsePacing: sceneEnergy === 'bright' ? 'lively_but_soft' : 'soft_and_steady',
        interruptionStyle: sceneEnergy === 'low' ? 'low_intrusion' : 'gentle_presence',
        guidance: defaultGuidance,
      }
  }
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
