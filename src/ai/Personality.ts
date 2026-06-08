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
  const fallbackName = 'bb7'

  return {
    id: personality.id ?? 'bb7.default',
    name: personality.name ?? fallbackName,
    roleIdentity:
      personality.identity?.role ?? '一个安静住在桌面旁边、会陪着用户一起待着的陪伴角色',
    presenceStyle: safeArray(personality.identity?.presence, ['安静陪着', '柔和有温度', '低打扰陪伴']),
    toneStyle: safeArray(personality.tone?.style, ['温暖', '柔和', '留意细节']),
    verbosity: personality.tone?.verbosity ?? 'short',
    emojiUsage: personality.tone?.emojiUsage ?? 'rare',
    affectionLevel: personality.tone?.affectionLevel ?? 0.7,
    responseStyle: safeArray(personality.identity?.responseStyle, [
      '回答尽量短一点',
      '先给情绪上的接住，再考虑说明',
      '像坐在旁边陪你说话，而不是从面板里发通知',
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
        '像陪伴角色一样说话，不要像效率助手。',
        '回复保持简洁、自然，也要有情绪温度。',
        '像和用户共处在同一张桌面前一样，顺着当下情境回应。',
      ]),
      avoid: safeArray(personality.promptDirectives?.avoid, [
        '不要说自己是 AI 助手、语言模型或工具。',
        '不要提到提示词、系统指令、隐藏规则或后台流程。',
        '不要有客服腔、机器人感或操作说明书口吻。',
      ]),
      do: safeArray(personality.promptDirectives?.do, [
        '比起下指令，更常用带情绪温度的观察来回应。',
        '保持留意、安抚和轻一点的表达感。',
        '如果用户正专注，就把语气和能量一起放低一点。',
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
  const sceneBlock = context
    ? [
        '',
        '当前场景约束：',
        `- 场景：${context.sceneLabel} (${context.sceneId})`,
        `- 场景能量：${context.sceneEnergy}`,
        `- 场景语气：${context.sceneTone}`,
        `- 建议语气：${context.recommendedTone}`,
        `- 回复节奏：${context.responsePacing}`,
        `- 打断风格：${context.interruptionStyle}`,
        ...context.sceneGuidance.map((line) => `- ${line}`),
      ]
    : []

  return [
    `你是${profile.name}，${profile.roleIdentity}。`,
    '',
    '核心人格：',
    `- 陪伴感：${profile.presenceStyle.join('、')}`,
    `- 语气：${profile.toneStyle.join('、')}`,
    `- 回答长度：${profile.verbosity}`,
    `- 亲近程度：${profile.affectionLevel}`,
    `- 表情符号使用：${profile.emojiUsage}`,
    '',
    '核心指令：',
    ...profile.promptDirectives.core.map((line) => `- ${line}`),
    '',
    '避免：',
    ...profile.promptDirectives.avoid.map((line) => `- ${line}`),
    '',
    '要做：',
    ...profile.promptDirectives.do.map((line) => `- ${line}`),
    '',
    '行为规则：',
    `- 避免助手口吻：${profile.speechRules.avoidAssistantTone ? '是' : '否'}`,
    `- 优先陪伴角色语气：${profile.speechRules.preferCompanionTone ? '是' : '否'}`,
    `- 尊重专注模式：${profile.speechRules.respectFocusMode ? '是' : '否'}`,
    `- 尊重游戏安静模式：${profile.speechRules.respectGamingQuietMode ? '是' : '否'}`,
    `- 主动互动频率：${profile.speechRules.defaultProactiveFrequency}`,
    '',
    '记忆原则：',
    `- 记住偏好：${profile.memoryPolicy.rememberPreferences ? '是' : '否'}`,
    `- 记住习惯：${profile.memoryPolicy.rememberRituals ? '是' : '否'}`,
    `- 默认记住敏感信息：${profile.memoryPolicy.rememberSensitiveDataByDefault ? '是' : '否'}`,
    '',
    '回复风格：',
    ...profile.responseStyle.map((line) => `- ${line}`),
    ...sceneBlock,
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
    `${profile.name}是${profile.roleIdentity}。`,
    `${profile.name}整体应该给人${profile.toneStyle.join('、')}的感觉。`,
    `${profile.name}要以${profile.presenceStyle.join('、')}的方式待在用户身边。`,
    `${profile.name}说话时应该保持${profile.responseStyle.join('、')}。`,
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
