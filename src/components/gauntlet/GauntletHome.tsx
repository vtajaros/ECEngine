import React, { useState, useEffect, useRef } from 'react'
import { Flame, HelpCircle, History, Award, Target } from 'lucide-react'
import { GAUNTLET_SUBJECTS, TUNING, overallRating, ratingTier } from '../../lib/gauntlet'
import { SUBJECT_LINE_COLOR } from '../../lib/dashboardUtils'
import { useGauntletStore } from '../../store/useGauntletStore'
import { GauntletFaqModal } from './GauntletFaqModal'
import { GauntletRecordsModal } from './GauntletRecordsModal'
import { GauntletRanksModal } from './GauntletRanksModal'
import { GauntletWeakAreasModal } from './GauntletWeakAreasModal'
import { Tooltip } from '../ui/Tooltip'

// Number count-up hook (~600ms cubic ease-out)
function useCountUp(target: number, durationMs = 600): number {
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (target <= 0) {
      setVal(0)
      return
    }
    const start = performance.now()
    let frame: number
    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / durationMs)
      const ease = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(ease * target))
      if (progress < 1) {
        frame = requestAnimationFrame(step)
      }
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return val
}

export const GauntletHome: React.FC = () => {
  const hub = useGauntletStore(s => s.hub)
  const openSetup = useGauntletStore(s => s.openSetup)

  const [isFaqOpen, setIsFaqOpen] = useState(false)
  const [isRecordsOpen, setIsRecordsOpen] = useState(false)
  const [isRanksOpen, setIsRanksOpen] = useState(false)
  const [isWeakAreasOpen, setIsWeakAreasOpen] = useState(false)

  // 3D tilt state for each card
  const [timedTilt, setTimedTilt] = useState({ rx: 0, ry: 0 })
  const [survivalTilt, setSurvivalTilt] = useState({ rx: 0, ry: 0 })
  const tiltRafRef = useRef<number | null>(null)

  const handleTilt = (
    e: React.MouseEvent<HTMLDivElement>,
    setter: React.Dispatch<React.SetStateAction<{ rx: number; ry: number }>>,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    const ry = ((x - cx) / cx) * 4
    const rx = -((y - cy) / cy) * 4

    if (tiltRafRef.current !== null) cancelAnimationFrame(tiltRafRef.current)
    tiltRafRef.current = requestAnimationFrame(() => {
      setter({ rx: Math.round(rx * 10) / 10, ry: Math.round(ry * 10) / 10 })
    })
  }

  const handleTiltLeave = (setter: React.Dispatch<React.SetStateAction<{ rx: number; ry: number }>>) => {
    if (tiltRafRef.current !== null) cancelAnimationFrame(tiltRafRef.current)
    setter({ rx: 0, ry: 0 })
  }

  const ratings = hub?.ratings ?? {
    MATH: { rating: TUNING.startRating, answers: 0 },
    GEAS: { rating: TUNING.startRating, answers: 0 },
    ELECS: { rating: TUNING.startRating, answers: 0 },
    EST: { rating: TUNING.startRating, answers: 0 },
  }

  const overall = overallRating(ratings)
  const overallTier = ratingTier(overall.rating)

  // Animated ratings
  const countedMath = useCountUp(Math.round(ratings.MATH.rating))
  const countedGeas = useCountUp(Math.round(ratings.GEAS.rating))
  const countedElecs = useCountUp(Math.round(ratings.ELECS.rating))
  const countedEst = useCountUp(Math.round(ratings.EST.rating))
  const countedOverall = useCountUp(Math.round(overall.rating))

  const countedMap = {
    MATH: countedMath,
    GEAS: countedGeas,
    ELECS: countedElecs,
    EST: countedEst,
  }

  return (
    <div className="relative h-full min-h-0 w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none">
      {/* Main Foreground Container: Centered vertically and horizontally */}
      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center my-auto">
        {/* Animated GAUNTLET Title with 4s breathing glow + 6s glitch shimmer */}
        <div
          className="relative inline-block"
          style={{ animation: 'gauntlet-title-breathe 4s ease-in-out infinite' }}
        >
          <h1
            className="gauntlet-glitch-title font-['Orbitron'] text-4xl sm:text-5xl lg:text-6xl font-black tracking-widest text-white"
            style={{ animation: 'gauntlet-glitch 6s infinite ease-in-out' }}
          >
            GAUNT<span className="text-accent">LET</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-text-muted font-['Rajdhani'] font-semibold text-xs sm:text-sm uppercase tracking-[0.25em] mt-1.5 sm:mt-2">
          High-Stakes Speed & Accuracy Arena
        </p>

        {/* Two Large Mode Cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mt-6 sm:mt-7 [perspective:800px]">
          {/* Time Trial Card Container with Conic Border & 3D Tilt */}
          <div
            onMouseMove={e => handleTilt(e, setTimedTilt)}
            onMouseLeave={() => handleTiltLeave(setTimedTilt)}
            onClick={() => openSetup('timed')}
            className="group relative rounded-2xl p-[1px] overflow-hidden transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,65,0.3)] cursor-pointer focus-within:ring-2 focus-within:ring-accent"
            style={{
              transform:
                timedTilt.rx || timedTilt.ry
                  ? `perspective(800px) rotateX(${timedTilt.rx}deg) rotateY(${timedTilt.ry}deg) translateY(-2px)`
                  : 'translateY(0)',
              transition: 'transform 0.15s ease-out',
            }}
          >
            {/* Rotating Conic Border (1px ring on hover) */}
            <div
              className="gauntlet-border-spinner absolute -inset-[150%] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0 300deg, #00FF41 360deg)',
                animation: 'gauntlet-border-spin 3s linear infinite',
              }}
            />

            {/* Inner Card Content */}
            <button
              type="button"
              className="relative w-full h-full bg-[#161616] border border-[#262626] group-hover:border-transparent rounded-[15px] p-5 sm:p-6 flex flex-col justify-between text-left transition-colors focus:outline-none"
            >
              <div>
                {/* Stopwatch Icon with Sweeping Hand */}
                <div className="w-12 h-12 rounded-xl bg-surface border border-border-base flex items-center justify-center mb-4 group-hover:border-accent/50 transition-colors">
                  <div className="relative w-6 h-6">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-6 h-6 text-accent"
                    >
                      <line x1="10" x2="14" y1="2" y2="2" />
                      <circle cx="12" cy="14" r="8" />
                    </svg>
                    {/* Sweeping Hand */}
                    <div
                      className="gauntlet-hand-sweep absolute inset-0 flex items-center justify-center"
                      style={{
                        animation: 'gauntlet-hand-sweep 4s linear infinite',
                        transformOrigin: '12px 14px',
                      }}
                    >
                      <div className="w-[1.5px] h-[6px] bg-accent -translate-y-[3px] rounded-full" />
                    </div>
                  </div>
                </div>

                <h2 className="font-['Orbitron'] font-bold text-lg text-text-primary group-hover:text-accent transition-colors tracking-wide">
                  TIME TRIAL
                </h2>
                <p className="text-text-muted font-['JetBrains_Mono'] text-xs mt-2 leading-relaxed">
                  Race the clock. Speed and accuracy score points.
                </p>
              </div>

              <div className="mt-5 flex items-center gap-1.5 font-['Rajdhani'] text-xs font-bold uppercase tracking-wider text-accent">
                <span>Configure Run</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>
          </div>

          {/* Survival Card Container with Conic Border & 3D Tilt */}
          <div
            onMouseMove={e => handleTilt(e, setSurvivalTilt)}
            onMouseLeave={() => handleTiltLeave(setSurvivalTilt)}
            onClick={() => openSetup('survival')}
            className="group relative rounded-2xl p-[1px] overflow-hidden transition-all duration-300 hover:shadow-[0_0_25px_rgba(239,68,68,0.3)] cursor-pointer focus-within:ring-2 focus-within:ring-[#ef4444]"
            style={{
              transform:
                survivalTilt.rx || survivalTilt.ry
                  ? `perspective(800px) rotateX(${survivalTilt.rx}deg) rotateY(${survivalTilt.ry}deg) translateY(-2px)`
                  : 'translateY(0)',
              transition: 'transform 0.15s ease-out',
            }}
          >
            {/* Rotating Conic Border (1px ring on hover) */}
            <div
              className="gauntlet-border-spinner absolute -inset-[150%] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0 300deg, #ef4444 360deg)',
                animation: 'gauntlet-border-spin 3s linear infinite',
              }}
            />

            {/* Inner Card Content */}
            <button
              type="button"
              className="relative w-full h-full bg-[#161616] border border-[#262626] group-hover:border-transparent rounded-[15px] p-5 sm:p-6 flex flex-col justify-between text-left transition-colors focus:outline-none"
            >
              <div>
                {/* Flame Icon with subtle flicker */}
                <div className="w-12 h-12 rounded-xl bg-surface border border-border-base flex items-center justify-center mb-4 group-hover:border-[#ef4444]/50 transition-colors">
                  <Flame
                    size={24}
                    className="gauntlet-flame-flicker text-[#ef4444]"
                    style={{ animation: 'gauntlet-flame-flicker 2s ease-in-out infinite' }}
                  />
                </div>

                <h2 className="font-['Orbitron'] font-bold text-lg text-text-primary group-hover:text-[#ef4444] transition-colors tracking-wide">
                  SURVIVAL
                </h2>
                <p className="text-text-muted font-['JetBrains_Mono'] text-xs mt-2 leading-relaxed">
                  3 or 5 lives. Beat the per-question timer. How far can you go?
                </p>
              </div>

              <div className="mt-5 flex items-center gap-1.5 font-['Rajdhani'] text-xs font-bold uppercase tracking-wider text-[#ef4444]">
                <span>Configure Run</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>
          </div>
        </div>

        {/* Ratings Row: 4 subject chips + OVERALL in ONE row with count-up animation */}
        <div className="w-full mt-6 sm:mt-7 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 py-1">
          {GAUNTLET_SUBJECTS.map(subject => {
            const r = ratings[subject]
            const isProvisional = r.answers < TUNING.provisionalAnswers
            const color = SUBJECT_LINE_COLOR[subject]
            return (
              <div
                key={subject}
                className="bg-[#141414] border border-[#262626] rounded-xl px-2 sm:px-2.5 py-1.5 flex items-center gap-1.5 sm:gap-2 text-xs shrink-0"
              >
                <span
                  className="font-['Orbitron'] font-bold text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded text-black"
                  style={{
                    backgroundColor: color,
                    color: '#000000',
                  }}
                >
                  {subject}
                </span>
                <span className="font-['JetBrains_Mono'] font-bold text-text-primary">
                  {countedMap[subject]}
                </span>
                {isProvisional && (
                  <Tooltip content="Provisional (< 30 answers)" position="top">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[#FFB800] shadow-[0_0_6px_#FFB800] inline-block"
                    />
                  </Tooltip>
                )}
              </div>
            )
          })}

          {/* OVERALL Chip (slightly larger, clickable to open rankings info) */}
          <Tooltip content="Click to view Elo Ranking Tiers" position="top">
            <button
              type="button"
              onClick={() => setIsRanksOpen(true)}
              className="bg-[#141414] border border-accent/40 hover:border-accent rounded-xl px-2.5 sm:px-3 py-1.5 flex items-center gap-1.5 sm:gap-2 text-xs shadow-[0_0_12px_rgba(0,255,65,0.1)] hover:shadow-[0_0_16px_rgba(0,255,65,0.25)] shrink-0 transition-all cursor-pointer group"
            >
              <span className="font-['Orbitron'] font-bold text-[11px] text-accent group-hover:underline">
                OVERALL
              </span>
              <span className="font-['JetBrains_Mono'] font-bold text-white text-sm">
                {countedOverall}
              </span>
              <span className="font-['Rajdhani'] font-bold text-[10px] text-accent px-1.5 py-0.2 bg-accent/15 rounded uppercase tracking-wider">
                {overallTier.name}
              </span>
              {overall.provisional && (
                <span className="text-[10px] font-['Rajdhani'] font-bold text-[#FFB800] uppercase tracking-wider">
                  PROV
                </span>
              )}
            </button>
          </Tooltip>
        </div>

        {/* Footer Buttons directly under the ratings row */}
        <div className="mt-4 sm:mt-5 flex items-center justify-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => setIsRanksOpen(true)}
            className="text-text-muted hover:text-text-primary text-xs font-['Rajdhani'] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded hover:bg-surface-2 cursor-pointer"
          >
            <Award size={14} className="text-accent" />
            Rankings
          </button>

          <button
            type="button"
            onClick={() => setIsFaqOpen(true)}
            className="text-text-muted hover:text-text-primary text-xs font-['Rajdhani'] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded hover:bg-surface-2 cursor-pointer"
          >
            <HelpCircle size={14} className="text-accent" />
            How It Works
          </button>

          <button
            type="button"
            onClick={() => setIsRecordsOpen(true)}
            className="text-text-muted hover:text-text-primary text-xs font-['Rajdhani'] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded hover:bg-surface-2 cursor-pointer"
          >
            <History size={14} className="text-accent" />
            Records
          </button>

          <button
            type="button"
            onClick={() => setIsWeakAreasOpen(true)}
            className="text-text-muted hover:text-text-primary text-xs font-['Rajdhani'] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded hover:bg-surface-2 cursor-pointer"
          >
            <Target size={14} className="text-warn" />
            Weak Areas
          </button>
        </div>
      </div>

      {/* Modals */}
      <GauntletRanksModal
        isOpen={isRanksOpen}
        onClose={() => setIsRanksOpen(false)}
        overallRating={overall.rating}
        isProvisional={overall.provisional}
      />
      <GauntletFaqModal isOpen={isFaqOpen} onClose={() => setIsFaqOpen(false)} />
      <GauntletRecordsModal isOpen={isRecordsOpen} onClose={() => setIsRecordsOpen(false)} />
      <GauntletWeakAreasModal isOpen={isWeakAreasOpen} onClose={() => setIsWeakAreasOpen(false)} />
    </div>
  )
}
