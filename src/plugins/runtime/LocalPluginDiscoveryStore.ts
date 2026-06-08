import { create } from 'zustand'
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
    set({
      plugins,
      hydrated: true,
    })
  },
}))
