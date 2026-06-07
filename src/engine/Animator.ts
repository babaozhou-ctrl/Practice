import { AnimationState, AnimationClip, FrameData } from '../types/animation'

export class Animator {
  private clips: Map<AnimationState, AnimationClip> = new Map()
  private currentClip: AnimationClip | null = null
  private currentFrameIndex = 0
  private frameTimer = 0
  private speedMultiplier = 1
  private isPlaying = false
  private onFrameChange?: (frameIndex: number, totalFrames: number) => void

  registerClip(clip: AnimationClip) {
    this.clips.set(clip.name, clip)
  }

  registerClips(clips: AnimationClip[]) {
    for (const clip of clips) {
      this.registerClip(clip)
    }
  }

  play(state: AnimationState, speed = 1) {
    const clip = this.clips.get(state)
    if (!clip) {
      console.warn(`Animation clip "${state}" not found`)
      return
    }
    if (this.currentClip?.name === state) return

    this.currentClip = clip
    this.currentFrameIndex = 0
    this.frameTimer = 0
    this.speedMultiplier = speed
    this.isPlaying = true
    this.onFrameChange?.(0, clip.frames.length)
  }

  stop() {
    this.isPlaying = false
    this.currentClip = null
    this.currentFrameIndex = 0
    this.frameTimer = 0
  }

  pause() {
    this.isPlaying = false
  }

  resume() {
    if (this.currentClip) this.isPlaying = true
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = multiplier
  }

  onFrameChanged(callback: (frameIndex: number, totalFrames: number) => void) {
    this.onFrameChange = callback
  }

  update(deltaTime: number): FrameData | null {
    if (!this.isPlaying || !this.currentClip) return null

    const clip = this.currentClip
    const frame = clip.frames[this.currentFrameIndex]

    this.frameTimer += deltaTime * this.speedMultiplier

    if (this.frameTimer >= frame.duration) {
      this.frameTimer = 0
      this.currentFrameIndex++

      if (this.currentFrameIndex >= clip.frames.length) {
        if (clip.loop) {
          this.currentFrameIndex = 0
        } else {
          this.currentFrameIndex = clip.frames.length - 1
          this.isPlaying = false
        }
      }

      this.onFrameChange?.(this.currentFrameIndex, clip.frames.length)
    }

    return clip.frames[this.currentFrameIndex]
  }

  getCurrentFrame(): FrameData | null {
    if (!this.currentClip) return null
    return this.currentClip.frames[this.currentFrameIndex] || null
  }

  get currentState(): AnimationState | null {
    return this.currentClip?.name || null
  }

  get frameIndex(): number {
    return this.currentFrameIndex
  }

  get totalFrames(): number {
    return this.currentClip?.frames.length || 0
  }
}
