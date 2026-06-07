import React from 'react'
import { useContextStore } from '../../store/contextStore'
import { useChatStore } from '../../store/chatStore'

const PrivacyIndicator: React.FC = () => {
  const isScreenMonitoring = useContextStore((s) => s.isScreenMonitoring)
  const isAnalyzing = useContextStore((s) => s.isAnalyzing)
  const config = useChatStore((s) => s.config)

  const indicators: Array<{ active: boolean; label: string; color: string }> = [
    {
      active: isScreenMonitoring,
      label: 'Screen',
      color: '#ef4444',
    },
    {
      active: isAnalyzing,
      label: 'AI',
      color: '#f59e0b',
    },
    {
      active: config.enabled,
      label: 'API',
      color: '#22c55e',
    },
  ]

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '8px',
    right: '8px',
    display: 'flex',
    gap: '6px',
    zIndex: 99998,
  }

  const dotStyle = (active: boolean, color: string): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: active ? color : '#475569',
    transition: 'background 0.3s ease',
    cursor: 'help',
    boxShadow: active ? `0 0 4px ${color}` : 'none',
  })

  return (
    <div style={containerStyle}>
      {indicators.map((ind, i) => (
        <div
          key={i}
          style={dotStyle(ind.active, ind.color)}
          title={`${ind.label}: ${ind.active ? 'Active' : 'Inactive'}`}
        />
      ))}
    </div>
  )
}

export default PrivacyIndicator
