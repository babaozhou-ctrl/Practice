# Deep Pet Product Architecture

## 1. Product Intent

Deep Pet is not a desktop widget demo. It is a long-running AI companion that lives quietly on the desktop, reacts to user context, expresses emotion through high-quality animation, and creates a steady sense of presence without becoming noisy or tool-like.

The product should feel:

- cozy
- soft
- minimal
- immersive
- emotionally warm
- companion-like

The product must avoid:

- obvious web-page feeling
- Electron demo feeling
- floating browser feeling
- generic chat app feeling
- cheap desktop pet feeling
- feature pile-up

## 2. Product Pillars

1. Presence first
   The pet should feel alive even when it is not speaking.

2. Emotion before utility
   Behavior, animation, and tone should communicate inner state before exposing functions.

3. Context over interruption
   The pet should respond to the user's current situation and avoid unnecessary noise.

4. Rendering quality is product quality
   Motion quality, idle detail, and drag smoothness are core product features.

5. Extensibility from day one
   Pet assets, personality, AI provider, and plugins must all be swappable.

## 3. High-Level System Architecture

```text
+-------------------+         +----------------------+
| Electron Main     | <-----> | Native Integrations  |
| window lifecycle  |         | active window, idle  |
| IPC router        |         | file open, tray, OS  |
+---------+---------+         +----------------------+
          |
          | IPC / event bus
          v
+-------------------+         +----------------------+
| Pet Window        |         | Companion UI Window  |
| PixiJS renderer   |         | React UI shell       |
| animation runtime |         | chat, settings, mode |
| drag / hit test   |         | memory review, files |
+---------+---------+         +----------+-----------+
          |                              |
          | shared typed state/events    | shared typed state/events
          +--------------+---------------+
                         |
                         v
               +----------------------+
               | Shared Domain Layer   |
               | FSM, emotion, memory  |
               | context policy        |
               | plugin runtime        |
               +----------------------+
```

## 4. Runtime Boundary Design

### 4.1 Main Process Responsibilities

- create and manage transparent pet window
- create and manage optional UI window
- provide typed IPC bridge
- poll or subscribe to OS context signals
- own tray, lifecycle, startup, auto-update hooks
- isolate privileged operations from renderer
- coordinate plugin loading permissions

Main process should not contain companion logic beyond orchestration and privileged adapters.

### 4.2 Pet Renderer Window Responsibilities

- run a dedicated PixiJS render loop
- load pet package assets
- play layered animations
- process drag, hover, click, hit zones
- consume FSM snapshots and animation intents
- display lightweight speech bubbles and ambient reactions

This window must remain lean and render-focused.

### 4.3 UI Window Responsibilities

- chat panel
- settings
- work mode controls
- file analysis results
- plugin and pet management
- memory review tools

The UI window should feel like a companion console, not the primary home of the product.

### 4.4 Shared Domain Layer Responsibilities

- finite state machine
- emotion model
- context interpretation
- proactive interaction scheduler
- memory system
- AI provider abstraction
- pet package loader
- plugin capability contracts

This layer should be mostly framework-agnostic TypeScript.

## 5. Recommended Codebase Layout

```text
/docs
  /specs
    product-architecture.md
    runtime-modules.md
    phase-roadmap.md

/electron
  main.ts
  preload.ts
  /ipc
  /services
    active-window-service.ts
    idle-service.ts
    file-dialog-service.ts
    plugin-host-service.ts

/src
  /app
    /ui
    /pet
  /domain
    /companion
    /emotion
    /fsm
    /memory
    /context
    /work-mode
  /rendering
    /pixi
    /animation
    /scenes
    /controllers
  /platform
    /ipc
    /adapters
  /plugins
    /runtime
    /contracts
  /pets
    /loader
    /schema
  /shared
    /types
    /events
    /utils
  main.tsx
  pet-main.ts

/pets
  /mochi
    manifest.json
    animations.json
    personality.json
    states.json
    sprite-atlas.png
    emotes/
    sfx/

/plugins
  /example-companion-tools
    manifest.json
    index.ts
```

## 6. Rendering Architecture

## 6.1 Why PixiJS

The current canvas prototype is enough to validate direction, but not enough for product-grade motion. PixiJS should be the permanent rendering foundation because it provides:

- hardware acceleration
- stable sprite batching
- asset loader and texture atlas support
- filters and blend effects when needed
- ticker and timing control
- future compatibility with layered rigs and VFX

## 6.2 Render Pipeline

```text
Pet Package Loader
  -> Texture Atlas / Spine-like logical clips
  -> Animation Graph
  -> Live Rig Controller
  -> Pixi Scene Graph
  -> Dedicated 60 FPS ticker
  -> Window movement sync / hit testing
```

## 6.3 Render Composition

The pet scene should be layered:

- base body
- face and eyes
- ears
- tail
- accessories
- reaction effects
- speech bubble anchor
- debug overlay in development only

Each state animation should support additive micro-motions:

- breathing
- blink
- ear twitch
- tail sway
- center-of-gravity shift
- subtle squash/stretch

These should not rely on separate full-frame sprite sheets alone. The preferred approach is:

- primary state loops from sprite atlas
- additive offsets and timing warps in runtime
- optional overlay frames for expression accents

This creates a more alive feeling without exploding asset count.

## 6.4 Render Loop Rules

- pet render loop is independent from React
- React state updates must never drive every frame
- animation timing is owned by Pixi ticker
- drag updates should be frame-coalesced
- no synchronous heavy work on pointer move
- avoid layout/reflow-driven rendering paths

## 6.5 Windowing Rules

- transparent frameless pet window
- no standard OS chrome
- always-on-top with controlled click-through mode
- precise input region if we later move to non-rectangular interaction
- UI window separate from pet window to avoid render interference

## 7. Animation System Design

## 7.1 Animation Taxonomy

Each pet package needs the following animation categories:

- `idle_loop`
- `ambient_micro`
- `transition_in`
- `transition_out`
- `emote`
- `reaction`
- `drag`
- `sleep`
- `wake`
- `context_specific`

## 7.2 Animation Controller

The controller should combine three layers:

1. Base state loop
2. Additive micro-motion layer
3. Temporary overlay action or emote

Priority order:

`drag > explicit reaction > state transition > contextual overlay > idle micro-motion`

## 7.3 Transition Policy

Every emotional or contextual state change should not snap instantly. Use:

- enter blend duration
- optional anticipation frame
- hold minimum duration
- exit blend
- cooldown before opposite emotion

This avoids noisy animation thrashing when context changes rapidly.

## 8. FSM and Emotion Architecture

## 8.1 Separation of Concerns

Do not model the companion with one flat state value only. Use three coordinated models:

1. Activity State
   Reflects user context.
   Examples: `coding`, `gaming`, `watching_video`, `chatting`

2. Emotion State
   Reflects inner feeling.
   Examples: `idle`, `sleepy`, `happy`, `thinking`, `excited`

3. Interaction Mode
   Reflects output behavior policy.
   Examples: `quiet`, `observing`, `reactive`, `proactive`, `focus_guardian`

This is more stable than a single monolithic FSM.

## 8.2 Core State Model

```text
Inputs
- active window classification
- idle time
- time of day
- work session duration
- recent chat sentiment
- pet needs and affinity meters

Derived Domain
- activity state
- emotion state
- energy level
- social appetite
- interruption budget

Outputs
- animation intent
- speech intent
- proactive prompt intent
- reminder intent
- UI badges
```

## 8.3 Canonical Companion States

Emotion-oriented states:

- `idle`
- `sleepy`
- `happy`
- `thinking`
- `excited`

Context-oriented states:

- `coding`
- `gaming`
- `watching_video`
- `chatting`

These should be represented as separate but correlated layers. Example:

- activity = `coding`
- emotion = `thinking`
- mode = `quiet`

## 8.4 FSM Transition Principles

- every transition needs a reason
- every transition has a minimum state hold time
- interruptions should respect user activity sensitivity
- gaming should reduce chatter frequency
- focus mode should suppress non-essential proactive prompts
- sleepiness should depend on time of day and idle rhythm, not only timers

## 8.5 Suggested Domain Events

- `ACTIVE_WINDOW_CHANGED`
- `USER_IDLE_STARTED`
- `USER_IDLE_ENDED`
- `LONG_WORK_SESSION`
- `CHAT_SESSION_STARTED`
- `CHAT_SENTIMENT_POSITIVE`
- `PET_INTERACTION_TAPPED`
- `PET_DRAG_STARTED`
- `PET_DRAG_ENDED`
- `WORK_BREAK_DUE`
- `QUIET_HOURS_STARTED`

## 9. Context Awareness Architecture

## 9.1 Signal Sources

- active foreground window
- process name
- title heuristics
- full-screen detection
- idle duration
- optional audio/video heuristics later
- optional keyboard/mouse intensity later

## 9.2 Context Pipeline

```text
OS signals
  -> raw context snapshot
  -> classifier
  -> confidence score
  -> debounce / smoothing
  -> domain event
  -> FSM + proactive policy
```

## 9.3 Context Categories

- coding
- gaming
- watching_video
- chatting
- browsing
- reading
- idle
- unknown

Classification should return both label and confidence. Low-confidence classifications should produce softer behavior.

## 10. AI Interaction Architecture

## 10.1 Design Goal

The AI must feel like a companion role, not a generic assistant shell.

## 10.2 AI Subsystems

- provider adapter
- streaming response engine
- prompt composer
- memory retriever
- emotional style mapper
- proactive nudge generator
- safety and verbosity policy

## 10.3 Memory Layers

1. Session memory
   Recent conversation turns and current work context.

2. Episodic memory
   Things the user said recently that matter for continuity.

3. Preference memory
   Stable likes, dislikes, routines, communication preferences.

4. Relationship memory
   Tone evolution, shared rituals, special nicknames, recurring habits.

Memory should not be an unbounded chat log. It needs summarization, scoring, and retrieval.

## 10.4 Proactive Interaction Rules

Proactivity should be lightweight and budgeted:

- low-frequency by default
- less frequent during gaming or focus
- warmer during long work sessions or late-night work
- contextually anchored
- never stack multiple prompts

Each proactive action should consume from an interruption budget that recovers over time.

## 10.5 AI Provider Abstraction

Support multiple providers through one contract:

- `streamChat(request)`
- `embedMemory(items)`
- `summarizeMemory(items)`
- `analyzeDocument(input)`
- `healthCheck()`

This lets us support DeepSeek and future providers without rewriting domain logic.

## 11. Pet Package Architecture

## 11.1 Goals

- import custom pets
- swap personality independently from art
- swap animations independently from AI provider
- support future community packages

## 11.2 Pet Package Contract

Each pet package should contain:

- `manifest.json`
- `animations.json`
- `states.json`
- `personality.json`
- sprite atlases and optional effects
- optional audio assets

The package contract should be versioned.

## 11.3 Pet Manifest Example

```json
{
  "id": "mascot.mochi",
  "name": "Mochi",
  "version": "1.0.0",
  "schemaVersion": "1.0.0",
  "renderer": "pixi-atlas",
  "assets": {
    "atlas": "sprite-atlas.png",
    "animations": "animations.json",
    "states": "states.json",
    "personality": "personality.json"
  }
}
```

## 12. Plugin System Architecture

## 12.1 Plugin Goals

- allow new pet behaviors
- allow external AI providers
- allow work-mode extensions
- allow analysis tools and workflows
- allow community add-ons with permission boundaries

## 12.2 Plugin Categories

- AI provider plugin
- pet behavior plugin
- context classifier plugin
- work mode plugin
- document analyzer plugin
- UI extension plugin

## 12.3 Plugin Runtime Principles

- explicit manifest with capabilities
- sandboxed execution where practical
- permission prompts for sensitive access
- versioned API surface
- crash isolation
- deterministic activation lifecycle

## 12.4 Plugin Manifest Shape

```json
{
  "id": "example-companion-tools",
  "name": "Example Companion Tools",
  "version": "0.1.0",
  "entry": "index.js",
  "capabilities": [
    "work-mode",
    "document-analysis"
  ],
  "permissions": [
    "fs.read.user-selected",
    "ai.provider.invoke"
  ]
}
```

## 13. File Analysis Architecture

## 13.1 Supported Inputs

- PDF
- DOCX
- TXT / Markdown
- source code files

## 13.2 Flow

```text
drag file
  -> secure file intake
  -> parser by mime / extension
  -> normalized document blocks
  -> chunking and metadata extraction
  -> AI summarize / extract / explain
  -> UI result panel + memory hooks
```

## 13.3 Implementation Notes

- parsing should run off the render loop
- large files should stream or chunk
- results should support summary, key points, and ask-followup
- code files should preserve language metadata

## 14. Work Companion Mode

Work mode is not a timer widget pasted into the app. It is a behavior layer that changes how the companion supports the user.

Modes:

- normal
- focus
- pomodoro
- break
- overwork-guard

Behavior examples:

- focus mode reduces chatter, increases supportive check-ins
- break mode uses softer, more playful animations
- overwork mode uses concern-oriented prompts and higher reminder priority

## 15. Performance Architecture

## 15.1 Hard Requirements

- stable 60 FPS pet rendering on common desktop hardware
- smooth drag with no visible hitching
- no React-driven frame rendering
- low idle CPU usage
- bounded memory growth

## 15.2 Performance Strategies

- separate pet window and UI window
- isolate Pixi ticker from React lifecycle
- use Zustand selectors to avoid broad rerenders
- keep shared state normalized and event-driven
- debounce noisy context updates
- chunk AI and document tasks off the main render path
- pool temporary objects in render-critical paths
- preload active pet textures
- avoid sync filesystem work during interaction

## 15.3 Suggested Performance Budgets

- pet frame time target: under 8 ms on average
- drag event processing: under 2 ms per frame
- context classification burst: under 10 ms for normal cases
- idle CPU target: low single-digit usage
- memory growth: bounded by explicit cache policies

## 16. Art Direction Constraints

- pixel-art first
- indie-game quality target
- cozy anime sensibility
- soft palette, readable silhouette
- expressive micro-poses

Avoid:

- painterly illustration look
- oversmoothed vector look
- generic streaming mascot aesthetic
- over-detailed cluttered costume design that harms animation readability

## 17. Phase Plan

## Phase 1

- transparent pet window
- PixiJS renderer
- smooth drag
- sprite animation system
- typed render state bridge

## Phase 2

- layered FSM and emotion system
- state transitions
- animation intent mapping

## Phase 3

- context sensing pipeline
- speech bubble interaction
- scenario-driven reactions

## Phase 4

- streaming AI chat
- long-term memory
- proactive interaction scheduler

## Phase 5

- plugin runtime
- pet package ecosystem
- community extensibility

## 18. Current Codebase Gap Assessment

The current project already shows useful direction:

- separate pet and UI windows
- early state and context concepts
- initial AI, memory, and file analysis placeholders

But it is still prototype-grade in the following ways:

- pet rendering is canvas-based rather than PixiJS-based
- state modeling is too flat for emotional and contextual coordination
- memory is only a rolling message buffer
- file analysis is placeholder-only for PDF and DOCX
- native context detection is functional but not yet normalized as a pipeline
- UI styling still feels closer to a web panel than a product-grade companion console

## 19. Recommended Next Engineering Move

Before adding more features, Phase 1 should refactor the runtime around these concrete tasks:

1. Introduce PixiJS and replace the current canvas pet renderer.
2. Split domain logic from renderer code into a framework-agnostic core.
3. Define typed pet package schemas and load one canonical built-in pet package.
4. Replace the flat FSM with layered domain state and intent outputs.
5. Keep chat and settings in the separate React window, but reduce pet window React involvement to near zero.

This order maximizes long-term quality and keeps the future companion feeling coherent.
