import type { AnimationState, SpriteDefinition } from '../../types/animation'
import type { CompanionSnapshot } from '../../domain/companion/types'

export type PetCapabilityKey =
  | 'speechBubbleAnchor'
  | 'emoteOverlay'
  | 'ambientMicroMotion'
  | 'fileAnalysis'
  | 'screenPerception'
  | 'proactiveChat'
  | 'workModeSupport'
  | 'importable'

export type PetCapabilityMap = Partial<Record<PetCapabilityKey, boolean>>

export interface PetPackageManifest {
  id: string
  name: string
  version: string
  schemaVersion: string
  renderer: string
  description?: string
  assets: {
    atlas?: string
    previewImage?: string
    animations: string
    states: string
    personality: string
    companionContent?: string
    appearance?: string
    artPrompts?: string
    productionProfile?: string
    assetStatus?: string
    spriteGuide?: string
  }
  tags?: string[]
  capabilities?: PetCapabilityMap
}

export interface PetPersonalityProfile {
  id?: string
  name?: string
  identity?: {
    role?: string
    presence?: string[]
    responseStyle?: string[]
  }
  tone?: {
    style?: string[]
    verbosity?: string
    emojiUsage?: string
    affectionLevel?: number
  }
  speechRules?: {
    avoidAssistantTone?: boolean
    preferCompanionTone?: boolean
    defaultProactiveFrequency?: string
    respectFocusMode?: boolean
    respectGamingQuietMode?: boolean
  }
  contextBehaviors?: Record<
    string,
    {
      tone?: string
      samplePrompts?: string[]
    }
  >
  promptDirectives?: {
    core?: string[]
    avoid?: string[]
    do?: string[]
  }
  memoryPolicy?: {
    rememberPreferences?: boolean
    rememberRituals?: boolean
    rememberSensitiveDataByDefault?: boolean
  }
}

export interface PetRuntimeAssetConfig {
  preferredSource: 'atlas' | 'procedural'
  assetBasePath?: string
  atlasImageUrl?: string
}

export interface PetAnimationClipConfig {
  type: string
  fps: number
  loop: boolean
  frames: string[]
  frameDurationsMs?: number[]
  additive?: string[]
  motionProfile?: PetClipMotionProfile
}

export interface PetClipMotionProfile {
  restOffsetY?: number
  bouncePx?: number
  bouncePeriodMs?: number
  bounceStyle?: 'sin' | 'pulse'
  swayPx?: number
  swayPeriodMs?: number
  rotateDeg?: number
  rotatePeriodMs?: number
  scaleYAmount?: number
  scaleYPeriodMs?: number
  settleAlpha?: number
}

export interface PetMicroMotionBreath {
  target: 'body'
  offsetY: number[]
  durationMs: number
}

export interface PetMicroMotionBlink {
  target: 'eyes'
  intervalMs: [number, number]
  holdMs: number
}

export interface PetMicroMotionEarTwitch {
  target: 'ears'
  intervalMs: [number, number]
  rotationDeg: number[]
}

export interface PetMicroMotionTailSway {
  target: 'tail'
  rotationDeg: number[]
  durationMs: number
}

export interface PetMicroMotionCenterShift {
  target: 'root'
  offsetX: number[]
  durationMs: number
}

export type PetMicroMotionConfig =
  | PetMicroMotionBreath
  | PetMicroMotionBlink
  | PetMicroMotionEarTwitch
  | PetMicroMotionTailSway
  | PetMicroMotionCenterShift

export interface PetAnimationConfig {
  clips: Record<string, PetAnimationClipConfig>
  microMotions?: Record<string, PetMicroMotionConfig | undefined>
}

export interface PetStateConfig {
  baseClip: string
  fallbackClip?: string
  resumeResolvedState?: boolean
  mode: string
  minHoldMs: number
  transitions?: Record<string, PetStateTransitionConfig>
}

export interface PetStatesConfig {
  states: Record<string, PetStateConfig>
  transientStates?: Partial<Record<'welcome_back' | 'dragging' | 'tap_affection', PetStateConfig>>
}

export interface PetStateTransitionConfig {
  viaState?: string
  clipName?: string
}

export interface PetAppearanceProfile {
  id: string
  displayName: string
  archetype: string
  summary: string
  palette: Record<string, string>
  silhouette?: {
    bodyType?: string
    poseBias?: string
    mustKeep?: string[]
    avoid?: string[]
  }
  face?: Record<string, string>
  hair?: Record<string, string>
  ears?: Record<string, string>
  outfit?: Record<string, string>
  renderRules?: Record<string, unknown>
}

export interface PetProductionProfile {
  version: string
  sourceOfTruth: string
  visualIntent: {
    style: string
    scaleReadability: string
    emotionPriority: string[]
  }
  atlas: {
    file: string
    cellWidth: number
    cellHeight: number
    columns: number
    rows: number
    safePadding: number
    rowOrder: string[]
    clipFrameCounts: Record<string, number>
  }
  anchors: {
    speechBubble: { x: number; y: number }
    dragHandle: { x: number; y: number }
    interactionFocus: { x: number; y: number }
    tailPivot: { x: number; y: number }
    earLeft: { x: number; y: number }
    earRight: { x: number; y: number }
  }
  expressionLanguage: Record<
    string,
    {
      eyes: string
      mouth: string
      ears: string
      tail: string
      body: string
    }
  >
  deliveryChecklist: string[]
}

export interface PetCompanionContentAction {
  id: string
  label: string
  prompt: string
}

export interface PetCompanionProactiveSpeechEntry {
  message: string
  durationMs?: number
}

export interface PetCompanionContentEntry {
  title: string
  actions: PetCompanionContentAction[]
  speech?: PetCompanionProactiveSpeechEntry
}

export interface PetCompanionProactiveTemplateContext {
  petName: string
  preferredName?: string | null
  sceneLabel?: string | null
  sharedAttention?: string | null
  recentTopic?: string | null
  recentFileName?: string | null
  ritual?: string | null
  activeWindowTitle?: string | null
  workModeLabel?: string | null
}

export interface PetCompanionFeedCardProfile {
  confirmTitle: string
  thinkingTitle: string
  resultTitle: string
  errorTitle: string
  confirmAcceptLabel: string
  confirmRejectLabel: string
  resultOpenChatLabel: string
  resultLaterLabel: string
  confirmBody: string
  thinkingBody: string
  resultBody: string
}

export interface PetCompanionFileAnalysisProfile {
  desktopUtterance: string
  desktopUtteranceByTone?: Record<string, string>
}

export interface PetCompanionBridgeSequenceStep {
  state: 'IDLE' | 'HAPPY' | 'THINKING' | 'EXCITED'
  holdMs: number
}

export interface PetCompanionBridgeMotionProfile {
  focusToBreak?: PetCompanionBridgeSequenceStep[]
  breakToFocus?: PetCompanionBridgeSequenceStep[]
  focusToWatch?: PetCompanionBridgeSequenceStep[]
  watchToFocus?: PetCompanionBridgeSequenceStep[]
}

export interface PetCompanionContentProfile {
  version: string
  proactive: {
    focusEnding: PetCompanionContentEntry
    breakEnding: PetCompanionContentEntry
    overworkFirm: PetCompanionContentEntry
    overworkGentle: PetCompanionContentEntry
    productiveSession: PetCompanionContentEntry
    lateNight: PetCompanionContentEntry
    watchTogether: PetCompanionContentEntry
    socialCorner: PetCompanionContentEntry
    recentFileCheckin: PetCompanionContentEntry
    gentleIdle: PetCompanionContentEntry
  }
  feedCard?: PetCompanionFeedCardProfile
  fileAnalysis?: PetCompanionFileAnalysisProfile
  bridgeMotions?: PetCompanionBridgeMotionProfile
}

export interface PetAssetStatus {
  packageStage: 'placeholder-runtime' | 'hybrid' | 'production-ready'
  referenceAligned: boolean
  atlasReady: boolean
  runtimeFallbackEnabled: boolean
  speechToneReady: boolean
  pendingWork: string[]
}

export interface BuiltInPetPackage {
  manifest: PetPackageManifest
  animations: PetAnimationConfig
  states: PetStatesConfig
  appearance: PetAppearanceProfile | null
  productionProfile: PetProductionProfile | null
  companionContent: PetCompanionContentProfile | null
  assetStatus: PetAssetStatus | null
  runtimeAssets: PetRuntimeAssetConfig
  personality: PetPersonalityProfile
  spriteDefinition: SpriteDefinition
  bindings: {
    clipToAnimationState: Record<string, AnimationState>
  }
}

export interface ResolvedPetFallback {
  clipName: string
  animationState: AnimationState
  loop: boolean
  additive: string[]
  motionProfile: PetClipMotionProfile | null
  microMotions: Record<string, PetMicroMotionConfig>
}

export interface ResolvedPetTransitionPlayback {
  petStateKey: string
  clipName: string
  animationState: AnimationState
  loop: boolean
  additive: string[]
  motionProfile: PetClipMotionProfile | null
  microMotions: Record<string, PetMicroMotionConfig>
}

export interface ResolvedPetPresentation {
  petStateKey: string
  clipName: string
  animationState: AnimationState
  loop: boolean
  mode: string
  minHoldMs: number
  additive: string[]
  motionProfile: PetClipMotionProfile | null
  microMotions: Record<string, PetMicroMotionConfig>
  fallback: ResolvedPetFallback | null
  transitionsFrom: Record<string, ResolvedPetTransitionPlayback>
  snapshot: CompanionSnapshot
}
