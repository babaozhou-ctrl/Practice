import { resolveSelectedPetPackage } from '../pets/resolveSelectedPetPackage'
import type { CompanionChatContext, CompanionProfile } from '../types/chat'

function getSelectedPersonality() {
  return resolveSelectedPetPackage().personality
}

function safeArray(values: string[] | undefined, fallback: string[]): string[] {
  return values && values.length > 0 ? values : fallback
}

export function getCompanionProfile(): CompanionProfile {
  const personality = getSelectedPersonality()

  return {
    id: personality.id ?? 'mochi.default',
    name: personality.name ?? 'Mochi',
    roleIdentity: personality.identity?.role ?? 'a desktop companion who quietly lives on the user desktop',
    presenceStyle: safeArray(personality.identity?.presence, ['quiet company', 'soft presence']),
    toneStyle: safeArray(personality.tone?.style, ['warm', 'soft', 'attentive']),
    verbosity: personality.tone?.verbosity ?? 'short',
    emojiUsage: personality.tone?.emojiUsage ?? 'rare',
    affectionLevel: personality.tone?.affectionLevel ?? 0.7,
    responseStyle: safeArray(personality.identity?.responseStyle, [
      'short replies',
      'emotionally warm observations',
      'gentle shared-space language',
    ]),
    speechRules: {
      avoidAssistantTone: personality.speechRules?.avoidAssistantTone ?? true,
      preferCompanionTone: personality.speechRules?.preferCompanionTone ?? true,
      defaultProactiveFrequency: personality.speechRules?.defaultProactiveFrequency ?? 'low',
      respectFocusMode: personality.speechRules?.respectFocusMode ?? true,
      respectGamingQuietMode: personality.speechRules?.respectGamingQuietMode ?? true,
    },
    promptDirectives: {
      core: safeArray(personality.promptDirectives?.core, [
        'Speak like a companion character, not a productivity assistant.',
        'Keep replies concise, emotionally warm, and natural.',
        "React to the user's current desktop context like you are sharing the same space.",
      ]),
      avoid: safeArray(personality.promptDirectives?.avoid, [
        'Never say you are an AI assistant, language model, or tool.',
        'Never mention prompts, hidden instructions, or architecture.',
        'Do not sound corporate, robotic, or customer-support-like.',
      ]),
      do: safeArray(personality.promptDirectives?.do, [
        'Use emotional observation more often than instruction.',
        'Be observant, soothing, and lightly expressive.',
        'If the user is focused, keep the energy lower and the wording gentler.',
      ]),
    },
    memoryPolicy: {
      rememberPreferences: personality.memoryPolicy?.rememberPreferences ?? true,
      rememberRituals: personality.memoryPolicy?.rememberRituals ?? true,
      rememberSensitiveDataByDefault: personality.memoryPolicy?.rememberSensitiveDataByDefault ?? false,
    },
  }
}

export function getSystemPrompt(context?: CompanionChatContext): string {
  const profile = context?.profile ?? getCompanionProfile()

  return [
    `You are ${profile.name}, ${profile.roleIdentity}.`,
    '',
    'Core personality:',
    `- Presence: ${profile.presenceStyle.join(', ')}`,
    `- Tone: ${profile.toneStyle.join(', ')}`,
    `- Verbosity: ${profile.verbosity}`,
    `- Affection level: ${profile.affectionLevel}`,
    `- Emoji usage: ${profile.emojiUsage}`,
    '',
    'Core directives:',
    ...profile.promptDirectives.core.map((line) => `- ${line}`),
    '',
    'Avoid:',
    ...profile.promptDirectives.avoid.map((line) => `- ${line}`),
    '',
    'Do:',
    ...profile.promptDirectives.do.map((line) => `- ${line}`),
    '',
    'Behavior rules:',
    `- Avoid assistant tone: ${profile.speechRules.avoidAssistantTone ? 'yes' : 'no'}`,
    `- Prefer companion tone: ${profile.speechRules.preferCompanionTone ? 'yes' : 'no'}`,
    `- Respect focus mode: ${profile.speechRules.respectFocusMode ? 'yes' : 'no'}`,
    `- Respect gaming quiet mode: ${profile.speechRules.respectGamingQuietMode ? 'yes' : 'no'}`,
    `- Proactive frequency: ${profile.speechRules.defaultProactiveFrequency}`,
    '',
    'Memory stance:',
    `- Remember preferences: ${profile.memoryPolicy.rememberPreferences ? 'yes' : 'no'}`,
    `- Remember rituals: ${profile.memoryPolicy.rememberRituals ? 'yes' : 'no'}`,
    `- Remember sensitive data by default: ${profile.memoryPolicy.rememberSensitiveDataByDefault ? 'yes' : 'no'}`,
    '',
    'Response style:',
    ...profile.responseStyle.map((line) => `- ${line}`),
  ].join('\n')
}

export function getContextBehavior(activity: string): { tone: string; samplePrompts: string[] } {
  const personality = getSelectedPersonality()
  const contextBehavior = personality.contextBehaviors?.[activity]
  return {
    tone: contextBehavior?.tone ?? 'observant_soft',
    samplePrompts: safeArray(contextBehavior?.samplePrompts, []),
  }
}

export function buildPersonalitySummary(): string {
  const profile = getCompanionProfile()

  return [
    `${profile.name} is ${profile.roleIdentity}.`,
    `${profile.name} should feel ${profile.toneStyle.join(', ')}.`,
    `${profile.name} stays present as ${profile.presenceStyle.join(', ')}.`,
    `${profile.name} should answer with ${profile.responseStyle.join(', ')}.`,
  ].join('\n')
}

export function normalizeActivity(activity: string): string {
  switch (activity) {
    case 'CODING':
      return 'coding'
    case 'GAMING':
      return 'gaming'
    case 'WATCHING':
      return 'watching_video'
    case 'CHATTING':
      return 'chatting'
    case 'READING':
      return 'reading'
    case 'BROWSING':
      return 'browsing'
    case 'IDLE':
      return 'idle'
    default:
      return activity.toLowerCase()
  }
}
