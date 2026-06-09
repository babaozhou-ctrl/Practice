import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const nodeExecutable = process.execPath
const buildScript = resolve(rootDir, 'scripts', 'build-release.mjs')
const electronExecutable = resolve(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe')

await runNodeScript(buildScript, ['--mode=build'], 'Desktop smoke build failed.')
await runElectronSmoke('pet')
await runElectronSmoke('chat')
await runElectronSmoke('settings')
await runElectronSmoke('workmode')
await runElectronSmoke('import')
await runElectronSmoke('feed')

async function runNodeScript(scriptPath, args, errorMessage) {
  await runCommand(nodeExecutable, [scriptPath, ...args], {
    errorMessage,
    env: process.env,
  })
}

async function runElectronSmoke(target) {
  let sawReady = false
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
    },
    onStderr: (text) => {
      process.stderr.write(text)
    },
  })

  if (!sawReady) {
    throw new Error(`Desktop smoke finished without reaching ${target} ready state.`)
  }
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
      if (timeout) {
        clearTimeout(timeout)
      }

      if (timedOut) {
        rejectPromise(new Error(`${errorMessage} Timed out after ${timeoutMs}ms.`))
        return
      }

      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`${errorMessage} Exit code: ${code ?? 'unknown'}`))
    })

    child.on('error', (error) => {
      if (timeout) {
        clearTimeout(timeout)
      }
      rejectPromise(error)
    })
  })
}
