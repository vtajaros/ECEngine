import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, MCQData } from '../../types'
import { renderMath } from '../../lib/latex'
import { CheckCircle2, XCircle } from 'lucide-react'

interface MCQCardProps {
  card: Card
  onAnswer: (isCorrect: boolean) => void
  onNext: () => void
}

const getContextColor = (difficulty: string) => {
  switch (difficulty) {
    case 'easy': return 'text-[#00FF41] border-[#00FF41]'
    case 'medium': return 'text-[#FFB800] border-[#FFB800]'
    case 'hard': return 'text-[#FF3333] border-[#FF3333]'
    default: return 'text-[#E8E8E8] border-[#E8E8E8]'
  }
}

export const MCQCard: React.FC<MCQCardProps> = ({ card, onNext, onAnswer }) => {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const data = card.data as MCQData

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't respond if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (selectedChoice === null) {
        const key = e.key.toUpperCase()
        if (key === 'A' || key === '1') handleSelect(0)
        if (key === 'B' || key === '2') handleSelect(1)
        if (key === 'C' || key === '3') handleSelect(2)
        if (key === 'D' || key === '4') handleSelect(3)
      } else if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedChoice, onNext])

  // Reset when card changes
  useEffect(() => {
    setSelectedChoice(null)
  }, [card.id])

  const handleSelect = (index: number) => {
    if (selectedChoice !== null) return // Prevent multiple selections
    setSelectedChoice(index)
    onAnswer(index === data.answer)
  }

  const letters = ['A', 'B', 'C', 'D']

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto my-4">
      
      {/* Target Question Card */}
      <div className="w-full bg-[#161616] border border-[#111111] shadow-xl rounded-lg p-5 flex flex-col mb-4 relative">
        <div className="absolute top-0 right-8 px-4 py-1 -translate-y-1/2 bg-[#0D0D0D] border border-t-0 rounded-b-md text-xs font-['Rajdhani'] uppercase tracking-widest text-[#00FF41]">
          {card.tags[0] || 'Topic'}
        </div>
        
        <div className="flex justify-between items-center mb-4">
          <div className="text-[#888888] font-['Rajdhani'] text-sm tracking-wider uppercase">
            Question
          </div>
          <span className={`px-2 py-1 text-xs font-['Rajdhani'] uppercase border rounded ${getContextColor(card.difficulty)}`}>
            {card.difficulty}
          </span>
        </div>

        <div 
          className="text-xl font-medium leading-relaxed text-[#E8E8E8]"
          dangerouslySetInnerHTML={{ __html: renderMath(data.question) }}
        />
        
        {data.yearAsked && (
           <div className="mt-3 text-[#888888] text-xs text-right font-['Rajdhani']">
             Board Exam {data.yearAsked}
           </div>
        )}
      </div>

      {/* Choices */}
      <div className="w-full grid grid-cols-1 gap-3 select-none">
        {data.choices.map((choice, index) => {
          const isSelected = selectedChoice === index
          const isCorrectAnswer = index === data.answer
          const showResult = selectedChoice !== null
          
          let btnClass = 'bg-[#111111] border border-[#161616] text-[#888888] hover:border-[rgba(0,255,65,0.3)] hover:text-[#E8E8E8]'
          
          if (showResult) {
            if (isCorrectAnswer) {
              btnClass = 'bg-[rgba(0,255,65,0.1)] border-[#00FF41] text-[#E8E8E8] shadow-[0_0_15px_rgba(0,255,65,0.2)]'
            } else if (isSelected) {
              btnClass = 'bg-[rgba(255,51,51,0.1)] border-[#FF3333] text-[#E8E8E8] shadow-[0_0_15px_rgba(255,51,51,0.2)]'
            } else {
              btnClass = 'bg-[#0D0D0D] border-[#161616] text-[#444] opacity-50'
            }
          }

          return (
            <motion.button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={showResult}
              whileTap={!showResult ? { scale: 0.98 } : {}}
              className={`w-full text-left p-3 rounded-lg flex items-center transition-all duration-300 ${btnClass}`}
            >
              <div className={`w-6 h-6 flex items-center justify-center rounded border font-['Rajdhani'] font-bold text-sm mr-3 flex-shrink-0 ${
                showResult && isCorrectAnswer ? 'bg-[#00FF41] text-[#0D0D0D] border-[#00FF41]' :
                showResult && isSelected ? 'bg-[#FF3333] text-[#E8E8E8] border-[#FF3333]' :
                'border-[#444] text-[#888888]'
              }`}>
                {letters[index]}
              </div>
              <div 
                className="flex-1 text-base font-medium tracking-wide"
                dangerouslySetInnerHTML={{ __html: renderMath(choice) }}
              />
              {showResult && isCorrectAnswer && <CheckCircle2 className="text-[#00FF41] ml-3 flex-shrink-0" size={20} />}
              {showResult && isSelected && !isCorrectAnswer && <XCircle className="text-[#FF3333] ml-3 flex-shrink-0" size={20} />}
            </motion.button>
          )
        })}
      </div>

      {/* Explanation Panel */}
      <AnimatePresence>
        {selectedChoice !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            className="w-full mt-4 bg-[#161616] border-l-4 border-[#00BFFF] p-5 rounded relative overflow-hidden"
          >
             <h3 className="font-['Rajdhani'] font-bold text-[#00BFFF] text-base uppercase tracking-wider mb-2">
               Explanation
             </h3>
             <div 
               className="text-[#E8E8E8] text-base leading-relaxed mb-4"
               dangerouslySetInnerHTML={{ __html: renderMath(data.explanation) }}
             />
             
             <div className="flex justify-end">
               <button 
                 onClick={onNext}
                 className="px-6 py-2 bg-[#00FF41] text-[#0D0D0D] rounded font-['Rajdhani'] font-bold text-base hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_15px_rgba(0,255,65,0.4)] transition-all flex items-center"
               >
                 Next (Enter)
               </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
