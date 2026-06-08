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

export function createImportedPetRecordFromPackage(
  source: ImportedPetPackageSource,
  assetFiles: ImportedPetAssetFile[] = [],
): PersistImportedPetPayload {
  const importedAt = Date.now()
  const id = normalizeImportedPetId(source.manifest.id || source.manifest.name)
  const name = source.manifest.name?.trim() || 'Imported Pet'
  const hasAtlasRuntime = Boolean(source.manifest.assets.atlas && source.productionProfile)

  return {
    id,
    name,
    importedAt,
    manifest: {
      ...source.manifest,
      id,
      name,
    },
    animations: source.animations,
    states: source.states,
    appearance: source.appearance ?? null,
    personality: source.personality ?? createDefaultImportedPetPersonality(name, id),
    companionContent: source.companionContent ?? createDefaultImportedPetCompanionContent(name),
    productionProfile: source.productionProfile ?? null,
    assetStatus: source.assetStatus ?? createDefaultImportedPetAssetStatus(hasAtlasRuntime),
    spriteDefinition: source.spriteDefinition ?? getDefaultImportedSpriteDefinition(),
    assetFiles,
  }
}

export function normalizeImportedPetId(value: string): string {
  if (value.startsWith('imported.')) {
    return value
  }
  return `imported.${slugifyImportedPetName(value)}`
}
