import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

const mainSource = readFileSync(resolve(rootDir, 'electron/main.ts'), 'utf8')
const loaderSource = readFileSync(resolve(rootDir, 'src/components/pet/CustomPetLoader.tsx'), 'utf8')
const storageSource = readFileSync(resolve(rootDir, 'electron/imported-pet-storage.ts'), 'utf8')
const smokeSource = readFileSync(resolve(rootDir, 'scripts/smoke-desktop.mjs'), 'utf8')

const mainChecks = [
  "const SMOKE_TARGET = process.env.DEEP_PET_SMOKE ?? ''",
  "const smokeUserDataPath = join(",
  "app.getPath('temp')",
  "'deep-pet-smoke'",
  "app.setPath('userData', smokeUserDataPath)",
]

const loaderChecks = [
  "if (cancelled || flags?.smokeTarget !== 'import') {",
  "getSmokeImportSample?.()",
  'buildImportedPetPayloadFromPackageFiles(',
  "window.electronAPI?.emitSmokeCheckpoint?.('import-ready')",
]

const storageChecks = [
  "function getImportedPetsDir(): string {",
  "return join(app.getPath('userData'), 'pets', 'imported')",
  'const importedPetsDir = getImportedPetsDir()',
]

const smokeChecks = [
  "const smokeOnlyTarget = process.env.DEEP_PET_SMOKE_ONLY?.trim() || null",
  "const smokeTargets = smokeOnlyTarget",
  "DEEP_PET_SMOKE: target",
  "'[deep-pet] smoke-import-ready'",
  '"petId":"imported.bb7-smoke-import"',
]

for (const snippet of mainChecks) {
  assertIncludes(mainSource, snippet, 'main')
}

for (const snippet of loaderChecks) {
  assertIncludes(loaderSource, snippet, 'loader')
}

for (const snippet of storageChecks) {
  assertIncludes(storageSource, snippet, 'storage')
}

for (const snippet of smokeChecks) {
  assertIncludes(smokeSource, snippet, 'smoke')
}

const realUserDataDir = join(process.env.APPDATA || '', 'deep-pet')
const realImportedPetDir = join(realUserDataDir, 'pets', 'imported', 'imported.bb7-smoke-import')
const beforeRealImportedPetPresence = existsSync(realImportedPetDir)

const smokeOutput = runImportSmoke()

const importSmokeDir = resolveLatestImportSmokeDir()
if (!importSmokeDir) {
  fail('could not resolve latest import smoke temp directory after smoke run')
}

assertSmokeImportArtifacts(importSmokeDir, smokeOutput)

const afterRealImportedPetPresence = existsSync(realImportedPetDir)
if (!beforeRealImportedPetPresence && afterRealImportedPetPresence) {
  fail(`smoke import polluted real userData: ${realImportedPetDir}`)
}

console.log('[deep-pet] smoke import isolation verified')

function runImportSmoke() {
  const nodeExecutable = process.execPath
  const smokeScript = resolve(rootDir, 'scripts', 'smoke-desktop.mjs')
  const result = spawnSync(nodeExecutable, [smokeScript], {
    cwd: rootDir,
    env: {
      ...process.env,
      DEEP_PET_SMOKE_ONLY: 'import',
    },
    encoding: 'utf8',
    windowsHide: true,
  })

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }

  if (result.stderr) {
    process.stderr.write(result.stderr)
  }

  if (result.status !== 0) {
    fail(`import smoke exited with ${result.status ?? 'unknown'}`)
  }

  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`
}

function resolveLatestImportSmokeDir() {
  const baseDir = join(process.env.TEMP || process.env.TMP || '', 'deep-pet-smoke', 'import')
  if (!baseDir || !existsSync(baseDir)) {
    return null
  }

  const candidates = readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('smoke-'))
    .map((entry) => ({
      path: join(baseDir, entry.name),
      name: entry.name,
    }))
    .sort((left, right) => right.name.localeCompare(left.name))

  return candidates[0]?.path ?? null
}

function assertSmokeImportArtifacts(importSmokeDir, smokeOutput) {
  const importedPetsDir = join(importSmokeDir, 'pets', 'imported', 'imported.bb7-smoke-import')
  const manifestPath = join(importedPetsDir, 'manifest.json')
  const animationsPath = join(importedPetsDir, 'animations.json')
  const statesPath = join(importedPetsDir, 'states.json')
  const personalityPath = join(importedPetsDir, 'personality.json')
  const companionContentPath = join(importedPetsDir, 'companion-content.json')
  const appearancePath = join(importedPetsDir, 'appearance.json')
  const productionPath = join(importedPetsDir, 'production.json')
  const assetStatusPath = join(importedPetsDir, 'asset-status.json')
  const spriteDefinitionPath = join(importedPetsDir, 'sprite-definition.json')
  const atlasPath = join(importedPetsDir, 'sprite-atlas.png')
  const previewPath = join(importedPetsDir, 'preview.png')
  const metadataPath = join(importedPetsDir, 'metadata.json')
  const sessionDataDir = join(importSmokeDir, 'session-data')

  if (!existsSync(importedPetsDir)) {
    fail(`expected imported pet directory in temporary userData: ${importedPetsDir}`)
  }

  const requiredPaths = [
    manifestPath,
    animationsPath,
    statesPath,
    personalityPath,
    companionContentPath,
    appearancePath,
    productionPath,
    assetStatusPath,
    spriteDefinitionPath,
    atlasPath,
    previewPath,
    metadataPath,
  ]

  const missingPaths = requiredPaths.filter((targetPath) => !existsSync(targetPath))
  if (missingPaths.length > 0) {
    fail(`expected full imported pet package inside temporary userData, missing: ${missingPaths.join(', ')}`)
  }

  if (!existsSync(sessionDataDir)) {
    fail('expected isolated session-data directory for smoke runtime')
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.id !== 'imported.bb7-smoke-import' || manifest.name !== 'bb7-smoke-import') {
    fail('temporary imported pet manifest did not match smoke payload')
  }

  const production = JSON.parse(readFileSync(productionPath, 'utf8'))
  if (production?.atlas?.file !== 'sprite-atlas.png') {
    fail('temporary imported pet production profile did not preserve atlas binding')
  }

  if (
    !smokeOutput.includes('"petId":"imported.bb7-smoke-import"') ||
    !smokeOutput.includes('"source":"atlas"')
  ) {
    fail('smoke runtime did not report switching to imported.bb7-smoke-import with atlas rendering')
  }
}

function assertIncludes(source, snippet, label) {
  if (!source.includes(snippet)) {
    fail(`missing ${label} snippet ${snippet}`)
  }
}

function fail(message) {
  console.error(`[deep-pet] smoke import isolation verification failed: ${message}`)
  process.exit(1)
}
