import React, { useState } from 'react'
import { Card } from '../../types'
import { MCQCard } from './MCQCard'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Trophy, AlertTriangle } from 'lucide-react'

interface MCQDeckProps {
  cards: Card[]
  onComplete?: () => void
}

export const MCQDeck: React.FC<MCQDeckProps> = ({ cards, onComplete }) => {
  const [activeCards, setActiveCards] = useState<Card[]>(cards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [isDone, setIsDone] = useState(false)
  const [wrongItems, setWrongItems] = useState<Card[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAnswer = (isCorrect: boolean) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      if (isCorrect) {
        setScore(prev => prev + 1)
      } else {
        setWrongItems(prev => [...prev, activeCards[currentIndex]])
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    if (isSubmitting) return
    if (currentIndex < activeCards.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      setIsDone(true)
      if (onComplete) onComplete()
    }
  }

  const restart = () => {
    setActiveCards(cards)
    setCurrentIndex(0)
    setScore(0)
    setWrongItems([])
    setIsDone(false)
  }

  const retryWrong = () => {
    if (wrongItems.length === 0) return
    setActiveCards(wrongItems)
    setCurrentIndex(0)
    setScore(0)
    setWrongItems([])
    setIsDone(false)
  }

  if (!activeCards || activeCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-[#888888]">
        No MCQs available for this topic.
      </div>
    )
  }

  const currentCard = activeCards[currentIndex]
  const progress = ((currentIndex) / activeCards.length) * 100
  const percentage = Math.round((score / activeCards.length) * 100)
  const passed = percentage >= 75

  return (
    <div className="w-full max-w-4xl mx-auto py-6">
      
      {/* Header and Progress */}
      <div className="mb-8 flex flex-col gap-3">
        <div className="flex justify-between items-center text-sm font-['Rajdhani'] uppercase tracking-wider text-[#888888]">
          <span>{isDone ? 'Session Complete' : `Question ${currentIndex + 1} of ${activeCards.length}`}</span>
          {!isDone && (
            <div className="flex items-center gap-4">
              <span className="text-[#E8E8E8] font-bold">Score: {score} / {activeCards.length}</span>
              <span>{Math.round((currentIndex / activeCards.length) * 100)}% Complete</span>
            </div>
          )}
        </div>
        {!isDone && (
          <div className="w-full bg-[#111111] h-1.5 rounded-full overflow-hidden border border-[#161616]">
            <motion.div 
              className="bg-[#00BFFF] h-full shadow-[0_0_8px_rgba(0,191,255,0.8)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* Main Area */}
      <div className="relative min-h-[500px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!isDone ? (
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <MCQCard 
                card={currentCard} 
                onAnswer={handleAnswer} 
                onNext={handleNext} 
              />
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#161616] p-10 rounded-lg border shadow-xl flex flex-col items-center max-w-md w-full text-center"
              style={{ borderColor: passed ? 'rgba(0,255,65,0.3)' : 'rgba(255,51,51,0.3)' }}
            >
              {passed ? (
                <Trophy className="text-[#00FF41] w-20 h-20 mb-4 drop-shadow-[0_0_10px_rgba(0,255,65,0.5)]" />
              ) : (
                <AlertTriangle className="text-[#FF3333] w-20 h-20 mb-4 drop-shadow-[0_0_10px_rgba(255,51,51,0.5)]" />
              )}
              
              <h2 className="text-3xl font-bold font-['Orbitron'] text-[#E8E8E8] mb-2">
                {passed ? 'Passed!' : 'Failed.'}
              </h2>
              
              <div className="text-5xl font-['Rajdhani'] font-bold mb-6" style={{ color: passed ? '#00FF41' : '#FF3333' }}>
                {percentage}%
              </div>
              
              <p className="text-[#888888] mb-8 font-['Rajdhani'] text-lg">
                You got {score} out of {activeCards.length} correct. The passing score is 75%.
              </p>
              
              <div className="flex gap-4 w-full">
                <button 
                  onClick={restart}
                  className="flex-1 py-3 bg-[#111111] text-[#E8E8E8] border border-[#444] rounded hover:bg-[#161616] transition-colors flex items-center justify-center font-['Rajdhani'] text-lg tracking-wider"
                >
                  <RefreshCw size={18} className="mr-2" />
                  Restart
                </button>
                {wrongItems.length > 0 && (
                  <button 
                    onClick={retryWrong}
                    className="flex-1 py-3 bg-[#111111] text-[#FFB800] border border-[#FFB800] rounded hover:bg-[rgba(255,184,0,0.1)] transition-colors flex items-center justify-center font-['Rajdhani'] text-lg tracking-wider"
                  >
                    Retry Wrong
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  )
}
