import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawn } from 'child_process'

const PYTHON_EXE = 'C:\\Users\\22734\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe'
const SCRIPT_PATH = join(process.cwd(), 'scripts', 'extract_document_text.py')

interface ExtractDocumentTextPayload {
  fileName: string
  mimeType?: string
  buffer: ArrayBuffer | Uint8Array
}

interface DocumentExtractionResult {
  ok: boolean
  content?: string
  characterCount?: number
  error?: string
}

export async function extractDocumentText(payload: ExtractDocumentTextPayload): Promise<string> {
  const suffix = resolveExtension(payload.fileName, payload.mimeType)
  if (!suffix) {
    throw new Error(`Unsupported document type: ${payload.fileName}`)
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'deep-pet-doc-'))
  const tempFile = join(tempDir, `source${suffix}`)

  try {
    await writeFile(tempFile, normalizeBuffer(payload.buffer))
    const result = await runExtractor(tempFile)
    if (!result.ok) {
      throw new Error(result.error || 'Document extraction failed.')
    }

    return (result.content || '').trim()
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function normalizeBuffer(value: ArrayBuffer | Uint8Array): Buffer {
  if (value instanceof Uint8Array) {
    return Buffer.from(value)
  }
  return Buffer.from(new Uint8Array(value))
}

function resolveExtension(fileName: string, mimeType?: string): '.pdf' | '.docx' | null {
  const lowerName = fileName.toLowerCase()
  if (lowerName.endsWith('.pdf') || mimeType === 'application/pdf') {
    return '.pdf'
  }
  if (
    lowerName.endsWith('.docx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return '.docx'
  }
  return null
}

function runExtractor(filePath: string): Promise<DocumentExtractionResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_EXE, [SCRIPT_PATH, filePath], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8')
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8')
    })

    child.on('error', reject)
    child.on('close', (code) => {
      const trimmed = stdout.trim()
      if (!trimmed) {
        reject(new Error(stderr.trim() || `Document extractor exited with code ${code ?? 'unknown'}.`))
        return
      }

      try {
        const parsed = JSON.parse(trimmed) as DocumentExtractionResult
        resolve(parsed)
      } catch (error) {
        reject(
          new Error(
            `Failed to parse document extractor output: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        )
      }
    })
  })
}
