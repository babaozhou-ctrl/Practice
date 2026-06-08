import type { ScreenPerceptionSnapshot } from '../../types/context'

export type ScreenContextDomain =
  | 'none'
  | 'code'
  | 'video'
  | 'social'
  | 'reading'
  | 'design'
  | 'game'
  | 'general'

export interface ScreenContextSignals {
  domain: ScreenContextDomain
  summary: string | null
  shortSummary: string | null
  flags: string[]
}

const DOMAIN_KEYWORDS: Record<Exclude<ScreenContextDomain, 'none' | 'general'>, string[]> = {
  code: [
    'function',
    'const',
    'class',
    'import',
    'error',
    'stack',
    'terminal',
    'debug',
    'ts',
    'tsx',
    'js',
    'py',
    '代码',
    '编译',
    '报错',
    '终端',
    '调试',
    'vscode',
    'cursor',
    'jetbrains',
  ],
  video: [
    'video',
    'player',
    'youtube',
    'bilibili',
    'netflix',
    'episode',
    'stream',
    '视频',
    '直播',
    '弹幕',
    '播放',
  ],
  social: [
    'discord',
    'wechat',
    'slack',
    'telegram',
    'chat',
    'message',
    'inbox',
    '微信',
    '聊天',
    '消息',
    '私信',
    '群聊',
  ],
  reading: [
    'document',
    'pdf',
    'notion',
    'manual',
    'readme',
    'article',
    'wiki',
    '文档',
    '手册',
    '文章',
    '论文',
    '教程',
    '资料',
  ],
  design: [
    'figma',
    'photoshop',
    'illustrator',
    'canvas',
    'layout',
    'palette',
    '设计',
    '配色',
    '画板',
    '原型',
    '排版',
  ],
  game: [
    'hp',
    'fps',
    'match',
    'quest',
    'inventory',
    'battle',
    'rank',
    '游戏',
    '对局',
    '战斗',
    '副本',
    '背包',
    '段位',
  ],
}

function normalizeSummary(summary: string | null | undefined): string | null {
  if (typeof summary !== 'string') return null
  const trimmed = summary.replace(/\s+/g, ' ').trim()
  return trimmed || null
}

function shortenSummary(summary: string, maxLength = 28): string {
  if (summary.length <= maxLength) {
    return summary
  }

  const minLength = Math.max(10, Math.floor(maxLength * 0.6))
  const softBreaks = '，。；、！？,.;!? '

  for (let index = maxLength; index >= minLength; index -= 1) {
    if (softBreaks.includes(summary[index] ?? '')) {
      return `${summary.slice(0, index).trim()}...`
    }
  }

  return `${summary.slice(0, maxLength).trim()}...`
}

function scoreDomains(summary: string): Array<{ domain: Exclude<ScreenContextDomain, 'none' | 'general'>; score: number }> {
  const lower = summary.toLowerCase()

  return Object.entries(DOMAIN_KEYWORDS).map(([domain, keywords]) => ({
    domain: domain as Exclude<ScreenContextDomain, 'none' | 'general'>,
    score: keywords.reduce((count, keyword) => count + (lower.includes(keyword.toLowerCase()) ? 1 : 0), 0),
  }))
}

export function inferScreenContextSignals(
  snapshot: ScreenPerceptionSnapshot | null | undefined,
): ScreenContextSignals {
  const summary = normalizeSummary(snapshot?.summary)
  if (!snapshot || snapshot.source === 'idle' || !summary) {
    return {
      domain: 'none',
      summary: null,
      shortSummary: null,
      flags: [],
    }
  }

  const domainScores = scoreDomains(summary).sort((left, right) => right.score - left.score)
  const best = domainScores[0]
  const domain: ScreenContextDomain =
    !best || best.score <= 0
      ? snapshot.imageAvailable
        ? 'general'
        : 'none'
      : best.domain

  const flags = [`screen_source:${snapshot.source}`, `screen_domain:${domain}`]

  if (snapshot.imageAvailable) {
    flags.push('screen_visible')
  }

  return {
    domain,
    summary,
    shortSummary: shortenSummary(summary),
    flags,
  }
}
