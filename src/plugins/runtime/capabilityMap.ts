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
  runtimeBinding: 'aiChat' | 'fileAnalysis' | 'screenPerception' | null
  status: PluginRuntimeCompatibilityStatus
  summary: string
}

const KNOWN_CAPABILITIES: Record<PluginManifestCapability, Omit<PluginCapabilityCompatibility, 'capability'>> = {
  'ai-provider': {
    runtimeBinding: 'aiChat',
    status: 'ready',
    summary: '已经可以接到现有的 AI 对话能力接口。',
  },
  'document-analysis': {
    runtimeBinding: 'fileAnalysis',
    status: 'ready',
    summary: '已经可以接到现有的文件分析能力接口。',
  },
  'screen-perception': {
    runtimeBinding: 'screenPerception',
    status: 'ready',
    summary: '已经可以接到现有的屏幕感知能力接口。',
  },
  'work-mode': {
    runtimeBinding: null,
    status: 'planned',
    summary: '架构方向已经预留，但现在还没有正式接入工作节奏插件。',
  },
  'pet-behavior': {
    runtimeBinding: null,
    status: 'planned',
    summary: '后续会接到陪伴行为和主动互动的扩展点。',
  },
  'ui-extension': {
    runtimeBinding: null,
    status: 'planned',
    summary: '后续会接到独立的界面扩展区域，不会直接挤进核心面板。',
  },
  'context-classifier': {
    runtimeBinding: null,
    status: 'planned',
    summary: '后续会接到上下文识别链路。',
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
        summary: '当前还识别不了这项能力，需要后续补上映射。',
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
