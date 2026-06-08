import { inflateRawSync } from 'zlib'
import yauzl from 'yauzl'

interface ExtractDocumentTextPayload {
  fileName: string
  mimeType?: string
  buffer: ArrayBuffer | Uint8Array
}

export async function extractDocumentText(payload: ExtractDocumentTextPayload): Promise<string> {
  const suffix = resolveExtension(payload.fileName, payload.mimeType)
  if (!suffix) {
    throw new Error(`Unsupported document type: ${payload.fileName}`)
  }

  const bytes = normalizeBuffer(payload.buffer)

  if (suffix === '.docx') {
    return extractDocxText(bytes)
  }

  if (suffix === '.pdf') {
    return extractPdfText(bytes)
  }

  throw new Error(`Unsupported document type: ${payload.fileName}`)
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

async function extractDocxText(buffer: Buffer): Promise<string> {
  const entries = await unzipEntries(buffer)
  const documentXml = entries.get('word/document.xml')
  if (!documentXml) {
    throw new Error('没有在 DOCX 里找到正文内容。')
  }

  const text = extractWordprocessingXmlText(documentXml)
  if (!text.trim()) {
    throw new Error('这个 DOCX 里暂时没有提取到可读文字。')
  }

  return text
}

function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1')
  const matches = Array.from(raw.matchAll(/\((?:\\.|[^\\()])*\)/g))
  const decoded = matches
    .map((match) => decodePdfLiteralString(match[0]))
    .map((chunk) => chunk.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const merged = dedupeAdjacent(decoded).join('\n')
  const normalized = merged
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!normalized) {
    throw new Error('这个 PDF 里暂时没有提取到可读文字。')
  }

  return normalized
}

function decodePdfLiteralString(input: string): string {
  let body = input.slice(1, -1)
  body = body.replace(/\\([nrtbf()\\])/g, (_whole, token: string) => {
    switch (token) {
      case 'n':
        return '\n'
      case 'r':
        return '\r'
      case 't':
        return '\t'
      case 'b':
        return '\b'
      case 'f':
        return '\f'
      default:
        return token
    }
  })

  body = body.replace(/\\([0-7]{1,3})/g, (_whole, octal: string) =>
    String.fromCharCode(parseInt(octal, 8)),
  )

  return body
}

function dedupeAdjacent(items: string[]): string[] {
  const result: string[] = []
  for (const item of items) {
    if (result[result.length - 1] !== item) {
      result.push(item)
    }
  }
  return result
}

function extractWordprocessingXmlText(xml: Buffer): string {
  const source = xml.toString('utf-8')
  const withBreaks = source
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<w:cr[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tr>/g, '\n')
    .replace(/<\/w:tc>/g, ' | ')

  const textOnly = withBreaks
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")

  return textOnly
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').replace(/\s+\|\s+/g, ' | ').trim())
    .filter(Boolean)
    .join('\n')
}

async function unzipEntries(buffer: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError ?? new Error('无法打开 DOCX 压缩包。'))
        return
      }

      const files = new Map<string, Buffer>()

      zipFile.readEntry()

      zipFile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipFile.readEntry()
          return
        }

        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            zipFile.close()
            reject(streamError ?? new Error(`无法读取 DOCX 条目：${entry.fileName}`))
            return
          }

          const chunks: Buffer[] = []
          stream.on('data', (chunk) => {
            chunks.push(Buffer.from(chunk))
          })
          stream.on('end', () => {
            let data = Buffer.concat(chunks)
            if (/\.xml$/i.test(entry.fileName) && looksCompressedXml(data)) {
              try {
                data = inflateRawSync(data)
              } catch {
                // Keep original bytes if the XML entry is not actually deflated in this form.
              }
            }

            files.set(entry.fileName, data)
            zipFile.readEntry()
          })
          stream.on('error', (streamReadError) => {
            zipFile.close()
            reject(streamReadError)
          })
        })
      })

      zipFile.on('end', () => {
        zipFile.close()
        resolve(files)
      })

      zipFile.on('error', (zipError) => {
        zipFile.close()
        reject(zipError)
      })
    })
  })
}

function looksCompressedXml(buffer: Buffer): boolean {
  if (buffer.length < 4) return false
  const prefix = buffer.subarray(0, 4).toString('utf-8')
  return !prefix.includes('<')
}
