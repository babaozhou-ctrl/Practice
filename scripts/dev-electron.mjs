import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const viteBin = resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js')
const electronExecutable = resolve(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe')
const devServerUrl = 'http://127.0.0.1:5173/'

const vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
  windowsHide: false,
})

let electron = null
let cleanedUp = false

vite.stdout.on('data', (chunk) => {
  const text = chunk.toString()
  process.stdout.write(text)
})

vite.stderr.on('data', (chunk) => {
  const text = chunk.toString()
  process.stderr.write(text)
})

vite.on('exit', (code) => {
  if (cleanedUp) return
  if (code !== 0) {
    console.error(`Vite dev server exited early with code ${code ?? 'unknown'}.`)
    cleanup(code ?? 1)
  }
})

await waitForServer(devServerUrl, 20_000)

electron = spawn(electronExecutable, ['.', '--dev'], {
  cwd: rootDir,
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devServerUrl,
  },
  stdio: 'inherit',
  shell: false,
  windowsHide: false,
})

electron.on('exit', (code) => {
  cleanup(code ?? 0)
})

electron.on('error', (error) => {
  console.error('Failed to launch Electron in dev mode.')
  console.error(error)
  cleanup(1)
})

process.on('SIGINT', () => cleanup(0))
process.on('SIGTERM', () => cleanup(0))

function cleanup(code) {
  if (cleanedUp) return
  cleanedUp = true

  if (electron && !electron.killed) {
    try {
      electron.kill()
    } catch {
      // ignore cleanup failures
    }
  }

  if (!vite.killed) {
    try {
      vite.kill()
    } catch {
      // ignore cleanup failures
    }
  }

  process.exit(code)
}

function waitForServer(url, timeoutMs) {
  const startedAt = Date.now()

  return new Promise((resolvePromise, rejectPromise) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume()
        resolvePromise()
      })

      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          rejectPromise(new Error(`Timed out waiting for dev server at ${url}`))
          return
        }

        setTimeout(attempt, 250)
      })

      req.setTimeout(2_000, () => {
        req.destroy()
      })
    }

    attempt()
  })
}
