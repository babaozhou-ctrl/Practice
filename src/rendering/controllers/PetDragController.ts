export interface PetDragControllerOptions {
  element: HTMLElement
  onDragStart: () => void
  onDragEnd: () => void
  onTap: () => void
  canStartInteraction?: (event: PointerEvent) => boolean
  canTriggerTap?: (event: PointerEvent) => boolean
  isHoveringInteractiveTarget?: (event: PointerEvent) => boolean
}

export class PetDragController {
  private readonly element: HTMLElement
  private readonly onDragStart: () => void
  private readonly onDragEnd: () => void
  private readonly onTap: () => void
  private readonly canStartInteraction?: (event: PointerEvent) => boolean
  private readonly canTriggerTap?: (event: PointerEvent) => boolean
  private readonly isHoveringInteractiveTarget?: (event: PointerEvent) => boolean

  private pointerId: number | null = null
  private pressStart = { x: 0, y: 0 }
  private windowStart = { x: 0, y: 0 }
  private dragging = false
  private moveRaf = 0
  private pendingTarget: { x: number; y: number } | null = null

  constructor(options: PetDragControllerOptions) {
    this.element = options.element
    this.onDragStart = options.onDragStart
    this.onDragEnd = options.onDragEnd
    this.onTap = options.onTap
    this.canStartInteraction = options.canStartInteraction
    this.canTriggerTap = options.canTriggerTap
    this.isHoveringInteractiveTarget = options.isHoveringInteractiveTarget
  }

  mount() {
    this.element.addEventListener('pointerdown', this.handlePointerDown)
    this.element.addEventListener('pointermove', this.handlePointerMove)
    this.element.addEventListener('pointerup', this.handlePointerUp)
    this.element.addEventListener('pointercancel', this.handlePointerCancel)
    this.element.addEventListener('pointerleave', this.handlePointerLeave)
    this.element.addEventListener('pointerenter', this.handlePointerHover)
  }

  destroy() {
    this.element.removeEventListener('pointerdown', this.handlePointerDown)
    this.element.removeEventListener('pointermove', this.handlePointerMove)
    this.element.removeEventListener('pointerup', this.handlePointerUp)
    this.element.removeEventListener('pointercancel', this.handlePointerCancel)
    this.element.removeEventListener('pointerleave', this.handlePointerLeave)
    this.element.removeEventListener('pointerenter', this.handlePointerHover)
    if (this.moveRaf) cancelAnimationFrame(this.moveRaf)
    this.element.style.cursor = 'default'
  }

  private handlePointerDown = async (event: PointerEvent) => {
    if (event.button !== 0) return
    if (this.canStartInteraction && !this.canStartInteraction(event)) return
    this.pointerId = event.pointerId
    this.dragging = false
    this.pressStart = { x: event.screenX, y: event.screenY }
    this.windowStart = await window.electronAPI?.getPosition?.() ?? { x: 0, y: 0 }
    this.element.setPointerCapture(event.pointerId)
    this.element.style.cursor = 'grabbing'
  }

  private handlePointerMove = (event: PointerEvent) => {
    if (this.pointerId !== event.pointerId) {
      this.updateHoverCursor(event)
      return
    }
    const dx = event.screenX - this.pressStart.x
    const dy = event.screenY - this.pressStart.y

    if (!this.dragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      this.dragging = true
      this.onDragStart()
    }

    if (!this.dragging) return

    this.pendingTarget = {
      x: Math.round(this.windowStart.x + dx),
      y: Math.round(this.windowStart.y + dy),
    }

    if (this.moveRaf) return
    this.moveRaf = requestAnimationFrame(() => {
      this.moveRaf = 0
      if (!this.pendingTarget) return
      window.electronAPI?.movePet?.(this.pendingTarget.x, this.pendingTarget.y)
      this.pendingTarget = null
    })
  }

  private handlePointerUp = (event: PointerEvent) => {
    if (this.pointerId !== event.pointerId) return
    this.flushPendingMove()

    if (this.dragging) {
      this.dragging = false
      this.onDragEnd()
    } else if (!this.canTriggerTap || this.canTriggerTap(event)) {
      this.onTap()
    }

    this.pointerId = null
    this.updateHoverCursor(event)
    try {
      this.element.releasePointerCapture(event.pointerId)
    } catch {}
  }

  private handlePointerCancel = (event: PointerEvent) => {
    if (this.pointerId !== event.pointerId) return
    this.abortPointerInteraction(event.pointerId)
  }

  private handlePointerLeave = (event: PointerEvent) => {
    if (this.pointerId !== event.pointerId) return
    if (this.dragging) {
      return
    }
    this.abortPointerInteraction(event.pointerId)
    this.element.style.cursor = 'default'
  }

  private handlePointerHover = (event: PointerEvent) => {
    this.updateHoverCursor(event)
  }

  private flushPendingMove() {
    if (this.moveRaf) {
      cancelAnimationFrame(this.moveRaf)
      this.moveRaf = 0
    }
    if (this.pendingTarget) {
      window.electronAPI?.movePet?.(this.pendingTarget.x, this.pendingTarget.y)
      this.pendingTarget = null
    }
  }

  private abortPointerInteraction(pointerId: number) {
    this.flushPendingMove()
    if (this.dragging) {
      this.dragging = false
      this.onDragEnd()
    }
    this.pointerId = null
    this.element.style.cursor = 'default'
    try {
      this.element.releasePointerCapture(pointerId)
    } catch {}
  }

  private updateHoverCursor(event: PointerEvent) {
    if (this.dragging || this.pointerId === event.pointerId) {
      return
    }

    const hoveringInteractiveTarget = this.isHoveringInteractiveTarget
      ? this.isHoveringInteractiveTarget(event)
      : this.canStartInteraction?.(event) ?? false

    this.element.style.cursor = hoveringInteractiveTarget ? 'grab' : 'default'
  }
}
