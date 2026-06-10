import React, { useEffect, useRef, useState } from 'react'

import {
  listDiscoveredProviderCandidates,
  listPluginBackedProviderDescriptors,
  listProviderDescriptors,
  resolveAIChatProvider,
} from '../../plugins/PluginCapabilityRegistry'
import { usePluginProviderStore } from '../../plugins/PluginProviderStore'
import { describePluginCapabilities } from '../../plugins/runtime/capabilityMap'
import { useLocalPluginDiscoveryStore } from '../../plugins/runtime/LocalPluginDiscoveryStore'
import type { DiscoveredPluginProviderCandidate } from '../../plugins/runtime/types'
import { resolveSelectedPetCapabilities } from '../../pets/resolveSelectedPetCapabilities'
import {
  clearCompanionSettingsPreviewState,
  publishCompanionSettingsPreviewState,
} from '../../settings/CompanionSettingsPreviewStore'
import { useChatStore } from '../../store/chatStore'
import { useCompanionPreferencesStore } from '../../store/companionPreferencesStore'
import { usePetStore } from '../../store/petStore'
import { useSelectedPetStore } from '../../store/selectedPetStore'
import { useWorkModeStore } from '../../store/workModeStore'

type SettingsSectionId = 'character' | 'providers' | 'plugins' | 'conversation' | 'presence' | 'rhythm'

const AISettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { config, setConfig } = useChatStore()
  const availablePets = useSelectedPetStore((state) => state.availablePets)
  const selectedPetId = useSelectedPetStore((state) => state.selectedPetId)
  const selectPet = useSelectedPetStore((state) => state.selectPet)
  const refreshCatalog = useSelectedPetStore((state) => state.refreshCatalog)
  const setShowCustomPetLoader = usePetStore((state) => state.setShowCustomPetLoader)
  const workMode = useWorkModeStore((state) => state.config)
  const workSnapshot = useWorkModeStore((state) => state.snapshot)
  const setWorkModeConfig = useWorkModeStore((state) => state.setConfig)
  const startFocus = useWorkModeStore((state) => state.startFocus)
  const startBreak = useWorkModeStore((state) => state.startBreak)
  const pauseWorkMode = useWorkModeStore((state) => state.pause)
  const resetWorkMode = useWorkModeStore((state) => state.reset)
  const lowDistractionMode = useCompanionPreferencesStore((state) => state.lowDistractionMode)
  const setLowDistractionMode = useCompanionPreferencesStore((state) => state.setLowDistractionMode)
  const setConnected = useChatStore((state) => state.setConnected)

  const [endpoint, setEndpoint] = useState(config.endpoint)
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [model, setModel] = useState(config.model)
  const [enabled, setEnabled] = useState(config.enabled)
  const [petId, setPetId] = useState(selectedPetId)

  const [workEnabled, setWorkEnabled] = useState(workMode.enabled)
  const [focusMinutes, setFocusMinutes] = useState(workMode.focusMinutes)
  const [shortBreakMinutes, setShortBreakMinutes] = useState(workMode.shortBreakMinutes)
  const [longBreakMinutes, setLongBreakMinutes] = useState(workMode.longBreakMinutes)
  const [longBreakEvery, setLongBreakEvery] = useState(workMode.longBreakEvery)
  const [autoStartBreaks, setAutoStartBreaks] = useState(workMode.autoStartBreaks)
  const [autoStartFocus, setAutoStartFocus] = useState(workMode.autoStartFocus)
  const [overworkReminderMinutes, setOverworkReminderMinutes] = useState(workMode.overworkReminderMinutes)
  const [quietCompanionMode, setQuietCompanionMode] = useState(lowDistractionMode)
  const [pluginsExpanded, setPluginsExpanded] = useState(false)
  const [candidatesExpanded, setCandidatesExpanded] = useState(false)
  const [savePulseVisible, setSavePulseVisible] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [isCompactPanel, setIsCompactPanel] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 760 : false,
  )
  const [isTightPanel, setIsTightPanel] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 560 : false,
  )
  const [aiHealth, setAiHealth] = useState<{ loading: boolean; ok: boolean | null; message: string }>({
    loading: false,
    ok: null,
    message: '还没有检查当前聊天接入状态。',
  })
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('character')
  const savePulseTimerRef = useRef<number | null>(null)
  const aiHealthDebounceTimerRef = useRef<number | null>(null)
  const mainScrollRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Partial<Record<SettingsSectionId, HTMLElement | null>>>({})
  const previewSessionActiveRef = useRef(false)
  const previewExitReasonRef = useRef<'applied' | 'dismissed' | 'idle' | null>(null)

  const capabilitySummary = Object.entries(resolveSelectedPetCapabilities())
    .filter(([, enabledFlag]) => enabledFlag)
    .map(([name]) => formatCapabilityLabel(name))

  const aiChatProviderId = usePluginProviderStore((state) => state.aiChatProviderId)
  const fileAnalysisProviderId = usePluginProviderStore((state) => state.fileAnalysisProviderId)
  const screenPerceptionProviderId = usePluginProviderStore((state) => state.screenPerceptionProviderId)
  const setProvider = usePluginProviderStore((state) => state.setProvider)
  const [selectedAiProviderId, setSelectedAiProviderId] = useState(aiChatProviderId)
  const [selectedFileProviderId, setSelectedFileProviderId] = useState(fileAnalysisProviderId)
  const [selectedScreenProviderId, setSelectedScreenProviderId] = useState(screenPerceptionProviderId)

  const aiProviders = listProviderDescriptors('aiChat')
  const fileProviders = listProviderDescriptors('fileAnalysis')
  const screenProviders = listProviderDescriptors('screenPerception')
  const discoveredAiProviders = listDiscoveredProviderCandidates('aiChat')
  const discoveredFileProviders = listDiscoveredProviderCandidates('fileAnalysis')
  const discoveredScreenProviders = listDiscoveredProviderCandidates('screenPerception')
  const discoveredProviderCandidates: DiscoveredPluginProviderCandidate[] = [
    ...discoveredAiProviders,
    ...discoveredFileProviders,
    ...discoveredScreenProviders,
  ]
  const pluginBackedActiveProviders = listPluginBackedProviderDescriptors()
  const localPlugins = useLocalPluginDiscoveryStore((state) => state.plugins)
  const refreshLocalPlugins = useLocalPluginDiscoveryStore((state) => state.refresh)
  const selectedPetMeta = availablePets.find((pet) => pet.id === petId) ?? availablePets[0] ?? null
  const selectedAiProvider = aiProviders.find((provider) => provider.id === selectedAiProviderId) ?? null
  const selectedFileProvider = fileProviders.find((provider) => provider.id === selectedFileProviderId) ?? null
  const selectedScreenProvider = screenProviders.find((provider) => provider.id === selectedScreenProviderId) ?? null
  const aiHealthTone = resolveAiHealthTone(aiHealth)
  const workModeTone = resolveWorkModeTone(workEnabled, workSnapshot.phase)
  const hasPendingChanges =
    petId !== selectedPetId ||
    selectedAiProviderId !== aiChatProviderId ||
    selectedFileProviderId !== fileAnalysisProviderId ||
    selectedScreenProviderId !== screenPerceptionProviderId ||
    endpoint !== config.endpoint ||
    apiKey !== config.apiKey ||
    model !== config.model ||
    enabled !== config.enabled ||
    quietCompanionMode !== lowDistractionMode ||
    workEnabled !== workMode.enabled ||
    focusMinutes !== workMode.focusMinutes ||
    shortBreakMinutes !== workMode.shortBreakMinutes ||
    longBreakMinutes !== workMode.longBreakMinutes ||
    longBreakEvery !== workMode.longBreakEvery ||
    autoStartBreaks !== workMode.autoStartBreaks ||
    autoStartFocus !== workMode.autoStartFocus ||
    overworkReminderMinutes !== workMode.overworkReminderMinutes
  const saveFeedbackTone = resolveSaveFeedbackTone(hasPendingChanges, savePulseVisible)
  const aiStatusLabel = aiHealth.loading
    ? '正在检查'
    : aiHealth.ok === true
      ? '已连通'
      : aiHealth.ok === false
        ? '待处理'
        : '未检查'
  const aiStatusSummary = enabled
    ? aiHealth.ok === true
      ? 'bb7 现在可以接住聊天和后续追问。'
      : aiHealth.ok === false
        ? '聊天入口已经打开，但还需要把接入修好。'
        : '聊天入口已经打开，正在确认接入状态。'
    : '现在还是偏安静的陪伴模式，聊天能力没有打开。'
  const providerConnectedCount = [selectedAiProviderId, selectedFileProviderId, selectedScreenProviderId].filter(Boolean).length
  const workModeSummary = workEnabled
    ? `${renderPhaseLabel(workSnapshot.phase)} · ${focusMinutes}/${shortBreakMinutes} 分钟节奏`
    : '还没有启用专注和休息节奏。'
  const workModeCycleSummary = `${focusMinutes} 分钟专注 · ${shortBreakMinutes} 分钟短休息 · ${longBreakEvery} 轮后 ${longBreakMinutes} 分钟长休息`
  const presenceSummary = quietCompanionMode
    ? 'bb7 会更克制一点，尽量不突然打断你。'
    : 'bb7 会保持更明显的存在感和互动感。'
  const selectedPetSummary =
    selectedPetMeta?.summary ??
    '桌面上陪着你的，不应该只是一个会动的部件，而是有稳定气质的角色。'
  const selectedPetTags = selectedPetMeta ? [...selectedPetMeta.tags.slice(0, 4), selectedPetMeta.archetype].filter(Boolean) : []
  const previewModeLabel = hasPendingChanges ? '桌面预览中' : '正式状态'
  const previewModeSummary = hasPendingChanges
    ? '你现在改的内容，bb7 已经在桌面上先临时预演了；确认后才会正式应用。'
    : '当前桌面上看到的，就是已经正式应用的陪伴状态。'
  const selectedPetDisplayName = selectedPetMeta?.name ?? 'bb7'
  const capabilityLine = capabilitySummary.length > 0 ? capabilitySummary.join('、') : '基础陪伴'
  const providerConnectionSummary =
    providerConnectedCount > 0 ? `已接入 ${providerConnectedCount} 项核心能力` : '当前还没有接入额外能力'
  const validPluginCount = localPlugins.filter((plugin) => plugin.status === 'valid').length
  const pluginIssueCount = localPlugins.filter(
    (plugin) => plugin.status !== 'valid' || plugin.errors.length > 0 || plugin.runtimeErrors.length > 0,
  ).length
  const pendingChangeChips = [
    petId !== selectedPetId ? `角色切换到 ${selectedPetDisplayName}` : null,
    selectedAiProviderId !== aiChatProviderId || enabled !== config.enabled ? (enabled ? '聊天能力配置有更新' : '聊天能力将关闭') : null,
    selectedFileProviderId !== fileAnalysisProviderId ? '文件分析接入变更' : null,
    selectedScreenProviderId !== screenPerceptionProviderId ? '屏幕感知接入变更' : null,
    quietCompanionMode !== lowDistractionMode ? (quietCompanionMode ? '切到低打扰模式' : '恢复标准陪伴') : null,
    workEnabled !== workMode.enabled ||
    focusMinutes !== workMode.focusMinutes ||
    shortBreakMinutes !== workMode.shortBreakMinutes ||
    longBreakMinutes !== workMode.longBreakMinutes ||
    longBreakEvery !== workMode.longBreakEvery ||
    autoStartBreaks !== workMode.autoStartBreaks ||
    autoStartFocus !== workMode.autoStartFocus ||
    overworkReminderMinutes !== workMode.overworkReminderMinutes
      ? '工作节奏草稿已更新'
      : null,
  ].filter((item): item is string => Boolean(item))
  const settingsSections: Array<{
    id: SettingsSectionId
    eyebrow: string
    label: string
    summary: string
    status: string
  }> = [
    {
      id: 'character',
      eyebrow: '角色',
      label: '角色',
      summary: `${selectedPetDisplayName} · ${selectedPetMeta?.archetype ?? '桌面陪伴'}`,
      status: capabilitySummary.length > 0 ? `${capabilitySummary.length} 项能力` : '基础陪伴',
    },
    {
      id: 'providers',
      eyebrow: '能力接入',
      label: '能力接入',
      summary: providerConnectionSummary,
      status: `${providerConnectedCount} / 3`,
    },
    {
      id: 'conversation',
      eyebrow: '聊天',
      label: '聊天',
      summary: enabled ? aiStatusSummary : '当前保持安静陪伴，没有打开聊天链路。',
      status: enabled ? aiStatusLabel : '未启用',
    },
    {
      id: 'presence',
      eyebrow: '存在感',
      label: '存在感',
      summary: presenceSummary,
      status: quietCompanionMode ? '低打扰' : '标准陪伴',
    },
    {
      id: 'rhythm',
      eyebrow: '工作节奏',
      label: '工作节奏',
      summary: workModeSummary,
      status: workEnabled ? `${focusMinutes}/${shortBreakMinutes}` : '未启用',
    },
    {
      id: 'plugins',
      eyebrow: '插件',
      label: '插件',
      summary: localPlugins.length > 0 ? `发现 ${localPlugins.length} 个插件` : '还没有发现本地插件',
      status: pluginIssueCount > 0 ? `${pluginIssueCount} 待处理` : `${validPluginCount} 可用`,
    },
  ]

  const bindSectionRef =
    (sectionId: SettingsSectionId) =>
    (node: HTMLElement | null): void => {
      sectionRefs.current[sectionId] = node
    }

  const focusSection = (sectionId: SettingsSectionId) => {
    setActiveSection(sectionId)

    const container = mainScrollRef.current
    const target = sectionRefs.current[sectionId]
    if (!container || !target) {
      return
    }

    container.scrollTo({
      top: Math.max(target.offsetTop - 12, 0),
      behavior: 'smooth',
    })
  }

  const syncActiveSection = () => {
    const container = mainScrollRef.current
    if (!container) {
      return
    }

    const currentTop = container.scrollTop
    let nextSection = activeSection
    let closestDistance = Number.POSITIVE_INFINITY

    settingsSections.forEach((section) => {
      const node = sectionRefs.current[section.id]
      if (!node) {
        return
      }

      const distance = Math.abs(node.offsetTop - currentTop - 24)
      if (distance < closestDistance) {
        closestDistance = distance
        nextSection = section.id
      }
    })

    if (nextSection !== activeSection) {
      setActiveSection(nextSection)
    }
  }

  useEffect(() => {
    void refreshLocalPlugins()
  }, [refreshLocalPlugins])

  useEffect(() => {
    setPetId(selectedPetId)
  }, [selectedPetId])

  useEffect(() => {
    setSelectedAiProviderId(aiChatProviderId)
  }, [aiChatProviderId])

  useEffect(() => {
    setSelectedFileProviderId(fileAnalysisProviderId)
  }, [fileAnalysisProviderId])

  useEffect(() => {
    setSelectedScreenProviderId(screenPerceptionProviderId)
  }, [screenPerceptionProviderId])

  useEffect(() => {
    setQuietCompanionMode(lowDistractionMode)
  }, [lowDistractionMode])

  useEffect(() => {
    if (hasPendingChanges) {
      setSavePulseVisible(false)
    }
  }, [hasPendingChanges])

  useEffect(() => {
    if (!hasPendingChanges) {
      if (previewSessionActiveRef.current && previewExitReasonRef.current === null) {
        clearCompanionSettingsPreviewState('idle')
      }

      previewSessionActiveRef.current = false
      return
    }

    previewSessionActiveRef.current = true
    previewExitReasonRef.current = null

    publishCompanionSettingsPreviewState({
      active: true,
      selectedPetId: petId,
      lowDistractionMode: quietCompanionMode,
      chatEnabled: enabled,
      chatConnected: enabled ? aiHealth.ok === true : false,
    })
  }, [aiHealth.ok, enabled, hasPendingChanges, petId, quietCompanionMode])

  useEffect(() => {
    return () => {
      if (previewSessionActiveRef.current) {
        clearCompanionSettingsPreviewState('dismissed')
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (savePulseTimerRef.current !== null) {
        window.clearTimeout(savePulseTimerRef.current)
      }
      if (aiHealthDebounceTimerRef.current !== null) {
        window.clearTimeout(aiHealthDebounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const syncLayout = () => {
      setIsCompactPanel(window.innerWidth < 760)
      setIsTightPanel(window.innerWidth < 560)
    }

    syncLayout()
    window.addEventListener('resize', syncLayout)
    return () => window.removeEventListener('resize', syncLayout)
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const flags = await window.electronAPI?.getRuntimeFlags?.()
      if (cancelled) {
        return
      }

      if (flags?.smokeTarget === 'settings') {
        window.electronAPI?.emitSmokeCheckpoint?.('settings-panel-ready')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const flags = await window.electronAPI?.getRuntimeFlags?.()
      if (cancelled || flags?.smokeTarget !== 'workmode') {
        return
      }

      if (!workMode.enabled) {
        setWorkModeConfig({ enabled: true })
      }

      window.setTimeout(() => {
        if (!cancelled) {
          startFocus()
        }
      }, 60)
    })()

    return () => {
      cancelled = true
    }
  }, [setWorkModeConfig, startFocus, workMode.enabled])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const flags = await window.electronAPI?.getRuntimeFlags?.()
      if (cancelled || flags?.smokeTarget !== 'workmode') {
        return
      }

      if (workSnapshot.phase === 'focus' && workMode.enabled) {
        window.electronAPI?.emitSmokeCheckpoint?.('workmode-ready')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [workMode.enabled, workSnapshot.phase])

  useEffect(() => {
    const container = mainScrollRef.current
    if (!container) {
      return
    }

    syncActiveSection()
    container.addEventListener('scroll', syncActiveSection, { passive: true })

    return () => {
      container.removeEventListener('scroll', syncActiveSection)
    }
  }, [activeSection, isCompactPanel, isTightPanel])

  useEffect(() => {
    let cancelled = false

    const checkHealth = async () => {
      setAiHealth((current) => ({
        ...current,
        loading: true,
        message: current.ok === null ? '正在检查当前聊天接入状态...' : current.message,
      }))

      try {
        const provider = resolveAIChatProvider(selectedAiProviderId)
        const result = await provider.healthCheck({
          ...config,
          endpoint,
          apiKey,
          model,
          enabled,
        })

        if (cancelled) {
          return
        }

        setAiHealth({
          loading: false,
          ok: result.ok,
          message: result.message,
        })
      } catch (error: any) {
        if (cancelled) {
          return
        }

        setAiHealth({
          loading: false,
          ok: false,
          message: error?.message ?? '当前聊天接入检查失败。',
        })
      }
    }

    if (aiHealthDebounceTimerRef.current !== null) {
      window.clearTimeout(aiHealthDebounceTimerRef.current)
    }

    aiHealthDebounceTimerRef.current = window.setTimeout(() => {
      aiHealthDebounceTimerRef.current = null
      void checkHealth()
    }, enabled ? 380 : 120)

    return () => {
      cancelled = true
      if (aiHealthDebounceTimerRef.current !== null) {
        window.clearTimeout(aiHealthDebounceTimerRef.current)
        aiHealthDebounceTimerRef.current = null
      }
    }
  }, [apiKey, config, enabled, endpoint, model, selectedAiProviderId])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        save()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [
    apiKey,
    autoStartBreaks,
    autoStartFocus,
    enabled,
    endpoint,
    focusMinutes,
    hasPendingChanges,
    longBreakEvery,
    longBreakMinutes,
    model,
    onClose,
    overworkReminderMinutes,
    petId,
    quietCompanionMode,
    selectedAiProviderId,
    selectedFileProviderId,
    selectedScreenProviderId,
    shortBreakMinutes,
    workEnabled,
  ])

  const save = () => {
    if (!hasPendingChanges) {
      return
    }

    if (savePulseTimerRef.current !== null) {
      window.clearTimeout(savePulseTimerRef.current)
    }

    selectPet(petId)
    setProvider('aiChat', selectedAiProviderId)
    setProvider('fileAnalysis', selectedFileProviderId)
    setProvider('screenPerception', selectedScreenProviderId)
    setConfig({ endpoint, apiKey, model, enabled })
    setConnected(aiHealth.ok === true)
    setLowDistractionMode(quietCompanionMode)
    setWorkModeConfig({
      enabled: workEnabled,
      focusMinutes,
      shortBreakMinutes,
      longBreakMinutes,
      longBreakEvery,
      autoStartBreaks,
      autoStartFocus,
      overworkReminderMinutes,
    })
    setLastSavedAt(Date.now())
    setSavePulseVisible(true)
    previewSessionActiveRef.current = false
    previewExitReasonRef.current = 'applied'
    clearCompanionSettingsPreviewState('applied')
    savePulseTimerRef.current = window.setTimeout(() => {
      setSavePulseVisible(false)
      savePulseTimerRef.current = null
    }, 2200)
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background:
      'radial-gradient(circle at 18% 12%, rgba(255, 219, 204, 0.18), transparent 30%), radial-gradient(circle at 82% 14%, rgba(176, 211, 239, 0.18), transparent 26%), rgba(14, 24, 36, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10001,
    padding: isTightPanel ? '8px' : '14px',
  }

  const panelStyle: React.CSSProperties = {
    background:
      'linear-gradient(180deg, rgba(255, 252, 248, 0.98), rgba(247, 250, 255, 0.96) 44%, rgba(241, 247, 253, 0.98))',
    backdropFilter: 'blur(22px)',
    borderRadius: '28px',
    width: 'min(1120px, calc(100vw - 24px))',
    maxHeight: 'calc(100vh - 24px)',
    overflow: 'hidden',
    color: '#49657f',
    border: '1px solid rgba(162, 194, 221, 0.24)',
    boxShadow: '0 28px 80px rgba(23, 38, 52, 0.34)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  }

  const panelHeaderStyle: React.CSSProperties = {
    padding: isTightPanel ? '16px 16px 12px' : '22px 22px 16px',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(247, 252, 255, 0.72)), radial-gradient(circle at top right, rgba(246,195,212,0.26), transparent 36%), radial-gradient(circle at left top, rgba(182, 217, 243, 0.18), transparent 28%)',
    borderBottom: '1px solid rgba(138, 191, 230, 0.14)',
  }

  const panelHeaderTopStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: isCompactPanel ? 'stretch' : 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '12px',
    flexDirection: isCompactPanel ? 'column' : 'row',
  }

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: isTightPanel ? '20px' : '24px',
    fontWeight: 700,
    color: '#425a73',
    letterSpacing: '0.1px',
  }

  const titleSubStyle: React.CSSProperties = {
    marginTop: '8px',
    fontSize: '13px',
    lineHeight: 1.7,
    color: 'rgba(93, 118, 142, 0.8)',
    maxWidth: isCompactPanel ? '100%' : '560px',
  }

  const closeButtonStyle: React.CSSProperties = {
    width: '38px',
    height: '38px',
    borderRadius: '999px',
    border: '1px solid rgba(138, 191, 230, 0.18)',
    background: 'rgba(255,255,255,0.78)',
    color: '#6f89a1',
    fontSize: '20px',
    cursor: 'pointer',
    flex: '0 0 auto',
    boxShadow: '0 8px 20px rgba(117, 151, 181, 0.12)',
  }

  const headerActionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: isCompactPanel ? 'space-between' : 'flex-start',
    gap: '8px',
  }

  const ambientStatusStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '999px',
    background: saveFeedbackTone.background,
    border: saveFeedbackTone.border,
    color: saveFeedbackTone.color,
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.2px',
    boxShadow: savePulseVisible ? '0 12px 28px rgba(125, 184, 232, 0.16)' : '0 6px 18px rgba(113, 145, 174, 0.08)',
  }

  const overviewBarStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isTightPanel
      ? '1fr'
      : isCompactPanel
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(4, minmax(0, 1fr))',
    gap: '10px',
  }

  const overviewPillStyle: React.CSSProperties = {
    padding: '12px 12px 11px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.74)',
    border: '1px solid rgba(138, 191, 230, 0.15)',
    fontSize: '11px',
    color: '#64819a',
    lineHeight: 1.55,
    minWidth: 0,
    whiteSpace: 'pre-line',
    boxShadow: '0 10px 24px rgba(120, 153, 181, 0.08)',
  }

  const panelBodyStyle: React.CSSProperties = {
    padding: isTightPanel ? '10px' : '16px',
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: isCompactPanel ? '1fr' : 'minmax(0, 1.22fr) minmax(280px, 0.78fr)',
    gap: '16px',
    alignItems: 'start',
    background:
      'radial-gradient(circle at top right, rgba(245, 209, 219, 0.08), transparent 24%), radial-gradient(circle at left bottom, rgba(171, 209, 237, 0.08), transparent 28%)',
  }

  const mainColumnStyle: React.CSSProperties = {
    display: 'grid',
    gap: '14px',
    minWidth: 0,
  }

  const asideColumnStyle: React.CSSProperties = {
    display: 'grid',
    gap: '14px',
    minWidth: 0,
    alignSelf: 'start',
    position: isCompactPanel ? 'static' : 'sticky',
    top: 0,
  }

  const sectionCardStyle: React.CSSProperties = {
    padding: isTightPanel ? '14px' : '18px',
    borderRadius: '24px',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(244,248,254,0.84)), radial-gradient(circle at top right, rgba(245, 197, 212, 0.08), transparent 34%)',
    border: '1px solid rgba(138, 191, 230, 0.14)',
    boxShadow: '0 18px 38px rgba(117, 150, 178, 0.08), inset 0 1px 0 rgba(255,255,255,0.56)',
  }

  const compactSectionCardStyle: React.CSSProperties = {
    ...sectionCardStyle,
    padding: isTightPanel ? '14px' : '16px',
  }

  const sectionTitleWrapStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '10px',
  }

  const sectionHeadingMainStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  }

  const sectionHintStyle: React.CSSProperties = {
    fontSize: '12px',
    lineHeight: 1.7,
    color: 'rgba(98, 123, 147, 0.76)',
    marginBottom: '14px',
  }

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    letterSpacing: '0.2px',
    color: '#4f6880',
  }

  const sectionEyebrowStyle: React.CSSProperties = {
    fontSize: '10px',
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
    color: 'rgba(104, 132, 157, 0.58)',
    marginBottom: '4px',
  }

  const sectionMetaStyle: React.CSSProperties = {
    padding: '5px 9px',
    borderRadius: '999px',
    background: 'rgba(142, 197, 236, 0.12)',
    color: '#67839d',
    fontSize: '10px',
    fontWeight: 700,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'rgba(104, 132, 157, 0.72)',
    marginBottom: '6px',
    fontWeight: 600,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 12px',
    borderRadius: '14px',
    border: '1px solid rgba(138, 191, 230, 0.24)',
    background: 'rgba(255,255,255,0.88)',
    color: '#49657f',
    fontSize: '13px',
    marginBottom: '10px',
    outline: 'none',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.52)',
  }

  const fieldClusterStyle: React.CSSProperties = {
    display: 'grid',
    gap: '10px',
    padding: '14px',
    borderRadius: '18px',
    border: '1px solid rgba(138, 191, 230, 0.12)',
    background: 'rgba(255,255,255,0.62)',
    marginBottom: '10px',
  }

  const switchCardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.78)',
    border: '1px solid rgba(138, 191, 230, 0.14)',
    marginBottom: '10px',
  }

  const toggleCardButtonStyle: React.CSSProperties = {
    ...switchCardStyle,
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
  }

  const quickButtonStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: '14px',
    border: '1px solid rgba(138, 191, 230, 0.18)',
    background: 'rgba(255,255,255,0.8)',
    color: '#56728b',
    fontSize: '12px',
    cursor: 'pointer',
    minWidth: 'calc(50% - 4px)',
    boxShadow: '0 8px 18px rgba(120, 153, 181, 0.08)',
  }

  const helperTextStyle: React.CSSProperties = {
    marginTop: '-2px',
    marginBottom: '12px',
    fontSize: '11px',
    color: 'rgba(104, 132, 157, 0.72)',
    lineHeight: 1.6,
  }

  const candidateListStyle: React.CSSProperties = {
    display: 'grid',
    gap: '8px',
    marginTop: '8px',
  }

  const candidateCardStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '14px',
    border: '1px solid rgba(138, 191, 230, 0.14)',
    background: 'rgba(255,255,255,0.72)',
  }

  const compactGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isTightPanel ? '1fr' : 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  }

  const selectedPetHeroStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    padding: isTightPanel ? '14px' : '16px',
    borderRadius: '22px',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(242,247,254,0.9)), radial-gradient(circle at top right, rgba(246,195,212,0.18), transparent 36%)',
    border: '1px solid rgba(138, 191, 230, 0.16)',
    marginBottom: '14px',
    flexDirection: isCompactPanel ? 'column' : 'row',
    boxShadow: '0 16px 36px rgba(118, 150, 178, 0.1)',
  }

  const selectedPetPreviewStyle: React.CSSProperties = {
    width: isCompactPanel ? '82px' : '96px',
    height: isCompactPanel ? '82px' : '96px',
    borderRadius: '22px',
    overflow: 'hidden',
    border: `1px solid ${selectedPetMeta?.accentColor ?? 'rgba(142, 197, 236, 0.32)'}`,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.86), rgba(240,247,255,0.96))',
    flex: '0 0 auto',
    boxShadow: '0 16px 28px rgba(123, 160, 191, 0.14)',
  }

  const disclosureButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 11px',
    borderRadius: '999px',
    border: '1px solid rgba(138, 191, 230, 0.18)',
    background: 'rgba(255,255,255,0.76)',
    color: '#64819a',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  }

  const panelFooterStyle: React.CSSProperties = {
    display: 'flex',
    gap: '10px',
    justifyContent: 'space-between',
    alignItems: isTightPanel ? 'stretch' : 'center',
    padding: isTightPanel ? '14px 14px 16px' : '16px 18px 18px',
    borderTop: '1px solid rgba(138, 191, 230, 0.14)',
    background: 'linear-gradient(180deg, rgba(250,252,255,0.84), rgba(255,255,255,0.94))',
    flexDirection: isTightPanel ? 'column-reverse' : 'row',
  }

  const footerStatusStyle: React.CSSProperties = {
    fontSize: '12px',
    color: saveFeedbackTone.color,
    lineHeight: 1.5,
  }

  const footerActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    width: isTightPanel ? '100%' : 'auto',
  }

  const heroCardStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isCompactPanel ? '1fr' : 'minmax(0, 1.22fr) minmax(240px, 0.78fr)',
    gap: '12px',
    marginTop: '14px',
  }

  const heroMainStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    padding: isTightPanel ? '16px' : '18px',
    borderRadius: '22px',
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.88), rgba(245,250,255,0.84)), radial-gradient(circle at top right, rgba(245, 197, 212, 0.18), transparent 38%)',
    border: '1px solid rgba(138, 191, 230, 0.16)',
    minHeight: isCompactPanel ? 'auto' : '212px',
    boxShadow: '0 18px 40px rgba(118, 150, 178, 0.1)',
  }

  const heroAsideStyle: React.CSSProperties = {
    display: 'grid',
    gap: '10px',
  }

  const heroStatCardStyle: React.CSSProperties = {
    padding: '14px',
    borderRadius: '18px',
    border: '1px solid rgba(138, 191, 230, 0.14)',
    background: 'rgba(255,255,255,0.78)',
    boxShadow: '0 10px 24px rgba(120, 153, 181, 0.08)',
  }

  const heroBubbleClusterStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '14px',
    marginBottom: '14px',
  }

  const heroBubbleStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 10px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.72)',
    border: '1px solid rgba(138, 191, 230, 0.14)',
    fontSize: '11px',
    color: '#5f7a93',
    boxShadow: '0 8px 18px rgba(120, 153, 181, 0.06)',
  }

  const heroSummaryGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isTightPanel ? '1fr' : 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
  }

  const summaryCardStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.72)',
    border: '1px solid rgba(138, 191, 230, 0.12)',
  }

  const sectionNavigatorStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isCompactPanel ? '1fr' : 'minmax(0, 1.18fr) minmax(280px, 0.82fr)',
    gap: '12px',
    alignItems: 'start',
  }

  const sectionNavGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isTightPanel ? '1fr' : 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  }

  const sectionAgendaStyle: React.CSSProperties = {
    padding: isTightPanel ? '14px' : '16px',
    borderRadius: '20px',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(243,248,255,0.78)), radial-gradient(circle at top right, rgba(245, 197, 212, 0.14), transparent 36%)',
    border: '1px solid rgba(138, 191, 230, 0.14)',
    boxShadow: '0 14px 30px rgba(118, 150, 178, 0.08)',
  }

  const sectionNavLabelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 700,
    color: '#4f6880',
    marginBottom: '4px',
  }

  const sectionNavSummaryStyle: React.CSSProperties = {
    fontSize: '11px',
    lineHeight: 1.55,
    color: 'rgba(92, 118, 143, 0.82)',
  }

  const draftDigestStyle: React.CSSProperties = {
    padding: isTightPanel ? '14px' : '16px',
    borderRadius: '20px',
    background: hasPendingChanges
      ? 'linear-gradient(135deg, rgba(255, 247, 238, 0.96), rgba(255,255,255,0.86))'
      : 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(245,249,255,0.78))',
    border: hasPendingChanges
      ? '1px solid rgba(240, 194, 150, 0.24)'
      : '1px solid rgba(138, 191, 230, 0.14)',
    boxShadow: hasPendingChanges
      ? '0 16px 30px rgba(236, 186, 135, 0.12)'
      : '0 14px 30px rgba(118, 150, 178, 0.08)',
    display: 'grid',
    gap: '10px',
    alignSelf: 'stretch',
  }

  const segmentedGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isTightPanel ? '1fr' : 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
    marginBottom: '14px',
  }

  const previewNoticeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: isCompactPanel ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 14px',
    marginTop: '12px',
    borderRadius: '18px',
    border: hasPendingChanges
      ? '1px solid rgba(240, 194, 150, 0.24)'
      : '1px solid rgba(138, 191, 230, 0.14)',
    background: hasPendingChanges
      ? 'linear-gradient(135deg, rgba(255, 247, 238, 0.92), rgba(255,255,255,0.82))'
      : 'rgba(255,255,255,0.68)',
    boxShadow: '0 10px 24px rgba(120, 153, 181, 0.06)',
    flexDirection: isCompactPanel ? 'column' : 'row',
  }

  const providerGridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '10px',
  }

  const providerCardStyle: React.CSSProperties = {
    padding: '14px',
    borderRadius: '18px',
    border: '1px solid rgba(138, 191, 230, 0.14)',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(245,249,255,0.7)), radial-gradient(circle at top right, rgba(182, 217, 243, 0.12), transparent 42%)',
    boxShadow: '0 12px 28px rgba(120, 153, 181, 0.07)',
  }

  const providerMetaRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '8px',
    flexWrap: 'wrap',
  }

  const providerCaptionStyle: React.CSSProperties = {
    fontSize: '11px',
    lineHeight: 1.6,
    color: 'rgba(92, 118, 143, 0.78)',
  }

  const switchControlStyle: React.CSSProperties = {
    appearance: 'none',
    width: '46px',
    height: '28px',
    borderRadius: '999px',
    border: '1px solid rgba(138, 191, 230, 0.18)',
    background: 'linear-gradient(180deg, rgba(223, 232, 241, 0.9), rgba(204, 219, 233, 0.9))',
    position: 'relative',
    cursor: 'pointer',
    flex: '0 0 auto',
    outline: 'none',
    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.42)',
  }

  const switchThumbStyle = (checked: boolean): React.CSSProperties => ({
    position: 'absolute',
    top: '3px',
    left: checked ? '21px' : '3px',
    width: '20px',
    height: '20px',
    borderRadius: '999px',
    background: '#ffffff',
    boxShadow: checked
      ? '0 6px 14px rgba(90, 132, 176, 0.18)'
      : '0 4px 10px rgba(104, 132, 157, 0.16)',
    transition: 'left 160ms ease',
  })

  const renderToggleCard = ({
    checked,
    onToggle,
    title,
    description,
    accentBackground,
    accentShadow,
  }: {
    checked: boolean
    onToggle: () => void
    title: string
    description: string
    accentBackground: string
    accentShadow: string
  }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      style={toggleCardButtonStyle}
    >
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(104, 132, 157, 0.74)' }}>{description}</div>
      </div>
      <span
        aria-hidden="true"
        style={{
          ...switchControlStyle,
          background: checked ? accentBackground : switchControlStyle.background,
          boxShadow: checked ? accentShadow : switchControlStyle.boxShadow,
        }}
      >
        <span style={switchThumbStyle(checked)} />
      </span>
    </button>
  )

  const workSummaryStripStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isCompactPanel ? '1fr' : 'minmax(0, 1.1fr) minmax(220px, 0.9fr)',
    gap: '10px',
    marginBottom: '12px',
  }

  const workSummaryCardStyle: React.CSSProperties = {
    padding: '13px 14px',
    borderRadius: '18px',
    border: '1px solid rgba(138, 191, 230, 0.14)',
    background: 'rgba(255,255,255,0.74)',
  }

  const railCardStyle: React.CSSProperties = {
    padding: isTightPanel ? '14px' : '16px',
    borderRadius: '22px',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(245,249,255,0.82)), radial-gradient(circle at top right, rgba(246,195,212,0.12), transparent 38%)',
    border: '1px solid rgba(138, 191, 230, 0.14)',
    boxShadow: '0 16px 34px rgba(117, 150, 178, 0.08)',
  }

  const railTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#4f6880',
    letterSpacing: '0.16px',
  }

  const railCaptionStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'rgba(103, 128, 151, 0.62)',
    textTransform: 'uppercase',
    letterSpacing: '0.28px',
    marginBottom: '4px',
  }

  const railPreviewWrapStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.72)',
    border: '1px solid rgba(138, 191, 230, 0.12)',
    marginBottom: '14px',
  }

  const railPreviewShellStyle: React.CSSProperties = {
    width: '72px',
    height: '72px',
    borderRadius: '18px',
    overflow: 'hidden',
    border: `1px solid ${selectedPetMeta?.accentColor ?? 'rgba(142, 197, 236, 0.32)'}`,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.86), rgba(240,247,255,0.96))',
    boxShadow: '0 12px 24px rgba(123, 160, 191, 0.12)',
    flex: '0 0 auto',
  }

  const railMetricGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isTightPanel ? '1fr' : 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  }

  const railMetricCardStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '16px',
    border: '1px solid rgba(138, 191, 230, 0.12)',
    background: 'rgba(255,255,255,0.68)',
  }

  const railLineListStyle: React.CSSProperties = {
    display: 'grid',
    gap: '8px',
    marginTop: '12px',
  }

  const railLineStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '10px',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(138, 191, 230, 0.1)',
  }

  const railActionButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '14px',
    border: '1px solid rgba(138, 191, 230, 0.2)',
    background: 'rgba(255,255,255,0.78)',
    color: '#58738d',
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 10px 20px rgba(120, 153, 181, 0.08)',
  }

  const railActionPrimaryStyle: React.CSSProperties = {
    ...railActionButtonStyle,
    background: hasPendingChanges
      ? 'linear-gradient(135deg, rgba(125, 184, 232, 0.96), rgba(240, 183, 203, 0.94))'
      : 'rgba(255,255,255,0.72)',
    border: hasPendingChanges ? '1px solid rgba(125, 184, 232, 0.18)' : railActionButtonStyle.border,
    color: hasPendingChanges ? '#ffffff' : '#8ca0b4',
    boxShadow: hasPendingChanges ? '0 14px 26px rgba(125, 184, 232, 0.18)' : railActionButtonStyle.boxShadow,
    cursor: hasPendingChanges ? 'pointer' : 'default',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div style={panelHeaderTopStyle}>
            <div>
              <h3 style={titleStyle}>陪伴设置</h3>
              <div style={titleSubStyle}>把 bb7 的角色状态、能力接入和陪伴节奏收成一个更顺手、也更像产品的控制台。</div>
            </div>
            <div style={headerActionsStyle}>
              <span style={ambientStatusStyle}>
                <span>{savePulseVisible ? '已同步' : hasPendingChanges ? '待保存' : '已整理好'}</span>
                <span style={{ opacity: 0.72, fontWeight: 600 }}>
                  {savePulseVisible
                    ? '刚刚更新到 bb7'
                    : hasPendingChanges
                      ? '有改动还没应用'
                      : '当前状态稳定'}
                </span>
              </span>
              <button onClick={onClose} style={closeButtonStyle}>
                ×
              </button>
            </div>
          </div>
          <div style={heroCardStyle}>
            <div style={heroMainStyle}>
              <div style={{ fontSize: '11px', letterSpacing: '0.28px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)' }}>
                Companion Console
              </div>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: isTightPanel ? '22px' : '28px', fontWeight: 700, color: '#465e76' }}>bb7 正在桌面上陪着你</div>
                <span style={pillStyle(true, selectedPetMeta?.accentColor ?? '#8ec5ec', true)}>{quietCompanionMode ? '安静陪伴' : '标准陪伴'}</span>
              </div>
              <div
                style={{
                  marginTop: '10px',
                  maxWidth: '560px',
                  fontSize: '13px',
                  lineHeight: 1.72,
                  color: 'rgba(82, 106, 128, 0.88)',
                }}
              >
                {selectedPetSummary}
              </div>
              <div style={heroBubbleClusterStyle}>
                <span style={heroBubbleStyle}>当前角色 · {selectedPetMeta?.name ?? 'bb7'}</span>
                <span style={heroBubbleStyle}>聊天状态 · {aiStatusLabel}</span>
                <span style={heroBubbleStyle}>工作节奏 · {workEnabled ? renderPhaseLabel(workSnapshot.phase) : '未启用'}</span>
                <span style={heroBubbleStyle}>接入数 · {providerConnectedCount} 项</span>
              </div>
              <div style={heroSummaryGridStyle}>
                <div style={summaryCardStyle}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)', marginBottom: '6px' }}>
                    存在感
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: 1.65, color: '#526a81' }}>{presenceSummary}</div>
                </div>
                <div style={summaryCardStyle}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)', marginBottom: '6px' }}>
                    聊天状态
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: 1.65, color: '#526a81' }}>{aiStatusSummary}</div>
                </div>
                <div style={summaryCardStyle}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)', marginBottom: '6px' }}>
                    工作节奏
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: 1.65, color: '#526a81' }}>{workModeSummary}</div>
                </div>
              </div>
            </div>
            <div style={heroAsideStyle}>
              <div style={heroStatCardStyle}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)', marginBottom: '8px' }}>
                  角色状态
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#4b657d', marginBottom: '6px' }}>{selectedPetMeta?.name ?? 'bb7'}</div>
                <div style={{ fontSize: '12px', lineHeight: 1.65, color: 'rgba(92, 118, 143, 0.82)' }}>
                  {selectedPetMeta ? `${renderPetSourceLabel(selectedPetMeta.source)} · ${selectedPetMeta.renderer}` : '默认桌面角色'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                  {selectedPetTags.length > 0 ? (
                    selectedPetTags.map((tag) => (
                      <span key={String(tag)} style={miniTagStyle}>
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span style={miniTagStyle}>基础陪伴</span>
                  )}
                </div>
              </div>
              <div style={heroStatCardStyle}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)', marginBottom: '8px' }}>
                  Status
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '4px' }}>聊天接入</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>{aiStatusLabel}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '4px' }}>陪伴节奏</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>
                      {workEnabled ? renderPhaseLabel(workSnapshot.phase) : '待命'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '4px' }}>保存状态</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>
                      {hasPendingChanges ? '有改动待应用' : savePulseVisible ? '刚刚同步' : '当前稳定'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={overviewBarStyle}>
            <span style={overviewPillStyle}>{`角色配置\n◇ 当前角色：${selectedPetMeta?.name ?? 'bb7'}`}</span>
            <span
              style={{
                ...overviewPillStyle,
                background: enabled ? 'rgba(236, 247, 255, 0.86)' : 'rgba(255,255,255,0.72)',
                border: enabled ? '1px solid rgba(125, 184, 232, 0.24)' : '1px solid rgba(138, 191, 230, 0.16)',
                color: enabled ? '#5f7e98' : overviewPillStyle.color,
              }}
            >
              {enabled ? '对话能力\n✦ 已开启 AI 对话' : '对话能力\n○ AI 对话未开启'}
            </span>
            <span
              style={{
                ...overviewPillStyle,
                background: workModeTone.background,
                border: workModeTone.border,
                color: workModeTone.color,
              }}
            >
              {workEnabled ? `工作节奏\n↺ ${renderPhaseLabel(workSnapshot.phase)}` : '工作节奏\n○ 未启用'}
            </span>
            <span
              style={{
                ...overviewPillStyle,
                background: aiHealthTone.background,
                border: aiHealthTone.border,
                color: aiHealthTone.color,
              }}
            >
              {aiHealth.loading
                ? '接入状态\n◌ 正在检查'
                : aiHealth.ok === true
                  ? '接入状态\n● 已就绪'
                  : aiHealth.ok === false
                    ? '接入状态\n! 待处理'
                : '接入状态\n○ 未检查'}
            </span>
          </div>
          <div style={previewNoticeStyle}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)', marginBottom: '5px' }}>
                桌面联动
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880', marginBottom: '4px' }}>{previewModeLabel}</div>
              <div style={{ fontSize: '12px', lineHeight: 1.65, color: 'rgba(92, 118, 143, 0.84)' }}>{previewModeSummary}</div>
              {pendingChangeChips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                  {pendingChangeChips.slice(0, 4).map((item) => (
                    <span key={item} style={miniTagStyle}>
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span
              style={pillStyle(
                hasPendingChanges,
                hasPendingChanges ? '#e7b36a' : '#8ec5ec',
                true,
              )}
            >
              {hasPendingChanges ? '修改正在同步预览' : '当前就是正式状态'}
            </span>
          </div>
          <div style={sectionNavigatorStyle}>
            <div style={sectionAgendaStyle}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)', marginBottom: '8px' }}>
                浏览分区
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#4f6880', marginBottom: '6px' }}>先确定这一轮要调哪一块</div>
              <div style={{ fontSize: '12px', lineHeight: 1.7, color: 'rgba(92, 118, 143, 0.82)', marginBottom: '12px' }}>
                这页收的是角色、能力和工作节奏。先选分区，再进到细项，桌面上的陪伴感会更容易收得住。
              </div>
              <div style={sectionNavGridStyle}>
                {settingsSections.map((section) => {
                  const selected = section.id === activeSection
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => focusSection(section.id)}
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        borderRadius: '16px',
                        border: selected
                          ? '1px solid rgba(125, 184, 232, 0.28)'
                          : '1px solid rgba(138, 191, 230, 0.14)',
                        background: selected
                          ? 'linear-gradient(135deg, rgba(239, 247, 255, 0.96), rgba(255,255,255,0.88))'
                          : 'rgba(255,255,255,0.68)',
                        cursor: 'pointer',
                        boxShadow: selected ? '0 14px 28px rgba(125, 184, 232, 0.12)' : '0 8px 18px rgba(120, 153, 181, 0.04)',
                      }}
                    >
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)', marginBottom: '5px' }}>
                        {section.eyebrow}
                      </div>
                      <div style={sectionNavLabelStyle}>{section.label}</div>
                      <div style={sectionNavSummaryStyle}>{section.summary}</div>
                      <div style={{ marginTop: '8px', fontSize: '11px', color: selected ? '#5d84a6' : 'rgba(103, 128, 151, 0.72)', fontWeight: 700 }}>
                        {section.status}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={draftDigestStyle}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)' }}>Current Focus</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#4f6880' }}>
                {settingsSections.find((section) => section.id === activeSection)?.label ?? '角色'}
              </div>
              <div style={{ fontSize: '12px', lineHeight: 1.7, color: 'rgba(92, 118, 143, 0.84)' }}>
                {settingsSections.find((section) => section.id === activeSection)?.summary ?? selectedPetSummary}
              </div>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '14px',
                  background: 'rgba(255,255,255,0.72)',
                  border: '1px solid rgba(138, 191, 230, 0.12)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '4px' }}>这轮改动会影响</div>
                <div style={{ fontSize: '12px', lineHeight: 1.65, color: '#526a81' }}>
                  {hasPendingChanges
                    ? `${pendingChangeChips.slice(0, 2).join('，')}${pendingChangeChips.length > 2 ? ' 等' : ''}`
                    : '当前没有待应用改动，桌面上的 bb7 已经和这里保持一致。'}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(pendingChangeChips.length > 0 ? pendingChangeChips : ['角色状态稳定', '可继续微调', '支持实时预览']).slice(0, 4).map((item) => (
                  <span key={item} style={miniTagStyle}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={panelBodyStyle} ref={mainScrollRef}>
          <div style={mainColumnStyle}>
          <section ref={bindSectionRef('character')} style={sectionCardStyle}>
            <div style={sectionEyebrowStyle}>角色</div>
            <div style={sectionTitleWrapStyle}>
              <div style={sectionHeadingMainStyle}>
                <span style={sectionIconBubbleStyle('rgba(142, 197, 236, 0.18)', '#5d84a6')}>◌</span>
                <h4 style={sectionTitleStyle}>当前角色</h4>
              </div>
              <span style={sectionMetaStyle}>
                {capabilitySummary.length > 0 ? `${capabilitySummary.length} 个能力` : '基础陪伴'}
              </span>
            </div>
            <div style={sectionHintStyle}>选择现在留在桌面上的陪伴角色。这里保留的是角色感，不是一个冷冰冰的配置项。</div>
            {selectedPetMeta && (
              <div style={selectedPetHeroStyle}>
                <div style={selectedPetPreviewStyle}>
                  {selectedPetMeta.previewImageUrl ? (
                    <img
                      src={selectedPetMeta.previewImageUrl}
                      alt={selectedPetMeta.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        imageRendering: 'pixelated',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div style={{ ...previewFallbackStyle, fontSize: '28px' }}>
                      {selectedPetMeta.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#49657f' }}>{selectedPetMeta.name}</div>
                    <span style={pillStyle(true, selectedPetMeta.accentColor, true)}>正在陪你</span>
                    {selectedPetMeta.packageStage && (
                      <span style={pillStyle(false, selectedPetMeta.accentColor, false)}>
                        {renderPackageStageLabel(selectedPetMeta.packageStage)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(104, 132, 157, 0.72)', marginBottom: '6px' }}>
                    {renderPetSourceLabel(selectedPetMeta.source)} · {selectedPetMeta.renderer}
                  </div>
                  {selectedPetMeta.summary && (
                    <div
                      style={{
                        fontSize: '12px',
                        lineHeight: 1.6,
                        color: 'rgba(78, 102, 124, 0.88)',
                        marginBottom: '8px',
                      }}
                    >
                      {selectedPetMeta.summary}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {selectedPetMeta.tags.slice(0, 4).map((tag) => (
                      <span key={tag} style={miniTagStyle}>
                        {tag}
                      </span>
                    ))}
                    {selectedPetMeta.archetype && <span style={miniTagStyle}>{selectedPetMeta.archetype}</span>}
                  </div>
                  <div style={{ fontSize: '11px', lineHeight: 1.6, color: 'rgba(104, 132, 157, 0.78)' }}>
                    {selectedPetMeta.capabilities.length > 0
                      ? `这只角色现在能做：${selectedPetMeta.capabilities.map((capability) => formatCapabilityLabel(capability)).join('、')}`
                      : '这只角色当前以基础陪伴能力为主。'}
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
              {availablePets.map((pet) => {
                const selected = pet.id === petId
                return (
                  <button
                    key={pet.id}
                    onClick={() => setPetId(pet.id)}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: '16px',
                      border: selected
                        ? `1px solid ${pet.accentColor ?? 'rgba(142, 197, 236, 0.52)'}`
                        : '1px solid rgba(138, 191, 230, 0.16)',
                      background: selected
                        ? 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(239,246,255,0.96))'
                        : 'rgba(255,255,255,0.72)',
                      cursor: 'pointer',
                      boxShadow: selected ? '0 14px 30px rgba(116, 148, 181, 0.14)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        marginBottom: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={previewFrameStyle(selected, pet.accentColor)}>
                          {pet.previewImageUrl ? (
                            <img
                              src={pet.previewImageUrl}
                              alt={pet.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                imageRendering: 'pixelated',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <div style={previewFallbackStyle}>{pet.name.slice(0, 1).toUpperCase()}</div>
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#4f6880' }}>{pet.name}</div>
                          <div style={{ fontSize: '11px', color: 'rgba(104, 132, 157, 0.72)' }}>
                            {renderPetSourceLabel(pet.source)} · {pet.renderer}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                        }}
                      >
                        {pet.packageStage && (
                          <span style={pillStyle(selected, pet.accentColor, false)}>
                            {renderPackageStageLabel(pet.packageStage)}
                          </span>
                        )}
                        {selected && <span style={pillStyle(selected, pet.accentColor, true)}>当前使用中</span>}
                      </div>
                    </div>

                    {pet.summary && (
                      <div
                        style={{
                          fontSize: '12px',
                          lineHeight: 1.55,
                          color: 'rgba(79, 104, 128, 0.88)',
                          marginBottom: '8px',
                        }}
                      >
                        {pet.summary}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginBottom: pet.capabilities.length > 0 ? '8px' : 0,
                      }}
                    >
                      {pet.tags.slice(0, 4).map((tag) => (
                        <span key={tag} style={miniTagStyle}>
                          {tag}
                        </span>
                      ))}
                      {pet.archetype && <span style={miniTagStyle}>{pet.archetype}</span>}
                    </div>

                    {pet.capabilities.length > 0 && (
                      <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(104, 132, 157, 0.76)' }}>
                        已启用能力：{pet.capabilities.map((capability) => formatCapabilityLabel(capability)).join('、')}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setShowCustomPetLoader(true)}
                style={{
                  ...railActionPrimaryStyle,
                  width: isTightPanel ? '100%' : 'auto',
                  minWidth: isTightPanel ? '100%' : '176px',
                  cursor: 'pointer',
                }}
              >
                导入新角色
              </button>
              <button
                type="button"
                onClick={() => refreshCatalog()}
                style={{
                  ...railActionButtonStyle,
                  width: isTightPanel ? '100%' : 'auto',
                  minWidth: isTightPanel ? '100%' : '152px',
                }}
              >
                刷新角色列表
              </button>
            </div>
            <div
              style={{
                fontSize: '12px',
                lineHeight: 1.65,
                color: 'rgba(104, 132, 157, 0.78)',
                marginBottom: '8px',
              }}
            >
              想换成新的宠物包，或者导入旧版 sprite 资源时，可以直接从这里进入导入流程。导入完成后，新角色会自动出现在上面的列表里。
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(104, 132, 157, 0.72)', lineHeight: 1.6 }}>
              当前角色能力：{capabilitySummary.length > 0 ? capabilitySummary.join('、') : '基础陪伴'}
            </div>
          </section>

          <section ref={bindSectionRef('providers')} style={compactSectionCardStyle}>
            <div style={sectionEyebrowStyle}>能力接入</div>
            <div style={sectionTitleWrapStyle}>
              <div style={sectionHeadingMainStyle}>
                <span style={sectionIconBubbleStyle('rgba(157, 205, 235, 0.2)', '#5a7f9f')}>⌁</span>
                <h4 style={sectionTitleStyle}>能力接入</h4>
              </div>
              <span style={sectionMetaStyle}>
                {pluginBackedActiveProviders.length > 0 ? `${pluginBackedActiveProviders.length} 项已接入` : '内置优先'}
              </span>
            </div>
            <div style={sectionHintStyle}>把聊天、文件分析和屏幕感知接到当前角色上，让它的陪伴能力更完整。</div>
            <div style={providerGridStyle}>
              <div style={providerCardStyle}>
                <div style={providerMetaRowStyle}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>聊天接入</div>
                    <div style={providerCaptionStyle}>负责聊天、追问和更完整的陪伴式对话。</div>
                  </div>
                  <span style={pillStyle(Boolean(selectedAiProvider), '#8ec5ec', Boolean(selectedAiProvider))}>
                    {selectedAiProvider?.label ?? '未选择'}
                  </span>
                </div>
                <select style={{ ...inputStyle, marginBottom: 0 }} value={selectedAiProviderId} onChange={(event) => setSelectedAiProviderId(event.target.value)}>
                  {aiProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ProviderCandidateHint
              candidates={discoveredAiProviders}
              helperStyle={helperTextStyle}
              listStyle={candidateListStyle}
              cardStyle={candidateCardStyle}
            />

            <div style={providerGridStyle}>
              <div style={providerCardStyle}>
                <div style={providerMetaRowStyle}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>文件分析接入</div>
                    <div style={providerCaptionStyle}>负责投喂文件后的总结、提炼和完整分析链路。</div>
                  </div>
                  <span style={pillStyle(Boolean(selectedFileProvider), '#8ec5ec', Boolean(selectedFileProvider))}>
                    {selectedFileProvider?.label ?? '未选择'}
                  </span>
                </div>
                <select style={{ ...inputStyle, marginBottom: 0 }} value={selectedFileProviderId} onChange={(event) => setSelectedFileProviderId(event.target.value)}>
                  {fileProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ProviderCandidateHint
              candidates={discoveredFileProviders}
              helperStyle={helperTextStyle}
              listStyle={candidateListStyle}
              cardStyle={candidateCardStyle}
            />

            <div style={providerGridStyle}>
              <div style={providerCardStyle}>
                <div style={providerMetaRowStyle}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>屏幕感知接入</div>
                    <div style={providerCaptionStyle}>负责识别当前场景，让 bb7 更像真的在观察你的桌面。</div>
                  </div>
                  <span style={pillStyle(Boolean(selectedScreenProvider), '#8ec5ec', Boolean(selectedScreenProvider))}>
                    {selectedScreenProvider?.label ?? '未选择'}
                  </span>
                </div>
                <select
                  style={{ ...inputStyle, marginBottom: 0 }}
                  value={selectedScreenProviderId}
                  onChange={(event) => setSelectedScreenProviderId(event.target.value)}
                >
                  {screenProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ProviderCandidateHint
              candidates={discoveredScreenProviders}
              helperStyle={helperTextStyle}
              listStyle={candidateListStyle}
              cardStyle={candidateCardStyle}
            />
          </section>

          <section ref={bindSectionRef('plugins')} style={compactSectionCardStyle}>
            <div style={sectionEyebrowStyle}>插件</div>
            <div style={sectionTitleWrapStyle}>
              <div style={sectionHeadingMainStyle}>
                <span style={sectionIconBubbleStyle('rgba(244, 212, 182, 0.24)', '#9d7b5b')}>⋯</span>
                <h4 style={sectionTitleStyle}>本地插件</h4>
              </div>
              <span style={sectionMetaStyle}>{localPlugins.length > 0 ? `${localPlugins.length} 个发现项` : '等待接入'}</span>
            </div>
            <div style={sectionHintStyle}>这里会显示 `plugins/` 目录里发现的本地插件，以及它们现在是否已经接入 bb7 的能力链路。</div>
            <div style={{ marginBottom: '14px' }}>
              <button type="button" onClick={() => setPluginsExpanded((value) => !value)} style={disclosureButtonStyle}>
                <span>{pluginsExpanded ? '收起' : '展开'}插件列表</span>
                <span>{pluginsExpanded ? '▴' : '▾'}</span>
              </button>
            </div>
            {pluginsExpanded && (
              <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
                {localPlugins.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'rgba(104, 132, 157, 0.72)' }}>当前还没有发现可用的本地插件。</div>
                )}
                {localPlugins.map((plugin) => (
                  <div
                    key={`${plugin.directoryName}-${plugin.id}`}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border:
                        plugin.status === 'valid'
                          ? '1px solid rgba(138, 191, 230, 0.22)'
                          : '1px solid rgba(255, 159, 159, 0.3)',
                      background: plugin.status === 'valid' ? 'rgba(255,255,255,0.6)' : 'rgba(255, 241, 241, 0.75)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>{plugin.name}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(104, 132, 157, 0.72)' }}>
                          {plugin.id} · v{plugin.version}
                        </div>
                      </div>
                      <span
                        style={pillStyle(
                          plugin.status === 'valid',
                          plugin.status === 'valid' ? '#8ec5ec' : '#f3a0a0',
                          true,
                        )}
                      >
                        {plugin.status === 'valid' ? '可用' : '配置有误'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(92, 118, 143, 0.8)', marginBottom: '6px' }}>
                      入口文件：{plugin.entry} · API 版本：{plugin.apiVersion ?? '未声明'}
                    </div>
                    <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(92, 118, 143, 0.8)', marginBottom: '6px' }}>
                      运行状态：{renderPluginRuntimeLabel(plugin.runtimeStatus)}
                    </div>
                    <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(92, 118, 143, 0.8)', marginBottom: '6px' }}>
                      能力：{renderPluginTokenList(plugin.capabilities, renderPluginCapabilityLabel, '未声明')} · 权限：
                      {renderPluginTokenList(plugin.permissions, renderPluginPermissionLabel, '未声明')}
                    </div>
                    {plugin.capabilities.length > 0 && (
                      <div style={{ display: 'grid', gap: '6px', marginBottom: plugin.errors.length > 0 ? '8px' : 0 }}>
                        {describePluginCapabilities(plugin.capabilities).map((item) => (
                          <div
                            key={`${plugin.id}-${item.capability}`}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '10px',
                              background: 'rgba(255,255,255,0.6)',
                              border: '1px solid rgba(138, 191, 230, 0.14)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#56728b' }}>
                                {renderPluginCapabilityLabel(item.capability)}
                              </span>
                              <span
                                style={pillStyle(
                                  item.status === 'ready',
                                  item.status === 'ready' ? '#8ec5ec' : item.status === 'planned' ? '#e7b36a' : '#b7b7b7',
                                  true,
                                )}
                              >
                                {renderCapabilityStatusLabel(item.status)}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(92, 118, 143, 0.8)' }}>
                              {item.runtimeBinding ? `运行绑定：${renderRuntimeBindingLabel(item.runtimeBinding)}。` : ''}
                              {item.summary}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {plugin.errors.length > 0 && (
                      <div style={{ fontSize: '11px', lineHeight: 1.6, color: '#b86565' }}>{plugin.errors.join(' ')}</div>
                    )}
                    {plugin.runtimeErrors.length > 0 && (
                      <div
                        style={{
                          fontSize: '11px',
                          lineHeight: 1.6,
                          color: '#b07a45',
                          marginTop: plugin.errors.length > 0 ? '6px' : 0,
                        }}
                      >
                        {plugin.runtimeErrors.join(' ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={sectionTitleWrapStyle}>
              <div style={sectionHeadingMainStyle}>
                <span style={sectionIconBubbleStyle('rgba(248, 221, 176, 0.26)', '#a78159')}>⋯</span>
                <h4 style={sectionTitleStyle}>候选接入项</h4>
              </div>
              <span style={sectionMetaStyle}>
                {discoveredProviderCandidates.length > 0 ? `${discoveredProviderCandidates.length} 个候选` : '暂无候选'}
              </span>
            </div>
            <div style={sectionHintStyle}>下面这些插件已经声明了对应能力，但还没走完整条接入链路，所以暂时不会直接出现在上面的接入选择里。</div>
            {pluginBackedActiveProviders.length > 0 && (
              <div style={{ marginBottom: '12px', fontSize: '11px', color: 'rgba(92, 118, 143, 0.78)', lineHeight: 1.6 }}>
                已接入的插件能力：{pluginBackedActiveProviders.map((provider) => provider.label).join('、')}
              </div>
            )}
            <div style={{ marginBottom: candidatesExpanded ? '12px' : 0 }}>
              <button type="button" onClick={() => setCandidatesExpanded((value) => !value)} style={disclosureButtonStyle}>
                <span>{candidatesExpanded ? '收起' : '展开'}候选接入项</span>
                <span>{candidatesExpanded ? '▴' : '▾'}</span>
              </button>
            </div>
            {candidatesExpanded && (
              <div style={{ display: 'grid', gap: '10px' }}>
                {discoveredProviderCandidates.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'rgba(104, 132, 157, 0.72)' }}>
                    当前没有额外候选项。只要某个插件完成当前阶段的能力校验，它就会直接出现在上面的接入选择里。
                  </div>
                )}
                {discoveredProviderCandidates.map((provider) => (
                  <div
                    key={provider.providerId}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid rgba(138, 191, 230, 0.18)',
                      background: 'rgba(255,255,255,0.58)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>{provider.label}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(104, 132, 157, 0.72)' }}>
                          {provider.pluginId} · {renderProviderIdentity(provider.declaredProviderId, provider.manifestCapability)}
                        </div>
                      </div>
                      <span style={pillStyle(false, '#e7b36a', true)}>候选中</span>
                    </div>
                    <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(92, 118, 143, 0.8)' }}>
                      绑定能力：{renderRuntimeBindingLabel(provider.runtimeBinding)} · 来源：本地插件
                    </div>
                    {provider.description && (
                      <div
                        style={{
                          fontSize: '11px',
                          lineHeight: 1.5,
                          color: 'rgba(92, 118, 143, 0.8)',
                          marginTop: '4px',
                        }}
                      >
                        {provider.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div style={segmentedGridStyle}>
            <section ref={bindSectionRef('conversation')} style={compactSectionCardStyle}>
            <div style={sectionEyebrowStyle}>聊天</div>
              <div style={sectionTitleWrapStyle}>
                <div style={sectionHeadingMainStyle}>
                  <span style={sectionIconBubbleStyle('rgba(246, 195, 212, 0.22)', '#a9708b')}>✦</span>
                  <h4 style={sectionTitleStyle}>聊天能力</h4>
                </div>
                <span style={sectionMetaStyle}>{enabled ? '已启用' : '未启用'}</span>
              </div>
              <div style={sectionHintStyle}>让 bb7 接住聊天、文件投喂后的追问，以及更完整的上下文对话。</div>

              {renderToggleCard({
                checked: enabled,
                onToggle: () => setEnabled((value) => !value),
                title: '启用 AI 对话',
                description: '打开后，bb7 会从安静陪伴延伸到更完整的对话陪伴。',
                accentBackground: 'linear-gradient(135deg, rgba(125, 184, 232, 0.98), rgba(240, 183, 203, 0.96))',
                accentShadow: '0 8px 18px rgba(125, 184, 232, 0.18)',
              })}

              <div style={fieldClusterStyle}>
                <div style={labelStyle}>接口地址</div>
                <input
                  style={inputStyle}
                  value={endpoint}
                  onChange={(event) => setEndpoint(event.target.value)}
                  placeholder="例如 https://api.deepseek.com"
                />
                <div style={labelStyle}>密钥</div>
                <input
                  style={inputStyle}
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="sk-..."
                />
                <div style={labelStyle}>模型名</div>
                <input
                  style={inputStyle}
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="例如 deepseek-chat"
                />
              </div>
              <div
                style={{
                  marginTop: '2px',
                  padding: '12px',
                  borderRadius: '16px',
                  border:
                    aiHealth.ok === null
                      ? '1px solid rgba(138, 191, 230, 0.18)'
                      : aiHealth.ok
                        ? '1px solid rgba(142, 197, 236, 0.28)'
                        : '1px solid rgba(243, 160, 160, 0.3)',
                  background:
                    aiHealth.ok === null
                      ? 'rgba(255,255,255,0.62)'
                      : aiHealth.ok
                        ? 'rgba(245, 252, 255, 0.82)'
                        : 'rgba(255, 244, 244, 0.86)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#56728b' }}>当前接入状态</span>
                  <span
                    style={pillStyle(
                      aiHealth.ok === true,
                      aiHealth.ok === false ? '#f3a0a0' : '#8ec5ec',
                      true,
                    )}
                  >
                    {aiHealth.loading ? '检查中' : aiHealth.ok === true ? '已就绪' : aiHealth.ok === false ? '需要处理' : '未检查'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', lineHeight: 1.6, color: 'rgba(92, 118, 143, 0.84)' }}>{aiHealth.message}</div>
              </div>
            </section>

            <section ref={bindSectionRef('presence')} style={compactSectionCardStyle}>
            <div style={sectionEyebrowStyle}>存在感</div>
              <div style={sectionTitleWrapStyle}>
                <div style={sectionHeadingMainStyle}>
                  <span style={sectionIconBubbleStyle('rgba(203, 237, 222, 0.24)', '#648a78')}>◦</span>
                  <h4 style={sectionTitleStyle}>陪伴存在感</h4>
                </div>
                <span style={sectionMetaStyle}>{quietCompanionMode ? '更安静' : '标准陪伴'}</span>
              </div>
              <div style={sectionHintStyle}>控制 bb7 在桌面上的存在感，让它更贴着你当前的工作状态，而不是一直抢注意力。</div>

              {renderToggleCard({
                checked: quietCompanionMode,
                onToggle: () => setQuietCompanionMode((value) => !value),
                title: '低打扰模式',
                description: '会让 bb7 的动作更克制一点，待机更安静，也会减少突然打断你的频率。',
                accentBackground: 'linear-gradient(135deg, rgba(133, 200, 171, 0.96), rgba(180, 220, 200, 0.92))',
                accentShadow: '0 8px 18px rgba(133, 200, 171, 0.18)',
              })}

              <div style={{ ...fieldClusterStyle, marginBottom: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#4f6880' }}>当前氛围</div>
                <div style={{ fontSize: '12px', lineHeight: 1.7, color: 'rgba(92, 118, 143, 0.84)' }}>{presenceSummary}</div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ padding: '10px 12px', borderRadius: '14px', background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(138, 191, 230, 0.12)' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '4px' }}>动作表现</div>
                    <div style={{ fontSize: '12px', color: '#526a81', lineHeight: 1.6 }}>
                      {quietCompanionMode ? '微动作更轻，适合专注和长时间驻留。' : '存在感更明显，适合需要更活跃陪伴的时候。'}
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '14px', background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(138, 191, 230, 0.12)' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '4px' }}>主动互动</div>
                    <div style={{ fontSize: '12px', color: '#526a81', lineHeight: 1.6 }}>
                      {quietCompanionMode ? '主动打扰会更少，更像安静待在桌边。' : '会保留更自然的提醒和回应感。'}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section ref={bindSectionRef('rhythm')} style={compactSectionCardStyle}>
            <div style={sectionEyebrowStyle}>工作节奏</div>
            <div style={sectionTitleWrapStyle}>
              <div style={sectionHeadingMainStyle}>
                <span style={sectionIconBubbleStyle('rgba(185, 214, 247, 0.22)', '#5c7fa0')}>↺</span>
                <h4 style={sectionTitleStyle}>工作节奏</h4>
              </div>
              <span style={sectionMetaStyle}>{workEnabled ? renderPhaseLabel(workSnapshot.phase) : '未启用'}</span>
            </div>
            <div style={sectionHintStyle}>把专注、休息和过劳提醒收进同一条节奏里，让陪伴角色不只是聊天，也能稳住你的工作状态。</div>
            <div style={workSummaryStripStyle}>
              <div style={workSummaryCardStyle}>
                <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '5px' }}>当前节奏</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880', marginBottom: '4px' }}>
                  {workEnabled ? renderPhaseLabel(workSnapshot.phase) : '待命'}
                </div>
                <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'rgba(92, 118, 143, 0.82)' }}>{workModeCycleSummary}</div>
              </div>
              <div style={workSummaryCardStyle}>
                <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '5px' }}>过劳提醒</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880', marginBottom: '4px' }}>
                  {overworkReminderMinutes} 分钟
                </div>
                <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'rgba(92, 118, 143, 0.82)' }}>
                  长时间连续工作后，bb7 会更自然地提醒你缓一缓。
                </div>
              </div>
            </div>

            {renderToggleCard({
              checked: workEnabled,
              onToggle: () => setWorkEnabled((value) => !value),
              title: '启用专注与休息节奏',
              description: `当前阶段：${renderPhaseLabel(workSnapshot.phase)}`,
              accentBackground: 'linear-gradient(135deg, rgba(125, 184, 232, 0.98), rgba(183, 214, 245, 0.96))',
              accentShadow: '0 8px 18px rgba(125, 184, 232, 0.18)',
            })}

            <div style={compactGridStyle}>
              <div>
                <div style={labelStyle}>专注时长（分钟）</div>
                <input
                  style={inputStyle}
                  type="number"
                  min={15}
                  max={120}
                  value={focusMinutes}
                  onChange={(event) => setFocusMinutes(Number(event.target.value))}
                />
              </div>
              <div>
                <div style={labelStyle}>短休息时长（分钟）</div>
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  max={30}
                  value={shortBreakMinutes}
                  onChange={(event) => setShortBreakMinutes(Number(event.target.value))}
                />
              </div>
              <div>
                <div style={labelStyle}>长休息时长（分钟）</div>
                <input
                  style={inputStyle}
                  type="number"
                  min={5}
                  max={60}
                  value={longBreakMinutes}
                  onChange={(event) => setLongBreakMinutes(Number(event.target.value))}
                />
              </div>
              <div>
                <div style={labelStyle}>每几轮进入长休息</div>
                <input
                  style={inputStyle}
                  type="number"
                  min={2}
                  max={8}
                  value={longBreakEvery}
                  onChange={(event) => setLongBreakEvery(Number(event.target.value))}
                />
              </div>
            </div>

            <div style={labelStyle}>过劳提醒阈值（分钟）</div>
            <input
              style={inputStyle}
              type="number"
              min={30}
              max={240}
              value={overworkReminderMinutes}
              onChange={(event) => setOverworkReminderMinutes(Number(event.target.value))}
            />

            {renderToggleCard({
              checked: autoStartBreaks,
              onToggle: () => setAutoStartBreaks((value) => !value),
              title: '自动开始休息',
              description: '专注结束后，自动进入短休息或长休息。',
              accentBackground: 'linear-gradient(135deg, rgba(125, 184, 232, 0.98), rgba(240, 183, 203, 0.9))',
              accentShadow: '0 8px 18px rgba(125, 184, 232, 0.16)',
            })}

            {renderToggleCard({
              checked: autoStartFocus,
              onToggle: () => setAutoStartFocus((value) => !value),
              title: '自动开始下一轮专注',
              description: '休息结束后，自动把节奏重新续上。',
              accentBackground: 'linear-gradient(135deg, rgba(125, 184, 232, 0.98), rgba(240, 183, 203, 0.9))',
              accentShadow: '0 8px 18px rgba(125, 184, 232, 0.16)',
            })}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
              <button onClick={startFocus} style={quickButtonStyle}>
                开始专注
              </button>
              <button onClick={startBreak} style={quickButtonStyle}>
                开始休息
              </button>
              <button onClick={pauseWorkMode} style={quickButtonStyle}>
                暂停
              </button>
              <button onClick={resetWorkMode} style={quickButtonStyle}>
                重置
              </button>
            </div>
          </section>

          </div>

          <aside style={asideColumnStyle}>
            <section style={railCardStyle}>
              <div style={railCaptionStyle}>Companion Snapshot</div>
              <h4 style={railTitleStyle}>当前陪伴状态</h4>
              <div style={{ fontSize: '12px', lineHeight: 1.7, color: 'rgba(92, 118, 143, 0.82)', marginTop: '8px' }}>
                这里收的是 bb7 现在给人的整体感觉，方便你一边调整，一边确认它在桌面上的气质有没有跑偏。
              </div>

              <div style={railPreviewWrapStyle}>
                <div style={railPreviewShellStyle}>
                  {selectedPetMeta?.previewImageUrl ? (
                    <img
                      src={selectedPetMeta.previewImageUrl}
                      alt={selectedPetDisplayName}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        imageRendering: 'pixelated',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div style={previewFallbackStyle}>{selectedPetDisplayName.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#49657f' }}>{selectedPetDisplayName}</div>
                    <span style={pillStyle(true, selectedPetMeta?.accentColor ?? '#8ec5ec', true)}>
                      {quietCompanionMode ? '安静陪伴' : '标准陪伴'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(104, 132, 157, 0.72)', lineHeight: 1.6 }}>
                    {selectedPetMeta ? `${renderPetSourceLabel(selectedPetMeta.source)} · ${selectedPetMeta.renderer}` : '默认桌面角色'}
                  </div>
                  <div style={{ fontSize: '12px', lineHeight: 1.7, color: 'rgba(79, 104, 128, 0.88)', marginTop: '8px' }}>
                    {selectedPetSummary}
                  </div>
                </div>
              </div>

              <div style={railMetricGridStyle}>
                <div style={railMetricCardStyle}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)', marginBottom: '6px' }}>
                    聊天状态
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#4f6880', marginBottom: '4px' }}>{aiStatusLabel}</div>
                  <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'rgba(92, 118, 143, 0.82)' }}>{aiStatusSummary}</div>
                </div>
                <div style={railMetricCardStyle}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(103, 128, 151, 0.58)', marginBottom: '6px' }}>
                    节奏状态
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#4f6880', marginBottom: '4px' }}>
                    {workEnabled ? renderPhaseLabel(workSnapshot.phase) : '待命'}
                  </div>
                  <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'rgba(92, 118, 143, 0.82)' }}>{workModeCycleSummary}</div>
                </div>
              </div>

              <div style={railLineListStyle}>
                <div style={railLineStyle}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '3px' }}>当前角色能力</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>{capabilityLine}</div>
                  </div>
                  <span style={pillStyle(true, selectedPetMeta?.accentColor ?? '#8ec5ec', false)}>
                    {capabilitySummary.length > 0 ? `${capabilitySummary.length} 项` : '基础'}
                  </span>
                </div>
                <div style={railLineStyle}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '3px' }}>能力接入</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>{providerConnectionSummary}</div>
                  </div>
                  <span style={pillStyle(providerConnectedCount > 0, '#8ec5ec', providerConnectedCount > 0)}>
                    {providerConnectedCount} / 3
                  </span>
                </div>
                <div style={{ ...railLineStyle, borderBottom: 'none', paddingBottom: 0 }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '3px' }}>预览同步</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>{previewModeLabel}</div>
                  </div>
                  <span style={pillStyle(hasPendingChanges, hasPendingChanges ? '#e7b36a' : '#8ec5ec', true)}>
                    {hasPendingChanges ? '预览同步中' : '正式生效'}
                  </span>
                </div>
              </div>
            </section>

            <section style={railCardStyle}>
              <div style={railCaptionStyle}>运行环境</div>
              <h4 style={railTitleStyle}>接入与运行摘要</h4>
              <div style={railLineListStyle}>
                <div style={railLineStyle}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '3px' }}>本地插件</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>
                      {localPlugins.length > 0 ? `发现 ${localPlugins.length} 个插件` : '还没有发现插件'}
                    </div>
                  </div>
                  <span style={pillStyle(validPluginCount > 0, '#8ec5ec', validPluginCount > 0)}>{validPluginCount} 可用</span>
                </div>
                <div style={railLineStyle}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '3px' }}>候选接入项</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>
                      {discoveredProviderCandidates.length > 0 ? `${discoveredProviderCandidates.length} 个待接入` : '没有额外候选项'}
                    </div>
                  </div>
                  <span style={pillStyle(discoveredProviderCandidates.length > 0, '#e7b36a', discoveredProviderCandidates.length > 0)}>
                    {discoveredProviderCandidates.length}
                  </span>
                </div>
                <div style={{ ...railLineStyle, borderBottom: 'none', paddingBottom: 0 }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '3px' }}>需要留意</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>
                      {pluginIssueCount > 0 ? `${pluginIssueCount} 处接入问题待处理` : '当前没有明显接入问题'}
                    </div>
                  </div>
                  <span style={pillStyle(pluginIssueCount === 0, pluginIssueCount > 0 ? '#f3a0a0' : '#8ec5ec', true)}>
                    {pluginIssueCount > 0 ? '待处理' : '稳定'}
                  </span>
                </div>
              </div>
            </section>

            <section style={railCardStyle}>
              <div style={railCaptionStyle}>快捷操作</div>
              <h4 style={railTitleStyle}>常用操作</h4>
              <div style={{ fontSize: '12px', lineHeight: 1.7, color: 'rgba(92, 118, 143, 0.82)', marginTop: '8px', marginBottom: '12px' }}>
                不想翻完整页的时候，可以先从这里快速调整，确认桌面上的感觉对不对。
              </div>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.68)',
                  border: '1px solid rgba(138, 191, 230, 0.12)',
                  marginBottom: '12px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'rgba(103, 128, 151, 0.66)', marginBottom: '6px' }}>快捷操作</div>
                <div style={{ fontSize: '12px', lineHeight: 1.7, color: 'rgba(92, 118, 143, 0.82)' }}>
                  `Ctrl / Cmd + S` 直接应用改动，`Esc` 关闭设置页。
                </div>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                <button type="button" onClick={save} disabled={!hasPendingChanges} style={railActionPrimaryStyle}>
                  {hasPendingChanges ? '应用当前改动到 bb7' : '当前没有待应用改动'}
                </button>
                <button
                  type="button"
                  onClick={() => setQuietCompanionMode((value) => !value)}
                  style={railActionButtonStyle}
                >
                  {quietCompanionMode ? '切回标准陪伴' : '切到低打扰模式'}
                </button>
                <button type="button" onClick={onClose} style={railActionButtonStyle}>
                  关闭设置页
                </button>
              </div>
            </section>
          </aside>
        </div>

        <div style={panelFooterStyle}>
          <div style={footerStatusStyle}>
            {hasPendingChanges
              ? '有一些改动还没有保存，确认后会立即同步到 bb7。'
              : savePulseVisible
                ? `刚刚已经同步到 bb7${lastSavedAt ? ` · ${formatClockTime(lastSavedAt)}` : ''}`
                : '当前设置已经是最新状态。'}
            {hasPendingChanges && pendingChangeChips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {pendingChangeChips.slice(0, 3).map((item) => (
                  <span key={item} style={miniTagStyle}>
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={footerActionsStyle}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(138, 191, 230, 0.24)',
                background: 'rgba(255,255,255,0.72)',
                color: 'rgba(104, 132, 157, 0.76)',
                cursor: 'pointer',
                width: isTightPanel ? '100%' : 'auto',
              }}
            >
              取消
            </button>
            <button
              onClick={save}
              disabled={!hasPendingChanges}
              style={{
                padding: '10px 18px',
                borderRadius: '12px',
                border: 'none',
                background: hasPendingChanges
                  ? 'linear-gradient(135deg, #7db8e8, #f0b7cb)'
                  : 'linear-gradient(135deg, rgba(157, 189, 214, 0.88), rgba(221, 199, 208, 0.88))',
                color: '#fff',
                cursor: hasPendingChanges ? 'pointer' : 'default',
                fontWeight: 700,
                boxShadow: hasPendingChanges ? '0 12px 24px rgba(125, 184, 232, 0.24)' : 'none',
                opacity: hasPendingChanges ? 1 : 0.82,
                width: isTightPanel ? '100%' : 'auto',
              }}
            >
              {hasPendingChanges ? '应用到 bb7' : '已同步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ProviderCandidateHint: React.FC<{
  candidates: DiscoveredPluginProviderCandidate[]
  helperStyle: React.CSSProperties
  listStyle: React.CSSProperties
  cardStyle: React.CSSProperties
}> = ({ candidates, helperStyle, listStyle, cardStyle }) => {
  if (candidates.length === 0) {
    return null
  }

  return (
    <div style={helperStyle}>
      <div>已经发现候选接入项，但它们现在还不能直接在这里启用。</div>
      <div style={listStyle}>
        {candidates.map((candidate) => (
          <div key={candidate.providerId} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: '#56728b' }}>{candidate.label}</span>
              <span style={{ color: '#b58545', fontWeight: 700 }}>候选中</span>
            </div>
            <div>
              {candidate.pluginName} · {renderProviderIdentity(candidate.declaredProviderId, candidate.manifestCapability)}
            </div>
            <div>{candidate.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatCapabilityLabel(name: string): string {
  const normalized = name.replace(/([A-Z])/g, ' $1').trim().toLowerCase()

  switch (normalized) {
    case 'ai chat':
    case 'aichat':
      return 'AI 对话'
    case 'file analysis':
    case 'fileanalysis':
      return '文件分析'
    case 'screen perception':
    case 'screenperception':
      return '屏幕感知'
    case 'document analysis':
    case 'document-analysis':
      return '文档分析'
    case 'ai provider':
    case 'ai-provider':
      return 'AI 提供器'
    case 'memory':
      return '长期记忆'
    case 'proactive interaction':
    case 'proactiveinteraction':
      return '主动互动'
    case 'work mode':
    case 'work-mode':
      return '工作节奏'
    case 'pet behavior':
    case 'pet-behavior':
      return '宠物行为扩展'
    case 'ui extension':
    case 'ui-extension':
      return '界面扩展'
    case 'context classifier':
    case 'context-classifier':
      return '上下文识别'
    default:
      return name.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
  }
}

function renderPetSourceLabel(source: string): string {
  return source === 'built-in' ? '内置角色' : '导入角色'
}

function renderPackageStageLabel(stage: string): string {
  switch (stage.toLowerCase()) {
    case 'stable':
      return '稳定'
    case 'preview':
      return '预览'
    case 'beta':
      return '测试中'
    case 'experimental':
      return '实验中'
    case 'production-ready':
      return '可正式使用'
    case 'hybrid':
      return '混合资源'
    case 'placeholder-runtime':
      return '占位运行态'
    default:
      return stage
  }
}

function renderPhaseLabel(phase: string): string {
  switch (phase) {
    case 'focus':
      return '专注中'
    case 'short_break':
      return '短休息'
    case 'long_break':
      return '长休息'
    case 'paused':
      return '已暂停'
    default:
      return '待命'
  }
}

function renderPluginRuntimeLabel(status: 'not_loaded' | 'loaded' | 'load_failed'): string {
  switch (status) {
    case 'loaded':
      return '已加载'
    case 'load_failed':
      return '加载失败'
    default:
      return '未加载'
  }
}

function renderRuntimeBindingLabel(binding: 'aiChat' | 'fileAnalysis' | 'screenPerception' | null): string {
  if (!binding) {
    return '尚未绑定'
  }

  return formatCapabilityLabel(binding)
}

function renderCapabilityStatusLabel(status: 'ready' | 'planned' | 'unknown'): string {
  switch (status) {
    case 'ready':
      return '可用'
    case 'planned':
      return '规划中'
    default:
      return '未知'
  }
}

function renderPluginCapabilityLabel(capability: string): string {
  return formatCapabilityLabel(capability)
}

function renderProviderIdentity(providerId: string, manifestCapability?: string | null): string {
  const capabilityLabel = manifestCapability ? formatCapabilityLabel(manifestCapability) : null
  if (!capabilityLabel) {
    return providerId
  }

  return `${capabilityLabel} · ${providerId}`
}

function renderPluginPermissionLabel(permission: string): string {
  switch (permission) {
    case 'fs.read.user-selected':
      return '读取用户主动选择的文件'
    case 'ai.provider.invoke':
      return '调用外部 AI 提供器'
    case 'screen.read.summary':
      return '读取屏幕摘要信息'
    default:
      return permission
  }
}

function renderPluginTokenList(
  tokens: string[],
  renderer: (token: string) => string,
  fallback: string,
): string {
  if (tokens.length === 0) {
    return fallback
  }

  return tokens.map((token) => renderer(token)).join('、')
}

function resolveAiHealthTone(aiHealth: { loading: boolean; ok: boolean | null }) {
  if (aiHealth.loading) {
    return {
      background: 'rgba(255,255,255,0.74)',
      border: '1px solid rgba(138, 191, 230, 0.18)',
      color: '#6b87a1',
    }
  }

  if (aiHealth.ok === true) {
    return {
      background: 'rgba(240, 250, 255, 0.88)',
      border: '1px solid rgba(125, 184, 232, 0.24)',
      color: '#5d819c',
    }
  }

  if (aiHealth.ok === false) {
    return {
      background: 'rgba(255, 244, 244, 0.9)',
      border: '1px solid rgba(243, 160, 160, 0.28)',
      color: '#a86e6e',
    }
  }

  return {
    background: 'rgba(255,255,255,0.74)',
    border: '1px solid rgba(138, 191, 230, 0.18)',
    color: '#6b87a1',
  }
}

function resolveWorkModeTone(enabled: boolean, phase: string) {
  if (!enabled) {
    return {
      background: 'rgba(255,255,255,0.74)',
      border: '1px solid rgba(138, 191, 230, 0.18)',
      color: '#6b87a1',
    }
  }

  if (phase === 'focus') {
    return {
      background: 'rgba(240, 249, 255, 0.88)',
      border: '1px solid rgba(125, 184, 232, 0.24)',
      color: '#5d819c',
    }
  }

  if (phase === 'short_break' || phase === 'long_break') {
    return {
      background: 'rgba(255, 248, 240, 0.9)',
      border: '1px solid rgba(240, 194, 150, 0.26)',
      color: '#9c7d5d',
    }
  }

  return {
    background: 'rgba(247, 244, 255, 0.88)',
    border: '1px solid rgba(196, 178, 235, 0.22)',
    color: '#75639c',
  }
}

function resolveSaveFeedbackTone(hasPendingChanges: boolean, savePulseVisible: boolean) {
  if (savePulseVisible) {
    return {
      background: 'rgba(240, 250, 255, 0.92)',
      border: '1px solid rgba(125, 184, 232, 0.22)',
      color: '#5e819c',
    }
  }

  if (hasPendingChanges) {
    return {
      background: 'rgba(255, 248, 240, 0.92)',
      border: '1px solid rgba(240, 194, 150, 0.22)',
      color: '#9c7d5d',
    }
  }

  return {
    background: 'rgba(255,255,255,0.74)',
    border: '1px solid rgba(138, 191, 230, 0.18)',
    color: '#6b87a1',
  }
}

function pillStyle(selected: boolean, accentColor: string | null, strong: boolean): React.CSSProperties {
  return {
    padding: '4px 8px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.2px',
    color: strong ? '#ffffff' : '#5f7992',
    background: strong
      ? (accentColor ?? '#8ec5ec')
      : (selected ? 'rgba(142, 197, 236, 0.16)' : 'rgba(138, 191, 230, 0.1)'),
  }
}

function sectionIconBubbleStyle(background: string, color: string): React.CSSProperties {
  return {
    width: '22px',
    height: '22px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    background,
    color,
    fontSize: '12px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.36)',
    flex: '0 0 auto',
  }
}

function formatClockTime(value: number): string {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return formatter.format(value)
}

const miniTagStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: '999px',
  background: 'rgba(138, 191, 230, 0.1)',
  color: '#62809d',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.2px',
}

function previewFrameStyle(selected: boolean, accentColor: string | null): React.CSSProperties {
  return {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    overflow: 'hidden',
    flex: '0 0 auto',
    border: selected
      ? `1px solid ${accentColor ?? 'rgba(142, 197, 236, 0.52)'}`
      : '1px solid rgba(138, 191, 230, 0.18)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(240,247,255,0.92))',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.42)',
  }
}

const previewFallbackStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#7090ad',
  fontSize: '18px',
  fontWeight: 700,
  letterSpacing: '0.4px',
}

export default AISettingsPanel
