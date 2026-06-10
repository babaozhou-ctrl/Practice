import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const petMainSource = readFileSync(resolve('src/pet-main.ts'), 'utf8')
const pixiRuntimeSource = readFileSync(resolve('src/rendering/pixi/PixiPetRuntime.ts'), 'utf8')

const petMainChecks = [
  'const resolvePetInteractionHit = (clientX: number, clientY: number) => runtime.hitTestCanvasPoint(clientX, clientY)',
  "const canDragPet = (clientX: number, clientY: number) => {",
  "const canOpenContextMenu = (clientX: number, clientY: number) => {",
  "const canPetAffectionTap = (clientX: number, clientY: number) => {",
  'return hit.hit && hit.coverage >= 0.2',
  'hit.neighborhoodCoverage >= 0.34',
  'hit.normalizedX >= 0.14',
  'hit.normalizedX <= 0.86',
  'hit.normalizedY >= 0.06',
  'hit.normalizedY <= 0.92',
  'hit.alpha >= 168',
  'hit.coverage >= 0.66',
  'hit.neighborhoodCoverage >= 0.52',
  'hit.normalizedX >= 0.26',
  'hit.normalizedX <= 0.74',
  'hit.normalizedY >= 0.08',
  'hit.normalizedY <= 0.56',
  'canStartInteraction: (event) => canDragPet(event.clientX, event.clientY)',
  'canTriggerTap: (event) => canPetAffectionTap(event.clientX, event.clientY)',
  'isHoveringInteractiveTarget: (event) => canDragPet(event.clientX, event.clientY)',
  'const isDragOverPetBody = (event: DragEvent) => canDragPet(event.clientX, event.clientY)',
  'if (!canOpenContextMenu(event.clientX, event.clientY)) {',
  'const measuredWidth = Math.max(menuMinWidth, Math.min(menuPreferredWidth, window.screen.availWidth - menuMargin * 6))',
  'menu.style.width = `${measuredWidth}px`',
  'const estimatedWidth = Math.max(menu.scrollWidth, menu.offsetWidth, measuredWidth)',
  'const estimatedHeight = Math.max(menu.scrollHeight, menu.offsetHeight, 360)',
  "menu.style.left = `${menuMargin}px`",
  "menu.style.top = `${menuMargin}px`",
  'const resolvedMenuWidth = Math.min(maxMenuWidth, measuredWidth)',
  "const maxMenuWidth = Math.max(menuMinWidth, viewportWidth - menuMargin * 2)",
]

const pixiRuntimeChecks = [
  'coverage: number',
  'neighborhoodCoverage: number',
  'normalizedX: number',
  'normalizedY: number',
  'return { hit: false, alpha: 0, coverage: 0, neighborhoodCoverage: 0, normalizedX: 0, normalizedY: 0 }',
  'const coverage = alpha / 255',
  'const neighborhoodCoverage = this.textureSet.hitTestAlphaAt',
  'const normalizedX = texture.width > 1 ? textureX / (texture.width - 1) : 0.5',
  'const normalizedY = texture.height > 1 ? textureY / (texture.height - 1) : 0.5',
  'function sampleNeighborhoodCoverage(',
  'hit: alpha >= 32',
]

for (const snippet of petMainChecks) {
  if (!petMainSource.includes(snippet)) {
    console.error(`[deep-pet] pet interaction verification failed: missing snippet ${snippet}`)
    process.exit(1)
  }
}

for (const snippet of pixiRuntimeChecks) {
  if (!pixiRuntimeSource.includes(snippet)) {
    console.error(`[deep-pet] pet interaction verification failed: missing snippet ${snippet}`)
    process.exit(1)
  }
}

console.log('[deep-pet] pet interaction guards verified')
