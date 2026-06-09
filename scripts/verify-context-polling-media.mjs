import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('electron/main.ts'), 'utf8')

const requiredSnippets = [
  "let lastMediaPlaybackSignature = ''",
  "const mediaSignature = [",
  "info.mediaPlaying ? 'playing' : 'silent'",
  "mediaSignature !== lastMediaPlaybackSignature",
  'lastMediaPlaybackSignature = mediaSignature',
]

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    console.error(`[deep-pet] context polling media verification failed: missing snippet ${snippet}`)
    process.exit(1)
  }
}

console.log('[deep-pet] context polling media verification passed')
