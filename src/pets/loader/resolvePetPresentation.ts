import type { CompanionSnapshot, StabilizedCompanionSnapshot } from '../../domain/companion/types'
import type {
  BuiltInPetPackage,
  ResolvedPetFallback,
  ResolvedPetPresentation,
  ResolvedPetTransitionPlayback,
} from '../../shared/types/petPackage'

export function resolvePetPresentation(
  snapshot: CompanionSnapshot | StabilizedCompanionSnapshot,
  petPackage: BuiltInPetPackage,
): ResolvedPetPresentation {
  const transientPresentation = resolveTransientPresentation(snapshot, petPackage)
  if (transientPresentation) {
    return transientPresentation
  }

  const petStateKey = resolvePetStateKey(snapshot)
  const resolvedStateKey = resolveBuiltInStateOverride(petStateKey, snapshot, petPackage)
  const config = petPackage.states.states[resolvedStateKey] ?? petPackage.states.states[petStateKey] ?? petPackage.states.states.idle
  const clip = petPackage.animations.clips[config.baseClip]
  const animationState = petPackage.bindings.clipToAnimationState[config.baseClip] ?? 'IDLE'

  return {
    petStateKey: resolvedStateKey,
    clipName: config.baseClip,
    animationState,
    loop: clip?.loop ?? true,
    mode: config.mode,
    minHoldMs: config.minHoldMs,
    additive: clip?.additive ?? [],
    motionProfile: clip?.motionProfile ?? null,
    microMotions: collectMicroMotions(clip?.additive ?? [], petPackage),
    fallback: config.fallbackClip ? resolveFallback(config.fallbackClip, petPackage) : null,
    transitionsFrom: resolveTransitions(config.transitions ?? {}, petPackage),
    snapshot,
  }
}

function resolveBuiltInStateOverride(
  petStateKey: string,
  snapshot: CompanionSnapshot | StabilizedCompanionSnapshot,
  petPackage: BuiltInPetPackage,
): string {
  if (
    snapshot.scene.flags.includes('music_listening') &&
    petPackage.states.states.listening &&
    ['idle', 'browsing', 'coding', 'watching_video', 'thinking'].includes(petStateKey)
  ) {
    return 'listening'
  }

  return petStateKey
}

function resolveTransientPresentation(
  snapshot: CompanionSnapshot | StabilizedCompanionSnapshot,
  petPackage: BuiltInPetPackage,
): ResolvedPetPresentation | null {
  if (snapshot.transientAction === 'none') {
    return null
  }

  const transientConfig = petPackage.states.transientStates?.[snapshot.transientAction]
  if (!transientConfig) {
    return null
  }

  const clip = petPackage.animations.clips[transientConfig.baseClip]
  if (!clip) {
    return null
  }

  return {
    petStateKey: snapshot.transientAction,
    clipName: transientConfig.baseClip,
    animationState: petPackage.bindings.clipToAnimationState[transientConfig.baseClip] ?? 'IDLE',
    loop: clip.loop,
    mode: transientConfig.mode,
    minHoldMs: transientConfig.minHoldMs,
    additive: clip.additive ?? [],
    motionProfile: clip.motionProfile ?? null,
    microMotions: collectMicroMotions(clip.additive ?? [], petPackage),
    fallback: transientConfig.resumeResolvedState
      ? resolveWelcomeBackFallback(snapshot, petPackage)
      : transientConfig.fallbackClip
        ? resolveFallback(transientConfig.fallbackClip, petPackage)
        : null,
    transitionsFrom: {},
    snapshot,
  }
}

function resolveWelcomeBackFallback(
  snapshot: CompanionSnapshot | StabilizedCompanionSnapshot,
  petPackage: BuiltInPetPackage,
): ResolvedPetFallback | null {
  const targetStateKey = resolvePetStateKey({
    ...snapshot,
    transientAction: 'none',
  })
  const targetState = petPackage.states.states[targetStateKey]
  if (!targetState) {
    return resolveFallback('idle_loop', petPackage)
  }

  return resolveFallback(targetState.baseClip, petPackage)
}

function resolveFallback(clipName: string, petPackage: BuiltInPetPackage): ResolvedPetFallback {
  const clip = petPackage.animations.clips[clipName]
  return {
    clipName,
    animationState: petPackage.bindings.clipToAnimationState[clipName] ?? 'IDLE',
    loop: clip?.loop ?? true,
    additive: clip?.additive ?? [],
    motionProfile: clip?.motionProfile ?? null,
    microMotions: collectMicroMotions(clip?.additive ?? [], petPackage),
  }
}

function collectMicroMotions(
  names: string[],
  petPackage: BuiltInPetPackage,
): ResolvedPetPresentation['microMotions'] {
  const microMotions: ResolvedPetPresentation['microMotions'] = {}

  for (const name of names) {
    const config = petPackage.animations.microMotions?.[name]
    if (config) {
      microMotions[name] = config
    }
  }

  return microMotions
}

function resolveTransitions(
  transitions: Record<string, { viaState?: string; clipName?: string }>,
  petPackage: BuiltInPetPackage,
): Record<string, ResolvedPetTransitionPlayback> {
  const resolved: Record<string, ResolvedPetTransitionPlayback> = {}

  for (const [fromStateKey, transition] of Object.entries(transitions)) {
    const resolvedClipName = transition.clipName
      ?? (transition.viaState ? petPackage.states.states[transition.viaState]?.baseClip : undefined)
    if (!resolvedClipName) continue

    const clip = petPackage.animations.clips[resolvedClipName]
    if (!clip) continue

    resolved[fromStateKey] = {
      petStateKey: transition.viaState ?? fromStateKey,
      clipName: resolvedClipName,
      animationState: petPackage.bindings.clipToAnimationState[resolvedClipName] ?? 'IDLE',
      loop: clip.loop,
      additive: clip.additive ?? [],
      motionProfile: clip.motionProfile ?? null,
      microMotions: collectMicroMotions(clip.additive ?? [], petPackage),
    }
  }

  return resolved
}

function resolvePetStateKey(snapshot: CompanionSnapshot | StabilizedCompanionSnapshot): string {
  const workMode = snapshot.workMode

  if (snapshot.transientAction === 'tap_affection') return 'happy'
  if (workMode?.enabled && workMode.isBreakActive) {
    if (workMode.phase === 'long_break') return 'happy'
    if (workMode.overworkLevel === 'firm') return 'sleepy'
    return snapshot.emotion === 'happy' ? 'happy' : 'idle'
  }
  if (workMode?.enabled && workMode.isFocusActive) {
    if (workMode.overworkLevel === 'firm') return 'sleepy'
    if (snapshot.activity === 'coding' || snapshot.activity === 'reading' || snapshot.activity === 'browsing') {
      return 'coding'
    }
    if (snapshot.emotion === 'thinking' || workMode.phaseElapsedMs > 6 * 60_000) {
      return 'thinking'
    }
  }
  if (workMode?.enabled && workMode.overworkLevel === 'gentle' && snapshot.activity === 'idle') return 'sleepy'
  if (workMode?.enabled && workMode.overworkLevel === 'firm') return 'sleepy'
  if (snapshot.emotion === 'sleepy') return 'sleepy'
  if (snapshot.activity === 'coding') return 'coding'
  if (snapshot.activity === 'gaming') return 'gaming'
  if (snapshot.activity === 'watching_video') return 'watching_video'
  if (snapshot.activity === 'chatting') return 'chatting'
  if (snapshot.emotion === 'thinking') return 'thinking'
  if (snapshot.emotion === 'excited') return 'excited'
  if (snapshot.emotion === 'happy') return 'happy'
  return 'idle'
}
