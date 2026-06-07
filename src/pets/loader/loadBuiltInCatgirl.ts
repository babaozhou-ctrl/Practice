import type { BuiltInPetPackage } from '../../shared/types/petPackage'
import { loadBuiltInLegacyCatgirlPackage } from './loadBuiltInLegacyCatgirl'

export function loadBuiltInCatgirlPackage(): BuiltInPetPackage {
  return loadBuiltInLegacyCatgirlPackage()
}
