import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChatClient } from '../../ai/ChatClient'
import { subscribeCompanionAction } from '../../ai/CompanionActionBridge'
import { buildCompanionChatContext } from '../../ai/CompanionContextAdapter'
import { buildChatReplyUtterance } from '../../ai/CompanionDesktopSummary'
import {
  emitCompanionFeedAnalysisResult,
  readCompanionFeedAnalyses,
  readCompanionFeedAnalysesFromBridge,
  subscribeCompanionFeedAnalysis,
} from '../../ai/CompanionFeedBridge'
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

const ACTIVITY_LABELS: Record<string, string> = {
  CODING: '在写东西',
  GAMING: '在玩游戏',
  WATCHING: '在看内容',
  CHATTING: '在聊天',
  BROWSING: '在浏览',
  READING: '在阅读',
  IDLE: '暂时安静下来',
  OTHER: '在桌面上待着',
}

function buildFeedMessageId(payloadId: string) {
  return `feed-analysis-${payloadId}`
}

function buildFeedMessageContent(fileName: string, briefSummary: string, detailedAnalysis: string) {
  return [
    `《${fileName}》我已经替你看过一遍了。`,
    '',
    `先留一份更完整的整理给你：${briefSummary}`,
    '',
    '如果你现在想继续往下看，可以直接顺着这份内容接着聊：',
    detailedAnalysis,
  ].join('\n')
}

function emitAutomationMetricEvent(
  name: string,
  options?: {
    value?: number
    tags?: Record<string, string | number | boolean | null>
  },
) {
  window.electronAPI?.emitAutomationMetricsEvent?.({
    name,
    value: options?.value,
    tags: options?.tags,
  })
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
  const smokeFeedCheckpointRef = useRef<string | null>(null)
  const activityLabel = ACTIVITY_LABELS[activity] ?? '在桌面上待着'
  const screenSummaryLabel = screenPerception?.summary?.trim() || null
  const activeWindowLabel = windowTitle?.trim() || windowProcess?.trim() || '当前桌面'
  const conversationStatusLabel = isStreaming ? `${petName} 正在回应你` : `${petName} 在这里陪你`
  const ambientSummary = screenSummaryLabel
    ? `你们现在一起看着：${screenSummaryLabel}`
    : `${petName} 留意到你现在${activityLabel}。`

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
    let cancelled = false
    let unsubscribe: () => void = () => undefined

    const handleFeedPayload = (
      payload: ReturnType<typeof readCompanionFeedAnalyses>[number],
      options?: { primeInput?: boolean; smokeRunId?: string | null; automationRunId?: string | null },
    ) => {
      if (options?.automationRunId) {
        const matchesAutomationRun =
          payload.id.startsWith(`stability-feed-${options.automationRunId}`) ||
          payload.id.startsWith(`chat-feed-${options.automationRunId}`)
        if (!matchesAutomationRun) {
          return
        }
      }

      if (recentFeedAnalysisIdsRef.current.includes(payload.id)) {
        return
      }

      recentFeedAnalysisIdsRef.current = [payload.id, ...recentFeedAnalysisIdsRef.current].slice(
        0,
        MAX_FEED_ANALYSIS_HISTORY,
      )

      addMessage({
        id: buildFeedMessageId(payload.id),
        role: 'system',
        content: buildFeedMessageContent(payload.fileName, payload.briefSummary, payload.detailedAnalysis),
        timestamp: payload.createdAt,
        actions: payload.actions,
      })
      emitAutomationMetricEvent('chat.feed.received', {
        tags: {
          fileName: payload.fileName,
          scene: payload.context.sceneId,
          source: payload.id.startsWith('chat-feed-')
            ? 'chat'
            : payload.id.startsWith('smoke-feed-')
              ? 'smoke'
              : 'desktop',
        },
      })

      if (options?.primeInput) {
        setInput(buildFeedAnalysisPromptForScene(payload.fileName, payload.detailedAnalysis, payload.context))
      }

      if (
        options?.smokeRunId &&
        payload.id.startsWith(`smoke-feed-${options.smokeRunId}`) &&
        smokeFeedCheckpointRef.current !== payload.id
      ) {
        smokeFeedCheckpointRef.current = payload.id
        window.electronAPI?.emitSmokeCheckpoint?.('feed-chat-received')
      }
    }

    void (async () => {
      const runtimeFlags = await window.electronAPI?.getRuntimeFlags?.()
      if (cancelled) {
        return
      }

      const smokeRunId = runtimeFlags?.smokeTarget === 'feed' ? runtimeFlags.smokeRunId : null
      const automationRunId = runtimeFlags?.scenario === 'stability-feed' ? runtimeFlags.automationRunId : null
      const isAutomationScenario = Boolean(runtimeFlags?.scenario)

      if (isAutomationScenario && runtimeFlags?.scenario !== 'stability-feed') {
        return
      }

      const hydratedPayloads = [
        ...readCompanionFeedAnalyses(),
        ...(await readCompanionFeedAnalysesFromBridge()),
      ].sort((left, right) => left.createdAt - right.createdAt)

      for (const payload of hydratedPayloads) {
        handleFeedPayload(payload, { smokeRunId, automationRunId })
      }

      unsubscribe = subscribeCompanionFeedAnalysis((payload) => {
        handleFeedPayload(payload, {
          primeInput: true,
          smokeRunId,
          automationRunId,
        })
      })
    })()

    return () => {
      cancelled = true
      unsubscribe()
    }
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

        emitCompanionFeedAnalysisResult(result, {
          idPrefix: 'chat-feed',
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
      bottom: '170px',
      right: '18px',
      width: 'min(392px, calc(100vw - 24px))',
      height: 'min(620px, calc(100vh - 210px))',
      background:
        'linear-gradient(180deg, rgba(255, 252, 247, 0.96), rgba(243, 249, 255, 0.92)), radial-gradient(circle at top right, rgba(246,195,212,0.18), transparent 34%)',
      backdropFilter: 'blur(22px)',
      WebkitBackdropFilter: 'blur(22px)',
      border: '1px solid rgba(138, 191, 230, 0.28)',
      borderRadius: '26px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10000,
      overflow: 'hidden',
      boxShadow: '0 24px 72px rgba(74, 102, 128, 0.22), 0 8px 28px rgba(255, 214, 230, 0.16)',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
      outline: isFileDragActive ? '2px solid rgba(132, 196, 255, 0.78)' : 'none',
      outlineOffset: isFileDragActive ? '-2px' : 0,
    },
    header: {
      padding: '16px 18px 12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px',
      color: '#4c6983',
      borderBottom: '1px solid rgba(138, 191, 230, 0.12)',
      background:
        'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(247,252,255,0.58)), radial-gradient(circle at top right, rgba(182,217,243,0.16), transparent 32%)',
    },
    titleWrap: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      minWidth: 0,
    },
    titleMain: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap',
    },
    titleHint: {
      fontSize: '11px',
      color: 'rgba(104, 132, 157, 0.74)',
      fontWeight: 600,
      letterSpacing: '0.16px',
    },
    closeBtn: {
      width: '34px',
      height: '34px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.74)',
      border: '1px solid rgba(138, 191, 230, 0.18)',
      color: '#7c99b3',
      cursor: 'pointer',
      fontSize: '18px',
      lineHeight: 1,
      padding: 0,
      flex: '0 0 auto',
    },
    statusStrip: {
      display: 'grid',
      gap: '10px',
      padding: '12px 16px 10px',
      borderBottom: '1px solid rgba(138, 191, 230, 0.1)',
      background: 'rgba(255,255,255,0.36)',
    },
    summaryCard: {
      padding: '12px 13px',
      borderRadius: '18px',
      background: 'rgba(255,255,255,0.74)',
      border: '1px solid rgba(138, 191, 230, 0.12)',
      boxShadow: '0 10px 24px rgba(120, 153, 181, 0.06)',
    },
    chipRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
    },
    chip: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 9px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.72)',
      border: '1px solid rgba(138, 191, 230, 0.14)',
      color: '#60809b',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.12px',
    },
    msgs: {
      flex: 1,
      padding: '12px 16px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      background:
        'linear-gradient(180deg, rgba(250,252,255,0.28), rgba(255,255,255,0.16)), radial-gradient(circle at bottom left, rgba(171,209,237,0.08), transparent 24%)',
    },
    empty: {
      color: 'rgba(92, 118, 143, 0.72)',
      fontSize: '12px',
      lineHeight: 1.7,
      padding: '14px 0 0',
    },
    emptyCard: {
      padding: '14px',
      borderRadius: '18px',
      background: 'rgba(255,255,255,0.68)',
      border: '1px solid rgba(138, 191, 230, 0.12)',
      boxShadow: '0 10px 24px rgba(120, 153, 181, 0.06)',
    },
    inputRow: {
      padding: '12px 14px 14px',
      display: 'grid',
      gap: '10px',
      borderTop: '1px solid rgba(138, 191, 230, 0.12)',
      background:
        'linear-gradient(180deg, rgba(250,252,255,0.84), rgba(255,255,255,0.94)), radial-gradient(circle at top right, rgba(246,195,212,0.12), transparent 28%)',
    },
    inputCard: {
      padding: '12px',
      borderRadius: '18px',
      border: '1px solid rgba(138, 191, 230, 0.16)',
      background: 'rgba(255,255,255,0.74)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.46)',
    },
    inputToolbar: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px',
      flexWrap: 'wrap',
    },
    inputActionsRow: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      width: '100%',
      minHeight: '72px',
      padding: '4px 0 0',
      borderRadius: '0',
      border: 'none',
      background: 'transparent',
      color: '#49657f',
      fontSize: '13px',
      outline: 'none',
      resize: 'none',
      fontFamily: 'inherit',
      lineHeight: 1.66,
    },
    sendBtn: {
      minWidth: '88px',
      padding: '10px 16px',
      borderRadius: '14px',
      border: 'none',
      background: isStreaming ? 'rgba(189, 213, 231, 0.72)' : 'linear-gradient(135deg, #8ec5ec, #f6c3d4)',
      color: isStreaming ? 'rgba(73, 101, 127, 0.72)' : '#ffffff',
      fontSize: '13px',
      fontWeight: 700,
      cursor: isStreaming ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.2s, transform 0.2s',
      boxShadow: isStreaming ? 'none' : '0 12px 24px rgba(125, 184, 232, 0.18)',
    },
    utilityBtn: {
      minWidth: '56px',
      padding: '9px 12px',
      borderRadius: '12px',
      border: '1px solid rgba(138, 191, 230, 0.22)',
      background: 'rgba(255, 255, 255, 0.76)',
      color: '#56728b',
      fontSize: '12px',
      fontWeight: 600,
      cursor: 'pointer',
    },
    dropOverlay: {
      position: 'absolute',
      inset: '12px',
      borderRadius: '20px',
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
      maxWidth: '260px',
      lineHeight: 1.6,
    },
    capabilityHint: {
      fontSize: '11px',
      lineHeight: 1.5,
      color: 'rgba(92, 118, 143, 0.78)',
    },
    inputHintRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      flexWrap: 'wrap',
    },
    capabilityBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 8px',
      borderRadius: '999px',
      background: 'rgba(142, 197, 236, 0.12)',
      color: '#64819a',
      fontSize: '11px',
      fontWeight: 600,
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
          <div style={styles.titleMain}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#48627c' }}>{petName}</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 9px',
                borderRadius: '999px',
                background: isStreaming ? 'rgba(255, 245, 234, 0.82)' : 'rgba(236, 247, 255, 0.82)',
                border: isStreaming ? '1px solid rgba(240, 194, 150, 0.22)' : '1px solid rgba(125, 184, 232, 0.2)',
                color: isStreaming ? '#a07a56' : '#5f7e98',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.12px',
              }}
            >
              {isStreaming ? '正在回应' : '陪伴中'}
            </span>
          </div>
          <span style={styles.titleHint}>{conversationStatusLabel}</span>
        </div>
        <button onClick={onClose} style={styles.closeBtn}>
          ×
        </button>
      </div>
      <div style={styles.statusStrip}>
        <div style={styles.summaryCard}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)', marginBottom: '6px' }}>
            Shared Moment
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880', marginBottom: '5px' }}>{activeWindowLabel}</div>
          <div style={{ fontSize: '12px', lineHeight: 1.64, color: 'rgba(92, 118, 143, 0.82)' }}>{ambientSummary}</div>
        </div>
        <div style={styles.chipRow}>
          <span style={styles.chip}>当前状态 · {activityLabel}</span>
          <span style={styles.chip}>{config.enabled ? 'AI 对话已打开' : '现在更偏安静陪伴'}</span>
          <span style={styles.chip}>{canAnalyzeFiles ? '支持文件投喂' : '文件分析未接入'}</span>
        </div>
      </div>
      <div style={styles.msgs}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            <div style={styles.emptyCard}>
              我在这儿，慢慢说也可以。
              <br />
              想聊天就和我说一句，想投喂文件也可以直接拖进来。
            </div>
          </div>
        )}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            assistantName={petName}
            onActionSelect={(targetMessage, actionId) => {
              void handleMessageActionSelect(targetMessage, actionId)
            }}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div style={styles.inputRow}>
        <div style={styles.inputCard}>
          <div style={styles.inputToolbar}>
            <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)' }}>和 {petName} 说一句现在的想法</div>
            <div style={styles.inputActionsRow}>
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
              {isStreaming && (
                <button type="button" onClick={stopStreaming} style={styles.utilityBtn}>
                  先停一下
                </button>
              )}
            </div>
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`想和 ${petName} 说点什么？`}
            rows={3}
            style={styles.input}
          />
        </div>
        <div style={styles.inputHintRow}>
          <div style={styles.capabilityHint}>
            按 `Enter` 发送，`Shift + Enter` 换行。
            {canAnalyzeFiles ? ' 也可以把文件直接拖进来。' : ''}
          </div>
          {canAnalyzeFiles && <span style={styles.capabilityBadge}>支持文件投喂</span>}
        </div>
        <button onClick={() => void sendMessage()} style={styles.sendBtn} disabled={isStreaming}>
          {isStreaming ? '正在陪你整理' : `发给 ${petName}`}
        </button>
      </div>
    </div>
  )
}

export default ChatPanel
