import React, { useEffect, useState } from 'react'

import ChatPanel from './components/chat/ChatPanel'
import PrivacyIndicator from './components/status/PrivacyIndicator'
import { useChatStore } from './store/chatStore'
import {
  ensureCompanionPreferencesStoreSubscription,
  useCompanionPreferencesStore,
} from './store/companionPreferencesStore'
import { listProviderDescriptors } from './plugins/PluginCapabilityRegistry'
import { ensurePluginProviderStoreSubscription, usePluginProviderStore } from './plugins/PluginProviderStore'
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

  return (
    <div style={ov} onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} style={pn}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>Companion Settings</h3>

        <div style={sectionTitle}>Companion Package</div>
        <div style={lb}>Current desktop companion</div>
        <select
          style={inp}
          value={petId}
          onChange={(event) => setPetId(event.target.value)}
        >
          {availablePets.map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.name} {pet.packageStage ? `(${pet.packageStage})` : ''}
            </option>
          ))}
        </select>
        <div style={{ marginBottom: '12px', fontSize: '12px', color: 'rgba(104, 132, 157, 0.72)', lineHeight: 1.5 }}>
          Capabilities: {capabilitySummary.join(', ')}
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

export default App
