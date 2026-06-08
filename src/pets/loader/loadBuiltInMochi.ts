import manifestJson from '../../../pets/mochi/manifest.json'
import animationsJson from '../../../pets/mochi/animations.json'
import statesJson from '../../../pets/mochi/states.json'
import appearanceJson from '../../../pets/mochi/appearance.json'
import companionContentJson from '../../../pets/mochi/companion-content.json'
import personalityJson from '../../../pets/mochi/personality.json'
import productionProfileJson from '../../../pets/mochi/production.json'
import assetStatusJson from '../../../pets/mochi/asset-status.json'
import type {
  BuiltInPetPackage,
  PetAnimationConfig,
  PetAssetStatus,
  PetAppearanceProfile,
  PetCompanionContentProfile,
  PetPackageManifest,
  PetProductionProfile,
  PetStatesConfig,
} from '../../shared/types/petPackage'
import { buildPetPackageFromFiles } from './loadPetPackageFromFiles'
import { resolveBuiltInPetAssetBasePath } from './resolveBuiltInPetAssetBasePath'

export function loadBuiltInMochiPackage(): BuiltInPetPackage {
  return buildPetPackageFromFiles({
    manifest: manifestJson as PetPackageManifest,
    animations: animationsJson as unknown as PetAnimationConfig,
    states: statesJson as PetStatesConfig,
    appearance: appearanceJson as PetAppearanceProfile,
    companionContent: companionContentJson as PetCompanionContentProfile,
    productionProfile: productionProfileJson as PetProductionProfile,
    assetStatus: assetStatusJson as PetAssetStatus,
    personality: personalityJson as Record<string, unknown>,
    assetBasePath: resolveBuiltInPetAssetBasePath('mochi'),
  })
}
