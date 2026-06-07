import { AnimationState, AnimationClip, FrameData, SpriteDefinition, SpritePalette } from '../types/animation'

export class Sprite {
  public definition: SpriteDefinition

  constructor(definition: SpriteDefinition) {
    this.definition = definition
  }

  get gridWidth(): number { return this.definition.gridWidth }
  get gridHeight(): number { return this.definition.gridHeight }
  get pixelScale(): number { return this.definition.pixelScale }
  get palette(): SpritePalette { return this.definition.palette }

  getClip(state: AnimationState): AnimationClip | undefined {
    return this.definition.clips.find(c => c.name === state)
  }

  getAllClips(): AnimationClip[] {
    return [...this.definition.clips]
  }

  setPalette(index: number) {
    if (index >= 0 && index < this.definition.palettes.length) {
      this.definition.palette = this.definition.palettes[index]
    }
  }

  getPaletteCount(): number {
    return this.definition.palettes.length
  }

  getPixelColor(frame: FrameData, row: number, col: number): string | null {
    if (row < 0 || row >= frame.pixels.length) return null
    if (col < 0 || col >= frame.pixels[0].length) return null

    const pixel = frame.pixels[row][col]
    const pal = this.definition.palette

    switch (pixel) {
      case 0: return null
      case 1: return pal.body      // skin
      case 2: return pal.eyeWhite  // eye white
      case 3: return pal.pupil     // pupil
      case 4: return pal.blush     // blush
      case 5: return pal.hoodie    // clothing
      case 6: return pal.skirt     // skirt
      case 7: return pal.ear       // ears/hair
      case 8: return pal.highlight // highlight
      default: return pal.body
    }
  }
}

export function createFrame(pixels: number[][], duration: number): FrameData {
  return { pixels, duration }
}

export function createSpriteDefinition(
  gridWidth: number,
  gridHeight: number,
  pixelScale: number,
  palettes: SpritePalette[],
  clips: AnimationClip[]
): SpriteDefinition {
  return {
    gridWidth,
    gridHeight,
    pixelScale,
    palette: palettes[0],
    palettes,
    clips,
  }
}
