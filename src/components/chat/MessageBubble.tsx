import React from 'react'
import { ChatMessage } from '../../types/chat'

interface Props {
  message: ChatMessage
  onActionSelect?: (message: ChatMessage, actionId: string) => void
}

const MessageBubble: React.FC<Props> = ({ message, onActionSelect }) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const bubbleStyle = resolveBubbleStyle(isUser, isSystem)

  const style: React.CSSProperties = {
    maxWidth: '82%',
    padding: isSystem ? '10px 13px' : '10px 14px',
    borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
    background: bubbleStyle.background,
    color: bubbleStyle.color,
    fontSize: '13px',
    lineHeight: 1.58,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    border: bubbleStyle.border,
    boxShadow: bubbleStyle.shadow,
    backdropFilter: 'blur(8px)',
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
    padding: '5px 10px',
    fontSize: '11px',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.55)',
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

function resolveBubbleStyle(isUser: boolean, isSystem: boolean) {
  if (isUser) {
    return {
      background: 'linear-gradient(135deg, rgba(255, 244, 248, 0.94), rgba(237, 246, 255, 0.92))',
      color: '#566f87',
      border: '1px solid rgba(246, 195, 212, 0.38)',
      shadow: '0 10px 20px rgba(246, 195, 212, 0.12)',
    }
  }

  if (isSystem) {
    return {
      background: 'linear-gradient(180deg, rgba(250, 252, 255, 0.9), rgba(242, 247, 253, 0.82))',
      color: 'rgba(103, 123, 145, 0.9)',
      border: '1px dashed rgba(138, 191, 230, 0.32)',
      shadow: 'none',
    }
  }

  return {
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(246, 250, 255, 0.86))',
    color: '#4f6880',
    border: '1px solid rgba(138, 191, 230, 0.22)',
    shadow: '0 12px 26px rgba(110, 145, 176, 0.1)',
  }
}

export default MessageBubble
