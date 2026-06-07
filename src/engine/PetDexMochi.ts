import { PetDexRenderer } from './PetDexRenderer'
import { generateMochiSpritesheet } from './DrawMochiPetDex'

export function createPetDexMochi(): PetDexRenderer {
  const sheet = generateMochiSpritesheet()
  const renderer = new PetDexRenderer()
  renderer.loadFromCanvas(sheet)
  return renderer
}

export const mochiPetJson = {
  id: 'mascot.mochi',
  displayName: 'Mochi',
  description: 'A soft floppy-ear pixel companion.',
  spritesheetPath: 'spritesheet.png',
}
