import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/pet-main.ts'), 'utf8')

const requiredSnippets = [
  'function syncContextStoreFromWindowInfo(info: {',
  'mediaPlaying?: boolean',
  'mediaTitle?: string',
  'mediaArtist?: string',
  'mediaSource?: string',
  'contextStore.setActiveWindow(info)',
  'contextStore.setActivity(classifyActivity(info))',
]

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    console.error(`[deep-pet] window context sync verification failed: missing snippet ${snippet}`)
    process.exit(1)
  }
}

console.log('[deep-pet] window context sync verified')
