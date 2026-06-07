import { create } from 'zustand'
import type { WorkModeConfig, WorkModeState } from '../types/workMode'
import { getDefaultWorkModeState, readWorkModeState, subscribeWorkMode, updateWorkModeState } from '../workmode/WorkModeStore'

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
    const now = Date.now()
    const state = updateWorkModeState((current) => ({
      ...current,
      snapshot: {
        ...current.snapshot,
        phase: 'focus',
        phaseStartedAt: now,
        phaseEndsAt: now + current.config.focusMinutes * 60_000,
        updatedAt: now,
      },
    }))
    set(state)
  },

  startBreak: () => {
    const now = Date.now()
    const state = updateWorkModeState((current) => ({
      ...current,
      snapshot: {
        ...current.snapshot,
        phase: 'short_break',
        phaseStartedAt: now,
        phaseEndsAt: now + current.config.shortBreakMinutes * 60_000,
        isMutedUntilBreak: false,
        updatedAt: now,
      },
    }))
    set(state)
  },

  pause: () => {
    const now = Date.now()
    const state = updateWorkModeState((current) => ({
      ...current,
      snapshot: {
        ...current.snapshot,
        phase: 'paused',
        phaseEndsAt: null,
        updatedAt: now,
      },
    }))
    set(state)
  },

  reset: () => {
    const state = updateWorkModeState(() => getDefaultWorkModeState())
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
