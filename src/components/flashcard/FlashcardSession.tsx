import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings2, X, ArrowLeft, ArrowRight, RotateCcw, Play, Pause,
         Volume2, VolumeX, Copy, Sparkles } from 'lucide-react'
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal'
import { StudyCard, getFrontText, getCorrectAnswer } from './StudyCard'
import { FlashcardContextPanel } from './FlashcardContextPanel'
import { useSessionStore } from '../../store/useSessionStore'
import type { Card } from '../../types'
import { useSound } from '../../hooks/useSound'

interface FCSettings {
  shuffle: boolean
  bookmarkedOnly: boolean
  swapTermDef: boolean
  writtenMode: boolean
}

export interface FlashcardSessionProps {
  activeDeck: { id: string; title: string; cards: Card[] }
  currentCard: Card
  currentIndex: number
  sessionCards: Card[]
  isFlipped: boolean
  isAutoplay: boolean
  isBookmarked: boolean
  isSubmitting: boolean
  fcTtsEnabled: boolean
  showSettings: boolean
  settings: FCSettings
  writtenAnswer: string
  writtenSubmitted: boolean
  writtenCorrect: boolean | null
  writtenStats: { correct: number; total: number }
  showContext?: boolean
  zoomedImage: string | null
  showToast?: boolean
  showExitConfirm: boolean
  blockerState: 'unblocked' | 'blocked' | 'proceeding'
  progress: number
  mode?: 'study' | 'preview'
  enableTTS?: boolean
  enableAutoplay?: boolean
  onExit: () => void
  onBlockerProceed: () => void
  onBlockerReset: () => void
  onSetExitConfirm: (v: boolean) => void
  onFlip: () => void
  onToggleAutoplay: () => void
  onToggleTTS: () => void
  onToggleSettings: () => void
  onSettingChange: (key: keyof FCSettings) => void
  onSwapTermDef: () => void
  onBookmarkToggle: (cardId: string) => void
  onWrittenChange: (v: string) => void
  onWrittenSubmit: () => void
  onViewCard: () => void
  onZoomImage: (path: string | null) => void
  onShowContext?: (v: boolean) => void
  onRateCard: (rating: number) => void
  onGetContext?: () => void
  onGoNext: () => void
  onGoPrev: () => void
  stop: () => void
  autoplayRef: React.MutableRefObject<{
    timer: ReturnType<typeof setTimeout> | null
    activeIndex: number
    phase: 'front' | 'back'
    isNewCard: boolean
  }>
  autoplaySpeechDoneRef: React.MutableRefObject<(() => void) | null>
}

export function FlashcardSession({
  activeDeck,
  currentCard,
  currentIndex,
  sessionCards,
  isFlipped,
  isAutoplay,
  isBookmarked,
  isSubmitting,
  fcTtsEnabled,
  showSettings,
  settings,
  writtenAnswer,
  writtenSubmitted,
  writtenCorrect,
  writtenStats,
  showContext,
  zoomedImage,
  showToast,
  showExitConfirm,
  blockerState,
  progress,
  onExit,
  onBlockerProceed,
  onBlockerReset,
  onSetExitConfirm,
  onFlip,
  onToggleAutoplay,
  onToggleTTS,
  onToggleSettings,
  onSettingChange,
  onSwapTermDef,
  onBookmarkToggle,
  onWrittenChange,
  onWrittenSubmit,
  onViewCard,
  onZoomImage,
  onShowContext,
  onRateCard,
  onGetContext,
  onGoNext,
  onGoPrev,
  stop,
  autoplayRef,
  autoplaySpeechDoneRef,
  mode = 'study',
  enableTTS = true,
  enableAutoplay = true,
}: FlashcardSessionProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [showRatingFeedback, setShowRatingFeedback] = useState(false)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const { play } = useSound()

  const utilityVisible = (isFlipped || (settings.writtenMode && writtenSubmitted)) && !isAutoplay

  useEffect(() => {
    const t = setTimeout(() => {
      setSelectedRating(null)
      setShowRatingFeedback(false)
      setExplanationOpen(false)
    }, 50)
    return () => clearTimeout(t)
  }, [currentIndex])

  const RATING_FEEDBACK: Record<number, { label: string; message: string; color: string }> = {
    1: { label: 'Again',  message: 'Card will repeat shortly — keep at it.',      color: '#FF3333' },
    2: { label: 'Hard',   message: 'Scheduled in ~5 min — review more carefully.', color: '#FFB800' },
    3: { label: 'Good',   message: 'Nice! Scheduled in ~10 min.',                  color: '#00FF41' },
    4: { label: 'Easy',   message: 'Marked easy — see you in 4+ days.',            color: '#00BFFF' },
  }

  return (
    <div className="h-full bg-engine-black flex flex-col overflow-hidden relative">
      {/* Top Bar */}
      <div className="shrink-0 bg-[#111] border-b border-border-base px-6 py-4 flex items-center justify-between z-20">
        <LeaveConfirmModal
          isOpen={blockerState === 'blocked' || showExitConfirm}
          onConfirm={() => {
            if (blockerState === 'blocked') {
              onBlockerProceed()
            } else {
              onSetExitConfirm(false)
              onExit()
            }
          }}
          onCancel={() => {
            if (blockerState === 'blocked') {
              onBlockerReset()
            } else {
              onSetExitConfirm(false)
            }
          }}
        />
        <div className="flex items-center gap-4">
          <button onClick={() => onSetExitConfirm(true)} className="text-text-muted hover:text-white transition-colors p-2 rounded hover:bg-border-base" title="Exit">
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="text-[var(--accent-primary)] font-['Rajdhani'] font-bold tracking-widest text-base uppercase">{activeDeck.title}</span>
            <span className="text-text-primary text-xs font-['Rajdhani'] font-bold uppercase tracking-widest">Card {currentIndex + 1} of {sessionCards.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {settings.writtenMode && (
            <span className="text-xs font-['IBM_Plex_Mono'] text-text-muted bg-surface px-3 py-1 rounded border border-[#333]">
              Accuracy: <span className="text-[var(--accent-primary)]">{writtenStats.total > 0 ? Math.round((writtenStats.correct / writtenStats.total) * 100) : 0}%</span>
            </span>
          )}
          {/* Swap Term/Def toggle button — always visible */}
          <button
            onClick={onSwapTermDef}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${settings.swapTermDef
              ? 'bg-accent/20 text-accent border-accent'
              : 'bg-surface text-text-muted border-[#333] hover:border-[#555] hover:text-text-primary'
              }`}
            title="Swap Term / Definition (Shortcut: F)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {settings.swapTermDef ? 'SWAPPED' : 'SWAP'}
          </button>
          {enableAutoplay && !settings.writtenMode && (
            <button
              onClick={onToggleAutoplay}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${isAutoplay
                ? 'bg-accent/10 text-accent border-accent shadow-[0_0_8px_rgba(0,255,65,0.3)]'
                : 'bg-surface text-text-muted border-[#333] hover:border-[#555] hover:text-text-primary'
                }`}
              title="Autoplay"
            >
              {isAutoplay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              AUTO
            </button>
          )}
          {enableTTS && (
          <button
            onClick={onToggleTTS}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${fcTtsEnabled ? 'border-accent text-accent bg-accent/10' : 'border-[#333] text-text-muted hover:text-text-primary hover:border-[#555]'}`}
            title={fcTtsEnabled ? 'TTS On — click to disable' : 'TTS Off — click to enable'}
          >
            {fcTtsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          )}
          <button
            onClick={onToggleSettings}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${showSettings ? 'bg-accent/10 text-accent border-accent' : 'bg-surface text-text-muted border-[#333] hover:border-[#555] hover:text-text-primary'}`}
            title="Settings"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="shrink-0 w-full bg-surface h-[4px]">
        <motion.div className="h-full bg-[var(--accent-primary)] shadow-[0_0_8px_rgba(0,255,65,0.6)]" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="shrink-0 bg-[#111] border-b border-[#333] overflow-hidden">
            <div className="p-4 flex flex-wrap gap-6 items-center justify-center">
              {[
                { key: 'shuffle' as const, label: 'Shuffle' },
                { key: 'bookmarkedOnly' as const, label: 'Bookmarked Only' },
                { key: 'swapTermDef' as const, label: 'Swap Term/Def' },
                { key: 'writtenMode' as const, label: 'Written Mode' },
              ].map(opt => (
                <button key={opt.key} onClick={() => onSettingChange(opt.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-['Rajdhani'] font-bold tracking-widest uppercase transition-all border ${settings[opt.key]
                    ? 'bg-[var(--accent-primary)] text-black border-[var(--accent-primary)] shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                    : 'bg-surface text-text-muted border-[#333] hover:text-white hover:border-[#555]'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Area — single centered column, card + buttons + AI panel stacked together */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-6 lg:px-10 py-4 overflow-y-auto">
        <div className="w-full max-w-3xl flex flex-col gap-4">

          <AnimatePresence>
            {showRatingFeedback && selectedRating !== null && (() => {
              const fb = RATING_FEEDBACK[selectedRating]
              return (
                <motion.div
                  key="rating-feedback"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 px-5 py-3 rounded-lg border bg-[#111]"
                  style={{ borderColor: fb.color }}
                >
                  <span
                    className="font-['Rajdhani'] font-bold uppercase tracking-widest text-sm"
                    style={{ color: fb.color }}
                  >
                    {fb.label}
                  </span>
                  <span className="text-[#888] font-['IBM_Plex_Mono'] text-xs">
                    {fb.message}
                  </span>
                </motion.div>
              )
            })()}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <StudyCard
              card={currentCard}
              currentIndex={currentIndex}
              isFlipped={isFlipped}
              swapTermDef={settings.swapTermDef}
              writtenMode={settings.writtenMode}
              writtenAnswer={writtenAnswer}
              writtenSubmitted={writtenSubmitted}
              writtenCorrect={writtenCorrect}
              isAutoplay={isAutoplay}
              isBookmarked={isBookmarked}
              onFlip={onFlip}
              onBookmarkToggle={onBookmarkToggle}
              onWrittenChange={onWrittenChange}
              onWrittenSubmit={onWrittenSubmit}
              onViewCard={onViewCard}
              onZoomImage={onZoomImage}
              onExplanationOpen={setExplanationOpen}
            />
          </AnimatePresence>

          {/* Rating row — only in study mode, opacity toggle, no layout shift */}
          {mode === 'study' && (
          <div className={`h-[84px] flex items-center justify-center w-full transition-opacity duration-200 ${explanationOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className={`flex gap-3 transition-opacity duration-150 ${(isFlipped || (settings.writtenMode && writtenSubmitted)) && !isAutoplay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
              {[
                { rating: 1, label: 'Again', sub: '< 1m', hint: 'Wrong or blank',         color: '#FF3333' },
                { rating: 2, label: 'Hard',  sub: '~5m',  hint: 'Right but struggled',    color: '#FFB800' },
                { rating: 3, label: 'Good',  sub: '~10m', hint: 'Right with some effort', color: '#00FF41' },
                { rating: 4, label: 'Easy',  sub: '4d+',  hint: 'Instant recall',         color: '#00BFFF' },
              ].map(({ rating, label, sub, hint, color }) => (
                <button
                  key={rating}
                  onClick={async () => {
                    if (selectedRating !== null) return
                    setSelectedRating(rating)
                    setShowRatingFeedback(true)
                    if (rating === 1) {
                      play('wrong')
                    } else {
                      play('correct')
                    }
                    await onRateCard(rating)
                  }}
                  disabled={isSubmitting || (selectedRating !== null && selectedRating !== rating)}
                  className={`px-5 py-2 border rounded transition-all flex flex-col items-center disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedRating === rating
                      ? 'bg-[#1a1a1a] scale-105 shadow-[0_0_12px_rgba(0,0,0,0.4)]'
                      : selectedRating !== null
                        ? 'bg-[#111] opacity-40 cursor-not-allowed'
                        : 'bg-[#111] hover:bg-[#161616] cursor-pointer'
                  }`}
                  style={{ borderColor: color, color }}
                >
                  <span className="font-['Rajdhani'] font-bold text-lg mb-0.5">{label}</span>
                  <span className="text-xs text-text-muted">{sub}</span>
                  <span className="text-[10px] text-[#555] mt-0.5 font-['IBM_Plex_Mono']">{hint}</span>
                </button>
              ))}
              {isSubmitting && (
                <div className="self-center ml-2 flex items-center gap-2 text-text-muted text-xs font-['Rajdhani'] animate-pulse">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Saving…
                </div>
              )}
            </div>
          </div>
          )}

          {mode === 'study' && showRatingFeedback && selectedRating !== null && !explanationOpen && (
            <div className="flex justify-center">
              {currentIndex < sessionCards.length - 1 ? (
                <button
                  onClick={() => {
                    onGoNext()
                    setTimeout(() => {
                      setSelectedRating(null)
                      setShowRatingFeedback(false)
                    }, 250)
                  }}
                  className="flex items-center gap-2 px-8 py-3 rounded-lg font-['Rajdhani'] font-bold uppercase tracking-widest text-sm border-2 transition-all hover:opacity-80 bg-[#111]"
                  style={{
                    borderColor: '#00FF41',
                    color: '#00FF41',
                    boxShadow: '0 0 12px rgba(0,255,65,0.2)'
                  }}
                >
                  Next Card <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onExit}
                  className="flex items-center gap-2 px-8 py-3 rounded-lg font-['Rajdhani'] font-bold uppercase tracking-widest text-sm border-2 transition-all hover:opacity-80 bg-[#111]"
                  style={{
                    borderColor: '#00FF41',
                    color: '#00FF41',
                    boxShadow: '0 0 12px rgba(0,255,65,0.2)'
                  }}
                >
                  Finish <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Utility row — opacity toggle, no layout shift */}
          <div className={`h-[40px] flex items-center justify-center gap-3 w-full transition-opacity duration-200 ${explanationOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className={`flex items-center gap-3 transition-opacity duration-150 ${utilityVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
              <button onClick={onGoPrev} disabled={currentIndex === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#333] rounded text-text-muted font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-border-base hover:border-[#555] transition-all disabled:opacity-30 disabled:cursor-default text-xs">
                <ArrowLeft className="w-3 h-3" /> Prev
              </button>
              {onGetContext && (
              <button onClick={onGetContext}
                className="flex items-center gap-2 px-4 py-2 border border-[rgba(255,255,255,0.3)] rounded text-[#CCCCCC] hover:text-white hover:border-text-muted transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs">
                <Copy className="w-3.5 h-3.5" /> Get Context
              </button>
              )}
              {onGetContext && onShowContext && (
              <button onClick={() => onShowContext(!showContext)}
                className="flex items-center gap-2 px-4 py-2 border border-[rgba(0,255,65,0.3)] rounded text-accent hover:bg-[rgba(0,255,65,0.08)] hover:border-accent transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs">
                <Sparkles className="w-3.5 h-3.5" /> Explain
              </button>
              )}
              <button onClick={onGoNext} disabled={currentIndex === sessionCards.length - 1}
                className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#333] rounded text-text-muted font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-border-base hover:border-[#555] transition-all disabled:opacity-30 disabled:cursor-default text-xs">
                Next <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* AI Context Panel — below buttons */}
          {showContext && onShowContext && isFlipped && currentCard && !settings.writtenMode && (() => {
            const term = getFrontText(currentCard, settings.swapTermDef)
            const definition = getCorrectAnswer(currentCard, settings.swapTermDef)
            return <FlashcardContextPanel term={term} definition={definition} onClose={() => onShowContext(false)} />
          })()}

        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 lg:p-10 cursor-zoom-out backdrop-blur-sm"
            onClick={() => onZoomImage(null)}
          >
            <button
              className="absolute top-6 right-6 text-text-muted hover:text-accent transition-colors p-2 bg-[#111] rounded-full border border-[#333] hover:border-accent"
              onClick={() => onZoomImage(null)}
              title="Close"
            >
              <X size={24} />
            </button>
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

      {/* Clipboard toast */}
      {showToast && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-surface border border-[#333] text-text-primary text-xs font-['Rajdhani'] uppercase tracking-widest px-5 py-3 rounded-lg shadow-2xl whitespace-nowrap">
          Context copied — paste into Gemini, ChatGPT, or Claude
        </div>
      )}
    </div>
  )
}
