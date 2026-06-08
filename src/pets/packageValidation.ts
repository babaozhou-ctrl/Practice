import type {
  PetAnimationConfig,
  PetCompanionContentProfile,
  PetPackageManifest,
  PetProductionProfile,
  PetStatesConfig,
} from '../shared/types/petPackage'
import type { SpriteDefinition } from '../types/animation'

const SUPPORTED_SCHEMA_VERSIONS = new Set(['1.0.0'])
const SUPPORTED_RENDERERS = new Set(['pixi-atlas', 'procedural-sprite'])
const REQUIRED_JSON_ASSETS: Array<{ key: keyof PetPackageManifest['assets']; label: string }> = [
  { key: 'animations', label: 'animations.json' },
  { key: 'states', label: 'states.json' },
  { key: 'personality', label: 'personality.json' },
]

const OPTIONAL_JSON_ASSETS: Array<{ key: keyof PetPackageManifest['assets']; label: string }> = [
  { key: 'companionContent', label: 'companion-content.json' },
  { key: 'appearance', label: 'appearance.json' },
  { key: 'productionProfile', label: 'production.json' },
  { key: 'assetStatus', label: 'asset-status.json' },
]

const REQUIRED_PROACTIVE_KEYS = [
  'focusEnding',
  'breakEnding',
  'overworkFirm',
  'overworkGentle',
  'productiveSession',
  'lateNight',
  'watchTogether',
  'gentleIdle',
] as const

interface ValidateImportedPetPackageInput {
  manifest: PetPackageManifest
  animations: PetAnimationConfig
  states: PetStatesConfig
  companionContent?: PetCompanionContentProfile | null
  productionProfile?: PetProductionProfile | null
  spriteDefinition?: SpriteDefinition | null
  availableRelativePaths: string[]
}

export function validateImportedPetPackage(input: ValidateImportedPetPackageInput) {
  const errors: string[] = []
  const { manifest, animations, states, companionContent, productionProfile, spriteDefinition } = input
  const availablePaths = new Set(input.availableRelativePaths.map(normalizeRelativePath))

  validateManifest(manifest, availablePaths, errors)
  validateRenderSource(manifest, productionProfile, spriteDefinition, errors)
  validateAnimations(animations, errors)
  validateStates(states, animations, errors)
  validateCompanionContent(companionContent, errors)

  if (
    manifest.assets.atlas &&
    productionProfile?.atlas?.file &&
    normalizeRelativePath(manifest.assets.atlas) !== normalizeRelativePath(productionProfile.atlas.file)
  ) {
    errors.push(
      `manifest.json 里的 atlas 路径（${manifest.assets.atlas}）和 production.json 里的 atlas.file（${productionProfile.atlas.file}）不一致。`,
    )
  }

  if (errors.length > 0) {
    throw new Error(['宠物包校验未通过：', ...errors.map((item) => `- ${item}`)].join('\n'))
  }
}

function validateManifest(
  manifest: PetPackageManifest,
  availablePaths: Set<string>,
  errors: string[],
) {
  if (!manifest.id?.trim()) {
    errors.push('manifest.json 缺少非空的 id。')
  }
  if (!manifest.name?.trim()) {
    errors.push('manifest.json 缺少非空的 name。')
  }
  if (!manifest.version?.trim()) {
    errors.push('manifest.json 缺少非空的 version。')
  }
  if (!manifest.schemaVersion?.trim()) {
    errors.push('manifest.json 缺少非空的 schemaVersion。')
  } else if (!SUPPORTED_SCHEMA_VERSIONS.has(manifest.schemaVersion.trim())) {
    errors.push(
      `当前只支持 schemaVersion=${Array.from(SUPPORTED_SCHEMA_VERSIONS).join(', ')}，收到的是 ${manifest.schemaVersion}。`,
    )
  }

  if (!manifest.renderer?.trim()) {
    errors.push('manifest.json 缺少非空的 renderer。')
  } else if (!SUPPORTED_RENDERERS.has(manifest.renderer.trim())) {
    errors.push(
      `renderer 目前只支持 ${Array.from(SUPPORTED_RENDERERS).join(' / ')}，收到的是 ${manifest.renderer}。`,
    )
  }

  for (const asset of REQUIRED_JSON_ASSETS) {
    const relativePath = manifest.assets[asset.key]
    if (!relativePath?.trim()) {
      errors.push(`manifest.json 必须声明 ${asset.label} 的路径。`)
      continue
    }
    if (!availablePaths.has(normalizeRelativePath(relativePath))) {
      errors.push(`manifest.json 声明了 ${asset.label}（${relativePath}），但导入文件里没有找到它。`)
    }
  }

  for (const asset of OPTIONAL_JSON_ASSETS) {
    const relativePath = manifest.assets[asset.key]
    if (!relativePath?.trim()) {
      continue
    }
    if (!availablePaths.has(normalizeRelativePath(relativePath))) {
      errors.push(`manifest.json 声明了 ${asset.label}（${relativePath}），但导入文件里没有找到它。`)
    }
  }

  if (manifest.assets.atlas?.trim() && !availablePaths.has(normalizeRelativePath(manifest.assets.atlas))) {
    errors.push(`manifest.json 声明了 atlas 资源（${manifest.assets.atlas}），但导入文件里没有找到它。`)
  }

  if (
    manifest.assets.previewImage?.trim() &&
    !availablePaths.has(normalizeRelativePath(manifest.assets.previewImage))
  ) {
    errors.push(`manifest.json 声明了 previewImage（${manifest.assets.previewImage}），但导入文件里没有找到它。`)
  }
}

function validateRenderSource(
  manifest: PetPackageManifest,
  productionProfile: PetProductionProfile | null | undefined,
  spriteDefinition: SpriteDefinition | null | undefined,
  errors: string[],
) {
  if (manifest.renderer === 'pixi-atlas') {
    if (!manifest.assets.atlas?.trim()) {
      errors.push('renderer=pixi-atlas 时，manifest.json 必须提供 atlas 资源路径。')
    }
    if (!productionProfile) {
      errors.push('renderer=pixi-atlas 的完整宠物包必须提供 production.json。')
    }
  }

  if (manifest.renderer === 'procedural-sprite' && !spriteDefinition) {
    errors.push('renderer=procedural-sprite 时，宠物包必须提供 sprite-definition.json。')
  }

  if (!manifest.assets.atlas?.trim() && !spriteDefinition) {
    errors.push('宠物包至少要提供一种可渲染资源：sprite-atlas.png 或 sprite-definition.json。')
  }
}

function validateAnimations(animations: PetAnimationConfig, errors: string[]) {
  const clipEntries = Object.entries(animations.clips ?? {})
  if (clipEntries.length === 0) {
    errors.push('animations.json 至少需要定义一个 clip。')
    return
  }

  for (const [clipName, clip] of clipEntries) {
    if (!Array.isArray(clip.frames) || clip.frames.length === 0) {
      errors.push(`clip "${clipName}" 至少需要一帧。`)
    }
    if (typeof clip.fps !== 'number' || !Number.isFinite(clip.fps) || clip.fps <= 0) {
      errors.push(`clip "${clipName}" 的 fps 必须是大于 0 的数字。`)
    }
    if (clip.frameDurationsMs) {
      if (!Array.isArray(clip.frameDurationsMs) || clip.frameDurationsMs.length !== clip.frames.length) {
        errors.push(`clip "${clipName}" 的 frameDurationsMs 数量必须和 frames 一一对应。`)
      } else if (clip.frameDurationsMs.some((value) => typeof value !== 'number' || value <= 0)) {
        errors.push(`clip "${clipName}" 的 frameDurationsMs 必须全部是大于 0 的数字。`)
      }
    }
  }
}

function validateStates(
  states: PetStatesConfig,
  animations: PetAnimationConfig,
  errors: string[],
) {
  const stateEntries = Object.entries(states.states ?? {})
  if (stateEntries.length === 0) {
    errors.push('states.json 至少需要定义一个状态。')
    return
  }

  if (!states.states?.idle) {
    errors.push('states.json 必须至少提供 idle 状态。')
  }

  for (const [stateKey, state] of stateEntries) {
    validateStateClipReference(`状态 ${stateKey}`, state.baseClip, animations, errors)
    if (state.fallbackClip) {
      validateStateClipReference(`状态 ${stateKey} 的 fallbackClip`, state.fallbackClip, animations, errors)
    }

    for (const [fromStateKey, transition] of Object.entries(state.transitions ?? {})) {
      if (transition.viaState && !states.states[transition.viaState]) {
        errors.push(`状态 ${stateKey} 的 transition "${fromStateKey}" 引用了不存在的 viaState: ${transition.viaState}。`)
      }
      if (transition.clipName && !animations.clips[transition.clipName]) {
        errors.push(`状态 ${stateKey} 的 transition "${fromStateKey}" 引用了不存在的 clip: ${transition.clipName}。`)
      }
    }
  }

  for (const [transientKey, transientState] of Object.entries(states.transientStates ?? {})) {
    if (!transientState) continue
    validateStateClipReference(`瞬时状态 ${transientKey}`, transientState.baseClip, animations, errors)
    if (transientState.fallbackClip) {
      validateStateClipReference(
        `瞬时状态 ${transientKey} 的 fallbackClip`,
        transientState.fallbackClip,
        animations,
        errors,
      )
    }
  }
}

function validateCompanionContent(
  companionContent: PetCompanionContentProfile | null | undefined,
  errors: string[],
) {
  if (!companionContent) {
    return
  }

  if (!companionContent.version?.trim()) {
    errors.push('companion-content.json 缺少非空的 version。')
  }

  for (const key of REQUIRED_PROACTIVE_KEYS) {
    const entry = companionContent.proactive?.[key]
    if (!entry) {
      errors.push(`companion-content.json 缺少 proactive.${key}。`)
      continue
    }

    if (!entry.title?.trim()) {
      errors.push(`companion-content.json 的 proactive.${key}.title 不能为空。`)
    }
    if (!Array.isArray(entry.actions) || entry.actions.length === 0) {
      errors.push(`companion-content.json 的 proactive.${key}.actions 至少要有一个动作。`)
      continue
    }

    for (const action of entry.actions) {
      if (!action.id?.trim() || !action.label?.trim() || !action.prompt?.trim()) {
        errors.push(`companion-content.json 的 proactive.${key}.actions 里存在缺少 id/label/prompt 的动作。`)
        break
      }
    }
  }
}

function validateStateClipReference(
  label: string,
  clipName: string,
  animations: PetAnimationConfig,
  errors: string[],
) {
  if (!clipName?.trim()) {
    errors.push(`${label} 缺少有效的 baseClip。`)
    return
  }

  if (!animations.clips[clipName]) {
    errors.push(`${label} 引用了不存在的 clip: ${clipName}。`)
  }
}

function normalizeRelativePath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
    .join('/')
}
