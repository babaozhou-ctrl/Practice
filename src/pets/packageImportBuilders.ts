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
  ImportedPetRecord,
  PersistImportedPetPayload,
} from './ImportedPetRegistry'
import {
  createDefaultImportedPetAssetStatus,
  createDefaultImportedPetCompanionContent,
  createDefaultImportedPetPersonality,
  getDefaultImportedSpriteDefinition,
  slugifyImportedPetName,
} from './importedPetDefaults'
import { generatePetPreviewAsset, type PreviewSourceFile } from './preview/generatePetPreview'

export interface ImportedPetPackageSource {
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

export interface CreateImportedPetRecordOptions {
  assetFiles?: ImportedPetAssetFile[]
  previewSourceFiles?: PreviewSourceFile[]
}

export async function createImportedPetRecordFromPackage(
  source: ImportedPetPackageSource,
  options: CreateImportedPetRecordOptions = {},
): Promise<PersistImportedPetPayload> {
  const importedAt = Date.now()
  const id = normalizeImportedPetId(source.manifest.id || source.manifest.name)
  const name = source.manifest.name?.trim() || 'Imported Pet'
  const hasAtlasRuntime = Boolean(source.manifest.assets.atlas && source.productionProfile)
  const manifest =
    source.manifest.assets.previewImage
      ? {
          ...source.manifest,
          id,
          name,
        }
      : await withGeneratedPreviewManifest(
          {
            ...source.manifest,
            id,
            name,
          },
          source,
          options,
        )

  return {
    id,
    name,
    importedAt,
    manifest,
    animations: source.animations,
    states: source.states,
    appearance: source.appearance ?? null,
    personality: source.personality ?? createDefaultImportedPetPersonality(name, id),
    companionContent: source.companionContent ?? createDefaultImportedPetCompanionContent(name),
    productionProfile: source.productionProfile ?? null,
    assetStatus: source.assetStatus ?? createDefaultImportedPetAssetStatus(hasAtlasRuntime),
    spriteDefinition: source.spriteDefinition ?? getDefaultImportedSpriteDefinition(),
    assetFiles: resolveAssetFiles(manifest, options),
  }
}

export function normalizeImportedPetId(value: string): string {
  if (value.startsWith('imported.')) {
    return value
  }
  return `imported.${slugifyImportedPetName(value)}`
}

async function withGeneratedPreviewManifest(
  manifest: PetPackageManifest,
  source: ImportedPetPackageSource,
  options: CreateImportedPetRecordOptions,
): Promise<PetPackageManifest> {
  const previewAsset = await generatePetPreviewAsset({
    spriteDefinition: source.spriteDefinition ?? null,
    productionProfile: source.productionProfile ?? null,
    atlasRelativePath: source.manifest.assets.atlas,
    sourceFiles: options.previewSourceFiles ?? [],
  })

  if (!previewAsset) {
    return manifest
  }

  const existing = options.assetFiles ?? []
  options.assetFiles = upsertAssetFile(existing, previewAsset)

  return {
    ...manifest,
    assets: {
      ...manifest.assets,
      previewImage: previewAsset.relativePath,
    },
  }
}

function resolveAssetFiles(
  manifest: PetPackageManifest,
  options: CreateImportedPetRecordOptions,
): ImportedPetAssetFile[] {
  const assetFiles = [...(options.assetFiles ?? [])]
  const previewPath = manifest.assets.previewImage
  if (!previewPath) {
    return assetFiles
  }

  return assetFiles
}

function upsertAssetFile(
  assetFiles: ImportedPetAssetFile[],
  nextFile: ImportedPetAssetFile,
): ImportedPetAssetFile[] {
  const normalizedPath = normalizeRelativePath(nextFile.relativePath)
  const retained = assetFiles.filter(
    (entry) => normalizeRelativePath(entry.relativePath) !== normalizedPath,
  )
  retained.push(nextFile)
  return retained
}

function normalizeRelativePath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
    .join('/')
}
