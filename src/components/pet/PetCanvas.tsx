import React, { useRef, useEffect, useCallback } from 'react'
import { Animator } from '../../engine/Animator'
import { PixelRenderer } from '../../engine/PixelRenderer'
import { createMochiSprite } from '../../engine/PixelMochi'
import { Sprite } from '../../engine/Sprite'
import { usePetStore } from '../../store/petStore'
import { useDrag } from '../../hooks/useDrag'

const PetCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<PixelRenderer | null>(null)
  const animatorRef = useRef<Animator | null>(null)
  const spriteRef = useRef<Sprite | null>(null)
  const frameIdRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const state = usePetStore((s) => s.state)
  const skinIndex = usePetStore((s) => s.skinIndex)
  const customPetDef = usePetStore((s) => s.customPetDefinition)

  useDrag(canvasRef)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const renderer = new PixelRenderer(canvas)
    const sprite = customPetDef ? new Sprite(customPetDef) : createMochiSprite()
    const animator = new Animator()
    spriteRef.current = sprite
    rendererRef.current = renderer
    animatorRef.current = animator
    renderer.setSprite(sprite)
    animator.registerClips(sprite.getAllClips())
    animator.play('IDLE')
    const size = renderer.getCanvasSize()
    canvas.style.width = size.width + 'px'
    canvas.style.height = size.height + 'px'
    lastTimeRef.current = 0
    const animate = (timestamp: number) => {
      const delta = lastTimeRef.current ? timestamp - lastTimeRef.current : 16
      lastTimeRef.current = timestamp
      const frame = animator.update(delta)
      if (frame) renderer.renderFrame(frame)
      frameIdRef.current = requestAnimationFrame(animate)
    }
    frameIdRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameIdRef.current)
  }, [customPetDef])

  useEffect(() => {
    if (!animatorRef.current || !spriteRef.current) return
    const clip = spriteRef.current.getClip(state)
    if (clip) animatorRef.current.play(state)
  }, [state])

  useEffect(() => {
    if (!spriteRef.current) return
    spriteRef.current.setPalette(skinIndex)
  }, [skinIndex])

  useEffect(() => {
    if (!spriteRef.current) return
    if (customPetDef) {
      spriteRef.current = new Sprite(customPetDef)
      rendererRef.current?.setSprite(spriteRef.current)
      animatorRef.current?.registerClips(spriteRef.current.getAllClips())
      animatorRef.current?.play(state as any)
    }
  }, [customPetDef])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    usePetStore.getState().setContextMenu(true, { x: e.clientX, y: e.clientY })
  }, [])

  const canvasStyle: React.CSSProperties = {
    display: 'block', position: 'absolute',
    left: '50%', top: '50%',
    transform: 'translate(-50%, -50%)',
    cursor: 'grab', userSelect: 'none',
    WebkitUserSelect: 'none',
    pointerEvents: 'auto',
  }

  return (
    <canvas ref={canvasRef} style={canvasStyle} onContextMenu={handleContextMenu} />
  )
}

export default PetCanvas
