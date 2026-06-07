import { useRef, useCallback, useEffect } from 'react'
import { usePetStore } from '../store/petStore'

export function useDrag(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const setState = usePetStore((s) => s.setState)
  const setPosition = usePetStore((s) => s.setPosition)

  // All drag state lives in refs — zero React re-renders during drag
  const state = useRef({
    mouseDown: false,
    dragging: false,
    posStart: { x: 0, y: 0 },
    dragStart: { x: 0, y: 0 },
    pendingPos: null as { x: number; y: number } | null,
    rafId: 0,
    timerId: null as ReturnType<typeof setTimeout> | null,
  })

  // Flush pending position via rAF
  const flushPosition = useCallback(() => {
    const s = state.current
    if (!s.pendingPos) return
    const { x, y } = s.pendingPos
    s.pendingPos = null
    s.rafId = 0
    setPosition({ x, y })
    window.electronAPI?.movePet(x, y)
  }, [setPosition])

  // ---- raw DOM event handlers (bypass React synthetic events) ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const s = state.current

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const pos = usePetStore.getState().position // read once, no subscription
      s.mouseDown = true
      s.dragging = false
      s.dragStart = { x: e.clientX, y: e.clientY }
      s.posStart = { ...pos }

      s.timerId = setTimeout(() => {
        if (s.mouseDown) {
          s.dragging = true
          setState('WALK')
        }
      }, 180)
    }

    const onMove = (e: MouseEvent) => {
      if (!s.mouseDown) return

      if (!s.dragging) {
        const dx = Math.abs(e.clientX - s.dragStart.x)
        const dy = Math.abs(e.clientY - s.dragStart.y)
        if (dx > 5 || dy > 5) {
          if (s.timerId) clearTimeout(s.timerId)
          s.dragging = true
          setState('WALK')
        }
        return
      }

      // Calculate new position
      const newX = s.posStart.x + (e.clientX - s.dragStart.x)
      const newY = s.posStart.y + (e.clientY - s.dragStart.y)

      // Batch via rAF — only one IPC per frame
      s.pendingPos = { x: newX, y: newY }
      if (!s.rafId) {
        s.rafId = requestAnimationFrame(flushPosition)
      }
    }

    const onUp = (e: MouseEvent) => {
      if (e.button !== 0) return
      s.mouseDown = false
      if (s.timerId) clearTimeout(s.timerId)

      // Flush any pending position
      if (s.pendingPos) {
        setPosition(s.pendingPos)
        window.electronAPI?.movePet(s.pendingPos.x, s.pendingPos.y)
        s.pendingPos = null
      }
      if (s.rafId) { cancelAnimationFrame(s.rafId); s.rafId = 0 }

      if (!s.dragging) {
        setState('HAPPY')
        setTimeout(() => setState('IDLE'), 600)
      } else {
        s.dragging = false
        setState('IDLE')
      }
    }

    const onLeave = () => {
      s.mouseDown = false
      if (s.timerId) clearTimeout(s.timerId)
      if (s.dragging) {
        s.dragging = false
        setState('IDLE')
      }
    }

    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseup', onUp)
    canvas.addEventListener('mouseleave', onLeave)

    return () => {
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('mouseleave', onLeave)
      if (s.timerId) clearTimeout(s.timerId)
      if (s.rafId) cancelAnimationFrame(s.rafId)
    }
  }, [canvasRef, setState, setPosition, flushPosition])

  // Return no-op handlers for React JSX compatibility
  return {
    onMouseDown: () => {},
    onMouseMove: () => {},
    onMouseUp: () => {},
    onMouseLeave: () => {},
  }
}
