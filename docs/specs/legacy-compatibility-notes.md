# Legacy Compatibility Notes

## Purpose

The current project has largely moved from historical humanoid prototype naming to the canonical built-in companion `Mochi`.

Some legacy file names still exist to avoid breaking older experiments and prototype import paths. These legacy modules should be treated as shims only.

## Canonical Built-In Modules

- `src/pets/loader/loadBuiltInMochi.ts`
- `src/engine/PixelMochi.ts`
- `src/engine/PetDexMochi.ts`
- `src/engine/DrawMochiPetDex.ts`

## Legacy Shims

- `src/pets/loader/loadBuiltInCatgirl.ts`
- `src/pets/loader/loadBuiltInLegacyCatgirl.ts`
- `src/engine/PixelCatgirl.ts`
- `src/engine/PetDexCatgirl.ts`
- `src/engine/DrawCatgirl.ts`

## Migration Rule

Any new runtime, asset, plugin, or documentation work should import the Mochi-first modules and names. Legacy catgirl-named files should only remain as thin compatibility wrappers until the remaining prototype surfaces are fully retired.

At this point, `DrawMochiPetDex.ts` owns the actual PetDex drawing implementation and `DrawCatgirl.ts` is only a forwarding shim.
