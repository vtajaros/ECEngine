import { useEffect, useRef } from 'react'
import { dbService } from '../services/db.service'

const IDLE_THRESHOLD = 60
const FLUSH_INTERVAL = 60
const TICK_INTERVAL  = 5

export function useIdleAwareTimer(isActive: boolean) {
  const accumulatedRef = useRef(0)
  const lastActivityRef = useRef(Date.now())

  useEffect(() => {
    if (!isActive) {
      accumulatedRef.current = 0
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) return
    const onActivity = () => { lastActivityRef.current = Date.now() }
    window.addEventListener('mousemove', onActivity, { passive: true })
    window.addEventListener('keydown', onActivity, { passive: true })
    window.addEventListener('mousedown', onActivity, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onActivity)
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('mousedown', onActivity)
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) return
    const tick = setInterval(() => {
      const idleSeconds = (Date.now() - lastActivityRef.current) / 1000
      if (idleSeconds < IDLE_THRESHOLD) {
        accumulatedRef.current += TICK_INTERVAL
      }
    }, TICK_INTERVAL * 1000)
    return () => clearInterval(tick)
  }, [isActive])

  useEffect(() => {
    if (!isActive) return
    const flush = setInterval(() => {
      const minutes = accumulatedRef.current / 60
      if (minutes > 0) {
        accumulatedRef.current = 0
        dbService.updateTimeSpent(minutes).catch(console.error)
      }
    }, FLUSH_INTERVAL * 1000)
    return () => clearInterval(flush)
  }, [isActive])

  useEffect(() => {
    return () => {
      const minutes = accumulatedRef.current / 60
      if (minutes > 0) {
        accumulatedRef.current = 0
        dbService.updateTimeSpent(minutes).catch(console.error)
      }
    }
  }, [])
}
