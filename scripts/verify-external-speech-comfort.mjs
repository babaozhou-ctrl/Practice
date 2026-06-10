import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/pet-main.ts'), 'utf8')

const requiredSnippets = [
  "type ExternalSpeechTier = 'ambient' | 'response' | 'result'",
  'const EXTERNAL_AMBIENT_IDLE_SUPPRESSION_MS = 90_000',
  'function resolveExternalSpeechSuppressionReason(',
  "if (externalTier !== 'ambient') {",
  "if (snapshot.scene.id === 'away') {",
  "if (snapshot.mode === 'quiet' || effectiveLowDistractionMode) {",
  'if (idleMs >= EXTERNAL_AMBIENT_IDLE_SUPPRESSION_MS) {',
  "reason: suppressionReason,",
  "externalTier: options?.externalTier ?? 'ambient',",
  "{ externalTier: 'ambient' },",
  "{ externalTier: 'result' },",
]

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    console.error(`[deep-pet] external speech comfort verification failed: missing snippet ${snippet}`)
    process.exit(1)
  }
}

console.log('[deep-pet] external speech comfort verified')
