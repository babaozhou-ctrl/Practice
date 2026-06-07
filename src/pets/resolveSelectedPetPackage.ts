import { loadPetPackageById } from './registry/builtInPetRegistry'
import { readSelectedPetState } from './PetSelectionStore'

export function resolveSelectedPetPackage() {
  const selection = readSelectedPetState()
  return loadPetPackageById(selection.selectedPetId)
}
