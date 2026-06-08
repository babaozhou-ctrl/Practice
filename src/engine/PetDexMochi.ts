import { PetDexRenderer } from './PetDexRenderer'
import { generateMochiSpritesheet } from './DrawMochiPetDex'

export function createPetDexMochi(): PetDexRenderer {
  const sheet = generateMochiSpritesheet()
  const renderer = new PetDexRenderer()
  renderer.loadFromCanvas(sheet)
  return renderer
}

export const mochiPetJson = {
  id: 'mascot.bb7',
  displayName: 'bb7',
  description: 'A soft floppy-ear pixel companion.',
  spritesheetPath: 'spritesheet.png',
}
