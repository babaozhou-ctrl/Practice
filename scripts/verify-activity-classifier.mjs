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
  { process: 'QQMusic', title: '每日30首 - QQ音乐', idleMs: 0 },
  { process: 'Spotify', title: 'Keshi - LIMBO', idleMs: 0 },
  { process: 'chrome', title: 'lofi mix - YouTube Music', idleMs: 0 },
  { process: 'msedge', title: '周杰伦 - 七里香 - https://music.163.com/#/song?id=185809', idleMs: 0 },
  { process: 'chrome', title: 'Taylor Swift | open.spotify.com', idleMs: 0 },
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
    title: '文件传输助手',
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
