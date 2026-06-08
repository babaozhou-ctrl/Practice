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
        return `这个文件类型我现在还读不太好：${ext ?? 'unknown'}`
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
      reader.onerror = () => reject(new Error('读取文本内容时出了点问题。'))
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
      return `我已经接住《${file.name}》了，不过当前这份环境还不能把这类文档里的正文完整读出来。`
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
        return `我看过《${file.name}》了，但这次还没能从里面提取到可读文字。`
      }

      return normalized
    } catch (error: any) {
      return `我试着读《${file.name}》的时候卡了一下，所以这次只能先陪你看文件名和基础信息。${
        error?.message ? ` ${error.message}` : ''
      }`
    }
  }

  summarize(request: FileSummaryRequest): string {
    const lines = request.content.split('\n')
    const wordCount = request.content.split(/\s+/).filter(Boolean).length
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
