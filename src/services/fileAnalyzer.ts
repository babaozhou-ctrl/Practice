export interface FileAnalysisResult {
  content: string
  localSummary: string
}

export interface FileSummaryRequest {
  fileName: string
  content: string
}

export class FileAnalyzer {
  async readFile(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase()

    switch (ext) {
      case 'txt':
      case 'md':
      case 'json':
      case 'xml':
      case 'yaml':
      case 'yml':
      case 'toml':
      case 'csv':
        return await this.readTextFile(file)
      case 'pdf':
        return await this.readPDF(file)
      case 'docx':
        return await this.readDocx(file)
      default:
        if (file.type.startsWith('text/') || this.isSourceCode(ext)) {
          return await this.readTextFile(file)
        }
        return `[Unsupported file type: .${ext}]`
    }
  }

  private isSourceCode(ext?: string): boolean {
    const codeExts = [
      'js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'go', 'java', 'cpp', 'c',
      'h', 'hpp', 'cs', 'rb', 'php', 'swift', 'kt', 'scala', 'dart',
      'sh', 'bash', 'zsh', 'ps1', 'bat', 'sql', 'r', 'm', 'mm',
    ]
    return ext ? codeExts.includes(ext) : false
  }

  private async readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read text file'))
      reader.readAsText(file)
    })
  }

  private async readPDF(file: File): Promise<string> {
    return await this.readDocumentViaElectron(file)
  }

  private async readDocx(file: File): Promise<string> {
    return await this.readDocumentViaElectron(file)
  }

  private async readDocumentViaElectron(file: File): Promise<string> {
    if (!window.electronAPI?.extractDocumentText) {
      return `[Document file: ${file.name} — desktop document extraction is unavailable in this environment]`
    }

    try {
      const buffer = await file.arrayBuffer()
      const extracted = await window.electronAPI.extractDocumentText({
        fileName: file.name,
        mimeType: file.type,
        buffer,
      })

      const normalized = extracted.trim()
      if (!normalized) {
        return `[Document file: ${file.name} — no readable text was found]`
      }

      return normalized
    } catch (error: any) {
      return `[Document file: ${file.name} — extraction failed: ${error?.message ?? String(error)}]`
    }
  }

  summarize(request: FileSummaryRequest): string {
    const lines = request.content.split('\n')
    const wordCount = request.content.split(/\s+/).length
    const lineCount = lines.length
    const preview = lines.slice(0, 10).join('\n').substring(0, 500)

    return `内容概览：共 ${lineCount} 行，约 ${wordCount} 个词。\n\n预览：\n${preview}`
  }

  async analyzeFile(file: File): Promise<FileAnalysisResult> {
    const content = await this.readFile(file)
    return {
      content,
      localSummary: this.summarize({
        fileName: file.name,
        content,
      }),
    }
  }
}
