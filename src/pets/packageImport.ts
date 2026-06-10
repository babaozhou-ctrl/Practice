import type { SpriteDefinition } from '../types/animation'
import type {
  PetAnimationConfig,
  PetAppearanceProfile,
  PetAssetStatus,
  PetCompanionContentProfile,
  PetPackageManifest,
  PetPersonalityProfile,
  PetProductionProfile,
  PetStatesConfig,
} from '../shared/types/petPackage'
import type {
  ImportedPetAssetFile,
  PersistImportedPetPayload,
} from './ImportedPetRegistry'
import { createImportedPetRecordFromPackage } from './packageImportBuilders'
import { validateImportedPetPackage } from './packageValidation'

export interface BrowserImportFile {
  name: string
  relativePath: string
  file: File
}

interface RawPetPackageData {
  manifest: PetPackageManifest
  animations: PetAnimationConfig
  states: PetStatesConfig
  personality?: PetPersonalityProfile
  companionContent?: PetCompanionContentProfile | null
  appearance?: PetAppearanceProfile | null
  productionProfile?: PetProductionProfile | null
  assetStatus?: PetAssetStatus | null
  spriteDefinition?: SpriteDefinition | null
}

export async function buildImportedPetPayloadFromPackageFiles(
  files: BrowserImportFile[],
): Promise<PersistImportedPetPayload> {
  const manifestFile = findRequiredFile(files, 'manifest.json')
  const manifest = await readJsonFile<PetPackageManifest>(manifestFile.file, 'manifest.json')

  const animations = await readOptionalJson<PetAnimationConfig>(
    files,
    manifest.assets.animations,
    'animations.json',
  )
  const states = await readOptionalJson<PetStatesConfig>(
    files,
    manifest.assets.states,
    'states.json',
  )
  const personality = await readOptionalJson<PetPersonalityProfile>(
    files,
    manifest.assets.personality,
    'personality.json',
  )
  const companionContent = await readOptionalJson<PetCompanionContentProfile>(
    files,
    manifest.assets.companionContent,
    'companion-content.json',
  )
  const appearance = await readOptionalJson<PetAppearanceProfile>(
    files,
    manifest.assets.appearance,
    'appearance.json',
  )
  const productionProfile = await readOptionalJson<PetProductionProfile>(
    files,
    manifest.assets.productionProfile,
    'production.json',
  )
  const assetStatus = await readOptionalJson<PetAssetStatus>(
    files,
    manifest.assets.assetStatus,
    'asset-status.json',
  )
  const spriteDefinition = await readOptionalJson<SpriteDefinition>(
    files,
    'sprite-definition.json',
    'sprite-definition.json',
  )

  if (!animations) {
    throw new Error('宠物包里缺少 animations.json，暂时还没法导入。')
  }
  if (!states) {
    throw new Error('宠物包里缺少 states.json，暂时还没法导入。')
  }

  const rawData: RawPetPackageData = {
    manifest,
    animations,
    states,
    personality: personality ?? undefined,
    companionContent: companionContent ?? null,
    appearance: appearance ?? null,
    productionProfile: productionProfile ?? null,
    assetStatus: assetStatus ?? null,
    spriteDefinition: spriteDefinition ?? null,
  }

  validateImportedPetPackage({
    manifest,
    animations,
    states,
    companionContent: companionContent ?? null,
    productionProfile: productionProfile ?? null,
    spriteDefinition: spriteDefinition ?? null,
    availableRelativePaths: files.map((entry) => entry.relativePath),
  })

  const assetFiles = await collectAssetFiles(files, manifest)
  return createImportedPetRecordFromPackage(rawData, {
    assetFiles,
    previewSourceFiles: files.map((entry) => ({
      relativePath: entry.relativePath,
      file: entry.file,
    })),
  })
}

async function collectAssetFiles(
  files: BrowserImportFile[],
  manifest: PetPackageManifest,
): Promise<ImportedPetAssetFile[]> {
  const assetRelativePaths = new Set<string>()
  if (manifest.assets.atlas) {
    assetRelativePaths.add(normalizeRelativePath(manifest.assets.atlas))
  }
  if (manifest.assets.previewImage) {
    assetRelativePaths.add(normalizeRelativePath(manifest.assets.previewImage))
  }

  const collected: ImportedPetAssetFile[] = []
  for (const relativePath of assetRelativePaths) {
    const file = findFileByRelativePath(files, relativePath)
    if (!file) {
      throw new Error(`宠物包里缺少资源文件：${relativePath}`)
    }

    collected.push({
      relativePath,
      contentBase64: await fileToBase64(file.file),
    })
  }

  return collected
}

async function readOptionalJson<T>(
  files: BrowserImportFile[],
  preferredRelativePath: string | undefined,
  fallbackFileName: string,
): Promise<T | null> {
  const targetPath = preferredRelativePath
    ? normalizeRelativePath(preferredRelativePath)
    : fallbackFileName
  const exact = findFileByRelativePath(files, targetPath)
  const fallback = exact ?? files.find((entry) => normalizeRelativePath(entry.relativePath).endsWith(`/${fallbackFileName}`) || normalizeRelativePath(entry.relativePath) === fallbackFileName)
  if (!fallback) {
    return null
  }

  return readJsonFile<T>(fallback.file, fallbackFileName)
}

function findRequiredFile(files: BrowserImportFile[], relativePath: string): BrowserImportFile {
  const file = findFileByRelativePath(files, relativePath)
    ?? files.find((entry) => normalizeRelativePath(entry.relativePath).endsWith(`/${relativePath}`) || normalizeRelativePath(entry.relativePath) === relativePath)

  if (!file) {
    throw new Error(`缺少必需文件：${relativePath}`)
  }

  return file
}

function findFileByRelativePath(
  files: BrowserImportFile[],
  relativePath: string,
): BrowserImportFile | undefined {
  const normalized = normalizeRelativePath(relativePath)
  return files.find((entry) => normalizeRelativePath(entry.relativePath) === normalized)
}

function normalizeRelativePath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
    .join('/')
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (!(result instanceof ArrayBuffer)) {
        reject(new Error(`读取资源文件失败：${file.name}`))
        return
      }
      resolve(arrayBufferToBase64(result))
    }
    reader.onerror = () => reject(reader.error ?? new Error(`读取资源文件失败：${file.name}`))
    reader.readAsArrayBuffer(file)
  })
}

async function readJsonFile<T>(file: File, label: string): Promise<T> {
  try {
    return JSON.parse(await file.text()) as T
  } catch {
    throw new Error(`${label} 不是合法的 JSON，请检查逗号、引号和括号是否完整。`)
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length))
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}
