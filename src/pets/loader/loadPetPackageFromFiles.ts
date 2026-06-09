import type {
  BuiltInPetPackage,
  PetAnimationConfig,
  PetAssetStatus,
  PetAppearanceProfile,
  PetCompanionContentProfile,
  PetPackageManifest,
  PetPersonalityProfile,
  PetProductionProfile,
  PetStatesConfig,
} from '../../shared/types/petPackage'
import { createMochiSprite } from '../../engine/PixelMochi'

export interface PetPackageFileBundle {
  manifest: PetPackageManifest
  animations: PetAnimationConfig
  states: PetStatesConfig
  appearance?: PetAppearanceProfile | null
  productionProfile?: PetProductionProfile | null
  companionContent?: PetCompanionContentProfile | null
  assetStatus?: PetAssetStatus | null
  personality?: PetPersonalityProfile
  assetBasePath: string
}

export interface PetPackageBindingOverrides {
  clipToAnimationState?: BuiltInPetPackage['bindings']['clipToAnimationState']
}

const DEFAULT_CLIP_BINDINGS: BuiltInPetPackage['bindings']['clipToAnimationState'] = {
  idle_loop: 'IDLE',
  thinking_loop: 'THINKING',
  coding_loop: 'CODING',
  watching_loop: 'WATCHING',
  listening_loop: 'WATCHING',
  chatting_loop: 'CHATTING',
  gaming_loop: 'GAMING',
  sleep_loop: 'SLEEPING',
  happy_react: 'HAPPY',
  excited_loop: 'EXCITED',
  drag: 'WALK',
  idle_to_thinking: 'THINKING',
  thinking_to_idle: 'IDLE',
  thinking_to_sleep: 'SLEEPING',
  idle_to_happy: 'HAPPY',
  welcome_back: 'HAPPY',
  tap_affection: 'HAPPY',
}

export function buildPetPackageFromFiles(
  bundle: PetPackageFileBundle,
  overrides: PetPackageBindingOverrides = {},
): BuiltInPetPackage {
  const sprite = createMochiSprite()

  return {
    manifest: bundle.manifest,
    animations: bundle.animations,
    states: bundle.states,
    appearance: bundle.appearance ?? null,
    productionProfile: bundle.productionProfile ?? null,
    companionContent: bundle.companionContent ?? null,
    assetStatus: bundle.assetStatus ?? null,
    runtimeAssets: {
      preferredSource: 'atlas',
      assetBasePath: bundle.assetBasePath,
      atlasImageUrl: `${bundle.assetBasePath}/${bundle.manifest.assets.atlas ?? 'sprite-atlas.png'}`,
    },
    personality: bundle.personality ?? {},
    spriteDefinition: sprite.definition,
    bindings: {
      clipToAnimationState: {
        ...DEFAULT_CLIP_BINDINGS,
        ...(overrides.clipToAnimationState ?? {}),
      },
    },
  }
}
