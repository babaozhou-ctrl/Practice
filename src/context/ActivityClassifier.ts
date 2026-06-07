import { ActivityType, ActiveWindowInfo } from '../types/context'

const AWAY_IDLE_MS = 90_000

const GAME_PROCESSES = [
  'leagueclient', 'league of legends', 'valorant', 'csgo', 'cs2',
  'dota2', 'overwatch', 'gta5', 'gta', 'eldenring', 'steam',
  'battlefield', 'fortnite', 'minecraft', 'wow', 'worldofwarcraft',
  'apex', 'apexlegends', 'genshinimpact', 'honkai', 'starrail',
  'wutheringwaves', 'zzz', 'nikki', 'infinitynikki', 'terraria',
  'stardew', 'hades', 'cyberpunk', 'witcher', 'skyrim',
  'pubg', 'cod', 'callofduty', 'rainbowsix', 'r6',
  'rocketleague', 'fallguys', 'amongus', 'deadbydaylight',
  'osu', 'lolclient',
]

const GAME_LAUNCHER_PROCESSES = ['riotclient', 'epicgames', 'battle.net', 'steamwebhelper']

const CHAT_PROCESSES = [
  'wechat', 'weixin', 'qq', 'dingtalk', 'discord', 'telegram',
  'whatsapp', 'slack', 'teams', 'lark', 'feishu', 'line',
  'signal', 'messenger', 'skype',
]

const MEETING_PROCESSES = ['zoom', 'meet', 'teams', 'voov', 'webex']

const CODE_PROCESSES = [
  'code', 'vscode', 'code-insiders', 'visualstudio', 'devenv', 'jetbrains',
  'intellij', 'webstorm', 'pycharm', 'goland', 'clion',
  'rubymine', 'phpstorm', 'datagrip', 'rustrover', 'fleet',
  'sublime', 'vim', 'nvim', 'emacs', 'xcode', 'androidstudio',
  'eclipse', 'netbeans', 'notepad++', 'zed', 'helix', 'windsurf', 'cursor',
]

const TERMINAL_PROCESSES = [
  'terminal', 'windows terminal', 'powershell', 'cmd', 'pwsh',
  'putty', 'wsl', 'bash', 'zsh', 'git-bash', 'iterm', 'hyper',
]

const BROWSER_PROCESSES = [
  'chrome', 'firefox', 'edge', 'safari', 'opera', 'brave',
  'chromium', 'msedge', 'msedgewebview2', 'vivaldi', 'arc',
  'tor', 'librewolf', 'floorp', 'zen',
]

const MEDIA_PROCESSES = [
  'vlc', 'mpc-hc', 'potplayer', 'kmplayer', 'wmplayer',
  'iina', 'plex', 'spotify', 'itunes', 'foobar2000',
  'music', 'podcast', 'obs',
]

const VIDEO_TITLE_KEYWORDS = [
  'youtube', 'bilibili', 'netflix', 'twitch', 'crunchyroll',
  'hulu', 'disney+', 'prime video', 'hbo', 'max',
  'douyu', 'huya', 'iqiyi', 'youku', '腾讯视频', '爱奇艺',
  '哔哩哔哩', '直播', 'stream', 'video', 'episode', 'movie',
]

const READING_TITLE_KEYWORDS = [
  'pdf', '.pdf', 'ebook', 'epub', '.epub', 'kindle',
  'readwise', 'reader', '文档', '论文', '手册', '指南',
  'notion', '语雀', '飞书文档', 'docs', 'documentation',
]

const CHAT_TITLE_KEYWORDS = [
  'discord', 'wechat', '微信', 'qq', 'telegram', 'slack',
  'teams', 'feishu', 'lark', '消息', '聊天', 'chat',
]

const MEETING_TITLE_KEYWORDS = [
  'meeting', 'zoom', 'google meet', '腾讯会议', 'voov',
  'teams meeting', 'webex', '通话', 'conference',
]

const CODE_TITLE_KEYWORDS = [
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java',
  '.cpp', '.c', '.cs', '.json', '.yaml', '.yml', '.md',
  'visual studio code', 'solution', 'workspace', 'terminal',
]

const BROWSER_READING_SITES = [
  'medium', 'substack', 'readthedocs', 'developer.mozilla.org',
  'docs.', 'wiki', 'wikipedia', 'arxiv', '语雀', 'notion',
]

const BROWSER_CHAT_SITES = [
  'discord', 'slack', 'web.telegram', 'mail.qq', 'outlook',
  'mail.google', 'gmail', 'teams', 'wechat', 'feishu',
]

function normalizeWindowInfo(info: ActiveWindowInfo) {
  return {
    process: info.process.trim().toLowerCase(),
    title: info.title.trim(),
    lowerTitle: info.title.trim().toLowerCase(),
  }
}

function containsAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate))
}

function classifyBrowserTitle(lowerTitle: string): ActivityType {
  if (containsAny(lowerTitle, MEETING_TITLE_KEYWORDS)) return 'CHATTING'
  if (containsAny(lowerTitle, BROWSER_CHAT_SITES) || containsAny(lowerTitle, CHAT_TITLE_KEYWORDS)) return 'CHATTING'
  if (containsAny(lowerTitle, VIDEO_TITLE_KEYWORDS)) return 'WATCHING'
  if (containsAny(lowerTitle, CODE_TITLE_KEYWORDS)) return 'CODING'
  if (containsAny(lowerTitle, READING_TITLE_KEYWORDS) || containsAny(lowerTitle, BROWSER_READING_SITES)) return 'READING'
  return 'BROWSING'
}

function classifyByProcess(process: string, lowerTitle: string): ActivityType | null {
  if (containsAny(process, GAME_PROCESSES)) return 'GAMING'
  if (containsAny(process, CHAT_PROCESSES)) return 'CHATTING'
  if (containsAny(process, MEETING_PROCESSES)) return 'CHATTING'
  if (containsAny(process, CODE_PROCESSES)) return 'CODING'
  if (containsAny(process, TERMINAL_PROCESSES)) return 'CODING'
  if (containsAny(process, MEDIA_PROCESSES)) {
    if (containsAny(lowerTitle, READING_TITLE_KEYWORDS)) return 'READING'
    return 'WATCHING'
  }
  if (containsAny(process, BROWSER_PROCESSES)) {
    return classifyBrowserTitle(lowerTitle)
  }
  if (containsAny(process, GAME_LAUNCHER_PROCESSES) && containsAny(lowerTitle, ['play', '启动', '开始游戏', 'launcher'])) {
    return 'GAMING'
  }
  return null
}

function classifyByTitle(lowerTitle: string): ActivityType {
  if (!lowerTitle) return 'IDLE'
  if (containsAny(lowerTitle, CHAT_TITLE_KEYWORDS) || containsAny(lowerTitle, MEETING_TITLE_KEYWORDS)) return 'CHATTING'
  if (containsAny(lowerTitle, VIDEO_TITLE_KEYWORDS)) return 'WATCHING'
  if (containsAny(lowerTitle, CODE_TITLE_KEYWORDS)) return 'CODING'
  if (containsAny(lowerTitle, READING_TITLE_KEYWORDS)) return 'READING'
  if (lowerTitle.includes('game') || lowerTitle.includes('play') || lowerTitle.includes('steam')) return 'GAMING'
  return 'OTHER'
}

export function classifyActivity(info: ActiveWindowInfo): ActivityType {
  const normalized = normalizeWindowInfo(info)
  if ((info.idleMs ?? 0) >= AWAY_IDLE_MS) return 'IDLE'
  if (!normalized.process && !normalized.title) return 'IDLE'

  const byProcess = classifyByProcess(normalized.process, normalized.lowerTitle)
  if (byProcess) {
    return byProcess
  }

  return classifyByTitle(normalized.lowerTitle)
}
