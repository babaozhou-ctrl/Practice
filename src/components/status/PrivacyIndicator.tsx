import React from 'react'
import { useContextStore } from '../../store/contextStore'
import { useChatStore } from '../../store/chatStore'

const PrivacyIndicator: React.FC = () => {
  const isScreenMonitoring = useContextStore((s) => s.isScreenMonitoring)
  const isAnalyzing = useContextStore((s) => s.isAnalyzing)
  const config = useChatStore((s) => s.config)

  const activeCount = [isScreenMonitoring, isAnalyzing, config.enabled].filter(Boolean).length
  const summary = isAnalyzing
    ? 'bb7 正在轻轻看一眼你眼前的内容。'
    : isScreenMonitoring
      ? '桌面感知处于开启状态，bb7 会根据场景调整反应。'
      : config.enabled
        ? '聊天能力已经打开，不过桌面感知现在是关闭的。'
        : '现在更偏安静陪伴，没有额外的桌面感知动作。'

  const items: Array<{ active: boolean; label: string; detail: string; tone: string }> = [
    {
      active: isScreenMonitoring,
      label: '屏幕感知',
      detail: isScreenMonitoring ? '已开启' : '未开启',
      tone: '#efb36a',
    },
    {
      active: isAnalyzing,
      label: '场景分析',
      detail: isAnalyzing ? '进行中' : '待命',
      tone: '#8ec5ec',
    },
    {
      active: config.enabled,
      label: 'AI 对话',
      detail: config.enabled ? '已开启' : '未开启',
      tone: '#93c8ad',
    },
  ]

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    width: 'min(272px, calc(100vw - 24px))',
    padding: '12px',
    borderRadius: '18px',
    border: '1px solid rgba(138, 191, 230, 0.18)',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(247,251,255,0.78)), radial-gradient(circle at top right, rgba(246,195,212,0.12), transparent 36%)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 16px 38px rgba(109, 143, 180, 0.14), 0 6px 16px rgba(153, 181, 207, 0.1)',
    zIndex: 99998,
    pointerEvents: 'none',
  }

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.24em', color: 'rgba(102,129,152,0.58)', marginBottom: '5px' }}>
        Companion Status
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#4d6881' }}>桌面状态提示</div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '5px 8px',
            borderRadius: '999px',
            background: activeCount > 0 ? 'rgba(255,255,255,0.72)' : 'rgba(248, 249, 252, 0.72)',
            border: '1px solid rgba(138, 191, 230, 0.14)',
            color: '#64809a',
            fontSize: '10px',
            fontWeight: 700,
          }}
        >
          {activeCount} 项活跃
        </div>
      </div>
      <div style={{ fontSize: '12px', lineHeight: 1.65, color: 'rgba(87,111,133,0.84)', marginBottom: '10px' }}>{summary}</div>
      <div style={{ display: 'grid', gap: '8px' }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '9px 10px',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.62)',
              border: '1px solid rgba(138, 191, 230, 0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '999px',
                  background: item.active ? item.tone : 'rgba(139, 159, 179, 0.34)',
                  boxShadow: item.active ? `0 0 0 4px ${hexToGlow(item.tone)}` : 'none',
                  flex: '0 0 auto',
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#4f6880' }}>{item.label}</div>
                <div style={{ fontSize: '10px', color: 'rgba(103,128,151,0.7)' }}>{item.detail}</div>
              </div>
            </div>
            <span
              style={{
                padding: '4px 7px',
                borderRadius: '999px',
                background: item.active ? 'rgba(255,255,255,0.72)' : 'rgba(245,247,250,0.82)',
                color: item.active ? '#5d7d97' : 'rgba(114, 134, 154, 0.68)',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {item.active ? 'On' : 'Off'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function hexToGlow(hex: string) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) {
    return 'rgba(142, 197, 236, 0.18)'
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, 0.22)`
}

export default PrivacyIndicator
