import React from 'react'
import { ChatMessage } from '../../types/chat'

interface Props {
  message: ChatMessage
  assistantName?: string
  onActionSelect?: (message: ChatMessage, actionId: string) => void
}

const MessageBubble: React.FC<Props> = ({ message, assistantName = 'bb7', onActionSelect }) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const bubbleStyle = resolveBubbleStyle(isUser, isSystem)
  const label = isUser ? '你' : isSystem ? '桌面提示' : assistantName

  const shellStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: isUser ? 'flex-end' : 'flex-start',
    gap: '6px',
  }

  const metaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: isUser ? '0 4px 0 0' : '0 0 0 4px',
    fontSize: '10px',
    lineHeight: 1,
    color: isSystem ? 'rgba(118, 136, 154, 0.86)' : 'rgba(109, 129, 150, 0.72)',
    textTransform: isSystem ? 'uppercase' : 'none',
    letterSpacing: isSystem ? '0.24px' : '0.12px',
  }

  const bubbleShellStyle: React.CSSProperties = {
    maxWidth: '84%',
    padding: isSystem ? '10px 13px' : '12px 14px',
    borderRadius: isSystem ? '16px' : isUser ? '18px 18px 8px 18px' : '18px 18px 18px 8px',
    background: bubbleStyle.background,
    color: bubbleStyle.color,
    fontSize: '13px',
    lineHeight: 1.66,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    border: bubbleStyle.border,
    boxShadow: bubbleStyle.shadow,
    backdropFilter: 'blur(10px)',
  }

  const actionsWrap: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '10px',
  }

  const actionButton: React.CSSProperties = {
    border: '1px solid rgba(138, 191, 230, 0.26)',
    background: isUser ? 'rgba(255, 255, 255, 0.66)' : 'rgba(255, 255, 255, 0.74)',
    color: isSystem ? '#6f8096' : '#597189',
    borderRadius: '999px',
    padding: '6px 11px',
    fontSize: '11px',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.55)',
  }

  return (
    <div style={shellStyle}>
      <div style={metaStyle}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span>{formatTimestamp(message.timestamp)}</span>
      </div>
      <div style={bubbleShellStyle}>
        <div>{message.content}</div>
        {message.actions && message.actions.length > 0 && (
          <div style={actionsWrap}>
            {message.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                style={actionButton}
                onClick={() => onActionSelect?.(message, action.id)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function resolveBubbleStyle(isUser: boolean, isSystem: boolean) {
  if (isUser) {
    return {
      background: 'linear-gradient(135deg, rgba(255, 244, 248, 0.96), rgba(236, 246, 255, 0.94))',
      color: '#566f87',
      border: '1px solid rgba(246, 195, 212, 0.38)',
      shadow: '0 12px 24px rgba(246, 195, 212, 0.12)',
    }
  }

  if (isSystem) {
    return {
      background: 'linear-gradient(180deg, rgba(249, 252, 255, 0.9), rgba(243, 248, 253, 0.84))',
      color: 'rgba(103, 123, 145, 0.9)',
      border: '1px dashed rgba(138, 191, 230, 0.32)',
      shadow: 'none',
    }
  }

  return {
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(246, 250, 255, 0.88))',
    color: '#4f6880',
    border: '1px solid rgba(138, 191, 230, 0.22)',
    shadow: '0 14px 28px rgba(110, 145, 176, 0.1)',
  }
}

export default MessageBubble
