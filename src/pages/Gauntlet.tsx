import React, { useEffect, useState, useCallback } from 'react'
import { useBlocker } from 'react-router-dom'
import { useGauntletStore, selectCurrentItem } from '../store/useGauntletStore'
import { useLayoutStore } from '../store/useLayoutStore'
import { GauntletHome } from '../components/gauntlet/GauntletHome'
import { GauntletSetup } from '../components/gauntlet/GauntletSetup'
import { GauntletCountdown } from '../components/gauntlet/GauntletCountdown'
import { GauntletPauseModal } from '../components/gauntlet/GauntletPauseModal'
import { LeaveConfirmModal } from '../components/ui/LeaveConfirmModal'
import { renderMath, renderPlainText } from '../lib/latex'
import { SUBJECT_LINE_COLOR } from '../lib/dashboardUtils'
import type { MCQData } from '../types'
import { Timer, Heart, XCircle, SkipForward, Award, CheckCircle2, AlertCircle } from 'lucide-react'

// TEMP: replaced by GauntletPlay / GauntletSummary in Phase 2B-2 / 2B-3
interface RunPlaceholderProps {
  onOpenPause: () => void
  isModalOpen: boolean
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
  const backToHome = useGauntletStore(s => s.backToHome)

  const [now, setNow] = useState(Date.now())

  // Drive the clock and re-render countdown
  useEffect(() => {
    if (phase !== 'playing') return
    const intervalId = setInterval(() => {
      const curNow = Date.now()
      setNow(curNow)
      const s = useGauntletStore.getState()
      if (s.phase !== 'playing' || s.pausedAt !== null) return
      if (s.config.mode === 'timed') {
        if (s.endsAt !== null && curNow >= s.endsAt) {
          s.expire()
        }
      } else if (s.config.mode === 'survival') {
        if (curNow - s.questionShownAt >= s.config.perQuestionSec * 1000) {
          s.timeoutCurrent()
        }
      }
    }, 250)
    return () => clearInterval(intervalId)
  }, [phase])

  if (phase === 'summary') {
    const reasonLabels = {
      time: 'Time Expired',
      lives: 'Lives Depleted',
      queue: 'Queue Completed',
      quit: 'Run Forfeited',
    }

    const correctCount = answers.filter(a => a.outcome === 'correct').length
    const wrongCount = answers.filter(a => a.outcome === 'wrong' || a.outcome === 'timeout').length
    const skippedCount = answers.filter(a => a.outcome === 'skipped').length

    return (
      <div className="max-w-2xl mx-auto w-full bg-surface rounded-2xl p-6 border border-border-base flex flex-col gap-6 shadow-2xl my-auto">
        <div className="text-center">
          <span className="text-[11px] font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted">
            Gauntlet Run Summary
          </span>
          <h2 className="font-['Orbitron'] font-bold text-2xl text-accent mt-1 tracking-wide">
            {endReason ? reasonLabels[endReason] : 'Run Complete'}
          </h2>
        </div>

        {/* Score & Main Stats */}
        <div className="grid grid-cols-3 gap-3 bg-surface-2 p-4 rounded-xl border border-border-base text-center">
          <div>
            <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
              Final Score
            </span>
            <span className="font-['JetBrains_Mono'] font-bold text-2xl text-accent">
              {score.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
              Accuracy
            </span>
            <span className="font-['JetBrains_Mono'] font-bold text-lg text-text-primary">
              {correctCount}/{answers.length}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block">
              Best Streak
            </span>
            <span className="font-['JetBrains_Mono'] font-bold text-lg text-text-primary">
              {bestStreak}
            </span>
          </div>
        </div>

        {/* Answer Breakdown */}
        <div className="flex items-center justify-around text-xs font-['JetBrains_Mono'] py-2 border-y border-border-base/50">
          <span className="text-[#00FF41]">✓ {correctCount} Correct</span>
          <span className="text-[#ef4444]">✗ {wrongCount} Wrong</span>
          <span className="text-text-muted">↷ {skippedCount} Skipped</span>
        </div>

        {/* Rating Deltas (if rated) */}
        {rated ? (
          <div className="flex flex-col gap-2 bg-surface-2/40 p-4 rounded-xl border border-border-base">
            <span className="text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Award size={13} className="text-accent" />
              Rating Changes
            </span>
            <div className="grid grid-cols-2 gap-2">
              {config.subjects.map(s => {
                const before = Math.round(ratingsBefore[s]?.rating ?? 1000)
                const after = Math.round(ratings[s]?.rating ?? 1000)
                const delta = after - before
                const color = SUBJECT_LINE_COLOR[s]
                return (
                  <div key={s} className="flex items-center justify-between p-2 rounded bg-surface border border-border-base text-xs">
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
            Practice Run • Ratings Unchanged
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

        <button
          type="button"
          onClick={() => void backToHome()}
          className="w-full py-3 rounded-xl bg-accent text-black font-bold font-['Orbitron'] tracking-wider text-sm hover:bg-[#00e63a] transition-colors"
        >
          BACK TO HOME
        </button>
      </div>
    )
  }

  // Phase === 'playing'
  const currentItem = selectCurrentItem({ queue, index })
  const mcq = currentItem?.card.data as MCQData | undefined

  const timeRemainingSec =
    config.mode === 'timed'
      ? Math.max(0, Math.ceil(((endsAt ?? 0) - now) / 1000))
      : Math.max(0, Math.ceil((config.perQuestionSec * 1000 - (now - questionShownAt)) / 1000))

  const minutes = Math.floor(timeRemainingSec / 60)
  const seconds = timeRemainingSec % 60
  const timeFormatted =
    config.mode === 'timed'
      ? `${minutes}:${seconds.toString().padStart(2, '0')}`
      : `${timeRemainingSec}s`

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-4 my-auto">
      {/* HUD Header */}
      <div className="bg-surface rounded-xl p-3 border border-border-base flex items-center justify-between">
        <div className="flex items-center gap-4">
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
            <div className="flex items-center gap-1 text-xs font-['JetBrains_Mono'] text-[#ef4444]">
              <Heart size={14} fill="currentColor" />
              <strong>{livesLeft}</strong>
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1.5 font-['JetBrains_Mono'] font-bold text-sm text-text-primary bg-surface-2 px-3 py-1 rounded-lg border border-border-base">
          <Timer size={14} className={timeRemainingSec <= 5 ? 'text-[#FF3333] animate-pulse' : 'text-accent'} />
          <span className={timeRemainingSec <= 5 ? 'text-[#FF3333]' : 'text-text-primary'}>
            {timeFormatted}
          </span>
        </div>
      </div>

      {/* Question Card */}
      {currentItem && mcq ? (
        <div className="bg-surface rounded-2xl p-6 border border-border-base flex flex-col gap-6 shadow-xl">
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

            {/* Par/Weight debug text hidden in production */}
            {import.meta.env.DEV && (
              <span className="text-[11px] font-['JetBrains_Mono'] text-text-muted">
                Par: {Math.round(currentItem.parMs / 1000)}s • Weight: {currentItem.weight.toFixed(1)}x
              </span>
            )}
          </div>

          {/* Question Text */}
          <div
            className="text-base text-text-primary font-['JetBrains_Mono'] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMath(mcq.question ?? '') }}
          />

          {/* Choices */}
          <div className="grid grid-cols-1 gap-2.5">
            {Array.isArray(mcq.choices) &&
              mcq.choices.map((choice, i) => {
                const renderFn = mcq.choicesPlainText?.[i] ? renderPlainText : renderMath
                const letter = String.fromCharCode(65 + i)
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isModalOpen}
                    onClick={() => answer(i)}
                    className="w-full text-left p-3.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 hover:border-accent/60 border border-border-base transition-all flex items-start gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="w-6 h-6 rounded-lg bg-surface border border-border-base flex items-center justify-center font-['Orbitron'] text-xs font-bold text-text-muted group-hover:text-accent group-hover:border-accent shrink-0">
                      {letter}
                    </span>
                    <span
                      className="font-['JetBrains_Mono'] text-sm text-text-primary flex-1 leading-relaxed pt-0.5"
                      dangerouslySetInnerHTML={{ __html: renderFn(choice) }}
                    />
                  </button>
                )
              })}
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border-base/60">
            <button
              type="button"
              onClick={onOpenPause}
              className="px-3 py-1.5 rounded-lg text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted hover:text-[#FF3333] hover:bg-[#FF3333]/10 transition-colors flex items-center gap-1"
            >
              <XCircle size={14} />
              Quit Run
            </button>

            <button
              type="button"
              disabled={isModalOpen}
              onClick={skip}
              className="px-4 py-1.5 rounded-lg text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary bg-surface-2 border border-border-base hover:border-accent transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SkipForward size={14} />
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-surface rounded-2xl border border-border-base text-text-muted font-['Rajdhani'] text-sm">
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
    <div className="relative h-full w-full overflow-hidden bg-[#0D0D0D]">
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
