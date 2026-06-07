# Mochi Reference Baseline

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

- a tiny white floppy-ear mascot companion
- a broad head with a soft flat crown instead of a tall round dome
- extra-long ears with thick roots and softly weighted ends
- tiny separated blue eyes with a small amount of white shine
- tiny blue dot-like nose and `w`-leaning mouth cluster
- pink cheek marks that sit low and outward, never anime-style blush bands
- a very short torso with tucked paws and tiny feet
- a calm, collectible, retro virtual-pet emotional read

## Must Keep

- broad low-noise front silhouette
- white body with pastel blue contour lines
- soft top accent band or short forehead stripe language
- face placed slightly low on the head, not centered too high
- ultra-compact body mass beneath a much larger head
- ears as the first silhouette read in every state
- toy-like proportions that stay readable at tiny desktop scale

## Must Avoid

- catgirl or humanoid anatomy
- bunny mascot tropes with tall upright posture or springy rabbit legs
- maid outfit, costume layers, or anime fashion detailing
- sharp ears, spiky hair, or aggressive gesture language
- poster-layout decoration, sticker-sheet framing, or UI chrome in final runtime art
- painterly illustration rendering that stops reading like a game sprite asset
- exact cloning of the user reference mascot without interpretation or adaptation for runtime animation

## Atlas Translation Notes

When converting this reference into sprite frames:

- preserve the wide head-to-body ratio across all states
- keep the ears thick near the head and heavy at the tips
- keep the face tiny; emotion should come from ear angle, eye openness, and body height before mouth exaggeration
- favor small, readable state shifts over noisy props or floating effects
- use loaf, curl, and tiny bounce poses inspired by retro mascot icons rather than full humanoid acting
- preserve a stable body baseline so the companion feels calm on desktop

## Current Production Gap

The shipped `sprite-atlas.png` is still a bridge-quality export. It should continue moving toward this baseline with:

- flatter and wider head construction
- stronger similarity to the user board face spacing
- denser ear acting and more believable ear weight
- more convincing loaf and rest poses
- cleaner state separation without leaving the mascot style family
