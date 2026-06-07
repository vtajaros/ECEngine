import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, FlashcardData } from '../../types'
import { FlashCard } from './FlashCard'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, CheckCircle } from 'lucide-react'
import { useSessionStore } from '../../store/useSessionStore'
import { useSound } from '../../hooks/useSound'
import { useTTS } from '../../hooks/useTTS'

interface FlashDeckProps {
  cards: Card[]
  onComplete?: () => void
  /**
   * Whether TTS is enabled for this session.
   * Passed down from FlashcardStudy → FlashDeck → FlashCard (onFlip callback).
   * Defaults to false — no speech without explicit opt-in.
   */
  ttsEnabled?: boolean
  shuffleCards?: boolean
  swappedTerms?: boolean
  autoplay?: boolean
  autoplayDelay?: number
}

export const FlashDeck: React.FC<FlashDeckProps> = ({
  cards,
  onComplete,
  ttsEnabled = false,
  shuffleCards = false,
  swappedTerms = false,
  autoplay = false,
  autoplayDelay = 5,
}) => {
  const { play } = useSound()
  const { currentIndex, isFinished, isSubmitting, rateCard, startSession } = useSessionStore()
  const [isSwapped, setIsSwapped] = useState(false)
  const [swapResetKey, setSwapResetKey] = useState(0)

  // Shuffle on session start if enabled
  const activeCards = useMemo(() => {
    if (!shuffleCards) return cards
    return [...cards].sort(() => Math.random() - 0.5)
  }, [cards, shuffleCards])

  // Autoplay
  useEffect(() => {
    if (!autoplay || isFinished) return
    const timer = setInterval(() => {
      // Advance by triggering the "Good" rating
      if (!isSubmitting) rateCard(3)
    }, autoplayDelay * 1000)
    return () => clearInterval(timer)
  }, [autoplay, autoplayDelay, currentIndex, isFinished, isSubmitting, rateCard])

  // ── TTS ────────────────────────────────────────────────────────────────────
  const { speak, stop } = useTTS(ttsEnabled)

  useEffect(() => {
    if (isFinished) {
      play('finish')
      if (onComplete) onComplete()
    }
  }, [isFinished, onComplete, play])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'f' || e.key === 'F') {
        setIsSwapped(prev => !prev)
        setSwapResetKey(k => k + 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const restart = () => {
    startSession(activeCards)
  }

  if (!activeCards || activeCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-[#888888]">
        No cards available for this topic.
      </div>
    )
  }

  const currentCard = activeCards[currentIndex]

  const displayCard = useMemo(() => {
    if (!currentCard) return null
    const effectiveSwapped = swappedTerms || isSwapped
    if (!effectiveSwapped || currentCard.type !== 'flashcard') return currentCard
    const data = currentCard.data as FlashcardData
    return {
      ...currentCard,
      data: {
        ...data,
        front: data.back,
        back: data.front
      }
    }
  }, [currentCard, isSwapped, swappedTerms])

  // ── TTS: read front face text when a new card appears ─────────────────────
  // Fires on card change. After a swap toggle we also re-read because the
  // front text has changed (swapResetKey increments on swap).
  useEffect(() => {
    if (!displayCard || isFinished) return
    if (displayCard.type !== 'flashcard') return
    const data = displayCard.data as FlashcardData
    if (data.front) speak(data.front)
  }, [displayCard?.id, swapResetKey, isFinished])
  // NOTE: `speak` omitted from deps intentionally — stable callback, adding it
  // causes double-fire. Trigger is card identity + swap key.

  // ── TTS: read back face text when card is flipped ─────────────────────────
  // onFlip is called by FlashCard whenever the flip state changes. We only
  // speak on flip-to-back (isFlipped === true). Flip-to-front is a reset,
  // not a new card — no re-read needed.
  const handleFlip = useCallback((isFlipped: boolean) => {
    if (!isFlipped) return
    if (!displayCard || displayCard.type !== 'flashcard') return
    const data = displayCard.data as FlashcardData
    if (data.back) speak(data.back)
  }, [displayCard, speak])

  return (
    <div className="w-full max-w-4xl mx-auto py-6 mt-8">

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex justify-between items-center text-sm font-['Rajdhani'] uppercase tracking-wider text-[#888888]">
          <div className="flex items-center gap-4">
            <span>{isFinished ? 'Session Complete' : `Card ${currentIndex + 1} of ${activeCards.length}`}</span>
            <button
              onClick={() => { setIsSwapped(!isSwapped); setSwapResetKey(k => k + 1); }}
              className={`flex items-center gap-2 px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${isSwapped
                ? 'bg-[#00FF41]/20 text-[#00FF41] border-[#00FF41]'
                : 'bg-[#1A1A1A] text-[#888] border-[#333] hover:border-[#555] hover:text-[#E8E8E8]'
                }`}
              title="Toggle Term/Definition Swap (Shortcut: F)"
            >
              {isSwapped ? 'SWAPPED (DEF → TERM)' : 'SWAP TERM/DEF'}
            </button>
          </div>
          {!isFinished && <span>{Math.round((currentIndex / activeCards.length) * 100)}%</span>}
        </div>
      </div>

      {/* Main Area */}
      <div className="relative min-h-[500px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!isFinished ? (
            <motion.div
              key={currentCard?.id || 'empty'}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              {displayCard && (
                <FlashCard
                  key={`${displayCard.id}_${swapResetKey}`}
                  card={displayCard}
                  onRate={rateCard}
                  isSubmitting={isSubmitting}
                  onFlip={handleFlip}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#161616] p-10 rounded-lg border border-[rgba(0,255,65,0.3)] shadow-[0_0_20px_rgba(0,255,65,0.2)] flex flex-col items-center max-w-sm w-full text-center"
            >
              <CheckCircle className="text-[#00FF41] w-16 h-16 mb-4" />
              <h2 className="text-2xl font-bold font-['Orbitron'] text-[#E8E8E8] mb-2">Deck Finished</h2>
              <p className="text-[#888888] mb-8 font-['Rajdhani'] text-lg">
                You reviewed {activeCards.length} cards. Next reviews are scheduled!
              </p>
              <button
                onClick={restart}
                className="w-full py-3 bg-[#111111] text-[#00FF41] border border-[#00FF41] rounded hover:bg-[rgba(0,255,65,0.1)] transition-colors flex items-center justify-center font-['Rajdhani'] text-lg tracking-wider"
              >
                <RefreshCw size={18} className="mr-2" />
                Review Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  )
}