import { createFrame, createSpriteDefinition, Sprite } from './Sprite'
import { AnimationState, FrameData } from '../types/animation'

const _=0,B=1,O=2,E=3,R=4,H=5,P=6,N=7,S=8

// Sanrio-inspired white floppy-eared puppy: 12 wide x 14 tall
const BASE: number[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,H,_,_,_,_,H,_,_,_],
  [_,_,H,H,_,_,_,_,H,H,_,_],
  [_,H,H,B,B,B,B,B,B,H,H,O],
  [O,B,B,B,B,B,B,B,B,B,B,O],
  [O,B,B,B,B,B,B,B,B,B,B,O],
  [_,B,B,B,B,B,B,B,B,B,_,_],
  [_,B,B,_,E,_,E,_,B,B,_,_],
  [_,_,B,B,R,B,R,B,B,_,_,_],
  [_,_,_,B,B,N,B,B,_,_,_,_],
  [_,_,_,B,B,B,B,B,_,_,_,_],
  [_,_,O,B,B,B,B,B,O,_,_,_],
  [_,O,B,B,B,B,B,B,B,B,O,_],
  [_,_,_,O,P,_,P,O,_,_,_,_],
]

function dc(g: number[][]): number[][] { return g.map(r=>[...r]) }

function sy(g: number[][], f: number): number[][] {
  if (f===1) return dc(g)
  const h=g.length, w=g[0].length, nh=Math.max(2, Math.round(h*f)), r: number[][]=[]
  for (let i=0; i<nh; i++) r.push(i<h ? [...g[Math.min(Math.floor(i*h/nh), h-1)]] : Array(w).fill(0))
  return r
}

function sx(g: number[][], a: number): number[][] {
  if (a===0) return g.map(r=>[...r])
  return g.map(r=>{ const n=[]; for (let i=0; i<r.length; i++) n.push(i-a>=0&&i-a<r.length ? r[i-a] : 0); return n })
}

function pd(g: number[][], tw: number): number[][] {
  const w=g[0].length; if (w===tw) return g.map(r=>[...r])
  const p=Math.floor((tw-w)/2)
  return g.map(r=>[...Array(Math.max(0,p)).fill(0), ...r, ...Array(Math.max(0,tw-w-p)).fill(0)])
}

// --- Emotion modifiers ---

function happyEyes(g: number[][]): number[][] {
  const r=dc(g)
  // Happy closed eyes ^_^  -> replace eye positions with arcs
  r[7][4]=_; r[7][5]=E; r[7][7]=E; r[7][8]=_
  r[8][4]=E; r[8][5]=_; r[8][7]=_; r[8][8]=E
  return r
}

function sleepyEyes(g: number[][]): number[][] {
  const r=dc(g)
  r[7][4]=E; r[7][5]=E; r[7][7]=E; r[7][8]=E  // horizontal bars
  return r
}

function excitedEyes(g: number[][]): number[][] {
  const r=dc(g)
  // Big round eyes (2x2)
  r[6][4]=E; r[6][5]=E; r[7][4]=E; r[7][5]=E
  r[6][7]=E; r[6][8]=E; r[7][7]=E; r[7][8]=E
  return r
}

function thinkEyes(g: number[][]): number[][] {
  const r=dc(g)
  // One eye looking up
  r[7][4]=_; r[6][4]=E
  return r
}

function embarrassedEyes(g: number[][]): number[][] {
  const r=dc(g)
  // Shift eyes closer together
  r[7][3]=E; r[7][4]=_; r[7][8]=_; r[7][7]=E
  // Bigger blush
  r[8][3]=R; r[8][4]=R; r[8][7]=R; r[8][8]=R
  return r
}

function watchEyes(g: number[][]): number[][] {
  const r=dc(g)
  // Eyes shift right
  r[7][4]=_; r[7][5]=_; r[7][7]=E; r[7][8]=E
  r[8][5]=E; r[8][4]=E
  return r
}

// --- Frame generators ---

function makeIdle(): FrameData[] {
  const d=500
  return [
    createFrame(BASE, d),
    createFrame(sy(BASE, 0.96), d),
    createFrame(BASE, d),
    createFrame(sy(BASE, 1.03), d),
  ]
}

function makeHappy(): FrameData[] {
  const d=250
  const h=happyEyes(BASE)
  return [
    createFrame(sy(h, 1.08), d),
    createFrame(sy(h, 0.92), d),
    createFrame(sy(h, 1.12), d),
    createFrame(BASE, 350),
  ]
}

function makeSleepy(): FrameData[] {
  const sl=sleepyEyes(BASE)
  return [
    createFrame(sl, 800),
    createFrame(sy(sl, 0.85), 1000),
    createFrame(sy(sl, 0.85), 1200),
  ]
}

function makeExcited(): FrameData[] {
  const ex=excitedEyes(BASE)
  return [
    createFrame(sy(ex, 1.12), 180),
    createFrame(sy(ex, 0.88), 180),
    createFrame(sy(ex, 1.18), 180),
    createFrame(BASE, 300),
  ]
}

function makeThink(): FrameData[] {
  const th=thinkEyes(BASE)
  return [
    createFrame(th, 600),
    createFrame(sy(th, 0.98), 600),
    createFrame(BASE, 400),
  ]
}

function makeEmbarrassed(): FrameData[] {
  const em=embarrassedEyes(BASE)
  return [
    createFrame(em, 600),
    createFrame(sy(em, 0.94), 600),
    createFrame(em, 600),
  ]
}

function makeWatch(): FrameData[] {
  const wa=watchEyes(BASE)
  return [
    createFrame(wa, 600),
    createFrame(sx(wa, 1), 600),
    createFrame(BASE, 400),
  ]
}

function makeWalk(): FrameData[] {
  const w=BASE[0].length
  return [
    createFrame(pd(sx(BASE, 1), w), 200),
    createFrame(BASE, 200),
    createFrame(pd(sx(BASE, -1), w), 200),
    createFrame(BASE, 200),
  ]
}

// Sanrio pastel palette: cream body, soft blue outlines, pink blush
const PALETTES = [
  {
    name:'Puppy',
    body:'#fff8f0',
    highlight:'#ffb5c5',
    shadow:'#a0c4e8',
    eyeWhite:'#b5d4f0',
    pupil:'#5c3d2e',
    blush:'#fca5a5',
    hoodie:'#f0ddd0',
    skirt:'#f5ebe0',
    ear:'#e8d5c0',
  },
]

export function createPuppySprite(): Sprite {
  const clips = [
    { name:'IDLE' as AnimationState,        frames:makeIdle(), loop:true },
    { name:'WALK' as AnimationState,        frames:makeWalk(), loop:true },
    { name:'HAPPY' as AnimationState,       frames:makeHappy(), loop:false },
    { name:'SLEEPING' as AnimationState,     frames:makeSleepy(), loop:true },
    { name:'THINKING' as AnimationState,     frames:makeThink(), loop:true },
    { name:'WATCHING' as AnimationState,     frames:makeWatch(), loop:true },
    { name:'EMBARRASSED' as AnimationState,  frames:makeEmbarrassed(), loop:false },
    { name:'EXCITED' as AnimationState,     frames:makeExcited(), loop:false },
  ]
  return new Sprite(createSpriteDefinition(12, 14, 5, PALETTES, clips))
}
