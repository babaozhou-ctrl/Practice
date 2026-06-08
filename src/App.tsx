import React, { useEffect, useState } from 'react'

import ChatPanel from './components/chat/ChatPanel'
import PrivacyIndicator from './components/status/PrivacyIndicator'
import { useChatStore } from './store/chatStore'
import {
  ensureCompanionPreferencesStoreSubscription,
  useCompanionPreferencesStore,
} from './store/companionPreferencesStore'
import {
  listDiscoveredProviderCandidates,
  listPluginBackedProviderDescriptors,
  listProviderDescriptors,
} from './plugins/PluginCapabilityRegistry'
import { ensurePluginProviderStoreSubscription, usePluginProviderStore } from './plugins/PluginProviderStore'
import { describePluginCapabilities } from './plugins/runtime/capabilityMap'
import { ensureLocalPluginDiscoveryHydration, useLocalPluginDiscoveryStore } from './plugins/runtime/LocalPluginDiscoveryStore'
import type { DiscoveredPluginProviderCandidate } from './plugins/runtime/types'
import { ensureSelectedPetCapabilitySubscription } from './store/selectedPetCapabilityStore'
import { usePetStore } from './store/petStore'
import { ensureSelectedPetStoreSubscription, useSelectedPetStore } from './store/selectedPetStore'
import { resolveSelectedPetCapabilities } from './pets/resolveSelectedPetCapabilities'
import { ensureWorkModeStoreSubscription, useWorkModeStore } from './store/workModeStore'
import { useContextAwareness } from './hooks/useContextAwareness'

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
  const capabilitySummary = Object.entries(resolveSelectedPetCapabilities())
    .filter(([, enabled]) => enabled)
    .map(([name]) => name.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()))
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

  const save = () => {
    selectPet(petId)
    setProvider('aiChat', selectedAiProviderId)
    setProvider('fileAnalysis', selectedFileProviderId)
    setProvider('screenPerception', selectedScreenProviderId)
    setConfig({ endpoint, apiKey, model, enabled })
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

  const ov: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10001,
  }
  const pn: React.CSSProperties = {
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
  const lb: React.CSSProperties = {
    fontSize: '12px',
    color: 'rgba(104, 132, 157, 0.72)',
    marginBottom: '4px',
  }
  const inp: React.CSSProperties = {
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
  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  }
  const sectionTitle: React.CSSProperties = {
    margin: '18px 0 10px',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.3px',
    color: '#56728b',
  }
  const quickButton: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(138, 191, 230, 0.24)',
    background: 'rgba(255,255,255,0.72)',
    color: '#56728b',
    fontSize: '12px',
    cursor: 'pointer',
  }
  const helperText: React.CSSProperties = {
    marginTop: '-6px',
    marginBottom: '12px',
    fontSize: '11px',
    color: 'rgba(104, 132, 157, 0.72)',
    lineHeight: 1.6,
  }
  const candidateList: React.CSSProperties = {
    display: 'grid',
    gap: '8px',
    marginTop: '8px',
  }
  const candidateCard: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid rgba(138, 191, 230, 0.16)',
    background: 'rgba(255,255,255,0.5)',
  }

  return (
    <div style={ov} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} style={pn}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>Companion Settings</h3>

        <div style={sectionTitle}>Companion Package</div>
        <div style={lb}>Current desktop companion</div>
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
                  boxShadow: selected
                    ? '0 12px 28px rgba(116, 148, 181, 0.16)'
                    : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
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
                        <div style={previewFallbackStyle}>
                          {pet.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#4f6880' }}>
                        {pet.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(104, 132, 157, 0.72)' }}>
                        {pet.source === 'built-in' ? 'Built-in' : 'Imported'} · {pet.renderer}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {pet.packageStage && (
                      <span style={pillStyle(selected, pet.accentColor, false)}>
                        {pet.packageStage}
                      </span>
                    )}
                    {selected && (
                      <span style={pillStyle(selected, pet.accentColor, true)}>
                        Current
                      </span>
                    )}
                  </div>
                </div>

                {pet.summary && (
                  <div style={{ fontSize: '12px', lineHeight: 1.55, color: 'rgba(79, 104, 128, 0.88)', marginBottom: '8px' }}>
                    {pet.summary}
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: pet.capabilities.length > 0 ? '8px' : 0 }}>
                  {pet.tags.slice(0, 4).map((tag) => (
                    <span key={tag} style={miniTagStyle}>
                      {tag}
                    </span>
                  ))}
                  {pet.archetype && (
                    <span style={miniTagStyle}>
                      {pet.archetype}
                    </span>
                  )}
                </div>

                {pet.capabilities.length > 0 && (
                  <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(104, 132, 157, 0.76)' }}>
                    Capabilities: {pet.capabilities.join(', ')}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        <div style={{ marginBottom: '12px', fontSize: '12px', color: 'rgba(104, 132, 157, 0.72)', lineHeight: 1.5 }}>
          Active capabilities: {capabilitySummary.join(', ')}
        </div>

        <div style={sectionTitle}>Capability Providers</div>
        <div style={lb}>AI Chat Provider</div>
        <select
          style={inp}
          value={selectedAiProviderId}
          onChange={(event) => setSelectedAiProviderId(event.target.value)}
        >
          {aiProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
        <ProviderCandidateHint
          candidates={discoveredAiProviders}
          helperStyle={helperText}
          listStyle={candidateList}
          cardStyle={candidateCard}
        />
        <div style={lb}>File Analysis Provider</div>
        <select
          style={inp}
          value={selectedFileProviderId}
          onChange={(event) => setSelectedFileProviderId(event.target.value)}
        >
          {fileProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>
        <ProviderCandidateHint
          candidates={discoveredFileProviders}
          helperStyle={helperText}
          listStyle={candidateList}
          cardStyle={candidateCard}
        />
        <div style={lb}>Screen Perception Provider</div>
        <select
          style={inp}
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
          helperStyle={helperText}
          listStyle={candidateList}
          cardStyle={candidateCard}
        />

        <div style={sectionTitle}>Local Plugins</div>
        <div style={{ marginBottom: '12px', fontSize: '12px', color: 'rgba(104, 132, 157, 0.72)', lineHeight: 1.6 }}>
          这里先展示本地 `plugins/` 目录里发现到的插件 manifest。当前阶段只做发现与校验，还不会执行插件代码。
        </div>
        <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
          {localPlugins.length === 0 && (
            <div style={{ fontSize: '12px', color: 'rgba(104, 132, 157, 0.72)' }}>
              当前还没有发现本地插件。
            </div>
          )}
          {localPlugins.map((plugin) => (
            <div
              key={`${plugin.directoryName}-${plugin.id}`}
              style={{
                padding: '12px 14px',
                borderRadius: '14px',
                border: plugin.status === 'valid'
                  ? '1px solid rgba(138, 191, 230, 0.22)'
                  : '1px solid rgba(255, 159, 159, 0.3)',
                background: plugin.status === 'valid'
                  ? 'rgba(255,255,255,0.6)'
                  : 'rgba(255, 241, 241, 0.75)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>
                    {plugin.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(104, 132, 157, 0.72)' }}>
                    {plugin.id} · v{plugin.version}
                  </div>
                </div>
                <span style={pillStyle(plugin.status === 'valid', plugin.status === 'valid' ? '#8ec5ec' : '#f3a0a0', true)}>
                  {plugin.status === 'valid' ? 'Valid' : 'Invalid'}
                </span>
              </div>
              <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(92, 118, 143, 0.8)', marginBottom: '6px' }}>
                Entry: {plugin.entry} · API: {plugin.apiVersion ?? 'unknown'}
              </div>
              <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(92, 118, 143, 0.8)', marginBottom: '6px' }}>
                Capabilities: {plugin.capabilities.join(', ') || 'none'} · Permissions: {plugin.permissions.join(', ') || 'none'}
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
                          {item.capability}
                        </span>
                        <span style={pillStyle(item.status === 'ready', item.status === 'ready' ? '#8ec5ec' : item.status === 'planned' ? '#e7b36a' : '#b7b7b7', true)}>
                          {item.status === 'ready' ? 'Ready' : item.status === 'planned' ? 'Planned' : 'Unknown'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(92, 118, 143, 0.8)' }}>
                        {item.runtimeBinding ? `Runtime binding: ${item.runtimeBinding}。` : ''}
                        {item.summary}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {plugin.errors.length > 0 && (
                <div style={{ fontSize: '11px', lineHeight: 1.6, color: '#b86565' }}>
                  {plugin.errors.join(' ')}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={sectionTitle}>Provider Candidates</div>
        <div style={{ marginBottom: '12px', fontSize: '12px', color: 'rgba(104, 132, 157, 0.72)', lineHeight: 1.6 }}>
          下面这些是已经能和当前 provider 契约对齐的插件候选，但现在还没有真正注册成可执行 provider。
        </div>
        {pluginBackedActiveProviders.length > 0 && (
          <div style={{ marginBottom: '12px', fontSize: '11px', color: 'rgba(92, 118, 143, 0.78)', lineHeight: 1.6 }}>
            已接入的插件 provider：{pluginBackedActiveProviders.map((provider) => provider.label).join(', ')}
          </div>
        )}
        <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
          {discoveredProviderCandidates.length === 0 && (
            <div style={{ fontSize: '12px', color: 'rgba(104, 132, 157, 0.72)' }}>
              当前没有剩余的未接入候选；如果插件已经通过当前阶段的契约检查，它会直接出现在上面的 provider 选择器里。
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
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880' }}>
                    {provider.label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(104, 132, 157, 0.72)' }}>
                    {provider.pluginId} · {provider.declaredProviderId}
                  </div>
                </div>
                <span style={pillStyle(false, '#e7b36a', true)}>
                  Candidate
                </span>
              </div>
              <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(92, 118, 143, 0.8)' }}>
                Capability: {provider.runtimeBinding} · Source: plugin
              </div>
              {provider.description && (
                <div style={{ fontSize: '11px', lineHeight: 1.5, color: 'rgba(92, 118, 143, 0.8)', marginTop: '4px' }}>
                  {provider.description}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={sectionTitle}>AI Chat</div>
        <div style={row}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            style={{ accentColor: '#8ec5ec' }}
          />
          <label style={{ fontSize: '13px' }}>Enable AI chat</label>
        </div>
        <div style={lb}>Endpoint</div>
        <input style={inp} value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
        <div style={lb}>API Key</div>
        <input
          style={inp}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="sk-..."
        />
        <div style={lb}>Model</div>
        <input style={inp} value={model} onChange={(event) => setModel(event.target.value)} />

        <div style={sectionTitle}>Companion Presence</div>
        <div style={row}>
          <input
            type="checkbox"
            checked={quietCompanionMode}
            onChange={(event) => setQuietCompanionMode(event.target.checked)}
            style={{ accentColor: '#8ec5ec' }}
          />
          <label style={{ fontSize: '13px' }}>Low-distraction mode</label>
        </div>
        <div style={{ marginBottom: '12px', fontSize: '12px', color: 'rgba(104, 132, 157, 0.72)', lineHeight: 1.5 }}>
          Keeps the companion smaller-feeling in motion, reduces idle animation energy, and makes proactive interruptions rarer.
        </div>

        <div style={sectionTitle}>Work Companion Mode</div>
        <div style={row}>
          <input
            type="checkbox"
            checked={workEnabled}
            onChange={(event) => setWorkEnabled(event.target.checked)}
            style={{ accentColor: '#8ec5ec' }}
          />
          <label style={{ fontSize: '13px' }}>Enable focus and break rhythm</label>
        </div>

        <div style={{ ...lb, marginTop: 6 }}>Current phase</div>
        <div style={{ marginBottom: '12px', fontSize: '13px', color: '#56728b' }}>
          {renderPhaseLabel(workSnapshot.phase)}
        </div>

        <div style={lb}>Focus minutes</div>
        <input
          style={inp}
          type="number"
          min={15}
          max={120}
          value={focusMinutes}
          onChange={(event) => setFocusMinutes(Number(event.target.value))}
        />
        <div style={lb}>Short break minutes</div>
        <input
          style={inp}
          type="number"
          min={1}
          max={30}
          value={shortBreakMinutes}
          onChange={(event) => setShortBreakMinutes(Number(event.target.value))}
        />
        <div style={lb}>Long break minutes</div>
        <input
          style={inp}
          type="number"
          min={5}
          max={60}
          value={longBreakMinutes}
          onChange={(event) => setLongBreakMinutes(Number(event.target.value))}
        />
        <div style={lb}>Long break every N focus sessions</div>
        <input
          style={inp}
          type="number"
          min={2}
          max={8}
          value={longBreakEvery}
          onChange={(event) => setLongBreakEvery(Number(event.target.value))}
        />
        <div style={lb}>Overwork reminder after minutes</div>
        <input
          style={inp}
          type="number"
          min={30}
          max={240}
          value={overworkReminderMinutes}
          onChange={(event) => setOverworkReminderMinutes(Number(event.target.value))}
        />

        <div style={row}>
          <input
            type="checkbox"
            checked={autoStartBreaks}
            onChange={(event) => setAutoStartBreaks(event.target.checked)}
            style={{ accentColor: '#8ec5ec' }}
          />
          <label style={{ fontSize: '13px' }}>Auto-start breaks</label>
        </div>
        <div style={row}>
          <input
            type="checkbox"
            checked={autoStartFocus}
            onChange={(event) => setAutoStartFocus(event.target.checked)}
            style={{ accentColor: '#8ec5ec' }}
          />
          <label style={{ fontSize: '13px' }}>Auto-start next focus</label>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <button onClick={startFocus} style={quickButton}>Start Focus</button>
          <button onClick={startBreak} style={quickButton}>Start Break</button>
          <button onClick={pauseWorkMode} style={quickButton}>Pause</button>
          <button onClick={resetWorkMode} style={quickButton}>Reset</button>
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
            Cancel
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
            Save
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
      <div>已发现候选 provider，但它们现在还不能直接在这里被选中。</div>
      <div style={listStyle}>
        {candidates.map((candidate) => (
          <div key={candidate.providerId} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: '#56728b' }}>{candidate.label}</span>
              <span style={{ color: '#b58545', fontWeight: 700 }}>Candidate</span>
            </div>
            <div>{candidate.pluginName} · {candidate.declaredProviderId}</div>
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
  }, [])

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

function renderPhaseLabel(phase: string): string {
  switch (phase) {
    case 'focus':
      return 'Focusing'
    case 'short_break':
      return 'Short Break'
    case 'long_break':
      return 'Long Break'
    case 'paused':
      return 'Paused'
    default:
      return 'Idle'
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
