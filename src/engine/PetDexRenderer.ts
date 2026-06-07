import type { AnimationState } from '../types/animation'

export const FRAME_W = 192
export const FRAME_H = 208
export const COLS = 8
export const ROWS = 10
export const SHEET_W = COLS * FRAME_W
export const SHEET_H = ROWS * FRAME_H

const ROW_MAP: Partial<Record<AnimationState, number>> = {
  IDLE: 0,
  THINKING: 1,
  CODING: 2,
  WATCHING: 3,
  CHATTING: 4,
  GAMING: 5,
  SLEEPING: 6,
  HAPPY: 7,
  EXCITED: 8,
  WALK: 9,
}

const ROW_FRAMES: Record<number, number> = {
  0: 6,
  1: 4,
  2: 4,
  3: 4,
  4: 4,
  5: 4,
  6: 4,
  7: 4,
  8: 4,
  9: 4,
}

const ROW_DURATIONS: Record<number, number[]> = {
  0: [140, 140, 140, 140, 140, 180],
  1: [150, 150, 150, 200],
  2: [160, 160, 140, 180],
  3: [160, 160, 140, 180],
  4: [130, 130, 140, 180],
  5: [120, 120, 120, 180],
  6: [160, 160, 160, 220],
  7: [110, 110, 110, 180],
  8: [110, 110, 110, 180],
  9: [120, 120, 120, 180],
}

export class PetDexRenderer {
  private sheet: HTMLImageElement | OffscreenCanvas | null = null
  private ready = false

  async loadFromUrl(url: string): Promise<void> {
    const img = new Image()
    img.src = url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(`Failed to load: ${url}`))
    })
    this.initFromImage(img)
  }

  loadFromImage(img: HTMLImageElement): void {
    this.initFromImage(img)
  }

  private initFromImage(img: HTMLImageElement): void {
    const oc = new OffscreenCanvas(SHEET_W, SHEET_H)
    const ctx = oc.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to initialize PetDexRenderer offscreen canvas.')
    }
    ctx.drawImage(img, 0, 0)
    this.sheet = oc
    this.ready = true
  }

  loadFromCanvas(canvas: OffscreenCanvas): void {
    this.sheet = canvas
    this.ready = true
  }

  get isReady(): boolean {
    return this.ready
  }

  stateToRow(state: AnimationState): number {
    return ROW_MAP[state] ?? 0
  }

  getFrameCount(row: number): number {
    return ROW_FRAMES[row] || 4
  }

  getFrameDuration(row: number, col: number): number {
    const durations = ROW_DURATIONS[row]
    if (!durations || col >= durations.length) return 150
    return durations[col]
  }

  renderFrame(
    ctx: CanvasRenderingContext2D,
    row: number,
    col: number,
    dx: number,
    dy: number,
    dw?: number,
    dh?: number,
  ): void {
    if (!this.ready || !this.sheet) return
    const sx = col * FRAME_W
    const sy = row * FRAME_H
    ctx.drawImage(this.sheet as CanvasImageSource, sx, sy, FRAME_W, FRAME_H, dx, dy, dw || FRAME_W, dh || FRAME_H)
  }

  async toPngBlob(): Promise<Blob | null> {
    if (!this.sheet) return null
    const canvas = document.createElement('canvas')
    canvas.width = SHEET_W
    canvas.height = SHEET_H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(this.sheet as CanvasImageSource, 0, 0)
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
  }
}
