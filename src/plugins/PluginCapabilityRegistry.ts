import { DeepSeekChatProvider } from '../ai/providers/DeepSeekChatProvider'
import { ScreenAnalyzer } from '../context/ScreenAnalyzer'
import { FileAnalyzer } from '../services/fileAnalyzer'
import type { ScreenCaptureConfig } from '../types/context'
import type {
  AIChatProvider,
  CapabilityProviderRegistration,
  FileAnalysisProvider,
  PluginCapabilityProvider,
  ProviderDescriptor,
  ScreenPerceptionProvider,
} from './types'
import { describePluginCapabilities } from './runtime/capabilityMap'
import type { DiscoveredPluginProviderCandidate, PluginDiscoveryRecord } from './runtime/types'

const defaultScreenCaptureConfig: ScreenCaptureConfig = {
  enabled: false,
  interval: 5000,
  ocrEnabled: false,
  localVisionEnabled: false,
  cloudVisionEnabled: false,
}

const aiChatProvider = new DeepSeekChatProvider()
const fileAnalyzer = new FileAnalyzer()
const screenAnalyzer = new ScreenAnalyzer(defaultScreenCaptureConfig)

const registrations = new Map<string, CapabilityProviderRegistration>()
const discoveredProviderDescriptors = new Map<string, ProviderDescriptor>()
const discoveredProviderCandidates = new Map<string, DiscoveredPluginProviderCandidate>()
const autoRegisteredPluginProviderIds = new Set<string>()

registerCapabilityProvider({
  descriptor: {
    id: 'builtin.ai-chat.deepseek',
    label: 'DeepSeek Companion Chat',
    capability: 'aiChat',
    kind: 'builtin',
    availability: 'active',
    description: 'Streaming companion chat and AI-backed document summaries through a unified provider contract.',
  },
  aiChatProvider,
})

registerCapabilityProvider({
  descriptor: {
    id: 'builtin.file-analysis.default',
    label: 'Built-in File Analyzer',
    capability: 'fileAnalysis',
    kind: 'builtin',
    availability: 'active',
    description: 'Reads text-like files and prepares a lightweight summary for companion chat.',
  },
  fileAnalysisProvider: createBuiltinFileAnalysisProvider(),
})

registerCapabilityProvider({
  descriptor: {
    id: 'builtin.screen-perception.placeholder',
    label: 'Built-in Screen Perception Placeholder',
    capability: 'screenPerception',
    kind: 'builtin',
    availability: 'active',
    description: 'Placeholder screen-perception backend reserved for future OCR and vision flows.',
  },
  screenPerceptionProvider: {
    id: 'builtin.screen-perception.placeholder',
    label: 'Built-in Screen Perception Placeholder',
    captureScreenshot() {
      return screenAnalyzer.captureScreenshot()
    },
    analyzeWithOCR(imageData) {
      return screenAnalyzer.analyzeWithOCR(imageData)
    },
    analyzeWithLocalVision(imageData) {
      return screenAnalyzer.analyzeWithLocalVision(imageData)
    },
    analyzeWithCloudVision(imageData) {
      return screenAnalyzer.analyzeWithCloudVision(imageData)
    },
  },
})

export function registerCapabilityProvider(registration: CapabilityProviderRegistration) {
  const descriptor = {
    ...registration.descriptor,
    availability: 'active' as const,
  }

  if (descriptor.capability === 'aiChat' && !registration.aiChatProvider) {
    throw new Error(`Provider ${descriptor.id} is missing an aiChatProvider implementation.`)
  }
  if (descriptor.capability === 'fileAnalysis' && !registration.fileAnalysisProvider) {
    throw new Error(`Provider ${descriptor.id} is missing a fileAnalysisProvider implementation.`)
  }
  if (descriptor.capability === 'screenPerception' && !registration.screenPerceptionProvider) {
    throw new Error(`Provider ${descriptor.id} is missing a screenPerceptionProvider implementation.`)
  }

  registrations.set(descriptor.id, {
    ...registration,
    descriptor,
  })
}

export function unregisterCapabilityProvider(providerId: string) {
  registrations.delete(providerId)
  autoRegisteredPluginProviderIds.delete(providerId)
}

export function reconcileDiscoveredPluginProviders(plugins: PluginDiscoveryRecord[]) {
  clearAutoRegisteredPluginProviders()
  discoveredProviderDescriptors.clear()
  discoveredProviderCandidates.clear()

  for (const plugin of plugins) {
    if (plugin.status !== 'valid' || plugin.runtimeStatus === 'load_failed') {
      continue
    }

    const candidates = deriveProviderCandidatesFromPlugin(plugin)
    for (const candidate of candidates) {
      if (tryActivateDiscoveredPluginProvider(candidate)) {
        continue
      }

      discoveredProviderCandidates.set(candidate.providerId, candidate)
      discoveredProviderDescriptors.set(candidate.providerId, {
        id: candidate.providerId,
        label: candidate.label,
        capability: candidate.runtimeBinding,
        kind: 'plugin',
        availability: 'discovered',
        description: candidate.description,
      })
    }
  }
}

export function listProviderDescriptors(
  capability?: PluginCapabilityProvider,
  options: { includeDiscovered?: boolean } = {},
): ProviderDescriptor[] {
  const active = Array.from(registrations.values()).map((registration) => registration.descriptor)
  const discovered = options.includeDiscovered
    ? Array.from(discoveredProviderDescriptors.values())
    : []

  return [...active, ...discovered]
    .filter((descriptor) => !capability || descriptor.capability === capability)
    .sort((left, right) => {
      const leftRank = left.availability === 'discovered' ? 1 : 0
      const rightRank = right.availability === 'discovered' ? 1 : 0
      if (leftRank !== rightRank) {
        return leftRank - rightRank
      }
      return left.label.localeCompare(right.label)
    })
}

export function listDiscoveredProviderCandidates(
  capability?: PluginCapabilityProvider,
): DiscoveredPluginProviderCandidate[] {
  return Array.from(discoveredProviderCandidates.values())
    .filter((candidate) => !capability || candidate.runtimeBinding === capability)
    .filter((candidate) => !isRegisteredProvider(candidate.runtimeBinding, candidate.providerId))
}

export function listPluginBackedProviderDescriptors(
  capability?: PluginCapabilityProvider,
): ProviderDescriptor[] {
  return Array.from(registrations.values())
    .map((registration) => registration.descriptor)
    .filter((descriptor) => descriptor.kind === 'plugin')
    .filter((descriptor) => !capability || descriptor.capability === capability)
    .sort((left, right) => left.label.localeCompare(right.label))
}

export function isRegisteredProvider(capability: PluginCapabilityProvider, providerId: string): boolean {
  const registration = registrations.get(providerId)
  return Boolean(registration && registration.descriptor.capability === capability)
}

export function getDefaultProviderId(capability: PluginCapabilityProvider): string {
  const descriptor = listProviderDescriptors(capability)[0]
  if (!descriptor) {
    throw new Error(`No registered providers found for capability "${capability}".`)
  }
  return descriptor.id
}

export function normalizeProviderId(
  capability: PluginCapabilityProvider,
  providerId: string | null | undefined,
): string {
  if (providerId && isRegisteredProvider(capability, providerId)) {
    return providerId
  }
  return getDefaultProviderId(capability)
}

export function resolveFileAnalysisProvider(providerId?: string): FileAnalysisProvider {
  const normalizedId = normalizeProviderId('fileAnalysis', providerId)
  const registration = registrations.get(normalizedId)
  if (!registration?.fileAnalysisProvider) {
    throw new Error(`No file analysis provider registered for id "${normalizedId}".`)
  }
  return registration.fileAnalysisProvider
}

export function resolveAIChatProvider(providerId?: string): AIChatProvider {
  const normalizedId = normalizeProviderId('aiChat', providerId)
  const registration = registrations.get(normalizedId)
  if (!registration?.aiChatProvider) {
    throw new Error(`No AI chat provider registered for id "${normalizedId}".`)
  }
  return registration.aiChatProvider
}

export function resolveScreenPerceptionProvider(providerId?: string): ScreenPerceptionProvider {
  const normalizedId = normalizeProviderId('screenPerception', providerId)
  const registration = registrations.get(normalizedId)
  if (!registration?.screenPerceptionProvider) {
    throw new Error(`No screen perception provider registered for id "${normalizedId}".`)
  }
  return registration.screenPerceptionProvider
}

function createBuiltinFileAnalysisProvider(): FileAnalysisProvider {
  return {
    id: 'builtin.file-analysis.default',
    label: 'Built-in File Analyzer',
    readFile(file) {
      return fileAnalyzer.readFile(file)
    },
    async summarize(request) {
      return fileAnalyzer.summarize(request)
    },
  }
}

function clearAutoRegisteredPluginProviders() {
  for (const providerId of autoRegisteredPluginProviderIds) {
    registrations.delete(providerId)
  }
  autoRegisteredPluginProviderIds.clear()
}

function tryActivateDiscoveredPluginProvider(
  candidate: DiscoveredPluginProviderCandidate,
): boolean {
  if (candidate.runtimeBinding !== 'fileAnalysis') {
    return false
  }

  registerCapabilityProvider({
    descriptor: {
      id: candidate.providerId,
      label: candidate.label,
      capability: 'fileAnalysis',
      kind: 'plugin',
      availability: 'active',
      description:
        `${candidate.pluginName} is connected as a selectable file-analysis provider. ` +
        'This phase routes file extraction through the built-in reader, while summary generation can already be delegated to the plugin runtime.',
    },
    fileAnalysisProvider: {
      id: candidate.providerId,
      label: candidate.label,
      readFile(file) {
        return fileAnalyzer.readFile(file)
      },
      async summarize(request) {
        if (!window.electronAPI?.runPluginFileAnalysis) {
          return fileAnalyzer.summarize(request)
        }

        try {
          return await window.electronAPI.runPluginFileAnalysis({
            providerId: candidate.providerId,
            fileName: request.fileName,
            content: request.content,
          })
        } catch {
          return fileAnalyzer.summarize(request)
        }
      },
    },
  })

  autoRegisteredPluginProviderIds.add(candidate.providerId)
  return true
}

function deriveProviderCandidatesFromPlugin(
  plugin: PluginDiscoveryRecord,
): DiscoveredPluginProviderCandidate[] {
  if (plugin.providers.length > 0) {
    return plugin.providers.map((provider) => ({
      providerId: `plugin-candidate.${plugin.id}.${provider.id}`,
      pluginId: plugin.id,
      pluginName: plugin.name,
      declaredProviderId: provider.id,
      manifestCapability: provider.manifestCapability ?? provider.capability,
      runtimeBinding: provider.capability,
      label: provider.label,
      description:
        provider.description ??
        `${plugin.name} 声明了一个 ${provider.capability} provider 候选，但还没有真正注册可执行实现。`,
    }))
  }

  return describePluginCapabilities(plugin.capabilities)
    .filter(isReadyProviderCapability)
    .map((item) => ({
      providerId: `plugin-candidate.${plugin.id}.${item.runtimeBinding}`,
      pluginId: plugin.id,
      pluginName: plugin.name,
      declaredProviderId: item.capability,
      manifestCapability: item.capability,
      runtimeBinding: item.runtimeBinding,
      label: `${plugin.name} (${item.runtimeBinding})`,
      description: `${plugin.name} 声明了 ${item.capability}，已经能和当前 ${item.runtimeBinding} provider 契约对齐，但还没有真正注册成可执行实现。`,
    }))
}

function isReadyProviderCapability(
  item: ReturnType<typeof describePluginCapabilities>[number],
): item is ReturnType<typeof describePluginCapabilities>[number] & {
  runtimeBinding: 'aiChat' | 'fileAnalysis' | 'screenPerception'
  status: 'ready'
} {
  return item.status === 'ready' && item.runtimeBinding !== null
}
