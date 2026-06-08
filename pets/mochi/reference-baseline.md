# Mochi Reference Baseline

## Freeze Status

The current Mochi sprite shipped in `public/pets/mochi/sprite-atlas.png` is now the approved appearance lock.

- Status: locked
- Locked on: 2026-06-08
- Change policy: do not change Mochi's core silhouette, proportions, or face design unless the user explicitly requests a new art direction in the future
- This file now describes the locked production direction, not an open exploration target

## Runtime Truth

For actual app display, the authoritative asset is:

1. `public/pets/mochi/sprite-atlas.png`
2. `public/pets/mochi/preview.png`, generated from the current atlas for settings-card use only

The reference boards remain the upstream art-direction source, but they are not the runtime asset shown on desktop.
If the app display, preview card, and reference board ever disagree, fix the shipped atlas and regenerate the preview instead of introducing another parallel appearance file.

## Canonical Visual Sources

Mochi now follows this priority order:

1. [`reference-user-board-v3.png`](./reference-user-board-v3.png), the newest user-provided board crop and the primary direction lock.
2. [`reference-user-hero-crop-v3.png`](./reference-user-hero-crop-v3.png), the tighter crop used to judge face spacing, body proportion, and ear drop from the newest board.
3. [`reference-user-board-v2.png`](./reference-user-board-v2.png), the earlier cleaned crop kept for traceability.
4. [`reference-user-hero-crop-v2.png`](./reference-user-hero-crop-v2.png), the earlier hero crop kept for traceability.
5. [`reference-concept-v2.png`](./reference-concept-v2.png), the internal concept pass that is now only valid when it stays subordinate to the user board.
6. [`reference-user-board.png`](./reference-user-board.png), the archived first-pass board crop.
7. [`reference-concept-v1.png`](./reference-concept-v1.png), legacy comparison only.

The concept art is not the authority anymore. The user board is the authority. If a new atlas frame disagrees with the board, the frame should be corrected, not the reference.

## Identity Lock

Mochi must read as:

- a high-quality Japanese healing-style pixel desk companion
- a white floppy-ear bunny with a soft, balanced head-to-body ratio
- slender soft ears that read as gentle and relaxed, but not oversized
- centered tiny blue eyes with a small amount of white shine
- a tiny blue dot-like nose and soft `w`-leaning mouth cluster
- pink cheek marks that stay subtle, clean, and calm
- a visible torso with complete small limbs and short natural legs
- a quiet, warm, game-sprite presence rather than a sticker, emoji, or novelty mascot

## Must Keep

- balanced, low-noise front silhouette
- white body with pastel blue contour lines
- soft top accent band or short forehead stripe language
- face placed close to center with a calm, readable expression
- body large enough to feel like a full companion character, not a tiny charm beneath a giant head
- ears readable in every state without dominating the entire silhouette
- GBA-era readability at tiny desktop scale
- clean pixel clusters with minimal shading and no dirty pixels

## Must Avoid

- catgirl or humanoid anatomy
- giant head / tiny body exaggeration
- huge floppy ears that overpower the body
- sticker, emoji, reaction-face, or cheap mobile-pet styling
- sharp ears, spiky hair, or aggressive gesture language
- poster-layout decoration, sticker-sheet framing, or UI chrome in final runtime art
- painterly illustration rendering that stops reading like a game sprite asset
- exploration changes that drift away from the approved locked sprite without explicit user direction

## Atlas Translation Notes

When converting this reference into sprite frames:

- preserve the current balanced head-to-body ratio across all states
- keep the ears soft and slim, with only mild emotional sway
- keep the face simple and centered; emotion should come from eye openness, ear angle, and body height before mouth exaggeration
- favor small, readable state shifts over noisy props or floating effects
- use quiet sit, rest, and tiny bounce poses inspired by handheld-era pet sprites rather than sticker-sheet acting
- preserve a stable body baseline so the companion feels calm on desktop

## Approval Note

This appearance is approved by the user as the project's locked companion identity.
Future work should focus on animation quality, behavior quality, text quality, packaging, and system polish instead of redesigning the character.
