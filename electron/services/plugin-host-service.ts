import { app } from 'electron'
import { readdir, readFile, stat } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { pathToFileURL } from 'url'
import type { AIConfig, ChatMessage } from '../../src/types/chat'

export type PluginRuntimeStatus = 'not_loaded' | 'loaded' | 'load_failed'

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
  runtimeStatus: PluginRuntimeStatus
  errors: string[]
  runtimeErrors: string[]
}

interface LoadedPluginRecord {
  discovery: PluginDiscoveryRecord
  entryPath: string
  module: PluginModuleShape
}

interface PluginFileAnalysisRequest {
  providerId: string
  fileName: string
  content: string
}

interface PluginAIChatRequest {
  requestId: string
  providerId: string
  config: AIConfig
  systemPrompt: string
  messages: ChatMessage[]
  emitChunk?: (chunk: string) => void
}

interface PluginAISummaryRequest {
  providerId: string
  config: AIConfig
  fileName: string
  content: string
}

interface PluginAIHealthCheckRequest {
  providerId: string
  config: AIConfig
}

interface PluginScreenPerceptionRequest {
  providerId: string
  imageData?: string
}

interface PluginFileAnalysisContext {
  providerId: string
  pluginId: string
  pluginName: string
  fileName: string
}

interface PluginAIChatContext {
  requestId: string
  providerId: string
  pluginId: string
  pluginName: string
  config: AIConfig
  systemPrompt: string
  messages: ChatMessage[]
}

interface PluginExecutionControl {
  isCancelled: () => boolean
}

interface PluginFileAnalysisApi {
  summarize?: (
    content: string,
    context: PluginFileAnalysisContext,
  ) => Promise<string> | string
}

interface PluginAIChatApi {
  streamChat?: (
    context: PluginAIChatContext,
    tools: {
      emitChunk: (chunk: string) => void
      isCancelled: () => boolean
    },
  ) => Promise<string> | string
  summarizeDocument?: (
    fileName: string,
    content: string,
    context: PluginAIChatContext,
  ) => Promise<string> | string
  healthCheck?: (
    config: AIConfig,
  ) => Promise<{ ok: boolean; message: string }> | { ok: boolean; message: string }
}

interface PluginScreenPerceptionApi {
  captureScreenshot?: () => Promise<string | null> | string | null
  analyzeWithOCR?: (imageData: string) => Promise<string> | string
  analyzeWithLocalVision?: (imageData: string) => Promise<string> | string
  analyzeWithCloudVision?: (imageData: string) => Promise<string> | string
}

interface PluginProvidersApi {
  aiChat?: Record<string, PluginAIChatApi | undefined>
  fileAnalysis?: Record<string, PluginFileAnalysisApi | undefined>
  screenPerception?: Record<string, PluginScreenPerceptionApi | undefined>
}

interface PluginModuleShape {
  providers?: PluginProvidersApi
  default?: {
    providers?: PluginProvidersApi
  }
}

interface ActiveAIChatRequestRecord {
  requestId: string
  providerId: string
  startedAt: number
  cancelled: boolean
}

const SUPPORTED_PLUGIN_API_VERSIONS = new Set(['1.0.0'])
const loadedPlugins = new Map<string, LoadedPluginRecord>()
const activeAIChatRequests = new Map<string, ActiveAIChatRequestRecord>()
const PLUGIN_AI_CHAT_TIMEOUT_MS = 20_000
const PLUGIN_FILE_ANALYSIS_TIMEOUT_MS = 12_000
const PLUGIN_SCREEN_TIMEOUT_MS = 8_000

function resolveRuntimePluginsDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'plugins')
  }

  return resolve(process.cwd(), 'plugins')
}

export async function listLocalPluginManifests(): Promise<PluginDiscoveryRecord[]> {
  const pluginDirs = await listRuntimePluginDirectories()
  if (pluginDirs.length === 0) {
    loadedPlugins.clear()
    return []
  }

  const discovered: PluginDiscoveryRecord[] = []
  const nextLoadedPlugins = new Map<string, LoadedPluginRecord>()

  for (const pluginDir of pluginDirs) {
    const directoryName = pluginDir.split(/[\\/]/).pop() || pluginDir
    const manifestPath = join(pluginDir, 'manifest.json')
    const manifestRecord = await loadPluginManifestRecord(directoryName, manifestPath)

    if (manifestRecord.status !== 'valid') {
      discovered.push(manifestRecord)
      continue
    }

    const entryPath = join(pluginDir, manifestRecord.entry)
    const loadedRecord = await loadPluginModule(manifestRecord, entryPath)
    discovered.push(loadedRecord.discovery)

    if (loadedRecord.discovery.runtimeStatus === 'loaded') {
      nextLoadedPlugins.set(loadedRecord.discovery.id, loadedRecord)
    }
  }

  loadedPlugins.clear()
  for (const [pluginId, loadedRecord] of nextLoadedPlugins.entries()) {
    loadedPlugins.set(pluginId, loadedRecord)
  }

  return discovered.sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'valid' ? -1 : 1
    }
    if (left.runtimeStatus !== right.runtimeStatus) {
      return left.runtimeStatus === 'loaded' ? -1 : 1
    }
    return left.name.localeCompare(right.name)
  })
}

async function listRuntimePluginDirectories(): Promise<string[]> {
  const candidateRoots = app.isPackaged
    ? [join(app.getAppPath(), 'plugins'), join(process.resourcesPath, 'plugins')]
    : [resolveRuntimePluginsDir()]

  const uniqueRoots = Array.from(new Set(candidateRoots.map((root) => resolve(root))))
  const pluginDirs: string[] = []

  for (const root of uniqueRoots) {
    try {
      const entries = await readdir(root, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          pluginDirs.push(join(root, entry.name))
        }
      }
    } catch {
      // Ignore missing roots so dev builds and packaged builds can share the same lookup flow.
    }
  }

  return pluginDirs
}

export async function runPluginFileAnalysis(
  request: PluginFileAnalysisRequest,
): Promise<string> {
  const loadedPlugin = findLoadedPluginByProviderId(request.providerId)
  if (!loadedPlugin) {
    throw new Error(`没有找到和 ${request.providerId} 对应的已加载插件。`)
  }

  const providerKey = getDeclaredProviderId(request.providerId)
  const pluginProviders = getPluginProviders(loadedPlugin.module)
  const fileAnalysisProvider = pluginProviders.fileAnalysis?.[providerKey]
  if (!fileAnalysisProvider?.summarize) {
    throw new Error(`插件 ${loadedPlugin.discovery.name} 没有实现文件分析接入 "${providerKey}" 的 summarize。`)
  }

  const result = await withTimeout(
    Promise.resolve(
      fileAnalysisProvider.summarize(request.content, {
        providerId: request.providerId,
        pluginId: loadedPlugin.discovery.id,
        pluginName: loadedPlugin.discovery.name,
        fileName: request.fileName,
      }),
    ),
    PLUGIN_FILE_ANALYSIS_TIMEOUT_MS,
    `插件 ${loadedPlugin.discovery.name} 的文件分析执行超时。`,
  )

  const normalized = typeof result === 'string' ? result.trim() : ''
  if (!normalized) {
    throw new Error(`插件 ${loadedPlugin.discovery.name} 返回了空的文件摘要。`)
  }

  return normalized
}

export async function runPluginAIChat(
  request: PluginAIChatRequest,
): Promise<string> {
  const loadedPlugin = findLoadedPluginByProviderId(request.providerId)
  if (!loadedPlugin) {
    throw new Error(`没有找到和 ${request.providerId} 对应的已加载插件。`)
  }

  const providerKey = getDeclaredProviderId(request.providerId)
  const pluginProviders = getPluginProviders(loadedPlugin.module)
  const aiChatProvider = pluginProviders.aiChat?.[providerKey]
  if (!aiChatProvider?.streamChat) {
    throw new Error(`插件 ${loadedPlugin.discovery.name} 没有实现 AI 对话接入 "${providerKey}" 的 streamChat。`)
  }

  const activeRequest: ActiveAIChatRequestRecord = {
    requestId: request.requestId,
    providerId: request.providerId,
    startedAt: Date.now(),
    cancelled: false,
  }
  activeAIChatRequests.set(request.requestId, activeRequest)

  const control: PluginExecutionControl = {
    isCancelled: () => {
      const state = activeAIChatRequests.get(request.requestId)
      return !state || state.cancelled
    },
  }

  const emitChunk = (chunk: string) => {
    if (control.isCancelled()) {
      return
    }

    const normalizedChunk = typeof chunk === 'string' ? chunk : ''
    if (!normalizedChunk) {
      return
    }

    request.emitChunk?.(normalizedChunk)
  }

  try {
    const result = await withTimeout(
      Promise.resolve(
        aiChatProvider.streamChat(
          {
            requestId: request.requestId,
            providerId: request.providerId,
            pluginId: loadedPlugin.discovery.id,
            pluginName: loadedPlugin.discovery.name,
            config: request.config,
            systemPrompt: request.systemPrompt,
            messages: request.messages,
          },
          {
            emitChunk,
            isCancelled: control.isCancelled,
          },
        ),
      ),
      PLUGIN_AI_CHAT_TIMEOUT_MS,
      `插件 ${loadedPlugin.discovery.name} 的聊天执行超时。`,
    )

    if (control.isCancelled()) {
      const cancelError = new Error('这次插件对话已经被取消了。')
      cancelError.name = 'AbortError'
      throw cancelError
    }

    const normalized = typeof result === 'string' ? result.trim() : ''
    if (!normalized) {
      throw new Error(`插件 ${loadedPlugin.discovery.name} 返回了空的聊天结果。`)
    }

    return normalized
  } finally {
    activeAIChatRequests.delete(request.requestId)
  }
}

export async function runPluginAISummary(
  request: PluginAISummaryRequest,
): Promise<string> {
  const loadedPlugin = findLoadedPluginByProviderId(request.providerId)
  if (!loadedPlugin) {
    throw new Error(`没有找到和 ${request.providerId} 对应的已加载插件。`)
  }

  const providerKey = getDeclaredProviderId(request.providerId)
  const pluginProviders = getPluginProviders(loadedPlugin.module)
  const aiChatProvider = pluginProviders.aiChat?.[providerKey]
  if (!aiChatProvider?.summarizeDocument) {
    throw new Error(`插件 ${loadedPlugin.discovery.name} 没有实现 AI 对话接入 "${providerKey}" 的 summarizeDocument。`)
  }

  const result = await withTimeout(
    Promise.resolve(
      aiChatProvider.summarizeDocument(request.fileName, request.content, {
        requestId: `plugin-ai-summary:${Date.now()}`,
        providerId: request.providerId,
        pluginId: loadedPlugin.discovery.id,
        pluginName: loadedPlugin.discovery.name,
        config: request.config,
        systemPrompt: '',
        messages: [],
      }),
    ),
    PLUGIN_FILE_ANALYSIS_TIMEOUT_MS,
    `插件 ${loadedPlugin.discovery.name} 的文档总结执行超时。`,
  )

  const normalized = typeof result === 'string' ? result.trim() : ''
  if (!normalized) {
    throw new Error(`插件 ${loadedPlugin.discovery.name} 返回了空的文档总结。`)
  }

  return normalized
}

export async function runPluginAIHealthCheck(
  request: PluginAIHealthCheckRequest,
): Promise<{ ok: boolean; message: string }> {
  const loadedPlugin = findLoadedPluginByProviderId(request.providerId)
  if (!loadedPlugin) {
    throw new Error(`没有找到和 ${request.providerId} 对应的已加载插件。`)
  }

  const providerKey = getDeclaredProviderId(request.providerId)
  const pluginProviders = getPluginProviders(loadedPlugin.module)
  const aiChatProvider = pluginProviders.aiChat?.[providerKey]
  if (!aiChatProvider?.healthCheck) {
    return {
      ok: true,
      message: `插件 ${loadedPlugin.discovery.name} 已加载，但未提供独立健康检查。`,
    }
  }

  return withTimeout(
    Promise.resolve(aiChatProvider.healthCheck(request.config)),
    PLUGIN_SCREEN_TIMEOUT_MS,
    `插件 ${loadedPlugin.discovery.name} 的健康检查执行超时。`,
  )
}

export async function runPluginScreenCapture(
  request: PluginScreenPerceptionRequest,
): Promise<string | null> {
  const screenProvider = getPluginScreenPerceptionProvider(request.providerId)
  if (!screenProvider.captureScreenshot) {
    throw new Error(`插件 ${request.providerId} 还没有实现截图能力。`)
  }

  const result = await withTimeout(
    Promise.resolve(screenProvider.captureScreenshot()),
    PLUGIN_SCREEN_TIMEOUT_MS,
    `插件 ${request.providerId} 的截图执行超时了。`,
  )

  return typeof result === 'string' ? result : null
}

export async function runPluginScreenOCR(
  request: PluginScreenPerceptionRequest,
): Promise<string> {
  const screenProvider = getPluginScreenPerceptionProvider(request.providerId)
  if (!screenProvider.analyzeWithOCR) {
    throw new Error(`插件 ${request.providerId} 还没有实现 OCR 分析。`)
  }

  return withTimeout(
    Promise.resolve(screenProvider.analyzeWithOCR(request.imageData ?? '')),
    PLUGIN_SCREEN_TIMEOUT_MS,
    `插件 ${request.providerId} 的 OCR 分析执行超时了。`,
  )
}

export async function runPluginScreenLocalVision(
  request: PluginScreenPerceptionRequest,
): Promise<string> {
  const screenProvider = getPluginScreenPerceptionProvider(request.providerId)
  if (!screenProvider.analyzeWithLocalVision) {
    throw new Error(`插件 ${request.providerId} 还没有实现本地视觉分析。`)
  }

  return withTimeout(
    Promise.resolve(screenProvider.analyzeWithLocalVision(request.imageData ?? '')),
    PLUGIN_SCREEN_TIMEOUT_MS,
    `插件 ${request.providerId} 的本地视觉分析执行超时了。`,
  )
}

export async function runPluginScreenCloudVision(
  request: PluginScreenPerceptionRequest,
): Promise<string> {
  const screenProvider = getPluginScreenPerceptionProvider(request.providerId)
  if (!screenProvider.analyzeWithCloudVision) {
    throw new Error(`插件 ${request.providerId} 还没有实现云端视觉分析。`)
  }

  return withTimeout(
    Promise.resolve(screenProvider.analyzeWithCloudVision(request.imageData ?? '')),
    PLUGIN_SCREEN_TIMEOUT_MS,
    `插件 ${request.providerId} 的云端视觉分析执行超时了。`,
  )
}

export function cancelPluginAIChat(requestId: string): boolean {
  const record = activeAIChatRequests.get(requestId)
  if (!record) {
    return false
  }

  record.cancelled = true
  return true
}

async function loadPluginManifestRecord(
  directoryName: string,
  manifestPath: string,
): Promise<PluginDiscoveryRecord> {
  const base: PluginDiscoveryRecord = {
    id: `invalid.${directoryName}`,
    name: directoryName,
    version: '未声明',
    entry: '未声明',
    capabilities: [],
    permissions: [],
    apiVersion: null,
    providers: [],
    source: 'local',
    directoryName,
    manifestPath,
    status: 'invalid',
    runtimeStatus: 'not_loaded',
    errors: [],
    runtimeErrors: [],
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
    version: typeof manifest.version === 'string' && manifest.version.trim() ? manifest.version.trim() : '未声明',
    entry: typeof manifest.entry === 'string' && manifest.entry.trim() ? manifest.entry.trim() : '未声明',
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
    runtimeStatus: 'not_loaded',
    errors,
    runtimeErrors: [],
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
        errors.push('providers 列表里存在结构不完整的接入声明。')
        continue
      }

      if (providerIds.has(provider.id.trim())) {
        errors.push(`providers 列表里存在重复的接入 id：${provider.id}`)
      }
      providerIds.add(provider.id.trim())

      if (
        provider.manifestCapability &&
        Array.isArray(manifest.capabilities) &&
        !manifest.capabilities.includes(provider.manifestCapability)
      ) {
        errors.push(
          `接入 "${provider.id}" 声明了 manifestCapability=${provider.manifestCapability}，但插件 capabilities 里没有它。`,
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
    const normalizedModule = normalizePluginModule(imported as PluginModuleShape)

    const runtimeErrors = validatePluginRuntimeContracts(discovery, normalizedModule)
    if (runtimeErrors.length > 0) {
      return {
        discovery: {
          ...discovery,
          runtimeStatus: 'load_failed',
          runtimeErrors,
        },
        entryPath,
        module: normalizedModule,
      }
    }

    return {
      discovery: {
        ...discovery,
        runtimeStatus: 'loaded',
        runtimeErrors: [],
      },
      entryPath,
      module: normalizedModule,
    }
  } catch (error: any) {
    return {
      discovery: {
        ...discovery,
        runtimeStatus: 'load_failed',
        runtimeErrors: [`插件入口加载失败：${error?.message ?? String(error)}`],
      },
      entryPath,
      module: {},
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

function getPluginProviders(module: PluginModuleShape): PluginProvidersApi {
  if (module.providers) {
    return module.providers
  }

  if (module.default?.providers) {
    return module.default.providers
  }

  return {}
}

function getPluginScreenPerceptionProvider(providerId: string): PluginScreenPerceptionApi {
  const loadedPlugin = findLoadedPluginByProviderId(providerId)
  if (!loadedPlugin) {
    throw new Error(`没有找到和 ${providerId} 对应的已加载插件。`)
  }

  const providerKey = getDeclaredProviderId(providerId)
  const pluginProviders = getPluginProviders(loadedPlugin.module)
  const screenProvider = pluginProviders.screenPerception?.[providerKey]
  if (!screenProvider) {
    throw new Error(`插件 ${loadedPlugin.discovery.name} 没有实现屏幕感知接入 "${providerKey}"。`)
  }

  return screenProvider
}

function normalizePluginModule(module: PluginModuleShape): PluginModuleShape {
  return module ?? {}
}

function validatePluginRuntimeContracts(
  discovery: PluginDiscoveryRecord,
  module: PluginModuleShape,
): string[] {
  const errors: string[] = []
  const providers = getPluginProviders(module)

  for (const provider of discovery.providers) {
    if (provider.capability === 'fileAnalysis') {
      const runtimeProvider = providers.fileAnalysis?.[provider.id]
      if (!runtimeProvider) {
        errors.push(`插件没有导出文件分析接入 "${provider.id}"。`)
        continue
      }
      if (typeof runtimeProvider.summarize !== 'function') {
        errors.push(`文件分析接入 "${provider.id}" 缺少 summarize 函数。`)
      }
    }

    if (provider.capability === 'aiChat') {
      const runtimeProvider = providers.aiChat?.[provider.id]
      if (!runtimeProvider) {
        errors.push(`插件没有导出 AI 对话接入 "${provider.id}"。`)
        continue
      }
      if (typeof runtimeProvider.streamChat !== 'function') {
        errors.push(`AI 对话接入 "${provider.id}" 缺少 streamChat 函数。`)
      }
    }

    if (provider.capability === 'screenPerception') {
      const runtimeProvider = providers.screenPerception?.[provider.id]
      if (!runtimeProvider) {
        errors.push(`插件没有导出屏幕感知接入 "${provider.id}"。`)
        continue
      }
      if (
        typeof runtimeProvider.captureScreenshot !== 'function' &&
        typeof runtimeProvider.analyzeWithOCR !== 'function' &&
        typeof runtimeProvider.analyzeWithLocalVision !== 'function' &&
        typeof runtimeProvider.analyzeWithCloudVision !== 'function'
      ) {
        errors.push(`屏幕感知接入 "${provider.id}" 至少要实现一个分析或截图函数。`)
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

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timeoutId)
        resolve(value)
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}
