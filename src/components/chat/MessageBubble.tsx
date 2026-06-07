import React from 'react'
import { ChatMessage } from '../../types/chat'

interface Props {
  message: ChatMessage
  onActionSelect?: (message: ChatMessage, actionId: string) => void
}

const MessageBubble: React.FC<Props> = ({ message, onActionSelect }) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  const style: React.CSSProperties = {
    maxWidth: '82%',
    padding: '9px 14px',
    borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
    background: isUser
      ? 'linear-gradient(135deg, rgba(167, 139, 250, 0.35), rgba(192, 132, 252, 0.2))'
      : isSystem
        ? 'rgba(100, 80, 140, 0.15)'
        : 'rgba(40, 32, 56, 0.6)',
    color: isUser ? '#e8d8ff' : isSystem ? 'rgba(200, 180, 230, 0.6)' : '#d4c8ee',
    fontSize: '13px', lineHeight: 1.5, wordBreak: 'break-word',
    whiteSpace: 'pre-wrap', alignSelf: isUser ? 'flex-end' : 'flex-start',
    border: isSystem ? '1px dashed rgba(192, 132, 252, 0.15)' : 'none',
    backdropFilter: 'blur(4px)',
  }

  const actionsWrap: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '10px',
  }

  const actionButton: React.CSSProperties = {
    border: '1px solid rgba(138, 191, 230, 0.26)',
    background: 'rgba(255, 255, 255, 0.12)',
    color: isSystem ? '#f3dffb' : '#edf6ff',
    borderRadius: '999px',
    padding: '5px 10px',
    fontSize: '11px',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  }

  return (
    <div style={style}>
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
  )
}

export default MessageBubble
