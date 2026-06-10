import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const assetStatus = JSON.parse(readFileSync(resolve('pets/mochi/asset-status.json'), 'utf8'))
const textureFactorySource = readFileSync(resolve('src/rendering/pixi/pixelTextureFactory.ts'), 'utf8')
const petMainSource = readFileSync(resolve('src/pet-main.ts'), 'utf8')

if (assetStatus.runtimeFallbackEnabled !== false) {
  console.error('[deep-pet] built-in render source verification failed: runtimeFallbackEnabled must be false for bb7.')
  process.exit(1)
}

const requiredTextureFactorySnippets = [
  "preferredSource: 'atlas' | 'procedural'",
  "fallbackReason: 'atlas-load-failed' | null",
  "preferredSource === 'atlas' ? 'atlas-load-failed' : null",
]

for (const snippet of requiredTextureFactorySnippets) {
  if (!textureFactorySource.includes(snippet)) {
    console.error(`[deep-pet] built-in render source verification failed: missing texture factory snippet ${snippet}`)
    process.exit(1)
  }
}

const requiredPetMainSnippets = [
  "emitAutomationMetricEvent('runtime.texture-source'",
  'runtimeFallbackEnabled: petPackage.assetStatus?.runtimeFallbackEnabled ?? null',
  "emitRuntimeTextureSourceMetric(petPackage, textureSet, 'initial')",
  "emitRuntimeTextureSourceMetric(petPackage, textureSet, 'replace')",
]

for (const snippet of requiredPetMainSnippets) {
  if (!petMainSource.includes(snippet)) {
    console.error(`[deep-pet] built-in render source verification failed: missing pet-main snippet ${snippet}`)
    process.exit(1)
  }
}

console.log('[deep-pet] built-in render source verified')
