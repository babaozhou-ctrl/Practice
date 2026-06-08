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
    label: 'DeepSeek 陪伴对话',
    capability: 'aiChat',
    kind: 'builtin',
    availability: 'active',
    description: '用于陪伴对话和文件总结的内置 AI 接入。',
  },
  aiChatProvider,
})

registerCapabilityProvider({
  descriptor: {
    id: 'builtin.file-analysis.default',
    label: '内置文件分析',
    capability: 'fileAnalysis',
    kind: 'builtin',
    availability: 'active',
    description: '负责读取常见文本、代码和文档内容，并生成一版轻量整理。',
  },
  fileAnalysisProvider: createBuiltinFileAnalysisProvider(),
})

registerCapabilityProvider({
  descriptor: {
    id: 'builtin.screen-perception.placeholder',
    label: '内置屏幕感知',
    capability: 'screenPerception',
    kind: 'builtin',
    availability: 'active',
    description: '当前用于屏幕感知链路的内置接入，后续会继续补强 OCR 和视觉能力。',
  },
  screenPerceptionProvider: {
    id: 'builtin.screen-perception.placeholder',
    label: '内置屏幕感知',
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
    throw new Error(`能力提供器 ${descriptor.id} 缺少 AI 对话实现。`)
  }
  if (descriptor.capability === 'fileAnalysis' && !registration.fileAnalysisProvider) {
    throw new Error(`能力提供器 ${descriptor.id} 缺少文件分析实现。`)
  }
  if (descriptor.capability === 'screenPerception' && !registration.screenPerceptionProvider) {
    throw new Error(`能力提供器 ${descriptor.id} 缺少屏幕感知实现。`)
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
  const discovered = options.includeDiscovered ? Array.from(discoveredProviderDescriptors.values()) : []

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
    throw new Error(`当前没有找到可用的 ${capability} 能力接入。`)
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
    throw new Error(`没有找到可用的文件分析接入：${normalizedId}`)
  }
  return registration.fileAnalysisProvider
}

export function resolveAIChatProvider(providerId?: string): AIChatProvider {
  const normalizedId = normalizeProviderId('aiChat', providerId)
  const registration = registrations.get(normalizedId)
  if (!registration?.aiChatProvider) {
    throw new Error(`没有找到可用的 AI 对话接入：${normalizedId}`)
  }
  return registration.aiChatProvider
}

export function resolveScreenPerceptionProvider(providerId?: string): ScreenPerceptionProvider {
  const normalizedId = normalizeProviderId('screenPerception', providerId)
  const registration = registrations.get(normalizedId)
  if (!registration?.screenPerceptionProvider) {
    throw new Error(`没有找到可用的屏幕感知接入：${normalizedId}`)
  }
  return registration.screenPerceptionProvider
}

function createBuiltinFileAnalysisProvider(): FileAnalysisProvider {
  return {
    id: 'builtin.file-analysis.default',
    label: '内置文件分析',
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
  if (candidate.runtimeBinding === 'fileAnalysis') {
    registerCapabilityProvider({
      descriptor: {
        id: candidate.providerId,
        label: candidate.label,
        capability: 'fileAnalysis',
        kind: 'plugin',
        availability: 'active',
        description:
          `${candidate.pluginName} 已经接进文件分析选择里。` +
          '现阶段文件读取仍优先走内置读取器，但总结生成已经可以交给插件侧处理。',
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

  if (candidate.runtimeBinding === 'aiChat') {
    registerCapabilityProvider({
      descriptor: {
        id: candidate.providerId,
        label: candidate.label,
        capability: 'aiChat',
        kind: 'plugin',
        availability: 'active',
        description:
          `${candidate.pluginName} 已经接进 AI 对话选择里。` +
          '现阶段流式对话已经能走插件侧，文件总结在可用时也会优先交给插件处理。',
      },
      aiChatProvider: {
        id: candidate.providerId,
        label: candidate.label,
        async streamChat(request, callbacks) {
          if (!window.electronAPI?.runPluginAIChat) {
            return aiChatProvider.streamChat(request, callbacks)
          }

          try {
            return await window.electronAPI.runPluginAIChat(
              {
                requestId: request.requestId,
                providerId: candidate.providerId,
                config: request.config,
                systemPrompt: request.systemPrompt,
                messages: request.messages,
              },
              callbacks.onChunk,
            )
          } catch {
            return aiChatProvider.streamChat(request, callbacks)
          }
        },
        async summarizeDocument(request) {
          if (!window.electronAPI?.runPluginAISummary) {
            return aiChatProvider.summarizeDocument(request)
          }

          try {
            return await window.electronAPI.runPluginAISummary({
              providerId: candidate.providerId,
              config: request.config,
              fileName: request.fileName,
              content: request.content,
            })
          } catch {
            return aiChatProvider.summarizeDocument(request)
          }
        },
        async healthCheck(config) {
          if (!window.electronAPI?.runPluginAIHealthCheck) {
            return aiChatProvider.healthCheck(config)
          }

          try {
            return await window.electronAPI.runPluginAIHealthCheck({
              providerId: candidate.providerId,
              config,
            })
          } catch {
            return aiChatProvider.healthCheck(config)
          }
        },
      },
    })

    autoRegisteredPluginProviderIds.add(candidate.providerId)
    return true
  }

  if (candidate.runtimeBinding === 'screenPerception') {
    registerCapabilityProvider({
      descriptor: {
        id: candidate.providerId,
        label: candidate.label,
        capability: 'screenPerception',
        kind: 'plugin',
        availability: 'active',
        description:
          `${candidate.pluginName} 已经接进屏幕感知选择里。` +
          '屏幕捕捉和分析在可用时会优先走插件侧，内置接入继续作为兜底。',
      },
      screenPerceptionProvider: {
        id: candidate.providerId,
        label: candidate.label,
        async captureScreenshot() {
          if (!window.electronAPI?.runPluginScreenCapture) {
            return screenAnalyzer.captureScreenshot()
          }

          try {
            return await window.electronAPI.runPluginScreenCapture({
              providerId: candidate.providerId,
            })
          } catch {
            return screenAnalyzer.captureScreenshot()
          }
        },
        async analyzeWithOCR(imageData) {
          if (!window.electronAPI?.runPluginScreenOCR) {
            return screenAnalyzer.analyzeWithOCR(imageData)
          }

          try {
            return await window.electronAPI.runPluginScreenOCR({
              providerId: candidate.providerId,
              imageData,
            })
          } catch {
            return screenAnalyzer.analyzeWithOCR(imageData)
          }
        },
        async analyzeWithLocalVision(imageData) {
          if (!window.electronAPI?.runPluginScreenLocalVision) {
            return screenAnalyzer.analyzeWithLocalVision(imageData)
          }

          try {
            return await window.electronAPI.runPluginScreenLocalVision({
              providerId: candidate.providerId,
              imageData,
            })
          } catch {
            return screenAnalyzer.analyzeWithLocalVision(imageData)
          }
        },
        async analyzeWithCloudVision(imageData) {
          if (!window.electronAPI?.runPluginScreenCloudVision) {
            return screenAnalyzer.analyzeWithCloudVision(imageData)
          }

          try {
            return await window.electronAPI.runPluginScreenCloudVision({
              providerId: candidate.providerId,
              imageData,
            })
          } catch {
            return screenAnalyzer.analyzeWithCloudVision(imageData)
          }
        },
      },
    })

    autoRegisteredPluginProviderIds.add(candidate.providerId)
    return true
  }

  return false
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
        `${plugin.name} 里已经放了一个候选接入项，但现在还不能直接启用。`,
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
      label: `${plugin.name}（${renderManifestCapabilityLabel(item.capability)}）`,
      description: `${plugin.name} 已经声明了这项能力，也能对上当前能力链路，但现在还没有真正接成可用实现。`,
    }))
}

function renderManifestCapabilityLabel(capability: string): string {
  switch (capability) {
    case 'ai-provider':
      return 'AI 对话'
    case 'document-analysis':
      return '文件分析'
    case 'screen-perception':
      return '屏幕感知'
    case 'work-mode':
      return '工作节奏'
    case 'pet-behavior':
      return '宠物行为'
    case 'ui-extension':
      return '界面扩展'
    case 'context-classifier':
      return '上下文识别'
    default:
      return capability
  }
}

function isReadyProviderCapability(
  item: ReturnType<typeof describePluginCapabilities>[number],
): item is ReturnType<typeof describePluginCapabilities>[number] & {
  runtimeBinding: 'aiChat' | 'fileAnalysis' | 'screenPerception'
  status: 'ready'
} {
  return item.status === 'ready' && item.runtimeBinding !== null
}
