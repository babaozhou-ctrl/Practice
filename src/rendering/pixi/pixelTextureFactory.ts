import { Sprite } from '../../engine/Sprite'
import type { AnimationState, FrameData } from '../../types/animation'
import type { BuiltInPetPackage, PetProductionProfile } from '../../shared/types/petPackage'
import { getPixi } from './pixiVendor'

export interface RuntimeTextureSet {
  width: number
  height: number
  texturesByState: Partial<Record<AnimationState, any[]>>
  framesByState: Partial<Record<AnimationState, FrameData[]>>
  texturesByClip: Record<string, any[]>
  framesByClip: Record<string, FrameData[]>
  source: 'atlas' | 'procedural'
}

function createTextureFromFrame(sprite: Sprite, frame: FrameData, pixelScale: number): any {
  const PIXI = getPixi()
  const canvas = document.createElement('canvas')
  canvas.width = sprite.gridWidth * pixelScale
  canvas.height = sprite.gridHeight * pixelScale

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to create 2D context for Pixi texture generation.')
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = false

  for (let row = 0; row < sprite.gridHeight; row++) {
    for (let col = 0; col < sprite.gridWidth; col++) {
      const color = sprite.getPixelColor(frame, row, col)
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(col * pixelScale, row * pixelScale, pixelScale, pixelScale)
    }
  }

  return PIXI.Texture.from(canvas)
}

export function buildRuntimeTextureSet(definition: Sprite['definition'], renderScale = 15): RuntimeTextureSet {
  const sprite = new Sprite(definition)
  const texturesByState: Partial<Record<AnimationState, any[]>> = {}
  const framesByState: Partial<Record<AnimationState, FrameData[]>> = {}
  const texturesByClip: Record<string, any[]> = {}
  const framesByClip: Record<string, FrameData[]> = {}

  for (const clip of sprite.getAllClips()) {
    const textures = clip.frames.map((frame) => createTextureFromFrame(sprite, frame, renderScale))
    framesByClip[clip.name] = clip.frames
    texturesByClip[clip.name] = textures
    framesByState[clip.name] = clip.frames
    texturesByState[clip.name] = textures
  }

  return {
    width: sprite.gridWidth * renderScale,
    height: sprite.gridHeight * renderScale,
    texturesByState,
    framesByState,
    texturesByClip,
    framesByClip,
    source: 'procedural',
  }
}

export async function buildRuntimeTextureSetForPetPackage(
  petPackage: BuiltInPetPackage,
  renderScale = 15,
): Promise<RuntimeTextureSet> {
  if (petPackage.runtimeAssets.preferredSource === 'atlas') {
    const atlasTextureSet = await tryBuildAtlasTextureSet(petPackage)
    if (atlasTextureSet) {
      return atlasTextureSet
    }
  }

  return buildRuntimeTextureSet(petPackage.spriteDefinition, renderScale)
}

async function tryBuildAtlasTextureSet(petPackage: BuiltInPetPackage): Promise<RuntimeTextureSet | null> {
  const atlasUrl = petPackage.runtimeAssets.atlasImageUrl
  const productionProfile = petPackage.productionProfile

  if (!atlasUrl || !productionProfile) {
    return null
  }

  try {
    const image = await loadImage(atlasUrl)
    return buildAtlasTextureSet(image, petPackage, productionProfile)
  } catch {
    return null
  }
}

function buildAtlasTextureSet(
  image: HTMLImageElement,
  petPackage: BuiltInPetPackage,
  productionProfile: PetProductionProfile,
): RuntimeTextureSet {
  const atlas = productionProfile.atlas
  const texturesByState: Partial<Record<AnimationState, any[]>> = {}
  const framesByState: Partial<Record<AnimationState, FrameData[]>> = {}
  const texturesByClip: Record<string, any[]> = {}
  const framesByClip: Record<string, FrameData[]> = {}

  for (const clipName of atlas.rowOrder) {
    const clip = petPackage.animations.clips[clipName]
    const animationState = petPackage.bindings.clipToAnimationState[clipName]
    const frameCount = atlas.clipFrameCounts[clipName]

    if (!clip || !animationState || !frameCount) {
      continue
    }

    const rowIndex = atlas.rowOrder.indexOf(clipName)
    const textures: any[] = []

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const x = frameIndex * atlas.cellWidth
      const y = rowIndex * atlas.cellHeight
      textures.push(sliceTextureFromAtlas(image, x, y, atlas.cellWidth, atlas.cellHeight))
    }

    const timelineFrames = buildTimelineFrames(textures.length, clip.fps, clip.frameDurationsMs)
    texturesByClip[clipName] = textures
    framesByClip[clipName] = timelineFrames
    texturesByState[animationState] = textures
    framesByState[animationState] = timelineFrames
  }

  return {
    width: atlas.cellWidth,
    height: atlas.cellHeight,
    texturesByState,
    framesByState,
    texturesByClip,
    framesByClip,
    source: 'atlas',
  }
}

function sliceTextureFromAtlas(
  image: HTMLImageElement,
  sourceX: number,
  sourceY: number,
  width: number,
  height: number,
): any {
  const PIXI = getPixi()
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to create 2D context for atlas texture slicing.')
  }

  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, sourceX, sourceY, width, height, 0, 0, width, height)

  return PIXI.Texture.from(canvas)
}

function buildTimelineFrames(
  frameCount: number,
  fps: number,
  frameDurationsMs?: number[],
): FrameData[] {
  const defaultDuration = Math.max(16, Math.round(1000 / Math.max(fps, 1)))

  return Array.from({ length: frameCount }, (_, index) => ({
    pixels: [],
    duration: normalizeFrameDuration(frameDurationsMs?.[index], defaultDuration),
  }))
}

function normalizeFrameDuration(durationMs: number | undefined, fallback: number): number {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return fallback
  }

  return Math.max(16, Math.round(durationMs))
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load atlas image: ${src}`))
    image.src = src
  })
}
