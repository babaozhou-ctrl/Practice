# Deep Pet Phase Roadmap

## Phase 1: Render Foundation

Goal:
Build a production-grade pet runtime foundation.

Deliverables:

- transparent frameless pet window
- PixiJS bootstrapped in pet window
- built-in pet package loader
- atlas-driven idle and drag animations
- smooth drag without visible hitching
- typed IPC contract for position and interaction events

Exit criteria:

- pet stays at 60 FPS during idle
- drag remains visually smooth
- render loop runs independently from React

## Phase 2: Emotional Runtime

Goal:
Introduce layered state, emotion, and animation intent mapping.

Deliverables:

- activity state model
- emotion state model
- interaction mode model
- transition guards and hold timers
- state-to-animation mapping

Exit criteria:

- no abrupt state snapping
- context changes do not create animation thrash

## Phase 3: Contextual Companion

Goal:
Make the pet responsive to real user context.

Deliverables:

- normalized active-window pipeline
- idle detection
- confidence-aware activity classification
- ambient bubble reactions
- work-session reminder rules

Exit criteria:

- pet behavior clearly differs between coding, gaming, video, and idle
- interruptions remain controlled

## Phase 4: AI Companion Core

Goal:
Turn the pet into a relational AI companion.

Deliverables:

- streaming chat
- provider abstraction
- long-term memory pipeline
- emotionally conditioned replies
- proactive interaction scheduler

Exit criteria:

- responses feel companion-like rather than assistant-like
- memory carries over meaningful preferences and continuity

## Phase 5: Ecosystem and Modularity

Goal:
Open the system for pets, providers, and community extensions.

Deliverables:

- pet import flow
- plugin runtime
- capability permission model
- sample third-party extension

Exit criteria:

- a new pet package can be added without changing core runtime
- a new AI provider can be swapped through plugin contract
