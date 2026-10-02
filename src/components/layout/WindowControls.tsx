import React, { useEffect, useState } from 'react'

export const WindowControls: React.FC = () => {
  const controls = (window as any).electron?.windowControls
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (controls?.isMaximized) {
      controls.isMaximized().then((max: boolean) => {
        if (typeof max === 'boolean') setIsMaximized(max)
      }).catch(() => {})
    }

    if (controls?.onMaximizedChanged) {
      const cleanup = controls.onMaximizedChanged((max: boolean) => {
        setIsMaximized(max)
      })
      return cleanup
    }
  }, [controls])

  const handleToggleMaximize = () => {
    controls?.maximize()
    setIsMaximized(prev => !prev)
  }

  return (
    <div className="flex h-full ml-auto select-none [-webkit-app-region:no-drag]">
      {/* Minimize */}
      <button
        type="button"
        onClick={() => controls?.minimize()}
        className="w-[46px] h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors duration-150 focus:outline-none"
        title="Minimize"
        aria-label="Minimize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M0 5H10" stroke="currentColor" strokeWidth="1" shapeRendering="crispEdges" />
        </svg>
      </button>

      {/* Maximize / Restore */}
      <button
        type="button"
        onClick={handleToggleMaximize}
        className="w-[46px] h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors duration-150 focus:outline-none"
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2.5 2.5V0.5H9.5V7.5H7.5"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
              shapeRendering="crispEdges"
            />
            <rect
              x="0.5"
              y="2.5"
              width="7"
              height="7"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
              shapeRendering="crispEdges"
            />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
              shapeRendering="crispEdges"
            />
          </svg>
        )}
      </button>

      {/* Close */}
      <button
        type="button"
        onClick={() => controls?.close()}
        className={`w-[46px] h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#e81123] active:bg-[#c4101e] transition-colors duration-150 focus:outline-none ${isMaximized ? '' : 'rounded-tr-xl'}`}
        title="Close"
        aria-label="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}
