# Phase 1 Implementation Plan

## Objective

Replace the current prototype pet renderer with a product-grade runtime foundation centered on PixiJS, typed pet packages, and a clean separation between render logic and domain logic.

## Current Constraints

- `src/pet-main.ts` mixes rendering, drag behavior, mood logic, contextual reactions, and UI behavior in one file.
- `src/engine/*` is canvas-oriented and should not become the long-term renderer core.
- `electron/main.ts` already gives us the correct two-window direction and can be retained as the shell.

## Phase 1 Work Items

1. Add PixiJS and bootstrap a dedicated pet scene runtime in `src/rendering/pixi`.
2. Introduce typed pet package schema types in `src/pets/schema`.
3. Load the built-in `pets/mochi` package through a real loader instead of hard-coded animation maps.
4. Extract drag control into a renderer controller with frame-coalesced IPC updates.
5. Reduce `src/pet-main.ts` to composition and bootstrapping.
6. Keep chat/settings in the UI window and prevent React from participating in frame rendering.

## Files Likely to Change First

- `package.json`
- `src/pet-main.ts`
- `electron/preload.ts`
- `electron/main.ts`
- new files under `src/rendering/*`
- new files under `src/pets/*`
- new files under `src/shared/types/*`

## Success Criteria

- pet renders through PixiJS rather than canvas 2D
- drag remains smooth at interactive speed
- built-in pet assets load via package definition
- pet animation loop is independent from React state
