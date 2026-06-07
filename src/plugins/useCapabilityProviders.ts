import { resolveAIChatProvider, resolveFileAnalysisProvider, resolveScreenPerceptionProvider } from './PluginCapabilityRegistry'
import { usePluginProviderStore } from './PluginProviderStore'

export function useCapabilityProviders() {
  const aiChatProviderId = usePluginProviderStore((state) => state.aiChatProviderId)
  const fileAnalysisProviderId = usePluginProviderStore((state) => state.fileAnalysisProviderId)
  const screenPerceptionProviderId = usePluginProviderStore((state) => state.screenPerceptionProviderId)

  return {
    aiChat: resolveAIChatProvider(aiChatProviderId),
    fileAnalysis: resolveFileAnalysisProvider(fileAnalysisProviderId),
    screenPerception: resolveScreenPerceptionProvider(screenPerceptionProviderId),
  }
}
