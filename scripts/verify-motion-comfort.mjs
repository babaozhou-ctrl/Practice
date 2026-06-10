import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const animations = JSON.parse(readFileSync(resolve('pets/mochi/animations.json'), 'utf8'))
const runtimeSource = readFileSync(resolve('src/rendering/pixi/PixiPetRuntime.ts'), 'utf8')
const petMainSource = readFileSync(resolve('src/pet-main.ts'), 'utf8')

const idleLoop = animations?.clips?.idle_loop?.motionProfile
const thinkingLoop = animations?.clips?.thinking_loop?.motionProfile
const watchingLoop = animations?.clips?.watching_loop?.motionProfile
const listeningLoop = animations?.clips?.listening_loop?.motionProfile
const chattingLoop = animations?.clips?.chatting_loop?.motionProfile
const happyReact = animations?.clips?.happy_react?.motionProfile
const excitedLoop = animations?.clips?.excited_loop?.motionProfile

if (!idleLoop) {
  console.error('[deep-pet] motion comfort verification failed: idle_loop motionProfile is missing')
  process.exit(1)
}

if (!thinkingLoop) {
  console.error('[deep-pet] motion comfort verification failed: thinking_loop motionProfile is missing')
  process.exit(1)
}

if (!watchingLoop) {
  console.error('[deep-pet] motion comfort verification failed: watching_loop motionProfile is missing')
  process.exit(1)
}

if (!listeningLoop) {
  console.error('[deep-pet] motion comfort verification failed: listening_loop motionProfile is missing')
  process.exit(1)
}

if (!chattingLoop) {
  console.error('[deep-pet] motion comfort verification failed: chatting_loop motionProfile is missing')
  process.exit(1)
}

if (!happyReact) {
  console.error('[deep-pet] motion comfort verification failed: happy_react motionProfile is missing')
  process.exit(1)
}

if (!excitedLoop) {
  console.error('[deep-pet] motion comfort verification failed: excited_loop motionProfile is missing')
  process.exit(1)
}

const numericChecks = [
  ['idle_loop.bouncePx', idleLoop.bouncePx, 0.5],
  ['idle_loop.swayPx', idleLoop.swayPx, 0.35],
  ['idle_loop.rotateDeg', idleLoop.rotateDeg, 0.3],
  ['idle_loop.scaleYAmount', idleLoop.scaleYAmount, 0.008],
  ['thinking_loop.restOffsetY', thinkingLoop.restOffsetY, 0],
  ['thinking_loop.bouncePx', thinkingLoop.bouncePx, 0.5],
  ['thinking_loop.swayPx', thinkingLoop.swayPx, 0.65],
  ['thinking_loop.rotateDeg', thinkingLoop.rotateDeg, 0.8],
  ['thinking_loop.scaleYAmount', thinkingLoop.scaleYAmount, 0.009],
  ['watching_loop.restOffsetY', watchingLoop.restOffsetY, 0],
  ['watching_loop.bouncePx', watchingLoop.bouncePx, 0.45],
  ['watching_loop.swayPx', watchingLoop.swayPx, 0.55],
  ['watching_loop.rotateDeg', watchingLoop.rotateDeg, 0.7],
  ['watching_loop.scaleYAmount', watchingLoop.scaleYAmount, 0.01],
  ['listening_loop.bouncePx', listeningLoop.bouncePx, 0.4],
  ['listening_loop.swayPx', listeningLoop.swayPx, 1.0],
  ['listening_loop.rotateDeg', listeningLoop.rotateDeg, 1.0],
  ['listening_loop.scaleYAmount', listeningLoop.scaleYAmount, 0.011],
  ['chatting_loop.restOffsetY', chattingLoop.restOffsetY, 0],
  ['chatting_loop.bouncePx', chattingLoop.bouncePx, 0.85],
  ['chatting_loop.swayPx', chattingLoop.swayPx, 0.65],
  ['chatting_loop.rotateDeg', chattingLoop.rotateDeg, 0.7],
  ['chatting_loop.scaleYAmount', chattingLoop.scaleYAmount, 0.013],
  ['happy_react.restOffsetY', happyReact.restOffsetY, 0],
  ['happy_react.bouncePx', happyReact.bouncePx, 1.7],
  ['happy_react.rotateDeg', happyReact.rotateDeg, 1.0],
  ['excited_loop.restOffsetY', excitedLoop.restOffsetY, 0],
  ['excited_loop.bouncePx', excitedLoop.bouncePx, 2.0],
  ['excited_loop.rotateDeg', excitedLoop.rotateDeg, 1.2],
]

for (const [label, actual, max] of numericChecks) {
  if (typeof actual !== 'number' || actual > max) {
    console.error(`[deep-pet] motion comfort verification failed: ${label} expected <= ${max}, got ${actual}`)
    process.exit(1)
  }
}

const runtimeSnippets = [
  "case 'quiet':",
  'bounceScale: 0.5',
  'swayScale: 0.52',
  "case 'quiet_idle':",
  'bounceScale: 0.28 * quietMultiplier',
  'bounce = Math.abs(Math.sin(t / 320)) * 1.05',
  'bounce = Math.sin(t / 1800) * 0.16',
  'bounce += pulseWave * 0.14 + accentWave * 0.08',
  "bounceScale: 0.68,",
  "bounceScale: 0.58,",
]

for (const snippet of runtimeSnippets) {
  if (!runtimeSource.includes(snippet)) {
    console.error(`[deep-pet] motion comfort verification failed: missing runtime snippet ${snippet}`)
    process.exit(1)
  }
}

if (!petMainSource.includes('if (now - lastBridgeAnimationAt < 10_000)')) {
  console.error('[deep-pet] motion comfort verification failed: scene bridge cooldown is too short')
  process.exit(1)
}

console.log('[deep-pet] motion comfort verification passed')
