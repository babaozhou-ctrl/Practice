import React, { useEffect, useState } from 'react'

import ChatPanel from './components/chat/ChatPanel'
import PrivacyIndicator from './components/status/PrivacyIndicator'
import { useContextAwareness } from './hooks/useContextAwareness'
import {
  listDiscoveredProviderCandidates,
  listPluginBackedProviderDescriptors,
  listProviderDescriptors,
  resolveAIChatProvider,
} from './plugins/PluginCapabilityRegistry'
import { ensurePluginProviderStoreSubscription, usePluginProviderStore } from './plugins/PluginProviderStore'
import { describePluginCapabilities } from './plugins/runtime/capabilityMap'
import { ensureLocalPluginDiscoveryHydration, useLocalPluginDiscoveryStore } from './plugins/runtime/LocalPluginDiscoveryStore'
import type { DiscoveredPluginProviderCandidate } from './plugins/runtime/types'
import { resolveSelectedPetCapabilities } from './pets/resolveSelectedPetCapabilities'
import { useChatStore } from './store/chatStore'
import {
  ensureCompanionPreferencesStoreSubscription,
  useCompanionPreferencesStore,
} from './store/companionPreferencesStore'
import { usePetStore } from './store/petStore'
import { ensureSelectedPetCapabilitySubscription } from './store/selectedPetCapabilityStore'
import { ensureSelectedPetStoreSubscription, useSelectedPetStore } from './store/selectedPetStore'
import { ensureWorkModeStoreSubscription, useWorkModeStore } from './store/workModeStore'

const AISettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { config, setConfig } = useChatStore()
  const availablePets = useSelectedPetStore((state) => state.availablePets)
  const selectedPetId = useSelectedPetStore((state) => state.selectedPetId)
  const selectPet = useSelectedPetStore((state) => state.selectPet)
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
  const [aiHealth, setAiHealth] = useState<{ loading: boolean; ok: boolean | null; message: string }>({
    loading: false,
    ok: null,
    message: '还没有检查当前聊天接入状态。',
  })

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

    void checkHealth()

    return () => {
      cancelled = true
    }
  }, [apiKey, config, enabled, endpoint, model, selectedAiProviderId])

  const save = () => {
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
    onClose()
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10001,
  }

  const panelStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, rgba(255, 252, 247, 0.96), rgba(243, 249, 255, 0.92))',
    backdropFilter: 'blur(16px)',
    borderRadius: '18px',
    padding: '24px',
    width: '420px',
    maxHeight: '80vh',
    overflowY: 'auto',
    color: '#49657f',
    border: '1px solid rgba(138, 191, 230, 0.28)',
    boxShadow: '0 18px 42px rgba(74, 102, 128, 0.18)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'rgba(104, 132, 157, 0.72)',
    marginBottom: '4px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(138, 191, 230, 0.28)',
    background: 'rgba(255,255,255,0.72)',
    color: '#49657f',
    fontSize: '13px',
    marginBottom: '12px',
    outline: 'none',
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  }

  const sectionTitleStyle: React.CSSProperties = {
    margin: '18px 0 10px',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.3px',
    color: '#56728b',
  }

  const quickButtonStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(138, 191, 230, 0.24)',
    background: 'rgba(255,255,255,0.72)',
    color: '#56728b',
    fontSize: '12px',
    cursor: 'pointer',
  }

  const helperTextStyle: React.CSSProperties = {
    marginTop: '-6px',
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
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid rgba(138, 191, 230, 0.16)',
    background: 'rgba(255,255,255,0.5)',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} style={panelStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>陪伴设置</h3>

        <div style={sectionTitleStyle}>当前角色</div>
        <div style={labelStyle}>选择现在留在桌面上的陪伴角色</div>
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
                  borderRadius: '14px',
                  border: selected
                    ? `1px solid ${pet.accentColor ?? 'rgba(142, 197, 236, 0.52)'}`
                    : '1px solid rgba(138, 191, 230, 0.16)',
                  background: selected
                    ? 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(240,247,255,0.92))'
                    : 'rgba(255,255,255,0.62)',
                  cursor: 'pointer',
                  boxShadow: selected ? '0 12px 28px rgba(116, 148, 181, 0.16)' : 'none',
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
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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

        <div
          style={{
            marginBottom: '12px',
            fontSize: '12px',
            color: 'rgba(104, 132, 157, 0.72)',
            lineHeight: 1.5,
          }}
        >
          当前角色能力：{capabilitySummary.length > 0 ? capabilitySummary.join('、') : '基础陪伴'}
        </div>

        <div style={sectionTitleStyle}>能力接入</div>
        <div style={labelStyle}>聊天接入</div>
        <select style={inputStyle} value={selectedAiProviderId} onChange={(event) => setSelectedAiProviderId(event.target.value)}>
          {aiProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
        <ProviderCandidateHint
          candidates={discoveredAiProviders}
          helperStyle={helperTextStyle}
          listStyle={candidateListStyle}
          cardStyle={candidateCardStyle}
        />

        <div style={labelStyle}>文件分析接入</div>
        <select style={inputStyle} value={selectedFileProviderId} onChange={(event) => setSelectedFileProviderId(event.target.value)}>
          {fileProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
        <ProviderCandidateHint
          candidates={discoveredFileProviders}
          helperStyle={helperTextStyle}
          listStyle={candidateListStyle}
          cardStyle={candidateCardStyle}
        />

        <div style={labelStyle}>屏幕感知接入</div>
        <select
          style={inputStyle}
          value={selectedScreenProviderId}
          onChange={(event) => setSelectedScreenProviderId(event.target.value)}
        >
          {screenProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
        <ProviderCandidateHint
          candidates={discoveredScreenProviders}
          helperStyle={helperTextStyle}
          listStyle={candidateListStyle}
          cardStyle={candidateCardStyle}
        />

        <div style={sectionTitleStyle}>本地插件</div>
        <div
          style={{
            marginBottom: '12px',
            fontSize: '12px',
            color: 'rgba(104, 132, 157, 0.72)',
            lineHeight: 1.6,
          }}
        >
          这里会显示 `plugins/` 目录里发现的本地插件，以及它们现在是否已经接入 bb7 的能力链路。
        </div>
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

        <div style={sectionTitleStyle}>候选接入项</div>
        <div
          style={{
            marginBottom: '12px',
            fontSize: '12px',
            color: 'rgba(104, 132, 157, 0.72)',
            lineHeight: 1.6,
          }}
        >
          下面这些插件已经声明了对应能力，但还没走完整条接入链路，所以暂时不会直接出现在上面的接入选择里。
        </div>
        {pluginBackedActiveProviders.length > 0 && (
          <div style={{ marginBottom: '12px', fontSize: '11px', color: 'rgba(92, 118, 143, 0.78)', lineHeight: 1.6 }}>
            已接入的插件能力：{pluginBackedActiveProviders.map((provider) => provider.label).join('、')}
          </div>
        )}
        <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
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

        <div style={sectionTitleStyle}>聊天能力</div>
        <div style={rowStyle}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            style={{ accentColor: '#8ec5ec' }}
          />
          <label style={{ fontSize: '13px' }}>启用 AI 对话</label>
        </div>
        <div style={labelStyle}>Endpoint</div>
        <input style={inputStyle} value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
        <div style={labelStyle}>API Key</div>
        <input
          style={inputStyle}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="sk-..."
        />
        <div style={labelStyle}>Model</div>
        <input style={inputStyle} value={model} onChange={(event) => setModel(event.target.value)} />
        <div
          style={{
            marginTop: '-4px',
            marginBottom: '14px',
            padding: '10px 12px',
            borderRadius: '12px',
            border:
              aiHealth.ok === null
                ? '1px solid rgba(138, 191, 230, 0.18)'
                : aiHealth.ok
                  ? '1px solid rgba(142, 197, 236, 0.28)'
                  : '1px solid rgba(243, 160, 160, 0.3)',
            background:
              aiHealth.ok === null
                ? 'rgba(255,255,255,0.52)'
                : aiHealth.ok
                  ? 'rgba(245, 252, 255, 0.78)'
                  : 'rgba(255, 244, 244, 0.82)',
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

        <div style={sectionTitleStyle}>陪伴存在感</div>
        <div style={rowStyle}>
          <input
            type="checkbox"
            checked={quietCompanionMode}
            onChange={(event) => setQuietCompanionMode(event.target.checked)}
            style={{ accentColor: '#8ec5ec' }}
          />
          <label style={{ fontSize: '13px' }}>低打扰模式</label>
        </div>
        <div style={{ marginBottom: '12px', fontSize: '12px', color: 'rgba(104, 132, 157, 0.72)', lineHeight: 1.5 }}>
          会让 bb7 的动作更克制一点，待机更安静，也会减少突然打断你的频率。
        </div>

        <div style={sectionTitleStyle}>工作节奏</div>
        <div style={rowStyle}>
          <input
            type="checkbox"
            checked={workEnabled}
            onChange={(event) => setWorkEnabled(event.target.checked)}
            style={{ accentColor: '#8ec5ec' }}
          />
          <label style={{ fontSize: '13px' }}>启用专注与休息节奏</label>
        </div>

        <div style={{ ...labelStyle, marginTop: 6 }}>当前阶段</div>
        <div style={{ marginBottom: '12px', fontSize: '13px', color: '#56728b' }}>{renderPhaseLabel(workSnapshot.phase)}</div>

        <div style={labelStyle}>专注时长（分钟）</div>
        <input
          style={inputStyle}
          type="number"
          min={15}
          max={120}
          value={focusMinutes}
          onChange={(event) => setFocusMinutes(Number(event.target.value))}
        />
        <div style={labelStyle}>短休息时长（分钟）</div>
        <input
          style={inputStyle}
          type="number"
          min={1}
          max={30}
          value={shortBreakMinutes}
          onChange={(event) => setShortBreakMinutes(Number(event.target.value))}
        />
        <div style={labelStyle}>长休息时长（分钟）</div>
        <input
          style={inputStyle}
          type="number"
          min={5}
          max={60}
          value={longBreakMinutes}
          onChange={(event) => setLongBreakMinutes(Number(event.target.value))}
        />
        <div style={labelStyle}>每几轮专注进入一次长休息</div>
        <input
          style={inputStyle}
          type="number"
          min={2}
          max={8}
          value={longBreakEvery}
          onChange={(event) => setLongBreakEvery(Number(event.target.value))}
        />
        <div style={labelStyle}>过劳提醒阈值（分钟）</div>
        <input
          style={inputStyle}
          type="number"
          min={30}
          max={240}
          value={overworkReminderMinutes}
          onChange={(event) => setOverworkReminderMinutes(Number(event.target.value))}
        />

        <div style={rowStyle}>
          <input
            type="checkbox"
            checked={autoStartBreaks}
            onChange={(event) => setAutoStartBreaks(event.target.checked)}
            style={{ accentColor: '#8ec5ec' }}
          />
          <label style={{ fontSize: '13px' }}>自动开始休息</label>
        </div>
        <div style={rowStyle}>
          <input
            type="checkbox"
            checked={autoStartFocus}
            onChange={(event) => setAutoStartFocus(event.target.checked)}
            style={{ accentColor: '#8ec5ec' }}
          />
          <label style={{ fontSize: '13px' }}>自动开始下一轮专注</label>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
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

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(138, 191, 230, 0.24)',
              background: 'transparent',
              color: 'rgba(104, 132, 157, 0.76)',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={save}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #8ec5ec, #f6c3d4)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            保存
          </button>
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

const App: React.FC = () => {
  const isChatOpen = usePetStore((state) => state.isChatOpen)
  const toggleChat = usePetStore((state) => state.toggleChat)
  const setChatOpen = usePetStore((state) => state.setChatOpen)
  const [showSettings, setShowSettings] = useState(false)

  useContextAwareness()

  useEffect(() => {
    ensureWorkModeStoreSubscription()
    ensureCompanionPreferencesStoreSubscription()
    ensureSelectedPetStoreSubscription()
    ensureSelectedPetCapabilitySubscription()
    ensurePluginProviderStoreSubscription()
    useWorkModeStore.getState().hydrate()
    useCompanionPreferencesStore.getState().hydrate()
    void useSelectedPetStore.getState().hydrate()
    usePluginProviderStore.getState().hydrate()
    void ensureLocalPluginDiscoveryHydration()
  }, [])

  useEffect(() => {
    if (window.electronAPI?.onShowSettings) {
      window.electronAPI.onShowSettings(() => setShowSettings(true))
    }
    if (window.electronAPI?.onShowChat) {
      window.electronAPI.onShowChat(() => setChatOpen(true))
    }
  }, [setChatOpen])

  useEffect(() => {
    const id = setInterval(() => usePetStore.getState().tickStatus(), 10000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'C') toggleChat()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleChat])

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body, #root {
        width: 100vw; height: 100vh; overflow: hidden;
        background: transparent;
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(138, 191, 230, 0.34); border-radius: 2px; }
      textarea::placeholder { color: rgba(104, 132, 157, 0.42); }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <>
      {isChatOpen && <ChatPanel onClose={toggleChat} />}
      <PrivacyIndicator />
      {showSettings && <AISettingsPanel onClose={() => setShowSettings(false)} />}
    </>
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

export default App
