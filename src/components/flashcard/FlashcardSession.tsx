import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings2, X, ArrowLeft, ArrowRight, RotateCcw, Play, Pause,
         Volume2, VolumeX, Copy, Sparkles } from 'lucide-react'
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal'
import { StudyCard, getFrontText, getCorrectAnswer } from './StudyCard'
import { FlashcardContextPanel } from './FlashcardContextPanel'
import { useSessionStore } from '../../store/useSessionStore'
import type { Card } from '../../types'

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
  showContext: boolean
  zoomedImage: string | null
  showToast: boolean
  showExitConfirm: boolean
  blockerState: 'unblocked' | 'blocked' | 'proceeding'
  progress: number
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
  onShowContext: (v: boolean) => void
  onRateCard: (rating: number) => void
  onGetContext: () => void
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
  autoplaySpeechDoneRef
}: FlashcardSessionProps) {
  return (
    <div className="h-full bg-[#0D0D0D] flex flex-col overflow-hidden relative">
      {/* Top Bar */}
      <div className="shrink-0 bg-[#111] border-b border-[#222] px-6 py-4 flex items-center justify-between z-20">
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
          <button onClick={() => onSetExitConfirm(true)} className="text-[#888] hover:text-white transition-colors p-2 rounded hover:bg-[#222]" title="Exit">
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="text-[var(--accent-primary)] font-['Rajdhani'] font-bold tracking-widest text-base uppercase">{activeDeck.title}</span>
            <span className="text-[#E8E8E8] text-xs font-['Rajdhani'] font-bold uppercase tracking-widest">Card {currentIndex + 1} of {sessionCards.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {settings.writtenMode && (
            <span className="text-xs font-['IBM_Plex_Mono'] text-[#888] bg-[#1a1a1a] px-3 py-1 rounded border border-[#333]">
              Accuracy: <span className="text-[var(--accent-primary)]">{writtenStats.total > 0 ? Math.round((writtenStats.correct / writtenStats.total) * 100) : 0}%</span>
            </span>
          )}
          {/* Swap Term/Def toggle button — always visible */}
          <button
            onClick={onSwapTermDef}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${settings.swapTermDef
              ? 'bg-[#00FF41]/20 text-[#00FF41] border-[#00FF41]'
              : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:border-[#555] hover:text-[#E8E8E8]'
              }`}
            title="Swap Term / Definition (Shortcut: F)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {settings.swapTermDef ? 'SWAPPED' : 'SWAP'}
          </button>
          {!settings.writtenMode && (
            <button
              onClick={onToggleAutoplay}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${isAutoplay
                ? 'bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41] shadow-[0_0_8px_rgba(0,255,65,0.3)]'
                : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:border-[#555] hover:text-[#E8E8E8]'
                }`}
              title="Autoplay"
            >
              {isAutoplay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              AUTO
            </button>
          )}
          <button
            onClick={onToggleTTS}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${fcTtsEnabled ? 'border-[#00FF41] text-[#00FF41] bg-[#00FF41]/10' : 'border-[#333] text-[#888] hover:text-[#E8E8E8] hover:border-[#555]'}`}
            title={fcTtsEnabled ? 'TTS On — click to disable' : 'TTS Off — click to enable'}
          >
            {fcTtsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onToggleSettings}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${showSettings ? 'bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]' : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:border-[#555] hover:text-[#E8E8E8]'}`}
            title="Settings"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="shrink-0 w-full bg-[#1a1a1a] h-[4px]">
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
                    : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:text-white hover:border-[#555]'
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
            />
          </AnimatePresence>

          {/* Rating row — opacity toggle, no layout shift */}
          <div className="h-[84px] flex items-center justify-center w-full">
            <div className={`flex gap-3 transition-opacity duration-150 ${(isFlipped || (settings.writtenMode && writtenSubmitted)) && !isAutoplay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
              {[
                { rating: 1, label: 'Again', sub: '< 1m', hint: 'Wrong or blank',         color: '#FF3333' },
                { rating: 2, label: 'Hard',  sub: '~5m',  hint: 'Right but struggled',    color: '#FFB800' },
                { rating: 3, label: 'Good',  sub: '~10m', hint: 'Right with some effort', color: '#00FF41' },
                { rating: 4, label: 'Easy',  sub: '4d+',  hint: 'Instant recall',         color: '#00BFFF' },
              ].map(({ rating, label, sub, hint, color }) => (
                <button
                  key={rating}
                  onClick={() => onRateCard(rating)}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#111] border rounded transition-colors flex flex-col items-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#161616]"
                  style={{ borderColor: color, color }}
                >
                  <span className="font-['Rajdhani'] font-bold text-lg mb-0.5">{label}</span>
                  <span className="text-xs text-[#888]">{sub}</span>
                  <span className="text-[10px] text-[#555] mt-0.5 font-['IBM_Plex_Mono']">{hint}</span>
                </button>
              ))}
              {isSubmitting && (
                <div className="self-center ml-2 flex items-center gap-2 text-[#888] text-xs font-['Rajdhani'] animate-pulse">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Saving…
                </div>
              )}
            </div>
          </div>

          {/* Utility row — opacity toggle, no layout shift */}
          <div className="h-[40px] flex items-center justify-center gap-3 w-full">
            <div className={`flex items-center gap-3 transition-opacity duration-150 ${(isFlipped || (settings.writtenMode && writtenSubmitted)) && !isAutoplay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
              <button onClick={onGoPrev} disabled={currentIndex === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#333] rounded text-[#888] font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[#222] hover:border-[#555] transition-all disabled:opacity-30 disabled:cursor-default text-xs">
                <ArrowLeft className="w-3 h-3" /> Prev
              </button>
              <button onClick={onGetContext}
                className="flex items-center gap-2 px-4 py-2 border border-[rgba(255,255,255,0.3)] rounded text-[#CCCCCC] hover:text-white hover:border-[#888] transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs">
                <Copy className="w-3.5 h-3.5" /> Get Context
              </button>
              <button onClick={() => onShowContext(!showContext)}
                className="flex items-center gap-2 px-4 py-2 border border-[rgba(0,255,65,0.3)] rounded text-[#00FF41] hover:bg-[rgba(0,255,65,0.08)] hover:border-[#00FF41] transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs">
                <Sparkles className="w-3.5 h-3.5" /> Explain
              </button>
              <button onClick={onGoNext} disabled={currentIndex === sessionCards.length - 1}
                className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#333] rounded text-[#888] font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[#222] hover:border-[#555] transition-all disabled:opacity-30 disabled:cursor-default text-xs">
                Skip <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* AI Context Panel — below buttons */}
          {showContext && isFlipped && currentCard && !settings.writtenMode && (() => {
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
              className="absolute top-6 right-6 text-[#888] hover:text-[#00FF41] transition-colors p-2 bg-[#111] rounded-full border border-[#333] hover:border-[#00FF41]"
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
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-[#1a1a1a] border border-[#333] text-[#E8E8E8] text-xs font-['Rajdhani'] uppercase tracking-widest px-5 py-3 rounded-lg shadow-2xl whitespace-nowrap">
          Context copied — paste into Gemini, ChatGPT, or Claude
        </div>
      )}
    </div>
  )
}
