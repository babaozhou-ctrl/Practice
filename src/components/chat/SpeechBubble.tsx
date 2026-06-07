import React, { useEffect, useState } from 'react'
import { usePetStore } from '../../store/petStore'

const SpeechBubble: React.FC = () => {
  const speech = usePetStore((s) => s.speech)
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')

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

  const style: React.CSSProperties = {
    position: 'fixed',
    bottom: '175px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(30, 20, 40, 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1.5px solid rgba(192, 132, 252, 0.4)',
    borderRadius: '14px',
    padding: '10px 16px',
    fontSize: '13px',
    color: '#f1e8ff',
    maxWidth: '200px',
    textAlign: 'center',
    lineHeight: 1.4,
    zIndex: 99998,
    boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 15px rgba(192, 132, 252, 0.15)',
    whiteSpace: 'pre-wrap',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    pointerEvents: 'none',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  }

  // triangle pointer
  const pointerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '-8px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '8px solid transparent',
    borderRight: '8px solid transparent',
    borderTop: '8px solid rgba(30, 20, 40, 0.85)',
    filter: 'drop-shadow(0 1px 0 rgba(192, 132, 252, 0.4))',
  }

  return (
    <div style={style}>
      {text}
      <div style={pointerStyle} />
    </div>
  )
}

export default SpeechBubble
