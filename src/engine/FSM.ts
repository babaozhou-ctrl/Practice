export type FSMState = string

export type FSMEvent = string

export interface FSMTransition<S extends FSMState, E extends FSMEvent> {
  from: S
  event: E
  to: S
  guard?: () => boolean
  onTransition?: () => void
}

export class FSM<S extends FSMState, E extends FSMEvent> {
  private currentState: S
  private transitions: FSMTransition<S, E>[]
  private onEnterCallbacks: Map<S, () => void> = new Map()
  private onExitCallbacks: Map<S, () => void> = new Map()

  constructor(initialState: S, transitions: FSMTransition<S, E>[] = []) {
    this.currentState = initialState
    this.transitions = transitions
  }

  get state(): S {
    return this.currentState
  }

  setTransitions(transitions: FSMTransition<S, E>[]) {
    this.transitions = transitions
  }

  addTransition(transition: FSMTransition<S, E>) {
    this.transitions.push(transition)
  }

  onEnter(state: S, callback: () => void) {
    this.onEnterCallbacks.set(state, callback)
  }

  onExit(state: S, callback: () => void) {
    this.onExitCallbacks.set(state, callback)
  }

  send(event: E): boolean {
    const valid = this.transitions.filter(
      (t) => t.from === this.currentState && t.event === event
    )

    for (const transition of valid) {
      if (transition.guard && !transition.guard()) continue

      this.onExitCallbacks.get(this.currentState)?.()
      this.currentState = transition.to
      transition.onTransition?.()
      this.onEnterCallbacks.get(this.currentState)?.()
      return true
    }

    return false
  }

  can(event: E): boolean {
    return this.transitions.some(
      (t) => t.from === this.currentState && t.event === event
    )
  }

  reset(state: S) {
    this.currentState = state
  }
}
