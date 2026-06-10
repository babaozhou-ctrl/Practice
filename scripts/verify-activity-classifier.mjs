import { readFileSync } from 'fs'
import { strict as assert } from 'assert'
import { join } from 'path'
import ts from 'typescript'

const repoRoot = process.cwd()
const sourcePath = join(repoRoot, 'src/context/ActivityClassifier.ts')
const sourceText = readFileSync(sourcePath, 'utf8')

const transpiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText

const moduleShim = { exports: {} }
const requireShim = (specifier) => {
  if (specifier === '../types/context') {
    return {}
  }
  throw new Error(`Unsupported import in verification script: ${specifier}`)
}

const evaluator = new Function('require', 'module', 'exports', transpiled)
evaluator(requireShim, moduleShim, moduleShim.exports)

const { classifyActivity, looksLikeMusicPlayback } = moduleShim.exports

const musicCases = [
  { process: 'cloudmusic', title: 'Daily Mix - NetEase Music', idleMs: 0 },
  { process: 'QQMusic', title: 'Daily Mix - QQ Music', idleMs: 0 },
  { process: 'Spotify', title: 'Keshi - LIMBO', idleMs: 0 },
  { process: 'chrome', title: 'lofi mix - YouTube Music', idleMs: 0 },
  { process: 'msedge', title: 'Jay Chou - music.163.com', idleMs: 0 },
  { process: 'chrome', title: 'Taylor Swift | open.spotify.com', idleMs: 0 },
  { process: 'chrome', title: 'Jay Chou | music.apple.com', idleMs: 0 },
  {
    process: 'ApplicationFrameHost',
    title: 'Inbox - Outlook',
    idleMs: 0,
    mediaPlaying: true,
    mediaSource: 'Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic',
    mediaTitle: 'Night Drive',
    mediaArtist: 'bb7',
  },
  {
    process: 'ApplicationFrameHost',
    title: 'Mail',
    idleMs: 0,
    mediaPlaying: true,
    mediaSource: 'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify',
    mediaTitle: 'LIMBO',
    mediaArtist: '',
  },
  {
    process: 'ApplicationFrameHost',
    title: 'Media Player',
    idleMs: 0,
    mediaPlaying: true,
    mediaSource: 'Microsoft.MediaPlayer_8wekyb3d8bbwe!App',
    mediaTitle: 'Moon River',
    mediaArtist: '',
  },
  {
    process: 'Cursor',
    title: 'deep-pet.code-workspace - Cursor',
    idleMs: 0,
    mediaPlaying: true,
    mediaSource: 'Spotify.exe',
    mediaTitle: 'Daily Mix 3',
    mediaArtist: '',
  },
  {
    process: 'Code',
    title: 'pet-main.ts - deep-pet - Visual Studio Code',
    idleMs: 0,
    mediaPlaying: true,
    mediaSource: 'AppleMusicWin.exe',
    mediaTitle: 'Night Swim',
    mediaArtist: '',
  },
  {
    process: 'Code',
    title: 'pet-main.ts - deep-pet - Visual Studio Code',
    idleMs: 0,
    mediaPlaying: true,
    mediaSource: 'Spotify.exe',
    mediaTitle: 'LIMBO',
    mediaArtist: 'keshi',
  },
]

for (const sample of musicCases) {
  assert.equal(
    looksLikeMusicPlayback(sample),
    true,
    `Expected music playback hint to be detected for ${sample.process} / ${sample.title}`,
  )
}

const nonMusicCases = [
  {
    process: 'chrome',
    title: 'Deep Pet devlog - YouTube',
    idleMs: 0,
    mediaPlaying: true,
    mediaSource: 'Chrome',
    mediaTitle: 'Deep Pet episode 2',
    mediaArtist: '',
  },
  {
    process: 'msedge',
    title: 'Desktop companion animation review - Bilibili',
    idleMs: 0,
    mediaPlaying: true,
    mediaSource: 'msedge.exe',
    mediaTitle: 'Animation review video',
    mediaArtist: '',
  },
  {
    process: 'vlc',
    title: 'Deep Pet Cutscene',
    idleMs: 0,
    mediaPlaying: true,
    mediaSource: 'VLC media player',
    mediaTitle: 'Episode 4',
    mediaArtist: '',
  },
  {
    process: 'Code',
    title: 'CompanionScene.ts - deep-pet - Visual Studio Code',
    idleMs: 0,
    mediaPlaying: true,
    mediaSource: 'msedge.exe',
    mediaTitle: 'Deep Pet trailer',
    mediaArtist: '',
  },
]

for (const sample of nonMusicCases) {
  assert.equal(
    looksLikeMusicPlayback(sample),
    false,
    `Expected non-music media to stay out of music playback detection for ${sample.process} / ${sample.title}`,
  )
}

const primaryActivityCases = [
  {
    process: 'cloudmusic',
    title: 'Daily Mix - NetEase Music',
    idleMs: 0,
    expected: 'WATCHING',
  },
  {
    process: 'chrome',
    title: 'lofi mix - YouTube Music',
    idleMs: 0,
    expected: 'WATCHING',
  },
  {
    process: 'chrome',
    title: 'Jay Chou | music.apple.com',
    idleMs: 0,
    expected: 'WATCHING',
  },
  {
    process: 'Code',
    title: 'pet-main.ts - deep-pet - Visual Studio Code',
    idleMs: 0,
    mediaPlaying: true,
    mediaSource: 'Spotify.exe',
    mediaTitle: 'LIMBO',
    mediaArtist: 'keshi',
    expected: 'CODING',
  },
  {
    process: 'chrome',
    title: 'Deep Pet Architecture - Notion',
    idleMs: 0,
    expected: 'READING',
  },
  {
    process: 'WeChat',
    title: 'File Transfer Assistant',
    idleMs: 0,
    expected: 'CHATTING',
  },
]

for (const sample of primaryActivityCases) {
  assert.equal(
    classifyActivity(sample),
    sample.expected,
    `Unexpected classification for ${sample.process} / ${sample.title}`,
  )
}

console.log('activity-classifier verification passed')
