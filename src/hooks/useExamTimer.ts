import { useState, useEffect, useCallback } from 'react'

export function useExamTimer(initialSeconds: number = 0, isCountdown: boolean = false) {
  const [seconds, setSeconds] = useState(initialSeconds)
  const [isActive, setIsActive] = useState(false)

  const start = useCallback(() => setIsActive(true), [])
  const pause = useCallback(() => setIsActive(false), [])
  const reset = useCallback((newTime?: number) => {
    setIsActive(false)
    setSeconds(newTime !== undefined ? newTime : initialSeconds)
  }, [initialSeconds])

  useEffect(() => {
    let interval: number | null = null
    if (isActive) {
      interval = window.setInterval(() => {
        setSeconds(prev => {
          if (isCountdown) {
            if (prev <= 1) {
              if (interval) window.clearInterval(interval)
              setIsActive(false)
              return 0
            }
            return prev - 1
          }
          return prev + 1
        })
      }, 1000)
    }
    return () => {
      if (interval) window.clearInterval(interval)
    }
  }, [isActive, isCountdown])

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const remainingSeconds = totalSeconds % 60
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatted = formatTime(seconds)

  return {
    seconds,
    formatted,
    start,
    pause,
    reset,
    isActive
  }
}
