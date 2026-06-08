import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChatClient } from '../../ai/ChatClient'
import { subscribeCompanionAction } from '../../ai/CompanionActionBridge'
import { buildCompanionChatContext } from '../../ai/CompanionContextAdapter'
import { buildChatReplyUtterance } from '../../ai/CompanionDesktopSummary'
import { emitCompanionFeedAnalysis, readCompanionFeedAnalyses, subscribeCompanionFeedAnalysis } from '../../ai/CompanionFeedBridge'
import { emitCompanionUtterance } from '../../ai/CompanionUtteranceBridge'
import { usePluginProviderStore } from '../../plugins/PluginProviderStore'
import { resolveSelectedPetPackage } from '../../pets/resolveSelectedPetPackage'
import { subscribeSelectedPet } from '../../pets/PetSelectionStore'
import { analyzeFileForCompanionFeed, buildFeedAnalysisPromptForScene } from '../../services/companionFeedAnalysis'
import { useChatStore } from '../../store/chatStore'
import { useContextStore } from '../../store/contextStore'
import { useSelectedPetCapabilityStore } from '../../store/selectedPetCapabilityStore'
import type { ChatMessage, CompanionChatContext } from '../../types/chat'
import MessageBubble from './MessageBubble'

interface Props {
  onClose: () => void
}

const FILE_ACCEPT =
  '.txt,.md,.json,.xml,.yaml,.yml,.toml,.csv,.pdf,.docx,.js,.ts,.jsx,.tsx,.py,.rs,.go,.java,.cpp,.c,.cs,.sql'

const MAX_COMPANION_ACTION_HISTORY = 24
const MAX_FEED_ANALYSIS_HISTORY = 24

function buildFeedMessageContent(fileName: string, briefSummary: string, detailedAnalysis: string) {
  return [
    `我先帮你把《${fileName}》顺了一遍。`,
    '',
    `先给你桌面上那种几句话的小结：${briefSummary}`,
    '',
    '如果你想继续往下看，我把更完整的整理也放在这里了：',
    detailedAnalysis,
  ].join('\n')
}

const ChatPanel: React.FC<Props> = ({ onClose }) => {
  const { messages, config, addMessage, appendToLastMessage, setStreaming, isStreaming } = useChatStore()
  const activity = useContextStore((state) => state.activity)
  const windowTitle = useContextStore((state) => state.activeWindow.title)
  const windowProcess = useContextStore((state) => state.activeWindow.process)
  const screenPerception = useContextStore((state) => state.screenPerception)
  const canAnalyzeFiles = useSelectedPetCapabilityStore((state) => state.fileAnalysis)
  const aiChatProviderId = usePluginProviderStore((state) => state.aiChatProviderId)

  const [input, setInput] = useState('')
  const [visible, setVisible] = useState(false)
  const [isFileDragActive, setIsFileDragActive] = useState(false)
  const [dragDepth, setDragDepth] = useState(0)
  const [client] = useState(() => new ChatClient(config, aiChatProviderId))
  const [petName, setPetName] = useState(() => resolveSelectedPetPackage().manifest.name || 'bb7')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recentCompanionActionIdsRef = useRef<string[]>([])
  const recentFeedAnalysisIdsRef = useRef<string[]>([])

  useEffect(() => {
    client.updateConfig(config)
  }, [config, client])

  useEffect(() => {
    client.updateProvider(aiChatProviderId)
  }, [aiChatProviderId, client])

  useEffect(() => {
    client.syncTranscript(messages)
  }, [messages, client])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setVisible(true)
  }, [])

  useEffect(() => {
    return subscribeSelectedPet(() => {
      setPetName(resolveSelectedPetPackage().manifest.name || 'bb7')
    })
  }, [])

  useEffect(() => {
    return subscribeCompanionAction((payload) => {
      if (recentCompanionActionIdsRef.current.includes(payload.id)) {
        return
      }

      recentCompanionActionIdsRef.current = [payload.id, ...recentCompanionActionIdsRef.current].slice(
        0,
        MAX_COMPANION_ACTION_HISTORY,
      )

      addMessage({
        id: `companion-action-${payload.id}`,
        role: 'system',
        content: payload.message,
        timestamp: Date.now(),
        actions: payload.actions,
      })
    })
  }, [addMessage])

  useEffect(() => {
    for (const payload of readCompanionFeedAnalyses()) {
      if (recentFeedAnalysisIdsRef.current.includes(payload.id)) {
        continue
      }

      recentFeedAnalysisIdsRef.current = [payload.id, ...recentFeedAnalysisIdsRef.current].slice(
        0,
        MAX_FEED_ANALYSIS_HISTORY,
      )

      addMessage({
        id: `feed-analysis-history-${payload.id}`,
        role: 'system',
        content: buildFeedMessageContent(payload.fileName, payload.briefSummary, payload.detailedAnalysis),
        timestamp: payload.createdAt,
        actions: payload.actions,
      })
    }

    return subscribeCompanionFeedAnalysis((payload) => {
      if (recentFeedAnalysisIdsRef.current.includes(payload.id)) {
        return
      }

      recentFeedAnalysisIdsRef.current = [payload.id, ...recentFeedAnalysisIdsRef.current].slice(
        0,
        MAX_FEED_ANALYSIS_HISTORY,
      )

      addMessage({
        id: `feed-analysis-${payload.id}`,
        role: 'system',
        content: buildFeedMessageContent(payload.fileName, payload.briefSummary, payload.detailedAnalysis),
        timestamp: payload.createdAt,
        actions: payload.actions,
      })

      setInput(buildFeedAnalysisPromptForScene(payload.fileName, payload.detailedAnalysis, payload.context))
    })
  }, [addMessage])

  const buildContext = useCallback((): CompanionChatContext => {
    return buildCompanionChatContext(
      activity,
      windowTitle,
      windowProcess,
      screenPerception?.summary ?? null,
      screenPerception?.source ?? null,
    )
  }, [activity, screenPerception?.source, screenPerception?.summary, windowProcess, windowTitle])

  const isFileDragPayload = useCallback((dataTransfer?: DataTransfer | null) => {
    if (!dataTransfer) return false
    return Array.from(dataTransfer.types).includes('Files')
  }, [])

  const sendPrompt = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || isStreaming) return

      setInput('')
      addMessage({
        id: Date.now().toString(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      })
      setStreaming(true)

      const context = buildContext()
      addMessage({
        id: `resp-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      })

      await client.sendMessage(
        trimmed,
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
          appendToLastMessage(`刚才这句话我没能顺利接住。${err.message}`)
          setStreaming(false)
        },
      )
    },
    [addMessage, appendToLastMessage, buildContext, client, isStreaming, setStreaming],
  )

  const sendMessage = useCallback(async () => {
    await sendPrompt(input)
  }, [input, sendPrompt])

  const stopStreaming = useCallback(() => {
    client.cancel()
    setStreaming(false)
  }, [client, setStreaming])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage()
    }
  }

  const handleMessageActionSelect = useCallback(
    async (message: ChatMessage, actionId: string) => {
      const action = message.actions?.find((entry) => entry.id === actionId)
      if (!action) return

      if (action.fillOnly) {
        setInput(action.prompt)
        return
      }

      await sendPrompt(action.prompt)
    },
    [sendPrompt],
  )

  const analyzeFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file || !canAnalyzeFiles || isStreaming) return

      addMessage({
        id: `file-${Date.now()}`,
        role: 'system',
        content: `把《${file.name}》交给我吧，我先看一遍。`,
        timestamp: Date.now(),
      })

      try {
        const result = await analyzeFileForCompanionFeed(file, {
          activity,
          windowTitle,
          windowProcess,
          screenSummary: screenPerception?.summary ?? null,
          screenSource: screenPerception?.source ?? null,
        })

        emitCompanionFeedAnalysis({
          id: `chat-feed-${Date.now()}`,
          fileName: result.fileName,
          briefSummary: result.briefSummary,
          detailedAnalysis: result.detailedAnalysis,
          context: result.context,
          actions: result.actions,
          desktopUtterance: result.desktopUtterance,
          createdAt: Date.now(),
        })

        emitCompanionUtterance({
          source: 'file-analysis',
          message: result.desktopUtterance,
          duration: 3200,
        })
      } catch (error: any) {
        addMessage({
          id: `file-error-${Date.now()}`,
          role: 'system',
          content: `这次没能顺利看完《${file.name}》。${error?.message ?? String(error)}`,
          timestamp: Date.now(),
        })
      }
    },
    [
      activity,
      addMessage,
      canAnalyzeFiles,
      client,
      isStreaming,
      screenPerception?.source,
      screenPerception?.summary,
      windowProcess,
      windowTitle,
    ],
  )

  const analyzeFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      await analyzeFile(files[0])
    },
    [analyzeFile],
  )

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAnalyzeFiles || isStreaming || !isFileDragPayload(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      setDragDepth((value) => value + 1)
      setIsFileDragActive(true)
    },
    [canAnalyzeFiles, isFileDragPayload, isStreaming],
  )

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAnalyzeFiles || isStreaming || !isFileDragPayload(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'copy'
      if (!isFileDragActive) {
        setIsFileDragActive(true)
      }
    },
    [canAnalyzeFiles, isFileDragActive, isFileDragPayload, isStreaming],
  )

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isFileDragPayload(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      setDragDepth((value) => {
        const nextValue = Math.max(0, value - 1)
        if (nextValue === 0) {
          setIsFileDragActive(false)
        }
        return nextValue
      })
    },
    [isFileDragPayload],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!canAnalyzeFiles || isStreaming || !isFileDragPayload(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      setDragDepth(0)
      setIsFileDragActive(false)
      void analyzeFiles(event.dataTransfer.files)
    },
    [analyzeFiles, canAnalyzeFiles, isFileDragPayload, isStreaming],
  )

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
      outline: isFileDragActive ? '2px solid rgba(132, 196, 255, 0.78)' : 'none',
      outlineOffset: isFileDragActive ? '-2px' : 0,
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
    titleWrap: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minWidth: 0,
    },
    titleHint: {
      fontSize: '11px',
      color: 'rgba(104, 132, 157, 0.7)',
      fontWeight: 500,
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
      lineHeight: 1.6,
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
    dropOverlay: {
      position: 'absolute',
      inset: '10px',
      borderRadius: '14px',
      border: '1.5px dashed rgba(123, 189, 240, 0.85)',
      background: 'linear-gradient(180deg, rgba(244, 251, 255, 0.92), rgba(255, 246, 250, 0.9))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '8px',
      color: '#54738d',
      fontSize: '13px',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: 2,
      boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.6)',
      padding: '18px',
    },
    dropHint: {
      fontSize: '11px',
      color: 'rgba(84, 115, 141, 0.72)',
      maxWidth: '220px',
      lineHeight: 1.5,
    },
    capabilityHint: {
      padding: '0 14px 10px',
      fontSize: '11px',
      lineHeight: 1.4,
      color: 'rgba(92, 118, 143, 0.78)',
    },
  }

  return (
    <div
      style={styles.panel}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isFileDragActive && dragDepth > 0 && (
        <div style={styles.dropOverlay}>
          <strong>把文件交给我</strong>
          <div style={styles.dropHint}>
            支持 PDF、DOCX、TXT、Markdown 和常见代码文件。{petName}
            会先帮你顺一遍，再陪你继续往下看。
          </div>
        </div>
      )}
      <div style={styles.header}>
        <div style={styles.titleWrap}>
          <span>{petName}</span>
          <span style={styles.titleHint}>在这里陪你待一会儿</span>
        </div>
        <button onClick={onClose} style={styles.closeBtn}>
          ×
        </button>
      </div>
      <div style={styles.msgs}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            我在这儿，慢慢说也可以。
            <br />
            想聊天就和我说一句，想投喂文件也可以直接拖进来。
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onActionSelect={(targetMessage, actionId) => {
              void handleMessageActionSelect(targetMessage, actionId)
            }}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      {canAnalyzeFiles && (
        <div style={styles.capabilityHint}>
          可以点 <strong>投喂</strong>，也可以把文件直接拖进这个面板。
        </div>
      )}
      <div style={styles.inputRow}>
        {canAnalyzeFiles && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept={FILE_ACCEPT}
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
              投喂
            </button>
          </>
        )}
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`想和 ${petName} 说点什么？`}
          rows={1}
          style={styles.input}
        />
        <button onClick={() => void sendMessage()} style={styles.sendBtn} disabled={isStreaming}>
          {isStreaming ? '回应中' : '发给它'}
        </button>
        {isStreaming && (
          <button type="button" onClick={stopStreaming} style={styles.utilityBtn}>
            先停一下
          </button>
        )}
      </div>
    </div>
  )
}

export default ChatPanel
