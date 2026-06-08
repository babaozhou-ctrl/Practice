import type { SpriteDefinition } from '../types/animation'
import type {
  BuiltInPetPackage,
  PetAnimationConfig,
  PetAppearanceProfile,
  PetAssetStatus,
  PetCompanionContentProfile,
  PetPackageManifest,
  PetPersonalityProfile,
  PetProductionProfile,
  PetStatesConfig,
} from '../shared/types/petPackage'
import { buildPetPackageFromFiles } from './loader/loadPetPackageFromFiles'
import {
  createDefaultImportedPetAssetStatus,
  createDefaultImportedPetCompanionContent,
  createDefaultImportedPetPersonality,
  getDefaultImportedSpriteDefinition,
  slugifyImportedPetName,
} from './importedPetDefaults'

export const IMPORTED_PET_STORAGE_KEY = 'deep-pet.imported-pets.v1'

const IMPORTED_PET_CHANNEL = 'deep-pet:imported-pets'
const IMPORTED_PET_EVENT = 'deep-pet:imported-pets-sync'
const IMPORTED_ASSET_PROTOCOL = 'deep-pet://imported'

let broadcastChannel: BroadcastChannel | null = null
let importedPetsCache: ImportedPetRecord[] | null = null

export interface ImportedPetAssetFile {
  relativePath: string
  contentBase64: string
}

interface ImportedPetDiskPackage {
  id: string
  name: string
  importedAt: number
  manifest: PetPackageManifest
  animations: PetAnimationConfig
  states: PetStatesConfig
  appearance?: PetAppearanceProfile | null
  personality: PetPersonalityProfile
  companionContent?: PetCompanionContentProfile | null
  productionProfile?: PetProductionProfile | null
  assetStatus?: PetAssetStatus | null
  spriteDefinition: SpriteDefinition
}

export interface ImportedPetRecord {
  id: string
  name: string
  importedAt: number
  manifest: PetPackageManifest
  animations: PetAnimationConfig
  states: PetStatesConfig
  appearance: PetAppearanceProfile | null
  personality: PetPersonalityProfile
  companionContent: PetCompanionContentProfile | null
  productionProfile: PetProductionProfile | null
  assetStatus: PetAssetStatus | null
  spriteDefinition: SpriteDefinition
}

export interface PersistImportedPetPayload extends ImportedPetRecord {
  assetFiles?: ImportedPetAssetFile[]
}

export function readImportedPets(): ImportedPetRecord[] {
  if (importedPetsCache) {
    return [...importedPetsCache]
  }

  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return []
    }

    const raw = window.localStorage.getItem(IMPORTED_PET_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    const records = parsed
      .map((entry) => normalizeImportedPetRecord(entry))
      .filter((entry): entry is ImportedPetRecord => Boolean(entry))
    importedPetsCache = records
    return [...records]
  } catch {
    return []
  }
}

export function writeImportedPets(records: ImportedPetRecord[]): ImportedPetRecord[] {
  const normalized = records
    .map((entry) => normalizeImportedPetRecord(entry))
    .filter((entry): entry is ImportedPetRecord => Boolean(entry))
  importedPetsCache = normalized

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(IMPORTED_PET_STORAGE_KEY, JSON.stringify(normalized))
    }
  } catch {
    // ignore persistence failures and still notify listeners
  }

  notifyImportedPets(normalized)
  return normalized
}

export function upsertImportedPet(record: ImportedPetRecord): ImportedPetRecord[] {
  const normalized = normalizeImportedPetRecord(record)
  if (!normalized) {
    return readImportedPets()
  }

  const current = readImportedPets().filter((entry) => entry.id !== normalized.id)
  current.push(normalized)
  current.sort((left, right) => left.name.localeCompare(right.name))
  return writeImportedPets(current)
}

export function removeImportedPet(id: string): ImportedPetRecord[] {
  return writeImportedPets(readImportedPets().filter((entry) => entry.id !== id))
}

export function subscribeImportedPets(listener: (records: ImportedPetRecord[]) => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const emitCurrent = () => listener(readImportedPets())
  const onStorage = (event: StorageEvent) => {
    if (event.key === IMPORTED_PET_STORAGE_KEY) {
      emitCurrent()
    }
  }
  const onInternal = (event: Event) => {
    const detail = (event as CustomEvent<ImportedPetRecord[]>).detail
    if (Array.isArray(detail)) {
      listener(
        detail
          .map((entry) => normalizeImportedPetRecord(entry))
          .filter((entry): entry is ImportedPetRecord => Boolean(entry)),
      )
      return
    }
    emitCurrent()
  }
  const onBroadcast = (event: MessageEvent<ImportedPetRecord[]>) => {
    const records = Array.isArray(event.data) ? event.data : []
    listener(
      records
        .map((entry) => normalizeImportedPetRecord(entry))
        .filter((entry): entry is ImportedPetRecord => Boolean(entry)),
    )
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(IMPORTED_PET_EVENT, onInternal as EventListener)
  getBroadcastChannel()?.addEventListener('message', onBroadcast as EventListener)

  emitCurrent()

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(IMPORTED_PET_EVENT, onInternal as EventListener)
    getBroadcastChannel()?.removeEventListener('message', onBroadcast as EventListener)
  }
}

export async function hydrateImportedPetsFromDisk() {
  if (!window.electronAPI?.listImportedPets) {
    return readImportedPets()
  }

  try {
    const diskRecords = await window.electronAPI.listImportedPets()
    const hydrated = diskRecords
      .map((entry: ImportedPetDiskPackage) => normalizeImportedPetDiskPackage(entry))
      .filter((entry: ImportedPetRecord | null): entry is ImportedPetRecord => Boolean(entry))

    writeImportedPets(hydrated)
    return hydrated
  } catch {
    return readImportedPets()
  }
}

export async function persistImportedPetRecord(record: PersistImportedPetPayload | ImportedPetRecord) {
  const normalized = normalizeImportedPetRecord(record)
  if (!normalized) {
    throw new Error('Invalid imported pet payload.')
  }

  if (!window.electronAPI?.saveImportedPet) {
    upsertImportedPet(normalized)
    return normalized
  }

  await window.electronAPI.saveImportedPet({
    ...normalized,
    assetFiles: 'assetFiles' in record ? record.assetFiles : undefined,
  })
  upsertImportedPet(normalized)
  return normalized
}

export function buildImportedPetAssetBasePath(petId: string): string {
  return `${IMPORTED_ASSET_PROTOCOL}/${encodeURIComponent(petId)}`
}

export function buildImportedPetAssetUrl(petId: string, relativePath: string): string {
  const normalizedPath = normalizeAssetRelativePath(relativePath)
  const encodedPath = normalizedPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${buildImportedPetAssetBasePath(petId)}/${encodedPath}`
}

export function importedPetToPackage(record: ImportedPetRecord): BuiltInPetPackage {
  const hasAtlasRuntime = Boolean(record.manifest.assets.atlas && record.productionProfile)
  const assetBasePath = buildImportedPetAssetBasePath(record.id)
  const atlasImageUrl = record.manifest.assets.atlas
    ? buildImportedPetAssetUrl(record.id, record.manifest.assets.atlas)
    : undefined

  const petPackage = buildPetPackageFromFiles({
    manifest: record.manifest,
    animations: record.animations,
    states: record.states,
    appearance: record.appearance,
    productionProfile: record.productionProfile,
    companionContent: record.companionContent,
    assetStatus: record.assetStatus ?? createDefaultImportedPetAssetStatus(hasAtlasRuntime),
    personality: record.personality,
    assetBasePath,
  })

  return {
    ...petPackage,
    runtimeAssets: hasAtlasRuntime
      ? {
          preferredSource: 'atlas',
          assetBasePath,
          atlasImageUrl,
        }
      : {
          preferredSource: 'procedural',
          assetBasePath,
        },
    spriteDefinition: record.spriteDefinition,
  }
}

export function buildImportedPetRecordFromSprite(input: {
  name: string
  spriteDefinition: SpriteDefinition
}): ImportedPetRecord {
  const idBase = slugify(input.name)
  const id = `imported.${idBase}`
  const importedAt = Date.now()

  const animations: PetAnimationConfig = {
    clips: Object.fromEntries(
      input.spriteDefinition.clips.map((clip) => [
        mapClipNameToPackageClip(clip.name),
        {
          type: 'procedural',
          fps: Math.max(
            1,
            Math.round(1000 / Math.max(clip.frames[0]?.duration ?? 120, 1)),
          ),
          loop: clip.loop,
          frames: clip.frames.map((_, index) => `${mapClipNameToPackageClip(clip.name)}_${index.toString().padStart(2, '0')}`),
        },
      ]),
    ),
  }

  const states: PetStatesConfig = {
    states: {
      idle: { baseClip: 'idle_loop', mode: 'observing', minHoldMs: 4000 },
      sleepy: { baseClip: 'sleep_loop', mode: 'quiet', minHoldMs: 9000 },
      happy: { baseClip: 'happy_react', fallbackClip: 'idle_loop', mode: 'reactive', minHoldMs: 2200 },
      thinking: { baseClip: 'thinking_loop', mode: 'quiet', minHoldMs: 5000 },
      coding: { baseClip: 'coding_loop', mode: 'focus_guardian', minHoldMs: 9000 },
      gaming: { baseClip: 'gaming_loop', mode: 'quiet', minHoldMs: 9000 },
      watching_video: { baseClip: 'watching_loop', mode: 'reactive', minHoldMs: 7000 },
      chatting: { baseClip: 'chatting_loop', mode: 'reactive', minHoldMs: 5000 },
      excited: { baseClip: 'excited_loop', fallbackClip: 'idle_loop', mode: 'proactive', minHoldMs: 2400 },
    },
  }

  return {
    id,
    name: input.name,
    importedAt,
    manifest: {
      id,
      name: input.name,
      version: '0.1.0',
      schemaVersion: '1.0.0',
      renderer: 'procedural-sprite',
      description: 'Imported custom pet package.',
      assets: {
        animations: 'embedded',
        states: 'embedded',
        personality: 'embedded',
        companionContent: 'embedded',
      },
      tags: ['imported', 'custom-pet'],
      capabilities: {
        ambientMicroMotion: false,
        proactiveChat: true,
        workModeSupport: true,
        importable: true,
      },
    },
    animations,
    states,
    appearance: null,
    personality: createDefaultImportedPetPersonality(input.name, id),
    companionContent: createDefaultImportedPetCompanionContent(input.name),
    productionProfile: null,
    assetStatus: createDefaultImportedPetAssetStatus(false),
    spriteDefinition: input.spriteDefinition,
  }
}

function normalizeImportedPetRecord(value: unknown): ImportedPetRecord | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<ImportedPetRecord>
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    !record.manifest ||
    !record.animations ||
    !record.states ||
    !record.spriteDefinition
  ) {
    return null
  }

  return {
    id: record.id,
    name: record.name,
    importedAt: typeof record.importedAt === 'number' ? record.importedAt : Date.now(),
    manifest: record.manifest,
    animations: record.animations,
    states: record.states,
    appearance: record.appearance ?? null,
    personality: record.personality ?? {},
    companionContent: record.companionContent ?? null,
    productionProfile: record.productionProfile ?? null,
    assetStatus: record.assetStatus ?? null,
    spriteDefinition: record.spriteDefinition,
  }
}

function normalizeImportedPetDiskPackage(value: unknown): ImportedPetRecord | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<ImportedPetDiskPackage>

  return normalizeImportedPetRecord({
    id: record.id,
    name: record.name,
    importedAt: record.importedAt,
    manifest: record.manifest,
    animations: record.animations,
    states: record.states,
    appearance: record.appearance ?? null,
    personality: record.personality,
    companionContent: record.companionContent ?? null,
    productionProfile: record.productionProfile ?? null,
    assetStatus: record.assetStatus ?? null,
    spriteDefinition: record.spriteDefinition,
  })
}

function notifyImportedPets(records: ImportedPetRecord[]) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(IMPORTED_PET_EVENT, { detail: records }))
  }
  getBroadcastChannel()?.postMessage(records)
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!broadcastChannel) {
    try {
      broadcastChannel = new BroadcastChannel(IMPORTED_PET_CHANNEL)
    } catch {
      broadcastChannel = null
    }
  }
  return broadcastChannel
}

function slugify(value: string): string {
  return slugifyImportedPetName(value)
}

function normalizeAssetRelativePath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
    .join('/')
}

function mapClipNameToPackageClip(name: string): string {
  switch (name) {
    case 'IDLE':
      return 'idle_loop'
    case 'WALK':
      return 'drag'
    case 'THINKING':
      return 'thinking_loop'
    case 'CODING':
      return 'coding_loop'
    case 'HAPPY':
      return 'happy_react'
    case 'SLEEPING':
      return 'sleep_loop'
    case 'WATCHING':
      return 'watching_loop'
    case 'CHATTING':
      return 'chatting_loop'
    case 'GAMING':
      return 'gaming_loop'
    case 'EXCITED':
      return 'excited_loop'
    default:
      return 'idle_loop'
  }
}
