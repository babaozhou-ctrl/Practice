import type { SpriteDefinition } from '../../types/animation'
import type {
  PetAnimationConfig,
  PetAppearanceProfile,
  PetPackageManifest,
  PetPersonalityProfile,
  PetProductionProfile,
  PetStatesConfig,
} from './petPackage'

interface ImportedPetDiskPackage {
  id: string
  name: string
  importedAt: number
  manifest: PetPackageManifest
  animations: PetAnimationConfig
  states: PetStatesConfig
  personality: PetPersonalityProfile
  spriteDefinition: SpriteDefinition
  appearance?: PetAppearanceProfile | null
  productionProfile?: PetProductionProfile | null
}

declare global {
  interface Window {
    PIXI?: any
    electronAPI?: {
      movePet?: (x: number, y: number) => void
      getPosition?: () => Promise<{ x: number; y: number }>
      toggleClickThrough?: () => void
      openChat?: () => void
      openSettings?: () => void
      quitApp?: () => void
      extractDocumentText?: (payload: {
        fileName: string
        mimeType?: string
        buffer: ArrayBuffer | Uint8Array
      }) => Promise<string>
      onSpeech?: (callback: (msg: string, dur: number) => void) => void
      onContextUpdate?: (callback: (info: { title: string; process: string; idleMs?: number }) => void) => void
      listImportedPets?: () => Promise<ImportedPetDiskPackage[]>
      saveImportedPet?: (record: unknown) => Promise<unknown>
    }
  }
}

export {}
