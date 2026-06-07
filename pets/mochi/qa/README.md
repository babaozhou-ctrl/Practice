# Mochi QA Assets

This folder stores review artifacts for the built-in Mochi atlas pipeline.

Primary generation entry:

- `npm run qa:mochi`

Current files:

- `contact-sheet.png`: row-by-row frame overview generated from `public/pets/mochi/sprite-atlas.png`
- `previews/*.gif`: one looping preview per atlas row for motion QA
- `preview-manifest.json`: clip timing, per-frame durations, and output index for the generated previews

Use this folder to review:

- state-to-state facial separation
- ear silhouette acting
- bounce and resting-height rhythm
- transition readability before runtime playback changes
