import React, { useEffect } from 'react'
import { Card } from '../../types'
import { FlashCard } from './FlashCard'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, CheckCircle } from 'lucide-react'
import { useSessionStore } from '../../store/useSessionStore'

interface FlashDeckProps {
  cards: Card[]
  onComplete?: () => void
}

export const FlashDeck: React.FC<FlashDeckProps> = ({ cards, onComplete }) => {
  const { currentIndex, isFinished, rateCard, startSession } = useSessionStore()

  useEffect(() => {
    if (isFinished && onComplete) {
      onComplete()
    }
  }, [isFinished, onComplete])

  const restart = () => {
    startSession(cards)
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-[#888888]">
        No cards available for this topic.
      </div>
    )
  }

  const currentCard = cards[currentIndex]

  return (
    <div className="w-full max-w-4xl mx-auto py-6 mt-8">
      
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex justify-between items-center text-sm font-['Rajdhani'] uppercase tracking-wider text-[#888888]">
          <span>{isFinished ? 'Session Complete' : `Card ${currentIndex + 1} of ${cards.length}`}</span>
          {!isFinished && <span>{Math.round((currentIndex / cards.length) * 100)}%</span>}
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
              {currentCard && <FlashCard card={currentCard} onRate={rateCard} />}
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
                You reviewed {cards.length} cards. Next reviews are scheduled!
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
