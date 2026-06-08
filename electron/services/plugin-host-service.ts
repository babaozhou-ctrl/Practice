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
}

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
