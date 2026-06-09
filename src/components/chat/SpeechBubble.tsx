import React, { useEffect, useState } from 'react'
import { resolveSelectedPetPackage } from '../../pets/resolveSelectedPetPackage'
import { usePetStore } from '../../store/petStore'

const SpeechBubble: React.FC = () => {
  const speech = usePetStore((s) => s.speech)
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')
  const [petName, setPetName] = useState(() => resolveSelectedPetPackage().manifest.name || 'bb7')

  useEffect(() => {
    setPetName(resolveSelectedPetPackage().manifest.name || 'bb7')
  }, [speech?.timestamp])

  useEffect(() => {
    if (speech) {
      setText(speech.message)
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        usePetStore.getState().hideSpeech()
      }, speech.duration)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [speech])

  if (!visible || !text) return null

  const shellStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '170px',
    left: '50%',
    transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(8px)',
    width: 'min(280px, calc(100vw - 32px))',
    zIndex: 99998,
    pointerEvents: 'none',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    opacity: visible ? 1 : 0,
  }

  const bubbleStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '20px',
    padding: '12px 14px 14px',
    background:
      'linear-gradient(180deg, rgba(255, 252, 247, 0.95), rgba(243, 249, 255, 0.92)), radial-gradient(circle at top right, rgba(246,195,212,0.18), transparent 34%)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(138, 191, 230, 0.24)',
    boxShadow: '0 18px 42px rgba(74, 102, 128, 0.18), 0 6px 18px rgba(255, 214, 230, 0.12)',
    color: '#4f6880',
    textAlign: 'center',
  }

  const pointerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '-8px',
    left: '50%',
    transform: 'translateX(-50%) rotate(45deg)',
    width: '18px',
    height: '18px',
    borderRight: '1px solid rgba(138, 191, 230, 0.24)',
    borderBottom: '1px solid rgba(138, 191, 230, 0.24)',
    background: 'linear-gradient(135deg, rgba(249, 252, 255, 0.96), rgba(243, 249, 255, 0.92))',
    boxSizing: 'border-box',
  }

  return (
    <div style={shellStyle}>
      <div style={bubbleStyle}>
        <div
          style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.28px',
            color: 'rgba(103, 128, 151, 0.6)',
            marginBottom: '6px',
          }}
        >
          {petName}
        </div>
        <div
          style={{
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#516b84',
            whiteSpace: 'pre-wrap',
          }}
        >
          {text}
        </div>
        <div style={pointerStyle} />
      </div>
    </div>
  )
}

export default SpeechBubble
