import type { WorkModeSignals, WorkModeSnapshot, WorkModeState } from '../types/workMode'
import { cloneWorkModeState, readWorkModeState, writeWorkModeState } from './WorkModeStore'

export class WorkModeRuntime {
  private state: WorkModeState

  constructor(initialState?: WorkModeState) {
    this.state = initialState ? cloneWorkModeState(initialState) : readWorkModeState()
  }

  setState(state: WorkModeState) {
    this.state = cloneWorkModeState(state)
  }

  getState(): WorkModeState {
    return cloneWorkModeState(this.state)
  }

  getSignals(now = Date.now()): WorkModeSignals {
    const { config, snapshot } = this.state
    const phaseElapsedMs = snapshot.phaseStartedAt ? Math.max(0, now - snapshot.phaseStartedAt) : 0
    const msRemaining =
      snapshot.phaseEndsAt && ['focus', 'short_break', 'long_break'].includes(snapshot.phase)
        ? Math.max(0, snapshot.phaseEndsAt - now)
        : null

    const totalFocusMsToday =
      snapshot.phase === 'focus' ? snapshot.totalFocusMsToday + phaseElapsedMs : snapshot.totalFocusMsToday

    const overworkThresholdMs = config.overworkReminderMinutes * 60_000
    const overworkLevel =
      totalFocusMsToday >= overworkThresholdMs * 1.5
        ? 'firm'
        : totalFocusMsToday >= overworkThresholdMs
          ? 'gentle'
          : 'none'

    return {
      enabled: config.enabled,
      phase: snapshot.phase,
      isFocusActive: snapshot.phase === 'focus',
      isBreakActive: snapshot.phase === 'short_break' || snapshot.phase === 'long_break',
      isPaused: snapshot.phase === 'paused',
      phaseStartedAt: snapshot.phaseStartedAt,
      phaseElapsedMs,
      msRemaining,
      totalFocusMsToday,
      consecutiveFocusSessions: snapshot.completedFocusSessions,
      overworkLevel,
    }
  }

  startFocus(now = Date.now()): WorkModeState {
    return this.commit(this.buildPhaseState('focus', this.state, now))
  }

  startBreak(now = Date.now(), kind: 'short_break' | 'long_break' = 'short_break'): WorkModeState {
    return this.commit(this.buildPhaseState(kind, this.state, now))
  }

  pause(now = Date.now()): WorkModeState {
    const next = cloneWorkModeState(this.state)
    next.snapshot.phase = 'paused'
    next.snapshot.phaseEndsAt = null
    next.snapshot.updatedAt = now
    return this.commit(next)
  }

  reset(now = Date.now()): WorkModeState {
    const next = cloneWorkModeState(this.state)
    next.snapshot = {
      phase: 'idle',
      phaseStartedAt: null,
      phaseEndsAt: null,
      completedFocusSessions: 0,
      totalFocusMsToday: 0,
      isMutedUntilBreak: false,
      updatedAt: now,
    }
    return this.commit(next)
  }

  tick(now = Date.now()): WorkModeState {
    let next = cloneWorkModeState(this.state)
    const { config, snapshot } = next

    if (!config.enabled) {
      if (snapshot.phase !== 'idle') {
        next.snapshot.phase = 'idle'
        next.snapshot.phaseStartedAt = null
        next.snapshot.phaseEndsAt = null
        next.snapshot.updatedAt = now
        return this.commit(next)
      }
      return next
    }

    if (snapshot.phaseEndsAt && now >= snapshot.phaseEndsAt) {
      if (snapshot.phase === 'focus') {
        if (snapshot.phaseStartedAt) {
          next.snapshot.totalFocusMsToday += Math.max(0, now - snapshot.phaseStartedAt)
        }
        next.snapshot.completedFocusSessions += 1
        const longBreakDue = next.snapshot.completedFocusSessions % config.longBreakEvery === 0
        next = this.buildPhaseState(longBreakDue ? 'long_break' : 'short_break', next, now)
        if (!config.autoStartBreaks) {
          next.snapshot.phase = 'paused'
          next.snapshot.phaseEndsAt = null
        }
        return this.commit(next)
      }

      if (snapshot.phase === 'short_break' || snapshot.phase === 'long_break') {
        next = this.buildPhaseState('focus', next, now)
        if (!config.autoStartFocus) {
          next.snapshot.phase = 'paused'
          next.snapshot.phaseEndsAt = null
        }
        return this.commit(next)
      }
    }

    return this.commit(next, false)
  }

  private buildPhaseState(phase: WorkModeSnapshot['phase'], state: WorkModeState, now: number): WorkModeState {
    const next = cloneWorkModeState(state)
    next.snapshot.phase = phase
    next.snapshot.phaseStartedAt = now
    next.snapshot.phaseEndsAt = phaseDurationMs(phase, next.config, now)
    next.snapshot.updatedAt = now
    if (phase === 'short_break' || phase === 'long_break') {
      next.snapshot.isMutedUntilBreak = false
    }
    return next
  }

  private commit(state: WorkModeState, persist = true): WorkModeState {
    this.state = cloneWorkModeState(state)
    if (persist) {
      this.state = writeWorkModeState(this.state)
    }
    return this.getState()
  }
}

function phaseDurationMs(phase: WorkModeSnapshot['phase'], state: WorkModeState['config'], now: number): number | null {
  switch (phase) {
    case 'focus':
      return now + state.focusMinutes * 60_000
    case 'short_break':
      return now + state.shortBreakMinutes * 60_000
    case 'long_break':
      return now + state.longBreakMinutes * 60_000
    default:
      return null
  }
}
