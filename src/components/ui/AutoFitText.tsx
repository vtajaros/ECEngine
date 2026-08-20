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
        const contentWidth = contentRef.current.scrollWidth
        
        if (contentWidth > containerWidth && containerWidth > 0) {
          // Add a tiny bit of padding to the scale so it doesn't touch the absolute edges
          setScale((containerWidth * 0.95) / contentWidth)
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
    <div ref={containerRef} className="w-full flex justify-center items-center overflow-hidden">
      <div 
        ref={contentRef}
        className={className}
        style={{
          transform: scale < 1 ? `scale(${scale})` : 'none',
          transformOrigin: 'center center',
          width: '100%',
          textAlign: 'center',
          wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
