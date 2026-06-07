import type { WorkModeSignals } from '../../types/workMode'
import type { CompanionSnapshot } from './types'

export function attachWorkModeToSnapshot(
  snapshot: CompanionSnapshot,
  workMode: WorkModeSignals | null | undefined,
): CompanionSnapshot {
  return {
    ...snapshot,
    workMode: workMode ?? null,
  }
}
