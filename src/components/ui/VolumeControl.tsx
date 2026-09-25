import React, { useState, useRef, useEffect } from 'react'
import { Volume2, Volume1, VolumeX } from 'lucide-react'
import { useSoundVolume } from '../../hooks/useSound'
import { Tooltip } from './Tooltip'

interface VolumeControlProps {
  className?: string
  iconSize?: number
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  className = '',
  iconSize = 16,
}) => {
  const { volume, isMuted, setVolume, toggleMute } = useSoundVolume()
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const prevVolumeRef = useRef(volume > 0 ? volume : 1.0)
  const sliderRef = useRef<HTMLDivElement>(null)

  // Keep track of last non-zero volume for unmuting
  useEffect(() => {
    if (volume > 0) {
      prevVolumeRef.current = volume
    }
  }, [volume])

  const effectiveVolume = isMuted ? 0 : volume

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
  }

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleMute()
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const step = 0.05
    const delta = e.deltaY < 0 ? step : -step
    const next = Math.max(0, Math.min(1, Number((volume + delta).toFixed(2))))
    setVolume(next)
  }

  const isExpanded = isHovered || isDragging || isFocused

  // Choose icon based on state
  const VolumeIcon = isMuted || effectiveVolume === 0
    ? VolumeX
    : effectiveVolume < 0.5
      ? Volume1
      : Volume2

  const percentLabel = Math.round(effectiveVolume * 100)

  return (
    <div
      className={`relative inline-flex items-center rounded border transition-all duration-200 ${
        isExpanded
          ? 'border-[#555] bg-[#111] shadow-lg'
          : isMuted
            ? 'border-[#3a2020] bg-[#140c0c] hover:border-[#552525]'
            : 'border-[#333] bg-[#111]/80 hover:border-[#666]'
      } ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
      }}
      onWheel={handleWheel}
    >
      {/* Speaker / Mute Button */}
      <Tooltip content={isMuted ? 'Unmute sounds' : `Sound Volume: ${percentLabel}%`} position="top">
        <button
          type="button"
          onClick={handleToggleClick}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`p-2 rounded focus:outline-none transition-colors flex items-center justify-center shrink-0 cursor-pointer ${
            isMuted ? 'text-danger hover:text-danger/80' : 'text-text-muted hover:text-white'
          }`}
          aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
        >
          <VolumeIcon size={iconSize} className="transition-transform duration-150 active:scale-90" />
        </button>
      </Tooltip>

      {/* YouTube-style Expandable Volume Slider */}
      <div
        className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
          isExpanded
            ? 'w-20 sm:w-24 opacity-100 pr-2.5 pointer-events-auto'
            : 'w-0 opacity-0 pr-0 pointer-events-none'
        }`}
        style={{
          transitionProperty: 'width, opacity, padding',
        }}
      >
        <div
          ref={sliderRef}
          className="relative w-full h-6 flex items-center cursor-pointer group/track select-none"
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
        >
          {/* Custom Track Background */}
          <div className="relative w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${
                isMuted || effectiveVolume === 0
                  ? 'bg-transparent'
                  : 'bg-accent shadow-[0_0_6px_rgba(0,255,65,0.6)]'
              }`}
              style={{ width: `${effectiveVolume * 100}%` }}
            />
          </div>

          {/* Non-overlapping Thumb Handle */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none transition-all duration-75 ${
              isMuted || effectiveVolume === 0
                ? 'bg-[#555] opacity-80'
                : 'bg-accent shadow-[0_0_8px_rgba(0,255,65,0.9)] group-hover/track:scale-110'
            }`}
            style={{
              left: `calc(${effectiveVolume * 100}% - ${effectiveVolume * 10}px)`,
            }}
          />

          {/* Native Range Input overlaid for accessibility and drag mechanics */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={effectiveVolume}
            onChange={handleSliderChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false)
              setIsDragging(false)
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            aria-label="Volume Slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentLabel}
          />
        </div>
      </div>
    </div>
  )
}
