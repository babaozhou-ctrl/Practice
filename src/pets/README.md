# Pet Package System

This directory will contain pet schema definitions and loaders for built-in and imported pets.

Core goals:

- validate pet package manifests
- resolve atlas and animation assets
- load personality and state mappings
- load companion-content and proactive interaction presets
- allow new pets without core runtime edits

Current architecture direction:

- built-in pets are discovered through a small registry instead of being hard-coded directly into the runtime
- the selected pet is persisted and broadcast across windows so chat, settings, and the pet window stay in sync
- pet packages own their own animation/state/personality metadata
- pet packages can also own companion-content, prompt directives, and contextual behavior presets
- pet capabilities are typed and can be fulfilled by provider hooks instead of direct UI-level service construction
- imported pets now have a disk-backed persistence path through Electron IPC so they can evolve toward a real local pet package library
- capability providers are now normalized through a registry/store layer, which allows future plugin backends to register and fall back safely
- legacy aliases may exist temporarily while package identities migrate cleanly

Near-term next steps:

- support package-level capability flags for file analysis, emotes, and proactive behavior styles
- separate sprite fallback generation from package identity so non-Mochi pets can ship their own procedural fallback
- replace built-in capability providers with real plugin/provider resolution for community and local integrations

Custom package notes:

- Recommended package files:
  - `manifest.json`
  - `animations.json`
  - `states.json`
  - `personality.json`
  - `companion-content.json`
  - `appearance.json` (optional)
  - `production.json` (optional)
- `personality.json` should define:
  - `identity.role`
  - `identity.presence`
  - `identity.responseStyle`
  - `tone`
  - `speechRules`
  - `contextBehaviors`
  - `promptDirectives.core`
  - `promptDirectives.avoid`
  - `promptDirectives.do`
  - `memoryPolicy`
- `companion-content.json` should carry the pet's proactive action copy, so follow-up chips and ambient check-ins stay on-brand for that pet.
- Imported pets now persist both `personality` and `companionContent`, which means custom pets can keep their own tone and interactive prompts after restart.
- Runtime import now supports two lanes:
  - full package import: drag in a package folder's files including `manifest.json`, optional atlas, and companion metadata
  - legacy sprite import: drag in one older config JSON plus one PNG sprite sheet, then let the app generate fallback personality/content defaults
- Full package import keeps atlas assets on disk and serves them through a local Electron protocol, so imported pets can actually render their own runtime atlas instead of falling back to Mochi-only public assets.
- When an imported package does not ship `previewImage`, the renderer now generates a local preview thumbnail from the atlas or procedural sprite fallback so package cards still feel complete in settings.
- For a concrete starting point, see:
  - `pets/template-luna/`
  - `docs/specs/pet-package-template.md`
- The settings UI now treats pet packages as first-class product entries, showing source, stage, summary, tags, and capability labels instead of a bare name-only dropdown.
