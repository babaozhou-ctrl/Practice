import type {
  BuiltInPetPackage,
  PetCompanionProactiveTemplateContext,
} from '../../shared/types/petPackage'
import type { WorkModeSignals } from '../../types/workMode'
import type { CompanionSnapshot } from './types'

export function resolveSharedAttention(snapshot: CompanionSnapshot): string | null {
  const recentFile = snapshot.memory?.recentFileAnalyses?.[0]

  return (
    snapshot.screenContext.shortSummary?.trim() ||
    (recentFile ? `刚刚一起看过的《${recentFile.fileName}》` : null) ||
    snapshot.memory?.recentTopics?.[0]?.trim() ||
    snapshot.activeWindow?.title?.trim() ||
    null
  )
}

export function buildProactiveTemplateContext(
  petPackage: BuiltInPetPackage | null,
  snapshot: CompanionSnapshot,
  workMode: WorkModeSignals,
  preferredName?: string | null,
): PetCompanionProactiveTemplateContext {
  const recentFile = snapshot.memory?.recentFileAnalyses?.[0]

  return {
    petName: petPackage?.manifest.name ?? 'bb7',
    preferredName: preferredName?.trim() || snapshot.memory?.preferredName?.trim() || null,
    sceneLabel: snapshot.scene.label,
    sharedAttention: resolveSharedAttention(snapshot),
    recentTopic: snapshot.memory?.recentTopics?.[0]?.trim() || null,
    recentFileName: recentFile?.fileName ?? null,
    ritual: snapshot.memory?.rituals?.[0]?.trim() || null,
    activeWindowTitle: snapshot.activeWindow?.title?.trim() || null,
    workModeLabel: resolveWorkModeLabel(workMode),
  }
}

export function renderProactiveTemplate(
  template: string,
  context: PetCompanionProactiveTemplateContext,
): string {
  let rendered = template
  let previous = ''

  // Allow pet packages to express "say this only when context exists" without
  // pushing branching logic back into the scheduler.
  while (rendered !== previous) {
    previous = rendered
    rendered = rendered
      .replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key: string, content: string) =>
        hasTemplateValue(key, context) ? content : '',
      )
      .replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key: string, content: string) =>
        hasTemplateValue(key, context) ? '' : content,
      )
  }

  return rendered
    .replace(/\{\{petName\}\}/g, context.petName)
    .replace(/\{\{preferredName\}\}/g, context.preferredName ?? context.petName)
    .replace(/\{\{sceneLabel\}\}/g, context.sceneLabel ?? '')
    .replace(/\{\{sharedAttention\}\}/g, context.sharedAttention ?? '')
    .replace(/\{\{recentTopic\}\}/g, context.recentTopic ?? '')
    .replace(/\{\{recentFileName\}\}/g, context.recentFileName ?? '')
    .replace(/\{\{ritual\}\}/g, context.ritual ?? '')
    .replace(/\{\{activeWindowTitle\}\}/g, context.activeWindowTitle ?? '')
    .replace(/\{\{workModeLabel\}\}/g, context.workModeLabel ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([，。！？、；：])/g, '$1')
    .trim()
}

function hasTemplateValue(
  key: string,
  context: PetCompanionProactiveTemplateContext,
): boolean {
  switch (key) {
    case 'petName':
      return Boolean(context.petName?.trim())
    case 'preferredName':
      return Boolean(context.preferredName?.trim())
    case 'sceneLabel':
      return Boolean(context.sceneLabel?.trim())
    case 'sharedAttention':
      return Boolean(context.sharedAttention?.trim())
    case 'recentTopic':
      return Boolean(context.recentTopic?.trim())
    case 'recentFileName':
      return Boolean(context.recentFileName?.trim())
    case 'ritual':
      return Boolean(context.ritual?.trim())
    case 'activeWindowTitle':
      return Boolean(context.activeWindowTitle?.trim())
    case 'workModeLabel':
      return Boolean(context.workModeLabel?.trim())
    default:
      return false
  }
}

function resolveWorkModeLabel(workMode: WorkModeSignals): string | null {
  if (!workMode.enabled) {
    return null
  }

  if (workMode.isBreakActive) {
    return workMode.phase === 'long_break' ? '长休息' : '短休息'
  }

  if (workMode.isPaused) {
    return '暂停中'
  }

  if (workMode.isFocusActive) {
    return '专注中'
  }

  return null
}
