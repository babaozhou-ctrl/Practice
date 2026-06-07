# Deep Pet Runtime Modules

## Module Map

## 1. Main Process

### `electron/main.ts`

- boot application
- create pet window
- create companion UI window
- bind tray
- coordinate services

### `electron/services/active-window-service.ts`

- active app snapshot
- idle time reading
- optional full-screen detection

### `electron/services/plugin-host-service.ts`

- discover plugins
- validate manifests
- load plugin capabilities
- isolate failures

## 2. Shared Domain

### `src/domain/fsm`

- layered state machines
- transition guards
- minimum hold duration
- derived state snapshots

### `src/domain/emotion`

- energy, comfort, social appetite
- mood adjustment rules
- interruption budget

### `src/domain/context`

- raw snapshot schema
- classifiers
- debouncing and confidence handling

### `src/domain/companion`

- proactive scheduler
- behavior policies
- speech intent generator

### `src/domain/memory`

- session memory
- episodic summaries
- preference storage
- retrieval contracts

## 3. Rendering

### `src/rendering/pixi`

- application bootstrap
- stage graph
- texture loading
- ticker lifecycle

### `src/rendering/animation`

- atlas playback
- additive motion controllers
- transition blending

### `src/rendering/controllers`

- drag controller
- hit area controller
- speech anchor controller

## 4. UI

### `src/app/ui`

- chat
- settings
- work modes
- file analysis results

UI should subscribe only to selected Zustand slices, never the live frame loop.

## 5. Pet Package System

### `src/pets/schema`

- JSON schema types
- manifest validation
- animation clip validation

### `src/pets/loader`

- built-in pet discovery
- external import flow
- asset reference resolution

## 6. Plugin Contracts

### `src/plugins/contracts`

- AI provider contract
- work mode contract
- analyzer contract
- context classifier extension contract

### `src/plugins/runtime`

- lifecycle hooks
- permission checks
- plugin registry

## Event Backbone

Recommended event categories:

- window events
- context events
- companion events
- render intent events
- chat events
- plugin events

Prefer explicit typed events over loose cross-module store mutation.
