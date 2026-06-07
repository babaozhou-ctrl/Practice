import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const modeArg = process.argv.find((arg) => arg.startsWith('--mode=')) ?? '--mode=build'
const mode = modeArg.split('=')[1] ?? 'build'

const isWindows = process.platform === 'win32'
const nodeExecutable = process.execPath
const tscBin = resolve(rootDir, 'node_modules', 'typescript', 'bin', 'tsc')
const viteBin = resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js')
const electronBuilderBin = resolve(rootDir, 'node_modules', 'electron-builder', 'cli.js')

try {
  await runNodeScript(tscBin, ['--noEmit'], 'Type checking failed.')
  await runNodeScript(viteBin, ['build'], 'Vite build failed.')

  if (mode === 'dist' || mode === 'pack') {
    if (!existsSync(electronBuilderBin)) {
      printMissingElectronBuilderMessage()
      process.exitCode = 1
      process.exit()
    }

    const builderArgs = mode === 'pack' ? ['--dir'] : []
    await runNodeScript(electronBuilderBin, builderArgs, 'Electron packaging failed.')
  }
} catch {
  process.exitCode = 1
}

async function runNodeScript(scriptPath, args, errorMessage) {
  if (!existsSync(scriptPath)) {
    console.error(`Required script not found: ${scriptPath}`)
    process.exit(1)
  }

  await runCommand(nodeExecutable, [scriptPath, ...args], errorMessage)
}

function runCommand(command, args, errorMessage) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
      windowsHide: false,
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      console.error(errorMessage)
      rejectPromise(new Error(`${command} exited with code ${code ?? 'unknown'}`))
    })

    child.on('error', (error) => {
      console.error(errorMessage)
      rejectPromise(error)
    })
  })
}

function printMissingElectronBuilderMessage() {
  const installCommand = isWindows
    ? 'npm install --save-dev electron-builder'
    : 'npm install --save-dev electron-builder'

  console.error('')
  console.error('Packaging is configured, but electron-builder is not installed yet.')
  console.error(`Run \`${installCommand}\` in ${rootDir} and then retry \`npm run dist\`.`)
  console.error('')
}
