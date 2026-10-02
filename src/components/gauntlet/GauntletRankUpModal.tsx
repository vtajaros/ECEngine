import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Award, Sparkles, ChevronRight, ArrowRight } from 'lucide-react'
import { type RankUpEvent, TIER_COLORS } from '../../lib/gauntlet'
import { useSound } from '../../hooks/useSound'

interface GauntletRankUpModalProps {
  isOpen: boolean
  onClose: () => void
  event: RankUpEvent
}

export const GauntletRankUpModal: React.FC<GauntletRankUpModalProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  const { play } = useSound()
  const [animatedRating, setAnimatedRating] = useState(event.oldRating)
  const [animationDone, setAnimationDone] = useState(false)

  const newColor = TIER_COLORS[event.newTier.name] || '#00FF41'
  const oldColor = TIER_COLORS[event.oldTier.name] || '#FFFFFF'
  const ratingDelta = Math.round(event.newRating - event.oldRating)

  // Trigger celebration sound and animate XP / rating count-up
  useEffect(() => {
    if (!isOpen) return
    play('roundComplete')

    const duration = 1600 // ms
    const startTime = performance.now()
    const startVal = event.oldRating
    const endVal = event.newRating

    let frameId: number
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startVal + (endVal - startVal) * ease)
      setAnimatedRating(current)

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        setAnimationDone(true)
        play('plusOne')
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [isOpen, event.oldRating, event.newRating, play])

  // Keydown to dismiss
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Progress within tier: relative to new tier floor
  const floor = event.newTier.floor
  const nextFloor = event.newTier.next ?? (floor + 300)
  const tierProgress = Math.min(
    100,
    Math.max(0, ((animatedRating - floor) / (nextFloor - floor)) * 100),
  )

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        {/* Radial ambient glow matching new tier color */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25 blur-3xl transition-all duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${newColor} 0%, transparent 60%)`,
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative max-w-lg w-full bg-surface/95 border rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl overflow-hidden"
          style={{
            borderColor: `${newColor}66`,
            boxShadow: `0 0 50px ${newColor}33, inset 0 0 20px ${newColor}11`,
          }}
        >
          {/* Subtle Cyber Grid Accent */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

          {/* Top Label */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-['Rajdhani'] font-bold tracking-widest uppercase mb-4"
            style={{
              backgroundColor: `${newColor}15`,
              color: newColor,
              border: `1px solid ${newColor}40`,
            }}
          >
            <Sparkles size={13} className="animate-spin-slow" />
            <span>Promotion Achieved {event.subject ? `· ${event.subject}` : '· Overall'}</span>
          </motion.div>

          {/* Central Emblem & Transition */}
          <div className="flex items-center justify-center gap-3 sm:gap-6 my-2 relative z-10">
            {/* Old Rank Badge */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 0.6, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center border bg-surface-2/60"
                style={{ borderColor: `${oldColor}40` }}
              >
                <Zap size={26} style={{ color: oldColor }} />
              </div>
              <span className="text-[10px] font-['Orbitron'] font-bold tracking-wider text-text-muted uppercase">
                {event.oldTier.name}
              </span>
            </motion.div>

            {/* Ascending Arrow */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.35, type: 'spring' }}
              className="flex items-center justify-center text-text-muted"
            >
              <ArrowRight size={22} style={{ color: newColor }} />
            </motion.div>

            {/* New Rank Badge with Pulsing Ring */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45, type: 'spring', stiffness: 260 }}
              className="flex flex-col items-center gap-1 relative"
            >
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center border relative shadow-lg"
                style={{
                  backgroundColor: `${newColor}18`,
                  borderColor: newColor,
                  boxShadow: `0 0 25px ${newColor}55`,
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2 }}
                >
                  <Award size={42} style={{ color: newColor }} />
                </motion.div>
                {/* Glow ring */}
                <div
                  className="absolute inset-0 rounded-2xl animate-ping opacity-25 pointer-events-none"
                  style={{ borderColor: newColor, borderWidth: '2px' }}
                />
              </div>
              <span
                className="text-xs sm:text-sm font-['Orbitron'] font-bold tracking-wider uppercase mt-1"
                style={{ color: newColor, textShadow: `0 0 10px ${newColor}66` }}
              >
                {event.newTier.name}
              </span>
            </motion.div>
          </div>

          {/* Rank Title & Banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-3 relative z-10"
          >
            <h1
              className="text-2xl sm:text-3xl font-['Orbitron'] font-black uppercase tracking-wider"
              style={{ color: newColor, textShadow: `0 0 16px ${newColor}44` }}
            >
              RANK UP!
            </h1>
            <p className="text-xs sm:text-sm text-text-muted font-['Rajdhani'] font-medium max-w-sm mt-1">
              You have broken through the resistance threshold and ascended to the{' '}
              <strong style={{ color: newColor }}>{event.newTier.name}</strong> tier!
            </p>
          </motion.div>

          {/* Animated XP & Rating Gain Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="w-full bg-surface-2/80 border border-border-base/80 rounded-xl p-3.5 sm:p-4 my-4 relative z-10 flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between text-xs font-['JetBrains_Mono']">
              <span className="text-text-muted uppercase tracking-wider">Rating Progression</span>
              <span className="font-bold text-[#00FF41]">
                +{ratingDelta} Elo Gained
              </span>
            </div>

            {/* Big Live Animated Number Counter */}
            <div className="flex items-baseline justify-center gap-2">
              <span
                className="font-['Orbitron'] font-black text-3xl sm:text-4xl tracking-tight transition-all"
                style={{ color: newColor }}
              >
                {animatedRating}
              </span>
              <span className="text-xs font-['JetBrains_Mono'] text-text-muted">
                / {nextFloor} Max
              </span>
            </div>

            {/* Animated XP Progress Bar */}
            <div className="w-full bg-surface rounded-full h-2.5 overflow-hidden border border-border-base relative">
              <motion.div
                className="h-full rounded-full transition-all duration-300 relative"
                style={{
                  width: `${tierProgress}%`,
                  backgroundColor: newColor,
                  boxShadow: `0 0 10px ${newColor}`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-['JetBrains_Mono'] text-text-muted">
              <span>Tier Floor: {floor}</span>
              <span>Next Tier: {nextFloor}</span>
            </div>
          </motion.div>

          {/* Action CTA */}
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl font-['Rajdhani'] font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer mt-1"
            style={{
              backgroundColor: newColor,
              color: event.newTier.name === 'INSULATOR' || event.newTier.name === 'SILVER' ? '#000000' : '#040707',
              boxShadow: `0 0 20px ${newColor}66`,
            }}
          >
            <span>Continue to Debrief</span>
            <ChevronRight size={16} />
          </motion.button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
