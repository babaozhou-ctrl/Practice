import { Sprite, createFrame, createSpriteDefinition } from './Sprite'
import { AnimationState, AnimationClip, FrameData, SpritePalette } from '../types/animation'

export interface PetAssetConfig {
  name: string
  gridWidth: number
  gridHeight: number
  pixelScale: number
  palettes: SpritePalette[]
  animations: {
    name: AnimationState
    frameIndex: number  // starting frame index in the sprite sheet
    count: number
    duration: number
    loop: boolean
  }[]
}

// Load a sprite sheet image and parse it into pixel grids
export async function loadSpriteSheet(
  imageFile: File,
  config: PetAssetConfig
): Promise<FrameData[]> {
  const bitmap = await createImageBitmap(imageFile)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  bitmap.close()

  const palette = config.palettes[0]
  const frames: FrameData[] = []

  for (const anim of config.animations) {
    for (let f = 0; f < anim.count; f++) {
      const frameIndex = anim.frameIndex + f
      const startX = frameIndex * config.gridWidth
      const startY = 0 // all frames in a single row
      const grid: number[][] = []

      for (let row = 0; row < config.gridHeight; row++) {
        const pixelRow: number[] = []
        for (let col = 0; col < config.gridWidth; col++) {
          const px = startX + col
          const py = startY + row
          const idx = (py * imageData.width + px) * 4
          const r = imageData.data[idx]
          const g = imageData.data[idx + 1]
          const b = imageData.data[idx + 2]
          const a = imageData.data[idx + 3]

          if (a < 128) {
            pixelRow.push(0) // transparent
          } else {
            pixelRow.push(matchColor(r, g, b, palette))
          }
        }
        grid.push(pixelRow)
      }
      frames.push(createFrame(grid, anim.duration))
    }
  }
  return frames
}

// Map an RGBA pixel to the closest palette index
function matchColor(r: number, g: number, b: number, pal: SpritePalette): number {
  const entries: [string, number][] = [
    [pal.body, 1], [pal.eyeWhite, 2], [pal.pupil, 3],
    [pal.blush, 4], [pal.hoodie, 5], [pal.skirt, 6],
    [pal.ear, 7], [pal.highlight, 8],
  ]
  let bestVal = 1, bestDist = Infinity
  for (const [hex, val] of entries) {
    const cr = parseInt(hex.slice(1, 3), 16)
    const cg = parseInt(hex.slice(3, 5), 16)
    const cb = parseInt(hex.slice(5, 7), 16)
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
    if (dist < bestDist) { bestDist = dist; bestVal = val }
  }
  return bestVal
}

// Build a Sprite from parsed frames + config
export function buildSpriteFromFrames(
  frames: FrameData[],
  config: PetAssetConfig
): Sprite {
  let frameOffset = 0
  const clips: AnimationClip[] = config.animations.map((anim) => {
    const clipFrames = frames.slice(frameOffset, frameOffset + anim.count)
    frameOffset += anim.count
    return {
      name: anim.name,
      frames: clipFrames,
      loop: anim.loop,
    }
  })

  const def = createSpriteDefinition(
    config.gridWidth,
    config.gridHeight,
    config.pixelScale,
    config.palettes,
    clips
  )
  return new Sprite(def)
}

// Validate and parse a JSON asset config
export function parsePetConfig(json: string): PetAssetConfig {
  const raw = JSON.parse(json)
  if (!raw.gridWidth || !raw.gridHeight || !raw.animations) {
    throw new Error('Invalid pet config: missing gridWidth, gridHeight, or animations')
  }
  return raw as PetAssetConfig
}
