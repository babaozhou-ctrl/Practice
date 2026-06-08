import { useEffect } from 'react'
import { subscribeScreenPerception } from '../context/ScreenPerceptionSync'
import { WindowDetector } from '../context/WindowDetector'
import { classifyActivity } from '../context/ActivityClassifier'
import { useContextStore } from '../store/contextStore'

export function useContextAwareness() {
  const setActiveWindow = useContextStore((s) => s.setActiveWindow)
  const setActivity = useContextStore((s) => s.setActivity)
  const setScreenPerception = useContextStore((s) => s.setScreenPerception)

  useEffect(() => {
    const detector = new WindowDetector()
    const unsubscribeScreenPerception = subscribeScreenPerception((snapshot) => {
      setScreenPerception(snapshot)
    })

    detector.onUpdate((info) => {
      setActiveWindow(info)
      setActivity(classifyActivity(info))
    })

    detector.startPolling(5000)

    return () => {
      unsubscribeScreenPerception()
      detector.stopPolling()
    }
  }, [setActiveWindow, setActivity, setScreenPerception])
}
