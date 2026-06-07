import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const python = 'C:\\Users\\22734\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe'
const script = path.join(root, 'scripts', 'make_mochi_qa_pack.py')

const result = spawnSync(python, [script], {
  cwd: root,
  stdio: 'inherit',
})

if (typeof result.status === 'number') {
  process.exit(result.status)
}

process.exit(1)
