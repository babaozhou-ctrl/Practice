import { pathToFileURL } from 'url'
import { readdir, readFile, stat } from 'fs/promises'
import { dirname, join, resolve } from 'path'

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

interface LoadedPluginRecord {
  discovery: PluginDiscoveryRecord
  entryPath: string
  module: PluginModuleShape | null
}

interface PluginFileAnalysisRequest {
  providerId: string
  fileName: string
  content: string
}

interface PluginFileAnalysisContext {
  providerId: string
  pluginId: string
  pluginName: string
  fileName: string
}

interface PluginFileAnalysisApi {
  summarize?: (
    content: string,
    context: PluginFileAnalysisContext,
  ) => Promise<string> | string
}

interface PluginProvidersApi {
  fileAnalysis?: Record<string, PluginFileAnalysisApi | undefined>
}

interface PluginModuleShape {
  providers?: PluginProvidersApi
  default?: {
    providers?: PluginProvidersApi
  }
}

const PLUGINS_DIR = resolve(process.cwd(), 'plugins')
const SUPPORTED_PLUGIN_API_VERSIONS = new Set(['1.0.0'])
const loadedPlugins = new Map<string, LoadedPluginRecord>()

export async function listLocalPluginManifests(): Promise<PluginDiscoveryRecord[]> {
  let entries: Awaited<ReturnType<typeof readdir>> = []
  try {
    entries = await readdir(PLUGINS_DIR, { withFileTypes: true })
  } catch {
    loadedPlugins.clear()
    return []
  }

  const discovered: PluginDiscoveryRecord[] = []
  const nextLoadedPlugins = new Map<string, LoadedPluginRecord>()

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const pluginDir = join(PLUGINS_DIR, entry.name)
    const manifestPath = join(pluginDir, 'manifest.json')
    const record = await loadPluginManifestRecord(entry.name, manifestPath)
    discovered.push(record)

    if (record.status !== 'valid') {
      continue
    }

    const entryPath = join(pluginDir, record.entry)
    const loaded = await loadPluginModule(record, entryPath)
    nextLoadedPlugins.set(record.id, loaded)
  }

  loadedPlugins.clear()
  for (const [pluginId, loaded] of nextLoadedPlugins.entries()) {
    loadedPlugins.set(pluginId, loaded)
  }

  return discovered.sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'valid' ? -1 : 1
    }
    return left.name.localeCompare(right.name)
  })
}

export async function runPluginFileAnalysis(
  request: PluginFileAnalysisRequest,
): Promise<string> {
  const loadedPlugin = findLoadedPluginByProviderId(request.providerId)
  if (!loadedPlugin) {
    throw new Error(`未找到 provider=${request.providerId} 对应的已加载插件。`)
  }

  const providerKey = getDeclaredProviderId(request.providerId)
  const pluginProviders = getPluginProviders(loadedPlugin.module)
  const fileAnalysisProvider = pluginProviders.fileAnalysis?.[providerKey]
  if (!fileAnalysisProvider?.summarize) {
    throw new Error(`插件 ${loadedPlugin.discovery.name} 没有实现 fileAnalysis provider "${providerKey}" 的 summarize。`)
  }

  const result = await fileAnalysisProvider.summarize(request.content, {
    providerId: request.providerId,
    pluginId: loadedPlugin.discovery.id,
    pluginName: loadedPlugin.discovery.name,
    fileName: request.fileName,
  })

  const normalized = typeof result === 'string' ? result.trim() : ''
  if (!normalized) {
    throw new Error(`插件 ${loadedPlugin.discovery.name} 返回了空的文件摘要。`)
  }

  return normalized
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
    const pluginDir = dirname(manifestPath)
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

async function loadPluginModule(
  discovery: PluginDiscoveryRecord,
  entryPath: string,
): Promise<LoadedPluginRecord> {
  try {
    const moduleUrl = pathToFileURL(entryPath).href
    const imported = await import(moduleUrl)
    return {
      discovery,
      entryPath,
      module: imported as PluginModuleShape,
    }
  } catch (error: any) {
    return {
      discovery: {
        ...discovery,
        status: 'invalid',
        errors: [...discovery.errors, `插件入口加载失败：${error?.message ?? String(error)}`],
      },
      entryPath,
      module: null,
    }
  }
}

function findLoadedPluginByProviderId(providerId: string): LoadedPluginRecord | null {
  const declaredProviderId = getDeclaredProviderId(providerId)

  for (const loaded of loadedPlugins.values()) {
    const matched = loaded.discovery.providers.find((provider) => provider.id === declaredProviderId)
    if (matched) {
      return loaded
    }
  }

  return null
}

function getDeclaredProviderId(providerId: string): string {
  const parts = providerId.split('.')
  return parts[parts.length - 1] ?? providerId
}

function getPluginProviders(module: PluginModuleShape | null): PluginProvidersApi {
  if (!module) {
    return {}
  }

  if (module.providers) {
    return module.providers
  }

  if (module.default?.providers) {
    return module.default.providers
  }

  return {}
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
