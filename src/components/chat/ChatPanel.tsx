import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChatClient } from '../../ai/ChatClient'
import { subscribeCompanionAction } from '../../ai/CompanionActionBridge'
import { buildCompanionChatContext } from '../../ai/CompanionContextAdapter'
import { buildChatReplyUtterance, buildFileAnalysisUtterance } from '../../ai/CompanionDesktopSummary'
import { emitCompanionUtterance } from '../../ai/CompanionUtteranceBridge'
import { resolveAIChatProvider, resolveFileAnalysisProvider } from '../../plugins/PluginCapabilityRegistry'
import { usePluginProviderStore } from '../../plugins/PluginProviderStore'
import { useContextStore } from '../../store/contextStore'
import { useSelectedPetCapabilityStore } from '../../store/selectedPetCapabilityStore'
import { useChatStore } from '../../store/chatStore'
import type { ChatMessage, ChatMessageAction, CompanionChatContext } from '../../types/chat'
import MessageBubble from './MessageBubble'

interface Props {
  onClose: () => void
}

const FILE_ACCEPT =
  '.txt,.md,.json,.xml,.yaml,.yml,.toml,.csv,.pdf,.docx,.js,.ts,.jsx,.tsx,.py,.rs,.go,.java,.cpp,.c,.cs,.sql'

const MAX_COMPANION_ACTION_HISTORY = 24

function buildPromptFromSections(...sections: string[]): string {
  return sections.join('\n')
}

function getFileAnalysisSummaryIntro(context: CompanionChatContext, fileName: string): string {
  switch (context.sceneId) {
    case 'deep_focus':
      return `我现在还在深度专注里，陪我用最稳的方式看《${fileName}》。`
    case 'steady_focus':
      return `我现在在工作状态里，陪我高效但别太生硬地看《${fileName}》。`
    case 'reading_nook':
      return `我们像并排读东西一样，一起看看《${fileName}》。`
    case 'watch_together':
      return `我们像一起看内容一样，顺着《${fileName}》继续聊。`
    case 'social_corner':
      return `我现在偏向聊天陪伴的状态，陪我把《${fileName}》理成自然一点的说法。`
    case 'play_session':
      return `我现在不想被太打断，请很轻地帮我扫一眼《${fileName}》。`
    case 'late_night_wind_down':
      return `已经有点晚了，陪我轻一点地看《${fileName}》，别把气氛拉得太紧。`
    case 'quiet_idle':
    case 'ambient_presence':
      return `我们就安静一点，一起看看《${fileName}》。`
    case 'soft_browsing':
      return `我现在是在轻度浏览，陪我自然一点地看看《${fileName}》。`
    default:
      return `请陪我一起看看这个文件《${fileName}》。`
  }
}

function buildAnalysisPromptForScene(
  fileName: string,
  summary: string,
  context: CompanionChatContext,
): string {
  const sceneInstruction =
    context.sceneId === 'deep_focus' || context.sceneId === 'steady_focus'
      ? '先用克制、清楚、低打扰的语气帮我讲重点，不要像生硬的工具汇报。'
      : context.sceneId === 'late_night_wind_down'
        ? '先用更安静、更柔和的陪伴语气帮我讲重点，不要太亮也不要太硬。'
        : context.sceneId === 'watch_together'
          ? '先像一起看内容一样帮我讲重点，可以有一点轻微反应，但别变成正式报告。'
          : '先用陪伴式的语气帮我讲重点，不要像生硬的工具汇报。'

  return buildPromptFromSections(
    getFileAnalysisSummaryIntro(context, fileName),
    '',
    sceneInstruction,
    '',
    '已提取摘要：',
    summary,
    '',
    '如果你觉得有必要，也可以提醒我下一步最值得继续看的部分。',
  )
}

function buildFollowUpActionsForScene(
  fileName: string,
  summary: string,
  context: CompanionChatContext,
  buildAnalysisPrompt: (fileName: string, summary: string, context: CompanionChatContext) => string,
): ChatMessageAction[] {
  const baseFillAction: ChatMessageAction = {
    id: 'fill-input',
    label: '先放到输入框',
    prompt: buildAnalysisPrompt(fileName, summary, context),
    fillOnly: true,
  }

  switch (context.sceneId) {
    case 'deep_focus':
    case 'steady_focus':
      return [
        {
          id: 'extract-actionable',
          label: '只讲要点',
          prompt: buildPromptFromSections(
            `我现在还在专注状态里，我们继续看《${fileName}》。`,
            '',
            '请用很克制的方式，只告诉我最关键的结论、风险或可执行信息，尽量少打断我的专注。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'connect-to-work',
          label: '结合当前工作',
          prompt: buildPromptFromSections(
            `请结合我当前这段专注状态，陪我继续看《${fileName}》。`,
            '',
            '帮我判断这份内容和我手头事情最可能相关的地方，并告诉我先看哪一段最省时间。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'turn-into-checklist',
          label: '整理执行顺序',
          prompt: buildPromptFromSections(
            `请继续陪我处理《${fileName}》。`,
            '',
            '把我接下来可以做的动作整理成一个轻量顺序，语气温和一点，但别太啰嗦。',
            '',
            '摘要：',
            summary,
          ),
        },
        baseFillAction,
      ]
    case 'watch_together':
      return [
        {
          id: 'co-watch',
          label: '一起聊亮点',
          prompt: buildPromptFromSections(
            `我们像一起看内容一样继续聊《${fileName}》。`,
            '',
            '请用轻一点、像在一起讨论的语气，告诉我这里面最有意思或最值得注意的地方。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'spot-controversy',
          label: '看看哪里最有料',
          prompt: buildPromptFromSections(
            `请继续陪我看《${fileName}》。`,
            '',
            '帮我找出最值得吐槽、讨论或者进一步确认的部分，但不要太吵。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'gentle-recap',
          label: '温柔复述',
          prompt: buildPromptFromSections(
            `请你陪我把《${fileName}》顺一遍。`,
            '',
            '用更自然一点、像坐在旁边轻声解释的方式，帮我复述重点。',
            '',
            '摘要：',
            summary,
          ),
        },
        baseFillAction,
      ]
    case 'social_corner':
      return [
        {
          id: 'social-summary',
          label: '帮我讲给别人听',
          prompt: buildPromptFromSections(
            `请陪我一起看《${fileName}》。`,
            '',
            '把它整理成适合讲给别人听的版本，要自然、暖一点，不要像机器总结。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'soft-highlight',
          label: '先挑最值得说的',
          prompt: buildPromptFromSections(
            `请继续陪我看《${fileName}》。`,
            '',
            '帮我挑出最值得马上提起的重点，像你在旁边轻轻提醒我一样。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'prepare-response',
          label: '整理一句回应',
          prompt: buildPromptFromSections(
            `我现在可能会把《${fileName}》里的内容继续聊下去。`,
            '',
            '请根据摘要帮我整理一个自然一点的回应或说法，不要太正式。',
            '',
            '摘要：',
            summary,
          ),
        },
        baseFillAction,
      ]
    case 'play_session':
      return [
        {
          id: 'quickest-need',
          label: '只说最重要的',
          prompt: buildPromptFromSections(
            `我现在不太想被打断，请非常简短地帮我看《${fileName}》。`,
            '',
            '只告诉我最关键的一件事，或者值不值得我稍后再回来细看。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'save-for-later',
          label: '留个稍后回看点',
          prompt: buildPromptFromSections(
            `我现在先玩着，请帮我给《${fileName}》留一个稍后继续看的切入口。`,
            '',
            '告诉我晚点回来时最该从哪里接着看，尽量短。',
            '',
            '摘要：',
            summary,
          ),
        },
        baseFillAction,
      ]
    case 'late_night_wind_down':
      return [
        {
          id: 'soft-wrap',
          label: '温柔讲重点',
          prompt: buildPromptFromSections(
            `已经有点晚了，我们轻一点继续看《${fileName}》。`,
            '',
            '请用更安静、更柔和的语气告诉我最重要的内容，让我不用一下子紧起来。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'save-for-tomorrow',
          label: '留到明天继续',
          prompt: buildPromptFromSections(
            `请陪我给《${fileName}》做一个能安心停下来的收尾。`,
            '',
            '帮我只保留明天最值得继续看的部分，用很轻的方式整理出来。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'night-reassure',
          label: '轻一点提醒我',
          prompt: buildPromptFromSections(
            `我现在在深夜收尾。`,
            '',
            `请结合《${fileName}》的摘要，温柔一点帮我判断今晚还值不值得继续细看，还是更适合先放下。`,
            '',
            '摘要：',
            summary,
          ),
        },
        baseFillAction,
      ]
    case 'reading_nook':
    case 'quiet_idle':
    case 'ambient_presence':
    case 'soft_browsing':
      return [
        {
          id: 'explain-gently',
          label: '先讲重点',
          prompt: buildPromptFromSections(
            `我们继续看《${fileName}》。`,
            '',
            '请你像陪我一起读一样，用温和一点的语气告诉我最重要的三件事。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'find-worth-reading',
          label: '标出必看部分',
          prompt: buildPromptFromSections(
            `请继续陪我看《${fileName}》。`,
            '',
            '帮我从这个摘要里挑出最值得继续细看的部分，并告诉我为什么。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'turn-into-plan',
          label: '整理下一步',
          prompt: buildPromptFromSections(
            `我们拿《${fileName}》继续往下走。`,
            '',
            '请把我接下来可以做的事情整理成一个很轻的阅读或处理顺序，不要太工具化。',
            '',
            '摘要：',
            summary,
          ),
        },
        baseFillAction,
      ]
    default:
      return [
        {
          id: 'explain-gently',
          label: '先讲重点',
          prompt: buildPromptFromSections(
            `我们继续看《${fileName}》。`,
            '',
            '请你像陪我一起读一样，用温和一点的语气告诉我最重要的三件事。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'find-worth-reading',
          label: '标出必看部分',
          prompt: buildPromptFromSections(
            `请继续陪我看《${fileName}》。`,
            '',
            '帮我从这个摘要里挑出最值得继续细看的部分，并告诉我为什么。',
            '',
            '摘要：',
            summary,
          ),
        },
        {
          id: 'turn-into-plan',
          label: '整理下一步',
          prompt: buildPromptFromSections(
            `我们拿《${fileName}》继续往下走。`,
            '',
            '请把我接下来可以做的事情整理成一个很轻的阅读或处理顺序，不要太工具化。',
            '',
            '摘要：',
            summary,
          ),
        },
        baseFillAction,
      ]
  }
}

const ChatPanel: React.FC<Props> = ({ onClose }) => {
  const {
    messages,
    config,
    addMessage,
    appendToLastMessage,
    setStreaming,
    isStreaming,
  } = useChatStore()
  const activity = useContextStore((state) => state.activity)
  const windowTitle = useContextStore((state) => state.activeWindow.title)
  const windowProcess = useContextStore((state) => state.activeWindow.process)
  const canAnalyzeFiles = useSelectedPetCapabilityStore((state) => state.fileAnalysis)
  const aiChatProviderId = usePluginProviderStore((state) => state.aiChatProviderId)
  const fileAnalysisProviderId = usePluginProviderStore((state) => state.fileAnalysisProviderId)

  const [input, setInput] = useState('')
  const [visible, setVisible] = useState(false)
  const [isFileDragActive, setIsFileDragActive] = useState(false)
  const [dragDepth, setDragDepth] = useState(0)
  const [client] = useState(() => new ChatClient(config, aiChatProviderId))

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recentCompanionActionIdsRef = useRef<string[]>([])

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
    return subscribeCompanionAction((payload) => {
      if (recentCompanionActionIdsRef.current.includes(payload.id)) {
        return
      }

      recentCompanionActionIdsRef.current = [
        payload.id,
        ...recentCompanionActionIdsRef.current,
      ].slice(0, MAX_COMPANION_ACTION_HISTORY)

      addMessage({
        id: `companion-action-${payload.id}`,
        role: 'system',
        content: payload.message,
        timestamp: Date.now(),
        actions: payload.actions,
      })
    })
  }, [addMessage])

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

      const context = buildCompanionChatContext(activity, windowTitle, windowProcess)
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
          appendToLastMessage(`[Error: ${err.message}]`)
          setStreaming(false)
        },
      )
    },
    [
      activity,
      addMessage,
      appendToLastMessage,
      client,
      isStreaming,
      setStreaming,
      windowProcess,
      windowTitle,
    ],
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

  const buildAnalysisPrompt = useCallback((
    fileName: string,
    summary: string,
    context: CompanionChatContext,
  ) => {
    return buildAnalysisPromptForScene(fileName, summary, context)
  }, [])

  const buildFollowUpActions = useCallback(
    (
      fileName: string,
      summary: string,
      context: CompanionChatContext,
    ): ChatMessageAction[] => {
      return buildFollowUpActionsForScene(fileName, summary, context, buildAnalysisPrompt)
    },
    [buildAnalysisPrompt],
  )

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

      const aiChatProvider = resolveAIChatProvider(aiChatProviderId)
      const fileAnalysisProvider = resolveFileAnalysisProvider(fileAnalysisProviderId)
      const context = buildCompanionChatContext(activity, windowTitle, windowProcess)

      addMessage({
        id: `file-${Date.now()}`,
        role: 'system',
        content: `正在整理文件《${file.name}》……`,
        timestamp: Date.now(),
      })

      try {
        const content = await fileAnalysisProvider.readFile(file)
        const localSummary = await fileAnalysisProvider.summarize({
          fileName: file.name,
          content,
        })
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
              content: `云端总结暂时不可用，先给你本地摘要。${error.message}`,
              timestamp: Date.now(),
            })
          }
        }

        addMessage({
          id: `file-summary-${Date.now()}`,
          role: 'system',
          content: `我先帮你把《${file.name}》理了一遍。你可以直接点下面的方式，我们一起继续往下看。\n\n${summary}`,
          timestamp: Date.now(),
          actions: buildFollowUpActions(file.name, summary, context),
        })

        emitCompanionUtterance({
          source: 'file-analysis',
          message: buildFileAnalysisUtterance(file.name, summary, context.sceneId),
          duration: 3200,
        })

        setInput(buildAnalysisPrompt(file.name, summary, context))
      } catch (error: any) {
        addMessage({
          id: `file-error-${Date.now()}`,
          role: 'system',
          content: `文件分析失败：${error.message}`,
          timestamp: Date.now(),
        })
      }
    },
    [
      addMessage,
      aiChatProviderId,
      buildAnalysisPrompt,
      buildFollowUpActions,
      canAnalyzeFiles,
      config,
      fileAnalysisProviderId,
      isStreaming,
      activity,
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
          <strong>把文件拖到这里</strong>
          <div style={styles.dropHint}>
            支持 PDF、DOCX、TXT、Markdown 和常见代码文件。Mochi 会先整理摘要，再陪你一起往下看。
          </div>
        </div>
      )}
      <div style={styles.header}>
        <span>Mochi</span>
        <button onClick={onClose} style={styles.closeBtn}>
          x
        </button>
      </div>
      <div style={styles.msgs}>
        {messages.length === 0 && <div style={styles.empty}>Mochi 在等你开口，也可以直接拖一个文件进来。</div>}
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
          可以点 <strong>File</strong>，也可以把文件直接拖进这个面板。
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
              File
            </button>
          </>
        )}
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="想和 Mochi 说点什么？"
          rows={1}
          style={styles.input}
        />
        <button onClick={() => void sendMessage()} style={styles.sendBtn} disabled={isStreaming}>
          {isStreaming ? '思考中' : '发送'}
        </button>
        {isStreaming && (
          <button type="button" onClick={stopStreaming} style={styles.utilityBtn}>
            Stop
          </button>
        )}
      </div>
    </div>
  )
}

export default ChatPanel
