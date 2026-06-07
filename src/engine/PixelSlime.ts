import { Sprite, createFrame, createSpriteDefinition } from './Sprite'
import { AnimationState, FrameData } from '../types/animation'

const _ = 0
const B = 1
const E = 2  // eye (black dot)

const BASE_HEX = [
  [_,_,_,_,_,B,B,_,_,_,_,_],
  [_,_,_,B,B,B,B,B,B,_,_,_],
  [_,_,B,B,B,B,B,B,B,B,_,_],
  [_,B,B,B,B,B,B,B,B,B,B,_],
  [_,B,B,B,B,B,B,B,B,B,B,_],
  [_,B,B,B,_,E,_,E,_,B,B,_],
  [_,B,B,B,B,B,B,B,B,B,B,_],
  [_,B,B,B,B,B,B,B,B,B,B,_],
  [_,_,B,B,B,B,B,B,B,B,_,_],
  [_,_,_,B,B,B,B,B,B,_,_,_],
  [_,_,_,_,B,B,B,B,_,_,_,_],
  [_,_,_,_,_,B,B,_,_,_,_,_],
]

function deepCopy(grid: number[][]): number[][] {
  return grid.map(row => [...row])
}

function shiftY(grid: number[][], amount: number): number[][] {
  if (amount === 0) return deepCopy(grid)
  const result: number[][] = []
  for (let i = 0; i < grid.length; i++) {
    const srcIdx = i - amount
    result.push(srcIdx >= 0 && srcIdx < grid.length ? [...grid[srcIdx]] : Array(grid[0].length).fill(0))
  }
  return result
}

function stretchY(grid: number[][], factor: number): number[][] {
  if (factor === 1) return deepCopy(grid)
  const h = grid.length, w = grid[0].length
  const newH = Math.max(2, Math.round(h * factor))
  const result: number[][] = []
  for (let i = 0; i < newH; i++) {
    const srcIdx = Math.min(Math.floor(i * h / newH), h - 1)
    result.push(srcIdx >= 0 ? [...grid[srcIdx]] : Array(w).fill(0))
  }
  return result
}

function makeIdleFrames(): FrameData[] {
  return [
    createFrame(BASE_HEX, 400),
    createFrame(stretchY(BASE_HEX, 0.88), 400),
    createFrame(BASE_HEX, 400),
    createFrame(stretchY(BASE_HEX, 1.06), 400),
  ]
}

const PALETTES = [
  { name: 'Rimuru', body: '#38bdf8', highlight: '#7dd3fc', shadow: '#0284c7', eyeWhite: '#38bdf8', pupil: '#0f172a', blush: '#38bdf8', hoodie: '#38bdf8', skirt: '#38bdf8', ear: '#7dd3fc' },
  { name: 'Green', body: '#4ade80', highlight: '#86efac', shadow: '#166534', eyeWhite: '#4ade80', pupil: '#0f172a', blush: '#4ade80', hoodie: '#4ade80', skirt: '#4ade80', ear: '#86efac' },
  { name: 'Pink', body: '#f472b6', highlight: '#f9a8d4', shadow: '#9d174d', eyeWhite: '#f472b6', pupil: '#0f172a', blush: '#f472b6', hoodie: '#f472b6', skirt: '#f472b6', ear: '#f9a8d4' },
  { name: 'Yellow', body: '#fbbf24', highlight: '#fcd34d', shadow: '#92400e', eyeWhite: '#fbbf24', pupil: '#0f172a', blush: '#fbbf24', hoodie: '#fbbf24', skirt: '#fbbf24', ear: '#fcd34d' },
  { name: 'Purple', body: '#a78bfa', highlight: '#c4b5fd', shadow: '#5b21b6', eyeWhite: '#a78bfa', pupil: '#0f172a', blush: '#a78bfa', hoodie: '#a78bfa', skirt: '#a78bfa', ear: '#c4b5fd' },
]

export function createSlimeSprite(): Sprite {
  const clips = [
    { name: 'IDLE' as AnimationState, frames: makeIdleFrames(), loop: true },
    { name: 'WALK' as AnimationState, frames: makeIdleFrames(), loop: true },
    { name: 'SLEEPING' as AnimationState, frames: makeIdleFrames(), loop: true },
    { name: 'HAPPY' as AnimationState, frames: [
      createFrame(stretchY(BASE_HEX, 1.15), 180),
      createFrame(stretchY(BASE_HEX, 0.85), 180),
      createFrame(stretchY(BASE_HEX, 1.2), 180),
      createFrame(BASE_HEX, 300),
    ], loop: false },
    { name: 'THINKING' as AnimationState, frames: makeIdleFrames(), loop: true },
  ]

  const definition = createSpriteDefinition(12, 12, 5, PALETTES, clips)
  return new Sprite(definition)
}
