import React, { useRef, useEffect, useState } from 'react'

interface AutoFitTextProps {
  html: string
  className?: string
}

export const AutoFitText: React.FC<AutoFitTextProps> = ({ html, className }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current && contentRef.current) {
        const containerWidth = containerRef.current.clientWidth
        if (containerWidth <= 0) return

        // Measure unconstrained content width including KaTeX display blocks
        const katexEl = contentRef.current.querySelector('.katex-html') as HTMLElement | null
        const katexDisplay = contentRef.current.querySelector('.katex-display') as HTMLElement | null
        const rawScrollWidth = contentRef.current.scrollWidth
        const katexWidth = Math.max(
          katexEl ? (katexEl.scrollWidth || katexEl.offsetWidth) : 0,
          katexDisplay ? katexDisplay.scrollWidth : 0
        )
        const naturalWidth = Math.max(rawScrollWidth, katexWidth)

        if (naturalWidth > containerWidth) {
          // Add padding so it never touches the absolute card edges
          setScale(Math.min(1, Math.max((containerWidth * 0.92) / naturalWidth, 0.45)))
        } else {
          setScale(1)
        }
      }
    }

    const resizeObserver = new ResizeObserver(updateScale)
    if (containerRef.current) resizeObserver.observe(containerRef.current)
    if (contentRef.current) resizeObserver.observe(contentRef.current)

    updateScale()
    return () => resizeObserver.disconnect()
  }, [html])

  return (
    <div ref={containerRef} className="w-full max-w-full flex justify-center items-center overflow-hidden text-center" data-center-math="true">
      <div 
        ref={contentRef}
        className={`${className || ''} text-center`}
        data-center-math="true"
        style={{
          transform: scale < 1 ? `scale(${scale})` : 'none',
          transformOrigin: 'center center',
          width: scale < 1 ? `${Math.round(100 / scale)}%` : '100%',
          maxWidth: scale < 1 ? `${Math.round(100 / scale)}%` : '100%',
          textAlign: 'center',
          wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
