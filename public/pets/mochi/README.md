Place the production Mochi atlas here as:

- `sprite-atlas.png`

The runtime now attempts to load `/pets/mochi/sprite-atlas.png` first and automatically falls back to the procedural placeholder sprite when the atlas is not present yet.

Current status:

- `sprite-atlas.png` now exists as a placeholder export generated from `scripts/export_mochi_placeholder_atlas.py`
- this atlas now follows the floppy-ear pastel mascot direction from the user-provided reference
- the current visual identity lock also lives in `pets/mochi/reference-concept-v1.png`
- the current QA review sheet lives in `pets/mochi/qa/contact-sheet.png`
- it is still a bridge asset rather than the final polished production atlas
