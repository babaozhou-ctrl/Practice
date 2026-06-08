export function resolveBuiltInPetAssetBasePath(folderName: string): string {
  const normalizedFolder = folderName.replace(/^\/+|\/+$/g, '')

  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return `/pets/${normalizedFolder}`
  }

  return new URL(`./pets/${normalizedFolder}`, window.location.href).toString().replace(/\/$/, '')
}
