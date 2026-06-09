import { ActivityType, ActiveWindowInfo } from '../types/context'

const AWAY_IDLE_MS = 90_000

const GAME_PROCESSES = [
  'leagueclient', 'league of legends', 'valorant', 'csgo', 'cs2',
  'dota2', 'overwatch', 'gta5', 'gta', 'eldenring', 'steam',
  'battlefield', 'fortnite', 'minecraft', 'wow', 'worldofwarcraft',
  'apex', 'apexlegends', 'genshinimpact', 'honkai', 'starrail',
  'wutheringwaves', 'zzz', 'nikki', 'infinitynikki', 'terraria',
  'stardew', 'hades', 'cyberpunk', 'witcher', 'skyrim',
  'pubg', 'callofduty', 'rainbowsix', 'rocketleague', 'fallguys',
  'amongus', 'deadbydaylight', 'osu', 'lolclient',
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
  'music', 'podcast', 'obs', 'cloudmusic', 'neteasemusic',
  'qqmusic', 'kugou', 'kwmusic', 'kuwo', 'aimp', 'musicbee',
  'tidal', 'deezer',
]

const DIRECT_MUSIC_PROCESSES = [
  'spotify', 'cloudmusic', 'neteasemusic', 'qqmusic', 'foobar2000',
  'musicbee', 'kugou', 'kwmusic', 'kuwo', 'tidal', 'deezer',
]

const VIDEO_TITLE_KEYWORDS = [
  'youtube', 'bilibili', 'netflix', 'twitch', 'crunchyroll',
  'hulu', 'disney+', 'prime video', 'hbo', 'max',
  'douyu', 'huya', 'iqiyi', 'youku', '腾讯视频', '爱奇艺',
  '哔哩哔哩', '直播', 'stream', 'video', 'episode', 'movie',
]

const MUSIC_TITLE_KEYWORDS = [
  'spotify',
  'apple music',
  'youtube music',
  'yt music',
  'netease music',
  'cloudmusic',
  'qq music',
  'qqmusic',
  'kugou',
  'kuwo',
  'foobar2000',
  'playlist',
  'album',
  'artist',
  '歌词',
  '听歌',
  '音乐',
  '歌曲',
  '歌单',
  '网易云音乐',
  'qq音乐',
  '酷狗音乐',
  '酷我音乐',
]

const READING_TITLE_KEYWORDS = [
  'pdf', '.pdf', 'ebook', '.epub', 'kindle',
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

const BROWSER_MUSIC_SITES = [
  'open.spotify.com',
  'music.youtube.com',
  'music.163.com',
  'y.qq.com',
  'kugou',
  'kuwo',
  'apple music',
]

const COMPACT_MUSIC_KEYWORDS = [
  'spotify',
  'openspotifycom',
  'youtubemusic',
  'musicyoutubecom',
  'applemusic',
  'music163com',
  'neteasemusic',
  'cloudmusic',
  'qqmusic',
  'yqqcom',
  'kugou',
  'kuwo',
  'foobar2000',
  'musicbee',
  'tidal',
  'deezer',
]

const MUSIC_PLAYBACK_HINTS = [
  'nowplaying',
  'currentlyplaying',
  'lyrics',
  'playlist',
  'album',
  'premium',
  'track',
  'mixlist',
  'songradio',
]

function normalizeWindowInfo(info: ActiveWindowInfo) {
  return {
    process: info.process.trim().toLowerCase(),
    title: info.title.trim(),
    lowerTitle: info.title.trim().toLowerCase(),
  }
}

function compactValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function containsAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate))
}

function matchesProcess(process: string, candidates: string[]): boolean {
  return candidates.some((candidate) => process === candidate || process.startsWith(`${candidate}.`))
}

function classifyBrowserTitle(lowerTitle: string): ActivityType {
  const compactTitle = compactValue(lowerTitle)
  if (containsAny(lowerTitle, MEETING_TITLE_KEYWORDS)) return 'CHATTING'
  if (containsAny(lowerTitle, BROWSER_CHAT_SITES) || containsAny(lowerTitle, CHAT_TITLE_KEYWORDS)) return 'CHATTING'
  if (
    containsAny(lowerTitle, BROWSER_MUSIC_SITES) ||
    containsAny(lowerTitle, MUSIC_TITLE_KEYWORDS) ||
    containsAny(compactTitle, COMPACT_MUSIC_KEYWORDS) ||
    (containsAny(compactTitle, MUSIC_PLAYBACK_HINTS) && containsAny(compactTitle, COMPACT_MUSIC_KEYWORDS))
  ) return 'WATCHING'
  if (containsAny(lowerTitle, VIDEO_TITLE_KEYWORDS)) return 'WATCHING'
  if (containsAny(lowerTitle, CODE_TITLE_KEYWORDS)) return 'CODING'
  if (containsAny(lowerTitle, READING_TITLE_KEYWORDS) || containsAny(lowerTitle, BROWSER_READING_SITES)) return 'READING'
  return 'BROWSING'
}

function classifyByProcess(process: string, lowerTitle: string): ActivityType | null {
  if (matchesProcess(process, CODE_PROCESSES)) return 'CODING'
  if (matchesProcess(process, TERMINAL_PROCESSES)) return 'CODING'
  if (matchesProcess(process, GAME_PROCESSES)) return 'GAMING'
  if (matchesProcess(process, CHAT_PROCESSES)) return 'CHATTING'
  if (matchesProcess(process, MEETING_PROCESSES)) return 'CHATTING'
  if (matchesProcess(process, MEDIA_PROCESSES)) {
    if (containsAny(lowerTitle, READING_TITLE_KEYWORDS)) return 'READING'
    return 'WATCHING'
  }
  if (matchesProcess(process, BROWSER_PROCESSES)) {
    return classifyBrowserTitle(lowerTitle)
  }
  if (matchesProcess(process, GAME_LAUNCHER_PROCESSES) && containsAny(lowerTitle, ['play', '启动', '开始游戏', 'launcher'])) {
    return 'GAMING'
  }
  return null
}

function classifyByTitle(lowerTitle: string): ActivityType {
  const compactTitle = compactValue(lowerTitle)
  if (!lowerTitle) return 'IDLE'
  if (containsAny(lowerTitle, CHAT_TITLE_KEYWORDS) || containsAny(lowerTitle, MEETING_TITLE_KEYWORDS)) return 'CHATTING'
  if (
    containsAny(lowerTitle, MUSIC_TITLE_KEYWORDS) ||
    containsAny(compactTitle, COMPACT_MUSIC_KEYWORDS)
  ) return 'WATCHING'
  if (containsAny(lowerTitle, VIDEO_TITLE_KEYWORDS)) return 'WATCHING'
  if (containsAny(lowerTitle, CODE_TITLE_KEYWORDS)) return 'CODING'
  if (containsAny(lowerTitle, READING_TITLE_KEYWORDS)) return 'READING'
  if (
    lowerTitle.includes('game') ||
    lowerTitle.includes('steam') ||
    /\bplay\b/.test(lowerTitle)
  ) return 'GAMING'
  return 'OTHER'
}

export function looksLikeMusicPlayback(info: ActiveWindowInfo): boolean {
  const normalized = normalizeWindowInfo(info)
  const compactTitle = compactValue(normalized.lowerTitle)

  if (matchesProcess(normalized.process, DIRECT_MUSIC_PROCESSES)) {
    return true
  }

  if (info.mediaPlaying) {
    const mediaSource = compactValue(info.mediaSource ?? '')
    const mediaTitle = compactValue(info.mediaTitle ?? '')
    const mediaArtist = compactValue(info.mediaArtist ?? '')

    if (
      containsAny(mediaSource, COMPACT_MUSIC_KEYWORDS) ||
      containsAny(mediaTitle, MUSIC_PLAYBACK_HINTS) ||
      containsAny(mediaArtist, COMPACT_MUSIC_KEYWORDS) ||
      mediaTitle.length > 0
    ) {
      return true
    }
  }

  return (
    matchesProcess(normalized.process, MEDIA_PROCESSES) &&
    containsAny(normalized.lowerTitle, MUSIC_TITLE_KEYWORDS)
  ) ||
    containsAny(normalized.lowerTitle, BROWSER_MUSIC_SITES) ||
    containsAny(normalized.lowerTitle, MUSIC_TITLE_KEYWORDS) ||
    containsAny(compactTitle, COMPACT_MUSIC_KEYWORDS)
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
