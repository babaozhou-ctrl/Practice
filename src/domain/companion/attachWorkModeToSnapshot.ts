import type { WorkModeSignals } from '../../types/workMode'
import type { CompanionSnapshot } from './types'
import { resolveCompanionScene } from './CompanionScene'

export function attachWorkModeToSnapshot(
  snapshot: CompanionSnapshot,
  workMode: WorkModeSignals | null | undefined,
): CompanionSnapshot {
  const resolvedWorkMode = workMode ?? null

  return {
    ...snapshot,
    workMode: resolvedWorkMode,
    scene: resolveCompanionScene({
      activity: snapshot.activity,
      emotion: snapshot.emotion,
      mode: snapshot.mode,
      activeWindow: snapshot.activeWindow,
      workMode: resolvedWorkMode,
      now: snapshot.timestamp,
    }),
  }
}
