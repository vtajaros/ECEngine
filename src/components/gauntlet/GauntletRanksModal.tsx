import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, X, Shield } from 'lucide-react'
import { ratingTier, type RatingTierInfo } from '../../lib/gauntlet'

interface GauntletRanksModalProps {
  isOpen: boolean
  onClose: () => void
  overallRating: number
  isProvisional: boolean
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
    name: 'ROOKIE',
    range: '< 1000',
    floor: 0,
    next: 1000,
    color: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.08)',
    border: 'rgba(148, 163, 184, 0.3)',
    glow: 'rgba(148, 163, 184, 0.15)',
    description: 'Foundational entry tier. Calibration phase for new arena challengers.',
  },
  {
    name: 'CONTENDER',
    range: '1000 – 1149',
    floor: 1000,
    next: 1150,
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.08)',
    border: 'rgba(56, 189, 248, 0.3)',
    glow: 'rgba(56, 189, 248, 0.15)',
    description: 'Baseline competency. Demonstrates rapid recognition on standard concepts.',
  },
  {
    name: 'CHALLENGER',
    range: '1150 – 1299',
    floor: 1150,
    next: 1300,
    color: '#00FF41',
    bg: 'rgba(0, 255, 65, 0.08)',
    border: 'rgba(0, 255, 65, 0.3)',
    glow: 'rgba(0, 255, 65, 0.15)',
    description: 'Competitive speed and strong consistency across multiple board subjects.',
  },
  {
    name: 'EXPERT',
    range: '1300 – 1449',
    floor: 1300,
    next: 1450,
    color: '#FFB800',
    bg: 'rgba(255, 184, 0, 0.08)',
    border: 'rgba(255, 184, 0, 0.3)',
    glow: 'rgba(255, 184, 0, 0.15)',
    description: 'High-velocity diagnosis and minimal error rate under strict time limits.',
  },
  {
    name: 'MASTER',
    range: '1450 – 1599',
    floor: 1450,
    next: 1600,
    color: '#C084FC',
    bg: 'rgba(192, 132, 252, 0.08)',
    border: 'rgba(192, 132, 252, 0.3)',
    glow: 'rgba(192, 132, 252, 0.15)',
    description: 'Elite PRC board exam caliber. Flawless recall across MATH, GEAS, ELECS, and EST.',
  },
  {
    name: 'LEGEND',
    range: '1600+',
    floor: 1600,
    next: null,
    color: '#FF3333',
    bg: 'rgba(255, 51, 51, 0.08)',
    border: 'rgba(255, 51, 51, 0.35)',
    glow: 'rgba(255, 51, 51, 0.25)',
    description: 'Pinnacle mastery. Unrivaled speed, precision, and arena endurance.',
  },
]

export const GauntletRanksModal: React.FC<GauntletRanksModalProps> = ({
  isOpen,
  onClose,
  overallRating,
  isProvisional,
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
          className="relative w-full max-w-xl max-h-[90vh] bg-[#0e0e0e] border border-border-base rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-base bg-[#141414]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Award size={18} />
              </div>
              <div>
                <h2 className="font-['Orbitron'] text-base sm:text-lg font-bold text-text-primary tracking-wide flex items-center gap-2">
                  ELO RANKING TIERS
                </h2>
                <p className="text-[11px] font-['Rajdhani'] font-semibold text-text-muted uppercase tracking-wider">
                  Arcade Skill Progression & Ratings
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

          {/* Body */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 show-scrollbar">
            {/* Player's Current Rank Card */}
            <div
              className="p-4 rounded-xl border flex flex-col gap-2.5"
              style={{
                backgroundColor: currentTierDef.bg,
                borderColor: currentTierDef.border,
                boxShadow: `0 0 20px ${currentTierDef.glow}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-['Rajdhani'] font-bold text-text-muted uppercase tracking-wider">
                    Your Current Rank
                  </span>
                  {isProvisional && (
                    <span className="text-[9px] font-['Rajdhani'] font-bold text-[#FFB800] bg-[#FFB800]/10 px-1.5 py-0.5 rounded border border-[#FFB800]/30 uppercase tracking-widest">
                      Provisional
                    </span>
                  )}
                </div>
                <span className="text-xs font-['JetBrains_Mono'] font-bold text-text-muted">
                  Overall Rating: <span className="text-white">{Math.round(overallRating)}</span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="font-['Orbitron'] text-xl sm:text-2xl font-black tracking-wider"
                    style={{ color: currentTierDef.color }}
                  >
                    {currentTierDef.name}
                  </span>
                  <span
                    className="text-[11px] font-['JetBrains_Mono'] px-2 py-0.5 rounded font-bold"
                    style={{
                      backgroundColor: `${currentTierDef.color}22`,
                      color: currentTierDef.color,
                    }}
                  >
                    {currentTierDef.range} ELO
                  </span>
                </div>

                {pointsToNext !== null && currentTierInfo.next !== null && (
                  <div className="text-right">
                    <span className="text-[11px] font-['Rajdhani'] font-semibold text-text-muted block">
                      Next Tier in
                    </span>
                    <span className="text-xs font-['JetBrains_Mono'] font-bold text-white">
                      +{pointsToNext} pts
                    </span>
                  </div>
                )}
              </div>

              {/* Progress bar to next tier */}
              {currentTierInfo.next !== null && (
                <div className="space-y-1 mt-1">
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
                  <div className="flex justify-between text-[9px] font-['JetBrains_Mono'] text-text-muted">
                    <span>{currentTierInfo.floor}</span>
                    <span>{progressPercent}%</span>
                    <span>{currentTierInfo.next}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Ranking Tiers Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-['Rajdhani'] font-bold text-text-muted uppercase tracking-wider block">
                All Rating Brackets
              </span>
              <div className="space-y-2">
                {TIERS.map(tier => {
                  const isCurrent = tier.name === currentTierInfo.name
                  return (
                    <div
                      key={tier.name}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-[#181818] border-accent/40 shadow-[0_0_15px_rgba(0,255,65,0.08)]'
                          : 'bg-[#121212] border-[#222] hover:border-[#333]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: tier.color,
                            boxShadow: isCurrent ? `0 0 8px ${tier.color}` : 'none',
                          }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-['Orbitron'] font-bold text-xs sm:text-sm tracking-wider"
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
                          <p className="text-[11px] text-text-muted truncate mt-0.5 font-['JetBrains_Mono']">
                            {tier.description}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="font-['JetBrains_Mono'] font-bold text-xs sm:text-sm text-white block">
                          {tier.range}
                        </span>
                        <span className="text-[9px] font-['Rajdhani'] text-text-muted uppercase tracking-wider">
                          Rating
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* PRC TOS Calculation Note */}
            <div className="p-3 rounded-xl bg-[#141414] border border-[#222] text-[11px] font-['JetBrains_Mono'] text-text-muted leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 text-text-primary font-bold">
                <Shield size={13} className="text-accent" />
                <span>PRC Board Exam TOS Weighting</span>
              </div>
              <p>
                Overall Elo is calculated as a weighted average across all 4 subjects according to the official PRC ECE Table of Specifications:
              </p>
              <div className="flex flex-wrap gap-2 pt-1 font-semibold">
                <span className="px-1.5 py-0.5 rounded bg-[#1e1e1e] text-white">MATH: 20%</span>
                <span className="px-1.5 py-0.5 rounded bg-[#1e1e1e] text-white">GEAS: 20%</span>
                <span className="px-1.5 py-0.5 rounded bg-[#1e1e1e] text-white">ELECS: 30%</span>
                <span className="px-1.5 py-0.5 rounded bg-[#1e1e1e] text-white">EST: 30%</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
