# Legacy Compatibility Notes

## Purpose

This note records the naming migration that moved the project away from earlier humanoid prototype directions and into the current built-in companion line: `bb7 / Mochi`.

At this stage, the old catgirl-named runtime modules are no longer part of the active codepath. This file remains only as a small historical note so future contributors understand why some older discussions or screenshots may still mention that naming.

## Current Canonical Built-In Modules

- `src/pets/loader/loadBuiltInMochi.ts`
- `src/pets/loader/resolvePetPresentation.ts`
- `pets/mochi/`
- `public/pets/mochi/`

## Migration Rule

Any new runtime, asset, plugin, or documentation work should follow the Mochi-first naming and the current `bb7` companion identity.

Do not reintroduce:

- catgirl-named runtime modules
- humanoid prototype package names
- duplicate built-in pet lines that compete with `pets/mochi/`

If an old note, script, screenshot, or prototype asset still references the historical naming, treat it as archived context rather than an active integration target.
