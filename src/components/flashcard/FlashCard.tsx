import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, FlashcardData } from '../../types'
import { renderMath } from '../../lib/latex'

interface FlashCardProps {
  card: Card
  onRate: (rating: number) => void // 1: Again, 2: Hard, 3: Good, 4: Easy
}

const getContextColor = (difficulty: string) => {
  switch(difficulty) {
    case 'easy': return 'text-[#00FF41] border-[#00FF41]'
    case 'medium': return 'text-[#FFB800] border-[#FFB800]'
    case 'hard': return 'text-[#FF3333] border-[#FF3333]'
    default: return 'text-[#E8E8E8] border-[#E8E8E8]'
  }
}

export const FlashCard: React.FC<FlashCardProps> = ({ card, onRate }) => {
  const [isFlipped, setIsFlipped] = useState(false)
  const data = card.data as FlashcardData

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't flip if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setIsFlipped(prev => !prev)
      }
      
      if (isFlipped && e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        onRate(parseInt(e.key, 10))
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFlipped, onRate])

  // Reset flip when card changes
  useEffect(() => {
    setIsFlipped(false)
  }, [card.id])

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto h-[500px]">
      <div 
        className="relative w-full h-[380px] cursor-pointer"
        style={{ perspective: 1000 }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <motion.div
          className="w-full h-full"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 200, damping: 20 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div 
            className="absolute w-full h-full bg-[#161616] border border-[rgba(0,255,65,0.3)] shadow-[0_0_15px_rgba(0,255,65,0.1)] rounded-lg p-8 flex flex-col"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex justify-between items-start mb-4">
               <div className="flex gap-2">
                 {card.tags.map(tag => (
                   <span key={tag} className="px-2 py-1 text-xs font-['Rajdhani'] bg-[#111111] text-[#00FF41] rounded border border-[#161616] uppercase">
                     {tag}
                   </span>
                 ))}
               </div>
               <span className={`px-2 py-1 text-xs font-['Rajdhani'] uppercase border rounded ${getContextColor(card.difficulty)}`}>
                 {card.difficulty}
               </span>
            </div>
            
            <div className="flex-1 flex items-center justify-center text-center">
              <h2 
                className="text-2xl font-medium leading-relaxed" 
                dangerouslySetInnerHTML={{ __html: renderMath(data.front) }}
              />
            </div>
            
            <div className="text-center text-[#888888] text-sm mt-4 font-['Rajdhani']">
              Press SPACE or click to flip
            </div>
          </div>

          {/* Back */}
          <div 
            className="absolute w-full h-full bg-[#161616] border border-[#00FF41] shadow-[0_0_20px_rgba(0,255,65,0.2)] rounded-lg p-8 flex flex-col"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
             <div className="text-center text-[#888888] text-sm mb-4 font-['Rajdhani'] uppercase tracking-widest border-b border-[#111111] pb-2">
               Answer
             </div>
             <div className="flex-1 flex items-center justify-center text-center overflow-y-auto">
                <div 
                  className="text-xl leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: renderMath(data.back) }}
                />
             </div>
          </div>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <div className={`mt-8 flex gap-4 transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={() => onRate(1)} className="px-6 py-2 bg-[#111111] border border-[#FF3333] text-[#FF3333] rounded hover:bg-[#161616] transition-colors flex flex-col items-center group">
          <span className="font-['Rajdhani'] font-bold text-lg mb-1 group-hover:drop-shadow-[0_0_5px_rgba(255,51,51,0.5)]">Again</span>
          <span className="text-xs text-[#888888]">(1) &lt; 1m</span>
        </button>
        <button onClick={() => onRate(2)} className="px-6 py-2 bg-[#111111] border border-[#FFB800] text-[#FFB800] rounded hover:bg-[#161616] transition-colors flex flex-col items-center group">
          <span className="font-['Rajdhani'] font-bold text-lg mb-1 group-hover:drop-shadow-[0_0_5px_rgba(255,184,0,0.5)]">Hard</span>
          <span className="text-xs text-[#888888]">(2) 5m</span>
        </button>
        <button onClick={() => onRate(3)} className="px-6 py-2 bg-[#111111] border border-[#00FF41] text-[#00FF41] rounded hover:bg-[#161616] transition-colors flex flex-col items-center group">
          <span className="font-['Rajdhani'] font-bold text-lg mb-1 group-hover:drop-shadow-[0_0_5px_rgba(0,255,65,0.5)]">Good</span>
          <span className="text-xs text-[#888888]">(3) 10m</span>
        </button>
        <button onClick={() => onRate(4)} className="px-6 py-2 bg-[#111111] border border-[#00BFFF] text-[#00BFFF] rounded hover:bg-[#161616] transition-colors flex flex-col items-center group">
          <span className="font-['Rajdhani'] font-bold text-lg mb-1 group-hover:drop-shadow-[0_0_5px_rgba(0,191,255,0.5)]">Easy</span>
          <span className="text-xs text-[#888888]">(4) 4d</span>
        </button>
      </div>

    </div>
  )
}
