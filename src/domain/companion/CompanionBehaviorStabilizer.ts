import type {
  CompanionActivity,
  CompanionEmotion,
  CompanionSnapshot,
  InteractionMode,
  StabilizedCompanionSnapshot,
} from './types'

interface FieldState<T extends string> {
  active: T
  candidate: T | null
  candidateSince: number
  holdUntil: number
}

const ACTIVITY_HOLD_MS: Record<CompanionActivity, number> = {
  idle: 7_000,
  coding: 12_000,
  gaming: 20_000,
  watching_video: 12_000,
  chatting: 9_000,
  browsing: 8_000,
  reading: 10_000,
  other: 8_000,
}

const EMOTION_HOLD_MS: Record<CompanionEmotion, number> = {
  idle: 6_000,
  sleepy: 18_000,
  happy: 4_000,
  thinking: 7_000,
  excited: 4_500,
}

const MODE_HOLD_MS: Record<InteractionMode, number> = {
  quiet: 15_000,
  observing: 8_000,
  reactive: 7_000,
  proactive: 9_000,
  focus_guardian: 14_000,
}

const ACTIVITY_CANDIDATE_MS: Record<CompanionActivity, number> = {
  idle: 3_500,
  coding: 2_000,
  gaming: 3_500,
  watching_video: 3_000,
  chatting: 2_500,
  browsing: 2_500,
  reading: 2_500,
  other: 3_000,
}

const EMOTION_CANDIDATE_MS: Record<CompanionEmotion, number> = {
  idle: 2_500,
  sleepy: 4_000,
  happy: 1_400,
  thinking: 2_000,
  excited: 1_200,
}

const MODE_CANDIDATE_MS: Record<InteractionMode, number> = {
  quiet: 3_500,
  observing: 2_500,
  reactive: 1_800,
  proactive: 2_500,
  focus_guardian: 2_400,
}

function createFieldState<T extends string>(initial: T, holdMs: number, now: number): FieldState<T> {
  return {
    active: initial,
    candidate: null,
    candidateSince: 0,
    holdUntil: now + holdMs,
  }
}

function shouldForceActivityTransition(current: CompanionActivity, next: CompanionActivity): boolean {
  return (
    (current === 'gaming' && next !== 'gaming') ||
    (current !== 'gaming' && next === 'gaming') ||
    (current === 'coding' && next === 'chatting') ||
    (current === 'chatting' && next === 'coding')
  )
}

function shouldForceEmotionTransition(current: CompanionEmotion, next: CompanionEmotion): boolean {
  return (
    (current === 'sleepy' && next === 'excited') ||
    (current === 'excited' && next === 'sleepy')
  )
}

function shouldForceModeTransition(current: InteractionMode, next: InteractionMode): boolean {
  return (
    (current === 'focus_guardian' && next !== 'focus_guardian') ||
    (current !== 'focus_guardian' && next === 'focus_guardian')
  )
}

function shouldFastRecover(snapshot: CompanionSnapshot): boolean {
  return snapshot.transientAction === 'welcome_back' && (snapshot.activeWindow?.idleMs ?? 0) < 20_000
}

export class CompanionBehaviorStabilizer {
  private activityState: FieldState<CompanionActivity> | null = null
  private emotionState: FieldState<CompanionEmotion> | null = null
  private modeState: FieldState<InteractionMode> | null = null
  private lastStabilizedAt = 0

  stabilize(snapshot: CompanionSnapshot): StabilizedCompanionSnapshot {
    const now = snapshot.timestamp
    const fastRecover = shouldFastRecover(snapshot)

    if (!this.activityState || !this.emotionState || !this.modeState) {
      this.activityState = createFieldState(snapshot.activity, ACTIVITY_HOLD_MS[snapshot.activity], now)
      this.emotionState = createFieldState(snapshot.emotion, EMOTION_HOLD_MS[snapshot.emotion], now)
      this.modeState = createFieldState(snapshot.mode, MODE_HOLD_MS[snapshot.mode], now)
      this.lastStabilizedAt = now

      return {
        ...snapshot,
        rawActivity: snapshot.activity,
        rawEmotion: snapshot.emotion,
        rawMode: snapshot.mode,
        stabilizedAt: now,
      }
    }

    const stabilizedActivity = this.stepField(
      this.activityState,
      snapshot.activity,
      now,
      ACTIVITY_HOLD_MS,
      ACTIVITY_CANDIDATE_MS,
      shouldForceActivityTransition,
      fastRecover,
    )
    const stabilizedEmotion = this.stepField(
      this.emotionState,
      snapshot.emotion,
      now,
      EMOTION_HOLD_MS,
      EMOTION_CANDIDATE_MS,
      shouldForceEmotionTransition,
      fastRecover,
    )
    const stabilizedMode = this.stepField(
      this.modeState,
      snapshot.mode,
      now,
      MODE_HOLD_MS,
      MODE_CANDIDATE_MS,
      shouldForceModeTransition,
      fastRecover,
    )

    this.lastStabilizedAt = now

    return {
      ...snapshot,
      activity: stabilizedActivity,
      emotion: stabilizedEmotion,
      mode: stabilizedMode,
      rawActivity: snapshot.activity,
      rawEmotion: snapshot.emotion,
      rawMode: snapshot.mode,
      stabilizedAt: now,
    }
  }

  private stepField<T extends string>(
    state: FieldState<T>,
    next: T,
    now: number,
    holdMsByValue: Record<T, number>,
    candidateMsByValue: Record<T, number>,
    shouldForce: (current: T, next: T) => boolean,
    fastRecover = false,
  ): T {
    if (next === state.active) {
      state.candidate = null
      state.candidateSince = 0
      return state.active
    }

    if (shouldForce(state.active, next)) {
      state.active = next
      state.candidate = null
      state.candidateSince = 0
      state.holdUntil = now + holdMsByValue[next]
      return state.active
    }

    if (fastRecover) {
      state.active = next
      state.candidate = null
      state.candidateSince = 0
      state.holdUntil = now + Math.min(holdMsByValue[next], 2_000)
      return state.active
    }

    if (now < state.holdUntil) {
      if (state.candidate !== next) {
        state.candidate = next
        state.candidateSince = now
      }
      return state.active
    }

    if (state.candidate !== next) {
      state.candidate = next
      state.candidateSince = now
      return state.active
    }

    const requiredCandidateMs = candidateMsByValue[next]
    if (now - state.candidateSince < requiredCandidateMs) {
      return state.active
    }

    state.active = next
    state.candidate = null
    state.candidateSince = 0
    state.holdUntil = now + holdMsByValue[next]
    return state.active
  }
}
