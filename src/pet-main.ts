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
import { buildCompanionActionPayload } from './domain/companion/CompanionActionContent'
import { CompanionBehaviorStabilizer } from './domain/companion/CompanionBehaviorStabilizer'
import { CompanionSpeechPolicy, type SpeechSource } from './domain/companion/CompanionSpeechPolicy'
import { CompanionStateMachine } from './domain/companion/CompanionStateMachine'
import { ProactiveInteractionScheduler } from './domain/companion/ProactiveInteractionScheduler'
import { attachWorkModeToSnapshot } from './domain/companion/attachWorkModeToSnapshot'
import type { CompanionSnapshot } from './domain/companion/types'
import { readCompanionPreferencesState, subscribeCompanionPreferences } from './preferences/CompanionPreferencesStore'
import { subscribeSelectedPet } from './pets/PetSelectionStore'
import { resolvePetPresentation } from './pets/loader/resolvePetPresentation'
import { resolveSelectedPetPackage } from './pets/resolveSelectedPetPackage'
import { ensurePluginProviderStoreSubscription } from './plugins/PluginProviderStore'
import { PetDragController } from './rendering/controllers/PetDragController'
import { PixiPetRuntime } from './rendering/pixi/PixiPetRuntime'
import { buildRuntimeTextureSetForPetPackage } from './rendering/pixi/pixelTextureFactory'
import { ensurePixiLoaded } from './rendering/pixi/pixiVendor'
import { analyzeFileForCompanionFeed } from './services/companionFeedAnalysis'
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
  showResult(fileName: string, summary: string, onOpenChat: () => void): void
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
}

function randomFrom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
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

function formatSpeechKicker(name?: string | null): string {
  const trimmed = name?.trim()
  if (!trimmed) {
    return DEFAULT_SPEECH_KICKER
  }

  return `${trimmed}陪着你`
}

function buildFeedCardCopy(name?: string | null): FeedCardCopy {
  const petName = name?.trim() || 'bb7'
  return {
    petName,
    confirmTitle: `${petName} 接住文件啦`,
    thinkingTitle: `${petName} 正在看`,
  }
}

class SpeechBubbleController {
  private readonly element: HTMLElement
  private readonly kickerEl: HTMLDivElement
  private readonly textEl: HTMLDivElement
  private activeUntil = 0
  private timer: number | null = null

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

    if (anchor) {
      this.element.style.left = `${Math.round(anchor.x * 100)}%`
      this.element.style.top = `${Math.round(anchor.y * 100)}%`
    }
  }

  setAnchor(anchor?: { x: number; y: number }) {
    if (!anchor) return
    this.element.style.left = `${Math.round(anchor.x * 100)}%`
    this.element.style.top = `${Math.round(anchor.y * 100)}%`
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

function createFeedCardController(
  highlightEl: HTMLElement,
  cardEl: HTMLElement,
): FeedCardController {
  let cardTimer: number | null = null
  let activeMode: FeedCardMode | null = null
  let copy = buildFeedCardCopy()

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
    titleEl.textContent = sanitizeDesktopTextStable(title)

    const textEl = document.createElement('div')
    textEl.className = 'feed-text'
    textEl.textContent = sanitizeDesktopTextStable(text)

    cardEl.appendChild(titleEl)
    cardEl.appendChild(textEl)
    cardEl.classList.add('show')
  }

  return {
    showConfirm(file, onAccept, onReject) {
      showCard(
        'confirm',
        copy.confirmTitle,
        `要把《${file.name}》喂给我吗？我会先轻轻看一遍，再把更完整的内容放进聊天里。`,
      )

      const actionsEl = document.createElement('div')
      actionsEl.className = 'feed-actions'

      const rejectBtn = document.createElement('button')
      rejectBtn.textContent = '先不喂了'
      rejectBtn.onclick = () => {
        onReject()
        hide()
      }

      const acceptBtn = document.createElement('button')
      acceptBtn.textContent = '喂给你'
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
        `我先看看《${fileName}》。稍微等我一下，我会先在桌面轻轻告诉你几句话，再把更完整的整理放进聊天里。`,
      )
      const pulse = document.createElement('div')
      pulse.className = 'feed-pulse'
      cardEl.appendChild(pulse)
    },
    showResult(fileName, summary, onOpenChat) {
      showCard('done', '我看完啦', `《${fileName}》我先帮你顺了一遍。\n${summary}\n\n更完整的内容已经放进聊天里了。`)

      const actionsEl = document.createElement('div')
      actionsEl.className = 'feed-actions'

      const laterBtn = document.createElement('button')
      laterBtn.textContent = '先记着'
      laterBtn.onclick = () => {
        hide()
      }

      const openBtn = document.createElement('button')
      openBtn.textContent = '打开聊天'
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
      showCard('done', '这次没接好', message)
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

function deriveSpeechPresentation(
  snapshot: ReturnType<CompanionStateMachine['getSnapshot']>,
  message: string,
): SpeechPresentation {
  if (snapshot.transientAction === 'tap_affection') {
    return { tone: 'warm', kicker: '摸摸收到' }
  }
  if (snapshot.transientAction === 'welcome_back') {
    return { tone: 'warm', kicker: '你回来啦' }
  }
  if (snapshot.transientAction === 'dragging') {
    return { tone: 'playful', kicker: '跟着你走' }
  }
  if (snapshot.mode === 'focus_guardian') {
    return { tone: 'focus', kicker: '安静陪写' }
  }

  switch (snapshot.scene.id) {
    case 'deep_focus':
      return { tone: 'focus', kicker: '专心一点' }
    case 'steady_focus':
      return { tone: 'focus', kicker: '陪你盯着' }
    case 'reading_nook':
      return { tone: 'quiet', kicker: '一起读着' }
    case 'watch_together':
      return { tone: 'warm', kicker: '陪你一起看' }
    case 'social_corner':
      return { tone: 'playful', kicker: '在你旁边' }
    case 'play_session':
      return { tone: 'playful', kicker: '悄悄围观' }
    case 'late_night_wind_down':
      return { tone: 'quiet', kicker: '夜深啦' }
    case 'quiet_idle':
      return { tone: 'quiet', kicker: '安静陪着' }
    case 'soft_browsing':
      return { tone: 'warm', kicker: '慢慢看看' }
    case 'ambient_presence':
      return { tone: 'warm', kicker: '陪你待着' }
    case 'away':
      return { tone: 'quiet', kicker: '替你看位' }
  }

  if (snapshot.mode === 'proactive') {
    return { tone: 'warm', kicker: '轻轻提醒' }
  }
  if (snapshot.mode === 'reactive' && snapshot.emotion === 'happy') {
    return { tone: 'playful', kicker: '有点开心' }
  }
  if (snapshot.emotion === 'sleepy') {
    return { tone: 'quiet', kicker: '夜深啦' }
  }
  if (snapshot.scene.energy === 'bright') {
    return { tone: 'playful', kicker: '有点开心' }
  }
  if (snapshot.scene.energy === 'low') {
    return { tone: 'quiet', kicker: '安静陪着' }
  }
  if (message.length <= 8) {
    return { tone: 'playful', kicker: '小声回应' }
  }

  return { tone: 'quiet', kicker: DEFAULT_SPEECH_KICKER }
}

function setupContextMenu(menu: HTMLElement) {
  const items: Array<{ label?: string; action?: () => void; divider?: boolean; danger?: boolean }> = [
    { label: '打开聊天', action: () => window.electronAPI?.openChat?.() },
    { label: '打开设置', action: () => window.electronAPI?.openSettings?.() },
    { divider: true },
    { label: '切换穿透', action: () => window.electronAPI?.toggleClickThrough?.() },
    { divider: true },
    { label: '退出 Deep Pet', action: () => window.electronAPI?.quitApp?.(), danger: true },
  ]

  const hide = () => menu.classList.remove('show')
  menu.innerHTML = ''

  for (const item of items) {
    if ('divider' in item) {
      const divider = document.createElement('div')
      divider.className = 'd'
      menu.appendChild(divider)
      continue
    }

    const entry = document.createElement('div')
    entry.className = 'i'
    entry.textContent = item.label ?? ''
    if (item.danger) {
      entry.style.color = 'rgba(255, 170, 170, 0.95)'
    }
    entry.onclick = () => {
      hide()
      item.action?.()
    }
    menu.appendChild(entry)
  }

  return {
    show(x: number, y: number) {
      menu.style.left = `${x}px`
      menu.style.top = `${y}px`
      menu.classList.add('show')
    },
    hide,
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
      return '\u966a\u4f60\u4e00\u8d77\u770b'
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

function getStableFeedCardCopy(name?: string | null): FeedCardCopy {
  const petName = name?.trim() || 'bb7'
  return {
    petName,
    confirmTitle: `${petName} \u63a5\u4f4f\u6587\u4ef6\u5566`,
    thinkingTitle: `${petName} \u6b63\u5728\u770b\u5462`,
  }
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
        `\u8981\u628a\u300a${file.name}\u300b\u5582\u7ed9\u6211\u5417\uff1f\u6211\u4f1a\u5148\u8f7b\u8f7b\u770b\u4e00\u904d\uff0c\u518d\u628a\u66f4\u5b8c\u6574\u7684\u5185\u5bb9\u653e\u8fdb\u804a\u5929\u91cc\u3002`,
      )

      const actionsEl = document.createElement('div')
      actionsEl.className = 'feed-actions'

      const rejectBtn = document.createElement('button')
      rejectBtn.textContent = '\u5148\u4e0d\u5582\u4e86'
      rejectBtn.onclick = () => {
        onReject()
        hide()
      }

      const acceptBtn = document.createElement('button')
      acceptBtn.textContent = '\u5582\u7ed9\u4f60'
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
        `\u6211\u5148\u770b\u770b\u300a${fileName}\u300b\u3002\u7a0d\u5fae\u7b49\u6211\u4e00\u4e0b\uff0c\u6211\u4f1a\u5148\u5728\u684c\u9762\u8f7b\u8f7b\u544a\u8bc9\u4f60\u51e0\u53e5\u8bdd\uff0c\u518d\u628a\u66f4\u5b8c\u6574\u7684\u6574\u7406\u653e\u8fdb\u804a\u5929\u91cc\u3002`,
      )
      const pulse = document.createElement('div')
      pulse.className = 'feed-pulse'
      cardEl.appendChild(pulse)
    },
    showResult(fileName, summary, onOpenChat) {
      showCard(
        'done',
        '\u6211\u770b\u5b8c\u5566',
        `\u300a${fileName}\u300b\u6211\u5148\u5e2e\u4f60\u987a\u4e86\u4e00\u904d\u3002\n${summary}\n\n\u66f4\u5b8c\u6574\u7684\u5185\u5bb9\u5df2\u7ecf\u653e\u8fdb\u804a\u5929\u91cc\u4e86\u3002`,
      )

      const actionsEl = document.createElement('div')
      actionsEl.className = 'feed-actions'

      const laterBtn = document.createElement('button')
      laterBtn.textContent = '\u5148\u8bb0\u7740'
      laterBtn.onclick = () => {
        hide()
      }

      const openBtn = document.createElement('button')
      openBtn.textContent = '\u6253\u5f00\u804a\u5929'
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
      showCard('done', '\u8fd9\u6b21\u6ca1\u63a5\u597d', message)
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

function setupStableContextMenu(menu: HTMLElement) {
  const items: Array<{ label?: string; action?: () => void; divider?: boolean; danger?: boolean }> = [
    { label: '\u6253\u5f00\u804a\u5929', action: () => window.electronAPI?.openChat?.() },
    { label: '\u6253\u5f00\u8bbe\u7f6e', action: () => window.electronAPI?.openSettings?.() },
    { divider: true },
    { label: '\u5207\u6362\u7a7f\u900f', action: () => window.electronAPI?.toggleClickThrough?.() },
    { divider: true },
    { label: '\u9000\u51fa Deep Pet', action: () => window.electronAPI?.quitApp?.(), danger: true },
  ]

  const hide = () => menu.classList.remove('show')
  menu.innerHTML = ''

  for (const item of items) {
    if (item.divider) {
      const divider = document.createElement('div')
      divider.className = 'd'
      menu.appendChild(divider)
      continue
    }

    const entry = document.createElement('div')
    entry.className = 'i'
    entry.textContent = item.label ?? ''
    if (item.danger) {
      entry.style.color = 'rgba(255, 170, 170, 0.95)'
    }
    entry.onclick = () => {
      hide()
      item.action?.()
    }
    menu.appendChild(entry)
  }

  return {
    show(x: number, y: number) {
      menu.style.left = `${x}px`
      menu.style.top = `${y}px`
      menu.classList.add('show')
    },
    hide,
  }
}

function getCleanSpeechKicker(
  snapshot: ReturnType<CompanionStateMachine['getSnapshot']>,
  message: string,
): string {
  if (snapshot.transientAction === 'tap_affection') return '摸摸收到'
  if (snapshot.transientAction === 'welcome_back') return '你回来啦'
  if (snapshot.transientAction === 'dragging') return '跟着你走'
  if (snapshot.mode === 'focus_guardian') return '安静陪写'

  switch (snapshot.scene.id) {
    case 'deep_focus':
      return '专心一点'
    case 'steady_focus':
      return '陪你盯着'
    case 'reading_nook':
      return '一起读着'
    case 'watch_together':
      return '陪你一起看'
    case 'social_corner':
      return '在你旁边'
    case 'play_session':
      return '悄悄围观'
    case 'late_night_wind_down':
      return '夜深啦'
    case 'quiet_idle':
      return '安静陪着'
    case 'soft_browsing':
      return '慢慢看看'
    case 'ambient_presence':
      return '陪你待着'
    case 'away':
      return '替你看位'
  }

  if (snapshot.mode === 'proactive') return '轻轻提醒'
  if (snapshot.mode === 'reactive' && snapshot.emotion === 'happy') return '有点开心'
  if (snapshot.emotion === 'sleepy') return '夜深啦'
  if (snapshot.scene.energy === 'bright') return '有点开心'
  if (snapshot.scene.energy === 'low') return '安静陪着'
  if (message.length <= 8) return '小声回应'
  return '安静陪着'
}

function getCleanFeedCardCopy(name?: string | null): FeedCardCopy {
  const petName = name?.trim() || 'bb7'
  return {
    petName,
    confirmTitle: `${petName} 接住文件啦`,
    thinkingTitle: `${petName} 正在看呢`,
  }
}

function applyCleanContextMenu(menu: HTMLElement) {
  const items: Array<{ label?: string; action?: () => void; divider?: boolean; danger?: boolean }> = [
    { label: '打开聊天', action: () => window.electronAPI?.openChat?.() },
    { label: '打开设置', action: () => window.electronAPI?.openSettings?.() },
    { divider: true },
    { label: '切换穿透', action: () => window.electronAPI?.toggleClickThrough?.() },
    { divider: true },
    { label: '退出 Deep Pet', action: () => window.electronAPI?.quitApp?.(), danger: true },
  ]

  menu.innerHTML = ''
  for (const item of items) {
    if (item.divider) {
      const divider = document.createElement('div')
      divider.className = 'd'
      menu.appendChild(divider)
      continue
    }

    const entry = document.createElement('div')
    entry.className = 'i'
    entry.textContent = item.label ?? ''
    if (item.danger) {
      entry.style.color = 'rgba(255, 170, 170, 0.95)'
    }
    entry.onclick = () => item.action?.()
    menu.appendChild(entry)
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

  let petPackage = resolveSelectedPetPackage()
  const speech = new SpeechBubbleController(speechEl, petPackage.productionProfile?.anchors.speechBubble)
  const speechPolicy = new CompanionSpeechPolicy()
  const contextMenu = setupStableContextMenu(contextMenuEl)
  const feedCard = createStableFeedCardController(feedHighlightEl, feedCardEl)
  const proceduralScale = 15
  let textureSet = await buildRuntimeTextureSetForPetPackage(petPackage, proceduralScale)
  let currentSpeechKicker = getStableNamedKicker(petPackage.manifest.name)
  let lowDistractionMode = readCompanionPreferencesState().lowDistractionMode
  const companion = new CompanionStateMachine()
  const stabilizer = new CompanionBehaviorStabilizer()
  const proactiveScheduler = new ProactiveInteractionScheduler()
  const workModeRuntime = new WorkModeRuntime(readWorkModeState())
  const initialScreenPerception = readScreenPerceptionSnapshot()
  let latestScreenSummary = initialScreenPerception?.summary ?? null
  let latestScreenSource = initialScreenPerception?.source ?? null
  let pendingFeedFile: File | null = null
  let isFeedAnalyzing = false

  companion.setMemory(readCompanionMemory())
  companion.setScreenPerception(initialScreenPerception)
  feedCard.setCopy(getStableFeedCardCopy(petPackage.manifest.name))

  const runtime = new PixiPetRuntime({
    mount,
    textureSet,
    speech,
  })

  await runtime.init()
  runtime.setLowDistractionMode(lowDistractionMode)
  const initialSnapshot = stabilizer.stabilize(
    attachWorkModeToSnapshot(companion.getSnapshot(), workModeRuntime.getSignals()),
  )
  let latestSnapshot = initialSnapshot

  const speakWithPolicy = (
    source: SpeechSource,
    snapshot: typeof latestSnapshot,
    message: string,
    duration: number,
    override?: Partial<SpeechPresentation>,
  ) => {
    const decision = speechPolicy.evaluate({
      source,
      snapshot,
      intent: { message, duration },
      now: Date.now(),
      lowDistractionMode,
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
          ...getStableSpeechPresentation(snapshot, safeMessage),
        },
    )
    return true
  }

  runtime.applyPresentation(resolvePetPresentation(initialSnapshot, petPackage))

  const refreshPresentation = (snapshot: CompanionSnapshot) => {
    const stabilizedSnapshot = stabilizer.stabilize(
      attachWorkModeToSnapshot(snapshot, workModeRuntime.getSignals()),
    )
    latestSnapshot = stabilizedSnapshot
    runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))
    return stabilizedSnapshot
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
      })

      emitCompanionFeedAnalysisResult(result, {
        idPrefix: 'feed',
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
      )

      if (!didSpeak) {
        speech.show(result.desktopUtterance, 3_200, {
          tone: 'focus',
          kicker: '已经喂给我了',
        })
      }

      feedCard.showResult(result.fileName, result.briefSummary, () => {
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

  const unsubscribeMemory = subscribeCompanionMemory((memory) => {
    companion.setMemory(memory)
    refreshPresentation(companion.getSnapshot())
  })

  const unsubscribeWorkMode = subscribeWorkMode((state) => {
    workModeRuntime.setState(state)
    refreshPresentation(companion.getSnapshot())
  })

  const unsubscribeSelectedPet = subscribeSelectedPet(async () => {
    petPackage = resolveSelectedPetPackage()
    textureSet = await buildRuntimeTextureSetForPetPackage(petPackage, proceduralScale)
    currentSpeechKicker = getStableNamedKicker(petPackage.manifest.name)
    feedCard.setCopy(getStableFeedCardCopy(petPackage.manifest.name))
    runtime.replaceTextureSet(textureSet)
    speech.setAnchor(petPackage.productionProfile?.anchors.speechBubble)
    refreshPresentation(companion.getSnapshot())
  })

  const unsubscribeCompanionPreferences = subscribeCompanionPreferences((state) => {
    lowDistractionMode = state.lowDistractionMode
    runtime.setLowDistractionMode(lowDistractionMode)
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
    )
  })

  const unsubscribeScreenPerception = subscribeScreenPerception((snapshot) => {
    useContextStore.getState().setScreenPerception(snapshot)
    companion.setScreenPerception(snapshot)
    latestScreenSummary = snapshot.summary ?? null
    latestScreenSource = snapshot.source ?? null
    refreshPresentation(companion.getSnapshot())
  })

  const dragController = new PetDragController({
    element: runtime.canvas,
    onDragStart: () => {
      refreshPresentation(companion.handleDragStart().snapshot)
    },
    onDragEnd: () => {
      refreshPresentation(companion.handleDragEnd().snapshot)
    },
    onTap: () => {
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

  runtime.canvas.addEventListener('dragenter', (event) => {
    if (isFeedAnalyzing) return
    if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return
    event.preventDefault()
    feedCard.setDragActive(true)
  })

  runtime.canvas.addEventListener('dragover', (event) => {
    if (isFeedAnalyzing) return
    if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
    feedCard.setDragActive(true)
  })

  runtime.canvas.addEventListener('dragleave', () => {
    if (pendingFeedFile) return
    feedCard.setDragActive(false)
  })

  runtime.canvas.addEventListener('drop', (event) => {
    if (isFeedAnalyzing) return
    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return
    event.preventDefault()
    event.stopPropagation()
    feedCard.setDragActive(true)
    pendingFeedFile = files[0]
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
    })
  })

  window.electronAPI?.onContextUpdate?.((info: { title: string; process: string; idleMs?: number }) => {
    syncContextStoreFromWindowInfo(info)
    const result = companion.handleContext(info)
    captureCompanionRuntimeContext(result.snapshot.activity, result.snapshot.scene.id, info.title)
    const stabilizedSnapshot = refreshPresentation(result.snapshot)

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
    const result = companion.handleTick()
    workModeRuntime.tick()
    const workModeSignals = workModeRuntime.getSignals()
    const snapshotWithWorkMode = attachWorkModeToSnapshot(result.snapshot, workModeSignals)
    const stabilizedSnapshot = stabilizer.stabilize(snapshotWithWorkMode)
    latestSnapshot = stabilizedSnapshot
    runtime.applyPresentation(resolvePetPresentation(stabilizedSnapshot, petPackage))

    const proactiveSpeech = proactiveScheduler.evaluate(
      stabilizedSnapshot,
      companion.getRuntimeSignals(),
      workModeSignals,
      lowDistractionMode,
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

function syncContextStoreFromWindowInfo(info: { title: string; process: string; idleMs?: number }) {
  const contextStore = useContextStore.getState()
  contextStore.setActiveWindow(info)
  contextStore.setActivity(classifyActivity(info))
}

void bootstrap()
