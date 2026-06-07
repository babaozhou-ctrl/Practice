import React from 'react'
import { ChatMessage } from '../../types/chat'

interface Props { message: ChatMessage }

const MessageBubble: React.FC<Props> = ({ message }) => {
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

  return <div style={style}>{message.content}</div>
}

export default MessageBubble
