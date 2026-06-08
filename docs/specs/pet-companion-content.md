# Pet Companion Content

`companion-content.json` is the pet-level content layer for proactive companion actions.

Current goal:

- keep `pet-main.ts` focused on runtime orchestration
- let each pet package define its own proactive action titles, labels, and follow-up prompts
- make future personality swaps possible without rewriting TypeScript logic

## Current shape

Built-in pet packages can provide:

```json
{
  "version": "1.0.0",
  "proactive": {
    "focusEnding": { "title": "", "actions": [] },
    "breakEnding": { "title": "", "actions": [] },
    "overworkFirm": { "title": "", "actions": [] },
    "overworkGentle": { "title": "", "actions": [] },
    "productiveSession": { "title": "", "actions": [] },
    "lateNight": { "title": "", "actions": [] },
    "watchTogether": { "title": "", "actions": [] },
    "gentleIdle": { "title": "", "actions": [] }
  }
}
```

## Runtime behavior

- The runtime still decides *when* a proactive event should happen.
- The pet package decides *how* that event is phrased and what action chips should appear.
- If a pet package does not provide companion content, the runtime falls back to built-in defaults.

## Why this exists

This keeps companion presence scalable:

- different pets can feel meaningfully different
- future imported pets can ship their own proactive style
- proactive interaction is no longer hard-coded into a single runtime entry file
