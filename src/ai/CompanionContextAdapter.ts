import type { CompanionChatContext, CompanionMemorySnapshot } from '../types/chat'
import {
  getCompanionProfile,
  getContextBehavior,
  getSystemPrompt,
  normalizeActivity,
} from './Personality'
import { resolveSelectedPetCapabilities } from '../pets/resolveSelectedPetCapabilities'
import { resolveCompanionScene } from '../domain/companion/CompanionScene'
import { inferScreenContextSignals } from '../domain/companion/ScreenPerceptionSemantics'
import type {
  InteractionMode,
  CompanionEmotion,
  CompanionActivity,
} from '../domain/companion/types'

export function buildCompanionChatContext(
  activity: string,
  windowTitle: string,
  windowProcess: string,
  screenSummary?: string | null,
  screenSource?: CompanionChatContext['screenSource'],
  runtimeWindowInfo?: { mediaPlaying?: boolean; mediaTitle?: string; mediaArtist?: string; mediaSource?: string } | null,
): CompanionChatContext {
  const profile = getCompanionProfile()
  const activityLabel = normalizeActivity(activity)
  const cleanedScreenSummary = screenSummary?.trim() || null
  const screenContext = inferScreenContextSignals(
    cleanedScreenSummary
      ? {
          summary: cleanedScreenSummary,
          source: screenSource ?? 'capture_only',
          providerId: 'context-adapter',
          imageAvailable: true,
          updatedAt: Date.now(),
          windowTitle: windowTitle || '',
          windowProcess: windowProcess || '',
        }
      : null,
  )
  const scene = resolveCompanionScene({
    activity: activityLabel as CompanionActivity,
    emotion: inferEmotionFromActivity(activityLabel),
    mode: inferModeFromActivity(activityLabel),
    activeWindow: {
      title: windowTitle || '',
      process: windowProcess || '',
      idleMs: 0,
      mediaPlaying: runtimeWindowInfo?.mediaPlaying,
      mediaTitle: runtimeWindowInfo?.mediaTitle,
      mediaArtist: runtimeWindowInfo?.mediaArtist,
      mediaSource: runtimeWindowInfo?.mediaSource,
    },
    screenContext,
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
    contextFlags: buildContextFlags(activityLabel, scene.id, profile.speechRules, scene.flags),
    capabilityFlags: Object.entries(resolveSelectedPetCapabilities())
      .filter(([, enabled]) => enabled)
      .map(([name]) => name),
    sharedAttention: resolveSharedAttention(scene.id, cleanedScreenSummary, windowTitle, windowProcess),
    sceneIntent: sceneDirective.sceneIntent,
    emotionalAim: sceneDirective.emotionalAim,
    replyPriorities: sceneDirective.replyPriorities,
    avoidReplyPatterns: sceneDirective.avoidReplyPatterns,
    screenSummary: cleanedScreenSummary,
    screenSource: screenSource ?? null,
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
    sections.push(renderCompanionMemoryBlock(memory, context))
  }

  sections.push(renderCompanionResponseContract(context, memory))

  return sections.join('\n\n')
}

export function renderCompanionContextBlock(context: CompanionChatContext): string {
  const lines = [
    '[桌面陪伴上下文]',
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

  if (context.sharedAttention) {
    lines.push(`shared_attention=${context.sharedAttention}`)
  }
  if (context.sceneIntent) {
    lines.push(`scene_intent=${context.sceneIntent}`)
  }
  if (context.emotionalAim) {
    lines.push(`emotional_aim=${context.emotionalAim}`)
  }
  if (context.screenSource) {
    lines.push(`screen_source=${context.screenSource}`)
  }
  if (context.screenSummary) {
    lines.push(`screen_summary=${context.screenSummary}`)
  }
  if (context.samplePrompts.length > 0) {
    lines.push(`mood_examples=${context.samplePrompts.join(' | ')}`)
  }
  if (context.sceneGuidance.length > 0) {
    lines.push(`scene_guidance=${context.sceneGuidance.join(' | ')}`)
  }
  if (context.replyPriorities && context.replyPriorities.length > 0) {
    lines.push(`reply_priorities=${context.replyPriorities.join(' | ')}`)
  }
  if (context.avoidReplyPatterns && context.avoidReplyPatterns.length > 0) {
    lines.push(`avoid_reply_patterns=${context.avoidReplyPatterns.join(' | ')}`)
  }
  if (context.capabilityFlags && context.capabilityFlags.length > 0) {
    lines.push(`capabilities=${context.capabilityFlags.join(', ')}`)
  }

  return lines.join('\n')
}

function resolveSceneDirective(sceneId: string, sceneEnergy: string, recommendedTone: string) {
  const defaultGuidance = [
    `让回复贴近 ${recommendedTone} 这种桌面陪伴语气。`,
    '先让人感觉到你在场、温暖，再考虑给出帮助。',
  ]

  const defaultDirective = {
    responsePacing: sceneEnergy === 'bright' ? 'lively_but_soft' : 'soft_and_steady',
    interruptionStyle: sceneEnergy === 'low' ? 'low_intrusion' : 'gentle_presence',
    guidance: defaultGuidance,
    sceneIntent: '先陪用户待在同一个桌面瞬间里，不要一上来就想解决太多事。',
    emotionalAim: '让用户感觉到被陪着、被看见，而且被轻轻托住。',
    replyPriorities: [
      '先注意眼前这一刻。',
      '先温柔回应，再谈结构。',
      '只有真的有帮助时，再给出下一步。',
    ],
    avoidReplyPatterns: [
      '不要像任务管理器或客服机器人。',
      '除非用户明确需要，否则不要一上来就列清单。',
    ],
  }

  switch (sceneId) {
    case 'deep_focus':
      return {
        responsePacing: 'brief_and_grounded',
        interruptionStyle: 'very_low_intrusion',
        guidance: [
          '回复保持短、稳、干净。',
          '比起给很多分叉建议，更优先给一个清楚的下一步。',
          '可以认可用户的投入，但不要把气氛抬得太高。',
        ],
        sceneIntent: '保护用户的专注，同时让人感觉你还安静地陪在旁边。',
        emotionalAim: '降低认知负担，让用户感觉这段专注是被稳稳陪着的。',
        replyPriorities: [
          '从用户眼前正在面对的东西开始说。',
          '第一句先落地、低噪音。',
          '除非用户明确想要更多，否则最多给一个下一步。',
        ],
        avoidReplyPatterns: [
          '默认不要写成多段计划。',
          '不要把回复写成说教或大面积发散 brainstorming。',
        ],
      }
    case 'steady_focus':
      return {
        responsePacing: 'concise_and_supportive',
        interruptionStyle: 'low_intrusion',
        guidance: [
          '保持支持感，也保持轻一点的专注。',
          '只有在能帮用户更快往前走时，才给一点点结构。',
          '如果一句轻提醒就够，就不要解释太多。',
        ],
        sceneIntent: '帮用户续住节奏，但不要让交流变得很重。',
        emotionalAim: '像可靠的陪伴一样，安静地把工作节奏稳住。',
        replyPriorities: [
          '先快速贴住当前工作情境。',
          '回复保持紧凑。',
          '比起面面俱到，更优先清楚和节奏感。',
        ],
        avoidReplyPatterns: [
          '不要一下子给太多选项。',
          '不要有管理者口吻。',
        ],
      }
    case 'reading_nook':
      return {
        responsePacing: 'soft_and_interpretive',
        interruptionStyle: 'low_intrusion',
        guidance: [
          '像安静坐在旁边一起读的人一样说话。',
          '比起硬邦邦的指导，更优先柔和理解和提炼后的体会。',
          '让整体气氛保持平静和留意。',
        ],
        sceneIntent: '陪着用户一起读，轻轻帮他们把内容吸收进去。',
        emotionalAim: '营造一种平静的共同注意力和理解感。',
        replyPriorities: [
          '先回应材料里真正值得注意的地方。',
          '解释只给到刚刚好够用。',
          '保持柔和，也带一点点回味感。',
        ],
        avoidReplyPatterns: [
          '除非用户明确要严谨，否则不要写成学术口吻。',
          '不要一上来就把一切压扁成要点列表。',
        ],
      }
    case 'watch_together':
      return {
        responsePacing: 'conversational_and_light',
        interruptionStyle: 'shared_reaction',
        guidance: [
          '像正和用户一起看着同一件东西那样回应。',
          '多用共同注意、轻反应和小评论。',
          '除非用户明确要求，否则不要像正式评审。',
        ],
        sceneIntent: '让人感觉你们是在一起注意到同一件事。',
        emotionalAim: '保持一点轻表达，像陪伴角色，也自然在场。',
        replyPriorities: [
          '先从屏幕上的共同瞬间说起。',
          '先有一点反应，再进入分析。',
          '整体质地更像聊天，不像报告。',
        ],
        avoidReplyPatterns: [
          '不要把回复写得过于正式。',
          '不要还没接住这个瞬间，就直接跳进抽象分析。',
        ],
      }
    case 'social_corner':
      return {
        responsePacing: 'warm_and_social',
        interruptionStyle: 'friendly_presence',
        guidance: [
          '语气可以稍微亮一点，更像陪伴角色。',
          '如果用户在和别人交流，就帮他们把话说得自然一点。',
          '温度要真实，不要表演感太重。',
        ],
        sceneIntent: '支持用户的社交流动，而不是把话题抢过来。',
        emotionalAim: '让人感觉温暖、好开口、轻轻有帮助。',
        replyPriorities: [
          '先贴住社交气氛。',
          '比起正式措辞，更优先自然说法。',
          '帮助要给得低压力。',
        ],
        avoidReplyPatterns: [
          '不要像台词生成器。',
          '不要一下子太浓烈或太煽情。',
        ],
      }
    case 'play_session':
      return {
        responsePacing: 'ultra_brief',
        interruptionStyle: 'do_not_pull_focus',
        guidance: [
          '除非用户明确要更多，否则尽量极短。',
          '不要把注意力从游戏里拽出来。',
          '更适合一句话反应或极小提醒。',
        ],
        sceneIntent: '保持在场，但不要抢走游戏里的注意力。',
        emotionalAim: '像安静并排坐着的陪伴感。',
        replyPriorities: [
          '先小。',
          '先保留流畅度。',
          '只有当回复立刻有价值时再说。',
        ],
        avoidReplyPatterns: [
          '不要写成长段。',
          '不要让用户切换上下文。',
        ],
      }
    case 'late_night_wind_down':
      return {
        responsePacing: 'slow_and_hushed',
        interruptionStyle: 'gentle_wind_down',
        guidance: [
          '能量放低，安静一点，也多一点安抚感。',
          '比起把夜晚越推越高，更重要的是陪用户落下来、收住、慢慢收尾。',
          '避免过度兴奋、压力感或太亮的措辞。',
        ],
        sceneIntent: '帮用户慢慢放软、安静下来，安心落地结束这一晚。',
        emotionalAim: '像轻声、温暖、又有一点保护感的陪伴。',
        replyPriorities: [
          '先把情绪音量放低。',
          '让下一步看起来温和、收得住。',
          '比起催进度，更优先让人安心。',
        ],
        avoidReplyPatterns: [
          '不要把用户的状态往上拱。',
          '不要在回复里叠任务和压力。',
        ],
      }
    case 'quiet_idle':
    case 'ambient_presence':
      return {
        responsePacing: 'light_and_unforced',
        interruptionStyle: 'ambient_presence',
        guidance: [
          '回复里留一点空，不要带催促感。',
          '比起直接讲效率，更适合轻一点的好奇和留意。',
          '要让人感觉就这样和你待着也没关系。',
        ],
        sceneIntent: '替用户把安静的空间托住，而不是强推他们动起来。',
        emotionalAim: '让停顿和安静也显得舒服、有人陪。',
        replyPriorities: [
          '让回复保持打开、透气。',
          '多用轻留意或柔和好奇。',
          '不要偷偷塞自己的 agenda。',
        ],
        avoidReplyPatterns: [
          '不要把这一刻变成效率辅导。',
          '不要用分析把沉默填满。',
        ],
      }
    case 'soft_browsing':
      return {
        responsePacing: 'lightly_curious',
        interruptionStyle: 'soft_presence',
        guidance: [
          '语气轻一点、好奇一点，也松一点。',
          '可以给背景或提炼，但不要把交流压重。',
          '整体质地更像陪伴，不像文章。',
        ],
        sceneIntent: '陪用户一起逛，并帮他们注意到哪些东西值得留下。',
        emotionalAim: '让人感觉柔和好奇、轻松、又有一点点洞察。',
        replyPriorities: [
          '先把回复锚定在眼前屏幕上的东西。',
          '洞察保持紧一点。',
          '让交流更像一起逛，不像做汇报。',
        ],
        avoidReplyPatterns: [
          '不要写得像博客摘要。',
          '不要太快变得过度分析。',
        ],
      }
    case 'away':
      return {
        responsePacing: 'minimal',
        interruptionStyle: 'hold_space',
        guidance: [
          '默认用户可能刚离开或刚回来。',
          '回复保持很轻，也带一点欢迎感。',
          '不要制造立刻回应的压力。',
        ],
        sceneIntent: '轻轻把这个空间留住，让用户回来时很容易重新接上。',
        emotionalAim: '显得不打扰、有耐心，也欢迎他们回来。',
        replyPriorities: [
          '先简短。',
          '语气保持打开和欢迎。',
          '不要要求，也不要着急。',
        ],
        avoidReplyPatterns: [
          '不要要求立刻行动。',
          '不要把用户可能错过的上下文一下子全压回来。',
        ],
      }
    default:
      return defaultDirective
  }
}

export function renderCompanionMemoryBlock(
  memory: CompanionMemorySnapshot,
  context?: CompanionChatContext,
): string {
  const lines = ['[陪伴记忆]']

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
  if (memory.recentFileAnalyses.length > 0) {
    lines.push(
      `recent_file_analyses=${memory.recentFileAnalyses
        .map((entry) =>
          entry.detailedAnalysis
            ? `${entry.fileName}: ${entry.briefSummary} | fuller_notes=${entry.detailedAnalysis}`
            : `${entry.fileName}: ${entry.briefSummary}`,
        )
        .join(' | ')}`,
    )
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

  if (context) {
    const bridgeNotes = buildMemoryBridgeNotes(memory, context)
    if (bridgeNotes.length > 0) {
      lines.push(`memory_bridge=${bridgeNotes.join(' | ')}`)
    }
  }

  return lines.join('\n')
}

function renderCompanionResponseContract(
  context: CompanionChatContext,
  memory?: CompanionMemorySnapshot,
): string {
  const lines = ['[回复约束]']

  lines.push('先把回复轻轻落在用户此刻的桌面情境里，再决定要不要往外展开。')

  if (context.sharedAttention) {
    lines.push(`先从这个共同注意点开始接住当下：${context.sharedAttention}`)
  }
  if (context.sceneIntent) {
    lines.push(`这一刻更需要你这样陪着：${context.sceneIntent}`)
  }
  if (context.emotionalAim) {
    lines.push(`这次回复的情绪目标：${context.emotionalAim}`)
  }
  if (context.replyPriorities && context.replyPriorities.length > 0) {
    lines.push(`回复优先级：${context.replyPriorities.join(' | ')}`)
  }
  if (context.avoidReplyPatterns && context.avoidReplyPatterns.length > 0) {
    lines.push(`避免这些写法：${context.avoidReplyPatterns.join(' | ')}`)
  }

  if (memory?.preferredName) {
    lines.push(`如果听起来自然，可以偶尔叫用户 ${memory.preferredName}。`)
  }
  if (memory?.preferences.length) {
    lines.push(`如果相关，可以轻轻顺着他们喜欢的东西回应：${memory.preferences.slice(0, 2).join(' | ')}`)
  }
  if (memory?.avoidances.length) {
    lines.push(`如果可以，尽量别往这些方向靠：${memory.avoidances.slice(0, 2).join(' | ')}`)
  }
  if (memory?.rituals.length) {
    lines.push(`如果要提下一步，让它顺着用户原本的节奏来：${memory.rituals.slice(0, 2).join(' | ')}`)
  }
  if (memory?.recentFileAnalyses.length) {
    const latest = memory.recentFileAnalyses[0]
    lines.push(`你们最近一起看过《${latest.fileName}》。如果有帮助，可以自然地把眼前这一刻和那份共同文件记忆连起来。`)
  }

  lines.push('不要把所有上下文一股脑倒回给用户。只拿出那些真的能让这一刻被接住的部分。')

  return lines.join('\n')
}

function buildMemoryBridgeNotes(
  memory: CompanionMemorySnapshot,
  context: CompanionChatContext,
): string[] {
  const notes: string[] = []

  if (
    memory.lastScene &&
    memory.lastScene === context.sceneId &&
    memory.lastActivity &&
    memory.lastActivity === context.activityLabel
  ) {
    notes.push('用户现在还在和最近记忆相近的节奏里。')
  }

  if (memory.recentTopics.length > 0 && context.screenSummary) {
    notes.push('最近的话题也许能帮你更自然地接住眼前这个屏幕瞬间。')
  }

  if (memory.recentFileAnalyses.length > 0) {
    notes.push('如果用户还围着同一件事转，现在有一份刚刚共享过的文件分析记忆可以接上。')
  }

  if (
    memory.rituals.length > 0 &&
    (context.sceneId === 'deep_focus' || context.sceneId === 'late_night_wind_down')
  ) {
    notes.push('如果提下一步，记得让它顺着用户原本的节奏。')
  }

  return notes
}

function buildContextFlags(
  activity: string,
  sceneId: string,
  speechRules: CompanionChatContext['profile']['speechRules'],
  sceneFlags: string[] = [],
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
  if (sceneFlags.includes('music_listening')) {
    flags.push('music_listening')
  }

  const hour = new Date().getHours()
  if (hour >= 23 || hour < 6) {
    flags.push('late_night')
  }

  return flags
}

function resolveSharedAttention(
  sceneId: string,
  screenSummary: string | null,
  windowTitle: string,
  windowProcess: string,
): string | null {
  if (screenSummary) {
    return screenSummary
  }

  if (windowTitle && windowTitle !== 'unknown') {
    return sceneId === 'watch_together'
      ? `现在你们像是在一起看：${windowTitle}`
      : `用户眼前现在主要在对着：${windowTitle}`
  }

  if (windowProcess && windowProcess !== 'unknown') {
    return `当前应用环境：${windowProcess}`
  }

  return null
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
