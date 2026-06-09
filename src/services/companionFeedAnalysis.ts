import { buildCompanionChatContext } from '../ai/CompanionContextAdapter'
import {
  buildCompanionBriefSummary,
  buildCompanionDesktopSummary,
  buildFileAnalysisUtterance,
  resolveFileAnalysisLead,
} from '../ai/CompanionDesktopSummary'
import { captureCompanionFileAnalysis } from '../ai/CompanionMemoryStore'
import { resolveAIChatProvider, resolveFileAnalysisProvider } from '../plugins/PluginCapabilityRegistry'
import { usePluginProviderStore } from '../plugins/PluginProviderStore'
import { resolveSelectedPetPackage } from '../pets/resolveSelectedPetPackage'
import { readChatConfig } from '../store/chatStore'
import type { ChatMessageAction, CompanionChatContext } from '../types/chat'
import type { ActivityType } from '../types/context'

export interface CompanionFeedAnalysisResult {
  fileName: string
  desktopSummary: string
  briefSummary: string
  detailedAnalysis: string
  context: CompanionChatContext
  actions: ChatMessageAction[]
  desktopUtterance: string
}

export function buildFeedAnalysisPromptForScene(
  fileName: string,
  detailedAnalysis: string,
  context: CompanionChatContext,
): string {
  const sceneIntro = resolveSceneIntro(context, fileName)
  const sceneInstruction = resolveSceneInstruction(context)

  return [
    sceneIntro,
    sceneInstruction,
    '这是我们刚刚一起看过的内容：',
    detailedAnalysis,
    '如果有必要，也可以轻轻提醒我，接下来最值得继续看的部分在哪里。',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildFeedFollowUpActionsForScene(
  fileName: string,
  detailedAnalysis: string,
  context: CompanionChatContext,
): ChatMessageAction[] {
  const fillInputAction: ChatMessageAction = {
    id: 'fill-input',
    label: '先放进输入框',
    prompt: buildFeedAnalysisPromptForScene(fileName, detailedAnalysis, context),
    fillOnly: true,
  }

  switch (context.sceneId) {
    case 'deep_focus':
    case 'steady_focus':
      return [
        {
          id: 'extract-actionable',
          label: '只讲要点',
          prompt: [
            `我现在还在专注状态里，我们继续看《${fileName}》。`,
            '请用很克制、很清楚的方式，只告诉我最关键的结论、风险，或者可以立刻执行的信息，尽量少打断我。',
            '刚才的完整整理：',
            detailedAnalysis,
          ].join('\n'),
        },
        {
          id: 'connect-to-work',
          label: '结合当前工作',
          prompt: [
            `请结合我现在手上的事，陪我继续看《${fileName}》。`,
            '帮我判断这份内容和我当前工作最相关的地方在哪里，并告诉我先看哪一段最省时间。',
            '刚才的完整整理：',
            detailedAnalysis,
          ].join('\n'),
        },
        fillInputAction,
      ]
    case 'watch_together':
      return [
        {
          id: 'co-watch',
          label: '一起聊亮点',
          prompt: [
            `我们像一起看内容那样，继续聊《${fileName}》。`,
            '请用轻一点、像陪我一起讨论的语气，告诉我这里最有意思或最值得注意的地方。',
            '刚才的完整整理：',
            detailedAnalysis,
          ].join('\n'),
        },
        fillInputAction,
      ]
    case 'late_night_wind_down':
      return [
        {
          id: 'soft-wrap',
          label: '温柔讲重点',
          prompt: [
            `已经有点晚了，我们轻一点继续看《${fileName}》。`,
            '请用更安静、更柔和的语气告诉我最重要的内容，不要一下子把气氛拉得太紧。',
            '刚才的完整整理：',
            detailedAnalysis,
          ].join('\n'),
        },
        {
          id: 'save-for-tomorrow',
          label: '留到明天继续',
          prompt: [
            `请陪我给《${fileName}》做一个能安心停下来的收尾。`,
            '帮我只保留明天最值得继续看的部分，用很轻的方式整理出来。',
            '刚才的完整整理：',
            detailedAnalysis,
          ].join('\n'),
        },
        fillInputAction,
      ]
    default:
      return [
        {
          id: 'explain-gently',
          label: '先讲重点',
          prompt: [
            `我们继续看《${fileName}》。`,
            '请像陪我一起读一样，用温和一点的语气告诉我最重要的三件事。',
            '刚才的完整整理：',
            detailedAnalysis,
          ].join('\n'),
        },
        {
          id: 'find-worth-reading',
          label: '标出必看部分',
          prompt: [
            `请继续陪我看《${fileName}》。`,
            '帮我从这份整理里挑出最值得继续细看的部分，并告诉我为什么。',
            '刚才的完整整理：',
            detailedAnalysis,
          ].join('\n'),
        },
        fillInputAction,
      ]
  }
}

export async function analyzeFileForCompanionFeed(
  file: File,
  options: {
    activity: ActivityType
    windowTitle: string
    windowProcess: string
    screenSummary?: string | null
    screenSource?: CompanionChatContext['screenSource']
  },
): Promise<CompanionFeedAnalysisResult> {
  const providers = usePluginProviderStore.getState()
  const config = readChatConfig()
  const fileAnalysisProvider = resolveFileAnalysisProvider(providers.fileAnalysisProviderId)
  const aiChatProvider = resolveAIChatProvider(providers.aiChatProviderId)
  const context = buildCompanionChatContext(
    options.activity,
    options.windowTitle,
    options.windowProcess,
    options.screenSummary ?? null,
    options.screenSource ?? null,
  )

  const content = await fileAnalysisProvider.readFile(file)
  let detailedAnalysis = await fileAnalysisProvider.summarize({
    fileName: file.name,
    content,
  })

  if (config.enabled && config.apiKey) {
    try {
      detailedAnalysis = await aiChatProvider.summarizeDocument({
        config,
        fileName: file.name,
        content,
      })
    } catch {
      // Fall back to the lightweight local summary.
    }
  }

  const briefSummary = buildCompanionBriefSummary(
    detailedAnalysis,
    `《${file.name}》里有几处值得继续看。`,
    100,
  )
  const desktopSummary = buildCompanionDesktopSummary(
    detailedAnalysis,
    `《${file.name}》里有一两处值得接着看。`,
    56,
  )

  captureCompanionFileAnalysis(file.name, briefSummary, detailedAnalysis, context.sceneId)

  const petPackage = resolveSelectedPetPackage()
  const desktopUtterance = resolveFileAnalysisDesktopUtterance(
    petPackage.manifest.name || 'bb7',
    petPackage.companionContent?.fileAnalysis?.desktopUtterance,
    file.name,
    desktopSummary,
    context.sceneId,
  )

  return {
    fileName: file.name,
    desktopSummary,
    briefSummary,
    detailedAnalysis,
    context,
    actions: buildFeedFollowUpActionsForScene(file.name, detailedAnalysis, context),
    desktopUtterance,
  }
}

function resolveSceneIntro(context: CompanionChatContext, fileName: string): string {
  switch (context.sceneId) {
    case 'deep_focus':
      return `我知道你还在专注里，陪你稳稳地看一眼《${fileName}》。`
    case 'steady_focus':
      return `你现在还在工作状态里，我们高效一点，但别太生硬地看《${fileName}》。`
    case 'reading_nook':
      return `我们像并排读东西一样，一起看看《${fileName}》。`
    case 'watch_together':
      return `我们像一起看内容那样，顺着《${fileName}》继续聊。`
    case 'social_corner':
      return `你现在偏聊天陪伴一点，我把《${fileName}》整理成更自然的说法陪你看。`
    case 'play_session':
      return `我知道你现在不想被打断太多，我们轻一点扫一眼《${fileName}》。`
    case 'late_night_wind_down':
      return `已经有点晚了，我们轻一点看《${fileName}》，别把气氛一下子拉紧。`
    case 'quiet_idle':
    case 'ambient_presence':
      return `我们就安静一点，一起看看《${fileName}》。`
    case 'soft_browsing':
      return `你现在是轻度浏览状态，我陪你自然一点看看《${fileName}》。`
    default:
      return `陪我一起看看这个文件吧，《${fileName}》。`
  }
}

function resolveSceneInstruction(context: CompanionChatContext): string {
  if (context.sceneId === 'deep_focus' || context.sceneId === 'steady_focus') {
    return '先用克制、清楚、低打扰的语气帮我讲重点，不要像生硬的工具汇报。'
  }
  if (context.sceneId === 'late_night_wind_down') {
    return '先用更安静、更柔和的陪伴语气帮我讲重点，不要太硬。'
  }
  if (context.sceneId === 'watch_together') {
    return '先像一起看内容那样帮我讲重点，可以有一点轻微反应，但别变成正式报告。'
  }
  return '先用陪伴式的语气帮我讲重点，不要像生硬的工具简报。'
}

function resolveFileAnalysisDesktopUtterance(
  petName: string,
  template: string | null | undefined,
  fileName: string,
  desktopSummary: string,
  sceneId: string,
): string {
  const normalizedTemplate = template?.trim()
  if (!normalizedTemplate) {
    return buildFileAnalysisUtterance(fileName, desktopSummary, sceneId)
  }

  const lead = resolveFileAnalysisLead(fileName, sceneId)

  return normalizedTemplate
    .replace(/\{\{petName\}\}/g, petName)
    .replace(/\{\{fileName\}\}/g, fileName)
    .replace(/\{\{desktopSummary\}\}/g, desktopSummary)
    .replace(/\{\{lead\}\}/g, lead)
}
