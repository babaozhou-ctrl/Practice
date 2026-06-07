import type { BuiltInPetPackage } from '../../shared/types/petPackage'
import { importedPetToPackage, readImportedPets } from '../ImportedPetRegistry'
import { loadBuiltInMochiPackage } from '../loader/loadBuiltInMochi'
import { DEFAULT_PET_PACKAGE_ID } from '../constants'

export interface PetCatalogEntry {
  id: string
  name: string
  description: string
  tags: string[]
  renderer: string
  packageStage: string | null
  assetBasePath?: string
}

const builtInLoaders: Record<string, () => BuiltInPetPackage> = {
  [DEFAULT_PET_PACKAGE_ID]: loadBuiltInMochiPackage,
}

export function listBuiltInPetCatalog(): PetCatalogEntry[] {
  const builtIns = Object.values(builtInLoaders).map((load) => {
    const petPackage = load()
    return {
      id: petPackage.manifest.id,
      name: petPackage.manifest.name,
      description: petPackage.manifest.description ?? '',
      tags: petPackage.manifest.tags ?? [],
      renderer: petPackage.manifest.renderer,
      packageStage: petPackage.assetStatus?.packageStage ?? null,
      assetBasePath: petPackage.runtimeAssets.assetBasePath,
    }
  })

  const imported = readImportedPets().map((record) => ({
    id: record.id,
    name: record.name,
    description: record.manifest.description ?? 'Imported custom pet package.',
    tags: record.manifest.tags ?? ['imported'],
    renderer: record.manifest.renderer,
    packageStage: 'hybrid',
    assetBasePath: `/pets/imported/${record.id}`,
  }))

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
