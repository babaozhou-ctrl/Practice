export type PluginManifestCapability =
  | 'ai-provider'
  | 'document-analysis'
  | 'screen-perception'
  | 'work-mode'
  | 'pet-behavior'
  | 'ui-extension'
  | 'context-classifier'

export type PluginRuntimeCompatibilityStatus = 'ready' | 'planned' | 'unknown'

export interface PluginCapabilityCompatibility {
  capability: string
  runtimeBinding: string | null
  status: PluginRuntimeCompatibilityStatus
  summary: string
}

const KNOWN_CAPABILITIES: Record<PluginManifestCapability, Omit<PluginCapabilityCompatibility, 'capability'>> = {
  'ai-provider': {
    runtimeBinding: 'aiChat',
    status: 'ready',
    summary: '可以对齐到现有 AI provider 抽象。',
  },
  'document-analysis': {
    runtimeBinding: 'fileAnalysis',
    status: 'ready',
    summary: '可以对齐到现有文件分析 provider 抽象。',
  },
  'screen-perception': {
    runtimeBinding: 'screenPerception',
    status: 'ready',
    summary: '可以对齐到现有 screen perception provider 抽象。',
  },
  'work-mode': {
    runtimeBinding: null,
    status: 'planned',
    summary: '架构方向已预留，但当前还没有正式的 work-mode 插件执行入口。',
  },
  'pet-behavior': {
    runtimeBinding: null,
    status: 'planned',
    summary: '后续会接到 companion behavior / proactive policy 扩展点。',
  },
  'ui-extension': {
    runtimeBinding: null,
    status: 'planned',
    summary: '后续会接到独立 UI 扩展区域，而不是直接侵入核心面板。',
  },
  'context-classifier': {
    runtimeBinding: null,
    status: 'planned',
    summary: '后续会接到 context classifier pipeline。',
  },
}

export function describePluginCapabilities(capabilities: string[]): PluginCapabilityCompatibility[] {
  return capabilities.map((capability) => {
    const mapped = KNOWN_CAPABILITIES[capability as PluginManifestCapability]
    if (!mapped) {
      return {
        capability,
        runtimeBinding: null,
        status: 'unknown',
        summary: '当前运行时还不认识这个 capability，需要补映射或扩展契约。',
      }
    }

    return {
      capability,
      runtimeBinding: mapped.runtimeBinding,
      status: mapped.status,
      summary: mapped.summary,
    }
  })
}
