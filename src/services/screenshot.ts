// Placeholder for Phase 2 — screenshot service
// Uses Electron's desktopCapturer API

export async function takeScreenshot(): Promise<string | null> {
  if (!window.electronAPI) return null
  // Phase 2: implement via main process IPC
  return null
}

export async function startScreenCapture(
  callback: (imageData: string) => void,
  intervalMs = 10000
): Promise<() => void> {
  console.log('[Screenshot] Screen capture started (placeholder)')

  const intervalId = setInterval(async () => {
    const data = await takeScreenshot()
    if (data) callback(data)
  }, intervalMs)

  return () => {
    clearInterval(intervalId)
    console.log('[Screenshot] Screen capture stopped')
  }
}
