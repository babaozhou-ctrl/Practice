import { resolveCompanionScene } from './CompanionScene'
import type { CompanionActivity, CompanionEmotion, CompanionSnapshot, InteractionMode } from './types'

export function normalizeCompanionMode(
  activity: CompanionActivity,
  mode: InteractionMode,
  emotion: CompanionEmotion,
): InteractionMode {
  if (activity === 'idle') {
    return emotion === 'sleepy' ? 'quiet' : 'observing'
  }

  if (mode === 'focus_guardian' && activity !== 'coding' && activity !== 'reading' && activity !== 'browsing') {
    return 'observing'
  }

  return mode
}

export function normalizeCompanionSnapshot<T extends CompanionSnapshot>(snapshot: T): T {
  const normalizedMode = normalizeCompanionMode(snapshot.activity, snapshot.mode, snapshot.emotion)

  return {
    ...snapshot,
    mode: normalizedMode,
    scene: resolveCompanionScene({
      activity: snapshot.activity,
      emotion: snapshot.emotion,
      mode: normalizedMode,
      activeWindow: snapshot.activeWindow,
      screenContext: snapshot.screenContext,
      workMode: snapshot.workMode ?? null,
      now: snapshot.timestamp,
    }),
  }
}
