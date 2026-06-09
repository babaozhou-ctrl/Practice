import { create } from 'zustand'
import type { WorkModeConfig, WorkModeState } from '../types/workMode'
import { getDefaultWorkModeState, readWorkModeState, subscribeWorkMode, updateWorkModeState } from '../workmode/WorkModeStore'
import { WorkModeRuntime } from '../workmode/WorkModeRuntime'

interface WorkModeStore extends WorkModeState {
  hydrate: () => void
  setConfig: (config: Partial<WorkModeConfig>) => void
  startFocus: () => void
  startBreak: () => void
  pause: () => void
  reset: () => void
}

const initial = readWorkModeState()

export const useWorkModeStore = create<WorkModeStore>((set) => ({
  config: initial.config,
  snapshot: initial.snapshot,

  hydrate: () => {
    const state = readWorkModeState()
    set(state)
  },

  setConfig: (partial) => {
    const state = updateWorkModeState((current) => ({
      ...current,
      config: {
        ...current.config,
        ...partial,
      },
    }))
    set(state)
  },

  startFocus: () => {
    const runtime = new WorkModeRuntime(readWorkModeState())
    const state = runtime.startFocus()
    set(state)
  },

  startBreak: () => {
    const runtime = new WorkModeRuntime(readWorkModeState())
    const state = runtime.startBreak()
    set(state)
  },

  pause: () => {
    const runtime = new WorkModeRuntime(readWorkModeState())
    const state = runtime.pause()
    set(state)
  },

  reset: () => {
    const runtime = new WorkModeRuntime(readWorkModeState())
    const state = runtime.reset()
    set(state)
  },
}))

let subscribed = false

export function ensureWorkModeStoreSubscription() {
  if (subscribed) return
  subscribed = true

  subscribeWorkMode((state) => {
    useWorkModeStore.setState(state)
  })
}
