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

  applyPresentation(presentation: ResolvedPetPresentation) {
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

  private update(deltaMs: number) {
    this.globalElapsedMs += deltaMs

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

  private applyMicroMotion() {
    const t = this.globalElapsedMs
    const sway = Math.sin(t / 1800) * 0.7
    const emotion = this.presentation?.snapshot.emotion ?? 'idle'
    const mode = this.presentation?.snapshot.mode ?? 'observing'
    const activity = this.presentation?.snapshot.activity ?? 'idle'
    const scene = this.presentation?.snapshot.scene
    const workMode = this.presentation?.snapshot.workMode ?? null
    const micro = this.playbackMicroMotions

    let bounce = 0
    let extraScaleY = Math.sin(t / 820) * 0.008
    let extraSway = sway
    let extraRotate = Math.sin(t / 2400) * 0.006
    let extraYOffset = 0
    let blinkScaleY = 1

    if (emotion === 'happy' || emotion === 'excited') {
      bounce = Math.abs(Math.sin(t / 220)) * 4.5
      extraScaleY = 0.015 + Math.sin(t / 320) * 0.018
    } else if (emotion === 'thinking' || activity === 'watching_video') {
      bounce = Math.sin(t / 1200) * 0.7
      extraRotate = Math.sin(t / 1500) * 0.012
    } else if (emotion === 'sleepy') {
      bounce = Math.sin(t / 1600) * 0.45
      extraScaleY = Math.sin(t / 1200) * 0.008
      extraSway = Math.sin(t / 2400) * 0.4
    }

    if (mode === 'quiet') {
      bounce *= 0.35
      extraRotate *= 0.45
      extraSway *= 0.55
      extraScaleY *= 0.6
    } else if (mode === 'observing') {
      bounce *= 0.55
      extraRotate *= 0.6
      extraSway *= 0.65
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

    const workModeMotion = resolveWorkModeMotionProfile(workMode, this.lowDistractionMode)
    const sceneMotion = resolveSceneMotionProfile(scene, this.lowDistractionMode)
    const motionProfile = mergeMotionProfiles(workModeMotion, sceneMotion)
    bounce *= motionProfile.bounceScale
    extraScaleY *= motionProfile.breathScale
    extraSway *= motionProfile.swayScale
    extraRotate *= motionProfile.rotationScale

    const breathMotion = micro.breath ? this.computeBreath(micro.breath as PetMicroMotionBreath, t) : 0
    const centerShift = micro.center_shift
      ? this.computeCenterShift(micro.center_shift as PetMicroMotionCenterShift, t)
      : 0
    const tailRotation = micro.tail_sway
      ? this.computeTailSway(micro.tail_sway as PetMicroMotionTailSway, t)
      : 0
    const earRotation = micro.ear_twitch
      ? this.computeEarTwitch(micro.ear_twitch as PetMicroMotionEarTwitch, t)
      : 0
    blinkScaleY = micro.blink ? this.computeBlinkScale(micro.blink as PetMicroMotionBlink, t) : 1
    extraYOffset += breathMotion * motionProfile.breathScale
    extraSway += centerShift * motionProfile.swayScale
    extraRotate += tailRotation * motionProfile.rotationScale + earRotation * motionProfile.earScale
    blinkScaleY = 1 - (1 - blinkScaleY) * motionProfile.blinkScale
    extraYOffset += motionProfile.restOffsetY

    if (workMode?.enabled && workMode.overworkLevel === 'firm') {
      extraYOffset += 4
    } else if (workMode?.enabled && workMode.overworkLevel === 'gentle') {
      extraYOffset += 2
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

  private computeTailSway(config: PetMicroMotionTailSway, elapsedMs: number): number {
    return degreesToRadians(interpolateSequence(config.rotationDeg, elapsedMs, config.durationMs))
  }

  private computeEarTwitch(config: PetMicroMotionEarTwitch, elapsedMs: number): number {
    if (this.nextEarTwitchAt === 0) {
      this.nextEarTwitchAt = elapsedMs + midpoint(config.intervalMs)
    }
    if (elapsedMs >= this.nextEarTwitchAt && this.earTwitchStartedAt === 0) {
      this.earTwitchStartedAt = elapsedMs
    }
    if (this.earTwitchStartedAt === 0) return 0

    const localElapsed = elapsedMs - this.earTwitchStartedAt
    const duration = 420
    if (localElapsed >= duration) {
      this.earTwitchStartedAt = 0
      this.nextEarTwitchAt = elapsedMs + midpoint(config.intervalMs)
      return 0
    }

    return degreesToRadians(interpolateSequence(config.rotationDeg, localElapsed, duration))
  }

  private computeBlinkScale(config: PetMicroMotionBlink, elapsedMs: number): number {
    if (this.nextBlinkAt === 0) {
      this.nextBlinkAt = elapsedMs + midpoint(config.intervalMs)
    }
    if (elapsedMs >= this.nextBlinkAt && this.blinkWindowStartedAt === 0) {
      this.blinkWindowStartedAt = elapsedMs
    }
    if (this.blinkWindowStartedAt === 0) return 1

    const localElapsed = elapsedMs - this.blinkWindowStartedAt
    if (localElapsed >= config.holdMs * 2) {
      this.blinkWindowStartedAt = 0
      this.nextBlinkAt = elapsedMs + midpoint(config.intervalMs)
      return 1
    }

    const closing = localElapsed < config.holdMs
      ? localElapsed / Math.max(config.holdMs, 1)
      : 1 - (localElapsed - config.holdMs) / Math.max(config.holdMs, 1)

    return Math.max(0.15, 1 - closing * 0.9)
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
  lowDistractionMode: boolean,
) {
  const lowDistractionMultiplier = lowDistractionMode
    ? {
        bounceScale: 0.58,
        breathScale: 0.68,
        swayScale: 0.58,
        rotationScale: 0.5,
        earScale: 0.52,
        blinkScale: 0.96,
      }
    : {
        bounceScale: 1,
        breathScale: 1,
        swayScale: 1,
        rotationScale: 1,
        earScale: 1,
        blinkScale: 1,
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
    settleBlend: lowDistractionMode ? 0.16 : 0.22,
  }
}

function resolveBaseWorkModeMotionProfile(workMode: ResolvedPetPresentation['snapshot']['workMode']) {
  if (!workMode?.enabled) {
    return {
      bounceScale: 0.52,
      breathScale: 0.72,
      swayScale: 0.54,
      rotationScale: 0.48,
      earScale: 0.55,
      blinkScale: 1,
      restOffsetY: 0,
      settleBlend: 0.22,
    }
  }

  if (workMode.isBreakActive) {
    if (workMode.phase === 'long_break') {
      return {
        bounceScale: 0.82,
        breathScale: 0.9,
        swayScale: 0.78,
        rotationScale: 0.72,
        earScale: 0.78,
        blinkScale: 1.08,
        restOffsetY: -1.2,
        settleBlend: 0.24,
      }
    }

    return {
      bounceScale: 0.68,
      breathScale: 0.84,
      swayScale: 0.72,
      rotationScale: 0.62,
      earScale: 0.66,
      blinkScale: 1.04,
      restOffsetY: -0.6,
      settleBlend: 0.23,
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
        restOffsetY: 1.8,
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
        restOffsetY: 0.6,
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
      restOffsetY: 1.1,
      settleBlend: 0.19,
    }
  }

  return {
    bounceScale: 0.6,
    breathScale: 0.78,
    swayScale: 0.64,
    rotationScale: 0.6,
    earScale: 0.68,
    blinkScale: 1,
    restOffsetY: 0,
    settleBlend: 0.22,
  }
}

function resolveSceneMotionProfile(
  scene: ResolvedPetPresentation['snapshot']['scene'] | null | undefined,
  lowDistractionMode: boolean,
) {
  const quietMultiplier = lowDistractionMode ? 0.88 : 1

  if (!scene) {
    return {
      bounceScale: quietMultiplier,
      breathScale: quietMultiplier,
      swayScale: quietMultiplier,
      rotationScale: quietMultiplier,
      earScale: quietMultiplier,
      blinkScale: 1,
      restOffsetY: 0,
      settleBlend: lowDistractionMode ? 0.18 : 0.22,
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
        restOffsetY: 2.4,
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
        restOffsetY: 0.6,
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
        restOffsetY: 0.2,
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
        restOffsetY: -0.4,
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
        restOffsetY: -0.8,
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
        restOffsetY: -0.2,
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
        restOffsetY: 0.4,
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
        restOffsetY: 1.4,
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
        restOffsetY: 0.6,
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
        restOffsetY: -0.1,
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
        settleBlend: lowDistractionMode ? 0.18 : 0.22,
      }
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
