import type { BuiltInPetPackage, PetCapabilityKey, PetCapabilityMap } from '../shared/types/petPackage'

const DEFAULT_CAPABILITIES: Record<PetCapabilityKey, boolean> = {
  speechBubbleAnchor: true,
  emoteOverlay: false,
  ambientMicroMotion: true,
  fileAnalysis: false,
  screenPerception: false,
  proactiveChat: true,
  workModeSupport: true,
  importable: false,
}

export function resolvePetCapabilities(petPackage: BuiltInPetPackage): Record<PetCapabilityKey, boolean> {
  return {
    ...DEFAULT_CAPABILITIES,
    ...(petPackage.manifest.capabilities ?? {}),
  }
}

export function hasPetCapability(
  petPackage: BuiltInPetPackage,
  capability: PetCapabilityKey,
): boolean {
  return resolvePetCapabilities(petPackage)[capability]
}

export function withPetCapabilities(
  capabilities: PetCapabilityMap | undefined,
): Record<PetCapabilityKey, boolean> {
  return {
    ...DEFAULT_CAPABILITIES,
    ...(capabilities ?? {}),
  }
}
