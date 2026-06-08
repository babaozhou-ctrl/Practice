import { app } from 'electron'
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import type { SpriteDefinition } from '../src/types/animation'
import type {
  PetAnimationConfig,
  PetAppearanceProfile,
  PetCompanionContentProfile,
  PetPackageManifest,
  PetPersonalityProfile,
  PetProductionProfile,
  PetStatesConfig,
} from '../src/shared/types/petPackage'

const IMPORTED_PETS_DIR = join(app.getPath('userData'), 'pets', 'imported')

export interface DiskImportedPetPackage {
  id: string
  name: string
  importedAt: number
  manifest: PetPackageManifest
  animations: PetAnimationConfig
  states: PetStatesConfig
  personality: PetPersonalityProfile
  spriteDefinition: SpriteDefinition
  appearance?: PetAppearanceProfile | null
  companionContent?: PetCompanionContentProfile | null
  productionProfile?: PetProductionProfile | null
}

export async function ensureImportedPetsDir() {
  await mkdir(IMPORTED_PETS_DIR, { recursive: true })
}

export async function listImportedPetPackages(): Promise<DiskImportedPetPackage[]> {
  await ensureImportedPetsDir()
  const entries = await readdir(IMPORTED_PETS_DIR, { withFileTypes: true })
  const packages: DiskImportedPetPackage[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const petDir = join(IMPORTED_PETS_DIR, entry.name)
    try {
      const manifestRaw = await readFile(join(petDir, 'manifest.json'), 'utf-8')
      const animationsRaw = await readFile(join(petDir, 'animations.json'), 'utf-8')
      const statesRaw = await readFile(join(petDir, 'states.json'), 'utf-8')
      const personalityRaw = await readFile(join(petDir, 'personality.json'), 'utf-8')
      const spriteDefinitionRaw = await readFile(join(petDir, 'sprite-definition.json'), 'utf-8')

      const manifest = JSON.parse(manifestRaw) as PetPackageManifest
      const animations = JSON.parse(animationsRaw) as PetAnimationConfig
      const states = JSON.parse(statesRaw) as PetStatesConfig
      const personality = JSON.parse(personalityRaw) as PetPersonalityProfile
      const spriteDefinition = JSON.parse(spriteDefinitionRaw) as SpriteDefinition
      const metadataRaw = await safeReadFile(join(petDir, 'metadata.json'))
      const metadata = metadataRaw ? JSON.parse(metadataRaw) as { importedAt?: number } : {}
      const appearanceRaw = await safeReadFile(join(petDir, 'appearance.json'))
      const companionContentRaw = await safeReadFile(join(petDir, 'companion-content.json'))
      const productionProfileRaw = await safeReadFile(join(petDir, 'production.json'))
      const appearance = appearanceRaw ? JSON.parse(appearanceRaw) as PetAppearanceProfile : null
      const companionContent = companionContentRaw
        ? JSON.parse(companionContentRaw) as PetCompanionContentProfile
        : null
      const productionProfile = productionProfileRaw ? JSON.parse(productionProfileRaw) as PetProductionProfile : null

      if (typeof manifest.id !== 'string' || typeof manifest.name !== 'string') {
        continue
      }

      packages.push({
        id: manifest.id,
        name: manifest.name,
        importedAt: typeof metadata.importedAt === 'number' ? metadata.importedAt : Date.now(),
        manifest,
        animations,
        states,
        personality,
        spriteDefinition,
        appearance,
        companionContent,
        productionProfile,
      })
    } catch {
      // ignore malformed package folders for now
    }
  }

  return packages.sort((left, right) => left.name.localeCompare(right.name))
}

export async function saveImportedPetPackage(pkg: DiskImportedPetPackage): Promise<DiskImportedPetPackage> {
  await ensureImportedPetsDir()
  const petDir = join(IMPORTED_PETS_DIR, pkg.id)
  await rm(petDir, { recursive: true, force: true })
  await mkdir(petDir, { recursive: true })

  await writeFile(join(petDir, 'manifest.json'), JSON.stringify(pkg.manifest, null, 2), 'utf-8')
  await writeFile(join(petDir, 'animations.json'), JSON.stringify(pkg.animations, null, 2), 'utf-8')
  await writeFile(join(petDir, 'states.json'), JSON.stringify(pkg.states, null, 2), 'utf-8')
  await writeFile(join(petDir, 'personality.json'), JSON.stringify(pkg.personality, null, 2), 'utf-8')
  await writeFile(join(petDir, 'sprite-definition.json'), JSON.stringify(pkg.spriteDefinition, null, 2), 'utf-8')
  await writeFile(join(petDir, 'metadata.json'), JSON.stringify({ importedAt: pkg.importedAt }, null, 2), 'utf-8')

  if (pkg.appearance) {
    await writeFile(join(petDir, 'appearance.json'), JSON.stringify(pkg.appearance, null, 2), 'utf-8')
  }
  if (pkg.companionContent) {
    await writeFile(
      join(petDir, 'companion-content.json'),
      JSON.stringify(pkg.companionContent, null, 2),
      'utf-8',
    )
  }
  if (pkg.productionProfile) {
    await writeFile(join(petDir, 'production.json'), JSON.stringify(pkg.productionProfile, null, 2), 'utf-8')
  }

  return pkg
}

async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}
