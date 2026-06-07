# Pet Package System

This directory will contain pet schema definitions and loaders for built-in and imported pets.

Core goals:

- validate pet package manifests
- resolve atlas and animation assets
- load personality and state mappings
- allow new pets without core runtime edits

Current architecture direction:

- built-in pets are discovered through a small registry instead of being hard-coded directly into the runtime
- the selected pet is persisted and broadcast across windows so chat, settings, and the pet window stay in sync
- pet packages own their own animation/state/personality metadata
- pet capabilities are typed and can be fulfilled by provider hooks instead of direct UI-level service construction
- imported pets now have a disk-backed persistence path through Electron IPC so they can evolve toward a real local pet package library
- capability providers are now normalized through a registry/store layer, which allows future plugin backends to register and fall back safely
- legacy aliases may exist temporarily while package identities migrate cleanly

Near-term next steps:

- add imported-package registration instead of temporary in-memory custom sprite overrides
- support package-level capability flags for file analysis, emotes, and proactive behavior styles
- separate sprite fallback generation from package identity so non-Mochi pets can ship their own procedural fallback
- replace built-in capability providers with real plugin/provider resolution for community and local integrations
