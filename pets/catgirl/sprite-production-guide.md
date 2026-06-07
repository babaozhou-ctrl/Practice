# Mochi Sprite Production Guide

## Objective

Turn Mochi into a product-grade floppy-ear mascot companion based on the user-provided pastel pixel reference.

This is no longer a catgirl direction. The target is a soft long-eared white mascot with calm handheld-game charm.

## Reference Read

The supplied reference establishes the correct direction:

- white main body
- baby-blue outline and accent shapes
- long floppy ears as the primary silhouette feature
- tiny blush and very small face
- rounded toy-like proportions
- warm, harmless, collectible-sticker energy

The final art should keep that softness while reading cleanly on the desktop for long sessions.

## Atlas Contract

- output file: `sprite-atlas.png`
- renderer target: PixiJS atlas playback
- cell size: `192x208`
- row count: `5`
- columns: `8`
- safe padding: `14px`
- baseline: stable across all non-drag rows

### Row Layout

1. `idle_loop`: 6 frames
2. `thinking_loop`: 4 frames
3. `sleep_loop`: 4 frames
4. `happy_react`: 4 frames
5. `drag`: 4 frames

Unused cells should remain fully transparent.

## Performance-Oriented Drawing Rules

- Keep the body tiny and centered.
- Let the ears provide most of the silhouette width.
- Keep facial features extremely simple and readable.
- Prefer clean outline and filled shape blocks over texture detail.
- Preserve a stable floating baseline so the pet feels calm and not jittery.

## Animation Notes

### idle_loop

- gentle float
- one blink
- tiny ear sway
- almost no noise

### thinking_loop

- subtle lean
- one paw or body lift
- curious but quiet

### sleep_loop

- lower resting height
- drooped ears
- closed eyes
- sleepy icon only if it remains attached-feeling and minimal

### happy_react

- short soft bounce
- brighter mouth shape
- slightly livelier ears
- must settle back to `idle_loop`

### drag

- simple dragged pose
- ears trail just enough to imply motion
- no smear effects

## Palette Guardrails

- outline: `#8abfe6`
- outline dark: `#6fa8d6`
- fur: `#fbfdff`
- fur shadow: `#e7f3ff`
- accent: `#c6e6fb`
- accent shadow: `#a8d4f2`
- inner ear: `#ffd5e3`
- blush: `#f6b9cb`
- eye: `#7fb4e5`

Avoid dark moody palettes, sharp contrast overload, and busy costume additions.

## Export Checklist

- transparent background only
- no floor shadow
- no detached UI-like symbols unless intentionally tiny and state-specific
- no text
- no scene fragments
- no anti-aliased blur halos
- no per-frame scale popping
- same mascot face and ear identity in every clip

## Runtime Migration Plan

1. Keep exporting `sprite-atlas.png` to `public/pets/catgirl/`.
2. Refine the placeholder export until it captures the reference spirit better.
3. Replace placeholder frames with polished hand-authored sprite art in the same atlas layout.
4. Keep current FSM and fallback playback behavior unchanged during visual refinement.
