import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const nodeExecutable = process.execPath
const buildScript = resolve(rootDir, 'scripts', 'build-release.mjs')
const electronExecutable = resolve(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe')
const smokeOnlyTarget = process.env.DEEP_PET_SMOKE_ONLY?.trim() || null
const smokeTargets = smokeOnlyTarget
  ? [smokeOnlyTarget]
  : ['pet', 'chat', 'settings', 'workmode', 'import', 'feed']

await runNodeScript(buildScript, ['--mode=build'], 'Desktop smoke build failed.')

for (const target of smokeTargets) {
  await runElectronSmoke(target)
}

async function runNodeScript(scriptPath, args, errorMessage) {
  await runCommand(nodeExecutable, [scriptPath, ...args], {
    errorMessage,
    env: process.env,
  })
}

async function runElectronSmoke(target) {
  let sawReady = false
  let unexpectedAmbientExternalSpeechLine = null
  let unexpectedProceduralRenderSourceLine = null
  const readyMarker =
    target === 'chat'
      ? '[deep-pet] smoke-ui-ready'
      : target === 'settings'
        ? '[deep-pet] smoke-settings-ready'
        : target === 'workmode'
          ? '[deep-pet] smoke-workmode-ready'
          : target === 'import'
            ? '[deep-pet] smoke-import-ready'
        : target === 'feed'
          ? '[deep-pet] smoke-feed-ready'
        : '[deep-pet] smoke-ready'

  await runCommand(electronExecutable, ['.'], {
    errorMessage: 'Desktop smoke launch failed.',
    env: {
      ...process.env,
      DEEP_PET_SMOKE: target,
    },
    timeoutMs: 20_000,
    onStdout: (text) => {
      process.stdout.write(text)
      if (text.includes(readyMarker)) {
        sawReady = true
      }
      unexpectedAmbientExternalSpeechLine =
        unexpectedAmbientExternalSpeechLine ?? findUnexpectedAmbientExternalSpeechLine(text)
      unexpectedProceduralRenderSourceLine =
        unexpectedProceduralRenderSourceLine ?? findUnexpectedProceduralRenderSourceLine(text)
    },
    onStderr: (text) => {
      process.stderr.write(text)
      unexpectedAmbientExternalSpeechLine =
        unexpectedAmbientExternalSpeechLine ?? findUnexpectedAmbientExternalSpeechLine(text)
      unexpectedProceduralRenderSourceLine =
        unexpectedProceduralRenderSourceLine ?? findUnexpectedProceduralRenderSourceLine(text)
    },
  })

  if (!sawReady) {
    throw new Error(`Desktop smoke finished without reaching ${target} ready state.`)
  }

  if (unexpectedAmbientExternalSpeechLine) {
    throw new Error(
      `Desktop smoke observed ambient external speech in a quiet scene: ${unexpectedAmbientExternalSpeechLine}`,
    )
  }

  if (unexpectedProceduralRenderSourceLine) {
    throw new Error(
      `Desktop smoke observed built-in bb7 falling back to procedural rendering: ${unexpectedProceduralRenderSourceLine}`,
    )
  }
}

function findUnexpectedAmbientExternalSpeechLine(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    lines.find(
      (line) =>
        line.includes('[deep-pet] event name:speech.shown') &&
        line.includes('"source":"external"') &&
        line.includes('"externalTier":"ambient"') &&
        (line.includes('"scene":"away"') || line.includes('"scene":"quiet_idle"')),
    ) ?? null
  )
}

function findUnexpectedProceduralRenderSourceLine(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    lines.find(
      (line) =>
        line.includes('[deep-pet] event name:runtime.texture-source') &&
        (line.includes('"petId":"mascot.bb7"') || line.includes('"petId":"imported.bb7-smoke-import"')) &&
        line.includes('"source":"procedural"'),
    ) ?? null
  )
}

function runCommand(command, args, options) {
  const {
    env,
    errorMessage,
    timeoutMs,
    onStdout,
    onStderr,
  } = options

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    })

    let timedOut = false
    let timeout = null
    let exitCode = null
    let settled = false

    if (typeof timeoutMs === 'number') {
      timeout = setTimeout(() => {
        timedOut = true
        child.kill()
      }, timeoutMs)
    }

    child.stdout.on('data', (chunk) => {
      onStdout?.(chunk.toString())
    })

    child.stderr.on('data', (chunk) => {
      onStderr?.(chunk.toString())
    })

    child.on('exit', (code) => {
      exitCode = code
    })

    child.on('error', (error) => {
      if (timeout) {
        clearTimeout(timeout)
      }
      settled = true
      rejectPromise(error)
    })

    child.on('close', (code) => {
      if (settled) {
        return
      }

      settled = true

      if (timeout) {
        clearTimeout(timeout)
      }

      const resolvedCode = exitCode ?? code
      if (timedOut) {
        rejectPromise(new Error(`${errorMessage} Timed out after ${timeoutMs}ms.`))
        return
      }

      if (resolvedCode === 0) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`${errorMessage} Exit code: ${resolvedCode ?? 'unknown'}`))
    })
  })
}
