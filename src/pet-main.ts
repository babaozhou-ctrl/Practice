import { emitCompanionAction } from './ai/CompanionActionBridge'
import { emitCompanionFeedAnalysisResult } from './ai/CompanionFeedBridge'
import {
  captureCompanionRuntimeContext,
  readCompanionMemory,
  subscribeCompanionMemory,
} from './ai/CompanionMemoryStore'
import { subscribeCompanionUtterance } from './ai/CompanionUtteranceBridge'
import {
  readScreenPerceptionSnapshot,
  startScreenPerceptionLoop,
  stopScreenPerceptionLoop,
  subscribeScreenPerception,
} from './context/ScreenPerceptionSync'
import { classifyActivity } from './context/ActivityClassifier'
import { useContextStore } from './store/contextStore'
import {
  buildCompanionBriefSummary,
  buildCompanionDesktopSummary,
  buildFileAnalysisUtterance,
} from './ai/CompanionDesktopSummary'
import { buildCompanionChatContext } from './ai/CompanionContextAdapter'
import { buildCompanionActionPayload } from './domain/companion/CompanionActionContent'
import { CompanionBehaviorStabilizer } from './domain/companion/CompanionBehaviorStabilizer'
import { CompanionSpeechPolicy, type SpeechSource } from './domain/companion/CompanionSpeechPolicy'
import { CompanionStateMachine } from './domain/companion/CompanionStateMachine'
import { ProactiveInteractionScheduler } from './domain/companion/ProactiveInteractionScheduler'
import { attachWorkModeToSnapshot } from './domain/companion/attachWorkModeToSnapshot'
import { normalizeCompanionSnapshot } from './domain/companion/normalizeCompanionSnapshot'
import type { CompanionSnapshot } from './domain/companion/types'
import { readCompanionPreferencesState, subscribeCompanionPreferences } from './preferences/CompanionPreferencesStore'
import { subscribeSelectedPet } from './pets/PetSelectionStore'
import { loadPetPackageById } from './pets/registry/builtInPetRegistry'
import { resolvePetPresentation } from './pets/loader/resolvePetPresentation'
import { resolveSelectedPetPackage } from './pets/resolveSelectedPetPackage'
import { ensurePluginProviderStoreSubscription } from './plugins/PluginProviderStore'
import { PetDragController } from './rendering/controllers/PetDragController'
import { PixiPetRuntime } from './rendering/pixi/PixiPetRuntime'
import { buildRuntimeTextureSetForPetPackage } from './rendering/pixi/pixelTextureFactory'
import { ensurePixiLoaded } from './rendering/pixi/pixiVendor'
import {
  readCompanionSettingsPreviewState,
  subscribeCompanionSettingsPreview,
  type CompanionSettingsPreviewState,
} from './settings/CompanionSettingsPreviewStore'
import { analyzeFileForCompanionFeed, buildFeedFollowUpActionsForScene } from './services/companionFeedAnalysis'
import type { PetCompanionContentProfile } from './shared/types/petPackage'
import type { BuiltInPetPackage } from './shared/types/petPackage'
import { readChatRuntimeState, subscribeChatRuntimeState, type ChatRuntimeState } from './store/chatStore'
import { readWorkModeState, subscribeWorkMode } from './workmode/WorkModeStore'
import { WorkModeRuntime } from './workmode/WorkModeRuntime'

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) {
    throw new Error(`Missing required element: #${id}`)
  }
  return element as T
}

const LATE_NIGHT_MESSAGE = '已经有点晚了。我会安静陪着你，也想轻轻提醒你早点休息。'
const DESKTOP_GREETING = '我已经在桌面这边待好了，今天也会好好陪着你。'
const DEFAULT_SPEECH_KICKER = '安静陪着'
const FEED_CONFIRM_SEQUENCE = [
  { state: 'HAPPY' as const, holdMs: 520 },
  { state: 'THINKING' as const, holdMs: 420 },
]
const FEED_THINKING_SEQUENCE = [
  { state: 'HAPPY' as const, holdMs: 280 },
  { state: 'THINKING' as const },
]
const FEED_RESULT_SEQUENCE = [
  { state: 'EXCITED' as const, holdMs: 560 },
  { state: 'HAPPY' as const, holdMs: 860 },
  { state: 'IDLE' as const, holdMs: 340 },
]
const FEED_ERROR_SEQUENCE = [
  { state: 'THINKING' as const, holdMs: 320 },
  { state: 'IDLE' as const, holdMs: 520 },
]
const PREVIEW_APPLIED_SEQUENCE = [
  { state: 'HAPPY' as const, holdMs: 420 },
  { state: 'EXCITED' as const, holdMs: 320 },
  { state: 'IDLE' as const, holdMs: 280 },
]
const PREVIEW_DISMISSED_SEQUENCE = [
  { state: 'THINKING' as const, holdMs: 260 },
  { state: 'IDLE' as const, holdMs: 360 },
]
const DEFAULT_SCENE_SHIFT_TO_BREAK_SEQUENCE = [
  { state: 'HAPPY' as const, holdMs: 240 },
  { state: 'IDLE' as const, holdMs: 200 },
]
const DEFAULT_SCENE_SHIFT_TO_FOCUS_SEQUENCE = [
  { state: 'IDLE' as const, holdMs: 220 },
]
const FEED_THINKING_LINES = [
  '那我先抱走啦，稍微想一想。',
  '好哦，我先替你看一会儿。',
  '先交给我吧，我帮你顺一遍。',
]

type SpeechTone = 'quiet' | 'focus' | 'warm' | 'playful'
type FeedCardMode = 'confirm' | 'thinking' | 'done'

interface SpeechPresentation {
  tone: SpeechTone
  kicker: string
}

interface FeedCardController {
  showConfirm(file: File, onAccept: () => void, onReject: () => void): void
  showThinking(fileName: string): void
  showResult(fileName: string, desktopSummary: string, onOpenChat: () => void): void
  showError(message: string): void
  setDragActive(active: boolean): void
  setCopy(copy: FeedCardCopy): void
  hide(): void
  destroy(): void
}

interface FeedCardCopy {
  petName: string
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

function normalizeSpeechAnchor(
  anchor: { x?: number; y?: number } | null | undefined,
): { x: number; y: number } | null {
  if (!anchor) {
    return null
  }

  const { x, y } = anchor
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }

  const safeX = x as number
  const safeY = y as number

  return {
    x: Math.min(1, Math.max(0, safeX)),
    y: Math.min(1, Math.max(0, safeY)),
  }
}

interface RuntimeCompanionState {
  lowDistractionMode: boolean
  chatRuntimeState: ChatRuntimeState
  previewState: CompanionSettingsPreviewState
}

type ExternalSpeechTier = 'ambient' | 'response' | 'result'

interface SpeechPolicyOptions {
  externalTier?: ExternalSpeechTier
}

type CompanionBridgeSequence = Array<{ state: 'IDLE' | 'HAPPY' | 'THINKING' | 'EXCITED'; holdMs: number }>

const EXTERNAL_AMBIENT_IDLE_SUPPRESSION_MS = 90_000

function randomFrom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function emitAutomationMetricEvent(
  name: string,
  options?: {
    value?: number
    tags?: Record<string, string | number | boolean | null>
  },
) {
  window.electronAPI?.emitAutomationMetricsEvent?.({
    name,
    value: options?.value,
    tags: options?.tags,
  })
}

function emitRuntimeTextureSourceMetric(
  petPackage: BuiltInPetPackage,
  textureSet: {
    source: 'atlas' | 'procedural'
    preferredSource: 'atlas' | 'procedural'
    fallbackReason: string | null
    atlasImageUrl: string | null
  },
  phase: 'initial' | 'replace',
) {
  emitAutomationMetricEvent('runtime.texture-source', {
    tags: {
      phase,
      petId: petPackage.manifest.id,
      petName: petPackage.manifest.name,
      source: textureSet.source,
      preferredSource: textureSet.preferredSource,
      fallbackReason: textureSet.fallbackReason,
      runtimeFallbackEnabled: petPackage.assetStatus?.runtimeFallbackEnabled ?? null,
      atlasImageUrl: textureSet.atlasImageUrl,
    },
  })
}

function sanitizeDesktopTextStable(value: string): string {
  return sanitizeDesktopText(value)
    .replace(/鎴戝厛鐪嬭繃浜\?/g, '让我看看')
    .replace(/瑕佸杺缁欐垜鍚\?/g, '要喂给我吗')
    .replace(/鎴戜篃鏈夊湪鐣欐剰浣犵溂鍓嶇殑鍐呭銆俙/g, '我也有在留意你眼前的内容。')
    .replace(/宸茬粡鍦ㄨ繖鍎夸簡/g, '已经在这儿了')
    .replace(/娆㈣繋鍥炴潵/g, '欢迎回来')
    .replace(/锛\?/g, '，')
    .replace(/銆俙/g, '。')
}

function sanitizeDesktopText(value: string): string {
  return value
    .replace(/宸茬粡鍠傜粰鎴戜簡/g, '已经喂给我了')
    .replace(/娌℃帴绋?/g, '没接稳')
    .replace(/杩欐鎴戞病鎺ュソ锛屽啀缁欐垜涓€娆″氨濂姐€?/g, '这次我没接好，再给我一次就好。')
    .replace(/瑕佹妸杩欎釜鍠傜粰鎴戝悧锛?/g, '要把这个喂给我吗？')
    .replace(/瑕佸杺缁欐垜鍚?/g, '要喂给我吗')
    .replace(/鎴戝厛鐪嬭繃浜?/g, '我先看过了')
    .replace(/鎽告懜鏀跺埌/g, '摸摸收到')
    .replace(/浣犲洖鏉ュ暒/g, '你回来啦')
    .replace(/璺熺潃浣犺蛋/g, '跟着你走')
    .replace(/瀹夐潤闄啓/g, '安静陪写')
    .replace(/涓撳績涓€鐐?/g, '专心一点')
    .replace(/闄綘鐩潃/g, '陪你盯着')
    .replace(/涓€璧疯鐫€/g, '一起读着')
    .replace(/闄綘涓€璧风湅/g, '陪你一起看')
    .replace(/鍦ㄤ綘鏃佽竟/g, '在你旁边')
    .replace(/鎮勬倓鍥磋/g, '悄悄围观')
    .replace(/澶滄繁鍟?/g, '夜深啦')
    .replace(/瀹夐潤闄潃/g, '安静陪着')
    .replace(/鎱㈡參鐪嬬湅/g, '慢慢看看')
    .replace(/闄綘寰呯潃/g, '陪你待着')
    .replace(/鏇夸綘鐪嬩綅/g, '替你看位')
    .replace(/杞昏交鎻愰啋/g, '轻轻提醒')
    .replace(/鏈夌偣寮€蹇?/g, '有点开心')
    .replace(/灏忓０鍥炲簲/g, '小声回应')
    .replace(/鎺ヤ綇鏂囦欢鍟/g, '接住文件啦')
    .replace(/姝ｅ湪鐪嬪憿/g, '正在看呢')
    .replace(/鎵撳紑鑱婂ぉ/g, '打开聊天')
    .replace(/鎵撳紑璁剧疆/g, '打开设置')
    .replace(/鍒囨崲绌块€?/g, '切换穿透')
    .replace(/閫€鍑?Deep Pet/g, '退出 Deep Pet')
    .replace(/鍏堜笉鍠備簡/g, '先不喂了')
    .replace(/鍠傜粰浣?/g, '喂给你')
    .replace(/鍏堣鐫€/g, '先记着')
    .replace(/鎴戠湅瀹屽暒/g, '我看完啦')
    .replace(/杩欐娌℃帴濂?/g, '这次没接好')
}

class SpeechBubbleController {
  private readonly element: HTMLElement
  private readonly kickerEl: HTMLDivElement
  private readonly textEl: HTMLDivElement
  private activeUntil = 0
  private timer: number | null = null

  private applyAnchor(anchor?: { x?: number; y?: number } | null) {
    const normalizedAnchor = normalizeSpeechAnchor(anchor)
    if (!normalizedAnchor) {
      this.element.style.left = ''
      this.element.style.top = ''
      return
    }

    this.element.style.left = `${Math.round(normalizedAnchor.x * 100)}%`
    this.element.style.top = `${Math.round(normalizedAnchor.y * 100)}%`
  }

  constructor(
    element: HTMLElement,
    anchor?: {
      x: number
      y: number
    },
  ) {
    this.element = element
    this.element.innerHTML = `
      <div class="speech-shell">
        <div class="speech-kicker"><span class="speech-dot"></span><span class="speech-kicker-text"></span></div>
        <div class="speech-text"></div>
        <div class="speech-ambient"></div>
      </div>
    `

    const kickerEl = this.element.querySelector<HTMLDivElement>('.speech-kicker-text')
    const textEl = this.element.querySelector<HTMLDivElement>('.speech-text')
    if (!kickerEl || !textEl) {
      throw new Error('Speech bubble elements failed to initialize.')
    }

    this.kickerEl = kickerEl
    this.textEl = textEl
    this.applyAnchor(anchor)
  }

  setAnchor(anchor?: { x: number; y: number }) {
    this.applyAnchor(anchor)
  }

  show(message: string, duration = 4_000, presentation?: Partial<SpeechPresentation>) {
    const resolved = presentation ?? {}
    this.element.dataset.tone = resolved.tone ?? 'quiet'
    this.kickerEl.textContent = sanitizeDesktopTextStable(resolved.kicker ?? DEFAULT_SPEECH_KICKER)
    this.textEl.textContent = sanitizeDesktopTextStable(message)
    this.element.classList.add('show')
    this.activeUntil = Date.now() + duration

    if (this.timer) {
      window.clearTimeout(this.timer)
    }

    this.timer = window.setTimeout(() => {
      this.element.classList.remove('show')
      this.timer = null
      this.activeUntil = 0
    }, duration)
  }

  getActiveUntil() {
    return this.activeUntil
  }
}

function mapCompanionActivityToContextType(activity: CompanionSnapshot['activity']) {
  switch (activity) {
    case 'coding':
      return 'CODING'
    case 'gaming':
      return 'GAMING'
    case 'watching_video':
      return 'WATCHING'
    case 'chatting':
      return 'CHATTING'
    case 'browsing':
      return 'BROWSING'
    case 'reading':
      return 'READING'
    case 'idle':
      return 'IDLE'
    default:
      return 'OTHER'
  }
}

function getStableThinkingLine(): string {
  return randomFrom([
    '\u90a3\u6211\u5148\u62b1\u8d70\u5566\uff0c\u7a0d\u5fae\u60f3\u4e00\u60f3\u3002',
    '\u597d\u54e6\uff0c\u6211\u5148\u66ff\u4f60\u770b\u4e00\u4f1a\u513f\u3002',
    '\u5148\u4ea4\u7ed9\u6211\u5427\uff0c\u6211\u5e2e\u4f60\u987a\u4e00\u904d\u3002',
  ] as const)
}

function getStableNamedKicker(name?: string | null): string {
  const trimmed = name?.trim()
  if (!trimmed) {
    return '\u5b89\u9759\u966a\u7740'
  }

  return `${trimmed}\u966a\u7740\u4f60`
}

function getStableSpeechKicker(
  snapshot: ReturnType<CompanionStateMachine['getSnapshot']>,
  message: string,
): string {
  const isMusicListening = snapshot.scene.flags.includes('music_listening')
  if (snapshot.transientAction === 'tap_affection') return '\u6478\u6478\u6536\u5230'
  if (snapshot.transientAction === 'welcome_back') return '\u4f60\u56de\u6765\u5566'
  if (snapshot.transientAction === 'dragging') return '\u8ddf\u7740\u4f60\u8d70'
  if (snapshot.mode === 'focus_guardian') return '\u5b89\u9759\u966a\u5199'

  switch (snapshot.scene.id) {
    case 'deep_focus':
      return '\u4e13\u5fc3\u4e00\u70b9'
    case 'steady_focus':
      return '\u966a\u4f60\u76ef\u7740'
    case 'reading_nook':
      return '\u4e00\u8d77\u8bfb\u7740'
    case 'watch_together':
      return isMusicListening ? '\u966a\u4f60\u4e00\u8d77\u542c' : '\u966a\u4f60\u4e00\u8d77\u770b'
    case 'social_corner':
      return '\u5728\u4f60\u65c1\u8fb9'
    case 'play_session':
      return '\u6084\u6084\u56f4\u89c2'
    case 'late_night_wind_down':
      return '\u591c\u6df1\u5566'
    case 'quiet_idle':
      return '\u5b89\u9759\u966a\u7740'
    case 'soft_browsing':
      return '\u6162\u6162\u770b\u770b'
    case 'ambient_presence':
      return '\u966a\u4f60\u5f85\u7740'
    case 'away':
      return '\u66ff\u4f60\u770b\u4f4d'
  }

  if (snapshot.mode === 'proactive') return '\u8f7b\u8f7b\u63d0\u9192'
  if (snapshot.mode === 'reactive' && snapshot.emotion === 'happy') return '\u6709\u70b9\u5f00\u5fc3'
  if (snapshot.emotion === 'sleepy') return '\u591c\u6df1\u5566'
  if (snapshot.scene.energy === 'bright') return '\u6709\u70b9\u5f00\u5fc3'
  if (snapshot.scene.energy === 'low') return '\u5b89\u9759\u966a\u7740'
  if (message.length <= 8) return '\u5c0f\u58f0\u56de\u5e94'
  return '\u5b89\u9759\u966a\u7740'
}

function getStableSpeechPresentation(
  snapshot: ReturnType<CompanionStateMachine['getSnapshot']>,
  message: string,
): SpeechPresentation {
  if (snapshot.mode === 'focus_guardian' || snapshot.scene.id === 'deep_focus' || snapshot.scene.id === 'steady_focus') {
    return { tone: 'focus', kicker: getStableSpeechKicker(snapshot, message) }
  }

  if (
    snapshot.transientAction === 'tap_affection' ||
    snapshot.transientAction === 'welcome_back' ||
    snapshot.scene.id === 'watch_together' ||
    snapshot.scene.id === 'soft_browsing' ||
    snapshot.scene.id === 'ambient_presence' ||
    snapshot.mode === 'proactive'
  ) {
    return { tone: 'warm', kicker: getStableSpeechKicker(snapshot, message) }
  }

  if (
    snapshot.transientAction === 'dragging' ||
    snapshot.scene.id === 'social_corner' ||
    snapshot.scene.id === 'play_session' ||
    (snapshot.mode === 'reactive' && snapshot.emotion === 'happy') ||
    snapshot.scene.energy === 'bright' ||
    message.length <= 8
  ) {
    return { tone: 'playful', kicker: getStableSpeechKicker(snapshot, message) }
  }

  return { tone: 'quiet', kicker: getStableSpeechKicker(snapshot, message) }
}

function getRuntimeAwareSpeechKicker(
  snapshot: ReturnType<CompanionStateMachine['getSnapshot']>,
  message: string,
  chatRuntimeState: ChatRuntimeState,
  source: SpeechSource,
): string {
  const workMode = snapshot.workMode

  if (workMode?.enabled && workMode.overworkLevel === 'firm') {
    return '先停一下'
  }

  if (workMode?.enabled && workMode.isBreakActive) {
    return workMode.phase === 'long_break' ? '好好歇一会儿' : '休息一下'
  }

  if (workMode?.enabled && workMode.isPaused) {
    return '先缓一缓'
  }

  if (source === 'startup') {
    if (!chatRuntimeState.enabled) return '先陪着你'
    if (!chatRuntimeState.isConnected) return '等我连上'
    return '随时接住你'
  }

  if (!chatRuntimeState.enabled) {
    if (snapshot.activity === 'coding' || snapshot.mode === 'focus_guardian') {
      return '安静陪写'
    }
    return '先陪着你'
  }

  if (!chatRuntimeState.isConnected) {
    if (snapshot.mode === 'focus_guardian' || snapshot.scene.id === 'deep_focus' || snapshot.scene.id === 'steady_focus') {
      return '安静陪写'
    }
    return '先安静陪着'
  }

  return getStableSpeechKicker(snapshot, message)
}

function getRuntimeAwareSpeechPresentation(
  snapshot: ReturnType<CompanionStateMachine['getSnapshot']>,
  message: string,
  chatRuntimeState: ChatRuntimeState,
  source: SpeechSource,
): SpeechPresentation {
  const workMode = snapshot.workMode
  const kicker = getRuntimeAwareSpeechKicker(snapshot, message, chatRuntimeState, source)

  if (workMode?.enabled && workMode.overworkLevel === 'firm') {
    return { tone: 'quiet', kicker }
  }

  if (workMode?.enabled && workMode.isBreakActive) {
    return { tone: 'warm', kicker }
  }

  if (workMode?.enabled && workMode.isFocusActive) {
    return { tone: 'focus', kicker }
  }

  if (source === 'startup' && (!chatRuntimeState.enabled || !chatRuntimeState.isConnected)) {
    return { tone: 'quiet', kicker }
  }

  if (!chatRuntimeState.enabled || !chatRuntimeState.isConnected) {
    if (snapshot.mode === 'proactive' || snapshot.scene.id === 'ambient_presence' || snapshot.scene.id === 'quiet_idle') {
      return { tone: 'quiet', kicker }
    }
  }

  const basePresentation = getStableSpeechPresentation(snapshot, message)
  return {
    ...basePresentation,
    kicker,
  }
}

function buildChatRuntimeStateSpeech(
  previous: ChatRuntimeState,
  next: ChatRuntimeState,
  petName?: string | null,
): { message: string; duration: number; presentation: SpeechPresentation } | null {
  const name = petName?.trim() || 'bb7'

  if (!previous.enabled && next.enabled && next.isConnected) {
    return {
      message: `${name} 现在已经能接住你说的话了。想聊的时候就叫我。`,
      duration: 2_800,
      presentation: { tone: 'warm', kicker: '已经连好了' },
    }
  }

  if (!previous.enabled && next.enabled && !next.isConnected) {
    return {
      message: `聊天已经打开了，不过我还在等连上。先让我安静陪着你。`,
      duration: 2_800,
      presentation: { tone: 'quiet', kicker: '等我连上' },
    }
  }

  if (previous.enabled && !next.enabled) {
    return {
      message: `我先把聊天收起来啦，接下来会更安静地陪着你。`,
      duration: 2_600,
      presentation: { tone: 'quiet', kicker: '先陪着你' },
    }
  }

  if (previous.enabled && !previous.isConnected && next.isConnected) {
    return {
      message: `聊天这边已经连好了。我现在能更稳地接住你。`,
      duration: 2_800,
      presentation: { tone: 'warm', kicker: '已经连好了' },
    }
  }

  if (previous.enabled && previous.isConnected && !next.isConnected) {
    return {
      message: `聊天这边暂时没连稳，不过我还会在桌面安静陪着你。`,
      duration: 3_000,
      presentation: { tone: 'quiet', kicker: '先安静陪着' },
    }
  }

  return null
}

function buildSettingsPreviewSpeech(
  previous: CompanionSettingsPreviewState,
  next: CompanionSettingsPreviewState,
  petName: string,
): { message: string; duration: number; presentation: SpeechPresentation } | null {
  if (!next.active) {
    if (previous.active) {
      switch (next.exitReason) {
        case 'applied':
          return {
            message: `那我就按刚才的感觉正式陪着你了。接下来会稳稳待在这个状态里。`,
            duration: 2_500,
            presentation: { tone: 'warm', kicker: '已经定下来啦' },
          }
        case 'dismissed':
          return {
            message: '这轮预演我先轻轻收回来啦。你想继续试的时候，再叫我一声就好。',
            duration: 2_500,
            presentation: { tone: 'quiet', kicker: '先记着' },
          }
        case 'stale':
          return {
            message: '刚才那份预览我先放下了，不过我还记得你想试的感觉。',
            duration: 2_400,
            presentation: { tone: 'quiet', kicker: '我先收着' },
          }
        default:
          return {
            message: '这轮预览先停在这里，我会回到现在正式在用的陪伴状态。',
            duration: 2_300,
            presentation: { tone: 'quiet', kicker: '回到现在' },
          }
      }
    }
    return null
  }

  if (!previous.active || previous.selectedPetId !== next.selectedPetId) {
    return {
      message: `现在先用 ${petName} 陪你预演一下，看看桌面上的感觉合不合适。`,
      duration: 2_800,
      presentation: { tone: 'warm', kicker: '先陪你试试' },
    }
  }

  if (previous.lowDistractionMode !== next.lowDistractionMode && next.lowDistractionMode !== null) {
    return next.lowDistractionMode
      ? {
          message: '我先把存在感放轻一点，尽量更安静地陪着你。',
          duration: 2_500,
          presentation: { tone: 'quiet', kicker: '先安静一点' },
        }
      : {
          message: '那我就稍微更有存在感一点，陪你的时候也会更灵一点。',
          duration: 2_500,
          presentation: { tone: 'warm', kicker: '靠近一点' },
        }
  }

  if (previous.chatEnabled !== next.chatEnabled && next.chatEnabled !== null) {
    return next.chatEnabled
      ? {
          message: '聊天这边我也先一起打开了，想试试对话状态的话可以直接看现在的感觉。',
          duration: 2_600,
          presentation: { tone: 'warm', kicker: '先接住你' },
        }
      : {
          message: '那我先把聊天收一收，回到更安静的陪伴状态。',
          duration: 2_500,
          presentation: { tone: 'quiet', kicker: '先陪着你' },
        }
  }

  return null
}

function resolveConfiguredBridgeSequence(
  petPackage: BuiltInPetPackage,
  key: 'focusToBreak' | 'breakToFocus' | 'focusToWatch' | 'watchToFocus',
) {
  const configured = petPackage.companionContent?.bridgeMotions?.[key]
  if (!configured || configured.length === 0) {
    switch (key) {
      case 'focusToBreak':
        return DEFAULT_SCENE_SHIFT_TO_BREAK_SEQUENCE
      case 'breakToFocus':
        return DEFAULT_SCENE_SHIFT_TO_FOCUS_SEQUENCE
      case 'focusToWatch':
        return DEFAULT_SCENE_SHIFT_TO_FOCUS_SEQUENCE
      case 'watchToFocus':
        return DEFAULT_SCENE_SHIFT_TO_FOCUS_SEQUENCE
    }
  }

  return configured.map((step) => ({
    state: step.state,
    holdMs: step.holdMs,
  }))
}

function resolveSceneBridgeSequence(
  petPackage: BuiltInPetPackage,
  previous: CompanionSnapshot | null,
  next: CompanionSnapshot,
): CompanionBridgeSequence | null {
  if (!previous) {
    return null
  }

  const previousPhase = previous.workMode?.phase ?? 'idle'
  const nextPhase = next.workMode?.phase ?? 'idle'

  if (previousPhase !== nextPhase) {
    if (nextPhase === 'short_break' || nextPhase === 'long_break') {
      return resolveConfiguredBridgeSequence(petPackage, 'focusToBreak')
    }
    if (nextPhase === 'focus') {
      return resolveConfiguredBridgeSequence(petPackage, 'breakToFocus')
    }
  }

  return null
}

function getStableFeedCardCopy(name?: string | null): FeedCardCopy {
  const petName = name?.trim() || 'bb7'
  return {
    petName,
    confirmTitle: `${petName} \u63a5\u4f4f\u6587\u4ef6\u5566`,
    thinkingTitle: `${petName} \u6b63\u5728\u770b\u5462`,
    resultTitle: `${petName} \u770b\u5b8c\u5566`,
    errorTitle: `${petName} \u8fd9\u6b21\u6ca1\u63a5\u7a33`,
    confirmAcceptLabel: '\u4ea4\u7ed9\u4f60',
    confirmRejectLabel: '\u5148\u653e\u4e00\u4e0b',
    resultOpenChatLabel: '\u7ee7\u7eed\u804a\u8fd9\u4e2a',
    resultLaterLabel: '\u5148\u8bb0\u7740',
    confirmBody:
      '\u8981\u628a\u300a{{fileName}}\u300b\u4ea4\u7ed9{{petName}}\u5417\uff1f\u6211\u4f1a\u5148\u8f7b\u8f7b\u770b\u4e00\u904d\uff0c\u5148\u5728\u684c\u9762\u7559\u51e0\u53e5\u77ed\u77ed\u7684\u5c0f\u7ed3\uff0c\u518d\u628a\u66f4\u5b8c\u6574\u7684\u6574\u7406\u653e\u8fdb\u804a\u5929\u91cc\u966a\u4f60\u7ee7\u7eed\u5f80\u4e0b\u770b\u3002',
    thinkingBody:
      '{{petName}}\u5148\u62b1\u7740\u300a{{fileName}}\u300b\u770b\u4e00\u4f1a\u513f\u3002\u7a0d\u5fae\u7b49\u6211\u4e00\u4e0b\uff0c\u6211\u5148\u5728\u684c\u9762\u8f7b\u8f7b\u544a\u8bc9\u4f60\u6700\u503c\u5f97\u5728\u610f\u7684\u90a3\u51e0\u53e5\uff0c\u518d\u628a\u66f4\u5b8c\u6574\u7684\u6574\u7406\u653e\u5230\u804a\u5929\u91cc\u3002',
    resultBody:
      '\u300a{{fileName}}\u300b\u6211\u5148\u66ff\u4f60\u987a\u8fc7\u4e00\u904d\u4e86\u3002\n{{desktopSummary}}\n\n\u66f4\u5b8c\u6574\u7684\u6574\u7406\u5df2\u7ecf\u5728\u804a\u5929\u91cc\u7b49\u4f60\u4e86\uff0c\u4f60\u60f3\u7ee7\u7eed\u7684\u8bdd\uff0c{{petName}}\u5c31\u966a\u4f60\u5f80\u4e0b\u770b\u3002',
  }
}

function resolveFeedCardCopy(
  petName?: string | null,
  companionContent?: PetCompanionContentProfile | null,
): FeedCardCopy {
  const fallback = getStableFeedCardCopy(petName)
  const profile = companionContent?.feedCard
  if (!profile) {
    return fallback
  }

  return {
    ...fallback,
    confirmTitle: profile.confirmTitle.trim() || fallback.confirmTitle,
    thinkingTitle: profile.thinkingTitle.trim() || fallback.thinkingTitle,
    resultTitle: profile.resultTitle.trim() || fallback.resultTitle,
    errorTitle: profile.errorTitle.trim() || fallback.errorTitle,
    confirmAcceptLabel: profile.confirmAcceptLabel.trim() || fallback.confirmAcceptLabel,
    confirmRejectLabel: profile.confirmRejectLabel.trim() || fallback.confirmRejectLabel,
    resultOpenChatLabel: profile.resultOpenChatLabel.trim() || fallback.resultOpenChatLabel,
    resultLaterLabel: profile.resultLaterLabel.trim() || fallback.resultLaterLabel,
    confirmBody: profile.confirmBody.trim() || fallback.confirmBody,
    thinkingBody: profile.thinkingBody.trim() || fallback.thinkingBody,
    resultBody: profile.resultBody.trim() || fallback.resultBody,
  }
}

function renderFeedCardTemplate(
  template: string,
  params: {
    petName: string
    fileName: string
    desktopSummary?: string
  },
): string {
  return template
    .replace(/\{\{petName\}\}/g, params.petName)
    .replace(/\{\{fileName\}\}/g, params.fileName)
    .replace(/\{\{desktopSummary\}\}/g, params.desktopSummary ?? '')
}

function buildFeedConfirmCardText(copy: FeedCardCopy, fileName: string): string {
  return renderFeedCardTemplate(copy.confirmBody, {
    petName: copy.petName,
    fileName,
  })
}

function buildFeedThinkingCardText(copy: FeedCardCopy, fileName: string): string {
  return renderFeedCardTemplate(copy.thinkingBody, {
    petName: copy.petName,
    fileName,
  })
}

function buildFeedResultCardText(copy: FeedCardCopy, fileName: string, desktopSummary: string): string {
  return renderFeedCardTemplate(copy.resultBody, {
    petName: copy.petName,
    fileName,
    desktopSummary,
  })
}

function createStableFeedCardController(
  highlightEl: HTMLElement,
  cardEl: HTMLElement,
): FeedCardController {
  let cardTimer: number | null = null
  let activeMode: FeedCardMode | null = null
  let copy = getStableFeedCardCopy()

  const clearCardTimer = () => {
    if (cardTimer) {
      window.clearTimeout(cardTimer)
      cardTimer = null
    }
  }

  const hide = () => {
    clearCardTimer()
    activeMode = null
    highlightEl.classList.remove('show')
    cardEl.classList.remove('show')
    cardEl.replaceChildren()
  }

  const showCard = (mode: FeedCardMode, title: string, text: string) => {
    clearCardTimer()
    activeMode = mode
    cardEl.dataset.mode = mode
    cardEl.replaceChildren()

    const titleEl = document.createElement('div')
    titleEl.className = 'feed-title'
    titleEl.textContent = title

    const textEl = document.createElement('div')
    textEl.className = 'feed-text'
    textEl.textContent = text

    cardEl.appendChild(titleEl)
    cardEl.appendChild(textEl)
    cardEl.classList.add('show')
  }

  return {
    showConfirm(file, onAccept, onReject) {
      showCard(
        'confirm',
        copy.confirmTitle,
        buildFeedConfirmCardText(copy, file.name),
      )

      const actionsEl = document.createElement('div')
      actionsEl.className = 'feed-actions'

      const rejectBtn = document.createElement('button')
      rejectBtn.textContent = copy.confirmRejectLabel
      rejectBtn.onclick = () => {
        onReject()
        hide()
      }

      const acceptBtn = document.createElement('button')
      acceptBtn.textContent = copy.confirmAcceptLabel
      acceptBtn.className = 'primary'
      acceptBtn.onclick = () => {
        onAccept()
      }

      actionsEl.appendChild(rejectBtn)
      actionsEl.appendChild(acceptBtn)
      cardEl.appendChild(actionsEl)
      cardEl.classList.add('show')
    },
    showThinking(fileName) {
      showCard(
        'thinking',
        copy.thinkingTitle,
        buildFeedThinkingCardText(copy, fileName),
      )
      const pulse = document.createElement('div')
      pulse.className = 'feed-pulse'
      cardEl.appendChild(pulse)
    },
    showResult(fileName, desktopSummary, onOpenChat) {
      showCard(
        'done',
        copy.resultTitle,
        buildFeedResultCardText(copy, fileName, desktopSummary),
      )

      const actionsEl = document.createElement('div')
      actionsEl.className = 'feed-actions'

      const laterBtn = document.createElement('button')
      laterBtn.textContent = copy.resultLaterLabel
      laterBtn.onclick = () => {
        hide()
      }

      const openBtn = document.createElement('button')
      openBtn.textContent = copy.resultOpenChatLabel
      openBtn.className = 'primary'
      openBtn.onclick = () => {
        onOpenChat()
        hide()
      }

      actionsEl.appendChild(laterBtn)
      actionsEl.appendChild(openBtn)
      cardEl.appendChild(actionsEl)

      clearCardTimer()
      cardTimer = window.setTimeout(() => {
        if (activeMode === 'done') {
          hide()
        }
      }, 7_000)
    },
    showError(message) {
      showCard('done', copy.errorTitle, message)
      clearCardTimer()
      cardTimer = window.setTimeout(() => {
        if (activeMode === 'done') {
          hide()
        }
      }, 3_800)
    },
    setDragActive(active) {
      if (active) {
        highlightEl.classList.add('show')
      } else if (activeMode !== 'confirm' && activeMode !== 'thinking') {
        highlightEl.classList.remove('show')
      }
    },
    setCopy(next) {
      copy = next
    },
    hide,
    destroy() {
      hide()
    },
  }
}

function setupStableContextMenu(menu: HTMLElement, options: { getSnapshot: () => CompanionSnapshot | null }) {
  const menuStage = document.getElementById('pet-stage') as HTMLElement | null
  const menuShell = document.getElementById('pet-shell') as HTMLElement | null
  const menuPreferredWidth = 320
  const menuMinWidth = 300
  const menuStageMinExpandedWidth = 400
  const menuStageMinExpandedHeight = 640
  const menuStageWidthPadding = 68
  const menuStageHeightPadding = 56
  const menuBaseWidth = 300
  const menuBaseHeight = 420
  const menuMargin = 14
  const waitForMenuLayout = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))

  const syncMenuStage = (expanded: boolean, stageSize?: { width: number; height: number }) => {
    if (!menuStage) {
      return
    }

    if (!expanded) {
      menuStage.style.width = ''
      menuStage.style.height = ''
      if (menuShell) {
        menuShell.style.left = ''
        menuShell.style.bottom = ''
      }
      return
    }

    const resolvedWidth = Math.max(menuStageMinExpandedWidth, Math.round(stageSize?.width ?? menuStageMinExpandedWidth))
    const resolvedHeight = Math.max(menuStageMinExpandedHeight, Math.round(stageSize?.height ?? menuStageMinExpandedHeight))

    menuStage.style.width = `${resolvedWidth}px`
    menuStage.style.height = `${resolvedHeight}px`

    if (menuShell) {
      menuShell.style.left = `${Math.round(resolvedWidth / 2)}px`
      menuShell.style.bottom = '0px'
    }
  }

  const hide = () => {
    menu.classList.remove('show')
    menu.style.visibility = ''
    menu.style.width = ''
    menu.style.maxHeight = ''
    menu.style.maxWidth = ''
    menu.style.left = ''
    menu.style.top = ''
    menu.scrollTop = 0
    syncMenuStage(false)
    void window.electronAPI?.setMenuExpanded?.(false)
  }
  menu.innerHTML = ''

  const buildChip = (content: string) => {
    const chip = document.createElement('span')
    chip.className = 'ctx-chip'
    chip.textContent = content
    return chip
  }

  const createSection = (title: string) => {
    const section = document.createElement('div')
    section.className = 'ctx-section'

    const titleEl = document.createElement('div')
    titleEl.className = 'ctx-section-title'
    titleEl.textContent = title
    section.appendChild(titleEl)

    return section
  }

  const createItem = (label: string, meta: string, action: () => void, options?: { danger?: boolean; primary?: boolean }) => {
    const entry = document.createElement('button')
    entry.type = 'button'
    entry.className = `ctx-item${options?.danger ? ' danger' : ''}${options?.primary ? ' primary' : ''}`

    const labelEl = document.createElement('div')
    labelEl.className = 'ctx-item-label'
    labelEl.textContent = label

    const metaEl = document.createElement('div')
    metaEl.className = 'ctx-item-meta'
    metaEl.textContent = meta

    entry.appendChild(labelEl)
    entry.appendChild(metaEl)
    entry.onclick = () => {
      hide()
      action()
    }

    return entry
  }

  const render = () => {
    menu.innerHTML = ''

    const petName = resolveSelectedPetPackage().manifest.name || 'bb7'
    const lowDistraction = readCompanionPreferencesState().lowDistractionMode
    const chatRuntime = readChatRuntimeState()
    const screenEnabled = useContextStore.getState().isScreenMonitoring
    const snapshot = options.getSnapshot()
    const sceneLabel = snapshot?.scene.label ?? '桌面陪伴'
    const sceneEnergyLabel =
      snapshot?.scene.energy === 'bright' ? '更有回应感' : snapshot?.scene.energy === 'low' ? '更安静' : '陪着你待着'
    const workMode = snapshot?.workMode
    const workModeLabel = !workMode?.enabled
      ? '没有开启工作节奏'
      : workMode.isBreakActive
        ? workMode.phase === 'long_break'
          ? '现在是长休息'
          : '现在在短休息'
        : workMode.isPaused
          ? '工作节奏已暂停'
          : '现在在专注里'

    const hero = document.createElement('div')
    hero.className = 'ctx-hero'

    const eyebrow = document.createElement('div')
    eyebrow.className = 'ctx-eyebrow'
    eyebrow.textContent = 'Companion'

    const title = document.createElement('div')
    title.className = 'ctx-title'
    title.textContent = petName

    const subtitle = document.createElement('div')
    subtitle.className = 'ctx-subtitle'
    subtitle.textContent = `${sceneLabel} · ${sceneEnergyLabel}`

    const chipRow = document.createElement('div')
    chipRow.className = 'ctx-chip-row'
    chipRow.appendChild(buildChip(chatRuntime.enabled ? (chatRuntime.isConnected ? '聊天已连通' : '聊天待处理') : '安静陪伴中'))
    chipRow.appendChild(buildChip(lowDistraction ? '低打扰模式' : '标准陪伴'))
    chipRow.appendChild(buildChip(screenEnabled ? '桌面感知开启' : '桌面感知关闭'))

    const summary = document.createElement('div')
    summary.className = 'ctx-summary'
    summary.textContent = workModeLabel

    hero.appendChild(eyebrow)
    hero.appendChild(title)
    hero.appendChild(subtitle)
    hero.appendChild(chipRow)
    hero.appendChild(summary)
    menu.appendChild(hero)

    const actionsSection = createSection('常用入口')
    actionsSection.appendChild(
      createItem('\u6253\u5f00\u804a\u5929', '继续和它说话，或接着看完整分析。', () => window.electronAPI?.openChat?.(), {
        primary: true,
      }),
    )
    actionsSection.appendChild(
      createItem('\u6253\u5f00\u8bbe\u7f6e', '调整陪伴状态、接入和工作节奏。', () => window.electronAPI?.openSettings?.()),
    )
    actionsSection.appendChild(
      createItem('\u5bfc\u5165\u89d2\u8272', '把新的宠物包或旧版 sprite 资源接进来。', () => window.electronAPI?.openImport?.()),
    )
    menu.appendChild(actionsSection)

    const controlsSection = createSection('桌面控制')
    controlsSection.appendChild(
      createItem(
        '\u5207\u6362\u7a7f\u900f',
        '需要让它更安静待着时，可以切换窗口穿透。',
        () => window.electronAPI?.toggleClickThrough?.(),
      ),
    )
    menu.appendChild(controlsSection)

    const exitSection = createSection('应用')
    exitSection.appendChild(
      createItem('\u9000\u51fa Deep Pet', '先让 bb7 从桌面上休息一下。', () => window.electronAPI?.quitApp?.(), {
        danger: true,
      }),
    )
    menu.appendChild(exitSection)
  }

  render()

  return {
    async show(x: number, y: number) {
      render()
      menu.style.visibility = 'hidden'
      menu.classList.add('show')

      const measuredWidth = Math.max(menuMinWidth, Math.min(menuPreferredWidth, window.screen.availWidth - menuMargin * 6))
      menu.style.width = `${measuredWidth}px`
      menu.style.left = `${menuMargin}px`
      menu.style.top = `${menuMargin}px`
      menu.style.maxHeight = ''
      menu.style.maxWidth = ''
      menu.scrollTop = 0
      await waitForMenuLayout()

      const estimatedWidth = Math.max(menu.scrollWidth, menu.offsetWidth, measuredWidth)
      const estimatedHeight = Math.max(menu.scrollHeight, menu.offsetHeight, 360)
      const expandedStageSize = {
        width: Math.max(menuStageMinExpandedWidth, estimatedWidth + menuStageWidthPadding),
        height: Math.max(menuStageMinExpandedHeight, estimatedHeight + menuStageHeightPadding),
      }

      syncMenuStage(true, expandedStageSize)
      await window.electronAPI?.setMenuExpanded?.({
        expanded: true,
        width: expandedStageSize.width,
        height: expandedStageSize.height,
      })
      await waitForMenuLayout()

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const anchorOffsetX = Math.max(0, Math.round((viewportWidth - menuBaseWidth) / 2))
      const anchorOffsetY = Math.max(0, viewportHeight - menuBaseHeight)
      const anchorX = x + anchorOffsetX
      const anchorY = y + anchorOffsetY
      const maxMenuHeight = Math.max(220, viewportHeight - menuMargin * 2)
      const maxMenuWidth = Math.max(menuMinWidth, viewportWidth - menuMargin * 2)
      const resolvedMenuWidth = Math.min(maxMenuWidth, measuredWidth)
      menu.style.width = `${resolvedMenuWidth}px`
      menu.style.maxHeight = `${maxMenuHeight}px`
      menu.style.maxWidth = `${maxMenuWidth}px`
      await waitForMenuLayout()

      const rect = menu.getBoundingClientRect()
      const availableWidth = window.innerWidth
      const availableHeight = window.innerHeight
      const preferLeft = anchorX + rect.width + menuMargin > availableWidth
      const preferAbove = anchorY + rect.height + menuMargin > availableHeight
      const preferredLeft = preferLeft ? anchorX - rect.width : anchorX
      const preferredTop = preferAbove ? anchorY - rect.height : anchorY
      const left = Math.min(Math.max(menuMargin, preferredLeft), Math.max(menuMargin, availableWidth - rect.width - menuMargin))
      const top = Math.min(Math.max(menuMargin, preferredTop), Math.max(menuMargin, availableHeight - rect.height - menuMargin))
      menu.style.left = `${left}px`
      menu.style.top = `${top}px`
      menu.style.visibility = 'visible'
    },
    hide,
  }
}

async function bootstrap() {
  ensurePluginProviderStoreSubscription()
  await hydrateInitialContextStore()
  startScreenPerceptionLoop()
  await ensurePixiLoaded()

  const mount = requireElement<HTMLDivElement>('pet-root')
  const speechEl = requireElement<HTMLDivElement>('speech')
  const contextMenuEl = requireElement<HTMLDivElement>('ctx')
  const feedHighlightEl = requireElement<HTMLDivElement>('feed-highlight')
  const feedCardEl = requireElement<HTMLDivElement>('feed-card')
  const runtimeFlags = (await window.electronAPI?.getRuntimeFlags?.()) ?? {
    smokeTarget: null,
    scenario: null,
    isDev: false,
    smokeRunId: null,
    automationRunId: null,
    autoExitMs: null,
  }
  const isFeedSmoke = runtimeFlags.smokeTarget === 'feed'
  const isFeedStabilityScenario = runtimeFlags.scenario === 'stability-feed'

  let petPackage = resolveSelectedPetPackage()
  const speech = new SpeechBubbleController(speechEl, petPackage.productionProfile?.anchors.speechBubble)
  const speechPolicy = new CompanionSpeechPolicy()
  const feedCard = createStableFeedCardController(feedHighlightEl, feedCardEl)
  const proceduralScale = 15
  let textureSet = await buildRuntimeTextureSetForPetPackage(petPackage, proceduralScale)
  let currentSpeechKicker = getStableNamedKicker(petPackage.manifest.name)
  let lowDistractionMode = readCompanionPreferencesState().lowDistractionMode
  let chatRuntimeState = readChatRuntimeState()
  let settingsPreviewState = readCompanionSettingsPreviewState()
  const companion = new CompanionStateMachine()
  const stabilizer = new CompanionBehaviorStabilizer()
  const proactiveScheduler = new ProactiveInteractionScheduler()
  const workModeRuntime = new WorkModeRuntime(readWorkModeState())
  const initialScreenPerception = readScreenPerceptionSnapshot()
  let latestScreenSummary = initialScreenPerception?.summary ?? null
  let latestScreenSource = initialScreenPerception?.source ?? null
  let pendingFeedFile: File | null = null
  let isFeedAnalyzing = false
  let lastBridgeAnimationAt = 0

  companion.setMemory(readCompanionMemory())
  companion.setScreenPerception(initialScreenPerception)
  feedCard.setCopy(resolveFeedCardCopy(petPackage.manifest.name, petPackage.companionContent))

  const runtime = new PixiPetRuntime({
    mount,
    textureSet,
    speech,
  })

  emitRuntimeTextureSourceMetric(petPackage, textureSet, 'initial')

  await runtime.init()
  applyRuntimeCompanionState(runtime, {
    lowDistractionMode,
    chatRuntimeState,
    previewState: settingsPreviewState,
  })
  const initialSnapshot = stabilizer.stabilize(
    attachWorkModeToSnapshot(companion.getSnapshot(), workModeRuntime.getSignals()),
  )
  let latestSnapshot = initialSnapshot
  const contextMenu = setupStableContextMenu(contextMenuEl, {
    getSnapshot: () => latestSnapshot ?? null,
  })

  const getEffectiveRuntimeCompanionState = () =>
    resolveRuntimeCompanionState({
      lowDistractionMode,
      chatRuntimeState,
      previewState: settingsPreviewState,
    })

  const speakWithPolicy = (
    source: SpeechSource,
    snapshot: typeof latestSnapshot,
    message: string,
    duration: number,
    override?: Partial<SpeechPresentation>,
    options?: SpeechPolicyOptions,
  ) => {
    const effectiveRuntimeState = getEffectiveRuntimeCompanionState()
    const effectiveLowDistractionMode = resolveEffectiveLowDistractionMode(
      effectiveRuntimeState.effectiveLowDistractionMode,
      effectiveRuntimeState.effectiveChatRuntimeState,
    )

    if (source === 'external') {
      const suppressionReason = resolveExternalSpeechSuppressionReason(
        snapshot,
        effectiveLowDistractionMode,
        options?.externalTier ?? 'ambient',
      )

      if (suppressionReason) {
        emitAutomationMetricEvent('speech.suppressed', {
          tags: {
            source,
            externalTier: options?.externalTier ?? 'ambient',
            reason: suppressionReason,
            scene: snapshot.scene.id,
            activity: snapshot.activity,
          },
        })
        return false
      }
    }

    const decision = speechPolicy.evaluate({
      source,
      snapshot,
      intent: { message, duration },
      now: Date.now(),
      lowDistractionMode: effectiveLowDistractionMode,
    })

    if (!decision) {
      return false
    }

    const safeMessage = sanitizeDesktopTextStable(decision.intent.message)
    const safeOverride = override
      ? {
          ...override,
          kicker: override.kicker ? sanitizeDesktopTextStable(override.kicker) : override.kicker,
        }
      : undefined

    speech.show(
      safeMessage,
      decision.intent.duration,
      safeOverride ??
        {
          ...getRuntimeAwareSpeechPresentation(
            snapshot,
            safeMessage,
            effectiveRuntimeState.effectiveChatRuntimeState,
            source,
          ),
        },
    )
    emitAutomationMetricEvent('speech.shown', {
      tags: {
        source,
        externalTier: source === 'external' ? options?.externalTier ?? 'ambient' : null,
        tone: (safeOverride?.tone ?? getRuntimeAwareSpeechPresentation(
          snapshot,
          safeMessage,
          effectiveRuntimeState.effectiveChatRuntimeState,
          source,
        ).tone),
        scene: snapshot.scene.id,
        activity: snapshot.activity,
      },
    })
    return true
  }

  runtime.applyPresentation(resolvePetPresentation(initialSnapshot, petPackage))

  const refreshPresentation = (snapshot: CompanionSnapshot) => {
    const stabilizedSnapshot = normalizeCompanionSnapshot(stabilizer.stabilize(
      attachWorkModeToSnapshot(snapshot, workModeRuntime.getSignals()),
    ))
    latestSnapshot = stabilizedSnapshot
    runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))
    return stabilizedSnapshot
  }

  const replaceRuntimePetPackage = async (nextPetPackage: BuiltInPetPackage) => {
    petPackage = nextPetPackage
    textureSet = await buildRuntimeTextureSetForPetPackage(petPackage, proceduralScale)
    currentSpeechKicker = getStableNamedKicker(petPackage.manifest.name)
    feedCard.setCopy(resolveFeedCardCopy(petPackage.manifest.name, petPackage.companionContent))
    runtime.replaceTextureSet(textureSet)
    emitRuntimeTextureSourceMetric(petPackage, textureSet, 'replace')
    speech.setAnchor(petPackage.productionProfile?.anchors.speechBubble)
    refreshPresentation(companion.getSnapshot())
  }

  const playFeedConfirmMotion = () => {
    runtime.playStateSequence(FEED_CONFIRM_SEQUENCE)
  }

  const playFeedThinkingMotion = () => {
    runtime.playStateSequence(FEED_THINKING_SEQUENCE)
  }

  const playFeedResultMotion = () => {
    runtime.playStateSequence(FEED_RESULT_SEQUENCE)
  }

  const playFeedErrorMotion = () => {
    runtime.playStateSequence(FEED_ERROR_SEQUENCE)
  }

  const playPreviewAppliedMotion = () => {
    runtime.playStateSequence(PREVIEW_APPLIED_SEQUENCE)
  }

  const playPreviewDismissedMotion = () => {
    runtime.playStateSequence(PREVIEW_DISMISSED_SEQUENCE)
  }

  const maybePlaySceneBridgeMotion = (previous: CompanionSnapshot | null, next: CompanionSnapshot, now = Date.now()) => {
    if (now - lastBridgeAnimationAt < 10_000) {
      return
    }

    const sequence = resolveSceneBridgeSequence(petPackage, previous, next)
    if (!sequence) {
      return
    }

    lastBridgeAnimationAt = now
    runtime.playStateSequence(sequence)
  }

  const analyzePendingFeed = async () => {
    if (!pendingFeedFile || isFeedAnalyzing) {
      return
    }

    const file = pendingFeedFile
    isFeedAnalyzing = true
    pendingFeedFile = null
    feedCard.showThinking(file.name)
    playFeedThinkingMotion()
    speech.show(getStableThinkingLine(), 2_300, {
      tone: 'focus',
      kicker: '\u8ba9\u6211\u770b\u770b',
    })

    try {
      const result = await analyzeFileForCompanionFeed(file, {
        activity: mapCompanionActivityToContextType(latestSnapshot.activity),
        windowTitle: latestSnapshot.activeWindow?.title ?? '',
        windowProcess: latestSnapshot.activeWindow?.process ?? '',
        screenSummary: latestScreenSummary,
        screenSource: latestScreenSource,
        activeWindowInfo: latestSnapshot.activeWindow,
      })

      emitCompanionFeedAnalysisResult(result, {
        idPrefix: 'feed',
      })
      emitAutomationMetricEvent('feed.analysis.completed', {
        tags: {
          fileName: result.fileName,
          scene: result.context.sceneId,
        },
      })

      playFeedResultMotion()

      const didSpeak = speakWithPolicy(
        'external',
        latestSnapshot,
        result.desktopUtterance,
        3_200,
        {
          tone: 'focus',
          kicker: '已经喂给我了',
        },
        { externalTier: 'result' },
      )

      if (!didSpeak) {
        speech.show(result.desktopUtterance, 3_200, {
          tone: 'focus',
          kicker: '已经喂给我了',
        })
      }

      feedCard.showResult(result.fileName, result.desktopSummary, () => {
        window.electronAPI?.openChat?.()
      })
    } catch (error: any) {
      const message = `这次没能顺利看完《${file.name}》。${error?.message ? ` ${error.message}` : ''}`
      playFeedErrorMotion()
      feedCard.showError(message)
      speech.show('这次我没接好，再给我一次就好。', 2_400, {
        tone: 'warm',
        kicker: '没接稳',
      })
    } finally {
      isFeedAnalyzing = false
    }
  }

  const runFeedSmoke = () => {
    const fileName = 'smoke-notes.txt'
    const detailedAnalysis = [
      '这是一条自动化 smoke 生成的文件分析结果。',
      '它用于确认桌宠结果卡片、桌面气泡、分析广播和聊天窗口接收链都能工作。',
      '如果你能看到这条结果，说明文件投喂主链已经至少通过了基础自动验证。',
    ].join('\n')

    const context = buildCompanionChatContext(
      latestSnapshot.activity,
      latestSnapshot.activeWindow?.title ?? '',
      latestSnapshot.activeWindow?.process ?? '',
      latestScreenSummary,
      latestScreenSource,
      latestSnapshot.activeWindow,
    )
    const briefSummary = buildCompanionBriefSummary(
      detailedAnalysis,
      '这是一条用于验证文件投喂链的样例结果。',
      100,
    )
    const desktopSummary = buildCompanionDesktopSummary(
      detailedAnalysis,
      '这是一条用于验证桌面短反馈的样例结果。',
      56,
    )

    feedCard.setDragActive(true)
    playFeedResultMotion()
    speech.show(`我先帮你看过《${fileName}》了。`, 2_600, {
      tone: 'focus',
      kicker: '已经喂给我了',
    })
    feedCard.showResult(fileName, desktopSummary, () => {
      window.electronAPI?.openChat?.()
    })

    emitCompanionFeedAnalysisResult(
      {
        fileName,
        desktopSummary,
        briefSummary,
        detailedAnalysis,
        context,
        actions: buildFeedFollowUpActionsForScene(fileName, detailedAnalysis, context),
        desktopUtterance: buildFileAnalysisUtterance(fileName, desktopSummary, context.sceneId),
      },
      {
        idPrefix: runtimeFlags.smokeRunId ? `smoke-feed-${runtimeFlags.smokeRunId}` : 'smoke-feed',
        createdAt: Date.now(),
      },
    )
    emitAutomationMetricEvent('feed.analysis.completed', {
      tags: {
        fileName,
        scene: context.sceneId,
        synthetic: true,
      },
    })

    window.electronAPI?.emitSmokeCheckpoint?.('feed-result-ready')
  }

  const runFeedStabilityScenario = () => {
    const fileName = 'stability-notes.txt'
    const detailedAnalysis = [
      '这是一条用于长驻稳定性验证的文件分析结果。',
      '它用于确认文件投喂结果可以稳定出现在桌面侧，并继续流入聊天窗口。',
      '如果这条结果被聊天面板接住，说明投喂和后续衔接链路在非 smoke 场景下也是通的。',
    ].join('\n')

    const context = buildCompanionChatContext(
      latestSnapshot.activity,
      latestSnapshot.activeWindow?.title ?? '',
      latestSnapshot.activeWindow?.process ?? '',
      latestScreenSummary,
      latestScreenSource,
      latestSnapshot.activeWindow,
    )
    const briefSummary = buildCompanionBriefSummary(
      detailedAnalysis,
      '这是一条用于长驻文件投喂验证的样例结果。',
      100,
    )
    const desktopSummary = buildCompanionDesktopSummary(
      detailedAnalysis,
      '这是一条用于长驻桌面反馈验证的样例结果。',
      56,
    )

    feedCard.setDragActive(true)
    playFeedResultMotion()
    speech.show(`我先帮你看过《${fileName}》了。`, 2_600, {
      tone: 'focus',
      kicker: '已经喂给我了',
    })
    feedCard.showResult(fileName, desktopSummary, () => {
      window.electronAPI?.openChat?.()
    })

    emitCompanionFeedAnalysisResult(
      {
        fileName,
        desktopSummary,
        briefSummary,
        detailedAnalysis,
        context,
        actions: buildFeedFollowUpActionsForScene(fileName, detailedAnalysis, context),
        desktopUtterance: buildFileAnalysisUtterance(fileName, desktopSummary, context.sceneId),
      },
      {
        idPrefix: runtimeFlags.automationRunId
          ? `stability-feed-${runtimeFlags.automationRunId}`
          : 'stability-feed',
        createdAt: Date.now(),
      },
    )
    emitAutomationMetricEvent('feed.analysis.completed', {
      tags: {
        fileName,
        scene: context.sceneId,
        synthetic: true,
        scenario: 'stability-feed',
      },
    })
  }

  const unsubscribeMemory = subscribeCompanionMemory((memory) => {
    companion.setMemory(memory)
    refreshPresentation(companion.getSnapshot())
  })

  const unsubscribeWorkMode = subscribeWorkMode((state) => {
    workModeRuntime.setState(state)
    refreshPresentation(companion.getSnapshot())
  })

  const unsubscribeSelectedPet = subscribeSelectedPet(async () => {
    if (settingsPreviewState.active && settingsPreviewState.selectedPetId) {
      return
    }
    await replaceRuntimePetPackage(resolveSelectedPetPackage())
  })

  const unsubscribeCompanionPreferences = subscribeCompanionPreferences((state) => {
    lowDistractionMode = state.lowDistractionMode
    applyRuntimeCompanionState(runtime, {
      lowDistractionMode,
      chatRuntimeState,
      previewState: settingsPreviewState,
    })
  })

  const unsubscribeChatRuntime = subscribeChatRuntimeState((state) => {
    const previousRuntimeState = chatRuntimeState
    chatRuntimeState = state
    applyRuntimeCompanionState(runtime, {
      lowDistractionMode,
      chatRuntimeState,
      previewState: settingsPreviewState,
    })

    const runtimeStateSpeech = buildChatRuntimeStateSpeech(previousRuntimeState, state, petPackage.manifest.name)
    if (runtimeStateSpeech) {
      speakWithPolicy(
        'external',
        latestSnapshot,
        runtimeStateSpeech.message,
        runtimeStateSpeech.duration,
        runtimeStateSpeech.presentation,
        { externalTier: 'ambient' },
      )
    }
  })

  const unsubscribeSettingsPreview = subscribeCompanionSettingsPreview(async (state) => {
    const previousPreviewState = settingsPreviewState
    settingsPreviewState = state

    if (state.active && state.selectedPetId) {
      if (!previousPreviewState.active || previousPreviewState.selectedPetId !== state.selectedPetId) {
        await replaceRuntimePetPackage(loadPetPackageById(state.selectedPetId))
      }
    } else if (previousPreviewState.active && previousPreviewState.selectedPetId) {
      await replaceRuntimePetPackage(resolveSelectedPetPackage())
    }

    applyRuntimeCompanionState(runtime, {
      lowDistractionMode,
      chatRuntimeState,
      previewState: settingsPreviewState,
    })

    const previewSpeech = buildSettingsPreviewSpeech(previousPreviewState, state, petPackage.manifest.name)
    if (!state.active && previousPreviewState.active) {
      if (state.exitReason === 'applied') {
        playPreviewAppliedMotion()
      } else if (state.exitReason === 'dismissed') {
        playPreviewDismissedMotion()
      }
    }
    if (previewSpeech) {
      speakWithPolicy(
        'external',
        latestSnapshot,
        previewSpeech.message,
        previewSpeech.duration,
        previewSpeech.presentation,
        { externalTier: 'ambient' },
      )
    }
  })

  const unsubscribeCompanionUtterance = subscribeCompanionUtterance((payload) => {
    speakWithPolicy(
      'external',
      latestSnapshot,
      payload.message,
      payload.duration ?? 2_800,
      {
        tone: payload.source === 'file-analysis' ? 'focus' : 'warm',
        kicker: payload.source === 'file-analysis' ? '我先看过了' : currentSpeechKicker,
      },
      {
        externalTier:
          payload.source === 'file-analysis'
            ? 'result'
            : payload.source === 'chat'
              ? 'response'
              : 'ambient',
      },
    )
  })

  const unsubscribeScreenPerception = subscribeScreenPerception((snapshot) => {
    useContextStore.getState().setScreenPerception(snapshot)
    companion.setScreenPerception(snapshot)
    latestScreenSummary = snapshot.summary ?? null
    latestScreenSource = snapshot.source ?? null
    refreshPresentation(companion.getSnapshot())
  })

  const resolvePetInteractionHit = (clientX: number, clientY: number) => runtime.hitTestCanvasPoint(clientX, clientY)

  const canDragPet = (clientX: number, clientY: number) => {
    const hit = resolvePetInteractionHit(clientX, clientY)
    return hit.hit && hit.coverage >= 0.2
  }

  const canOpenContextMenu = (clientX: number, clientY: number) => {
    const hit = resolvePetInteractionHit(clientX, clientY)
    return (
      hit.hit &&
      hit.coverage >= 0.5 &&
      hit.neighborhoodCoverage >= 0.34 &&
      hit.normalizedX >= 0.14 &&
      hit.normalizedX <= 0.86 &&
      hit.normalizedY >= 0.06 &&
      hit.normalizedY <= 0.92
    )
  }

  const canPetAffectionTap = (clientX: number, clientY: number) => {
    const hit = resolvePetInteractionHit(clientX, clientY)
    // Keep petting intentionally narrower than dragging so near-edge clicks do not misfire as head pats.
    return (
      hit.hit &&
      hit.alpha >= 168 &&
      hit.coverage >= 0.66 &&
      hit.neighborhoodCoverage >= 0.52 &&
      hit.normalizedX >= 0.26 &&
      hit.normalizedX <= 0.74 &&
      hit.normalizedY >= 0.08 &&
      hit.normalizedY <= 0.56
    )
  }

  const dragController = new PetDragController({
    element: runtime.canvas,
    canStartInteraction: (event) => canDragPet(event.clientX, event.clientY),
    canTriggerTap: (event) => canPetAffectionTap(event.clientX, event.clientY),
    isHoveringInteractiveTarget: (event) => canDragPet(event.clientX, event.clientY),
    onDragStart: () => {
      emitAutomationMetricEvent('pet.drag.start')
      refreshPresentation(companion.handleDragStart().snapshot)
    },
    onDragEnd: () => {
      emitAutomationMetricEvent('pet.drag.end')
      refreshPresentation(companion.handleDragEnd().snapshot)
    },
    onTap: () => {
      emitAutomationMetricEvent('pet.tap')
      const result = companion.handleTap()
      const stabilizedSnapshot = refreshPresentation(result.snapshot)
      if (result.speech) {
        speakWithPolicy(
          'tap',
          stabilizedSnapshot,
          result.speech.message,
          result.speech.duration,
          getStableSpeechPresentation(stabilizedSnapshot, result.speech.message),
        )
      }
    },
  })

  dragController.mount()

  const isFileDragEvent = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')
  const isDragOverPetBody = (event: DragEvent) => canDragPet(event.clientX, event.clientY)

  runtime.canvas.addEventListener('dragenter', (event) => {
    if (isFeedAnalyzing) return
    if (!isFileDragEvent(event)) return
    event.preventDefault()
    if (!isDragOverPetBody(event)) {
      feedCard.setDragActive(false)
      return
    }
    feedCard.setDragActive(true)
  })

  runtime.canvas.addEventListener('dragover', (event) => {
    if (isFeedAnalyzing) return
    if (!isFileDragEvent(event)) return
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = isDragOverPetBody(event) ? 'copy' : 'none'
    }
    if (!isDragOverPetBody(event)) {
      feedCard.setDragActive(false)
      return
    }
    feedCard.setDragActive(true)
  })

  runtime.canvas.addEventListener('dragleave', () => {
    if (pendingFeedFile) return
    feedCard.setDragActive(false)
  })

  runtime.canvas.addEventListener('drop', (event) => {
    if (isFeedAnalyzing) return
    if (!isFileDragEvent(event)) return
    event.preventDefault()
    event.stopPropagation()
    if (!isDragOverPetBody(event)) {
      feedCard.setDragActive(false)
      return
    }
    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return
    feedCard.setDragActive(true)
    pendingFeedFile = files[0]
    emitAutomationMetricEvent('feed.drop.received', {
      tags: {
        fileName: files[0].name,
      },
    })
    playFeedConfirmMotion()
    speech.show('要把这个喂给我吗？', 2_400, {
      tone: 'warm',
      kicker: '要喂给我吗',
    })
    feedCard.showConfirm(
      files[0],
      () => {
        void analyzePendingFeed()
      },
      () => {
        pendingFeedFile = null
        runtime.clearStateSequence()
        feedCard.setDragActive(false)
      },
    )
  })

  runtime.canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    if (!canOpenContextMenu(event.clientX, event.clientY)) {
      contextMenu.hide()
      return
    }
    contextMenu.show(event.clientX, event.clientY)
  })

  document.addEventListener('mousedown', (event) => {
    if (contextMenuEl.classList.contains('show') && !contextMenuEl.contains(event.target as Node)) {
      contextMenu.hide()
    }
  })

  window.electronAPI?.onSpeech?.((msg: string, dur: number) => {
    speakWithPolicy('external', latestSnapshot, msg, dur, {
      tone: 'warm',
      kicker: currentSpeechKicker,
    }, { externalTier: 'ambient' })
  })

  window.electronAPI?.onContextUpdate?.((info: { title: string; process: string; idleMs?: number }) => {
    const previousSnapshot = latestSnapshot
    syncContextStoreFromWindowInfo(info)
    const result = companion.handleContext(info)
    captureCompanionRuntimeContext(result.snapshot.activity, result.snapshot.scene.id, info.title)
    const stabilizedSnapshot = refreshPresentation(result.snapshot)
    if (
      previousSnapshot.activity !== stabilizedSnapshot.activity ||
      previousSnapshot.scene.id !== stabilizedSnapshot.scene.id ||
      previousSnapshot.mode !== stabilizedSnapshot.mode ||
      previousSnapshot.emotion !== stabilizedSnapshot.emotion
    ) {
      emitAutomationMetricEvent('context.transition', {
        tags: {
          activity: stabilizedSnapshot.activity,
          scene: stabilizedSnapshot.scene.id,
          mode: stabilizedSnapshot.mode,
          emotion: stabilizedSnapshot.emotion,
          musicListening: stabilizedSnapshot.scene.flags.includes('music_listening'),
          mediaSource: stabilizedSnapshot.activeWindow?.mediaSource || 'none',
        },
      })
    }
    maybePlaySceneBridgeMotion(previousSnapshot, stabilizedSnapshot, Date.now())

    if (result.speech) {
      speakWithPolicy(
        'context',
        stabilizedSnapshot,
        result.speech.message,
        result.speech.duration,
        getStableSpeechPresentation(stabilizedSnapshot, result.speech.message),
      )
    }
  })

  const proactiveTimer = window.setInterval(() => {
    const previousSnapshot = latestSnapshot
    const result = companion.handleTick()
    workModeRuntime.tick()
    const workModeSignals = workModeRuntime.getSignals()
    const snapshotWithWorkMode = attachWorkModeToSnapshot(result.snapshot, workModeSignals)
    const stabilizedSnapshot = normalizeCompanionSnapshot(stabilizer.stabilize(snapshotWithWorkMode))
    latestSnapshot = stabilizedSnapshot
    runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))
    maybePlaySceneBridgeMotion(previousSnapshot, stabilizedSnapshot, Date.now())
    const effectiveRuntimeState = getEffectiveRuntimeCompanionState()

    const proactiveSpeech = proactiveScheduler.evaluate(
      petPackage,
      stabilizedSnapshot,
      companion.getRuntimeSignals(),
      workModeSignals,
      resolveEffectiveLowDistractionMode(
        effectiveRuntimeState.effectiveLowDistractionMode,
        effectiveRuntimeState.effectiveChatRuntimeState,
      ),
    )

    if (proactiveSpeech) {
      const enrichedMessage =
        latestScreenSummary && proactiveSpeech.message.length < 42
          ? `${proactiveSpeech.message} 我也有在留意你眼前的内容。`
          : proactiveSpeech.message

      const didSpeak = speakWithPolicy(
        'proactive',
        stabilizedSnapshot,
        enrichedMessage,
        proactiveSpeech.duration,
        getStableSpeechPresentation(stabilizedSnapshot, enrichedMessage),
      )

      if (didSpeak) {
        emitAutomationMetricEvent('proactive.prompt', {
          tags: {
            activity: stabilizedSnapshot.activity,
            scene: stabilizedSnapshot.scene.id,
            mode: stabilizedSnapshot.mode,
          },
        })
        const actionPayload = buildCompanionActionPayload(
          petPackage,
          stabilizedSnapshot,
          workModeSignals,
          enrichedMessage,
        )
        if (actionPayload) {
          emitCompanionAction(actionPayload)
        }
      }
    }
  }, 20_000)

  window.addEventListener('beforeunload', () => {
    window.clearInterval(proactiveTimer)
    stopScreenPerceptionLoop()
    unsubscribeMemory()
    unsubscribeWorkMode()
    unsubscribeSelectedPet()
    unsubscribeCompanionPreferences()
    unsubscribeSettingsPreview()
    unsubscribeChatRuntime()
    unsubscribeCompanionUtterance()
    unsubscribeScreenPerception()
    dragController.destroy()
    feedCard.destroy()
    runtime.destroy()
  })

  const hour = new Date().getHours()
  const preferredName = readCompanionMemory().preferredName
  if (hour >= 23 || hour < 6) {
    speakWithPolicy(
      'startup',
      latestSnapshot,
      preferredName ? `${preferredName}，${LATE_NIGHT_MESSAGE}` : LATE_NIGHT_MESSAGE,
      4_200,
      { tone: 'quiet', kicker: '夜深啦' },
    )
  } else {
    speakWithPolicy(
      'startup',
      latestSnapshot,
      preferredName ? `${DESKTOP_GREETING} 欢迎回来，${preferredName}。` : DESKTOP_GREETING,
      2_600,
      { tone: 'warm', kicker: '已经在这儿了' },
    )
  }
  emitAutomationMetricEvent('runtime.started', {
    tags: {
      smokeTarget: runtimeFlags.smokeTarget ?? 'none',
      scenario: runtimeFlags.scenario ?? 'none',
    },
  })

  if (isFeedSmoke) {
    setTimeout(() => {
      window.electronAPI?.openChat?.()
      setTimeout(() => {
        runFeedSmoke()
      }, 500)
    }, 700)
  }

  if (isFeedStabilityScenario) {
    setTimeout(() => {
      window.electronAPI?.openChat?.()
      setTimeout(() => {
        runFeedStabilityScenario()
      }, 900)
    }, 900)
  }
}

async function hydrateInitialContextStore() {
  try {
    const info = await window.electronAPI?.getActiveWindow?.()
    if (info) {
      syncContextStoreFromWindowInfo(info)
    }
  } catch {
    // Ignore initial context read failures and let the regular main-process push recover.
  }
}

function syncContextStoreFromWindowInfo(info: {
  title: string
  process: string
  idleMs?: number
  mediaPlaying?: boolean
  mediaTitle?: string
  mediaArtist?: string
  mediaSource?: string
}) {
  const contextStore = useContextStore.getState()
  contextStore.setActiveWindow(info)
  contextStore.setActivity(classifyActivity(info))
}

void bootstrap()

function resolveRuntimeCompanionState({
  lowDistractionMode,
  chatRuntimeState,
  previewState,
}: RuntimeCompanionState): {
  effectiveLowDistractionMode: boolean
  effectiveChatRuntimeState: ChatRuntimeState
} {
  const effectiveChatRuntimeState: ChatRuntimeState = previewState.active
    ? {
        enabled: previewState.chatEnabled ?? chatRuntimeState.enabled,
        isConnected: previewState.chatConnected ?? chatRuntimeState.isConnected,
      }
    : chatRuntimeState

  const effectiveLowDistractionMode = previewState.active && typeof previewState.lowDistractionMode === 'boolean'
    ? previewState.lowDistractionMode
    : lowDistractionMode

  return {
    effectiveLowDistractionMode,
    effectiveChatRuntimeState,
  }
}

function resolveExternalSpeechSuppressionReason(
  snapshot: CompanionSnapshot,
  effectiveLowDistractionMode: boolean,
  externalTier: ExternalSpeechTier,
): 'away' | 'quiet' | 'idle' | null {
  if (externalTier !== 'ambient') {
    return null
  }

  if (snapshot.scene.id === 'away') {
    return 'away'
  }

  if (snapshot.mode === 'quiet' || effectiveLowDistractionMode) {
    return 'quiet'
  }

  const idleMs = snapshot.activeWindow?.idleMs ?? 0
  if (idleMs >= EXTERNAL_AMBIENT_IDLE_SUPPRESSION_MS) {
    return 'idle'
  }

  return null
}

function applyRuntimeCompanionState(runtime: PixiPetRuntime, state: RuntimeCompanionState) {
  const resolved = resolveRuntimeCompanionState(state)
  runtime.setLowDistractionMode(
    resolveEffectiveLowDistractionMode(
      resolved.effectiveLowDistractionMode,
      resolved.effectiveChatRuntimeState,
    ),
  )
  runtime.setCompanionPresenceMode(
    resolveCompanionPresenceMode(
      resolved.effectiveLowDistractionMode,
      resolved.effectiveChatRuntimeState,
    ),
  )
}

function resolveEffectiveLowDistractionMode(
  preferenceLowDistractionMode: boolean,
  chatRuntimeState: ReturnType<typeof readChatRuntimeState>,
): boolean {
  if (preferenceLowDistractionMode) {
    return true
  }

  if (!chatRuntimeState.enabled || !chatRuntimeState.isConnected) {
    return true
  }

  return false
}

function resolveCompanionPresenceMode(
  preferenceLowDistractionMode: boolean,
  chatRuntimeState: ReturnType<typeof readChatRuntimeState>,
): 'quiet' | 'connected' | 'ambient' {
  if (preferenceLowDistractionMode) {
    return 'quiet'
  }

  if (!chatRuntimeState.enabled || !chatRuntimeState.isConnected) {
    return 'quiet'
  }

  if (chatRuntimeState.enabled && chatRuntimeState.isConnected) {
    return 'connected'
  }

  return 'ambient'
}
