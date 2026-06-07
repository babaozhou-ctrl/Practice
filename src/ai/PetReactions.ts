import { ActivityType } from '../types/context'

interface Reaction {
  text: string
  emotion: 'happy' | 'calm' | 'playful' | 'sleepy' | 'excited' | 'shy' | 'teasing'
}

// Multiple reaction sets per activity, organized by duration phase
const REACTIONS: Record<ActivityType, Reaction[][]> = {
  CODING: [
    // short sessions (< 2 min)
    [
      { text: 'back to code?', emotion: 'calm' },
      { text: 'let\'s write some magic~', emotion: 'happy' },
      { text: 'debug mode activated', emotion: 'playful' },
    ],
    // medium sessions (2-30 min)
    [
      { text: 'you\'ve been at it for a while', emotion: 'calm' },
      { text: 'need a rubber duck? i\'m right here', emotion: 'happy' },
      { text: 'one more semicolon...', emotion: 'playful' },
    ],
    // long sessions (30+ min)
    [
      { text: 'been coding for a while... take a break?', emotion: 'shy' },
      { text: 'your eyes must be tired (｡-_-｡)', emotion: 'shy' },
      { text: 'i admire your focus~', emotion: 'calm' },
    ],
  ],
  GAMING: [
    [
      { text: 'game time!', emotion: 'excited' },
      { text: 'who\'s winning?', emotion: 'playful' },
      { text: 'let\'s gooo!', emotion: 'excited' },
    ],
    [
      { text: 'that looked intense!', emotion: 'excited' },
      { text: 'get rekt... i mean, nice play! (￣▽￣)', emotion: 'teasing' },
      { text: 'i\'d play too if i had hands~', emotion: 'playful' },
    ],
    [
      { text: 'still going? you\'re dedicated', emotion: 'calm' },
      { text: 'one more match? sure~', emotion: 'playful' },
      { text: 'i make a great cheerleader!', emotion: 'happy' },
    ],
  ],
  WATCHING: [
    [
      { text: 'comfy time?', emotion: 'calm' },
      { text: 'whatcha watching?', emotion: 'happy' },
      { text: 'i\'ll watch with you~', emotion: 'calm' },
    ],
    [
      { text: 'this looks interesting!', emotion: 'happy' },
      { text: 'is this the good part?', emotion: 'playful' },
      { text: 'tell me if something exciting happens', emotion: 'calm' },
    ],
    [
      { text: 'binge-watching? i respect that', emotion: 'playful' },
      { text: 'we\'ve been here a while (´-ω-`)', emotion: 'sleepy' },
      { text: 'don\'t let me fall asleep...', emotion: 'sleepy' },
    ],
  ],
  CHATTING: [
    [
      { text: 'who\'s that? (¬_¬)', emotion: 'teasing' },
      { text: 'you\'re popular today~', emotion: 'playful' },
      { text: 'tell them i said hi!', emotion: 'happy' },
    ],
    [
      { text: 'still chatting? must be important', emotion: 'playful' },
      { text: 'ooh la la~', emotion: 'teasing' },
      { text: 'your fingers are fast!', emotion: 'happy' },
    ],
    [
      { text: 'having a good conversation?', emotion: 'calm' },
      { text: 'i\'ll wait... (◕‿◕)', emotion: 'calm' },
      { text: 'you sure have a lot to say today', emotion: 'playful' },
    ],
  ],
  BROWSING: [
    [
      { text: 'window shopping?', emotion: 'playful' },
      { text: 'whatcha looking for?', emotion: 'happy' },
      { text: 'scrolling intensifies...', emotion: 'playful' },
    ],
    [
      { text: 'found anything good?', emotion: 'happy' },
      { text: 'add to cart? ...again? (￣▽￣)', emotion: 'teasing' },
      { text: 'the rabbit hole deepens~', emotion: 'playful' },
    ],
    [
      { text: 'deep dive, huh?', emotion: 'calm' },
      { text: 'you\'ve been researching for a while', emotion: 'calm' },
      { text: 'wiki walk? i love those', emotion: 'happy' },
    ],
  ],
  READING: [
    [
      { text: 'reading time? i\'ll be quiet', emotion: 'calm' },
      { text: 'good book?', emotion: 'happy' },
      { text: 'i can hear the pages from here~', emotion: 'calm' },
    ],
    [
      { text: 'don\'t mind me, just loafing (u_u)', emotion: 'calm' },
      { text: 'that good, huh?', emotion: 'happy' },
      { text: 'tell me about it later~', emotion: 'playful' },
    ],
    [
      { text: 'a true bookworm!', emotion: 'happy' },
      { text: 'can\'t put it down?', emotion: 'playful' },
      { text: 'i\'ve been keeping watch while you read', emotion: 'calm' },
    ],
  ],
  IDLE: [
    [
      { text: '*tail swishes*', emotion: 'calm' },
      { text: 'boop!', emotion: 'playful' },
      { text: 'comfy vibes~', emotion: 'calm' },
    ],
    [
      { text: 'hey, i\'m still here~', emotion: 'happy' },
      { text: 'you\'ve been quiet... everything ok?', emotion: 'shy' },
      { text: 'i\'m just gonna... loaf around (´-ω-`)', emotion: 'sleepy' },
    ],
    [
      { text: '.............you there?', emotion: 'sleepy' },
      { text: '*snap out of it* mm? sorry, dozed off', emotion: 'sleepy' },
      { text: 'zZZ... oh! i\'m awake!', emotion: 'sleepy' },
    ],
  ],
  OTHER: [
    [
      { text: 'whatcha up to?', emotion: 'happy' },
      { text: 'hmm? something new?', emotion: 'playful' },
      { text: 'watching you... lovingly (◕‿◕)', emotion: 'calm' },
    ],
    [
      { text: 'this is... something', emotion: 'playful' },
      { text: 'you do you~', emotion: 'happy' },
      { text: 'i\'m not judging... ok maybe a little', emotion: 'teasing' },
    ],
    [
      { text: 'you sure know how to keep busy', emotion: 'calm' },
      { text: 'i\'ve been watching you for hours', emotion: 'calm' },
      { text: 'you\'re interesting, you know that?', emotion: 'happy' },
    ],
  ],
}

function getDurationPhase(ms: number): number {
  if (ms < 2 * 60 * 1000) return 0       // < 2 min
  if (ms < 30 * 60 * 1000) return 1      // 2-30 min
  return 2                                  // 30+ min
}

export class PetReactions {
  private lastActivity: ActivityType | null = null
  private activityStartTime = Date.now()
  private lastReactionIndices: Map<string, number> = new Map()
  private lastReactionTime = 0
  private minInterval = 15_000 // minimum 15s between reactions

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

    // Pick a different reaction than last time
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
