export interface PetDragControllerOptions {
  element: HTMLElement
  onDragStart: () => void
  onDragEnd: () => void
  onTap: () => void
}

export class PetDragController {
  private readonly element: HTMLElement
  private readonly onDragStart: () => void
  private readonly onDragEnd: () => void
  private readonly onTap: () => void

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
  }

  mount() {
    this.element.addEventListener('pointerdown', this.handlePointerDown)
    this.element.addEventListener('pointermove', this.handlePointerMove)
    this.element.addEventListener('pointerup', this.handlePointerUp)
    this.element.addEventListener('pointercancel', this.handlePointerUp)
    this.element.addEventListener('pointerleave', this.handlePointerUp)
  }

  destroy() {
    this.element.removeEventListener('pointerdown', this.handlePointerDown)
    this.element.removeEventListener('pointermove', this.handlePointerMove)
    this.element.removeEventListener('pointerup', this.handlePointerUp)
    this.element.removeEventListener('pointercancel', this.handlePointerUp)
    this.element.removeEventListener('pointerleave', this.handlePointerUp)
    if (this.moveRaf) cancelAnimationFrame(this.moveRaf)
  }

  private handlePointerDown = async (event: PointerEvent) => {
    if (event.button !== 0) return
    this.pointerId = event.pointerId
    this.dragging = false
    this.pressStart = { x: event.screenX, y: event.screenY }
    this.windowStart = await window.electronAPI?.getPosition?.() ?? { x: 0, y: 0 }
    this.element.setPointerCapture(event.pointerId)
  }

  private handlePointerMove = (event: PointerEvent) => {
    if (this.pointerId !== event.pointerId) return
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
    if (this.moveRaf) {
      cancelAnimationFrame(this.moveRaf)
      this.moveRaf = 0
    }
    if (this.pendingTarget) {
      window.electronAPI?.movePet?.(this.pendingTarget.x, this.pendingTarget.y)
      this.pendingTarget = null
    }

    if (this.dragging) {
      this.dragging = false
      this.onDragEnd()
    } else {
      this.onTap()
    }

    this.pointerId = null
    try {
      this.element.releasePointerCapture(event.pointerId)
    } catch {}
  }
}
