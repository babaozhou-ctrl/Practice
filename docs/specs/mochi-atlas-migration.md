# Mochi Atlas Migration

## Purpose

Move the built-in Mochi companion from bridge-quality procedural placeholder sprites toward a production-quality atlas without replacing the runtime again.

## Current Runtime Behavior

- the renderer first attempts to load `/pets/mochi/sprite-atlas.png`
- the public runtime atlas is mirrored from the procedural export pipeline while the production art pass is still in progress
- animation timing comes from `pets/mochi/animations.json`
- state selection, fallback playback, and micro-motion behavior remain unchanged while art quality improves
- QA artifacts are regenerated from the same atlas source so runtime and review stay aligned

## Atlas Drop-In Contract

Place the runtime atlas at:

- `public/pets/mochi/sprite-atlas.png`

The runtime slices this file according to `pets/mochi/production.json`:

- cell size: `192x208`
- row order:
  - `idle_loop`
  - `thinking_loop`
  - `coding_loop`
  - `watching_loop`
  - `chatting_loop`
  - `gaming_loop`
  - `sleep_loop`
  - `happy_react`
  - `excited_loop`
  - `drag`
  - `idle_to_thinking`
  - `thinking_to_idle`
  - `thinking_to_sleep`
  - `idle_to_happy`
- frame counts and optional per-frame durations are read from package metadata

## Why This Matters

This keeps the product moving in a production direction:

- art can be upgraded independently from state logic
- the Pixi runtime does not need another rewrite
- bridge art, polished concept art, and final release art can coexist during development
- the built-in companion package now behaves like a real asset pipeline rather than a hard-coded mock sprite

## Next Steps

1. Continue tightening Mochi's idle, watching, chatting, happy, and excited clips toward indie-game-quality readability.
2. Validate every atlas revision through the QA contact sheet and preview GIF pack.
3. Add finer anchor metadata only if speech bubble placement or interaction points need it.
4. Remove legacy compatibility mirrors after the Mochi package is fully canonical everywhere in runtime.
