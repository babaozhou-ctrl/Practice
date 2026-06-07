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

registerCapabilityProvider({
  descriptor: {
    id: 'builtin.ai-chat.deepseek',
    label: 'DeepSeek Companion Chat',
    capability: 'aiChat',
    kind: 'builtin',
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
    description: 'Reads text-like files and prepares a lightweight summary for companion chat.',
  },
  fileAnalysisProvider: {
    id: 'builtin.file-analysis.default',
    label: 'Built-in File Analyzer',
    readFile(file) {
      return fileAnalyzer.readFile(file)
    },
    summarize(content) {
      return fileAnalyzer.summarize(content)
    },
  },
})

registerCapabilityProvider({
  descriptor: {
    id: 'builtin.screen-perception.placeholder',
    label: 'Built-in Screen Perception Placeholder',
    capability: 'screenPerception',
    kind: 'builtin',
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
  const { descriptor } = registration

  if (descriptor.capability === 'aiChat' && !registration.aiChatProvider) {
    throw new Error(`Provider ${descriptor.id} is missing an aiChatProvider implementation.`)
  }
  if (descriptor.capability === 'fileAnalysis' && !registration.fileAnalysisProvider) {
    throw new Error(`Provider ${descriptor.id} is missing a fileAnalysisProvider implementation.`)
  }
  if (descriptor.capability === 'screenPerception' && !registration.screenPerceptionProvider) {
    throw new Error(`Provider ${descriptor.id} is missing a screenPerceptionProvider implementation.`)
  }

  registrations.set(descriptor.id, registration)
}

export function unregisterCapabilityProvider(providerId: string) {
  registrations.delete(providerId)
}

export function listProviderDescriptors(capability?: PluginCapabilityProvider): ProviderDescriptor[] {
  return Array.from(registrations.values())
    .map((registration) => registration.descriptor)
    .filter((descriptor) => !capability || descriptor.capability === capability)
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
