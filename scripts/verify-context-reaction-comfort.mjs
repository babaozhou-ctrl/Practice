import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/domain/companion/CompanionStateMachine.ts'), 'utf8')

const requiredSnippets = [
  'const CONTEXT_REACTION_BASE_COOLDOWN_MS = 90_000',
  'const CONTEXT_REACTION_QUIET_COOLDOWN_MS = 180_000',
  'const MIN_ACTIVITY_HOLD_BEFORE_CONTEXT_SPEECH_MS = 55_000',
  'const MIN_SCENE_HOLD_BEFORE_CONTEXT_SPEECH_MS = 45_000',
  'const previousSnapshot = this.getSnapshot(now)',
  'const nextSnapshot = this.getSnapshot(now)',
  'const hasMeaningfulContextShift =',
  'buildContextReactionKey(nextSnapshot) !== buildContextReactionKey(previousSnapshot)',
  'speech = this.maybeCreateReaction(activity, emotion, mode, nextSnapshot, now)',
  'if (now - this.lastReactionAt < 90_000) return undefined',
  'function buildContextReactionKey(snapshot: CompanionSnapshot): string {',
  "return `${snapshot.scene.id}|${snapshot.scene.flags.join(',')}`",
]

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    console.error(`[deep-pet] context reaction comfort verification failed: missing snippet ${snippet}`)
    process.exit(1)
  }
}

console.log('[deep-pet] context reaction comfort verified')
