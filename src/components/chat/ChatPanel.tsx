import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useContextStore } from '../../store/contextStore'
import { ChatClient } from '../../ai/ChatClient'
import { buildChatReplyUtterance, buildFileAnalysisUtterance } from '../../ai/CompanionDesktopSummary'
import { emitCompanionUtterance } from '../../ai/CompanionUtteranceBridge'
import { buildCompanionChatContext } from '../../ai/CompanionContextAdapter'
import { resolveAIChatProvider, resolveFileAnalysisProvider } from '../../plugins/PluginCapabilityRegistry'
import { usePluginProviderStore } from '../../plugins/PluginProviderStore'
import { useSelectedPetCapabilityStore } from '../../store/selectedPetCapabilityStore'
import MessageBubble from './MessageBubble'

interface Props { onClose: () => void }

const ChatPanel: React.FC<Props> = ({ onClose }) => {
  const { messages, config, addMessage, appendToLastMessage, setStreaming, isStreaming } = useChatStore()
  const activity = useContextStore((state) => state.activity)
  const windowTitle = useContextStore((state) => state.activeWindow.title)
  const windowProcess = useContextStore((state) => state.activeWindow.process)
  const canAnalyzeFiles = useSelectedPetCapabilityStore((state) => state.fileAnalysis)
  const aiChatProviderId = usePluginProviderStore((state) => state.aiChatProviderId)
  const fileAnalysisProviderId = usePluginProviderStore((state) => state.fileAnalysisProviderId)
  const [input, setInput] = useState('')
  const [client] = useState(() => new ChatClient(config, aiChatProviderId))
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => { client.updateConfig(config) }, [config, client])
  useEffect(() => { client.updateProvider(aiChatProviderId) }, [aiChatProviderId, client])
  useEffect(() => { client.syncTranscript(messages) }, [messages, client])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { setVisible(true) }, [])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return

    const content = input.trim()
    setInput('')
    addMessage({ id: Date.now().toString(), role: 'user', content, timestamp: Date.now() })
    setStreaming(true)

    const context = buildCompanionChatContext(activity, windowTitle, windowProcess)
    addMessage({ id: `resp-${Date.now()}`, role: 'assistant', content: '', timestamp: Date.now() })

    await client.sendMessage(
      content,
      context,
      (chunk) => appendToLastMessage(chunk),
      (fullReply) => {
        if (fullReply.trim()) {
          emitCompanionUtterance({
            source: 'chat',
            message: buildChatReplyUtterance(fullReply),
            duration: 2600,
          })
        }
        setStreaming(false)
      },
      (err) => {
        appendToLastMessage(`[Error: ${err.message}]`)
        setStreaming(false)
      },
    )
  }, [input, isStreaming, activity, windowTitle, windowProcess, client, addMessage, appendToLastMessage, setStreaming])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  const analyzeFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !canAnalyzeFiles || isStreaming) return

    const file = files[0]
    const aiChatProvider = resolveAIChatProvider(aiChatProviderId)
    const fileAnalysisProvider = resolveFileAnalysisProvider(fileAnalysisProviderId)
    addMessage({
      id: `file-${Date.now()}`,
      role: 'system',
      content: `正在分析文件：${file.name}`,
      timestamp: Date.now(),
    })

    try {
      const content = await fileAnalysisProvider.readFile(file)
      const localSummary = fileAnalysisProvider.summarize(content)
      let summary = localSummary

      if (config.enabled && config.apiKey) {
        try {
          summary = await aiChatProvider.summarizeDocument({
            config,
            fileName: file.name,
            content,
          })
        } catch (error: any) {
          addMessage({
            id: `file-ai-fallback-${Date.now()}`,
            role: 'system',
            content: `AI 总结暂时不可用，先给你本地预览版摘要：${error.message}`,
            timestamp: Date.now(),
          })
        }
      }

      emitCompanionUtterance({
        source: 'file-analysis',
        message: buildFileAnalysisUtterance(file.name, summary),
        duration: 3200,
      })

      const prompt = `请陪我一起理解这个文件。\n\n文件：${file.name}\n\n摘要：\n${summary}\n\n如果你觉得有必要，也可以提醒我最值得继续看的部分。`
      setInput(prompt)
    } catch (error: any) {
      addMessage({
        id: `file-error-${Date.now()}`,
        role: 'system',
        content: `文件分析失败：${error.message}`,
        timestamp: Date.now(),
      })
    }
  }, [addMessage, aiChatProviderId, canAnalyzeFiles, config, fileAnalysisProviderId, isStreaming])

  const styles: Record<string, React.CSSProperties> = {
    panel: {
      position: 'fixed',
      bottom: '180px',
      right: '20px',
      width: '320px',
      height: '440px',
      background: 'linear-gradient(180deg, rgba(255, 252, 247, 0.94), rgba(243, 249, 255, 0.9))',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(138, 191, 230, 0.34)',
      borderRadius: '18px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10000,
      overflow: 'hidden',
      boxShadow: '0 14px 38px rgba(74, 102, 128, 0.18), 0 6px 16px rgba(255, 214, 230, 0.18)',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
    },
    header: {
      padding: '14px 18px 10px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: '#4c6983',
      fontSize: '14px',
      fontWeight: 600,
      letterSpacing: '0.3px',
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      color: '#7c99b3',
      cursor: 'pointer',
      fontSize: '18px',
      lineHeight: 1,
      padding: 0,
    },
    msgs: {
      flex: 1,
      padding: '8px 14px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    empty: {
      color: 'rgba(104, 132, 157, 0.62)',
      fontSize: '12px',
      textAlign: 'center',
      padding: '24px',
    },
    inputRow: {
      padding: '10px 14px 14px',
      display: 'flex',
      gap: '8px',
      alignItems: 'flex-end',
    },
    input: {
      flex: 1,
      padding: '9px 14px',
      borderRadius: '12px',
      border: '1px solid rgba(138, 191, 230, 0.28)',
      background: 'rgba(255, 255, 255, 0.72)',
      color: '#49657f',
      fontSize: '13px',
      outline: 'none',
      resize: 'none',
      fontFamily: 'inherit',
    },
    sendBtn: {
      minWidth: '64px',
      padding: '9px 16px',
      borderRadius: '12px',
      border: 'none',
      background: isStreaming ? 'rgba(189, 213, 231, 0.72)' : 'linear-gradient(135deg, #8ec5ec, #f6c3d4)',
      color: isStreaming ? 'rgba(73, 101, 127, 0.72)' : '#ffffff',
      fontSize: '13px',
      fontWeight: 600,
      cursor: isStreaming ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.2s, transform 0.2s',
    },
    utilityBtn: {
      minWidth: '44px',
      padding: '9px 10px',
      borderRadius: '12px',
      border: '1px solid rgba(138, 191, 230, 0.28)',
      background: 'rgba(255, 255, 255, 0.72)',
      color: '#56728b',
      fontSize: '12px',
      cursor: 'pointer',
    },
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span>Mochi</span>
        <button onClick={onClose} style={styles.closeBtn}>
          x
        </button>
      </div>
      <div style={styles.msgs}>
        {messages.length === 0 && <div style={styles.empty}>Mochi 在等你先开口。</div>}
        {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
        <div ref={messagesEndRef} />
      </div>
      <div style={styles.inputRow}>
        {canAnalyzeFiles && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".txt,.md,.json,.xml,.yaml,.yml,.toml,.csv,.pdf,.docx,.js,.ts,.jsx,.tsx,.py,.rs,.go,.java,.cpp,.c,.cs,.sql"
              onChange={(event) => {
                void analyzeFiles(event.target.files)
                event.currentTarget.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={styles.utilityBtn}
              disabled={isStreaming}
            >
              File
            </button>
          </>
        )}
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="想和 Mochi 说点什么…"
          rows={1}
          style={styles.input}
        />
        <button onClick={() => void sendMessage()} style={styles.sendBtn} disabled={isStreaming}>
          {isStreaming ? '思考中' : '发送'}
        </button>
      </div>
    </div>
  )
}

export default ChatPanel
