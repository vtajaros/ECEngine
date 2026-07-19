import { useEffect, useState, useRef } from 'react'

export function ZoomIndicator() {
  const [percent, setPercent] = useState<number | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const cleanup = window.electron.zoom.onChanged((pct) => {
      setPercent(pct)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setPercent(null), 1200)
    })
    return () => {
      cleanup()
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  if (percent === null) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        padding: '8px 16px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--accent-primary)',
        color: 'var(--accent-primary)',
        fontFamily: 'var(--font-body)',
        fontSize: '13px',
        letterSpacing: '0.05em',
        boxShadow: 'var(--glow-green)',
        pointerEvents: 'none',
      }}
    >
      {percent}%
    </div>
  )
}
