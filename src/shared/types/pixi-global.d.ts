import type { SpriteDefinition } from '../../types/animation'
import type { CompanionActionPayload } from '../../ai/CompanionActionBridge'
import type { CompanionFeedAnalysisPayload } from '../../ai/CompanionFeedBridge'
import type { CompanionUtterancePayload } from '../../ai/CompanionUtteranceBridge'
import type { AIConfig } from '../../types/chat'
import type { PluginAIChatExecutionRequest } from '../../plugins/types'
import type { PluginDiscoveryRecord } from '../../plugins/runtime/types'
import type {
  PetAnimationConfig,
  PetAppearanceProfile,
  PetAssetStatus,
  PetCompanionContentProfile,
  PetPackageManifest,
  PetPersonalityProfile,
  PetProductionProfile,
  PetStatesConfig,
} from './petPackage'

interface ImportedPetDiskPackage {
  id: string
  name: string
  importedAt: number
  manifest: PetPackageManifest
  animations: PetAnimationConfig
  states: PetStatesConfig
  personality: PetPersonalityProfile
  spriteDefinition: SpriteDefinition
  appearance?: PetAppearanceProfile | null
  companionContent?: PetCompanionContentProfile | null
  assetStatus?: PetAssetStatus | null
  productionProfile?: PetProductionProfile | null
}

declare global {
  interface Window {
    BroadcastChannel?: typeof BroadcastChannel
    PIXI?: any
    electronAPI?: {
      movePet?: (x: number, y: number) => void
      getPosition?: () => Promise<{ x: number; y: number }>
      toggleClickThrough?: () => void
      openChat?: () => void
      openSettings?: () => void
      onShowChat?: (callback: () => void) => void
        getRuntimeFlags?: () => Promise<{
          smokeTarget: string | null
          scenario: string | null
          isDev: boolean
          smokeRunId: string | null
          automationRunId: string | null
          autoExitMs: number | null
        }>
      emitCompanionFeedBridgePayload?: (payload: CompanionFeedAnalysisPayload) => void
      readCompanionFeedBridgeHistory?: () => Promise<CompanionFeedAnalysisPayload[]>
      onCompanionFeedBridgePayload?: (callback: (payload: CompanionFeedAnalysisPayload) => void) => void
      emitCompanionActionBridgePayload?: (payload: CompanionActionPayload) => void
      onCompanionActionBridgePayload?: (callback: (payload: CompanionActionPayload) => void) => void
      emitCompanionUtteranceBridgePayload?: (payload: CompanionUtterancePayload) => void
        onCompanionUtteranceBridgePayload?: (callback: (payload: CompanionUtterancePayload) => void) => void
        emitSmokeCheckpoint?: (label: string) => void
        emitAutomationMetricsEvent?: (payload: unknown) => void
        hideUIWindow?: () => void
      quitApp?: () => void
      capturePrimaryScreen?: () => Promise<string | null>
      extractDocumentText?: (payload: {
        fileName: string
        mimeType?: string
        buffer: ArrayBuffer | Uint8Array
      }) => Promise<string>
      runPluginFileAnalysis?: (payload: {
        providerId: string
        fileName: string
        content: string
      }) => Promise<string>
      runPluginAIChat?: (
        payload: PluginAIChatExecutionRequest,
        onChunk?: (chunk: string) => void,
      ) => Promise<string>
      runPluginAISummary?: (payload: {
        providerId: string
        config: AIConfig
        fileName: string
        content: string
      }) => Promise<string>
      runPluginScreenCapture?: (payload: {
        providerId: string
      }) => Promise<string | null>
      runPluginScreenOCR?: (payload: {
        providerId: string
        imageData: string
      }) => Promise<string>
      runPluginScreenLocalVision?: (payload: {
        providerId: string
        imageData: string
      }) => Promise<string>
      runPluginScreenCloudVision?: (payload: {
        providerId: string
        imageData: string
      }) => Promise<string>
      runPluginAIHealthCheck?: (payload: {
        providerId: string
        config: AIConfig
      }) => Promise<{ ok: boolean; message: string }>
      cancelPluginAIChat?: (requestId: string) => Promise<boolean>
      onSpeech?: (callback: (msg: string, dur: number) => void) => void
      onContextUpdate?: (callback: (info: { title: string; process: string; idleMs?: number }) => void) => void
      listImportedPets?: () => Promise<ImportedPetDiskPackage[]>
      saveImportedPet?: (record: unknown) => Promise<unknown>
      listLocalPlugins?: () => Promise<PluginDiscoveryRecord[]>
    }
  }
}

export {}
