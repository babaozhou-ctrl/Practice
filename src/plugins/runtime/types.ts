export type PluginRuntimeStatus = 'not_loaded' | 'loaded' | 'load_failed'

export interface PluginDiscoveryRecord {
  id: string
  name: string
  version: string
  entry: string
  capabilities: string[]
  permissions: string[]
  apiVersion: string | null
  providers: PluginManifestProviderRecord[]
  source: 'local'
  directoryName: string
  manifestPath: string
  status: 'valid' | 'invalid'
  runtimeStatus: PluginRuntimeStatus
  errors: string[]
  runtimeErrors: string[]
}

export interface DiscoveredPluginProviderCandidate {
  providerId: string
  pluginId: string
  pluginName: string
  declaredProviderId: string
  manifestCapability: string
  runtimeBinding: 'aiChat' | 'fileAnalysis' | 'screenPerception'
  label: string
  description: string
}

export interface PluginManifestProviderRecord {
  id: string
  capability: 'aiChat' | 'fileAnalysis' | 'screenPerception'
  manifestCapability?: string
  label: string
  description?: string
}
