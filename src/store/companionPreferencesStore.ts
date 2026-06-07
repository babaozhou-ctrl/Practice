import { create } from 'zustand'
import type { CompanionPreferencesState } from '../types/companionPreferences'
import {
  readCompanionPreferencesState,
  subscribeCompanionPreferences,
  updateCompanionPreferencesState,
} from '../preferences/CompanionPreferencesStore'

interface CompanionPreferencesStore extends CompanionPreferencesState {
  hydrate: () => void
  setLowDistractionMode: (enabled: boolean) => void
}

const initial = readCompanionPreferencesState()

export const useCompanionPreferencesStore = create<CompanionPreferencesStore>((set) => ({
  lowDistractionMode: initial.lowDistractionMode,

  hydrate: () => {
    set(readCompanionPreferencesState())
  },

  setLowDistractionMode: (enabled) => {
    const state = updateCompanionPreferencesState((current) => ({
      ...current,
      lowDistractionMode: enabled,
    }))
    set(state)
  },
}))

let subscribed = false

export function ensureCompanionPreferencesStoreSubscription() {
  if (subscribed) return
  subscribed = true

  subscribeCompanionPreferences((state) => {
    useCompanionPreferencesStore.setState(state)
  })
}
