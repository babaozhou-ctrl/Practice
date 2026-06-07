Legacy compatibility alias for the built-in Mochi atlas.

- `sprite-atlas.png`

New runtime code uses `/pets/mochi/sprite-atlas.png` as the canonical built-in asset path.
This folder remains only to avoid breaking older prototype references while the project finishes retiring historical alias paths.

Current status:

- `sprite-atlas.png` is mirrored from the canonical Mochi package when needed
- the active source of truth is `public/pets/mochi/`
