import type { BuiltInPetPackage } from '../../shared/types/petPackage'
import { loadBuiltInMochiPackage } from './loadBuiltInMochi'

export function loadBuiltInLegacyCatgirlPackage(): BuiltInPetPackage {
  return loadBuiltInMochiPackage()
}
