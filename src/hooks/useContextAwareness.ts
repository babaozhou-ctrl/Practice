import { useEffect, useRef } from 'react'
import { WindowDetector } from '../context/WindowDetector'
import { classifyActivity } from '../context/ActivityClassifier'
import { useContextStore } from '../store/contextStore'

export function useContextAwareness() {
  const setActiveWindow = useContextStore((s) => s.setActiveWindow)
  const setActivity = useContextStore((s) => s.setActivity)

  useEffect(() => {
    const detector = new WindowDetector()

    detector.onUpdate((info) => {
      setActiveWindow(info)
      setActivity(classifyActivity(info))
    })

    detector.startPolling(5000)

    return () => { detector.stopPolling() }
  }, [setActiveWindow, setActivity])
}
