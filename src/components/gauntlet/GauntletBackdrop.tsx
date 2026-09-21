import React, { useEffect, useState, useRef } from 'react'

export const BACKDROP_CONFIG = {
  gridHeightPct: 45,
  gridLineColor: 'rgba(0, 255, 65, 0.35)',
  gridDurationSec: 8,
  horizonGlowAlpha: 0.22,
  vignetteCenterAlpha: 0.06,
  particleCount: 24,
  glyphCount: 14,
  glyphs: ['Ω', 'π', '∫', 'λ', 'μ', '∑', '√', 'dB', 'Hz'],
  scanlineSweepPeriodSec: 7,
  parallaxMaxPx: 6,
}

// 24 glowing particles (2-6px, opacity 0.35-0.8, drift 10-22s)
const PARTICLES = [
  { left: '5%', size: 3, duration: '12s', delay: '0s', opacity: 0.45 },
  { left: '9%', size: 5, duration: '18s', delay: '4s', opacity: 0.6 },
  { left: '13%', size: 2, duration: '10s', delay: '1.5s', opacity: 0.35 },
  { left: '18%', size: 6, duration: '20s', delay: '7s', opacity: 0.75 },
  { left: '22%', size: 4, duration: '14s', delay: '2s', opacity: 0.55 },
  { left: '27%', size: 3, duration: '11s', delay: '8s', opacity: 0.4 },
  { left: '32%', size: 5, duration: '19s', delay: '3.5s', opacity: 0.65 },
  { left: '37%', size: 2, duration: '10.5s', delay: '5s', opacity: 0.35 },
  { left: '42%', size: 6, duration: '21s', delay: '9s', opacity: 0.8 },
  { left: '46%', size: 4, duration: '15s', delay: '0.8s', opacity: 0.5 },
  { left: '51%', size: 3, duration: '13s', delay: '6.2s', opacity: 0.45 },
  { left: '56%', size: 5, duration: '17s', delay: '2.8s', opacity: 0.7 },
  { left: '60%', size: 2, duration: '10s', delay: '4.2s', opacity: 0.35 },
  { left: '65%', size: 6, duration: '22s', delay: '10s', opacity: 0.75 },
  { left: '69%', size: 4, duration: '16s', delay: '1.2s', opacity: 0.55 },
  { left: '74%', size: 3, duration: '12.5s', delay: '5.8s', opacity: 0.4 },
  { left: '78%', size: 5, duration: '18.5s', delay: '3s', opacity: 0.65 },
  { left: '83%', size: 2, duration: '11s', delay: '8.5s', opacity: 0.35 },
  { left: '87%', size: 4, duration: '14.5s', delay: '6.5s', opacity: 0.5 },
  { left: '91%', size: 6, duration: '20.5s', delay: '2.2s', opacity: 0.75 },
  { left: '94%', size: 3, duration: '13.5s', delay: '7.8s', opacity: 0.45 },
  { left: '97%', size: 5, duration: '19.5s', delay: '0.5s', opacity: 0.6 },
  { left: '15%', size: 3, duration: '15s', delay: '11s', opacity: 0.4 },
  { left: '85%', size: 4, duration: '16.5s', delay: '12s', opacity: 0.5 },
]

// 14 ECE Glyphs (JetBrains Mono, 14-28px, opacity 0.12-0.25, drift with rotation)
const GLYPHS = [
  { char: 'Ω', left: '7%', size: 24, duration: '22s', delay: '1s', opacity: 0.22, rot: '20deg' },
  { char: 'π', left: '16%', size: 18, duration: '18s', delay: '8s', opacity: 0.16, rot: '-15deg' },
  { char: '∫', left: '24%', size: 28, duration: '26s', delay: '3s', opacity: 0.25, rot: '12deg' },
  { char: 'λ', left: '33%', size: 20, duration: '20s', delay: '12s', opacity: 0.18, rot: '-18deg' },
  { char: 'μ', left: '41%', size: 22, duration: '24s', delay: '5s', opacity: 0.15, rot: '15deg' },
  { char: '∑', left: '48%', size: 26, duration: '25s', delay: '14s', opacity: 0.24, rot: '-10deg' },
  { char: '√', left: '57%', size: 24, duration: '21s', delay: '2s', opacity: 0.2, rot: '18deg' },
  { char: 'dB', left: '64%', size: 16, duration: '19s', delay: '9s', opacity: 0.15, rot: '-12deg' },
  { char: 'Hz', left: '73%', size: 18, duration: '23s', delay: '6s', opacity: 0.18, rot: '14deg' },
  { char: 'Ω', left: '82%', size: 26, duration: '27s', delay: '15s', opacity: 0.22, rot: '-20deg' },
  { char: 'λ', left: '90%', size: 20, duration: '20s', delay: '4s', opacity: 0.16, rot: '16deg' },
  { char: '∫', left: '11%', size: 22, duration: '24s', delay: '17s', opacity: 0.18, rot: '-15deg' },
  { char: 'π', left: '68%', size: 20, duration: '21s', delay: '13s', opacity: 0.17, rot: '10deg' },
  { char: '√', left: '36%', size: 24, duration: '23s', delay: '19s', opacity: 0.2, rot: '-12deg' },
]

interface GauntletBackdropProps {
  dimmed?: boolean
  intensity?: 'full' | 'dimmed' | 'subtle'
}

export const GauntletBackdrop: React.FC<GauntletBackdropProps> = ({ dimmed = false, intensity }) => {
  const [isTabHidden, setIsTabHidden] = useState(false)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const rAFRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Document visibility pause
  useEffect(() => {
    const handleVisibility = () => {
      setIsTabHidden(document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Mouse parallax throttled via rAF
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (rAFRef.current !== null) return
      rAFRef.current = requestAnimationFrame(() => {
        rAFRef.current = null
        const cx = window.innerWidth / 2
        const cy = window.innerHeight / 2
        const normX = (e.clientX - cx) / cx
        const normY = (e.clientY - cy) / cy
        setParallax({
          x: Math.round(normX * BACKDROP_CONFIG.parallaxMaxPx * 10) / 10,
          y: Math.round(normY * BACKDROP_CONFIG.parallaxMaxPx * 10) / 10,
        })
      })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (rAFRef.current !== null) cancelAnimationFrame(rAFRef.current)
    }
  }, [])

  const opacityClass =
    intensity === 'subtle'
      ? 'opacity-25'
      : intensity === 'dimmed' || dimmed
      ? 'opacity-40'
      : 'opacity-100'

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none select-none overflow-hidden bg-[#0D0D0D] transition-opacity duration-300 ${
        isTabHidden ? 'gauntlet-anim-paused' : ''
      } ${opacityClass}`}
    >
      {/* 2. Vignette Layer: center slightly lighter, edges dark so center content stays legible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 65% 55% at 50% 45%, rgba(0, 255, 65, ${BACKDROP_CONFIG.vignetteCenterAlpha}) 0%, transparent 70%, rgba(13, 13, 13, 0.95) 100%)`,
        }}
      />

      {/* Parallax Container */}
      <div
        className="absolute inset-0 will-change-transform transition-transform duration-100 ease-out"
        style={{
          transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
        }}
      >
        {/* 1. Perspective Grid Floor on bottom ~45% */}
        <div
          className="absolute inset-x-0 bottom-0 overflow-hidden [perspective:400px]"
          style={{ height: `${BACKDROP_CONFIG.gridHeightPct}%` }}
        >
          <div
            className="gauntlet-animated-grid absolute -inset-x-1/2 -bottom-10 h-[160%] origin-bottom"
            style={{
              backgroundImage: `
                linear-gradient(to right, ${BACKDROP_CONFIG.gridLineColor} 1px, transparent 1px),
                linear-gradient(to bottom, ${BACKDROP_CONFIG.gridLineColor} 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
              transform: 'perspective(400px) rotateX(60deg) translateY(0)',
              animation: `gauntlet-grid-scroll ${BACKDROP_CONFIG.gridDurationSec}s linear infinite`,
              filter: 'drop-shadow(0 0 4px rgba(0,255,65,0.4))',
              maskImage: 'linear-gradient(to top, black 20%, transparent 95%)',
              WebkitMaskImage: 'linear-gradient(to top, black 20%, transparent 95%)',
            }}
          />
        </div>

        {/* Horizon Glow Band (gradient rgba(0,255,65,0.22) fading upward over ~25% height) */}
        <div
          className="absolute inset-x-0 pointer-events-none"
          style={{
            bottom: `${BACKDROP_CONFIG.gridHeightPct - 5}%`,
            height: '25%',
            background: `linear-gradient(to top, transparent 0%, rgba(0, 255, 65, ${BACKDROP_CONFIG.horizonGlowAlpha}) 30%, transparent 100%)`,
            filter: 'blur(8px)',
          }}
        />

        {/* Sharp horizon line */}
        <div
          className="absolute inset-x-0 h-[1px] pointer-events-none"
          style={{
            bottom: `${BACKDROP_CONFIG.gridHeightPct}%`,
            background: 'linear-gradient(90deg, transparent 0%, rgba(0,255,65,0.6) 50%, transparent 100%)',
            boxShadow: '0 0 10px rgba(0,255,65,0.8), 0 0 20px rgba(0,255,65,0.4)',
          }}
        />

        {/* 5. Circuit Traces along Left and Right Edges */}
        {/* Left Circuit Traces */}
        <svg
          className="absolute left-0 top-0 h-full w-28 opacity-40 pointer-events-none"
          viewBox="0 0 120 700"
          preserveAspectRatio="none"
        >
          <g fill="none" strokeWidth="1.5">
            {/* Dim base paths */}
            <path d="M 0,80 L 35,80 L 70,115 L 70,280 L 95,305 L 95,460" stroke="rgba(0,255,65,0.15)" />
            <path d="M 0,220 L 25,220 L 50,245 L 50,420 L 80,450 L 80,600" stroke="rgba(0,255,65,0.15)" />
            <path d="M 0,380 L 40,380 L 75,415 L 75,640" stroke="rgba(0,255,65,0.15)" />

            {/* Glowing pulses travelling via stroke-dashoffset */}
            <path
              d="M 0,80 L 35,80 L 70,115 L 70,280 L 95,305 L 95,460"
              stroke="#00FF41"
              strokeDasharray="60 350"
              className="gauntlet-trace-line"
              style={{
                animation: 'gauntlet-trace-pulse 8s linear infinite',
                filter: 'drop-shadow(0 0 4px #00FF41)',
              }}
            />
            <path
              d="M 0,220 L 25,220 L 50,245 L 50,420 L 80,450 L 80,600"
              stroke="#00FF41"
              strokeDasharray="50 400"
              className="gauntlet-trace-line"
              style={{
                animation: 'gauntlet-trace-pulse 11s linear infinite',
                animationDelay: '3.5s',
                filter: 'drop-shadow(0 0 4px #00FF41)',
              }}
            />
            <path
              d="M 0,380 L 40,380 L 75,415 L 75,640"
              stroke="#00FF41"
              strokeDasharray="50 320"
              className="gauntlet-trace-line"
              style={{
                animation: 'gauntlet-trace-pulse 9.5s linear infinite',
                animationDelay: '1.8s',
                filter: 'drop-shadow(0 0 4px #00FF41)',
              }}
            />
          </g>
        </svg>

        {/* Right Circuit Traces */}
        <svg
          className="absolute right-0 top-0 h-full w-28 opacity-40 pointer-events-none scale-x-[-1]"
          viewBox="0 0 120 700"
          preserveAspectRatio="none"
        >
          <g fill="none" strokeWidth="1.5">
            <path d="M 0,110 L 30,110 L 65,145 L 65,310 L 90,335 L 90,490" stroke="rgba(0,255,65,0.15)" />
            <path d="M 0,250 L 35,250 L 60,275 L 60,450 L 85,475 L 85,620" stroke="rgba(0,255,65,0.15)" />
            <path d="M 0,420 L 45,420 L 80,455 L 80,660" stroke="rgba(0,255,65,0.15)" />

            <path
              d="M 0,110 L 30,110 L 65,145 L 65,310 L 90,335 L 90,490"
              stroke="#00FF41"
              strokeDasharray="60 380"
              className="gauntlet-trace-line"
              style={{
                animation: 'gauntlet-trace-pulse 10s linear infinite',
                animationDelay: '2s',
                filter: 'drop-shadow(0 0 4px #00FF41)',
              }}
            />
            <path
              d="M 0,250 L 35,250 L 60,275 L 60,450 L 85,475 L 85,620"
              stroke="#00FF41"
              strokeDasharray="55 370"
              className="gauntlet-trace-line"
              style={{
                animation: 'gauntlet-trace-pulse 12s linear infinite',
                animationDelay: '6s',
                filter: 'drop-shadow(0 0 4px #00FF41)',
              }}
            />
            <path
              d="M 0,420 L 45,420 L 80,455 L 80,660"
              stroke="#00FF41"
              strokeDasharray="50 350"
              className="gauntlet-trace-line"
              style={{
                animation: 'gauntlet-trace-pulse 8.5s linear infinite',
                animationDelay: '4.5s',
                filter: 'drop-shadow(0 0 4px #00FF41)',
              }}
            />
          </g>
        </svg>

        {/* 4. ECE Glyph Layer (~14 glyphs drifting upward with slight rotation) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {GLYPHS.map((g, i) => (
            <div
              key={i}
              className="gauntlet-glyph absolute font-['JetBrains_Mono'] font-bold text-[#00FF41] select-none"
              style={
                {
                  left: g.left,
                  bottom: 0,
                  fontSize: `${g.size}px`,
                  '--glyph-opacity': g.opacity,
                  '--glyph-rot': g.rot,
                  animation: `gauntlet-glyph-drift ${g.duration} linear infinite`,
                  animationDelay: g.delay,
                  filter: 'drop-shadow(0 0 6px rgba(0,255,65,0.4))',
                } as React.CSSProperties
              }
            >
              {g.char}
            </div>
          ))}
        </div>

        {/* 3. Glowing Particle Dots (~24 glowing dots 2-6px) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {PARTICLES.map((p, i) => (
            <div
              key={i}
              className="gauntlet-particle absolute rounded-full bg-[#00FF41]"
              style={
                {
                  left: p.left,
                  bottom: 0,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  '--dot-opacity': p.opacity,
                  boxShadow: '0 0 8px #00FF41, 0 0 16px rgba(0,255,65,0.5)',
                  animation: `gauntlet-particle-drift ${p.duration} linear infinite`,
                  animationDelay: p.delay,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>

      {/* 6. Scanline Sweep: one bright horizontal line sweeping top to bottom every ~7s */}
      <div
        className="gauntlet-scanline-sweep absolute inset-x-0 h-[2px] pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,255,65,0.8) 50%, transparent 100%)',
          boxShadow: '0 0 12px rgba(0,255,65,0.6)',
          animation: `gauntlet-scanline-sweep ${BACKDROP_CONFIG.scanlineSweepPeriodSec}s linear infinite`,
        }}
      />

      {/* Static faint scanline raster pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.7) 50%)',
          backgroundSize: '100% 3px',
        }}
      />
    </div>
  )
}
