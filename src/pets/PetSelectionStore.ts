import { DEFAULT_PET_PACKAGE_ID } from './constants'
import { hasBuiltInPetPackage, listBuiltInPetCatalog } from './registry/builtInPetRegistry'

export const PET_SELECTION_STORAGE_KEY = 'deep-pet.selected-pet.v1'

const PET_SELECTION_CHANNEL = 'deep-pet:selected-pet'
const PET_SELECTION_EVENT = 'deep-pet:selected-pet-sync'

let broadcastChannel: BroadcastChannel | null = null

export interface SelectedPetState {
  selectedPetId: string
  updatedAt: number | null
}

export function getDefaultSelectedPetState(): SelectedPetState {
  return {
    selectedPetId: DEFAULT_PET_PACKAGE_ID,
    updatedAt: null,
  }
}

export function readSelectedPetState(): SelectedPetState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return getDefaultSelectedPetState()
    }

    const raw = window.localStorage.getItem(PET_SELECTION_STORAGE_KEY)
    if (!raw) {
      return getDefaultSelectedPetState()
    }

    return normalizeSelectedPetState(JSON.parse(raw) as Partial<SelectedPetState>)
  } catch {
    return getDefaultSelectedPetState()
  }
}

export function writeSelectedPetState(state: SelectedPetState): SelectedPetState {
  const normalized = normalizeSelectedPetState(state)

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PET_SELECTION_STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // ignore persistence failures and still notify listeners
  }

  notifySelectedPet(normalized)
  return normalized
}

export function setSelectedPetId(selectedPetId: string): SelectedPetState {
  return writeSelectedPetState({
    selectedPetId,
    updatedAt: Date.now(),
  })
}

export function subscribeSelectedPet(listener: (state: SelectedPetState) => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const emitCurrent = () => listener(readSelectedPetState())
  const onStorage = (event: StorageEvent) => {
    if (event.key === PET_SELECTION_STORAGE_KEY) {
      emitCurrent()
    }
  }
  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<SelectedPetState>).detail
    if (detail) {
      listener(normalizeSelectedPetState(detail))
      return
    }
    emitCurrent()
  }
  const onBroadcast = (event: MessageEvent<SelectedPetState>) => {
    listener(normalizeSelectedPetState(event.data))
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(PET_SELECTION_EVENT, onInternal as EventListener)
  getBroadcastChannel()?.addEventListener('message', onBroadcast as EventListener)

  emitCurrent()

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(PET_SELECTION_EVENT, onInternal as EventListener)
    getBroadcastChannel()?.removeEventListener('message', onBroadcast as EventListener)
  }
}

export function listSelectablePets() {
  return listBuiltInPetCatalog()
}

function normalizeSelectedPetState(value: Partial<SelectedPetState>): SelectedPetState {
  const petId = typeof value.selectedPetId === 'string' && hasBuiltInPetPackage(value.selectedPetId)
    ? value.selectedPetId
    : DEFAULT_PET_PACKAGE_ID

  return {
    selectedPetId: petId,
    updatedAt: typeof value.updatedAt === 'number' && value.updatedAt > 0 ? value.updatedAt : null,
  }
}

function notifySelectedPet(state: SelectedPetState) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PET_SELECTION_EVENT, { detail: state }))
  }
  getBroadcastChannel()?.postMessage(state)
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(PET_SELECTION_CHANNEL)
    } catch {
      broadcastChannel = null
    }
  }
  return broadcastChannel
}
