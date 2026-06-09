import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

const targetFiles = [
  'src/pet-main.ts',
  'src/ai/CompanionDesktopSummary.ts',
  'src/components/chat/ChatPanel.tsx',
  'src/services/companionFeedAnalysis.ts',
]

const suspiciousPatterns = [
  { label: 'replacement-char', regex: /\uFFFD/ },
  { label: 'utf8-mojibake-latin', regex: /(?:Ã.|Â.)/ },
  { label: 'legacy-cjk-mojibake', regex: /[閹鎴銆锛鍚鍟鏉闄缁璁涔鍦鐪浣]{2,}/ },
]

const results = []

for (const relativePath of targetFiles) {
  const absolutePath = resolve(rootDir, relativePath)
  const lines = readFileSync(absolutePath, 'utf8').split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1
    const line = lines[index]
    if (!line.trim()) continue
    if (isAllowedLegacySanitizerLine(relativePath, lineNumber, line)) continue

    for (const pattern of suspiciousPatterns) {
      if (pattern.regex.test(line)) {
        results.push({
          file: relativePath,
          lineNumber,
          label: pattern.label,
          line: line.trim(),
        })
      }
    }
  }
}

if (results.length > 0) {
  console.error('[deep-pet] copy-integrity failed')
  for (const result of results) {
    console.error(
      `${result.file}:${result.lineNumber} [${result.label}] ${result.line}`,
    )
  }
  process.exit(1)
}

console.log('[deep-pet] copy-integrity passed')

function isAllowedLegacySanitizerLine(relativePath, lineNumber, line) {
  if (relativePath !== 'src/pet-main.ts') {
    return false
  }

  // Keep compatibility with previously persisted mojibake text by allowing
  // only the dedicated cleanup tables in pet-main.
  const allowedRanges = [
    [169, 178],
    [180, 209],
  ]

  const inAllowedRange = allowedRanges.some(
    ([start, end]) => lineNumber >= start && lineNumber <= end,
  )

  if (!inAllowedRange) {
    return false
  }

  return line.includes('.replace(')
}
