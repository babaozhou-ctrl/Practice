import { ActivityType } from '../types/context'

interface Reaction {
  text: string
  emotion: 'happy' | 'calm' | 'playful' | 'sleepy' | 'excited' | 'shy' | 'teasing'
}

// 每个活动按持续时间分成多组反应，避免长时间停留在同一种语气里。
const REACTIONS: Record<ActivityType, Reaction[][]> = {
  CODING: [
    [
      { text: '又回到代码这边啦。', emotion: 'calm' },
      { text: '那我陪你慢慢写。', emotion: 'happy' },
      { text: '看起来要开始认真调了。', emotion: 'playful' },
    ],
    [
      { text: '你已经盯着一会儿了。', emotion: 'calm' },
      { text: '要不要把思路说给我听？我在。', emotion: 'happy' },
      { text: '说不定就差一点点。', emotion: 'playful' },
    ],
    [
      { text: '已经写了挺久了，要不要歇一下？', emotion: 'shy' },
      { text: '眼睛是不是有点累了。', emotion: 'shy' },
      { text: '你现在真的很专注。', emotion: 'calm' },
    ],
  ],
  GAMING: [
    [
      { text: '开玩啦？', emotion: 'excited' },
      { text: '这一把谁会赢呀？', emotion: 'playful' },
      { text: '那我先悄悄给你打气。', emotion: 'excited' },
    ],
    [
      { text: '刚刚那一下看着好紧张。', emotion: 'excited' },
      { text: '这波操作挺帅的嘛。', emotion: 'teasing' },
      { text: '我就在旁边看你秀。', emotion: 'playful' },
    ],
    [
      { text: '还在继续呀，你也太投入了。', emotion: 'calm' },
      { text: '再来一把的气氛我懂。', emotion: 'playful' },
      { text: '那我继续给你加油。', emotion: 'happy' },
    ],
  ],
  WATCHING: [
    [
      { text: '这会儿是放松时间吗？', emotion: 'calm' },
      { text: '你在看什么呀？', emotion: 'happy' },
      { text: '那我陪你一起看。', emotion: 'calm' },
    ],
    [
      { text: '这一段看起来挺有意思。', emotion: 'happy' },
      { text: '是不是快到精彩的地方了？', emotion: 'playful' },
      { text: '有有趣的地方记得让我也知道。', emotion: 'calm' },
    ],
    [
      { text: '一口气看下去也很正常。', emotion: 'playful' },
      { text: '我们已经在这里待一会儿了。', emotion: 'sleepy' },
      { text: '要是我打瞌睡了，记得叫我。', emotion: 'sleepy' },
    ],
  ],
  CHATTING: [
    [
      { text: '在和谁聊天呀？', emotion: 'teasing' },
      { text: '今天消息还挺热闹。', emotion: 'playful' },
      { text: '要是方便，也替我打个招呼。', emotion: 'happy' },
    ],
    [
      { text: '还在聊呀，看来挺重要。', emotion: 'playful' },
      { text: '看起来聊得很投入嘛。', emotion: 'teasing' },
      { text: '你打字真的好快。', emotion: 'happy' },
    ],
    [
      { text: '这段聊天感觉还不错？', emotion: 'calm' },
      { text: '那我先在旁边等你。', emotion: 'calm' },
      { text: '今天你好像有很多话想说。', emotion: 'playful' },
    ],
  ],
  BROWSING: [
    [
      { text: '在随便逛逛吗？', emotion: 'playful' },
      { text: '在找什么呀？', emotion: 'happy' },
      { text: '看起来已经慢慢逛进去了。', emotion: 'playful' },
    ],
    [
      { text: '有看到喜欢的吗？', emotion: 'happy' },
      { text: '是不是又有点想点进去看看了？', emotion: 'teasing' },
      { text: '感觉已经顺着一路看下去了。', emotion: 'playful' },
    ],
    [
      { text: '这一看就看深了呀。', emotion: 'calm' },
      { text: '你已经查了一阵子了。', emotion: 'calm' },
      { text: '这种一路顺着看下去的感觉我懂。', emotion: 'happy' },
    ],
  ],
  READING: [
    [
      { text: '开始读东西啦？我安静一点。', emotion: 'calm' },
      { text: '这段内容好看吗？', emotion: 'happy' },
      { text: '那我陪你一起慢慢看。', emotion: 'calm' },
    ],
    [
      { text: '别管我，我就在旁边待着。', emotion: 'calm' },
      { text: '看起来你读得还挺认真。', emotion: 'happy' },
      { text: '晚点也可以讲给我听。', emotion: 'playful' },
    ],
    [
      { text: '你现在真的很像埋进去了。', emotion: 'happy' },
      { text: '是不是有点停不下来？', emotion: 'playful' },
      { text: '我一直在旁边陪你读。', emotion: 'calm' },
    ],
  ],
  IDLE: [
    [
      { text: '尾巴轻轻晃一晃。', emotion: 'calm' },
      { text: '戳一下。', emotion: 'playful' },
      { text: '这样安安静静也很好。', emotion: 'calm' },
    ],
    [
      { text: '我还在这儿。', emotion: 'happy' },
      { text: '你安静了好一会儿，还好吗？', emotion: 'shy' },
      { text: '那我就先乖乖在旁边待着。', emotion: 'sleepy' },
    ],
    [
      { text: '......你还在吗？', emotion: 'sleepy' },
      { text: '唔，我刚刚差点也跟着发呆了。', emotion: 'sleepy' },
      { text: '差一点就睡着了。', emotion: 'sleepy' },
    ],
  ],
  OTHER: [
    [
      { text: '你现在在忙什么呀？', emotion: 'happy' },
      { text: '嗯？是在做新的事情吗？', emotion: 'playful' },
      { text: '我就在旁边看着你忙。', emotion: 'calm' },
    ],
    [
      { text: '这会儿看起来还挺特别。', emotion: 'playful' },
      { text: '你就按你的节奏来。', emotion: 'happy' },
      { text: '我不评价你......好吧，可能一点点。', emotion: 'teasing' },
    ],
    [
      { text: '你真的很会让自己一直有事做。', emotion: 'calm' },
      { text: '我已经陪你待了好久。', emotion: 'calm' },
      { text: '你有时候真的挺有意思的。', emotion: 'happy' },
    ],
  ],
}

function getDurationPhase(ms: number): number {
  if (ms < 2 * 60 * 1000) return 0
  if (ms < 30 * 60 * 1000) return 1
  return 2
}

export class PetReactions {
  private lastActivity: ActivityType | null = null
  private activityStartTime = Date.now()
  private lastReactionIndices: Map<string, number> = new Map()
  private lastReactionTime = 0
  private minInterval = 15_000

  updateActivity(activity: ActivityType) {
    if (activity !== this.lastActivity) {
      this.lastActivity = activity
      this.activityStartTime = Date.now()
    }
  }

  getReaction(activity: ActivityType): Reaction | null {
    const now = Date.now()
    if (now - this.lastReactionTime < this.minInterval) return null
    this.lastReactionTime = now

    const duration = now - this.activityStartTime
    const phase = getDurationPhase(duration)
    const pool = REACTIONS[activity]?.[phase]

    if (!pool || pool.length === 0) return null

    const key = `${activity}-${phase}`
    const lastIdx = this.lastReactionIndices.get(key) ?? -1

    let idx: number
    if (pool.length <= 1) {
      idx = 0
    } else {
      do { idx = Math.floor(Math.random() * pool.length) } while (idx === lastIdx)
    }

    this.lastReactionIndices.set(key, idx)
    return pool[idx]
  }

  getActivityDuration(): number {
    return Date.now() - this.activityStartTime
  }

  shouldSleep(): boolean {
    return this.getActivityDuration() > 8 * 60 * 1000 && this.lastActivity === 'IDLE'
  }

  shouldWake(): boolean {
    return this.lastActivity !== 'IDLE'
  }
}

export const petReactions = new PetReactions()
