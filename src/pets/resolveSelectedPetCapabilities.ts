import { resolvePetCapabilities } from './capabilities'
import { resolveSelectedPetPackage } from './resolveSelectedPetPackage'

export function resolveSelectedPetCapabilities() {
  return resolvePetCapabilities(resolveSelectedPetPackage())
}
