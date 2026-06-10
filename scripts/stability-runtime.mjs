import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const nodeExecutable = process.execPath
const buildScript = resolve(rootDir, 'scripts', 'build-release.mjs')
const electronExecutable = resolve(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe')

const scenarioArg = process.argv.find((arg) => arg.startsWith('--scenario='))
const durationArg = process.argv.find((arg) => arg.startsWith('--duration-ms='))
const skipBuild = process.argv.includes('--skip-build')
const scenario = scenarioArg?.split('=')[1] ?? 'stability-chat'
const durationMs = Number.parseInt(durationArg?.split('=')[1] ?? '15000', 10)
const minimumObservedDurationMs = Math.max(2_500, Math.floor(durationMs * 0.7))

if (!Number.isFinite(durationMs) || durationMs <= 0) {
  throw new Error('Expected a positive --duration-ms value.')
}

if (!skipBuild) {
  await runNodeScript(buildScript, ['--mode=build'], 'Stability runtime build failed.')
}

const summary = await runRuntimeScenario(scenario, durationMs)
if (summary.observedDurationMs < minimumObservedDurationMs) {
  throw new Error(
    `Stability runtime ended too early. observed=${summary.observedDurationMs}ms expected-at-least=${minimumObservedDurationMs}ms`,
  )
}
if (summary.unexpectedAmbientExternalSpeechCount > 0) {
  throw new Error(
    `Stability runtime observed ${summary.unexpectedAmbientExternalSpeechCount} ambient external speech event(s) in quiet scenes.`,
  )
}
if (summary.unexpectedProceduralRenderSourceCount > 0) {
  throw new Error(
    `Stability runtime observed ${summary.unexpectedProceduralRenderSourceCount} built-in procedural render fallback event(s).`,
  )
}
printSummary(summary)

async function runNodeScript(scriptPath, args, errorMessage) {
  await runCommand(nodeExecutable, [scriptPath, ...args], {
    errorMessage,
    env: process.env,
  })
}

async function runRuntimeScenario(scenarioName, autoExitMs) {
  const monitor = createRunMonitor(scenarioName, autoExitMs)

  await runCommand(electronExecutable, ['.'], {
    errorMessage: 'Stability runtime launch failed.',
    env: {
      ...process.env,
      DEEP_PET_SCENARIO: scenarioName,
      DEEP_PET_AUTO_EXIT_MS: String(autoExitMs),
    },
    timeoutMs: autoExitMs + 20_000,
    onStdout: (text) => {
      process.stdout.write(text)
      monitor.observe(text, 'stdout')
    },
    onStderr: (text) => {
      process.stderr.write(text)
      monitor.observe(text, 'stderr')
    },
  })

  return monitor.getSummary()
}

function createRunMonitor(scenarioName, autoExitMs) {
  const startedAt = Date.now()
  const memorySamples = []
  const processCountSamples = []
  const eventCounts = new Map()
  let gpuDiskCacheWarnings = 0
  let gpuStateInvalidWarnings = 0
  let uncaughtErrors = 0
  let renderGoneEvents = 0
  let unresponsiveEvents = 0
  const unexpectedAmbientExternalSpeechLines = []
  const unexpectedProceduralRenderSourceLines = []

  return {
    observe(text, stream) {
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      for (const line of lines) {
        if (line.includes('gpu_disk_cache.cc(216)')) {
          gpuDiskCacheWarnings += 1
        }

        if (line.includes('GPU state invalid after WaitForGetOffsetInRange')) {
          gpuStateInvalidWarnings += 1
        }

        if (line.includes('Uncaught exception:') || line.includes('Unhandled rejection:')) {
          uncaughtErrors += 1
        }

        if (line.includes('render gone:')) {
          renderGoneEvents += 1
        }

        if (line.includes('became unresponsive')) {
          unresponsiveEvents += 1
        }

        const metricsMatch =
          stream === 'stdout' || stream === 'stderr'
            ? line.match(/\[deep-pet\]\s+metrics\s+process-count:(\d+)\s+memory-mb:(\d+(?:\.\d+)?)/i)
            : null
        if (metricsMatch) {
          processCountSamples.push(Number.parseInt(metricsMatch[1], 10))
          memorySamples.push(Number.parseFloat(metricsMatch[2]))
        }

        const eventMatch =
          stream === 'stdout' || stream === 'stderr'
            ? line.match(/\[deep-pet\]\s+event\s+name:([a-z0-9._-]+)(?:\s+value:([^\s]+))?(?:\s+tags:(.+))?/i)
            : null
        if (eventMatch) {
          const eventName = eventMatch[1]
          eventCounts.set(eventName, (eventCounts.get(eventName) ?? 0) + 1)
        }

        if (isUnexpectedAmbientExternalSpeechLine(line)) {
          unexpectedAmbientExternalSpeechLines.push(line)
        }

        if (isUnexpectedProceduralRenderSourceLine(line)) {
          unexpectedProceduralRenderSourceLines.push(line)
        }
      }
    },
    getSummary() {
      const durationObservedMs = Date.now() - startedAt
      const durationMinutes = durationObservedMs / 60_000
      const maxProcessCount = processCountSamples.length > 0 ? Math.max(...processCountSamples) : null
      const maxMemoryMb = memorySamples.length > 0 ? Math.max(...memorySamples) : null
      const minMemoryMb = memorySamples.length > 0 ? Math.min(...memorySamples) : null
      const avgMemoryMb =
        memorySamples.length > 0
          ? memorySamples.reduce((sum, value) => sum + value, 0) / memorySamples.length
          : null
      const eventCountsObject = Object.fromEntries(
        [...eventCounts.entries()].sort((left, right) => left[0].localeCompare(right[0])),
      )
      const perMinute = (eventName) => {
        const count = eventCounts.get(eventName) ?? 0
        return durationMinutes > 0 ? count / durationMinutes : 0
      }

      return {
        scenario: scenarioName,
        requestedDurationMs: autoExitMs,
        observedDurationMs: durationObservedMs,
        observedDurationMinutes: durationMinutes,
        maxProcessCount,
        memorySampleCount: memorySamples.length,
        minMemoryMb,
        maxMemoryMb,
        avgMemoryMb,
        gpuDiskCacheWarnings,
        gpuStateInvalidWarnings,
        uncaughtErrors,
        renderGoneEvents,
        unresponsiveEvents,
        unexpectedAmbientExternalSpeechCount: unexpectedAmbientExternalSpeechLines.length,
        unexpectedProceduralRenderSourceCount: unexpectedProceduralRenderSourceLines.length,
        eventCounts: eventCountsObject,
        speechShownPerMinute: perMinute('speech.shown'),
        proactivePromptPerMinute: perMinute('proactive.prompt'),
        contextTransitionPerMinute: perMinute('context.transition'),
        feedCompletedPerMinute: perMinute('feed.analysis.completed'),
        feedReceivedPerMinute: perMinute('chat.feed.received'),
      }
    },
  }
}

function printSummary(summary) {
  console.log('')
  console.log('[deep-pet] stability-summary')
  console.log(`scenario=${summary.scenario}`)
  console.log(`requestedDurationMs=${summary.requestedDurationMs}`)
  console.log(`observedDurationMs=${summary.observedDurationMs}`)
  console.log(`observedDurationMinutes=${formatMetric(summary.observedDurationMinutes)}`)
  console.log(`maxProcessCount=${formatIntegerMetric(summary.maxProcessCount)}`)
  console.log(`memorySampleCount=${summary.memorySampleCount}`)
  console.log(`minMemoryMb=${formatMetric(summary.minMemoryMb)}`)
  console.log(`maxMemoryMb=${formatMetric(summary.maxMemoryMb)}`)
  console.log(`avgMemoryMb=${formatMetric(summary.avgMemoryMb)}`)
  console.log(`gpuDiskCacheWarnings=${summary.gpuDiskCacheWarnings}`)
  console.log(`gpuStateInvalidWarnings=${summary.gpuStateInvalidWarnings}`)
  console.log(`uncaughtErrors=${summary.uncaughtErrors}`)
  console.log(`renderGoneEvents=${summary.renderGoneEvents}`)
  console.log(`unresponsiveEvents=${summary.unresponsiveEvents}`)
  console.log(`unexpectedAmbientExternalSpeechCount=${summary.unexpectedAmbientExternalSpeechCount}`)
  console.log(`unexpectedProceduralRenderSourceCount=${summary.unexpectedProceduralRenderSourceCount}`)
  console.log(`speechShownPerMinute=${formatMetric(summary.speechShownPerMinute)}`)
  console.log(`proactivePromptPerMinute=${formatMetric(summary.proactivePromptPerMinute)}`)
  console.log(`contextTransitionPerMinute=${formatMetric(summary.contextTransitionPerMinute)}`)
  console.log(`feedCompletedPerMinute=${formatMetric(summary.feedCompletedPerMinute)}`)
  console.log(`feedReceivedPerMinute=${formatMetric(summary.feedReceivedPerMinute)}`)
  console.log(`eventCounts=${JSON.stringify(summary.eventCounts)}`)
}

function formatMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'n/a'
}

function formatIntegerMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : 'n/a'
}

function isUnexpectedAmbientExternalSpeechLine(line) {
  return (
    line.includes('[deep-pet] event name:speech.shown') &&
    line.includes('"source":"external"') &&
    line.includes('"externalTier":"ambient"') &&
    (line.includes('"scene":"away"') || line.includes('"scene":"quiet_idle"'))
  )
}

function isUnexpectedProceduralRenderSourceLine(line) {
  return (
    line.includes('[deep-pet] event name:runtime.texture-source') &&
    line.includes('"petId":"mascot.bb7"') &&
    line.includes('"source":"procedural"')
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
