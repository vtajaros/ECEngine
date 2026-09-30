import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, X, Shield } from 'lucide-react'
import { ratingTier, type RatingTierInfo } from '../../lib/gauntlet'

interface GauntletRanksModalProps {
  isOpen: boolean
  onClose: () => void
  overallRating: number
  isProvisional: boolean
  subjectName?: string
}

interface TierDefinition {
  name: RatingTierInfo['name']
  range: string
  floor: number
  next: number | null
  color: string
  bg: string
  border: string
  glow: string
  description: string
}

const TIERS: TierDefinition[] = [
  {
    name: 'INSULATOR',
    range: '500 – 849',
    floor: 500,
    next: 850,
    color: '#FFFFFF',
    bg: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.3)',
    glow: 'rgba(255, 255, 255, 0.15)',
    description: 'Foundational high-resistance state. Rapid early calibration with review session bonuses.',
  },
  {
    name: 'SEMICONDUCTOR',
    range: '850 – 1199',
    floor: 850,
    next: 1200,
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.08)',
    border: 'rgba(56, 189, 248, 0.3)',
    glow: 'rgba(56, 189, 248, 0.15)',
    description: 'Transitioning state. Controlled conduction emerging with moderate volatility.',
  },
  {
    name: 'CONDUCTOR',
    range: '1200 – 1499',
    floor: 1200,
    next: 1500,
    color: '#C084FC',
    bg: 'rgba(192, 132, 252, 0.08)',
    border: 'rgba(192, 132, 252, 0.3)',
    glow: 'rgba(192, 132, 252, 0.15)',
    description: 'Free-flowing charge. Strong baseline competency across core engineering subjects.',
  },
  {
    name: 'COPPER',
    range: '1500 – 1799',
    floor: 1500,
    next: 1800,
    color: '#F97316',
    bg: 'rgba(249, 115, 22, 0.08)',
    border: 'rgba(249, 115, 22, 0.3)',
    glow: 'rgba(249, 115, 22, 0.15)',
    description: 'High electrical conductivity. Rapid recognition and solid consistency under pressure.',
  },
  {
    name: 'SILVER',
    range: '1800 – 1999',
    floor: 1800,
    next: 2000,
    color: '#E2E8F0',
    bg: 'rgba(226, 232, 240, 0.08)',
    border: 'rgba(226, 232, 240, 0.3)',
    glow: 'rgba(226, 232, 240, 0.15)',
    description: 'Superior conductivity. Elite board exam recall and minimal error rate across all domains.',
  },
  {
    name: 'SUPERCONDUCTOR',
    range: '2000+',
    floor: 2000,
    next: null,
    color: '#00FF41',
    bg: 'rgba(0, 255, 65, 0.08)',
    border: 'rgba(0, 255, 65, 0.35)',
    glow: 'rgba(0, 255, 65, 0.25)',
    description: 'Zero electrical resistance. Pinnacle arena mastery, unmatched speed, and absolute recall.',
  },
]

export const GauntletRanksModal: React.FC<GauntletRanksModalProps> = ({
  isOpen,
  onClose,
  overallRating,
  isProvisional,
  subjectName,
}) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const currentTierInfo = ratingTier(overallRating)
  const currentTierDef = TIERS.find(t => t.name === currentTierInfo.name) ?? TIERS[0]

  // Calculate progress toward next tier
  let progressPercent = 100
  let pointsToNext: number | null = null
  if (currentTierInfo.next !== null) {
    const rangeSpan = currentTierInfo.next - currentTierInfo.floor
    const pointsGained = Math.max(0, overallRating - currentTierInfo.floor)
    progressPercent = Math.min(100, Math.max(0, Math.round((pointsGained / rangeSpan) * 100)))
    pointsToNext = Math.max(0, Math.ceil(currentTierInfo.next - overallRating))
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-4xl bg-[#0e0e0e] border border-border-base rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-base bg-[#141414] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Award size={18} />
              </div>
              <div>
                <h2 className="font-['Orbitron'] text-base sm:text-lg font-bold text-text-primary tracking-wide flex items-center gap-2">
                  ELO RANKING TIERS
                </h2>
                <p className="text-[11px] font-['Rajdhani'] font-semibold text-text-muted uppercase tracking-wider">
                  {subjectName ? `${subjectName} Skill Progression & Ratings` : 'Arcade Skill Progression & Ratings'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body: Compact single-window presentation */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 show-scrollbar">
            {/* Player's Current Rank Card - Horizontal compact banner */}
            <div
              className="px-4 py-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0"
              style={{
                backgroundColor: currentTierDef.bg,
                borderColor: currentTierDef.border,
                boxShadow: `0 0 16px ${currentTierDef.glow}`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0 animate-pulse"
                  style={{ backgroundColor: currentTierDef.color, boxShadow: `0 0 8px ${currentTierDef.color}` }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-['Rajdhani'] font-bold text-text-muted uppercase tracking-wider">
                      {subjectName ? `${subjectName} Current Rank` : 'Current Rank'}
                    </span>
                    {isProvisional && (
                      <span className="text-[9px] font-['Rajdhani'] font-bold text-[#FFB800] bg-[#FFB800]/10 px-1.5 py-0.2 rounded border border-[#FFB800]/30 uppercase tracking-widest">
                        Provisional
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="font-['Orbitron'] text-xl font-black tracking-wider"
                      style={{ color: currentTierDef.color }}
                    >
                      {currentTierDef.name}
                    </span>
                    <span
                      className="text-[10px] font-['JetBrains_Mono'] px-1.5 py-0.2 rounded font-bold"
                      style={{
                        backgroundColor: `${currentTierDef.color}22`,
                        color: currentTierDef.color,
                      }}
                    >
                      {currentTierDef.range} ELO
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress bar to next tier */}
              {currentTierInfo.next !== null && (
                <div className="flex-1 max-w-sm px-2">
                  <div className="flex justify-between items-center text-[10px] font-['JetBrains_Mono'] text-text-muted mb-1">
                    <span>Progress to {TIERS.find(t => t.floor === currentTierInfo.next)?.name ?? 'Next'}</span>
                    <span className="font-bold text-white">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: currentTierDef.color,
                        boxShadow: `0 0 8px ${currentTierDef.color}`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-['JetBrains_Mono'] text-text-muted mt-0.5">
                    <span>{currentTierInfo.floor} pts</span>
                    <span>{currentTierInfo.next} pts</span>
                  </div>
                </div>
              )}

              {/* Overall Rating & Points to Next */}
              <div className="text-right sm:border-l sm:border-white/10 sm:pl-4 shrink-0">
                <div className="text-xs font-['JetBrains_Mono'] text-text-muted">
                  {subjectName ? `${subjectName} Rating:` : 'Rating:'}{' '}
                  <strong className="text-white text-sm font-['Orbitron']">{Math.round(overallRating)}</strong>
                </div>
                {pointsToNext !== null && currentTierInfo.next !== null && (
                  <div className="text-[10px] font-['Rajdhani'] font-bold text-accent">
                    +{pointsToNext} pts to rank up
                  </div>
                )}
              </div>
            </div>

            {/* Ranking Tiers Grid - 2 Columns (3 cards each) */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-['Rajdhani'] font-bold text-text-muted uppercase tracking-wider block">
                All Rating Brackets
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {TIERS.map(tier => {
                  const isCurrent = tier.name === currentTierInfo.name
                  return (
                    <div
                      key={tier.name}
                      className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                        isCurrent
                          ? 'bg-[#181818] border-accent/40 shadow-[0_0_15px_rgba(0,255,65,0.08)]'
                          : 'bg-[#121212] border-[#222] hover:border-[#333]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: tier.color,
                              boxShadow: isCurrent ? `0 0 8px ${tier.color}` : 'none',
                            }}
                          />
                          <span
                            className="font-['Orbitron'] font-bold text-xs tracking-wider"
                            style={{ color: tier.color }}
                          >
                            {tier.name}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-['Rajdhani'] font-bold text-accent bg-accent/15 px-1.5 py-0.2 rounded uppercase tracking-wider">
                              YOU
                            </span>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-['JetBrains_Mono'] font-bold text-xs text-white">
                            {tier.range}
                          </span>
                          <span className="text-[9px] font-['Rajdhani'] text-text-muted uppercase tracking-wider ml-1">
                            ELO
                          </span>
                        </div>
                      </div>

                      <p className="text-[10px] text-text-muted font-['JetBrains_Mono'] leading-tight line-clamp-1">
                        {tier.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* PRC TOS Calculation Note - Horizontal strip */}
            <div className="p-2.5 rounded-xl bg-[#141414] border border-[#222] text-[11px] font-['JetBrains_Mono'] text-text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-text-primary font-bold shrink-0">
                <Shield size={13} className="text-accent shrink-0" />
                <span className="text-[11px]">PRC Board Exam TOS Weighting:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-semibold text-[10px]">
                <span className="px-2 py-0.5 rounded bg-[#1e1e1e] text-white">MATH: 20%</span>
                <span className="px-2 py-0.5 rounded bg-[#1e1e1e] text-white">GEAS: 20%</span>
                <span className="px-2 py-0.5 rounded bg-[#1e1e1e] text-white">ELECS: 30%</span>
                <span className="px-2 py-0.5 rounded bg-[#1e1e1e] text-white">EST: 30%</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
