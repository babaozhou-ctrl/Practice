export type AnimationState =
  | 'IDLE'
  | 'WALK'
  | 'THINKING'
  | 'CODING'
  | 'HAPPY'
  | 'SLEEPING'
  | 'WATCHING'
  | 'CHATTING'
  | 'GAMING'
  | 'EMBARRASSED'
  | 'EXCITED'

export interface FrameData {
  pixels: number[][]
  duration: number
}

export interface AnimationClip {
  name: AnimationState
  frames: FrameData[]
  loop: boolean
}

export interface SpritePalette {
  name: string
  body: string      // 1 - skin/face
  highlight: string // 8 - accent
  shadow: string    // unused
  eyeWhite: string  // 2
  pupil: string     // 3
  blush: string     // 4
  hoodie: string    // 5 - clothing
  skirt: string     // 6
  ear: string       // 7 - ears/hair
}

export interface SpriteDefinition {
  gridWidth: number
  gridHeight: number
  pixelScale: number
  palette: SpritePalette
  palettes: SpritePalette[]
  clips: AnimationClip[]
}
