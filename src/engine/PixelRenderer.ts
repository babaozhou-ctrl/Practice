import { Sprite } from './Sprite'
import { FrameData } from '../types/animation'

export class PixelRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private sprite: Sprite | null = null
  private offsetX = 0
  private offsetY = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  setSprite(sprite: Sprite) {
    this.sprite = sprite
    this.resizeCanvas()
  }

  setOffset(x: number, y: number) {
    this.offsetX = x
    this.offsetY = y
  }

  private resizeCanvas() {
    if (!this.sprite) return
    const pixelW = this.sprite.definition.gridWidth * this.sprite.definition.pixelScale
    const pixelH = this.sprite.definition.gridHeight * this.sprite.definition.pixelScale
    const extraSpace = this.sprite.definition.pixelScale * 4

    this.canvas.width = pixelW + extraSpace * 2
    this.canvas.height = pixelH + extraSpace * 2
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  renderFrame(frame: FrameData) {
    if (!this.sprite) return

    this.clear()

    const scale = this.sprite.definition.pixelScale
    const gridW = this.sprite.definition.gridWidth
    const gridH = this.sprite.definition.gridHeight
    const offsetX = this.offsetX + (this.canvas.width - gridW * scale) / 2
    const offsetY = this.offsetY + (this.canvas.height - gridH * scale) / 2

    const pixels = frame.pixels

    for (let row = 0; row < pixels.length; row++) {
      for (let col = 0; col < pixels[row].length; col++) {
        const color = this.sprite.getPixelColor(frame, row, col)
        if (color === null) continue

        this.ctx.fillStyle = color
        this.ctx.fillRect(
          offsetX + col * scale,
          offsetY + row * scale,
          scale,
          scale
        )
      }
    }
  }

  getCanvasSize(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    }
  }
}
