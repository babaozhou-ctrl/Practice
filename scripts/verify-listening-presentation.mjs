import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const states = JSON.parse(readFileSync(resolve('pets/mochi/states.json'), 'utf8'))
const animations = JSON.parse(readFileSync(resolve('pets/mochi/animations.json'), 'utf8'))

const listeningState = states?.states?.listening
const watchingState = states?.states?.watching_video
const listeningClip = animations?.clips?.listening_loop
const watchingClip = animations?.clips?.watching_loop

if (!listeningState) {
  console.error('[deep-pet] listening state is missing in pets/mochi/states.json')
  process.exit(1)
}

if (listeningState.baseClip !== 'listening_loop') {
  console.error(
    `[deep-pet] listening state baseClip mismatch: expected listening_loop, got ${listeningState.baseClip}`,
  )
  process.exit(1)
}

if (!watchingState || watchingState.baseClip !== 'watching_loop') {
  console.error('[deep-pet] watching_video state is missing or invalid')
  process.exit(1)
}

if (!listeningClip) {
  console.error('[deep-pet] listening_loop clip is missing in pets/mochi/animations.json')
  process.exit(1)
}

if (!watchingClip) {
  console.error('[deep-pet] watching_loop clip is missing in pets/mochi/animations.json')
  process.exit(1)
}

if (JSON.stringify(listeningClip.frames) !== JSON.stringify(watchingClip.frames)) {
  console.error('[deep-pet] listening_loop is expected to reuse the current watching frames for now')
  process.exit(1)
}

if (listeningClip.loop !== true) {
  console.error('[deep-pet] listening_loop should remain looped')
  process.exit(1)
}

console.log('[deep-pet] listening presentation assets verified')
