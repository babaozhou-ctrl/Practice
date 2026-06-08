import { create } from 'zustand'
import { reconcileDiscoveredPluginProviders } from '../PluginCapabilityRegistry'
import { usePluginProviderStore } from '../PluginProviderStore'
import type { PluginDiscoveryRecord } from './types'

interface LocalPluginDiscoveryState {
  plugins: PluginDiscoveryRecord[]
  hydrated: boolean
  refresh: () => Promise<void>
}

export const useLocalPluginDiscoveryStore = create<LocalPluginDiscoveryState>((set) => ({
  plugins: [],
  hydrated: false,
  refresh: async () => {
    const plugins = await window.electronAPI?.listLocalPlugins?.() ?? []
    reconcileDiscoveredPluginProviders(plugins)
    usePluginProviderStore.getState().rehydrateAfterPluginDiscovery()
    set({
      plugins,
      hydrated: true,
    })
  },
}))

let refreshPromise: Promise<void> | null = null

export function ensureLocalPluginDiscoveryHydration(): Promise<void> {
  const state = useLocalPluginDiscoveryStore.getState()
  if (state.hydrated) {
    return Promise.resolve()
  }

  if (!refreshPromise) {
    refreshPromise = state.refresh().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}
