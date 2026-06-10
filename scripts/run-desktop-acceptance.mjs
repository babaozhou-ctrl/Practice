import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const nodeExecutable = process.execPath

const profileArg = process.argv.find((arg) => arg.startsWith('--profile='))
const profile = profileArg?.split('=')[1] ?? 'acceptance'

const profiles = {
  acceptance: [
    {
      label: 'Typecheck',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'node_modules', 'typescript', 'bin', 'tsc'),
      args: ['--noEmit'],
      cleanupBefore: false,
    },
    {
      label: 'Copy integrity',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'check-copy-integrity.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Context media polling',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-context-polling-media.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Activity classifier',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-activity-classifier.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Speech policy',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-speech-policy.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'External speech comfort',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-external-speech-comfort.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Context reaction comfort',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-context-reaction-comfort.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Built-in render source',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-builtin-render-source.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Motion comfort',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-motion-comfort.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Window context sync',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-window-context-sync.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Listening presentation',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-listening-presentation.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Pet interaction guards',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-pet-interaction-guards.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'UI flow guards',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-ui-flow-guards.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Desktop smoke',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'smoke-desktop.mjs'),
      args: [],
      cleanupBefore: true,
    },
    {
      label: 'Stability chat',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'stability-runtime.mjs'),
      args: ['--skip-build', '--scenario=stability-chat', '--duration-ms=30000'],
      cleanupBefore: true,
    },
    {
      label: 'Stability settings',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'stability-runtime.mjs'),
      args: ['--skip-build', '--scenario=stability-settings', '--duration-ms=30000'],
      cleanupBefore: true,
    },
    {
      label: 'Stability feed',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'stability-runtime.mjs'),
      args: ['--skip-build', '--scenario=stability-feed', '--duration-ms=45000'],
      cleanupBefore: true,
    },
    {
      label: 'Stability import',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'stability-runtime.mjs'),
      args: ['--skip-build', '--scenario=stability-import', '--duration-ms=30000'],
      cleanupBefore: true,
    },
  ],
  soak: [
    {
      label: 'Typecheck',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'node_modules', 'typescript', 'bin', 'tsc'),
      args: ['--noEmit'],
      cleanupBefore: false,
    },
    {
      label: 'Copy integrity',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'check-copy-integrity.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Context media polling',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-context-polling-media.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Activity classifier',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-activity-classifier.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Speech policy',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-speech-policy.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'External speech comfort',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-external-speech-comfort.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Context reaction comfort',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-context-reaction-comfort.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Built-in render source',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-builtin-render-source.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Motion comfort',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-motion-comfort.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Window context sync',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-window-context-sync.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Listening presentation',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-listening-presentation.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Pet interaction guards',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-pet-interaction-guards.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'UI flow guards',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'verify-ui-flow-guards.mjs'),
      args: [],
      cleanupBefore: false,
    },
    {
      label: 'Desktop smoke',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'smoke-desktop.mjs'),
      args: [],
      cleanupBefore: true,
    },
    {
      label: 'Stability chat soak',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'stability-runtime.mjs'),
      args: ['--skip-build', '--scenario=stability-chat', '--duration-ms=120000'],
      cleanupBefore: true,
    },
    {
      label: 'Stability settings soak',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'stability-runtime.mjs'),
      args: ['--skip-build', '--scenario=stability-settings', '--duration-ms=90000'],
      cleanupBefore: true,
    },
    {
      label: 'Stability feed soak',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'stability-runtime.mjs'),
      args: ['--skip-build', '--scenario=stability-feed', '--duration-ms=120000'],
      cleanupBefore: true,
    },
    {
      label: 'Stability import soak',
      kind: 'node-script',
      scriptPath: resolve(rootDir, 'scripts', 'stability-runtime.mjs'),
      args: ['--skip-build', '--scenario=stability-import', '--duration-ms=90000'],
      cleanupBefore: true,
    },
  ],
}

const selectedProfile = profiles[profile]

if (!selectedProfile) {
  console.error(`[deep-pet] Unknown acceptance profile: ${profile}`)
  console.error(`[deep-pet] Available profiles: ${Object.keys(profiles).join(', ')}`)
  process.exit(1)
}

const startedAt = Date.now()
const completedLabels = []

try {
  console.log(`[deep-pet] desktop-acceptance profile=${profile}`)

  for (const step of selectedProfile) {
    if (step.cleanupBefore) {
      await cleanupDeepPetElectronProcesses()
    }

    const stepStartedAt = Date.now()
    console.log(`\n[deep-pet] acceptance-step:start label="${step.label}"`)

    if (step.kind === 'node-script') {
      await runNodeScript(step.scriptPath, step.args)
    }

    const elapsedMs = Date.now() - stepStartedAt
    completedLabels.push(step.label)
    console.log(`[deep-pet] acceptance-step:done label="${step.label}" elapsedMs=${elapsedMs}`)
  }

  await cleanupDeepPetElectronProcesses()

  const elapsedMs = Date.now() - startedAt
  console.log('\n[deep-pet] acceptance-summary')
  console.log(`profile=${profile}`)
  console.log(`stepsCompleted=${completedLabels.length}`)
  console.log(`labels=${JSON.stringify(completedLabels)}`)
  console.log(`elapsedMs=${elapsedMs}`)
} catch (error) {
  await cleanupDeepPetElectronProcesses().catch(() => {})
  console.error('\n[deep-pet] acceptance-failed')
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

async function runNodeScript(scriptPath, args) {
  await runCommand(nodeExecutable, [scriptPath, ...args], {
    env: process.env,
  })
}

async function cleanupDeepPetElectronProcesses() {
  if (process.platform === 'win32') {
    const escapedRoot = escapeForSingleQuotedPowerShell(rootDir)
    const escapedElectronPath = escapeForSingleQuotedPowerShell(
      resolve(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe'),
    )
    const escapedPackagedPath = escapeForSingleQuotedPowerShell(
      resolve(rootDir, 'release', 'win-unpacked', 'Deep Pet.exe'),
    )
    const command = [
      `$root = '${escapedRoot}'`,
      `$electronPath = '${escapedElectronPath}'`,
      `$packagedPath = '${escapedPackagedPath}'`,
      '$electronTargets = Get-CimInstance Win32_Process -Filter "Name = \'electron.exe\'" | Where-Object { ($_.ExecutablePath -and $_.ExecutablePath -eq $electronPath) -or ($_.CommandLine -and $_.CommandLine -like ("*" + $root + "*")) }',
      '$packagedTargets = Get-CimInstance Win32_Process -Filter "Name = \'Deep Pet.exe\'" | Where-Object { ($_.ExecutablePath -and $_.ExecutablePath -eq $packagedPath) -or ($_.CommandLine -and $_.CommandLine -like ("*" + $root + "*")) }',
      '$targets = @($electronTargets) + @($packagedTargets) | Where-Object { $_ } | Sort-Object ProcessId -Unique',
      'if ($targets) {',
      '  $targets | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
      '}',
    ].join('; ')

    await runCommand('powershell.exe', ['-NoProfile', '-Command', command], {
      env: process.env,
      allowNonZeroExit: true,
    })
    return
  }

  await runCommand('pkill', ['-f', `${rootDir}.*electron`], {
    env: process.env,
    allowNonZeroExit: true,
  })
}

function runCommand(command, args, options) {
  const {
    env,
    allowNonZeroExit = false,
  } = options

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    })

    child.on('exit', (code) => {
      if (code === 0 || allowNonZeroExit) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`${command} exited with code ${code ?? 'unknown'}`))
    })

    child.on('error', (error) => {
      if (allowNonZeroExit) {
        resolvePromise()
        return
      }
      rejectPromise(error)
    })
  })
}

function escapeForSingleQuotedPowerShell(value) {
  return value.replace(/'/g, "''")
}
