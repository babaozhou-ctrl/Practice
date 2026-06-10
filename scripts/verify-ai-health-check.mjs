import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const providerSource = readFileSync(resolve('src/ai/providers/DeepSeekChatProvider.ts'), 'utf8')
const settingsSource = readFileSync(resolve('src/components/settings/AISettingsPanel.tsx'), 'utf8')

const providerChecks = [
  'function normalizeEndpoint(value: string): string {',
  'function buildHealthCheckBody(config: AIConfig) {',
  "message: '还没有填写可用的接口地址。'",
  "message: '接口检查超时了，可能是网络慢，或者当前 endpoint 无响应。'",
  "message: `接口检查失败：${error?.message ?? '无法连接到聊天服务。'}`",
  "message: `接口可达，但请求未通过（${response.status}）。${errText}`",
]

const settingsChecks = [
  'const aiHealthDebounceTimerRef = useRef<number | null>(null)',
  'aiHealthDebounceTimerRef.current = window.setTimeout(() => {',
  '}, enabled ? 380 : 120)',
]

for (const snippet of providerChecks) {
  if (!providerSource.includes(snippet)) {
    console.error(`[deep-pet] ai health verification failed: missing provider snippet ${snippet}`)
    process.exit(1)
  }
}

for (const snippet of settingsChecks) {
  if (!settingsSource.includes(snippet)) {
    console.error(`[deep-pet] ai health verification failed: missing settings snippet ${snippet}`)
    process.exit(1)
  }
}

console.log('[deep-pet] ai health checks verified')
