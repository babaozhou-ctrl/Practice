import { create } from 'zustand'
import { PetState, PetPosition, PetStatus, PetEmotion } from '../types/pet'
import { SpriteDefinition } from '../types/animation'

interface SpeechBubble {
  message: string
  timestamp: number
  duration: number
}

interface PetStore {
  position: PetPosition
  state: PetState
  prevState: PetState
  emotion: PetEmotion
  status: PetStatus
  skinIndex: number
  isClickThrough: boolean
  isChatOpen: boolean
  isContextMenuOpen: boolean
  showCustomPetLoader: boolean
  contextMenuPosition: PetPosition
  speech: SpeechBubble | null
  customPetDefinition: SpriteDefinition | null
  customPetName: string | null

  setPosition: (pos: PetPosition) => void
  setState: (state: PetState) => void
  setEmotion: (emotion: PetEmotion) => void
  updateStatus: (status: Partial<PetStatus>) => void
  setSkinIndex: (index: number) => void
  setClickThrough: (enabled: boolean) => void
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  setContextMenu: (open: boolean, pos?: PetPosition) => void
  setShowCustomPetLoader: (show: boolean) => void
  tickStatus: () => void
  showSpeech: (message: string, duration?: number) => void
  hideSpeech: () => void
  setCustomPet: (def: SpriteDefinition | null, name?: string | null) => void
}

export const usePetStore = create<PetStore>((set, get) => ({
  position: { x: 400, y: 300 },
  state: 'IDLE',
  prevState: 'IDLE',
  emotion: 'neutral',
  status: { hunger: 80, happiness: 60, energy: 70 },
  skinIndex: 0,
  isClickThrough: false,
  isChatOpen: false,
  isContextMenuOpen: false,
  showCustomPetLoader: false,
  contextMenuPosition: { x: 0, y: 0 },
  speech: null,
  customPetDefinition: null,
  customPetName: null,

  setPosition: (pos) => set({ position: pos }),
  setState: (state) => set((s) => ({ prevState: s.state, state })),
  setEmotion: (emotion) => set({ emotion }),
  updateStatus: (partial) => set((s) => ({ status: { ...s.status, ...partial } })),
  setSkinIndex: (index) => set({ skinIndex: index }),
  setClickThrough: (enabled) => set({ isClickThrough: enabled }),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setContextMenu: (open, pos) =>
    set({ isContextMenuOpen: open, contextMenuPosition: pos ?? { x: 0, y: 0 } }),
  tickStatus: () =>
    set((s) => ({
      status: {
        hunger: Math.max(0, s.status.hunger - 0.5),
        happiness: Math.max(0, s.status.happiness - 0.2),
        energy: Math.min(100, s.status.energy + 0.1),
      },
    })),
  showSpeech: (message, duration = 4000) =>
    set({ speech: { message, timestamp: Date.now(), duration } }),
  hideSpeech: () => set({ speech: null }),
  setCustomPet: (def, name = null) => set({ customPetDefinition: def, customPetName: def ? name : null }),
  setShowCustomPetLoader: (show) => set({ showCustomPetLoader: show }),
}))
