import { createPetDexMochi, mochiPetJson } from './PetDexMochi'

export { createPetDexMochi, mochiPetJson }

// Legacy aliases preserved for older PetDex experiment paths.
export function createPetDexCatgirl() {
  return createPetDexMochi()
}

export const catgirlPetJson = mochiPetJson
