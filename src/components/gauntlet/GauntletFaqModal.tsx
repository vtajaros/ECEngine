import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, X, ChevronDown, ShieldCheck, Zap, Award, Target, Flame, Layers, type LucideIcon } from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'

interface GauntletFaqModalProps {
  isOpen: boolean
  onClose: () => void
}

interface AccordionItem {
  id: string
  title: string
  icon: LucideIcon
  content: React.ReactNode
}

const FAQ_ITEMS: AccordionItem[] = [
  {
    id: 'about',
    title: 'What is Gauntlet Mode?',
    icon: Zap,
    content: (
      <div className="space-y-2 text-text-primary text-xs font-['JetBrains_Mono'] leading-relaxed">
        <p>
          Gauntlet is an arcade-style, high-intensity evaluation arena designed to build instant recall, test discipline, and rapid question diagnosis.
        </p>
        <p className="text-text-muted">
          Unlike standard practice sessions, Gauntlet runs are strictly timed or life-limited, scored in real-time, and tracked with Elo-style subject ratings.
        </p>
      </div>
    ),
  },
  {
    id: 'modes',
    title: 'Game Modes: Time Trial vs Survival',
    icon: Target,
    content: (
      <div className="space-y-3 text-text-primary text-xs font-['JetBrains_Mono'] leading-relaxed">
        <div className="p-2.5 rounded-lg bg-surface-2 border border-border-base">
          <span className="text-accent font-bold uppercase tracking-wider block font-['Orbitron'] text-[11px] mb-1">
            Time Trial
          </span>
          <p className="text-text-muted">
            Race against the session clock (<strong>5m</strong>, <strong>10m</strong>, <strong>25m</strong>, or <strong>1 hr</strong>). Choose between an <em>Unlimited Sprint</em> (continuous refill until time expires) or a <em>Fixed Question Target</em> (50, 100, 150 items with Even, TOS-weighted, or Custom allocation).
          </p>
        </div>
        <div className="p-2.5 rounded-lg bg-surface-2 border border-border-base">
          <span className="text-[#ef4444] font-bold uppercase tracking-wider block font-['Orbitron'] text-[11px] mb-1">
            Survival
          </span>
          <p className="text-text-muted">
            Test your endurance with <strong>3 Lives</strong>, <strong>5 Lives</strong>, or <strong>Unlimited Lives</strong> (casual practice). Each question has a per-question limit (<strong>30s</strong>, <strong>1 min</strong>, <strong>2 mins</strong>, or <strong>Unlimited</strong>).
          </p>
          <p className="text-[#00FF41] mt-1.5 font-semibold">
            ✦ Uncapped 1-Ups: Every 10 consecutive correct answers awards +1 bonus life with no ceiling!
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'topics',
    title: 'Topic Focus & Multi-Chapter Drilling',
    icon: Layers,
    content: (
      <div className="space-y-2 text-text-primary text-xs font-['JetBrains_Mono'] leading-relaxed">
        <p>
          Target specific areas of weakness by clicking <strong className="text-accent">Filter Topics</strong> in the setup screen.
        </p>
        <p className="text-text-muted">
          You can select multiple parent topics (e.g., DC Circuits, Electromagnetics) across any subjects, or enable the <em>Granular Subtopics</em> toggle for surgical subtopic drills. Focused runs scale Elo adjustments to <strong>0.4x</strong> to balance rating integrity.
        </p>
      </div>
    ),
  },
  {
    id: 'exclusions',
    title: 'Excluded Questions & Problem-Solving',
    icon: ShieldCheck,
    content: (
      <div className="space-y-2 text-text-primary text-xs font-['JetBrains_Mono'] leading-relaxed">
        <p>
          To maintain rapid arcade pacing, <strong className="text-[#FFB800]">problem-solving items and complex calculations are excluded</strong> from Gauntlet pools.
        </p>
        <p className="text-text-muted">
          Questions with image solutions or multi-minute calculation requirements remain in standard Test/Study modes. Pool sizes for each subject are displayed in the setup screen.
        </p>
      </div>
    ),
  },
  {
    id: 'scoring',
    title: 'Scoring Mechanics & Multipliers',
    icon: Flame,
    content: (
      <div className="space-y-2.5 text-text-primary text-xs font-['JetBrains_Mono'] leading-relaxed">
        <p>
          Every question has an estimated <strong className="text-text-primary">Par Time</strong> calculated from question length and numeric choices. Heavier questions have higher difficulty weights (0.8x to 1.3x).
        </p>
        <ul className="list-disc list-inside space-y-1 text-text-muted pl-1">
          <li>
            <strong className="text-accent">Speed Multiplier:</strong> Answers in &le; 0.5x par yield a max <strong>1.5x</strong> bonus; at par = <strong>1.0x</strong>; &ge; 1.5x par = <strong>0.5x</strong>.
          </li>
          <li>
            <strong className="text-[#00FF41]">Streak Milestones:</strong> +10% per consecutive correct answer, capping at <strong>1.5x</strong> (at streak 5). Milestone streak bonuses award <strong>+50 points</strong> upon reaching streak milestones.
          </li>
          <li>
            <strong className="text-[#ef4444]">Wrong Penalties:</strong> Base -50 / weight. Spam-clicking (answering wrong in &lt; 0.25x par) applies an extra <strong>1.5x penalty</strong>. Insulator tier enjoys a 50% softer penalty.
          </li>
          <li>
            <strong className="text-text-muted">Skips & Credits:</strong> Skipping consumes earned skip credits (earned every 20-streak).
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'ratings',
    title: 'Elo Ratings & Progression Tiers',
    icon: Award,
    content: (
      <div className="space-y-2.5 text-text-primary text-xs font-['JetBrains_Mono'] leading-relaxed">
        <p>
          Each subject begins at an initial rating of <strong className="text-accent">500</strong>.
        </p>
        <p className="text-text-muted">
          Ratings update after every answer on ranked runs using standard Elo curves adjusted for answer speed. Ratings remain <span className="text-[#FFB800] font-bold">PROVISIONAL</span> until 30 questions are answered in that subject.
        </p>
        <div className="p-2.5 rounded-lg bg-surface-2 border border-border-base space-y-1.5 text-[11px]">
          <span className="font-bold text-accent block uppercase font-['Orbitron'] text-[10px]">6 Progression Tiers:</span>
          <div className="grid grid-cols-2 gap-2 text-text-muted">
            <div><strong className="text-[#FFFFFF]">INSULATOR:</strong> 500 – 849</div>
            <div><strong className="text-[#F97316]">COPPER:</strong> 1500 – 1799</div>
            <div><strong className="text-[#38BDF8]">SEMICONDUCTOR:</strong> 850 – 1199</div>
            <div><strong className="text-[#E2E8F0]">SILVER:</strong> 1800 – 1999</div>
            <div><strong className="text-[#C084FC]">CONDUCTOR:</strong> 1200 – 1499</div>
            <div><strong className="text-[#00FF41]">SUPERCONDUCTOR:</strong> 2000+</div>
          </div>
        </div>
        <p className="text-text-muted">
          Your <strong className="text-text-primary">Overall Rating</strong> is computed using the official PRC ECE Table of Specifications weights: <strong>MATH (20%)</strong>, <strong>GEAS (20%)</strong>, <strong>ELECS (30%)</strong>, and <strong>EST (30%)</strong>.
        </p>
      </div>
    ),
  },
  {
    id: 'separation',
    title: 'Mastery Scores & SM-2 Protection',
    icon: ShieldCheck,
    content: (
      <div className="space-y-2 text-text-primary text-xs font-['JetBrains_Mono'] leading-relaxed">
        <p className="text-[#00FF41]">
          Gauntlet answers actively contribute to your question mastery and practice statistics!
        </p>
        <p className="text-text-muted">
          Correct answers log review counts and increase your overall card mastery scores.
        </p>
        <p className="text-text-muted">
          Crucially, your <strong className="text-text-primary">SM-2 spaced repetition intervals and ease factors are protected</strong>—mistakes made during high-speed Gauntlet rounds will never reset your study review intervals or disrupt your active SRS flashcard schedules.
        </p>
      </div>
    ),
  },
]

export const GauntletFaqModal: React.FC<GauntletFaqModalProps> = ({ isOpen, onClose }) => {
  const [openIds, setOpenIds] = useState<string[]>(['about'])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const toggleItem = (id: string) => {
    setOpenIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative w-full max-w-2xl bg-[#111] border border-border-base rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Top Accent line */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-accent to-transparent" />

            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border-base flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h3 className="font-['Orbitron'] font-bold text-base text-text-primary tracking-wider uppercase">
                    Gauntlet FAQ
                  </h3>
                  <p className="text-[11px] font-['Rajdhani'] text-text-muted uppercase tracking-wider">
                    Rules, Scoring, and Rating Standards
                  </p>
                </div>
              </div>

              <Tooltip content="Close (Esc)" position="left">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-surface border border-border-base hover:border-text-primary text-text-muted hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={18} />
                </button>
              </Tooltip>
            </div>

            {/* Scrollable Accordion Body */}
            <div className="p-4 sm:p-6 overflow-y-auto min-h-0 space-y-2.5">
              {FAQ_ITEMS.map(item => {
                const isExpanded = openIds.includes(item.id)
                const Icon = item.icon
                return (
                  <div
                    key={item.id}
                    className="border border-border-base rounded-xl overflow-hidden bg-surface transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-surface-2 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} className={isExpanded ? 'text-accent' : 'text-text-muted'} />
                        <span className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-wide">
                          {item.title}
                        </span>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-text-muted transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-accent' : ''
                        }`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3.5 pt-0 border-t border-border-base/50 mt-1">
                            {item.content}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border-base bg-surface-2/40 flex justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl bg-accent text-black font-['Orbitron'] font-bold text-xs uppercase tracking-wider hover:bg-[#00e63a] transition-all shadow-[0_0_15px_rgba(0,255,65,0.2)]"
              >
                Got It
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
