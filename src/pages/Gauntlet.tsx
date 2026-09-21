import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { useGauntletStore, selectCurrentItem } from '../store/useGauntletStore'
import { useLayoutStore } from '../store/useLayoutStore'
import { GauntletHome } from '../components/gauntlet/GauntletHome'
import { GauntletSetup } from '../components/gauntlet/GauntletSetup'
import { GauntletCountdown } from '../components/gauntlet/GauntletCountdown'
import { GauntletPauseModal } from '../components/gauntlet/GauntletPauseModal'
import { LeaveConfirmModal } from '../components/ui/LeaveConfirmModal'
import { ExplanationPanel } from '../components/ui/ExplanationPanel'
import { renderMath, renderPlainText } from '../lib/latex'
import { SUBJECT_LINE_COLOR } from '../lib/dashboardUtils'
import type { MCQData, Subject } from '../types'
import type { QueueItem } from '../store/useGauntletStore'
import { AnimatePresence } from 'framer-motion'
import Toast from '../components/ui/Toast'
import { useSound } from '../hooks/useSound'
import { useGauntletMusic, getTimedMusicRegion, getSurvivalMusicRegion } from '../hooks/useGauntletMusic'
import { VolumeControl } from '../components/ui/VolumeControl'
import {
  Timer,
  Heart,
  XCircle,
  SkipForward,
  Award,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  Home,
  X,
} from 'lucide-react'

// TEMP: replaced by GauntletPlay / GauntletSummary in Phase 2B-2 / 2B-3
interface RunPlaceholderProps {
  onOpenPause: () => void
  isModalOpen: boolean
}

interface RevealState {
  chosen: number | null
  correctIndex: number
  isWrong: boolean
  item: QueueItem
  mcq: MCQData
}

const RunPlaceholder: React.FC<RunPlaceholderProps> = ({ onOpenPause, isModalOpen }) => {
  const phase = useGauntletStore(s => s.phase)
  const config = useGauntletStore(s => s.config)
  const score = useGauntletStore(s => s.score)
  const streak = useGauntletStore(s => s.streak)
  const bestStreak = useGauntletStore(s => s.bestStreak)
  const livesLeft = useGauntletStore(s => s.livesLeft)
  const index = useGauntletStore(s => s.index)
  const queue = useGauntletStore(s => s.queue)
  const endsAt = useGauntletStore(s => s.endsAt)
  const questionShownAt = useGauntletStore(s => s.questionShownAt)
  const endReason = useGauntletStore(s => s.endReason)
  const savedRunId = useGauntletStore(s => s.savedRunId)
  const saveError = useGauntletStore(s => s.saveError)
  const rated = useGauntletStore(s => s.rated)
  const ratingsBefore = useGauntletStore(s => s.ratingsBefore)
  const ratings = useGauntletStore(s => s.ratings)
  const answers = useGauntletStore(s => s.answers)

  const answer = useGauntletStore(s => s.answer)
  const skip = useGauntletStore(s => s.skip)
  const extendLinger = useGauntletStore(s => s.extendLinger)
  const skipsAvailable = useGauntletStore(s => s.skipsAvailable)
  const startRun = useGauntletStore(s => s.startRun)
  const openSetup = useGauntletStore(s => s.openSetup)
  const backToHome = useGauntletStore(s => s.backToHome)
  const feedback = useGauntletStore(s => s.feedback)
  const { play } = useSound()
  const music = useGauntletMusic()

  const [now, setNow] = useState(Date.now())
  const [revealState, setRevealState] = useState<RevealState | null>(null)
  const [shakeWrong, setShakeWrong] = useState(false)
  const [pulseHeart, setPulseHeart] = useState(false)

  const isUnlimitedSurvival = config.mode === 'survival' && config.perQuestionSec === 0
  const timeRemainingSec =
    config.mode === 'timed'
      ? Math.max(0, Math.ceil(((endsAt ?? 0) - now) / 1000))
      : isUnlimitedSurvival
      ? Math.floor((now - questionShownAt) / 1000)
      : Math.max(0, Math.ceil((config.perQuestionSec * 1000 - (now - questionShownAt)) / 1000))

  // Summary review state (declared unconditionally at top of component)
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'wrong' | 'skipped_timeout' | 'correct'>('all')
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>('all')
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null)
  const [explainingSeq, setExplainingSeq] = useState<number | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  const handleGetContext = useCallback((mcq: MCQData) => {
    if (!mcq || !Array.isArray(mcq.choices)) return

    const template = `---
Please explain the correct answer to this multiple choice question:

QUESTION:
${mcq.question}

CHOICES:
A. ${mcq.choices[0] ?? ''}
B. ${mcq.choices[1] ?? ''}
C. ${mcq.choices[2] ?? ''}
D. ${mcq.choices[3] ?? ''}

CORRECT ANSWER: ${String.fromCharCode(65 + mcq.answer)}. ${mcq.choices[mcq.answer] ?? ''}

Please explain:
1. Why the correct answer is right
2. Why each of the other choices is wrong
3. Any relevant formula, law, or concept that applies
4. A memory tip or way to remember this for the board exam
---`

    navigator.clipboard.writeText(template).then(() => {
      setShowToast(true)
    })
  }, [])

  const lastSoundRef = useRef<string | null>(null)
  const lastTickSecRef = useRef<number | null>(null)

  // Reset tick ref when question index changes
  useEffect(() => {
    lastTickSecRef.current = null
  }, [index])

  // Play 'tick' sound once per integer second at 5, 4, 3, 2, 1 (not 0)
  useEffect(() => {
    if (phase !== 'playing' || revealState !== null || isModalOpen) {
      lastTickSecRef.current = null
      return
    }

    if (timeRemainingSec > 5) {
      lastTickSecRef.current = null
      return
    }

    if (timeRemainingSec >= 1 && timeRemainingSec <= 5) {
      if (lastTickSecRef.current !== timeRemainingSec) {
        lastTickSecRef.current = timeRemainingSec
        play('tick')
      }
    }
  }, [timeRemainingSec, phase, revealState, isModalOpen, play])

  // Play sounds on answer reveal and timeout
  useEffect(() => {
    if (!revealState) return
    const key = `reveal-${revealState.item.card.id}-${revealState.chosen}`
    if (lastSoundRef.current === key) return
    lastSoundRef.current = key

    if (revealState.chosen === null) {
      // Skipped: outcome 'skipped' plays no sound
      return
    }
    if (revealState.isWrong) {
      play('wrong')
    } else {
      play('correct')
    }
  }, [revealState, play])

  useEffect(() => {
    if (!feedback) return
    if (feedback.outcome === 'timeout') {
      const key = `timeout-${feedback.id}`
      if (lastSoundRef.current === key) return
      lastSoundRef.current = key
      play('wrong')
    }
  }, [feedback, play])

  // Adaptive background music regions based on run mode, progress, and summary
  useEffect(() => {
    if (phase === 'summary') {
      music.setState('combatOver')
      music.setLowHealth(false)
      return
    }

    if (phase !== 'playing') {
      music.setLowHealth(false)
      return
    }

    if (config.mode === 'timed') {
      const timeRemainingSec = Math.max(0, ((endsAt ?? 0) - now) / 1000)
      const targetRegion = getTimedMusicRegion(timeRemainingSec, config.durationSec)
      music.setState(targetRegion)
      music.setLowHealth(false)
    } else if (config.mode === 'survival') {
      const targetRegion = getSurvivalMusicRegion(livesLeft, config.lives)
      music.setState(targetRegion)
      music.setLowHealth(livesLeft === 1)
    }
  }, [phase, config.mode, config.durationSec, config.lives, endsAt, now, livesLeft, music])

  const lingerTimerRef = useRef<NodeJS.Timeout | null>(null)
  const shakeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const heartTimerRef = useRef<NodeJS.Timeout | null>(null)
  const prevLivesRef = useRef(livesLeft)

  // Pulse heart on life loss
  useEffect(() => {
    if (prevLivesRef.current > livesLeft) {
      setPulseHeart(true)
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current)
      heartTimerRef.current = setTimeout(() => setPulseHeart(false), 400)
    }
    prevLivesRef.current = livesLeft
  }, [livesLeft])

  // Drive the clock and re-render countdown
  useEffect(() => {
    if (phase !== 'playing') return
    const intervalId = setInterval(() => {
      const curNow = Date.now()
      setNow(curNow)
      const s = useGauntletStore.getState()
      if (s.phase !== 'playing' || s.pausedAt !== null) return
      // Freeze clock / timeouts while reveal linger is active
      if (revealState !== null) return

      if (s.config.mode === 'timed') {
        if (s.endsAt !== null && curNow >= s.endsAt) {
          s.expire()
        }
      } else if (s.config.mode === 'survival') {
        if (s.config.perQuestionSec > 0 && curNow - s.questionShownAt >= s.config.perQuestionSec * 1000) {
          s.timeoutCurrent()
        }
      }
    }, 250)
    return () => clearInterval(intervalId)
  }, [phase, revealState])

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
      if (heartTimerRef.current) clearTimeout(heartTimerRef.current)
    }
  }, [])

  // Handle answering choice with 800ms reveal linger
  const handleAnswer = useCallback(
    (choiceIdx: number) => {
      if (revealState !== null || isModalOpen) return
      const s = useGauntletStore.getState()
      if (s.phase !== 'playing' || s.pausedAt !== null) return
      const item = s.queue[s.index]
      if (!item) return
      const mcq = item.card.data as MCQData
      const isCorrect = choiceIdx === mcq.answer
      const isWrong = !isCorrect

      // Extend timer deadlines by 800ms so linger consumes zero run time
      extendLinger(800)

      setRevealState({
        chosen: choiceIdx,
        correctIndex: mcq.answer,
        isWrong,
        item,
        mcq,
      })

      if (isWrong) {
        setShakeWrong(true)
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
        shakeTimerRef.current = setTimeout(() => setShakeWrong(false), 350)

        if (s.config.mode === 'survival') {
          setPulseHeart(true)
          if (heartTimerRef.current) clearTimeout(heartTimerRef.current)
          heartTimerRef.current = setTimeout(() => setPulseHeart(false), 400)
        }
      }

      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
      lingerTimerRef.current = setTimeout(() => {
        setRevealState(null)
        setShakeWrong(false)
        answer(choiceIdx)
      }, 800)
    },
    [revealState, isModalOpen, extendLinger, answer],
  )

  // Handle skip with 800ms reveal linger
  const handleSkip = useCallback(() => {
    if (revealState !== null || isModalOpen) return
    const s = useGauntletStore.getState()
    if (s.phase !== 'playing' || s.pausedAt !== null || s.skipsAvailable <= 0) return
    const item = s.queue[s.index]
    if (!item) return
    const mcq = item.card.data as MCQData

    // Extend timer deadlines by 800ms
    extendLinger(800)

    setRevealState({
      chosen: null,
      correctIndex: mcq.answer,
      isWrong: false,
      item,
      mcq,
    })

    if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current)
    lingerTimerRef.current = setTimeout(() => {
      setRevealState(null)
      skip()
    }, 800)
  }, [revealState, isModalOpen, extendLinger, skip])

  // Keyboard shortcuts 1-4 and A-D
  useEffect(() => {
    if (phase !== 'playing' || isModalOpen || revealState !== null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toUpperCase()
      let choiceIdx: number | null = null
      if (key === 'A' || key === '1') choiceIdx = 0
      else if (key === 'B' || key === '2') choiceIdx = 1
      else if (key === 'C' || key === '3') choiceIdx = 2
      else if (key === 'D' || key === '4') choiceIdx = 3

      if (choiceIdx !== null) {
        const s = useGauntletStore.getState()
        const item = s.queue[s.index]
        const mcq = item?.card.data as MCQData | undefined
        if (mcq && Array.isArray(mcq.choices) && choiceIdx < mcq.choices.length) {
          e.preventDefault()
          handleAnswer(choiceIdx)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, isModalOpen, revealState, handleAnswer])

  if (phase === 'summary') {
    const reasonLabels = {
      time: 'Time Expired',
      lives: 'Game Over',
      queue: 'Queue Completed',
      quit: 'Run Forfeited',
    }

    const correctCount = answers.filter(a => a.outcome === 'correct').length
    const wrongCount = answers.filter(a => a.outcome === 'wrong' || a.outcome === 'timeout').length
    const pureWrongCount = answers.filter(a => a.outcome === 'wrong').length
    const skippedCount = answers.filter(a => a.outcome === 'skipped').length
    const skippedTimeoutCount = answers.filter(a => a.outcome === 'skipped' || a.outcome === 'timeout').length

    const filteredAnswers = answers.filter(a => {
      if (outcomeFilter === 'wrong' && a.outcome !== 'wrong') return false
      if (outcomeFilter === 'skipped_timeout' && a.outcome !== 'skipped' && a.outcome !== 'timeout') return false
      if (outcomeFilter === 'correct' && a.outcome !== 'correct') return false
      if (subjectFilter !== 'all' && a.item.subject !== subjectFilter) return false
      return true
    })

    return (
      <div className="max-w-6xl mx-auto w-full h-full max-h-full bg-surface rounded-2xl p-4 sm:p-5 border border-border-base flex flex-col lg:flex-row gap-4 lg:gap-5 shadow-2xl min-h-0 overflow-y-auto lg:overflow-hidden my-auto">
        {/* LEFT COLUMN: Fixed-width Stats & Actions Sidebar */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-3 min-h-0 lg:overflow-y-auto pr-0.5">
          {/* Header */}
          <div className="text-center">
            <span className="text-[11px] font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted">
              Gauntlet Run Summary
            </span>
            <h2
              className={`font-['Orbitron'] font-bold text-xl sm:text-2xl mt-0.5 tracking-wide ${
                endReason === 'lives' ? 'text-[#FF3333]' : 'text-accent'
              }`}
            >
              {endReason ? reasonLabels[endReason] : 'Run Complete'}
            </h2>
          </div>

          {/* Score & Main Stats + Breakdown */}
          <div className="bg-surface-2 p-2.5 sm:p-3 rounded-xl border border-border-base flex flex-col gap-2">
            {/* Main 3 Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
                  Final Score
                </span>
                <span className="font-['JetBrains_Mono'] font-bold text-xl sm:text-2xl text-accent">
                  {score.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
                  Accuracy
                </span>
                <span className="font-['JetBrains_Mono'] font-bold text-base sm:text-lg text-text-primary">
                  {correctCount}/{answers.length}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
                  Best Streak
                </span>
                <span className="font-['JetBrains_Mono'] font-bold text-base sm:text-lg text-text-primary">
                  {bestStreak}
                </span>
              </div>
            </div>

            {/* Answer Breakdown Sub-row */}
            <div className="flex items-center justify-around text-[11px] sm:text-xs font-['JetBrains_Mono'] pt-1.5 border-t border-border-base/40">
              <span className="text-[#00FF41]">✓ {correctCount} Correct</span>
              <span className="text-[#ef4444]">✗ {wrongCount} Wrong</span>
              <span className="text-text-muted">↷ {skippedCount} Skipped</span>
            </div>
          </div>

          {/* Rating Deltas (if rated) */}
          {rated ? (
            <div className="flex flex-col gap-2 bg-surface-2/40 p-3 rounded-xl border border-border-base">
              <span className="text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Award size={13} className="text-accent" />
                Rating Changes
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {config.subjects.map(s => {
                  const before = Math.round(ratingsBefore[s]?.rating ?? 1000)
                  const after = Math.round(ratings[s]?.rating ?? 1000)
                  const delta = after - before
                  const color = SUBJECT_LINE_COLOR[s]
                  return (
                    <div key={s} className="flex items-center justify-between p-1.5 sm:p-2 rounded bg-surface border border-border-base text-xs">
                      <span className="font-['Orbitron'] font-bold" style={{ color }}>{s}</span>
                      <span className="font-['JetBrains_Mono'] text-text-primary">
                        {before} → {after}{' '}
                        <strong className={delta >= 0 ? 'text-[#00FF41]' : 'text-[#ef4444]'}>
                          ({delta >= 0 ? `+${delta}` : delta})
                        </strong>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-text-muted font-['Rajdhani'] text-xs uppercase tracking-wider">
              Unranked • Ratings Unchanged
            </div>
          )}

          {/* Save Status */}
          {savedRunId && (
            <div className="flex items-center justify-center gap-1.5 text-xs font-['JetBrains_Mono'] text-[#00FF41]">
              <CheckCircle2 size={13} />
              Run saved successfully
            </div>
          )}
          {saveError && (
            <div className="flex items-center justify-center gap-1.5 text-xs font-['JetBrains_Mono'] text-[#FF3333]">
              <AlertCircle size={13} />
              Error saving run: {saveError}
            </div>
          )}

          {/* Action Buttons: Stacked vertically in Left Sidebar */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border-base mt-auto">
            <button
              type="button"
              onClick={() => void startRun(config)}
              className="w-full py-2.5 px-4 rounded-xl bg-accent text-black font-bold font-['Orbitron'] tracking-wider text-xs sm:text-sm hover:bg-[#00e63a] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,255,65,0.25)]"
            >
              <RotateCcw size={14} />
              RUN AGAIN
            </button>
            <button
              type="button"
              onClick={() => openSetup(config.mode)}
              className="w-full py-2.5 px-4 rounded-xl bg-surface-2 border border-border-base hover:border-accent text-text-primary font-bold font-['Orbitron'] tracking-wider text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <SlidersHorizontal size={14} />
              NEW CONFIG
            </button>
            <button
              type="button"
              onClick={() => void backToHome()}
              className="w-full py-2.5 px-4 rounded-xl bg-surface border border-border-base hover:border-[#666] text-text-muted hover:text-white font-bold font-['Orbitron'] tracking-wider text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5"
            >
              <Home size={14} />
              BACK TO HOME
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Pinned Filter Bar + Full-Height Scrollable Review List */}
        <div className="flex-1 min-w-0 flex flex-col gap-2.5 min-h-0 border-t lg:border-t-0 lg:border-l border-border-base/70 pt-3 lg:pt-0 lg:pl-5">
          {/* Pinned Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-base/50 pb-2 shrink-0">
            <span className="text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
              Answer Review ({filteredAnswers.length}/{answers.length})
            </span>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Outcome Filter Tabs */}
              <div className="inline-flex rounded-lg bg-surface-2 p-0.5 border border-border-base text-[11px] font-['Rajdhani'] font-bold">
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('all')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    outcomeFilter === 'all'
                      ? 'bg-accent text-black font-extrabold shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  All ({answers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('wrong')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    outcomeFilter === 'wrong'
                      ? 'bg-[#ef4444] text-white font-extrabold shadow-sm'
                      : 'text-text-muted hover:text-[#ef4444]'
                  }`}
                >
                  Wrong ({pureWrongCount})
                </button>
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('skipped_timeout')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    outcomeFilter === 'skipped_timeout'
                      ? 'bg-[#f59e0b] text-black font-extrabold shadow-sm'
                      : 'text-text-muted hover:text-[#f59e0b]'
                  }`}
                >
                  Skip/Time ({skippedTimeoutCount})
                </button>
                <button
                  type="button"
                  onClick={() => setOutcomeFilter('correct')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    outcomeFilter === 'correct'
                      ? 'bg-[#00FF41] text-black font-extrabold shadow-sm'
                      : 'text-text-muted hover:text-[#00FF41]'
                  }`}
                >
                  Correct ({correctCount})
                </button>
              </div>

              {/* Subject Filter Chips */}
              {config.subjects.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSubjectFilter('all')}
                    className={`px-2 py-0.5 rounded text-[10px] font-['Orbitron'] font-bold border transition-colors ${
                      subjectFilter === 'all'
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border-base bg-surface-2 text-text-muted hover:text-white'
                    }`}
                  >
                    ALL
                  </button>
                  {config.subjects.map(sub => {
                    const subColor = SUBJECT_LINE_COLOR[sub]
                    const isSelected = subjectFilter === sub
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setSubjectFilter(sub)}
                        className="px-2 py-0.5 rounded text-[10px] font-['Orbitron'] font-bold border transition-colors"
                        style={{
                          borderColor: isSelected ? subColor : 'rgba(255,255,255,0.1)',
                          backgroundColor: isSelected ? `${subColor}22` : undefined,
                          color: isSelected ? subColor : '#888',
                        }}
                      >
                        {sub}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Full-Height Scrollable Answers List */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2">
            {filteredAnswers.length === 0 ? (
              <div className="py-6 text-center text-text-muted font-['Rajdhani'] text-xs uppercase tracking-wider">
                No answers match the selected filter
              </div>
            ) : (
              filteredAnswers.map(a => {
                const mcq = a.item.card.data as MCQData
                const isExpanded = expandedSeq === a.seq
                const isSlow = a.timeMs > 1.5 * a.item.parMs
                const isTooFast = a.outcome === 'wrong' && a.timeMs < 0.25 * a.item.parMs

                const correctLetter = String.fromCharCode(65 + mcq.answer)
                const pickedLetter = a.chosen !== null ? String.fromCharCode(65 + a.chosen) : '—'

                return (
                  <div
                    key={a.seq}
                    data-testid={`review-row-${a.seq}`}
                    className={`rounded-xl border transition-all ${
                      isExpanded
                        ? 'bg-surface-2 border-accent/60 shadow-md'
                        : 'bg-surface-2/60 hover:bg-surface-2 border-border-base'
                    }`}
                  >
                    {/* Summary Row */}
                    <div
                      data-testid={`review-row-summary-${a.seq}`}
                      className="p-3 flex items-center justify-between gap-2.5 cursor-pointer select-none"
                      onClick={() => setExpandedSeq(isExpanded ? null : a.seq)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Sequence */}
                        <span className="font-['JetBrains_Mono'] text-xs font-bold text-text-muted shrink-0 w-6">
                          #{a.seq + 1}
                        </span>

                        {/* Subject Badge */}
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-['Orbitron'] font-bold shrink-0"
                          style={{
                            color: SUBJECT_LINE_COLOR[a.item.subject],
                            border: `1px solid ${SUBJECT_LINE_COLOR[a.item.subject]}`,
                          }}
                        >
                          {a.item.subject}
                        </span>

                        {/* Outcome Icon */}
                        <span className="shrink-0">
                          {a.outcome === 'correct' && (
                            <CheckCircle2 size={16} className="text-[#00FF41]" />
                          )}
                          {a.outcome === 'wrong' && (
                            <XCircle size={16} className="text-[#ef4444]" />
                          )}
                          {a.outcome === 'skipped' && (
                            <SkipForward size={16} className="text-text-muted" />
                          )}
                          {a.outcome === 'timeout' && (
                            <Timer size={16} className="text-[#ef4444]" />
                          )}
                        </span>

                        {/* Truncated Question Text */}
                        <span
                          className="font-['Rajdhani'] font-semibold text-xs sm:text-sm text-text-primary truncate flex-1 min-w-0"
                          dangerouslySetInnerHTML={{ __html: renderMath(mcq.question ?? '') }}
                        />
                      </div>

                      {/* Right Meta Info */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs font-['JetBrains_Mono']">
                        {/* Choice Comparison */}
                        <div className="flex items-center gap-1 font-bold">
                          {a.outcome === 'correct' ? (
                            <span className="text-[#00FF41]">{correctLetter}</span>
                          ) : (
                            <>
                              <span className={a.chosen !== null ? 'text-[#ef4444]' : 'text-text-muted'}>
                                {pickedLetter}
                              </span>
                              <span className="text-text-muted text-[10px]">→</span>
                              <span className="text-[#00FF41]">{correctLetter}</span>
                            </>
                          )}
                        </div>

                        {/* Time vs Par */}
                        <span className="text-text-muted hidden sm:inline text-[11px]">
                          {(a.timeMs / 1000).toFixed(1)}s / {Math.round(a.item.parMs / 1000)}s
                        </span>

                        {/* Markers: SLOW / TOO FAST */}
                        {isSlow && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-['Orbitron'] font-bold bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">
                            SLOW
                          </span>
                        )}
                        {isTooFast && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-['Orbitron'] font-bold bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30">
                            TOO FAST
                          </span>
                        )}

                        {/* Points */}
                        <span
                          className={`font-bold w-12 text-right ${
                            a.points > 0
                              ? 'text-[#00FF41]'
                              : a.points < 0
                              ? 'text-[#ef4444]'
                              : 'text-text-muted'
                          }`}
                        >
                          {a.points > 0 ? `+${a.points}` : a.points}
                        </span>

                        {/* Expand Chevron */}
                        <ChevronDown
                          size={14}
                          className={`text-text-muted transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-border-base/60 flex flex-col gap-3">
                        {/* Full Question Text */}
                        <div
                          className="text-white font-['Rajdhani'] font-semibold text-sm sm:text-base leading-relaxed whitespace-pre-wrap mcq-question-text"
                          dangerouslySetInnerHTML={{ __html: renderMath(mcq.question ?? '') }}
                        />

                        {/* Question Diagram */}
                        {mcq.imagePath && (
                          <div className="max-w-md max-h-[220px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-md my-1">
                            <img
                              src={`ece-app://${mcq.imagePath}`}
                              alt="Question diagram"
                              className="max-h-[220px] object-contain cursor-zoom-in"
                              onClick={e => {
                                e.stopPropagation()
                                setZoomedImage(mcq.imagePath!)
                              }}
                            />
                          </div>
                        )}

                        {/* Choices Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-1">
                          {Array.isArray(mcq.choices) &&
                            mcq.choices.map((choice, idx) => {
                              const isCorrect = idx === mcq.answer
                              const isPicked = a.chosen === idx
                              const renderFn = mcq.choicesPlainText?.[idx] ? renderPlainText : renderMath
                              const letter = String.fromCharCode(65 + idx)

                              let btnClass = 'border-[#222] bg-[#0e0e0e] text-[#555] opacity-60'
                              let badgeClass = 'border-[#333] text-[#444] bg-[#0a0a0a]'
                              let textClass = 'text-[#666]'

                              if (isCorrect) {
                                btnClass =
                                  'border-[#00FF41] bg-[rgba(0,255,65,0.08)] text-white shadow-[0_0_12px_rgba(0,255,65,0.15)]'
                                badgeClass = 'bg-[#00FF41] text-[#0D0D0D] border-[#00FF41] font-bold'
                                textClass = 'text-white font-semibold'
                              } else if (isPicked) {
                                btnClass =
                                  'border-[#ef4444] bg-[rgba(255,51,51,0.08)] text-[#ddd]'
                                badgeClass = 'bg-[#ef4444] text-[#0D0D0D] border-[#ef4444] font-bold'
                                textClass = 'text-[#aaa]'
                              }

                              return (
                                <div
                                  key={idx}
                                  className={`p-2.5 rounded-lg border flex items-center gap-2.5 text-xs font-['Rajdhani'] ${btnClass}`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[11px] shrink-0 border ${badgeClass}`}
                                  >
                                    {letter}
                                  </span>
                                  <span
                                    className={`flex-1 break-words leading-snug mcq-choice-text ${textClass}`}
                                    dangerouslySetInnerHTML={{ __html: renderFn(choice) }}
                                  />
                                  {isCorrect && (
                                    <CheckCircle2 className="text-[#00FF41] shrink-0" size={16} />
                                  )}
                                  {isPicked && !isCorrect && (
                                    <XCircle className="text-[#ef4444] shrink-0" size={16} />
                                  )}
                                </div>
                              )
                            })}
                        </div>

                        {/* Solution Diagram */}
                        {mcq.solutionImagePath && (
                          <div className="p-3 bg-surface rounded-lg border border-border-base">
                            <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted block mb-1">
                              Solution Diagram
                            </span>
                            <div className="max-w-md max-h-[200px] flex justify-center overflow-hidden rounded border border-[#333]">
                              <img
                                src={`ece-app://${mcq.solutionImagePath}`}
                                alt="Solution diagram"
                                className="max-h-[200px] object-contain cursor-zoom-in"
                                onClick={e => {
                                  e.stopPropagation()
                                  setZoomedImage(mcq.solutionImagePath!)
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Explanation Text */}
                        {mcq.explanation && (
                          <div className="p-3 bg-surface rounded-lg border border-border-base">
                            <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted block mb-1">
                              Explanation
                            </span>
                            <div
                              className="text-text-primary text-xs font-['Rajdhani'] leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: renderMath(mcq.explanation) }}
                            />
                          </div>
                        )}

                        {/* Row Actions: Get Context + AI Explain */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              handleGetContext(mcq)
                            }}
                            className="px-2.5 py-1 rounded bg-surface border border-[rgba(255,255,255,0.2)] hover:border-text-muted text-[#CCCCCC] hover:text-white text-xs font-['Rajdhani'] font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Copy size={13} />
                            Get Context
                          </button>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setExplainingSeq(explainingSeq === a.seq ? null : a.seq)
                            }}
                            className="px-2.5 py-1 rounded bg-surface border border-border-base hover:border-accent text-text-muted hover:text-accent text-xs font-['Rajdhani'] font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Sparkles size={13} className="text-accent" />
                            {explainingSeq === a.seq ? 'Hide AI Explanation' : 'AI Explain'}
                          </button>
                        </div>

                        {/* Inline ExplanationPanel */}
                        {explainingSeq === a.seq && (
                          <div className="mt-2" onClick={e => e.stopPropagation()}>
                            <ExplanationPanel
                              question={mcq.question}
                              choices={mcq.choices}
                              answerIndex={mcq.answer}
                              onClose={() => setExplainingSeq(null)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Zoomed Image Modal */}
        {zoomedImage && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <div className="relative max-w-4xl max-h-[85vh]">
              <img
                src={`ece-app://${zoomedImage}`}
                alt="Enlarged diagram"
                className="max-w-full max-h-[85vh] object-contain rounded-lg border border-[#333] shadow-2xl"
              />
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-surface border border-border-base text-text-muted hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Toast confirmation */}
        <AnimatePresence>
          {showToast && (
            <Toast
              message="Context copied to clipboard — paste into Gemini, ChatGPT, or Claude"
              onDismiss={() => setShowToast(false)}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Phase === 'playing'
  const currentItem = revealState ? revealState.item : selectCurrentItem({ queue, index })
  const mcq = revealState ? revealState.mcq : (currentItem?.card.data as MCQData | undefined)

  const totalDurationForThisTimer =
    config.mode === 'timed' ? config.durationSec : config.perQuestionSec
  const timerPercent =
    isUnlimitedSurvival
      ? 100
      : totalDurationForThisTimer > 0
      ? Math.min(100, Math.max(0, (timeRemainingSec / totalDurationForThisTimer) * 100))
      : 0
  const isUrgentTimer = !isUnlimitedSurvival && timeRemainingSec <= 5

  const minutes = Math.floor(timeRemainingSec / 60)
  const seconds = timeRemainingSec % 60
  const timeFormatted =
    config.mode === 'timed'
      ? `${minutes}:${seconds.toString().padStart(2, '0')}`
      : isUnlimitedSurvival
      ? `∞ ${timeRemainingSec}s`
      : `${timeRemainingSec}s`

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-4 my-auto">
      {/* HUD Header */}
      <div className="bg-surface rounded-xl p-3 border border-border-base flex items-center justify-between gap-3">
        {/* Left HUD: Mode, Index, Score, Streak, Lives */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="font-['Orbitron'] font-bold text-xs uppercase text-accent tracking-wider">
              {config.mode}
            </span>
            <span className="text-text-muted text-xs font-['JetBrains_Mono']">
              #{index + 1}{config.mode === 'timed' ? `/${queue.length}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs font-['JetBrains_Mono'] text-text-primary">
            Score: <strong className="text-accent">{score}</strong>
          </div>

          <div className="flex items-center gap-1 text-xs font-['JetBrains_Mono'] text-text-primary">
            Streak: <strong className="text-[#f59e0b]">{streak}</strong>
          </div>

          {config.mode === 'survival' && (
            <div
              className={`flex items-center gap-1 text-xs font-['JetBrains_Mono'] text-[#ef4444] transition-all ${
                pulseHeart ? 'gauntlet-heart-pulse' : ''
              }`}
            >
              <Heart size={14} fill="currentColor" />
              <strong>{livesLeft}</strong>
            </div>
          )}
        </div>

        {/* Right HUD: Timer + VolumeControl + Quit Run */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Timer Chip with Draining Progress Bar and <=5s Shake */}
          <div
            className={`relative overflow-hidden flex items-center gap-1.5 font-['JetBrains_Mono'] font-bold text-sm bg-surface-2 px-3 py-1.5 rounded-lg border transition-all ${
              isUrgentTimer
                ? 'border-[#FF3333]/70 gauntlet-timer-shake shadow-[0_0_12px_rgba(255,51,51,0.25)]'
                : 'border-border-base'
            }`}
          >
            {/* Subtle background drain tint */}
            <div
              className={`absolute left-0 top-0 bottom-0 opacity-15 pointer-events-none transition-all duration-300 ${
                isUrgentTimer ? 'bg-[#FF3333]' : 'bg-accent'
              }`}
              style={{ width: `${timerPercent}%` }}
            />
            {/* Draining progress bar track beneath */}
            <div
              className={`absolute left-0 bottom-0 h-1 transition-all duration-300 ${
                isUrgentTimer ? 'bg-[#FF3333]' : 'bg-accent'
              }`}
              style={{ width: `${timerPercent}%` }}
            />

            <Timer
              size={14}
              className={`relative z-10 ${
                isUrgentTimer ? 'text-[#FF3333] animate-pulse' : 'text-accent'
              }`}
            />
            <span
              className={`relative z-10 ${
                isUrgentTimer ? 'text-[#FF3333]' : 'text-text-primary'
              }`}
            >
              {timeFormatted}
            </span>
          </div>

          {/* Volume / Mute Control */}
          <VolumeControl className="text-text-muted hover:text-white" iconSize={16} />

          {/* Quit Button (Relocated outside Question Card) */}
          <button
            type="button"
            disabled={isModalOpen || revealState !== null}
            onClick={onOpenPause}
            className="px-2.5 py-1.5 rounded-lg text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted hover:text-[#FF3333] hover:bg-[#FF3333]/10 border border-border-base hover:border-[#FF3333]/40 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle size={14} />
            Quit
          </button>
        </div>
      </div>

      {/* Question Card */}
      {currentItem && mcq ? (
        <div
          className={`relative bg-surface-2 rounded-xl p-6 sm:p-7 border border-border-base flex flex-col gap-6 shadow-2xl transition-all overflow-hidden ${
            shakeWrong ? 'gauntlet-card-shake border-danger/80' : ''
          }`}
        >
          {/* Red edge flash overlay on wrong answer */}
          {shakeWrong && (
            <div
              aria-hidden="true"
              className="gauntlet-edge-flash absolute inset-0 pointer-events-none rounded-xl border-2 border-danger shadow-[inset_0_0_24px_rgba(255,51,51,0.5)] z-20"
            />
          )}

          {/* Question Meta */}
          <div className="flex items-center justify-between">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-['Orbitron'] font-bold tracking-wider"
              style={{
                color: SUBJECT_LINE_COLOR[currentItem.subject],
                border: `1px solid ${SUBJECT_LINE_COLOR[currentItem.subject]}`,
              }}
            >
              {currentItem.subject}
            </span>
          </div>

          {/* Question Text */}
          <div
            className="text-white font-['Rajdhani'] font-semibold text-lg leading-relaxed whitespace-pre-wrap mcq-question-text"
            dangerouslySetInnerHTML={{ __html: renderMath(mcq.question ?? '') }}
          />

          {/* Question Diagram / Image */}
          {mcq.imagePath && (
            <div className="w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg">
              <img
                src={`ece-app://${mcq.imagePath}`}
                alt="Question diagram"
                className="w-full h-full max-h-[300px] object-contain"
              />
            </div>
          )}

          {/* Choices in 2x2 Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.isArray(mcq.choices) &&
              mcq.choices.map((choice, i) => {
                const renderFn = mcq.choicesPlainText?.[i] ? renderPlainText : renderMath
                const letter = String.fromCharCode(65 + i)
                const isRevealed = revealState !== null
                const isCorrect = isRevealed && i === revealState.correctIndex
                const isPicked = isRevealed && revealState.chosen === i
                const isWrongPicked = isPicked && revealState.isWrong

                let btnStyle =
                  'border-[#2c2c2c] bg-[#121212] hover:bg-[#1c1c1c] hover:border-accent hover:shadow-[0_0_8px_rgba(0,255,65,0.2)] cursor-pointer text-text-muted'
                let prefixStyle =
                  'border-[#444] text-text-muted bg-surface/50 group-hover:border-accent group-hover:text-accent'
                let textStyle = 'text-text-primary'

                if (isRevealed) {
                  if (isCorrect) {
                    btnStyle =
                      'border-accent bg-[rgba(0,255,65,0.08)] shadow-[0_0_16px_rgba(0,255,65,0.22)] cursor-default'
                    prefixStyle = 'bg-accent text-[#0D0D0D] border-accent font-bold'
                    textStyle = 'text-white'
                  } else if (isWrongPicked) {
                    btnStyle =
                      'border-danger bg-[rgba(255,51,51,0.08)] shadow-[0_0_16px_rgba(255,51,51,0.22)] cursor-default'
                    prefixStyle = 'bg-danger text-[#0D0D0D] border-danger font-bold'
                    textStyle = 'text-[#aaa]'
                  } else {
                    btnStyle = 'border-[#222] bg-[#0e0e0e] opacity-50 cursor-default'
                    prefixStyle = 'border-[#333] text-[#444] bg-[#0a0a0a]'
                    textStyle = 'text-[#555]'
                  }
                }

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isModalOpen || isRevealed}
                    onClick={() => handleAnswer(i)}
                    className={`w-full text-left py-4 px-4 rounded-xl border flex items-center transition-all group disabled:cursor-not-allowed ${btnStyle}`}
                  >
                    <div
                      className={`w-6 h-6 flex items-center justify-center rounded border font-['Rajdhani'] font-bold text-sm mr-3 shrink-0 transition-colors ${prefixStyle}`}
                    >
                      {letter}
                    </div>
                    <div
                      className={`flex-1 text-base font-['Rajdhani'] font-semibold tracking-wide mcq-choice-text leading-snug ${textStyle}`}
                      dangerouslySetInnerHTML={{ __html: renderFn(choice) }}
                    />
                    {isRevealed && isCorrect && (
                      <CheckCircle2 className="text-accent ml-3 shrink-0" size={20} />
                    )}
                    {isRevealed && isWrongPicked && (
                      <XCircle className="text-danger ml-3 shrink-0" size={20} />
                    )}
                  </button>
                )
              })}
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-end pt-2 border-t border-border-base/60">
            <button
              type="button"
              disabled={isModalOpen || revealState !== null || skipsAvailable === 0}
              onClick={handleSkip}
              className="px-4 py-1.5 rounded-lg text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary bg-surface-2 border border-border-base hover:border-accent transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SkipForward size={14} />
              SKIP ({skipsAvailable})
            </button>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-surface-2 rounded-xl border border-border-base text-text-muted font-['Rajdhani'] text-sm">
          Preparing question queue…
        </div>
      )}
    </div>
  )
}

export default function Gauntlet() {
  const phase = useGauntletStore(s => s.phase)
  const rated = useGauntletStore(s => s.rated)
  const loadHub = useGauntletStore(s => s.loadHub)
  const beginRun = useGauntletStore(s => s.beginRun)
  const cancelCountdown = useGauntletStore(s => s.cancelCountdown)
  const pauseRun = useGauntletStore(s => s.pauseRun)
  const resumeRun = useGauntletStore(s => s.resumeRun)
  const quit = useGauntletStore(s => s.quit)

  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false)
  const setForceCollapsed = useLayoutStore(s => s.setForceCollapsed)
  const music = useGauntletMusic()

  // Music lifecycle:
  // - Pre-run: continuous stealth ambient across home, setup, loading, and countdown.
  // - Playing: immediately shift gameplay floor to enemiesNearby.
  useEffect(() => {
    if (phase === 'home' || phase === 'setup' || phase === 'loading' || phase === 'countdown') {
      music.start('stealth')
    } else if (phase === 'playing') {
      music.setState('enemiesNearby')
    }
  }, [phase, music])

  // Stop music on page unmount
  useEffect(() => {
    return () => {
      music.stop()
    }
  }, [music])

  // Force sidebar collapse during countdown and playing without modifying saved preference
  useEffect(() => {
    setForceCollapsed(phase === 'countdown' || phase === 'playing')
  }, [phase, setForceCollapsed])

  // Reset forceCollapsed on unmount
  useEffect(() => {
    return () => {
      useLayoutStore.getState().setForceCollapsed(false)
    }
  }, [])

  // Load hub data on mount
  useEffect(() => {
    void loadHub()
  }, [loadHub])

  // Reset to home on page unmount if not playing or countdown
  useEffect(() => {
    return () => {
      const curPhase = useGauntletStore.getState().phase
      if (curPhase !== 'playing' && curPhase !== 'countdown') {
        useGauntletStore.getState().resetToHome()
      }
    }
  }, [])

  // Leave guard: useBlocker active while phase is 'countdown' or 'playing'
  const isBlocking = phase === 'countdown' || phase === 'playing'
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isBlocking && currentLocation.pathname !== nextLocation.pathname,
  )

  // When blocker triggers, pause the run if playing
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (phase === 'playing') {
        pauseRun()
      }
    }
  }, [blocker.state, phase, pauseRun])

  // Reset blocker on unmount if left blocked
  useEffect(() => {
    return () => {
      if (blocker.state === 'blocked') {
        blocker.reset()
      }
    }
  }, [blocker])

  // Esc key opens pause modal while playing
  useEffect(() => {
    if (phase !== 'playing') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPauseModalOpen && blocker.state !== 'blocked') {
        e.preventDefault()
        pauseRun()
        setIsPauseModalOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, isPauseModalOpen, blocker.state, pauseRun])

  const handleOpenPause = useCallback(() => {
    pauseRun()
    setIsPauseModalOpen(true)
  }, [pauseRun])

  const handleResume = useCallback(() => {
    setIsPauseModalOpen(false)
    resumeRun()
  }, [resumeRun])

  const handleQuitFromPause = useCallback(() => {
    setIsPauseModalOpen(false)
    quit()
  }, [quit])

  const handleConfirmLeave = () => {
    if (phase === 'countdown') {
      cancelCountdown()
    } else {
      quit()
    }
    blocker.proceed?.()
  }

  const handleCancelLeave = () => {
    blocker.reset?.()
    if (phase === 'playing') {
      resumeRun()
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      {/* Screens based on phase */}
      {phase === 'home' && <GauntletHome />}

      {(phase === 'setup' || phase === 'loading') && <GauntletSetup />}

      {phase === 'countdown' && (
        <GauntletCountdown onBegin={beginRun} onCancel={cancelCountdown} />
      )}

      {(phase === 'playing' || phase === 'summary') && (
        <div className="absolute inset-0 z-10 h-full px-8 pb-4 pt-4 lg:px-12 lg:pb-6 lg:pt-4 overflow-y-auto overflow-x-hidden flex flex-col gap-4">
          <RunPlaceholder
            onOpenPause={handleOpenPause}
            isModalOpen={isPauseModalOpen || blocker.state === 'blocked'}
          />
        </div>
      )}

      {/* In-run Pause Modal */}
      <GauntletPauseModal
        isOpen={isPauseModalOpen}
        onResume={handleResume}
        onQuit={handleQuitFromPause}
      />

      {/* Navigation Blocker Confirm Modal */}
      <LeaveConfirmModal
        isOpen={blocker.state === 'blocked'}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
        isAbsolute
        message={`Quit this Gauntlet run? Your answers so far will be saved to your history${
          rated ? ' and counted toward your ratings' : ''
        }.`}
      />
    </div>
  )
}
