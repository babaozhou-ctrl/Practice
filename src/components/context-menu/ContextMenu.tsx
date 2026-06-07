import React, { useEffect, useRef } from 'react'
import { usePetStore } from '../../store/petStore'
import { useContextStore } from '../../store/contextStore'

const ITEMS = ['Cyberpunk', 'Midnight', 'Daydream', 'Neon', 'Classic']

const ContextMenu: React.FC = () => {
  const {
    isContextMenuOpen,
    contextMenuPosition,
    setContextMenu,
    toggleChat,
    setClickThrough,
    setSkinIndex,
    skinIndex,
  } = usePetStore()
  const { isScreenMonitoring } = useContextStore()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isContextMenuOpen) return
    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu(false)
      }
    }
    setTimeout(() => document.addEventListener('mousedown', handleMouseDown), 0)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isContextMenuOpen, setContextMenu])

  if (!isContextMenuOpen) return null

  const items = [
    { label: 'Open Chat', action: () => { toggleChat(); setContextMenu(false) } },
    {
      label: `Click-Through: ${usePetStore.getState().isClickThrough ? 'on' : 'off'}`,
      action: () => {
        setClickThrough(!usePetStore.getState().isClickThrough)
        window.electronAPI?.toggleClickThrough?.()
        setContextMenu(false)
      },
    },
    { type: 'div' as const },
    {
      label: `Palette: ${ITEMS[skinIndex]}`,
      action: () => {
        setSkinIndex((skinIndex + 1) % ITEMS.length)
        setContextMenu(false)
      },
    },
    { type: 'div' as const },
    {
      label: `Monitor: ${isScreenMonitoring ? 'on' : 'off'}`,
      action: () => {
        useContextStore.getState().setScreenMonitoring(!isScreenMonitoring)
        setContextMenu(false)
      },
    },
    { type: 'div' as const },
    {
      label: 'Quit',
      action: () => { window.electronAPI?.quitApp?.() },
      color: 'rgba(255, 150, 150, 0.8)',
    },
  ]

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: contextMenuPosition.x,
        top: contextMenuPosition.y,
        background: 'rgba(22, 18, 36, 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1.5px solid rgba(192, 132, 252, 0.2)',
        borderRadius: '14px',
        padding: '6px',
        zIndex: 99999,
        minWidth: '170px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(192, 132, 252, 0.06)',
      }}
    >
      {items.map((item, index) => {
        if ('type' in item) {
          return (
            <div
              key={index}
              style={{
                height: '1px',
                background: 'rgba(192, 132, 252, 0.12)',
                margin: '4px 8px',
              }}
            />
          )
        }

        return (
          <div
            key={index}
            onClick={item.action}
            style={{
              padding: '8px 14px',
              color: item.color || '#d4c8ee',
              fontSize: '13px',
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(event) => {
              ;(event.target as HTMLElement).style.background = 'rgba(192, 132, 252, 0.12)'
            }}
            onMouseLeave={(event) => {
              ;(event.target as HTMLElement).style.background = 'transparent'
            }}
          >
            {item.label}
          </div>
        )
      })}
    </div>
  )
}

export default ContextMenu
