# Deep Pet Plugins

This directory is reserved for product-grade extensions, not ad-hoc scripts.

Each plugin should provide:

- `manifest.json`
- runtime entry file
- declared capabilities
- declared permissions

Plugins should be loaded through the core plugin runtime rather than imported directly into app code.
