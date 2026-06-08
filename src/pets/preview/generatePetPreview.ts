import { Sprite } from '../../engine/Sprite'
import type { ImportedPetAssetFile } from '../ImportedPetRegistry'
import type { PetProductionProfile } from '../../shared/types/petPackage'
import type { AnimationClip, AnimationState, FrameData, SpriteDefinition } from '../../types/animation'

export interface PreviewSourceFile {
  relativePath: string
  file: File
}

export interface GeneratePetPreviewOptions {
  spriteDefinition?: SpriteDefinition | null
  productionProfile?: PetProductionProfile | null
  atlasRelativePath?: string
  sourceFiles?: PreviewSourceFile[]
  outputRelativePath?: string
}

const DEFAULT_OUTPUT_PATH = 'preview.generated.png'
const PREVIEW_SIZE = 96
const PREVIEW_PADDING = 10
const SPRITE_CLIP_PRIORITY: AnimationState[] = [
  'IDLE',
  'HAPPY',
  'THINKING',
  'CHATTING',
  'EXCITED',
  'CODING',
  'WATCHING',
  'GAMING',
  'SLEEPING',
  'WALK',
]
const ATLAS_CLIP_PRIORITY = [
  'idle_loop',
  'happy_react',
  'thinking_loop',
  'chatting_loop',
  'excited_loop',
  'coding_loop',
  'watching_loop',
  'gaming_loop',
  'sleep_loop',
  'drag',
]

export async function generatePetPreviewAsset(
  options: GeneratePetPreviewOptions,
): Promise<ImportedPetAssetFile | null> {
  const outputRelativePath = normalizeRelativePath(
    options.outputRelativePath || DEFAULT_OUTPUT_PATH,
  )

  const atlasPreview = await tryGeneratePreviewFromAtlas(options)
  if (atlasPreview) {
    return {
      relativePath: outputRelativePath,
      contentBase64: atlasPreview,
    }
  }

  const spritePreview = tryGeneratePreviewFromSpriteDefinition(options.spriteDefinition ?? null)
  if (!spritePreview) {
    return null
  }

  return {
    relativePath: outputRelativePath,
    contentBase64: spritePreview,
  }
}

async function tryGeneratePreviewFromAtlas(
  options: GeneratePetPreviewOptions,
): Promise<string | null> {
  if (
    !options.productionProfile ||
    !options.atlasRelativePath ||
    !options.sourceFiles?.length
  ) {
    return null
  }

  const atlasPath = normalizeRelativePath(options.atlasRelativePath)
  const atlasEntry = options.sourceFiles.find(
    (entry) => normalizeRelativePath(entry.relativePath) === atlasPath,
  )
  if (!atlasEntry) {
    return null
  }

  try {
    const bitmap = await createImageBitmap(atlasEntry.file)
    try {
      const rowOrder = options.productionProfile.atlas.rowOrder
      if (rowOrder.length === 0) {
        return null
      }

      const clipName =
        ATLAS_CLIP_PRIORITY.find((candidate) => rowOrder.includes(candidate))
        ?? rowOrder[0]
      const rowIndex = rowOrder.indexOf(clipName)
      if (rowIndex < 0) {
        return null
      }

      const frameCount = Math.max(
        1,
        options.productionProfile.atlas.clipFrameCounts[clipName] ?? 1,
      )
      const frameIndex = selectAtlasFrameIndex(frameCount)
      const cellWidth = options.productionProfile.atlas.cellWidth
      const cellHeight = options.productionProfile.atlas.cellHeight
      const sourceX = frameIndex * cellWidth
      const sourceY = rowIndex * cellHeight

      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = cellWidth
      sourceCanvas.height = cellHeight
      const sourceContext = sourceCanvas.getContext('2d')
      if (!sourceContext) {
        return null
      }

      sourceContext.clearRect(0, 0, cellWidth, cellHeight)
      sourceContext.drawImage(
        bitmap,
        sourceX,
        sourceY,
        cellWidth,
        cellHeight,
        0,
        0,
        cellWidth,
        cellHeight,
      )

      const bounds = computeImageAlphaBounds(sourceContext, cellWidth, cellHeight)
      if (!bounds) {
        return null
      }

      const canvas = document.createElement('canvas')
      canvas.width = PREVIEW_SIZE
      canvas.height = PREVIEW_SIZE
      const context = canvas.getContext('2d')
      if (!context) {
        return null
      }

      context.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
      context.imageSmoothingEnabled = false
      drawBackdrop(context, bounds.width, bounds.height)

      const scale = Math.max(
        1,
        Math.floor(
          Math.min(
            (PREVIEW_SIZE - PREVIEW_PADDING * 2) / bounds.width,
            (PREVIEW_SIZE - PREVIEW_PADDING * 2) / bounds.height,
          ),
        ),
      )
      const targetWidth = bounds.width * scale
      const targetHeight = bounds.height * scale
      const offsetX = Math.floor((PREVIEW_SIZE - targetWidth) / 2)
      const offsetY = Math.floor((PREVIEW_SIZE - targetHeight) / 2)

      context.drawImage(
        sourceCanvas,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        offsetX,
        offsetY,
        targetWidth,
        targetHeight,
      )

      return dataUrlToBase64(canvas.toDataURL('image/png'))
    } finally {
      bitmap.close()
    }
  } catch {
    return null
  }
}

function tryGeneratePreviewFromSpriteDefinition(
  spriteDefinition: SpriteDefinition | null,
): string | null {
  if (!spriteDefinition || typeof document === 'undefined') {
    return null
  }

  const sprite = new Sprite(spriteDefinition)
  const clip = selectSpriteClip(spriteDefinition.clips)
  if (!clip) {
    return null
  }

  const frame = selectSpriteFrame(clip)
  if (!frame) {
    return null
  }

  const bounds = computeFrameBounds(frame)
  if (!bounds) {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = PREVIEW_SIZE
  canvas.height = PREVIEW_SIZE
  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  context.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
  context.imageSmoothingEnabled = false
  drawBackdrop(context, bounds.width, bounds.height)

  const scale = Math.max(
    1,
    Math.floor(
      Math.min(
        (PREVIEW_SIZE - PREVIEW_PADDING * 2) / bounds.width,
        (PREVIEW_SIZE - PREVIEW_PADDING * 2) / bounds.height,
      ),
    ),
  )
  const targetWidth = bounds.width * scale
  const targetHeight = bounds.height * scale
  const offsetX = Math.floor((PREVIEW_SIZE - targetWidth) / 2)
  const offsetY = Math.floor((PREVIEW_SIZE - targetHeight) / 2)

  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
      const color = sprite.getPixelColor(frame, row, col)
      if (!color) {
        continue
      }

      const drawX = offsetX + (col - bounds.minCol) * scale
      const drawY = offsetY + (row - bounds.minRow) * scale
      context.fillStyle = color
      context.fillRect(drawX, drawY, scale, scale)
    }
  }

  return dataUrlToBase64(canvas.toDataURL('image/png'))
}

function selectSpriteClip(clips: AnimationClip[]): AnimationClip | null {
  if (clips.length === 0) {
    return null
  }

  for (const clipName of SPRITE_CLIP_PRIORITY) {
    const clip = clips.find((entry) => entry.name === clipName && entry.frames.length > 0)
    if (clip) {
      return clip
    }
  }

  return clips.find((entry) => entry.frames.length > 0) ?? null
}

function selectSpriteFrame(clip: AnimationClip): FrameData | null {
  if (clip.frames.length === 0) {
    return null
  }

  let bestFrame = clip.frames[0]
  let bestScore = -1

  for (const frame of clip.frames) {
    const score = countVisiblePixels(frame)
    if (score > bestScore) {
      bestScore = score
      bestFrame = frame
    }
  }

  return bestFrame
}

function selectAtlasFrameIndex(frameCount: number): number {
  if (frameCount <= 1) {
    return 0
  }

  return Math.min(frameCount - 1, Math.floor(frameCount / 2))
}

function countVisiblePixels(frame: FrameData): number {
  let total = 0
  for (const row of frame.pixels) {
    for (const pixel of row) {
      if (pixel !== 0) {
        total += 1
      }
    }
  }
  return total
}

function computeFrameBounds(frame: FrameData) {
  let minRow = Number.POSITIVE_INFINITY
  let maxRow = Number.NEGATIVE_INFINITY
  let minCol = Number.POSITIVE_INFINITY
  let maxCol = Number.NEGATIVE_INFINITY

  for (let row = 0; row < frame.pixels.length; row += 1) {
    for (let col = 0; col < frame.pixels[row].length; col += 1) {
      if (frame.pixels[row][col] === 0) {
        continue
      }

      minRow = Math.min(minRow, row)
      maxRow = Math.max(maxRow, row)
      minCol = Math.min(minCol, col)
      maxCol = Math.max(maxCol, col)
    }
  }

  if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) {
    return null
  }

  return {
    minRow,
    maxRow,
    minCol,
    maxCol,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
  }
}

function computeImageAlphaBounds(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const imageData = context.getImageData(0, 0, width, height)
  const data = imageData.data
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha === 0) {
        continue
      }

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

function drawBackdrop(
  context: CanvasRenderingContext2D,
  subjectWidth: number,
  subjectHeight: number,
) {
  const centerX = PREVIEW_SIZE / 2
  const centerY = PREVIEW_SIZE / 2
  const radiusX = Math.max(22, Math.min(34, subjectWidth * 1.35))
  const radiusY = Math.max(18, Math.min(28, subjectHeight * 0.55))

  const gradient = context.createRadialGradient(
    centerX,
    centerY - 6,
    6,
    centerX,
    centerY - 4,
    Math.max(radiusX, radiusY),
  )
  gradient.addColorStop(0, 'rgba(255, 245, 238, 0.92)')
  gradient.addColorStop(0.62, 'rgba(245, 235, 255, 0.48)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = gradient
  context.beginPath()
  context.arc(centerX, centerY, Math.max(radiusX, radiusY), 0, Math.PI * 2)
  context.fill()

  context.fillStyle = 'rgba(80, 62, 92, 0.12)'
  context.beginPath()
  context.ellipse(centerX, centerY + 24, radiusX, radiusY, 0, 0, Math.PI * 2)
  context.fill()
}

function dataUrlToBase64(dataUrl: string): string {
  const [, base64 = ''] = dataUrl.split(',', 2)
  return base64
}

function normalizeRelativePath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
    .join('/')
}
