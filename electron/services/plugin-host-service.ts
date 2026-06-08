import { readdir, readFile, stat } from 'fs/promises'
import { join, resolve } from 'path'

export interface PluginManifestRecord {
  id: string
  name: string
  version: string
  entry: string
  capabilities: string[]
  permissions: string[]
  apiVersion?: string
  providers?: PluginManifestProviderRecord[]
}

export interface PluginManifestProviderRecord {
  id: string
  capability: 'aiChat' | 'fileAnalysis' | 'screenPerception'
  manifestCapability?: string
  label: string
  description?: string
}

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
  errors: string[]
}

const PLUGINS_DIR = resolve(process.cwd(), 'plugins')
const SUPPORTED_PLUGIN_API_VERSIONS = new Set(['1.0.0'])

export async function listLocalPluginManifests(): Promise<PluginDiscoveryRecord[]> {
  let entries: Awaited<ReturnType<typeof readdir>> = []
  try {
    entries = await readdir(PLUGINS_DIR, { withFileTypes: true })
  } catch {
    return []
  }

  const discovered: PluginDiscoveryRecord[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const pluginDir = join(PLUGINS_DIR, entry.name)
    const manifestPath = join(pluginDir, 'manifest.json')
    discovered.push(await loadPluginManifestRecord(entry.name, manifestPath))
  }

  return discovered.sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'valid' ? -1 : 1
    }
    return left.name.localeCompare(right.name)
  })
}

async function loadPluginManifestRecord(
  directoryName: string,
  manifestPath: string,
): Promise<PluginDiscoveryRecord> {
  const base: PluginDiscoveryRecord = {
    id: `invalid.${directoryName}`,
    name: directoryName,
    version: 'unknown',
    entry: 'unknown',
    capabilities: [],
    permissions: [],
    apiVersion: null,
    providers: [],
    source: 'local',
    directoryName,
    manifestPath,
    status: 'invalid',
    errors: [],
  }

  const manifestExists = await fileExists(manifestPath)
  if (!manifestExists) {
    return {
      ...base,
      errors: ['缺少 manifest.json。'],
    }
  }

  let manifest: PluginManifestRecord
  try {
    const raw = await readFile(manifestPath, 'utf-8')
    manifest = JSON.parse(raw) as PluginManifestRecord
  } catch {
    return {
      ...base,
      errors: ['manifest.json 不是合法的 JSON。'],
    }
  }

  const errors = await validatePluginManifest(manifest, manifestPath)
  return {
    id: typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : base.id,
    name: typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim() : directoryName,
    version: typeof manifest.version === 'string' && manifest.version.trim() ? manifest.version.trim() : 'unknown',
    entry: typeof manifest.entry === 'string' && manifest.entry.trim() ? manifest.entry.trim() : 'unknown',
    capabilities: Array.isArray(manifest.capabilities) ? manifest.capabilities.filter(isNonEmptyString) : [],
    permissions: Array.isArray(manifest.permissions) ? manifest.permissions.filter(isNonEmptyString) : [],
    apiVersion: typeof manifest.apiVersion === 'string' && manifest.apiVersion.trim() ? manifest.apiVersion.trim() : null,
    providers: Array.isArray(manifest.providers)
      ? manifest.providers.filter(isPluginManifestProviderRecord).map((provider) => ({
          id: provider.id.trim(),
          capability: provider.capability,
          manifestCapability: isNonEmptyString(provider.manifestCapability) ? provider.manifestCapability.trim() : undefined,
          label: provider.label.trim(),
          description: isNonEmptyString(provider.description) ? provider.description.trim() : undefined,
        }))
      : [],
    source: 'local',
    directoryName,
    manifestPath,
    status: errors.length > 0 ? 'invalid' : 'valid',
    errors,
  }
}

async function validatePluginManifest(
  manifest: PluginManifestRecord,
  manifestPath: string,
): Promise<string[]> {
  const errors: string[] = []

  if (!isNonEmptyString(manifest.id)) {
    errors.push('插件 manifest 缺少非空的 id。')
  }
  if (!isNonEmptyString(manifest.name)) {
    errors.push('插件 manifest 缺少非空的 name。')
  }
  if (!isNonEmptyString(manifest.version)) {
    errors.push('插件 manifest 缺少非空的 version。')
  }
  if (!isNonEmptyString(manifest.entry)) {
    errors.push('插件 manifest 缺少非空的 entry。')
  }
  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
    errors.push('插件 manifest 至少要声明一个 capability。')
  }
  if (!Array.isArray(manifest.permissions)) {
    errors.push('插件 manifest 的 permissions 必须是数组。')
  }
  if (manifest.providers && !Array.isArray(manifest.providers)) {
    errors.push('插件 manifest 的 providers 必须是数组。')
  }

  if (manifest.apiVersion && !SUPPORTED_PLUGIN_API_VERSIONS.has(manifest.apiVersion)) {
    errors.push(`当前只支持 apiVersion=${Array.from(SUPPORTED_PLUGIN_API_VERSIONS).join(', ')}。`)
  }

  if (isNonEmptyString(manifest.entry)) {
    const pluginDir = resolve(manifestPath, '..')
    const entryPath = join(pluginDir, manifest.entry)
    if (!(await fileExists(entryPath))) {
      errors.push(`插件入口文件不存在：${manifest.entry}`)
    }
  }

  if (Array.isArray(manifest.providers)) {
    const providerIds = new Set<string>()
    for (const provider of manifest.providers) {
      if (!isPluginManifestProviderRecord(provider)) {
        errors.push('plugins.providers 里存在结构不完整的 provider 声明。')
        continue
      }

      if (providerIds.has(provider.id.trim())) {
        errors.push(`plugins.providers 里存在重复的 provider id：${provider.id}`)
      }
      providerIds.add(provider.id.trim())

      if (
        provider.manifestCapability &&
        Array.isArray(manifest.capabilities) &&
        !manifest.capabilities.includes(provider.manifestCapability)
      ) {
        errors.push(
          `provider "${provider.id}" 声明了 manifestCapability=${provider.manifestCapability}，但插件 capabilities 里没有它。`,
        )
      }
    }
  }

  return errors
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const result = await stat(path)
    return result.isFile()
  } catch {
    return false
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPluginManifestProviderRecord(value: unknown): value is PluginManifestProviderRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const provider = value as Partial<PluginManifestProviderRecord>
  return (
    isNonEmptyString(provider.id) &&
    isNonEmptyString(provider.label) &&
    (provider.capability === 'aiChat' ||
      provider.capability === 'fileAnalysis' ||
      provider.capability === 'screenPerception')
  )
}
