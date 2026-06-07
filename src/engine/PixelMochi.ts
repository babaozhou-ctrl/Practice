import { Sprite, createFrame, createSpriteDefinition } from './Sprite'
import { AnimationState, FrameData } from '../types/animation'

const _ = 0
const B = 1
const E = 2
const P = 3
const R = 4
const C = 5
const S = 6
const H = 7
const A = 8

const BASE: number[][] = [
  [_, _, _, _, _, A, A, _, A, A, _, _, _, _, _],
  [_, _, _, _, A, A, A, A, A, A, A, _, _, _, _],
  [_, _, _, _, B, B, B, B, B, B, B, _, _, _, _],
  [_, _, _, B, B, B, B, B, B, B, B, B, _, _, _],
  [_, _, H, H, B, B, B, B, B, B, B, H, H, _, _],
  [_, H, H, H, B, E, B, B, B, E, B, H, H, H, _],
  [_, H, H, H, B, P, B, B, B, P, B, H, H, H, _],
  [_, H, H, H, B, B, B, P, B, B, B, H, H, H, _],
  [_, H, H, H, B, R, B, B, B, R, B, H, H, H, _],
  [_, H, H, H, H, B, P, P, P, B, H, H, H, H, _],
  [_, _, H, H, H, B, B, B, B, B, H, H, H, _, _],
  [_, _, _, H, H, B, C, C, C, B, H, H, _, _, _],
  [_, _, _, _, B, B, C, C, C, B, B, _, _, _, _],
  [_, _, _, _, B, B, B, B, B, B, B, _, _, _, _],
  [_, _, _, _, _, B, B, B, B, B, _, _, _, _, _],
  [_, _, _, _, _, _, B, _, B, _, _, _, _, _, _],
  [_, _, _, _, _, B, B, _, B, B, _, _, _, _, _],
]

function deepCopy(grid: number[][]): number[][] {
  return grid.map((row) => [...row])
}

function shiftX(grid: number[][], amount: number): number[][] {
  if (amount === 0) return grid.map((row) => [...row])
  return grid.map((row) => {
    const next: number[] = []
    for (let i = 0; i < row.length; i += 1) {
      next.push(i - amount >= 0 && i - amount < row.length ? row[i - amount] : 0)
    }
    return next
  })
}

function stretchY(grid: number[][], factor: number): number[][] {
  if (factor === 1) return deepCopy(grid)
  const h = grid.length
  const w = grid[0].length
  const nh = Math.max(2, Math.round(h * factor))
  const next: number[][] = []
  for (let i = 0; i < nh; i += 1) {
    next.push(i < h ? [...grid[Math.min(Math.floor((i * h) / nh), h - 1)]] : Array(w).fill(0))
  }
  return next
}

function padBottom(grid: number[][], targetHeight: number): number[][] {
  if (grid.length >= targetHeight) return grid.slice(0, targetHeight).map((row) => [...row])
  return [...grid.map((row) => [...row]), ...Array.from({ length: targetHeight - grid.length }, () => Array(grid[0].length).fill(0))]
}

function normalized(grid: number[][]): number[][] {
  return padBottom(grid, 17)
}

function replacePixels(
  grid: number[][],
  edits: Array<[number, number, number]>,
): number[][] {
  const next = deepCopy(grid)
  for (const [row, col, value] of edits) {
    if (next[row] && col >= 0 && col < next[row].length) {
      next[row][col] = value
    }
  }
  return next
}

function blink(grid: number[][]): number[][] {
  return replacePixels(grid, [
    [5, 5, B], [5, 9, B],
    [6, 5, E], [6, 9, E],
  ])
}

function halfLidded(grid: number[][]): number[][] {
  return replacePixels(grid, [
    [5, 5, B], [5, 9, B],
    [6, 5, E], [6, 9, E],
    [7, 5, B], [7, 9, B],
  ])
}

function mouthFlat(grid: number[][]): number[][] {
  return replacePixels(grid, [
    [9, 6, B],
    [9, 7, P],
    [9, 8, B],
  ])
}

function mouthHappy(grid: number[][]): number[][] {
  return replacePixels(grid, [
    [9, 6, P],
    [9, 7, B],
    [9, 8, P],
  ])
}

function mouthO(grid: number[][]): number[][] {
  return replacePixels(grid, [
    [9, 6, B],
    [9, 7, P],
    [9, 8, B],
    [10, 7, P],
  ])
}

function raisePaw(grid: number[][], side: 'L' | 'R', amount = 2): number[][] {
  const next = deepCopy(grid)
  const col = side === 'L' ? 4 : 10
  for (let row = 11; row <= 13; row += 1) next[row][col] = 0
  for (let offset = 0; offset < 3; offset += 1) {
    const row = Math.max(8, 11 - amount - offset)
    next[row][col] = B
  }
  return next
}

function bothPawsUp(grid: number[][], amount = 3): number[][] {
  return raisePaw(raisePaw(grid, 'L', amount), 'R', amount)
}

function dropEars(grid: number[][], extra = 1): number[][] {
  const next = deepCopy(grid)
  for (let col = 1; col <= 3; col += 1) {
    next[10 + extra][col] = H
  }
  for (let col = 11; col <= 13; col += 1) {
    next[10 + extra][col] = H
  }
  return next
}

function liftEars(grid: number[][]): number[][] {
  return replacePixels(grid, [
    [3, 2, H], [3, 12, H],
    [4, 1, H], [4, 13, H],
  ])
}

function shiftEyes(grid: number[][], amount: number): number[][] {
  const next = deepCopy(grid)
  const eyeRows = [5, 6]
  for (const row of eyeRows) {
    for (let col = 4; col <= 10; col += 1) {
      if (next[row][col] === E || next[row][col] === P) next[row][col] = B
    }
  }
  const left = 5 + amount
  const right = 9 + amount
  next[5][left] = E
  next[6][left] = P
  next[5][right] = E
  next[6][right] = P
  return next
}

function wideEyes(grid: number[][]): number[][] {
  return replacePixels(grid, [
    [4, 5, E], [4, 9, E],
    [5, 5, E], [5, 9, E],
    [6, 5, P], [6, 9, P],
  ])
}

function bounce(grid: number[][], factor: number): number[][] {
  return normalized(stretchY(grid, factor))
}

const D = 520

function makeIdle(): FrameData[] {
  return [
    createFrame(normalized(BASE), D),
    createFrame(normalized(shiftX(BASE, -1)), D),
    createFrame(normalized(halfLidded(BASE)), D),
    createFrame(normalized(blink(BASE)), 130),
    createFrame(normalized(shiftX(BASE, 1)), D),
    createFrame(normalized(mouthFlat(BASE)), D),
  ]
}

function makeWalk(): FrameData[] {
  return [
    createFrame(normalized(shiftX(BASE, -1)), 260),
    createFrame(normalized(shiftX(bounce(BASE, 0.94), -1)), 220),
    createFrame(normalized(shiftX(BASE, 1)), 260),
    createFrame(normalized(shiftX(bounce(BASE, 0.94), 1)), 220),
  ]
}

function makeSleep(): FrameData[] {
  const sleepy = mouthFlat(blink(dropEars(bounce(BASE, 0.92), 2)))
  return [
    createFrame(normalized(sleepy), 850),
    createFrame(normalized(shiftX(sleepy, -1)), 950),
    createFrame(normalized(shiftX(sleepy, 1)), 950),
    createFrame(normalized(dropEars(mouthFlat(blink(bounce(BASE, 0.88))), 3)), 1050),
  ]
}

function makeHappy(): FrameData[] {
  return [
    createFrame(normalized(liftEars(mouthHappy(bounce(BASE, 1.05)))), 180),
    createFrame(normalized(liftEars(bothPawsUp(mouthO(bounce(BASE, 0.9)), 4))), 180),
    createFrame(normalized(liftEars(bothPawsUp(mouthHappy(bounce(BASE, 1.1)), 3))), 180),
    createFrame(normalized(mouthHappy(BASE)), 260),
  ]
}

function makeThink(): FrameData[] {
  return [
    createFrame(normalized(raisePaw(mouthFlat(halfLidded(BASE)), 'L', 3)), 520),
    createFrame(normalized(shiftX(raisePaw(mouthFlat(halfLidded(BASE)), 'L', 2), -1)), 520),
    createFrame(normalized(blink(raisePaw(mouthFlat(BASE), 'R', 3))), 140),
    createFrame(normalized(raisePaw(mouthFlat(BASE), 'R', 2)), 520),
  ]
}

function makeCoding(): FrameData[] {
  return [
    createFrame(normalized(halfLidded(mouthFlat(bounce(BASE, 0.98)))), 480),
    createFrame(normalized(shiftX(halfLidded(mouthFlat(bounce(BASE, 0.96))), -1)), 480),
    createFrame(normalized(blink(halfLidded(mouthFlat(BASE)))), 120),
    createFrame(normalized(shiftX(halfLidded(mouthFlat(bounce(BASE, 0.96))), 1)), 480),
  ]
}

function makeWatch(): FrameData[] {
  return [
    createFrame(normalized(shiftEyes(BASE, 1)), 480),
    createFrame(normalized(shiftEyes(mouthFlat(BASE), 1)), 480),
    createFrame(normalized(blink(shiftEyes(BASE, -1))), 120),
    createFrame(normalized(shiftEyes(BASE, -1)), 480),
  ]
}

function makeChatting(): FrameData[] {
  return [
    createFrame(normalized(raisePaw(mouthHappy(BASE), 'L', 4)), 260),
    createFrame(normalized(bothPawsUp(mouthHappy(bounce(BASE, 0.96)), 3)), 260),
    createFrame(normalized(blink(raisePaw(mouthHappy(BASE), 'R', 4))), 120),
    createFrame(normalized(mouthHappy(BASE)), 280),
  ]
}

function makeGaming(): FrameData[] {
  return [
    createFrame(normalized(wideEyes(mouthO(BASE))), 210),
    createFrame(normalized(shiftX(wideEyes(mouthO(bounce(BASE, 0.96))), 1)), 210),
    createFrame(normalized(shiftX(wideEyes(mouthHappy(BASE)), -1)), 210),
    createFrame(normalized(wideEyes(mouthFlat(BASE))), 240),
  ]
}

function makeExcited(): FrameData[] {
  return [
    createFrame(normalized(liftEars(wideEyes(mouthHappy(bounce(BASE, 1.08))))), 160),
    createFrame(normalized(liftEars(bothPawsUp(wideEyes(mouthO(bounce(BASE, 0.88))), 5))), 160),
    createFrame(normalized(liftEars(bothPawsUp(wideEyes(mouthHappy(bounce(BASE, 1.12))), 4))), 160),
    createFrame(normalized(liftEars(wideEyes(mouthHappy(bounce(BASE, 0.94))))), 200),
  ]
}

const PALETTES = [
  {
    name: 'Mochi Default',
    body: '#fbfdff',
    highlight: '#d8edff',
    shadow: '#6da9dc',
    eyeWhite: '#7eaede',
    pupil: '#6da9dc',
    blush: '#f5b4c9',
    hoodie: '#e8f4ff',
    skirt: '#d8edff',
    ear: '#ffd5e5',
  },
  {
    name: 'Cloudy Blue',
    body: '#ffffff',
    highlight: '#cbe6ff',
    shadow: '#76b1e2',
    eyeWhite: '#84b8e8',
    pupil: '#5f99cf',
    blush: '#f2b0c5',
    hoodie: '#edf7ff',
    skirt: '#d6ecff',
    ear: '#f7d0df',
  },
  {
    name: 'Creamy Day',
    body: '#fffdf7',
    highlight: '#f6edc5',
    shadow: '#8ab7df',
    eyeWhite: '#7eaede',
    pupil: '#6899c9',
    blush: '#f6b6c8',
    hoodie: '#eef6ff',
    skirt: '#f7edc9',
    ear: '#ffd8e6',
  },
]

export function createMochiSprite(): Sprite {
  const clips = [
    { name: 'IDLE' as AnimationState, frames: makeIdle(), loop: true },
    { name: 'WALK' as AnimationState, frames: makeWalk(), loop: true },
    { name: 'SLEEPING' as AnimationState, frames: makeSleep(), loop: true },
    { name: 'HAPPY' as AnimationState, frames: makeHappy(), loop: false },
    { name: 'THINKING' as AnimationState, frames: makeThink(), loop: true },
    { name: 'CODING' as AnimationState, frames: makeCoding(), loop: true },
    { name: 'WATCHING' as AnimationState, frames: makeWatch(), loop: true },
    { name: 'CHATTING' as AnimationState, frames: makeChatting(), loop: true },
    { name: 'GAMING' as AnimationState, frames: makeGaming(), loop: true },
    { name: 'EXCITED' as AnimationState, frames: makeExcited(), loop: false },
  ]

  return new Sprite(createSpriteDefinition(15, 17, 4, PALETTES, clips))
}

// Legacy alias kept only for older demo/runtime imports.
export function createCatgirlSprite(): Sprite {
  return createMochiSprite()
}
