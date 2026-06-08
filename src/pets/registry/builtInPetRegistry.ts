import type { BuiltInPetPackage } from '../../shared/types/petPackage'
import {
  buildImportedPetAssetBasePath,
  buildImportedPetAssetUrl,
  importedPetToPackage,
  readImportedPets,
} from '../ImportedPetRegistry'
import { loadBuiltInMochiPackage } from '../loader/loadBuiltInMochi'
import { DEFAULT_PET_PACKAGE_ID } from '../constants'

export interface PetCatalogEntry {
  id: string
  name: string
  description: string
  source: 'built-in' | 'imported'
  tags: string[]
  capabilities: string[]
  renderer: string
  packageStage: string | null
  archetype: string | null
  summary: string | null
  accentColor: string | null
  previewImageUrl: string | null
  assetBasePath?: string
}

const builtInLoaders: Record<string, () => BuiltInPetPackage> = {
  [DEFAULT_PET_PACKAGE_ID]: loadBuiltInMochiPackage,
}

export function listBuiltInPetCatalog(): PetCatalogEntry[] {
  const builtIns = Object.values(builtInLoaders).map((load) =>
    toCatalogEntry(load(), 'built-in'),
  )

  const imported = readImportedPets().map((record) =>
    toCatalogEntry(importedPetToPackage(record), 'imported'),
  )

  return [...builtIns, ...imported]
}

export function loadPetPackageById(petId: string): BuiltInPetPackage {
  const imported = readImportedPets().find((entry) => entry.id === petId)
  if (imported) {
    return importedPetToPackage(imported)
  }

  const loader = builtInLoaders[petId] ?? builtInLoaders[DEFAULT_PET_PACKAGE_ID]
  return loader()
}

export function hasBuiltInPetPackage(petId: string): boolean {
  return petId in builtInLoaders || readImportedPets().some((entry) => entry.id === petId)
}

function toCatalogEntry(
  petPackage: BuiltInPetPackage,
  source: 'built-in' | 'imported',
): PetCatalogEntry {
  const paletteValues = petPackage.appearance?.palette
    ? Object.values(petPackage.appearance.palette)
    : []

  return {
    id: petPackage.manifest.id,
    name: petPackage.manifest.name,
    description: petPackage.manifest.description ?? '',
    source,
    tags: petPackage.manifest.tags ?? [],
    capabilities: formatCapabilities(petPackage.manifest.capabilities),
    renderer: petPackage.manifest.renderer,
    packageStage: petPackage.assetStatus?.packageStage ?? null,
    archetype: petPackage.appearance?.archetype ?? null,
    summary: petPackage.appearance?.summary ?? null,
    accentColor: paletteValues[2] ?? paletteValues[0] ?? null,
    previewImageUrl: resolvePreviewImageUrl(petPackage, source),
    assetBasePath: source === 'imported'
      ? buildImportedPetAssetBasePath(petPackage.manifest.id)
      : petPackage.runtimeAssets.assetBasePath,
  }
}

function formatCapabilities(
  capabilities: BuiltInPetPackage['manifest']['capabilities'] | undefined,
): string[] {
  if (!capabilities) {
    return []
  }

  return Object.entries(capabilities)
    .filter(([, enabled]) => enabled)
    .map(([name]) =>
      name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (letter) => letter.toUpperCase()),
    )
}

function resolvePreviewImageUrl(
  petPackage: BuiltInPetPackage,
  source: 'built-in' | 'imported',
): string | null {
  const previewPath = petPackage.manifest.assets.previewImage
  if (!previewPath) {
    return null
  }

  if (source === 'imported') {
    return buildImportedPetAssetUrl(petPackage.manifest.id, previewPath)
  }

  const assetBasePath = petPackage.runtimeAssets.assetBasePath
  if (!assetBasePath) {
    return null
  }

  return `${assetBasePath}/${previewPath}`
}
