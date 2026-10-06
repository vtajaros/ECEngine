import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy,
  ArrowLeft,
  RotateCcw,
  AlertCircle,
  Check,
  Sparkles,
  Bookmark,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  HelpCircle,
  Flame,
  Zap,
  BookOpen,
  Clock,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'
import { GetContextDropdown } from '../ui/GetContextDropdown'
import { renderMath } from '../../lib/latex'
import { formatTosBadge } from '../../lib/tosClassification'
import { getSubjectBadgeClasses, SUBJECT_MAP } from '../../lib/subjectColors'
import { getFrontText, getCorrectAnswer } from './StudyCard'
import type { Card, MCQData, FlashcardData, FormulaData } from '../../types'

export interface CardGradeInfo {
  rating: number | null // 1: Again, 2: Hard, 3: Good, 4: Easy, null: Skipped
  writtenAnswer?: string
  writtenCorrect?: boolean | null
  interval?: number
  easeFactor?: number
  repetitions?: number
  nextReview?: string | null
}

export interface FlashcardReviewSummaryProps {
  deckTitle: string
  deckSubject?: string
  deckId: string
  cards: Card[]
  cardGrades: Record<string, CardGradeInfo>
  swapTermDef?: boolean
  bookmarks: Set<string>
  onToggleBookmark: (cardId: string) => void
  onStudyAgain: () => void
  onDrillWeakCards?: (weakCardIds: string[]) => void
  onDone: () => void
}

function getExplanation(card: Card): { text?: string; imagePath?: string } | null {
  if (card.type === 'mcq') {
    const mcq = card.data as MCQData
    return mcq.explanation ? { text: mcq.explanation, imagePath: (mcq as any).solutionImagePath } : null
  }
  if (card.type === 'flashcard') {
    const fc = card.data as FlashcardData
    return fc.explanation || fc.explanationImagePath
      ? { text: fc.explanation, imagePath: fc.explanationImagePath }
      : null
  }
  if (card.type === 'formula') {
    const f = card.data as FormulaData
    return f.explanation || f.explanationImagePath
      ? { text: f.explanation, imagePath: f.explanationImagePath }
      : null
  }
  return null
}

const RATING_CONFIG = {
  1: {
    label: 'Again',
    sub: '< 1m',
    desc: 'Repeat shortly',
    color: '#FF3333',
    bg: 'rgba(255, 51, 51, 0.12)',
    border: 'rgba(255, 51, 51, 0.4)',
    icon: RotateCcw,
  },
  2: {
    label: 'Hard',
    sub: '~5m',
    desc: 'Review in ~5m',
    color: '#FFB800',
    bg: 'rgba(255, 184, 0, 0.12)',
    border: 'rgba(255, 184, 0, 0.4)',
    icon: AlertCircle,
  },
  3: {
    label: 'Good',
    sub: '~10m',
    desc: 'Scheduled in ~10m',
    color: '#00FF41',
    bg: 'rgba(0, 255, 65, 0.12)',
    border: 'rgba(0, 255, 65, 0.4)',
    icon: Check,
  },
  4: {
    label: 'Easy',
    sub: '4d+',
    desc: 'Scheduled in 4d+',
    color: '#00BFFF',
    bg: 'rgba(0, 191, 255, 0.12)',
    border: 'rgba(0, 191, 255, 0.4)',
    icon: Sparkles,
  },
} as const

export function FlashcardReviewSummary({
  deckTitle,
  deckSubject,
  deckId,
  cards,
  cardGrades,
  swapTermDef = false,
  bookmarks,
  onToggleBookmark,
  onStudyAgain,
  onDrillWeakCards,
  onDone,
}: FlashcardReviewSummaryProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | '1' | '2' | '3' | '4' | 'skipped' | 'bookmarked'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set())
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Compute session statistics
  const stats = useMemo(() => {
    let again = 0
    let hard = 0
    let good = 0
    let easy = 0
    let skipped = 0

    cards.forEach((card) => {
      const g = cardGrades[card.id]
      if (!g || g.rating === null || g.rating === undefined) {
        skipped++
      } else if (g.rating === 1) {
        again++
      } else if (g.rating === 2) {
        hard++
      } else if (g.rating === 3) {
        good++
      } else if (g.rating === 4) {
        easy++
      } else {
        skipped++
      }
    })

    const totalRated = again + hard + good + easy
    const successCount = good + easy
    const retentionRate = totalRated > 0 ? Math.round((successCount / totalRated) * 100) : 0
    const weakCardIds = cards
      .filter((c) => {
        const r = cardGrades[c.id]?.rating
        return r === 1 || r === 2
      })
      .map((c) => c.id)

    return {
      again,
      hard,
      good,
      easy,
      skipped,
      total: cards.length,
      totalRated,
      retentionRate,
      weakCardIds,
    }
  }, [cards, cardGrades])

  // Filtered card list
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const g = cardGrades[card.id]
      const rating = g?.rating

      // Rating filter
      if (activeFilter === '1' && rating !== 1) return false
      if (activeFilter === '2' && rating !== 2) return false
      if (activeFilter === '3' && rating !== 3) return false
      if (activeFilter === '4' && rating !== 4) return false
      if (activeFilter === 'skipped' && rating !== null && rating !== undefined) return false
      if (activeFilter === 'bookmarked' && !bookmarks.has(`fc_bookmark_${card.id}`)) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const front = getFrontText(card, swapTermDef).toLowerCase()
        const back = getCorrectAnswer(card, swapTermDef).toLowerCase()
        if (!front.includes(q) && !back.includes(q)) return false
      }

      return true
    })
  }, [cards, cardGrades, activeFilter, searchQuery, bookmarks, swapTermDef])

  const toggleExpand = (cardId: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') {
        if (zoomedImage) {
          setZoomedImage(null)
          return
        }
        onDone()
      }
      if (e.key === 'r' || e.key === 'R') {
        onStudyAgain()
      }
      if ((e.key === 'w' || e.key === 'W') && stats.weakCardIds.length > 0 && onDrillWeakCards) {
        onDrillWeakCards(stats.weakCardIds)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomedImage, onDone, onStudyAgain, stats.weakCardIds, onDrillWeakCards])

  // Lightbox scroll lock
  useEffect(() => {
    if (zoomedImage) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [zoomedImage])

  return (
    <div className="h-full bg-transparent flex flex-col overflow-hidden relative font-['Rajdhani']">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#111] border-b border-border-base px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onDone}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#333] hover:border-accent hover:text-accent text-text-muted transition-colors text-xs uppercase tracking-widest font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Decks
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-['Orbitron'] font-bold text-sm tracking-widest uppercase text-accent">
                Session Review Summary
              </span>
              {deckSubject && (
                <span
                  className={`text-[10px] font-['JetBrains_Mono'] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${getSubjectBadgeClasses(
                    deckSubject
                  )}`}
                >
                  {deckSubject}
                </span>
              )}
            </div>
            <h1 className="text-base text-text-primary font-bold tracking-wide truncate max-w-[400px] lg:max-w-[600px]">
              {deckTitle}
            </h1>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-3">
          {stats.weakCardIds.length > 0 && onDrillWeakCards && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onDrillWeakCards(stats.weakCardIds)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-[rgba(255,184,0,0.15)] text-[#FFB800] border border-[#FFB800] hover:bg-[rgba(255,184,0,0.25)] shadow-[0_0_12px_rgba(255,184,0,0.2)] transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Drill Missed & Hard ({stats.weakCardIds.length})
            </motion.button>
          )}

          <button
            onClick={onStudyAgain}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-[#181818] text-text-primary border border-[#333] hover:border-accent hover:text-accent transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Study All Again
          </button>

          <button
            onClick={onDone}
            className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-widest bg-accent text-black border border-accent hover:bg-[rgba(0,255,65,0.85)] shadow-[0_0_15px_rgba(0,255,65,0.25)] transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* ── Scrollable Body ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar max-w-6xl w-full mx-auto flex flex-col gap-6">
        {/* Banner: Overall Retention & Spaced Repetition Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-r from-[#141414] via-[#121812] to-[#141414] border border-border-base rounded-xl p-5 shadow-2xl relative overflow-hidden flex flex-col gap-4"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(0,255,65,0.2)]">
                <Trophy className="w-6 h-6 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-['Orbitron'] font-bold text-lg tracking-wider text-text-primary uppercase">
                    Deck Session Complete!
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent font-['JetBrains_Mono'] font-bold border border-accent/40">
                    {stats.retentionRate}% Retention
                  </span>
                </div>
                <p className="text-text-muted text-sm font-['Rajdhani'] font-semibold">
                  You graded <span className="text-text-primary font-bold">{stats.totalRated}</span> of{' '}
                  <span className="text-text-primary font-bold">{stats.total}</span> cards. Intervals and next reviews
                  have been updated.
                </p>
              </div>
            </div>

            {/* Quick retention badge pill */}
            <div className="flex items-center gap-3">
              <div className="bg-[#111] border border-[#2a2a2a] px-4 py-2 rounded-lg text-right">
                <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest font-['JetBrains_Mono']">
                  Recalled (Good / Easy)
                </div>
                <div className="text-accent font-bold text-lg font-['Orbitron']">
                  {stats.good + stats.easy} <span className="text-xs text-text-muted">/ {stats.total}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Spaced Repetition Multi-Color Distribution Bar */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-[#222]">
            <div className="flex items-center justify-between text-xs text-text-muted font-['JetBrains_Mono']">
              <span>SM-2 Grade Distribution</span>
              <span className="text-text-primary">
                Again: {stats.again} • Hard: {stats.hard} • Good: {stats.good} • Easy: {stats.easy}
                {stats.skipped > 0 ? ` • Skipped: ${stats.skipped}` : ''}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#181818] border border-[#2a2a2a] flex overflow-hidden">
              {stats.again > 0 && (
                <div
                  style={{ width: `${(stats.again / stats.total) * 100}%`, backgroundColor: '#FF3333' }}
                  title={`Again: ${stats.again}`}
                />
              )}
              {stats.hard > 0 && (
                <div
                  style={{ width: `${(stats.hard / stats.total) * 100}%`, backgroundColor: '#FFB800' }}
                  title={`Hard: ${stats.hard}`}
                />
              )}
              {stats.good > 0 && (
                <div
                  style={{ width: `${(stats.good / stats.total) * 100}%`, backgroundColor: '#00FF41' }}
                  title={`Good: ${stats.good}`}
                />
              )}
              {stats.easy > 0 && (
                <div
                  style={{ width: `${(stats.easy / stats.total) * 100}%`, backgroundColor: '#00BFFF' }}
                  title={`Easy: ${stats.easy}`}
                />
              )}
              {stats.skipped > 0 && (
                <div
                  style={{ width: `${(stats.skipped / stats.total) * 100}%`, backgroundColor: '#444444' }}
                  title={`Skipped: ${stats.skipped}`}
                />
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Interactive Grade Metric Cards (Click to filter!) ────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {([1, 2, 3, 4] as const).map((grade) => {
            const conf = RATING_CONFIG[grade]
            const Icon = conf.icon
            const count =
              grade === 1 ? stats.again : grade === 2 ? stats.hard : grade === 3 ? stats.good : stats.easy
            const isSelected = activeFilter === String(grade)

            return (
              <motion.button
                key={grade}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveFilter(activeFilter === String(grade) ? 'all' : (String(grade) as any))}
                className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected ? 'ring-2 shadow-lg' : 'hover:border-[#555]'
                }`}
                style={{
                  backgroundColor: isSelected ? conf.bg : '#121212',
                  borderColor: isSelected ? conf.color : '#262626',
                  boxShadow: isSelected ? `0 0 0 2px ${conf.color}, 0 0 16px ${conf.color}30` : undefined,
                }}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <span
                    className="font-['Orbitron'] font-bold text-sm tracking-wider uppercase flex items-center gap-1.5"
                    style={{ color: conf.color }}
                  >
                    <Icon className="w-4 h-4" /> {conf.label} ({grade})
                  </span>
                  <span
                    className="font-['JetBrains_Mono'] text-2xl font-bold"
                    style={{ color: count > 0 ? conf.color : '#555' }}
                  >
                    {count}
                  </span>
                </div>
                <div className="text-xs font-['JetBrains_Mono'] text-text-muted mb-0.5">{conf.sub}</div>
                <div className="text-[11px] text-[#888] font-semibold">{conf.desc}</div>
                {isSelected && (
                  <div
                    className="absolute top-1 right-2 text-[10px] font-bold uppercase tracking-wider font-['JetBrains_Mono']"
                    style={{ color: conf.color }}
                  >
                    Filtered
                  </div>
                )}
              </motion.button>
            )
          })}
        </div>

        {/* ── Card Review List Controls (Filter tabs & Search) ──── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                activeFilter === 'all'
                  ? 'bg-accent text-black border-accent'
                  : 'bg-[#141414] text-text-muted border-[#2a2a2a] hover:border-[#444] hover:text-text-primary'
              }`}
            >
              All Cards ({cards.length})
            </button>
            <button
              onClick={() => setActiveFilter('1')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                activeFilter === '1'
                  ? 'bg-danger text-white border-danger'
                  : 'bg-[#141414] text-text-muted border-[#2a2a2a] hover:border-danger/50 hover:text-danger'
              }`}
            >
              Again ({stats.again})
            </button>
            <button
              onClick={() => setActiveFilter('2')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                activeFilter === '2'
                  ? 'bg-warn text-black border-warn'
                  : 'bg-[#141414] text-text-muted border-[#2a2a2a] hover:border-warn/50 hover:text-warn'
              }`}
            >
              Hard ({stats.hard})
            </button>
            <button
              onClick={() => setActiveFilter('3')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                activeFilter === '3'
                  ? 'bg-[#00FF41] text-black border-[#00FF41]'
                  : 'bg-[#141414] text-text-muted border-[#2a2a2a] hover:border-[#00FF41]/50 hover:text-[#00FF41]'
              }`}
            >
              Good ({stats.good})
            </button>
            <button
              onClick={() => setActiveFilter('4')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                activeFilter === '4'
                  ? 'bg-[#00BFFF] text-black border-[#00BFFF]'
                  : 'bg-[#141414] text-text-muted border-[#2a2a2a] hover:border-[#00BFFF]/50 hover:text-[#00BFFF]'
              }`}
            >
              Easy ({stats.easy})
            </button>
            {stats.skipped > 0 && (
              <button
                onClick={() => setActiveFilter('skipped')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                  activeFilter === 'skipped'
                    ? 'bg-[#555] text-white border-[#666]'
                    : 'bg-[#141414] text-text-muted border-[#2a2a2a] hover:border-[#555]'
                }`}
              >
                Skipped ({stats.skipped})
              </button>
            )}
            <button
              onClick={() => setActiveFilter('bookmarked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 transition-colors ${
                activeFilter === 'bookmarked'
                  ? 'bg-accent/20 text-accent border-accent'
                  : 'bg-[#141414] text-text-muted border-[#2a2a2a] hover:border-accent/40'
              }`}
            >
              <Bookmark className="w-3 h-3" /> Bookmarked
            </button>
          </div>

          {/* Search bar */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by term or definition..."
              className="w-full bg-[#111] border border-[#2a2a2a] focus:border-accent rounded-lg pl-9 pr-8 py-1.5 text-xs font-['JetBrains_Mono'] text-text-primary placeholder-[#555] outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#666] hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Card-by-Card List ─────────────────────────────────── */}
        <div className="flex flex-col gap-3 pb-8">
          {filteredCards.length === 0 ? (
            <div className="bg-[#121212] border border-[#262626] rounded-xl p-10 text-center flex flex-col items-center justify-center gap-2">
              <Layers className="w-8 h-8 text-text-muted opacity-40 mb-1" />
              <p className="text-text-muted font-bold text-sm uppercase tracking-wider">
                No cards match the selected filter
              </p>
              <button
                onClick={() => {
                  setActiveFilter('all')
                  setSearchQuery('')
                }}
                className="mt-2 text-xs text-accent underline tracking-widest uppercase font-bold"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredCards.map((card, idx) => {
              const originalIndex = cards.findIndex((c) => c.id === card.id)
              const cardNum = originalIndex >= 0 ? originalIndex + 1 : idx + 1
              const gradeInfo = cardGrades[card.id]
              const rating = gradeInfo?.rating
              const isBookmarked = bookmarks.has(`fc_bookmark_${card.id}`)
              const frontText = getFrontText(card, swapTermDef)
              const backText = getCorrectAnswer(card, swapTermDef)
              const explanation = getExplanation(card)
              const isExpanded = expandedCardIds.has(card.id)

              const frontImg = (card.data as any)?.imagePathFront || (card.data as any)?.imagePath
              const backImg = (card.data as any)?.imageBack

              const ratingConfig =
                rating === 1 || rating === 2 || rating === 3 || rating === 4 ? RATING_CONFIG[rating] : null

              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                  className="bg-[#121212] border border-[#262626] hover:border-[#383838] rounded-xl p-4 flex flex-col gap-3 transition-colors shadow-sm"
                >
                  {/* Row Header */}
                  <div className="flex items-center justify-between gap-3 border-b border-[#1f1f1f] pb-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <span className="font-['Orbitron'] font-bold text-xs text-text-muted tracking-wider">
                        #{cardNum}
                      </span>

                      {/* Prominent Grade Badge */}
                      {ratingConfig ? (
                        <div
                          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border shadow-sm"
                          style={{
                            color: ratingConfig.color,
                            backgroundColor: ratingConfig.bg,
                            borderColor: ratingConfig.border,
                          }}
                        >
                          <ratingConfig.icon className="w-3.5 h-3.5" />
                          <span>{ratingConfig.label}</span>
                          <span className="font-['JetBrains_Mono'] opacity-70">({rating})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-[#222] text-[#888] border border-[#333]">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Skipped</span>
                        </div>
                      )}

                      {/* Next Review & SM-2 interval details */}
                      {gradeInfo && gradeInfo.interval !== undefined && (
                        <span className="text-[11px] font-['JetBrains_Mono'] text-text-muted bg-[#181818] border border-[#2a2a2a] px-2.5 py-0.5 rounded">
                          {gradeInfo.interval === 1
                            ? 'Interval: 1 day'
                            : `Interval: ${gradeInfo.interval} days`}
                          {gradeInfo.repetitions !== undefined ? ` • Rep: ${gradeInfo.repetitions}` : ''}
                          {gradeInfo.easeFactor !== undefined
                            ? ` • EF: ${gradeInfo.easeFactor.toFixed(2)}`
                            : ''}
                          {gradeInfo.nextReview ? ` • Due: ${gradeInfo.nextReview}` : ''}
                        </span>
                      )}

                      {card.tosTopicId && (
                        <span className="text-[10px] font-['JetBrains_Mono'] font-bold text-accent bg-[#181818] border border-accent/30 px-2 py-0.5 rounded">
                          {formatTosBadge(card.tosTopicId) || card.tosTopicId}
                        </span>
                      )}
                    </div>

                    {/* Bookmark and Get Context */}
                    <div className="flex items-center gap-2">
                      <GetContextDropdown
                        size="sm"
                        align="right"
                        direction="down"
                        contextData={{
                          front: frontText,
                          back: backText,
                          explanation: explanation?.text,
                          subject: (card as any).subject || deckSubject || null,
                          tosTopicId: card.tosTopicId,
                          deckName: deckTitle,
                          cardNumber: cardNum,
                          totalInDeck: cards.length,
                          image: frontImg,
                          solutionImage: backImg || explanation?.imagePath,
                        }}
                        onCopied={(_type, msg) => {
                          setToastMessage(msg)
                          setTimeout(() => setToastMessage(null), 3000)
                        }}
                      />

                      <Tooltip content={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'} position="top">
                        <button
                          aria-label={isBookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
                          onClick={() => onToggleBookmark(card.id)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isBookmarked
                              ? 'bg-accent/15 border-accent text-accent'
                              : 'bg-[#181818] border-[#333] text-[#666] hover:text-accent hover:border-accent'
                          }`}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-accent' : ''}`} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Card Content Split: Front (Term) & Back (Definition) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Front */}
                    <div className="bg-[#161616] border border-[#242424] rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[10px] font-['Orbitron'] font-bold uppercase tracking-wider text-text-muted">
                        <span>{swapTermDef ? 'Definition (Prompt)' : 'Term (Prompt)'}</span>
                      </div>
                      <div
                        className="text-text-primary text-sm font-semibold leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMath(frontText) }}
                      />
                      {frontImg && (
                        <div className="mt-1 flex justify-start">
                          <img
                            src={`ece-app://${frontImg}`}
                            alt="Front diagram"
                            className="max-h-24 object-contain rounded border border-[#333] hover:border-accent cursor-zoom-in"
                            onClick={() => setZoomedImage(frontImg)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Back */}
                    <div className="bg-[#161616] border border-[#242424] rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[10px] font-['Orbitron'] font-bold uppercase tracking-wider text-accent/80">
                        <span>{swapTermDef ? 'Term (Answer)' : 'Definition (Answer)'}</span>
                      </div>
                      <div
                        className="text-text-primary text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMath(backText) }}
                      />
                      {backImg && (
                        <div className="mt-1 flex justify-start">
                          <img
                            src={`ece-app://${backImg}`}
                            alt="Back diagram"
                            className="max-h-24 object-contain rounded border border-[#333] hover:border-accent cursor-zoom-in"
                            onClick={() => setZoomedImage(backImg)}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Written mode answer if user used written mode on this card */}
                  {gradeInfo?.writtenAnswer !== undefined && (
                    <div
                      className={`px-3 py-2 rounded-lg border text-xs font-['JetBrains_Mono'] flex items-center justify-between gap-3 ${
                        gradeInfo.writtenCorrect
                          ? 'bg-[rgba(0,255,65,0.08)] border-[#00FF41]/30 text-accent'
                          : 'bg-[rgba(255,51,51,0.08)] border-danger/30 text-danger'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">Your Written Answer:</span>
                        <span className="text-text-primary">"{gradeInfo.writtenAnswer}"</span>
                      </div>
                      <span className="font-bold uppercase tracking-wider">
                        {gradeInfo.writtenCorrect ? 'Correct ✓' : 'Incorrect ✗'}
                      </span>
                    </div>
                  )}

                  {/* Explanation Collapsible */}
                  {explanation && (
                    <div className="border-t border-[#1c1c1c] pt-2">
                      <button
                        onClick={() => toggleExpand(card.id)}
                        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent font-bold uppercase tracking-wider transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {isExpanded ? 'Hide Explanation' : 'View Explanation'}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mt-2 bg-[#171717] border border-[#2a2a2a] rounded-lg p-3.5 flex flex-col gap-2"
                          >
                            {explanation.text && (
                              <div
                                className="text-xs text-text-primary leading-relaxed font-['JetBrains_Mono']"
                                dangerouslySetInnerHTML={{ __html: renderMath(explanation.text) }}
                              />
                            )}
                            {explanation.imagePath && (
                              <div className="mt-1 flex justify-start">
                                <img
                                  src={`ece-app://${explanation.imagePath}`}
                                  alt="Explanation diagram"
                                  className="max-h-36 object-contain rounded border border-[#333] hover:border-accent cursor-zoom-in"
                                  onClick={() => setZoomedImage(explanation.imagePath!)}
                                />
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Lightbox Modal for Diagram Images ─────────────────── */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 lg:p-10 cursor-zoom-out backdrop-blur-sm"
            onClick={() => setZoomedImage(null)}
          >
            <Tooltip content="Close (Esc)" position="left">
              <button
                className="absolute top-6 right-6 text-text-muted hover:text-accent transition-colors p-2 bg-[#111] rounded-full border border-[#333] hover:border-accent z-10"
                onClick={() => setZoomedImage(null)}
              >
                <X size={24} />
              </button>
            </Tooltip>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={`ece-app://${zoomedImage}`}
              alt="Zoomed diagram"
              className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Clipboard Toast ───────────────────────────────────── */}
      {toastMessage && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-surface border border-[#333] text-text-primary text-xs font-['Rajdhani'] uppercase tracking-widest px-5 py-3 rounded-lg shadow-2xl whitespace-nowrap">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
