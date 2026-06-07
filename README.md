# Deep Pet

Deep Pet is a desktop companion project built around presence, motion quality, and calm interaction.

The goal is not to ship a novelty desktop toy or a floating chat widget. The goal is to build a character that can stay on the desktop for hours, feel alive in small ways, react to context, and remain pleasant to live with.

The current built-in companion is **Mochi**, a soft floppy-ear pixel mascot designed for a warm, low-noise desktop presence.

## Why This Exists

Most desktop pets are either visually thin, interaction-heavy, or too close to a browser app in a transparent window.

Deep Pet takes a different route:

- motion quality comes first
- the pet should feel present even when it is silent
- context matters more than constant interruption
- the interface should support the companion, not replace it
- pets, personalities, and providers should stay replaceable

## What Is Working Today

- transparent borderless desktop pet window
- PixiJS rendering with an independent runtime loop
- smooth drag interaction and transient reaction states
- finite-state companion behavior with mood and context stabilization
- soft desktop bubble presentation with low-noise delivery rules
- companion-side summaries for chat and file analysis
- modular pet package loading
- file analysis for text, source files, PDF, and DOCX

## Stack

- Electron
- PixiJS
- React
- TypeScript
- Zustand

## Project Layout

```text
src/
  ai/
  components/
  context/
  domain/
  pets/
  rendering/
  services/
  store/

electron/
  services/
  main.ts
  preload.ts

pets/
  mochi/

docs/specs/
media/
```

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run desktop:dev
```

Build the app:

```bash
npm run build
```

Create a packaged distribution:

```bash
npm run dist
```

Run type checking:

```bash
npm run typecheck
```

Regenerate Mochi QA artifacts:

```bash
npm run qa:mochi
```

## Notes For Contributors

- Keep the pet runtime lean. Rendering smoothness is a product feature.
- Prefer calm interaction over frequent interruption.
- Preserve the product direction: cozy, soft, minimal, immersive.
- Treat Mochi as the current canonical built-in companion.

Contribution guidelines: [CONTRIBUTING.md](./CONTRIBUTING.md)

## Specs

Architecture and roadmap notes live in:

- [docs/specs/product-architecture.md](./docs/specs/product-architecture.md)
- [docs/specs/runtime-modules.md](./docs/specs/runtime-modules.md)
- [docs/specs/phase-roadmap.md](./docs/specs/phase-roadmap.md)
- [docs/specs/release-and-packaging.md](./docs/specs/release-and-packaging.md)
- [docs/specs/github-publishing-checklist.md](./docs/specs/github-publishing-checklist.md)
- [docs/specs/media-prep.md](./docs/specs/media-prep.md)

## Current Limitations

- the project is still being hardened for long-running desktop use
- public screenshots, motion captures, and release notes are not prepared yet
- plugin and community package flows are still incomplete

## Media

Planned repository media lives in [media/README.md](./media/README.md).

## License

[MIT](./LICENSE)
