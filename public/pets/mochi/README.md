This folder contains runtime-facing public assets for the built-in Mochi package.

- `sprite-atlas.png`: runtime atlas
- `preview.png`: settings card preview generated from the current runtime atlas

The app should treat `sprite-atlas.png` as the only runtime appearance source for bb7.
`preview.png` is only a small UI thumbnail derived from that atlas, not a separate art direction file.
