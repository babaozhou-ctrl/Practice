# Deep Pet Release And Packaging

## Current Delivery Paths

- `start.bat`
  Launches the already built desktop companion from `dist/` and `dist-electron/`.

- `start-dev.bat`
  Launches Electron in development mode. For the best experience, use `npm run desktop:dev` so Vite and Electron are started together.

- `scripts/build-release.bat`
  Double-click friendly build entry point.

## NPM Scripts

- `npm run build`
  Type-checks and creates production renderer plus Electron bundles.

- `npm run desktop:dev`
  Starts the Vite dev server and then opens Electron with `VITE_DEV_SERVER_URL`.

- `npm run pack`
  Builds the app and creates an unpacked directory for smoke testing.

- `npm run dist`
  Builds the app and creates a Windows NSIS installer in `release/`.

## Required Dependencies

- Node.js 18 or newer
- Project dependencies installed with `npm install`
- `electron-builder` installed as a dev dependency

If packaging fails with a missing `electron-builder` message, run:

```bash
npm install --save-dev electron-builder
```

## Packaging Outputs

- `dist/`
  Production renderer assets.

- `dist-electron/`
  Bundled Electron main and preload entry files.

- `release/`
  Installer or unpacked release artifacts created by `electron-builder`.

## Notes

- The app icon is sourced from `build/icon.ico` and `build/icon.png`.
- Auto-publish is intentionally not configured yet. Add a real release provider only when distribution hosting is decided.
