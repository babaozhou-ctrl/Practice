import React, { useEffect, useState } from 'react'

import ChatPanel from './components/chat/ChatPanel'
import CustomPetLoader from './components/pet/CustomPetLoader'
import AISettingsPanel from './components/settings/AISettingsPanel'
import PrivacyIndicator from './components/status/PrivacyIndicator'
import { useContextAwareness } from './hooks/useContextAwareness'
import { ensurePluginProviderStoreSubscription, usePluginProviderStore } from './plugins/PluginProviderStore'
import { ensureLocalPluginDiscoveryHydration } from './plugins/runtime/LocalPluginDiscoveryStore'
import { usePetStore } from './store/petStore'
import { ensureCompanionPreferencesStoreSubscription, useCompanionPreferencesStore } from './store/companionPreferencesStore'
import { ensureSelectedPetCapabilitySubscription } from './store/selectedPetCapabilityStore'
import { ensureSelectedPetStoreSubscription, useSelectedPetStore } from './store/selectedPetStore'
import { ensureWorkModeStoreSubscription, useWorkModeStore } from './store/workModeStore'

const App: React.FC = () => {
  const isChatOpen = usePetStore((state) => state.isChatOpen)
  const showCustomPetLoader = usePetStore((state) => state.showCustomPetLoader)
  const toggleChat = usePetStore((state) => state.toggleChat)
  const setChatOpen = usePetStore((state) => state.setChatOpen)
  const setShowCustomPetLoader = usePetStore((state) => state.setShowCustomPetLoader)
  const [showSettings, setShowSettings] = useState(false)

  const closeChat = () => {
    setChatOpen(false)
    window.electronAPI?.hideUIWindow?.()
  }

  const closeCustomPetLoader = () => {
    setShowCustomPetLoader(false)
  }

  const closeSettings = () => {
    setShowSettings(false)
    window.electronAPI?.hideUIWindow?.()
  }

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
    void usePluginProviderStore.getState().hydrate()
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
    let cancelled = false

    void (async () => {
      const flags = await window.electronAPI?.getRuntimeFlags?.()
      if (cancelled) return
      if (flags?.smokeTarget === 'feed' || flags?.scenario === 'stability-feed' || flags?.scenario === 'stability-chat') {
        setChatOpen(true)
        return
      }
      if (
        flags?.smokeTarget === 'settings' ||
        flags?.smokeTarget === 'workmode' ||
        flags?.scenario === 'stability-settings'
      ) {
        setShowSettings(true)
        return
      }
      if (flags?.smokeTarget === 'import' || flags?.scenario === 'stability-import') {
        setShowSettings(true)
        setShowCustomPetLoader(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [setChatOpen, setShowCustomPetLoader])

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
        font-family: 'Microsoft YaHei UI', 'PingFang SC', 'Segoe UI', system-ui, -apple-system, sans-serif;
        color: #49657f;
      }
      body {
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(138, 191, 230, 0.34); border-radius: 2px; }
      textarea::placeholder { color: rgba(104, 132, 157, 0.42); }
      input, textarea, select, button {
        font: inherit;
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  return (
    <>
      {isChatOpen && <ChatPanel onClose={closeChat} />}
      {showCustomPetLoader && <CustomPetLoader onClose={closeCustomPetLoader} />}
      <PrivacyIndicator />
      {showSettings && <AISettingsPanel onClose={closeSettings} />}
    </>
  )
}

export default App
