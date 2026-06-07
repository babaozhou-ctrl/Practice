import { create } from 'zustand'
import { subscribeImportedPets } from '../pets/ImportedPetRegistry'
import { subscribeSelectedPet } from '../pets/PetSelectionStore'
import { resolveSelectedPetCapabilities } from '../pets/resolveSelectedPetCapabilities'
import type { PetCapabilityKey } from '../shared/types/petPackage'

type CapabilityState = Record<PetCapabilityKey, boolean>

interface SelectedPetCapabilityStore extends CapabilityState {
  hydrate: () => void
}

const initial = resolveSelectedPetCapabilities()

export const useSelectedPetCapabilityStore = create<SelectedPetCapabilityStore>(() => ({
  ...initial,
  hydrate: () => {
    useSelectedPetCapabilityStore.setState(resolveSelectedPetCapabilities())
  },
}))

let subscribed = false

export function ensureSelectedPetCapabilitySubscription() {
  if (subscribed) return
  subscribed = true

  const sync = () => {
    useSelectedPetCapabilityStore.setState(resolveSelectedPetCapabilities())
  }

  subscribeSelectedPet(sync)
  subscribeImportedPets(sync)
}
