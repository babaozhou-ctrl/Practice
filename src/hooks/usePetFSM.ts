import { useEffect, useRef } from 'react'
import { FSM } from '../engine/FSM'
import { usePetStore } from '../store/petStore'
import { PetState } from '../types/pet'

type FsmState = PetState
type FsmEvent = 'CLICK' | 'DRAG_START' | 'DRAG_END' | 'TIMEOUT' | 'SLEEP' | 'WAKE' | 'THINK'

export function usePetFSM() {
  const fsmRef = useRef<FSM<FsmState, FsmEvent> | null>(null)
  const setState = usePetStore((s) => s.setState)
  const state = usePetStore((s) => s.state)
  const prevState = usePetStore((s) => s.prevState)

  useEffect(() => {
    const fsm = new FSM<FsmState, FsmEvent>('IDLE', [
      { from: 'IDLE', event: 'CLICK', to: 'HAPPY' },
      { from: 'HAPPY', event: 'TIMEOUT', to: 'IDLE' },
      { from: 'IDLE', event: 'DRAG_START', to: 'WALK' },
      { from: 'WALK', event: 'DRAG_END', to: 'IDLE' },
      { from: 'IDLE', event: 'SLEEP', to: 'SLEEPING' },
      { from: 'SLEEPING', event: 'WAKE', to: 'IDLE' },
      { from: 'IDLE', event: 'THINK', to: 'THINKING' },
      { from: 'THINKING', event: 'TIMEOUT', to: 'IDLE' },
    { from: 'WATCHING', event: 'TIMEOUT', to: 'IDLE' },
    ])

    fsm.onEnter('HAPPY', () => {
      setTimeout(() => fsm.send('TIMEOUT'), 800)
    })
    fsm.onEnter('THINKING', () => {
      setTimeout(() => fsm.send('TIMEOUT'), 3000)
    })

    fsmRef.current = fsm
  }, [])

  useEffect(() => {
    if (fsmRef.current && fsmRef.current.state !== state) {
      // Sync external state changes to FSM
      const fsm = fsmRef.current
      const current = fsm.state

      if (current !== state) {
        fsm.reset(state)
      }
    }
  }, [state])

  return {
    send: (event: FsmEvent) => {
      fsmRef.current?.send(event)
    },
    fsm: fsmRef.current,
  }
}
