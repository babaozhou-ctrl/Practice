import type { AnimationState } from './animation'

export type PetState = AnimationState

export type PetEmotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'tired'

export interface PetPosition {
  x: number
  y: number
}

export interface PetStatus {
  hunger: number
  happiness: number
  energy: number
}

export interface PetConfig {
  name: string
  species: string
  scale: number
  animSpeed: number
}
