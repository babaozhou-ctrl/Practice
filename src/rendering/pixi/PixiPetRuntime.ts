import type { AnimationState, FrameData } from '../../types/animation'
import type {
  PetClipMotionProfile,
  PetMicroMotionBlink,
  PetMicroMotionBreath,
  PetMicroMotionCenterShift,
  PetMicroMotionEarTwitch,
  PetMicroMotionTailSway,
  ResolvedPetPresentation,
  ResolvedPetTransitionPlayback,
} from '../../shared/types/petPackage'
import type { RuntimeTextureSet } from './pixelTextureFactory'
import { getPixi } from './pixiVendor'

export interface SpeechController {
  show: (message: string, duration?: number) => void
}

export interface PixiPetRuntimeOptions {
  mount: HTMLElement
  textureSet: RuntimeTextureSet
  speech: SpeechController
  width?: number
  height?: number
  baseScale?: number
}

export interface PixiPetStateSequenceStep {
  state: AnimationState
  holdMs?: number | null
  clipName?: string | null
}

interface BlinkMotionProfile {
  intervalScale: number
  holdScale: number
  closednessScale: number
}

interface EarMotionProfile {
  intervalScale: number
  durationScale: number
  amplitudeScale: number
}

interface TailMotionProfile {
  durationScale: number
  amplitudeScale: number
}

interface MotionBlendProfile {
  bounceScale: number
  breathScale: number
  swayScale: number
  rotationScale: number
  earScale: number
  blinkScale: number
  restOffsetY: number
  settleBlend: number
}

export class PixiPetRuntime {
  private readonly mount: HTMLElement
  private textureSet: RuntimeTextureSet
  private readonly speech: SpeechController
  private readonly width: number
  private readonly height: number
  private readonly baseScale: number
  private readonly baseX: number
  private readonly baseY: number
  private readonly app: any
  private readonly stageRoot: any
  private readonly petRoot: any
  private readonly transitionSprite: any
  private readonly petSprite: any

  private currentState: AnimationState = 'IDLE'
  private currentClipName: string | null = null
  private currentFrameIndex = 0
  private frameElapsedMs = 0
  private globalElapsedMs = 0
  private stateStartedAt = 0
  private presentationStartedAt = 0
  private frameDurations: FrameData[] = []
  private presentation: ResolvedPetPresentation | null = null
  private playbackLoop = true
  private playbackMicroMotions: ResolvedPetPresentation['microMotions'] = {}
  private playbackMotionProfile: PetClipMotionProfile | null = null
  private playbackFallback: ResolvedPetPresentation['fallback'] = null
  private pendingPresentation: ResolvedPetPresentation | null = null
  private blinkWindowStartedAt = 0
  private nextBlinkAt = 0
  private earTwitchStartedAt = 0
  private nextEarTwitchAt = 0
  private transitionActive = false
  private transitionStartedAt = 0
  private transitionDurationMs = 220
  private displayedX: number
  private displayedY: number
  private displayedScaleY = 1
  private displayedRotation = 0
  private lowDistractionMode = false
  private lowDistractionBlend = 0
  private companionPresenceMode: 'quiet' | 'connected' | 'ambient' = 'ambient'
  private displayedPresenceMotionProfile: MotionBlendProfile = resolvePresenceMotionProfile('ambient')
  private stateSequenceToken = 0
  private stateSequenceTimers: number[] = []
  private stateSequenceActiveUntil = 0

  constructor(options: PixiPetRuntimeOptions) {
    const PIXI = getPixi()
    this.mount = options.mount
    this.textureSet = options.textureSet
    this.speech = options.speech
    this.width = options.width ?? 300
    this.height = options.height ?? 420
    this.baseScale = options.baseScale ?? 0.76
    this.baseX = Math.round(this.width / 2)
    this.baseY = this.height - 28

    this.app = new PIXI.Application()
    this.stageRoot = new PIXI.Container()
    this.petRoot = new PIXI.Container()
    this.transitionSprite = new PIXI.Sprite(this.textureSet.texturesByState.IDLE?.[0] ?? PIXI.Texture.EMPTY)
    this.petSprite = new PIXI.Sprite(this.textureSet.texturesByState.IDLE?.[0] ?? PIXI.Texture.EMPTY)
    this.transitionSprite.anchor.set(0.5, 1)
    this.petSprite.anchor.set(0.5, 1)
    this.petRoot.position.set(this.baseX, this.baseY)
    this.transitionSprite.alpha = 0
    this.petRoot.addChild(this.transitionSprite)
    this.petRoot.addChild(this.petSprite)
    this.stageRoot.addChild(this.petRoot)
    this.displayedX = this.baseX
    this.displayedY = this.baseY
  }

  async init() {
    await this.app.init({
      width: this.width,
      height: this.height,
      backgroundAlpha: 0,
      antialias: false,
      autoDensity: true,
      resolution: Math.max(1, window.devicePixelRatio || 1),
      preference: 'webgl',
    })

    this.app.canvas.style.width = `${this.width}px`
    this.app.canvas.style.height = `${this.height}px`
    this.app.canvas.style.position = 'absolute'
    this.app.canvas.style.left = '0'
    this.app.canvas.style.top = '0'
    this.app.canvas.style.cursor = 'grab'
    this.app.canvas.style.userSelect = 'none'
    this.app.canvas.style.imageRendering = 'pixelated'

    this.mount.appendChild(this.app.canvas)
    this.app.stage.addChild(this.stageRoot)
    this.setState('IDLE')

    this.app.ticker.add((ticker: any) => {
      const deltaMs = ticker.deltaMS ?? 16
      this.update(deltaMs)
    })
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement
  }

  setState(nextState: AnimationState, clipName?: string) {
    const PIXI = getPixi()
    const playback = this.resolvePlaybackSource(nextState, clipName)
    if (!playback) return

    const shouldTransition =
      this.currentState !== nextState &&
      this.petSprite.texture &&
      this.petSprite.texture !== PIXI.Texture.EMPTY

    if (shouldTransition) {
      this.transitionSprite.texture = this.petSprite.texture
      this.transitionSprite.alpha = 1
      this.transitionActive = true
      this.transitionStartedAt = this.globalElapsedMs
      this.petSprite.alpha = 0
    } else {
      this.transitionActive = false
      this.transitionSprite.alpha = 0
      this.petSprite.alpha = 1
    }

    this.currentState = nextState
    this.currentClipName = playback.clipName
    this.currentFrameIndex = 0
    this.frameElapsedMs = 0
    this.stateStartedAt = this.globalElapsedMs
    this.frameDurations = playback.frames
    this.petSprite.texture = playback.textures[0]
  }

  flashState(nextState: AnimationState, holdMs: number, fallbackState: AnimationState = 'IDLE') {
    this.setState(nextState)
    window.setTimeout(() => {
      if (this.currentState === nextState) {
        this.setState(fallbackState)
      }
    }, holdMs)
  }

  playStateSequence(steps: PixiPetStateSequenceStep[]) {
    if (!steps.length) {
      this.clearStateSequence()
      return
    }

    this.clearStateSequence(false)
    this.stateSequenceToken += 1
    const token = this.stateSequenceToken
    const hasIndefiniteHold = steps.some((step) => step.holdMs == null)
    const totalDuration = hasIndefiniteHold
      ? Number.POSITIVE_INFINITY
      : steps.reduce((sum, step) => sum + Math.max(0, step.holdMs ?? 0), 0)
    this.stateSequenceActiveUntil = hasIndefiniteHold ? Number.POSITIVE_INFINITY : Date.now() + totalDuration

    let elapsed = 0
    for (const [index, step] of steps.entries()) {
      const runStep = () => {
        if (token !== this.stateSequenceToken) return
        this.setState(step.state, step.clipName ?? undefined)

        if (index === steps.length - 1 && step.holdMs != null) {
          const finishTimer = window.setTimeout(() => {
            if (token !== this.stateSequenceToken) return
            this.stateSequenceActiveUntil = 0
            this.resumePresentationPlayback()
          }, Math.max(0, step.holdMs))
          this.stateSequenceTimers.push(finishTimer)
        }
      }

      const timer = window.setTimeout(runStep, elapsed)
      this.stateSequenceTimers.push(timer)
      if (step.holdMs == null) {
        break
      }
      elapsed += Math.max(0, step.holdMs)
    }
  }

  clearStateSequence(resumePresentation = true) {
    this.stateSequenceToken += 1
    this.stateSequenceActiveUntil = 0
    for (const timer of this.stateSequenceTimers) {
      window.clearTimeout(timer)
    }
    this.stateSequenceTimers = []

    if (resumePresentation) {
      this.resumePresentationPlayback()
    }
  }

  applyPresentation(presentation: ResolvedPetPresentation) {
    if (this.isStateSequenceActive()) {
      this.presentation = presentation
      return
    }

    const previousPresentation = this.presentation
    if (
      previousPresentation &&
      previousPresentation.petStateKey !== presentation.petStateKey &&
      previousPresentation.snapshot.transientAction === 'none' &&
      presentation.snapshot.transientAction === 'none'
    ) {
      const heldFor = this.globalElapsedMs - this.presentationStartedAt
      if (heldFor < previousPresentation.minHoldMs) {
        this.presentation = {
          ...previousPresentation,
          snapshot: presentation.snapshot,
        }
        return
      }
    }

    const samePresentation =
      this.presentation?.petStateKey === presentation.petStateKey &&
      this.presentation?.clipName === presentation.clipName &&
      this.presentation?.snapshot.transientAction === presentation.snapshot.transientAction

    this.presentation = presentation

    if (samePresentation && presentation.snapshot.transientAction !== 'tap_affection') {
      return
    }

    this.presentationStartedAt = this.globalElapsedMs
    const transition = previousPresentation
      ? presentation.transitionsFrom[previousPresentation.petStateKey]
      : null

    if (transition && previousPresentation?.petStateKey !== presentation.petStateKey) {
      this.pendingPresentation = presentation
      this.activateTransitionPlayback(transition)
      return
    }

    this.pendingPresentation = null
    this.activatePlayback(
      presentation.animationState,
      presentation.clipName,
      presentation.loop,
      presentation.motionProfile,
      presentation.microMotions,
      presentation.fallback,
    )
  }

  destroy() {
    this.clearStateSequence(false)
    this.app.destroy(true, { children: true })
  }

  replaceTextureSet(textureSet: RuntimeTextureSet) {
    this.textureSet = textureSet
    const playback = this.resolvePlaybackSource(this.currentState, this.currentClipName ?? undefined)
    if (playback) {
      this.currentFrameIndex = 0
      this.frameElapsedMs = 0
      this.frameDurations = playback.frames
      this.petSprite.texture = playback.textures[0]
      this.transitionSprite.texture = playback.textures[0]
    }
  }

  setLowDistractionMode(enabled: boolean) {
    this.lowDistractionMode = enabled
  }

  setCompanionPresenceMode(mode: 'quiet' | 'connected' | 'ambient') {
    this.companionPresenceMode = mode
  }

  private update(deltaMs: number) {
    this.globalElapsedMs += deltaMs
    this.updateRuntimeMotionState(deltaMs)

    if (!this.isStateSequenceActive() && this.stateSequenceActiveUntil !== 0) {
      this.stateSequenceActiveUntil = 0
      this.resumePresentationPlayback()
    }

    const playback = this.resolvePlaybackSource(this.currentState, this.currentClipName ?? undefined)
    const textures = playback?.textures
    const frames = this.frameDurations
    if (textures && textures.length > 0 && frames.length > 0) {
      this.frameElapsedMs += deltaMs
      const currentFrame = frames[this.currentFrameIndex]
      if (this.frameElapsedMs >= currentFrame.duration) {
        this.frameElapsedMs = 0
        const nextFrameIndex = this.currentFrameIndex + 1

        if (nextFrameIndex < textures.length) {
          this.currentFrameIndex = nextFrameIndex
          this.petSprite.texture = textures[this.currentFrameIndex]
        } else if (this.playbackLoop) {
          this.currentFrameIndex = 0
          this.petSprite.texture = textures[0]
        } else if (
          this.pendingPresentation &&
          (this.currentState !== this.pendingPresentation.animationState ||
            this.currentClipName !== this.pendingPresentation.clipName)
        ) {
          const pending = this.pendingPresentation
          this.pendingPresentation = null
          this.activatePlayback(
            pending.animationState,
            pending.clipName,
            pending.loop,
            pending.motionProfile,
            pending.microMotions,
            pending.fallback,
          )
        } else if (this.playbackFallback) {
          const fallback = this.playbackFallback
          this.activatePlayback(
            fallback.animationState,
            fallback.clipName,
            fallback.loop,
            fallback.motionProfile,
            fallback.microMotions,
            null,
          )
        } else {
          this.currentFrameIndex = textures.length - 1
          this.petSprite.texture = textures[this.currentFrameIndex]
        }
      }
    }

    this.updateTransition()
    this.applyMicroMotion()
  }

  private updateRuntimeMotionState(deltaMs: number) {
    const smoothingAlpha = Math.min(0.18, Math.max(0.04, deltaMs / 220))
    const targetLowDistractionBlend = this.lowDistractionMode ? 1 : 0
    this.lowDistractionBlend = lerp(this.lowDistractionBlend, targetLowDistractionBlend, smoothingAlpha)
    if (Math.abs(this.lowDistractionBlend - targetLowDistractionBlend) < 0.001) {
      this.lowDistractionBlend = targetLowDistractionBlend
    }

    this.displayedPresenceMotionProfile = blendMotionProfiles(
      this.displayedPresenceMotionProfile,
      resolvePresenceMotionProfile(this.companionPresenceMode),
      smoothingAlpha,
    )
  }

  private applyMicroMotion() {
    const t = this.globalElapsedMs
    const sway = Math.sin(t / 2200) * 0.28
    const emotion = this.presentation?.snapshot.emotion ?? 'idle'
    const mode = this.presentation?.snapshot.mode ?? 'observing'
    const activity = this.presentation?.snapshot.activity ?? 'idle'
    const scene = this.presentation?.snapshot.scene
    const workMode = this.presentation?.snapshot.workMode ?? null
    const micro = this.playbackMicroMotions

    let bounce = 0
    let extraScaleY = Math.sin(t / 980) * 0.0045
    let extraSway = sway
    let extraRotate = Math.sin(t / 2800) * 0.0028
    let extraYOffset = 0
    let blinkScaleY = 1

    if (emotion === 'happy' || emotion === 'excited') {
      bounce = Math.abs(Math.sin(t / 260)) * 2.2
      extraScaleY = 0.008 + Math.sin(t / 420) * 0.01
    } else if (emotion === 'thinking' || activity === 'watching_video') {
      bounce = Math.sin(t / 1500) * 0.28
      extraRotate = Math.sin(t / 2100) * 0.0045
    } else if (emotion === 'sleepy') {
      bounce = Math.sin(t / 1900) * 0.18
      extraScaleY = Math.sin(t / 1400) * 0.004
      extraSway = Math.sin(t / 2800) * 0.18
    }

    if (mode === 'quiet') {
      bounce *= 0.18
      extraRotate *= 0.28
      extraSway *= 0.34
      extraScaleY *= 0.52
    } else if (mode === 'observing') {
      bounce *= 0.34
      extraRotate *= 0.4
      extraSway *= 0.42
      extraScaleY *= 0.74
    }

    const clipMotion = this.playbackMotionProfile
    if (clipMotion) {
      const bouncePeriodMs = clipMotion.bouncePeriodMs ?? 720
      const swayPeriodMs = clipMotion.swayPeriodMs ?? 1300
      const rotatePeriodMs = clipMotion.rotatePeriodMs ?? 1700
      const scaleYPeriodMs = clipMotion.scaleYPeriodMs ?? 520
      const clipBounceWave = clipMotion.bounceStyle === 'pulse'
        ? Math.abs(Math.sin(t / Math.max(1, bouncePeriodMs)))
        : Math.sin(t / Math.max(1, bouncePeriodMs))
      const clipSwayWave = Math.sin(t / Math.max(1, swayPeriodMs))
      const clipRotateWave = Math.sin(t / Math.max(1, rotatePeriodMs))
      const clipScaleWave = Math.sin(t / Math.max(1, scaleYPeriodMs))

      extraYOffset += clipMotion.restOffsetY ?? 0
      bounce += clipBounceWave * (clipMotion.bouncePx ?? 0)
      extraSway += clipSwayWave * (clipMotion.swayPx ?? 0)
      extraRotate += degreesToRadians((clipMotion.rotateDeg ?? 0) * clipRotateWave)
      extraScaleY += clipScaleWave * (clipMotion.scaleYAmount ?? 0)
    }

    const workModeMotion = resolveWorkModeMotionProfile(workMode, this.lowDistractionBlend)
    const sceneMotion = resolveSceneMotionProfile(scene, this.lowDistractionBlend)
    const presenceMotion = this.displayedPresenceMotionProfile
    const blinkMotion = resolveBlinkMotionProfile(workMode, scene, this.companionPresenceMode, this.lowDistractionBlend)
    const earMotion = resolveEarMotionProfile(workMode, scene, this.companionPresenceMode, this.lowDistractionBlend)
    const tailMotion = resolveTailMotionProfile(workMode, scene, this.companionPresenceMode, this.lowDistractionBlend)
    const motionProfile = mergeMotionProfiles(
      mergeMotionProfiles(workModeMotion, sceneMotion),
      presenceMotion,
    )
    bounce *= motionProfile.bounceScale
    extraScaleY *= motionProfile.breathScale
    extraSway *= motionProfile.swayScale
    extraRotate *= motionProfile.rotationScale

    const breathMotion = micro.breath ? this.computeBreath(micro.breath as PetMicroMotionBreath, t) : 0
    const centerShift = micro.center_shift
      ? this.computeCenterShift(micro.center_shift as PetMicroMotionCenterShift, t)
      : 0
    const tailRotation = micro.tail_sway
      ? this.computeTailSway(micro.tail_sway as PetMicroMotionTailSway, t, tailMotion)
      : 0
    const earRotation = micro.ear_twitch
      ? this.computeEarTwitch(micro.ear_twitch as PetMicroMotionEarTwitch, t, earMotion)
      : 0
    blinkScaleY = micro.blink ? this.computeBlinkScale(micro.blink as PetMicroMotionBlink, t, blinkMotion) : 1
    extraYOffset += breathMotion * motionProfile.breathScale
    extraSway += centerShift * motionProfile.swayScale
    extraRotate += tailRotation * motionProfile.rotationScale + earRotation * motionProfile.earScale
    blinkScaleY = 1 - (1 - blinkScaleY) * motionProfile.blinkScale
    extraYOffset += motionProfile.restOffsetY

    if (workMode?.enabled && workMode.overworkLevel === 'firm') {
      extraYOffset += 1.2
    } else if (workMode?.enabled && workMode.overworkLevel === 'gentle') {
      extraYOffset += 0.5
    }

    const targetX = this.baseX + extraSway
    const targetY = this.baseY + extraYOffset - bounce
    const targetScaleY = 1 + extraScaleY
    const transitionBlend = clipMotion?.settleAlpha
      ? Math.min(0.4, Math.max(0.08, clipMotion.settleAlpha))
      : this.transitionActive ? 0.14 : motionProfile.settleBlend

    this.displayedX = lerp(this.displayedX, targetX, transitionBlend)
    this.displayedY = lerp(this.displayedY, targetY, transitionBlend)
    this.displayedScaleY = lerp(this.displayedScaleY, targetScaleY, transitionBlend)
    this.displayedRotation = lerp(this.displayedRotation, extraRotate, transitionBlend)

    this.petRoot.position.set(this.displayedX, this.displayedY)
    this.petRoot.scale.set(this.baseScale, this.baseScale * this.displayedScaleY)
    this.petRoot.rotation = this.displayedRotation
    this.petSprite.scale.set(1, blinkScaleY)
    this.transitionSprite.scale.set(1, blinkScaleY)
  }

  private computeBreath(config: PetMicroMotionBreath, elapsedMs: number): number {
    return interpolateSequence(config.offsetY, elapsedMs, config.durationMs)
  }

  private computeCenterShift(config: PetMicroMotionCenterShift, elapsedMs: number): number {
    return interpolateSequence(config.offsetX, elapsedMs, config.durationMs)
  }

  private computeTailSway(config: PetMicroMotionTailSway, elapsedMs: number, profile: TailMotionProfile): number {
    const durationMs = Math.max(120, Math.round(config.durationMs * profile.durationScale))
    return degreesToRadians(interpolateSequence(config.rotationDeg, elapsedMs, durationMs) * profile.amplitudeScale)
  }

  private computeEarTwitch(config: PetMicroMotionEarTwitch, elapsedMs: number, profile: EarMotionProfile): number {
    if (this.nextEarTwitchAt === 0) {
      this.nextEarTwitchAt = elapsedMs + midpoint(config.intervalMs) * profile.intervalScale
    }
    if (elapsedMs >= this.nextEarTwitchAt && this.earTwitchStartedAt === 0) {
      this.earTwitchStartedAt = elapsedMs
    }
    if (this.earTwitchStartedAt === 0) return 0

    const localElapsed = elapsedMs - this.earTwitchStartedAt
    const duration = Math.max(180, Math.round(420 * profile.durationScale))
    if (localElapsed >= duration) {
      this.earTwitchStartedAt = 0
      this.nextEarTwitchAt = elapsedMs + midpoint(config.intervalMs) * profile.intervalScale
      return 0
    }

    return degreesToRadians(interpolateSequence(config.rotationDeg, localElapsed, duration) * profile.amplitudeScale)
  }

  private computeBlinkScale(config: PetMicroMotionBlink, elapsedMs: number, profile: BlinkMotionProfile): number {
    if (this.nextBlinkAt === 0) {
      this.nextBlinkAt = elapsedMs + midpoint(config.intervalMs) * profile.intervalScale
    }
    if (elapsedMs >= this.nextBlinkAt && this.blinkWindowStartedAt === 0) {
      this.blinkWindowStartedAt = elapsedMs
    }
    if (this.blinkWindowStartedAt === 0) return 1

    const localElapsed = elapsedMs - this.blinkWindowStartedAt
    const holdMs = Math.max(35, Math.round(config.holdMs * profile.holdScale))
    if (localElapsed >= holdMs * 2) {
      this.blinkWindowStartedAt = 0
      this.nextBlinkAt = elapsedMs + midpoint(config.intervalMs) * profile.intervalScale
      return 1
    }

    const closing = localElapsed < holdMs
      ? localElapsed / Math.max(holdMs, 1)
      : 1 - (localElapsed - holdMs) / Math.max(holdMs, 1)

    return Math.max(0.12, 1 - closing * 0.9 * profile.closednessScale)
  }

  private activatePlayback(
    state: AnimationState,
    clipName: string,
    loop: boolean,
    motionProfile: PetClipMotionProfile | null,
    microMotions: ResolvedPetPresentation['microMotions'],
    fallback: ResolvedPetPresentation['fallback'],
  ) {
    this.playbackLoop = loop
    this.playbackMotionProfile = motionProfile
    this.playbackMicroMotions = microMotions
    this.playbackFallback = fallback
    this.setState(state, clipName)
  }

  private activateTransitionPlayback(transition: ResolvedPetTransitionPlayback) {
    this.playbackLoop = false
    this.playbackMotionProfile = transition.motionProfile
    this.playbackMicroMotions = transition.microMotions
    this.playbackFallback = null
    this.setState(transition.animationState, transition.clipName)
  }

  private resolvePlaybackSource(state: AnimationState, clipName?: string) {
    if (clipName) {
      const clipTextures = this.textureSet.texturesByClip[clipName]
      const clipFrames = this.textureSet.framesByClip[clipName]
      if (clipTextures && clipTextures.length > 0 && clipFrames && clipFrames.length > 0) {
        return {
          clipName,
          textures: clipTextures,
          frames: clipFrames,
        }
      }
    }

    const stateTextures = this.textureSet.texturesByState[state]
    const stateFrames = this.textureSet.framesByState[state]
    if (stateTextures && stateTextures.length > 0 && stateFrames && stateFrames.length > 0) {
      return {
        clipName: clipName ?? state,
        textures: stateTextures,
        frames: stateFrames,
      }
    }

    return null
  }

  private updateTransition() {
    if (!this.transitionActive) {
      this.petSprite.alpha = 1
      this.transitionSprite.alpha = 0
      return
    }

    const elapsed = this.globalElapsedMs - this.transitionStartedAt
    const progress = Math.min(1, Math.max(0, elapsed / this.transitionDurationMs))
    const eased = easeOutCubic(progress)

    this.petSprite.alpha = eased
    this.transitionSprite.alpha = 1 - eased

    if (progress >= 1) {
      this.transitionActive = false
      this.transitionSprite.alpha = 0
      this.petSprite.alpha = 1
    }
  }

  private isStateSequenceActive() {
    return this.stateSequenceActiveUntil > Date.now()
  }

  private resumePresentationPlayback() {
    if (!this.presentation) {
      return
    }

    this.activatePlayback(
      this.presentation.animationState,
      this.presentation.clipName,
      this.presentation.loop,
      this.presentation.motionProfile,
      this.presentation.microMotions,
      this.presentation.fallback,
    )
  }
}

function interpolateSequence(values: number[], elapsedMs: number, durationMs: number): number {
  if (values.length === 0) return 0
  if (values.length === 1 || durationMs <= 0) return values[0]

  const normalized = ((elapsedMs % durationMs) + durationMs) % durationMs
  const step = durationMs / (values.length - 1)
  const index = Math.min(values.length - 2, Math.floor(normalized / step))
  const localProgress = (normalized - index * step) / step
  return values[index] + (values[index + 1] - values[index]) * localProgress
}

function midpoint(range: [number, number]): number {
  return Math.round((range[0] + range[1]) / 2)
}

function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3)
}

function resolveWorkModeMotionProfile(
  workMode: ResolvedPetPresentation['snapshot']['workMode'],
  lowDistractionBlend: number,
) {
  const lowDistractionMultiplier = {
    bounceScale: lerp(1, 0.58, lowDistractionBlend),
    breathScale: lerp(1, 0.68, lowDistractionBlend),
    swayScale: lerp(1, 0.58, lowDistractionBlend),
    rotationScale: lerp(1, 0.5, lowDistractionBlend),
    earScale: lerp(1, 0.52, lowDistractionBlend),
    blinkScale: lerp(1, 0.96, lowDistractionBlend),
  }

  const baseProfile = resolveBaseWorkModeMotionProfile(workMode)
  return {
    bounceScale: baseProfile.bounceScale * lowDistractionMultiplier.bounceScale,
    breathScale: baseProfile.breathScale * lowDistractionMultiplier.breathScale,
    swayScale: baseProfile.swayScale * lowDistractionMultiplier.swayScale,
    rotationScale: baseProfile.rotationScale * lowDistractionMultiplier.rotationScale,
    earScale: baseProfile.earScale * lowDistractionMultiplier.earScale,
    blinkScale: baseProfile.blinkScale * lowDistractionMultiplier.blinkScale,
    restOffsetY: 0,
    settleBlend: lerp(0.22, 0.16, lowDistractionBlend),
  }
}

function resolveBaseWorkModeMotionProfile(workMode: ResolvedPetPresentation['snapshot']['workMode']) {
  if (!workMode?.enabled) {
    return {
      bounceScale: 0.4,
      breathScale: 0.62,
      swayScale: 0.38,
      rotationScale: 0.3,
      earScale: 0.55,
      blinkScale: 1,
      restOffsetY: 0,
      settleBlend: 0.18,
    }
  }

  if (workMode.isBreakActive) {
    if (workMode.phase === 'long_break') {
      return {
        bounceScale: 0.68,
        breathScale: 0.84,
        swayScale: 0.62,
        rotationScale: 0.56,
        earScale: 0.78,
        blinkScale: 1.08,
        restOffsetY: -0.4,
        settleBlend: 0.21,
      }
    }

    return {
      bounceScale: 0.54,
      breathScale: 0.78,
      swayScale: 0.56,
      rotationScale: 0.48,
      earScale: 0.66,
      blinkScale: 1.04,
      restOffsetY: -0.2,
      settleBlend: 0.2,
    }
  }

  if (workMode.isFocusActive) {
    if (workMode.overworkLevel === 'firm') {
      return {
        bounceScale: 0.38,
        breathScale: 0.7,
        swayScale: 0.45,
        rotationScale: 0.42,
        earScale: 0.58,
        blinkScale: 1.24,
        restOffsetY: 0.35,
        settleBlend: 0.18,
      }
    }

    if (workMode.overworkLevel === 'gentle') {
      return {
        bounceScale: 0.55,
        breathScale: 0.82,
        swayScale: 0.58,
        rotationScale: 0.62,
        earScale: 0.72,
        blinkScale: 1.16,
        restOffsetY: 0.15,
        settleBlend: 0.2,
      }
    }

    return {
      bounceScale: 0.34,
      breathScale: 0.56,
      swayScale: 0.34,
      rotationScale: 0.36,
      earScale: 0.42,
      blinkScale: 0.92,
      restOffsetY: 0,
      settleBlend: 0.17,
    }
  }

  if (workMode.overworkLevel === 'firm') {
    return {
      bounceScale: 0.48,
      breathScale: 0.8,
      swayScale: 0.6,
      rotationScale: 0.58,
      earScale: 0.74,
      blinkScale: 1.2,
      restOffsetY: 0.2,
      settleBlend: 0.19,
    }
  }

  return {
    bounceScale: 0.5,
    breathScale: 0.72,
    swayScale: 0.52,
    rotationScale: 0.46,
    earScale: 0.68,
    blinkScale: 1,
    restOffsetY: 0,
    settleBlend: 0.18,
  }
}

function resolveSceneMotionProfile(
  scene: ResolvedPetPresentation['snapshot']['scene'] | null | undefined,
  lowDistractionBlend: number,
) {
  const quietMultiplier = lerp(1, 0.88, lowDistractionBlend)

  if (!scene) {
      return {
        bounceScale: quietMultiplier,
        breathScale: quietMultiplier,
        swayScale: quietMultiplier,
        rotationScale: quietMultiplier,
        earScale: quietMultiplier,
        blinkScale: 1,
        restOffsetY: 0,
        settleBlend: lerp(0.22, 0.18, lowDistractionBlend),
      }
  }

  switch (scene.id) {
    case 'away':
      return {
        bounceScale: 0.18,
        breathScale: 0.52,
        swayScale: 0.12,
        rotationScale: 0.12,
        earScale: 0.18,
        blinkScale: 1.28,
        restOffsetY: 0.8,
        settleBlend: 0.12,
      }
    case 'deep_focus':
      return {
        bounceScale: 0.34 * quietMultiplier,
        breathScale: 0.74 * quietMultiplier,
        swayScale: 0.26 * quietMultiplier,
        rotationScale: 0.28 * quietMultiplier,
        earScale: 0.36 * quietMultiplier,
        blinkScale: 1.08,
        restOffsetY: 0.1,
        settleBlend: 0.15,
      }
    case 'steady_focus':
      return {
        bounceScale: 0.48 * quietMultiplier,
        breathScale: 0.82 * quietMultiplier,
        swayScale: 0.42 * quietMultiplier,
        rotationScale: 0.4 * quietMultiplier,
        earScale: 0.5 * quietMultiplier,
        blinkScale: 1.04,
        restOffsetY: 0,
        settleBlend: 0.18,
      }
    case 'watch_together':
      return {
        bounceScale: 0.64 * quietMultiplier,
        breathScale: 0.94,
        swayScale: 0.78,
        rotationScale: 0.68,
        earScale: 0.8,
        blinkScale: 0.98,
        restOffsetY: -0.12,
        settleBlend: 0.24,
      }
    case 'social_corner':
      return {
        bounceScale: 0.76 * quietMultiplier,
        breathScale: 1,
        swayScale: 0.92 * quietMultiplier,
        rotationScale: 0.84 * quietMultiplier,
        earScale: 1,
        blinkScale: 0.94,
        restOffsetY: -0.18,
        settleBlend: 0.26,
      }
    case 'play_session':
      return {
        bounceScale: 0.44 * quietMultiplier,
        breathScale: 0.78,
        swayScale: 0.32 * quietMultiplier,
        rotationScale: 0.34 * quietMultiplier,
        earScale: 0.42 * quietMultiplier,
        blinkScale: 0.9,
        restOffsetY: -0.06,
        settleBlend: 0.16,
      }
    case 'reading_nook':
      return {
        bounceScale: 0.3 * quietMultiplier,
        breathScale: 0.72,
        swayScale: 0.22 * quietMultiplier,
        rotationScale: 0.24 * quietMultiplier,
        earScale: 0.34 * quietMultiplier,
        blinkScale: 1.12,
        restOffsetY: 0,
        settleBlend: 0.15,
      }
    case 'late_night_wind_down':
      return {
        bounceScale: 0.22,
        breathScale: 0.62,
        swayScale: 0.18,
        rotationScale: 0.16,
        earScale: 0.24,
        blinkScale: 1.22,
        restOffsetY: 0.25,
        settleBlend: 0.13,
      }
    case 'quiet_idle':
      return {
        bounceScale: 0.28 * quietMultiplier,
        breathScale: 0.7,
        swayScale: 0.24 * quietMultiplier,
        rotationScale: 0.22 * quietMultiplier,
        earScale: 0.34 * quietMultiplier,
        blinkScale: 1.12,
        restOffsetY: 0.08,
        settleBlend: 0.16,
      }
    case 'soft_browsing':
      return {
        bounceScale: 0.54 * quietMultiplier,
        breathScale: 0.88,
        swayScale: 0.66 * quietMultiplier,
        rotationScale: 0.6 * quietMultiplier,
        earScale: 0.72 * quietMultiplier,
        blinkScale: 1,
        restOffsetY: 0,
        settleBlend: 0.22,
      }
    default:
      return {
        bounceScale: 0.46 * quietMultiplier,
        breathScale: 0.8,
        swayScale: 0.5 * quietMultiplier,
        rotationScale: 0.46 * quietMultiplier,
        earScale: 0.58 * quietMultiplier,
        blinkScale: 1,
        restOffsetY: 0,
        settleBlend: lerp(0.22, 0.18, lowDistractionBlend),
      }
  }
}

function resolvePresenceMotionProfile(mode: 'quiet' | 'connected' | 'ambient') {
  switch (mode) {
    case 'quiet':
      return {
        bounceScale: 0.5,
        breathScale: 0.72,
        swayScale: 0.52,
        rotationScale: 0.42,
        earScale: 0.54,
        blinkScale: 1.06,
        restOffsetY: 0.05,
        settleBlend: 0.12,
      }
    case 'connected':
      return {
        bounceScale: 0.88,
        breathScale: 0.94,
        swayScale: 0.82,
        rotationScale: 0.78,
        earScale: 0.92,
        blinkScale: 0.98,
        restOffsetY: 0,
        settleBlend: 0.18,
      }
    default:
      return {
        bounceScale: 0.72,
        breathScale: 0.82,
        swayScale: 0.68,
        rotationScale: 0.62,
        earScale: 0.72,
        blinkScale: 1,
        restOffsetY: 0,
        settleBlend: 0.16,
      }
  }
}

function resolveBlinkMotionProfile(
  workMode: ResolvedPetPresentation['snapshot']['workMode'],
  scene: ResolvedPetPresentation['snapshot']['scene'] | null | undefined,
  presenceMode: 'quiet' | 'connected' | 'ambient',
  lowDistractionBlend: number,
): BlinkMotionProfile {
  let intervalScale = 1
  let holdScale = 1
  let closednessScale = 1

  if (presenceMode === 'quiet') {
    intervalScale *= 1.18
    holdScale *= 1.08
  } else if (presenceMode === 'connected') {
    intervalScale *= 0.9
    holdScale *= 0.94
    closednessScale *= 0.96
  }

  intervalScale *= lerp(1, 1.08, lowDistractionBlend)
  holdScale *= lerp(1, 1.04, lowDistractionBlend)

  if (scene?.id === 'late_night_wind_down' || scene?.id === 'quiet_idle' || scene?.id === 'reading_nook') {
    intervalScale *= 1.18
    holdScale *= 1.12
  }

  if (scene?.id === 'social_corner' || scene?.id === 'watch_together') {
    intervalScale *= 0.92
    holdScale *= 0.94
  }

  if (workMode?.enabled && workMode.isFocusActive) {
    intervalScale *= 1.08
    holdScale *= 1.04
  }

  if (workMode?.enabled && workMode.isBreakActive) {
    intervalScale *= 0.94
    holdScale *= 0.96
  }

  if (workMode?.enabled && workMode.overworkLevel === 'gentle') {
    intervalScale *= 1.12
    holdScale *= 1.08
  }

  if (workMode?.enabled && workMode.overworkLevel === 'firm') {
    intervalScale *= 1.24
    holdScale *= 1.18
    closednessScale *= 1.08
  }

  return {
    intervalScale: clamp(intervalScale, 0.72, 1.5),
    holdScale: clamp(holdScale, 0.82, 1.32),
    closednessScale: clamp(closednessScale, 0.84, 1.18),
  }
}

function resolveEarMotionProfile(
  workMode: ResolvedPetPresentation['snapshot']['workMode'],
  scene: ResolvedPetPresentation['snapshot']['scene'] | null | undefined,
  presenceMode: 'quiet' | 'connected' | 'ambient',
  lowDistractionBlend: number,
): EarMotionProfile {
  let intervalScale = 1
  let durationScale = 1
  let amplitudeScale = 1

  if (presenceMode === 'quiet') {
    intervalScale *= 1.3
    durationScale *= 1.06
    amplitudeScale *= 0.74
  } else if (presenceMode === 'connected') {
    intervalScale *= 0.84
    durationScale *= 0.94
    amplitudeScale *= 1.14
  }

  intervalScale *= lerp(1, 1.1, lowDistractionBlend)
  amplitudeScale *= lerp(1, 0.88, lowDistractionBlend)

  if (scene?.id === 'social_corner' || scene?.id === 'watch_together') {
    intervalScale *= 0.88
    amplitudeScale *= 1.08
  }

  if (scene?.id === 'deep_focus' || scene?.id === 'steady_focus' || scene?.id === 'late_night_wind_down') {
    intervalScale *= 1.16
    amplitudeScale *= 0.8
  }

  if (workMode?.enabled && workMode.isBreakActive) {
    intervalScale *= 0.94
    amplitudeScale *= 1.06
  }

  if (workMode?.enabled && workMode.isFocusActive) {
    intervalScale *= 1.1
    amplitudeScale *= 0.86
  }

  if (workMode?.enabled && workMode.overworkLevel === 'firm') {
    intervalScale *= 1.18
    durationScale *= 1.08
    amplitudeScale *= 0.76
  }

  return {
    intervalScale: clamp(intervalScale, 0.72, 1.6),
    durationScale: clamp(durationScale, 0.82, 1.2),
    amplitudeScale: clamp(amplitudeScale, 0.58, 1.24),
  }
}

function resolveTailMotionProfile(
  workMode: ResolvedPetPresentation['snapshot']['workMode'],
  scene: ResolvedPetPresentation['snapshot']['scene'] | null | undefined,
  presenceMode: 'quiet' | 'connected' | 'ambient',
  lowDistractionBlend: number,
): TailMotionProfile {
  let durationScale = 1
  let amplitudeScale = 1

  if (presenceMode === 'quiet') {
    durationScale *= 1.16
    amplitudeScale *= 0.82
  } else if (presenceMode === 'connected') {
    durationScale *= 0.92
    amplitudeScale *= 1.12
  }

  durationScale *= lerp(1, 1.06, lowDistractionBlend)
  amplitudeScale *= lerp(1, 0.9, lowDistractionBlend)

  if (scene?.id === 'watch_together' || scene?.id === 'soft_browsing') {
    amplitudeScale *= 1.06
  }

  if (scene?.id === 'deep_focus' || scene?.id === 'reading_nook' || scene?.id === 'quiet_idle') {
    durationScale *= 1.08
    amplitudeScale *= 0.88
  }

  if (workMode?.enabled && workMode.isBreakActive) {
    durationScale *= 0.96
    amplitudeScale *= 1.04
  }

  if (workMode?.enabled && workMode.isFocusActive) {
    durationScale *= 1.06
    amplitudeScale *= 0.84
  }

  if (workMode?.enabled && workMode.overworkLevel === 'firm') {
    durationScale *= 1.12
    amplitudeScale *= 0.74
  }

  return {
    durationScale: clamp(durationScale, 0.82, 1.34),
    amplitudeScale: clamp(amplitudeScale, 0.62, 1.18),
  }
}

function mergeMotionProfiles(
  left: ReturnType<typeof resolveWorkModeMotionProfile>,
  right: ReturnType<typeof resolveSceneMotionProfile>,
) {
  return {
    bounceScale: left.bounceScale * right.bounceScale,
    breathScale: left.breathScale * right.breathScale,
    swayScale: left.swayScale * right.swayScale,
    rotationScale: left.rotationScale * right.rotationScale,
    earScale: left.earScale * right.earScale,
    blinkScale: left.blinkScale * right.blinkScale,
    restOffsetY: left.restOffsetY + right.restOffsetY,
    settleBlend: Math.min(0.28, Math.max(0.1, (left.settleBlend + right.settleBlend) / 2)),
  }
}

function blendMotionProfiles(left: MotionBlendProfile, right: MotionBlendProfile, alpha: number): MotionBlendProfile {
  return {
    bounceScale: lerp(left.bounceScale, right.bounceScale, alpha),
    breathScale: lerp(left.breathScale, right.breathScale, alpha),
    swayScale: lerp(left.swayScale, right.swayScale, alpha),
    rotationScale: lerp(left.rotationScale, right.rotationScale, alpha),
    earScale: lerp(left.earScale, right.earScale, alpha),
    blinkScale: lerp(left.blinkScale, right.blinkScale, alpha),
    restOffsetY: lerp(left.restOffsetY, right.restOffsetY, alpha),
    settleBlend: lerp(left.settleBlend, right.settleBlend, alpha),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
