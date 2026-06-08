# Mochi Sprite Production Guide

## Objective

Turn Mochi into a product-grade floppy-ear mascot companion based on the user-provided pastel pixel reference.

This is no longer a humanoid prototype direction. The target is a soft long-eared white mascot with calm handheld-game charm.

Primary source files for the current direction:

- `public/pets/mochi/sprite-atlas.png`
- `public/pets/mochi/preview.png`
- [`reference-user-board-v3.png`](./reference-user-board-v3.png)
- [`reference-user-hero-crop-v3.png`](./reference-user-hero-crop-v3.png)
- [`reference-user-board-v2.png`](./reference-user-board-v2.png)
- [`reference-user-hero-crop-v2.png`](./reference-user-hero-crop-v2.png)
- [`reference-baseline.md`](./reference-baseline.md)
- [`reference-concept-v1.png`](./reference-concept-v1.png)
- [`appearance.json`](./appearance.json)
- [`production.json`](./production.json)
- [`qa/contact-sheet.png`](./qa/contact-sheet.png)
- [`qa/previews/`](./qa/previews)
- [`qa/preview-manifest.json`](./qa/preview-manifest.json)

## Reference Read

The supplied reference establishes the correct direction:

- white main body
- baby-blue outline and accent shapes
- long floppy ears as the primary silhouette feature
- tiny blush and very small face
- broad crown with a low-set facial cluster
- short torso with an oversized head read
- warm, harmless, collectible-sticker energy

The final art should keep that softness while reading cleanly on the desktop for long sessions.

## Atlas Contract

- output file: `sprite-atlas.png`
- renderer target: PixiJS atlas playback
- cell size: `192x208`
- row count: `16`
- columns: `8`
- safe padding: `14px`
- baseline: stable across all non-drag rows

### Row Layout

1. `idle_loop`: 6 frames
2. `thinking_loop`: 4 frames
3. `coding_loop`: 4 frames
4. `watching_loop`: 4 frames
5. `chatting_loop`: 4 frames
6. `gaming_loop`: 4 frames
7. `sleep_loop`: 4 frames
8. `happy_react`: 4 frames
9. `excited_loop`: 4 frames
10. `drag`: 4 frames
11. `idle_to_thinking`: 4 frames
12. `thinking_to_idle`: 4 frames
13. `thinking_to_sleep`: 4 frames
14. `idle_to_happy`: 4 frames
15. `welcome_back`: 4 frames
16. `tap_affection`: 4 frames

Unused cells should remain fully transparent.

## Performance-Oriented Drawing Rules

- Keep the body tiny and centered.
- Let the ears provide most of the silhouette width.
- Keep facial features extremely simple and readable.
- Keep the head wider and flatter than a generic bunny dome.
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

### coding_loop

- attentive but emotionally calm
- subtle body focus rather than busy acting
- should feel like quiet company during work

### watching_loop

- curious side-glance energy
- small reactive face changes
- warm co-watching feeling, not hyperactivity

### chatting_loop

- socially open posture
- a brighter mouth shape
- small friendly paw motion is allowed

### gaming_loop

- more alert eyes
- contained excitement
- stronger energy than coding, still low-clutter

### happy_react

- short soft bounce
- brighter mouth shape
- slightly livelier ears
- must settle back to `idle_loop`

### excited_loop

- strongest bounce in the shipped set
- perkier ears while staying floppy
- must preserve the same sweet identity, not become noisy or wild

### drag

- simple dragged pose
- ears trail just enough to imply motion
- no smear effects

### welcome_back

- gentle return greeting
- brighter than idle but softer than excited
- should read as "oh, you're back" rather than a generic celebration

### tap_affection

- quick soft affection response
- tiny upward bounce and cheek warmth
- should feel like a calm mascot leaning into a small touch, not a big cheer animation

### Transition Rows

- `idle_to_thinking`, `thinking_to_idle`, `thinking_to_sleep`, `idle_to_happy`
- transitions should feel eased and intentional, never like unrelated clip jumps
- the silhouette should remain stable while emotional weight shifts through ears, eyes, and body height

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

## QA Workflow

1. Run `npm run qa:mochi` to rebuild the bridge atlas and all QA artifacts in one pass.
2. Review [`qa/contact-sheet.png`](./qa/contact-sheet.png) for silhouette and expression separation.
3. Review [`qa/previews/`](./qa/previews) for motion rhythm, bounce, and transition feel.
4. Use [`qa/preview-manifest.json`](./qa/preview-manifest.json) to confirm preview timing and any clip-specific frame holds match the intended motion feel.
5. Only then promote visual tweaks into the next bridge or production atlas pass.

## Runtime Migration Plan

1. Export the main atlas to `public/pets/mochi/sprite-atlas.png`.
2. Regenerate `public/pets/mochi/preview.png` from the shipped atlas so settings UI and runtime stay visually aligned.
3. Refine the current bridge atlas until it matches the user board more closely in face language, ear acting, loaf posing, and silhouette sweetness.
4. Replace bridge frames with polished hand-authored sprite art in the same atlas layout.
5. Keep current FSM and fallback playback behavior unchanged during visual refinement.
