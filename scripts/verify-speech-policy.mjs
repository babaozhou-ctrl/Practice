import { readFileSync } from 'fs'
import { strict as assert } from 'assert'
import { join } from 'path'
import ts from 'typescript'

const repoRoot = process.cwd()
const sourcePath = join(repoRoot, 'src/domain/companion/CompanionSpeechPolicy.ts')
const sourceText = readFileSync(sourcePath, 'utf8')

const transpiled = ts.transpileModule(sourceText, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText

const moduleShim = { exports: {} }
const requireShim = () => ({})
const evaluator = new Function('require', 'module', 'exports', transpiled)
evaluator(requireShim, moduleShim, moduleShim.exports)

const { CompanionSpeechPolicy } = moduleShim.exports

const baseSnapshot = {
  mode: 'observing',
  emotion: 'idle',
  activity: 'idle',
  workMode: {
    isFocusActive: false,
  },
}

const normalPolicy = new CompanionSpeechPolicy()
const lowDistractionPolicy = new CompanionSpeechPolicy()

const firstSpeechAt = 10_000
const secondSpeechAt = firstSpeechAt + 4_500

const firstNormal = normalPolicy.evaluate({
  source: 'external',
  intent: { message: 'stay-with-you', duration: 2_000 },
  snapshot: baseSnapshot,
  lowDistractionMode: false,
  now: firstSpeechAt,
})
assert.ok(firstNormal, 'Expected first normal-mode speech to be accepted')

const secondNormal = normalPolicy.evaluate({
  source: 'context',
  intent: { message: 'take-a-short-break', duration: 2_000 },
  snapshot: baseSnapshot,
  lowDistractionMode: false,
  now: secondSpeechAt,
})
assert.ok(secondNormal, 'Expected normal mode to allow a second speech after the standard gap')

const firstQuiet = lowDistractionPolicy.evaluate({
  source: 'external',
  intent: { message: 'stay-with-you', duration: 2_000 },
  snapshot: baseSnapshot,
  lowDistractionMode: true,
  now: firstSpeechAt,
})
assert.ok(firstQuiet, 'Expected first low-distraction speech to be accepted')

const secondQuiet = lowDistractionPolicy.evaluate({
  source: 'context',
  intent: { message: 'take-a-short-break', duration: 2_000 },
  snapshot: baseSnapshot,
  lowDistractionMode: true,
  now: secondSpeechAt,
})
assert.equal(
  secondQuiet,
  null,
  'Expected low-distraction mode to block the second speech during the longer quiet gap',
)

const proactiveGatePolicy = new CompanionSpeechPolicy()

const firstExternal = proactiveGatePolicy.evaluate({
  source: 'external',
  intent: { message: 'keep-you-company', duration: 2_000 },
  snapshot: baseSnapshot,
  lowDistractionMode: false,
  now: 20_000,
})
assert.ok(firstExternal, 'Expected first external speech to be accepted before proactive gating test')

const proactiveTooSoon = proactiveGatePolicy.evaluate({
  source: 'proactive',
  intent: { message: 'take-a-breather', duration: 2_000 },
  snapshot: baseSnapshot,
  lowDistractionMode: false,
  now: 80_000,
})
assert.equal(
  proactiveTooSoon,
  null,
  'Expected proactive speech to stay blocked for a longer gap after any recent speech',
)

const proactiveAfterLongGap = proactiveGatePolicy.evaluate({
  source: 'proactive',
  intent: { message: 'take-a-breather', duration: 2_000 },
  snapshot: baseSnapshot,
  lowDistractionMode: false,
  now: 115_000,
})
assert.ok(
  proactiveAfterLongGap,
  'Expected proactive speech to be allowed again after the longer cross-source quiet gap',
)

console.log('[deep-pet] speech policy verification passed')
