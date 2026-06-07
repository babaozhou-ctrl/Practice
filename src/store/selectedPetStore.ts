import { create } from 'zustand'
import { hydrateImportedPetsFromDisk, subscribeImportedPets } from '../pets/ImportedPetRegistry'
import { listSelectablePets, readSelectedPetState, setSelectedPetId, subscribeSelectedPet } from '../pets/PetSelectionStore'
import type { PetCatalogEntry } from '../pets/registry/builtInPetRegistry'

interface SelectedPetStore {
  selectedPetId: string
  updatedAt: number | null
  availablePets: PetCatalogEntry[]
  hydrate: () => void
  selectPet: (petId: string) => void
  refreshCatalog: () => void
}

const initial = readSelectedPetState()

export const useSelectedPetStore = create<SelectedPetStore>((set) => ({
  selectedPetId: initial.selectedPetId,
  updatedAt: initial.updatedAt,
  availablePets: listSelectablePets(),

  hydrate: async () => {
    await hydrateImportedPetsFromDisk()
    const state = readSelectedPetState()
    set({
      selectedPetId: state.selectedPetId,
      updatedAt: state.updatedAt,
      availablePets: listSelectablePets(),
    })
  },

  selectPet: (petId) => {
    const state = setSelectedPetId(petId)
    set({
      selectedPetId: state.selectedPetId,
      updatedAt: state.updatedAt,
      availablePets: listSelectablePets(),
    })
  },

  refreshCatalog: () => {
    set({ availablePets: listSelectablePets() })
  },
}))

let subscribed = false

export function ensureSelectedPetStoreSubscription() {
  if (subscribed) return
  subscribed = true

  subscribeSelectedPet((state) => {
    useSelectedPetStore.setState({
      selectedPetId: state.selectedPetId,
      updatedAt: state.updatedAt,
      availablePets: listSelectablePets(),
    })
  })

  subscribeImportedPets(() => {
    useSelectedPetStore.setState({
      availablePets: listSelectablePets(),
    })
  })
}
