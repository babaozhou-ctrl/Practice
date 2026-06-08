export interface PluginDiscoveryRecord {
  id: string
  name: string
  version: string
  entry: string
  capabilities: string[]
  permissions: string[]
  apiVersion: string | null
  source: 'local'
  directoryName: string
  manifestPath: string
  status: 'valid' | 'invalid'
  errors: string[]
}
