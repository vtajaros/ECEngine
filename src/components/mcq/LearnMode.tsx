import React, { useState, useEffect, useCallback } from 'react'
import { Card, MCQData } from '../../types'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, Play, AlertCircle, ArrowRight, Flag } from 'lucide-react'

// Partitioned learning mode handling the custom "LEARN" flow

interface LearnModeProps {
  cards: Card[]
  title?: string
  onComplete: (stats: { correct: number; wrong: number; bookmarked: number }) => void
  onExit: () => void
}

type QuestionStatus = 'unanswered' | 'correct' | 'wrong'
type ViewState = 'question' | 'feedback' | 'partition-complete' | 'summary'

export const LearnMode: React.FC<LearnModeProps> = ({ cards, title, onComplete, onExit }) => {
  // Partitioning logic
  const PARTITION_SIZE = 5
  
  // Create partitions initially
  const [partitions, setPartitions] = useState<Card[][]>([])
  const [currentPartitionIndex, setCurrentPartitionIndex] = useState(0)
  
  // Specific to current partition
  const [activeQueue, setActiveQueue] = useState<Card[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  
  // State for current card
  const [viewState, setViewState] = useState<ViewState>('question')
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(null)
  const [choiceStatus, setChoiceStatus] = useState<QuestionStatus>('unanswered')
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  
  // Tracking
  const [partitionWrongIds, setPartitionWrongIds] = useState<Set<string>>(new Set())
  const [globalStats, setGlobalStats] = useState({ correctFirstTry: 0, wrongFirstTry: 0 })

  // Initialize
  useEffect(() => {
    if (!cards || cards.length === 0) return
    const newPartitions: Card[][] = []
    for (let i = 0; i < cards.length; i += PARTITION_SIZE) {
      newPartitions.push(cards.slice(i, i + PARTITION_SIZE))
    }
    setPartitions(newPartitions)
    setActiveQueue([...newPartitions[0]])
    setCurrentPartitionIndex(0)
    setCurrentCardIndex(0)
    setPartitionWrongIds(new Set())
    setViewState('question')
  }, [cards])

  const currentCard = activeQueue[currentCardIndex]
  const isMcq = currentCard?.type === 'mcq'
  const mcqData = currentCard?.data as MCQData

  // Keyboard controls
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (viewState === 'feedback') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      }
      return
    }
    
    if (viewState === 'partition-complete') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        startNextPartitionPhase()
      }
      return
    }

    if (viewState === 'question' && isMcq && mcqData?.choices) {
      const key = e.key.toLowerCase()
      let mappedIndex = -1
      
      if (key === '1' || key === 'a') mappedIndex = 0
      if (key === '2' || key === 'b') mappedIndex = 1
      if (key === '3' || key === 'c') mappedIndex = 2
      if (key === '4' || key === 'd') mappedIndex = 3
      
      if (mappedIndex >= 0 && mappedIndex < mcqData.choices.length) {
        submitAnswer(mappedIndex)
      }
    }
  }, [viewState, isMcq, mcqData])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const toggleBookmark = () => {
    if (!currentCard) return
    setBookmarkedIds(prev => {
      const next = new Set(prev)
      if (next.has(currentCard.id)) next.delete(currentCard.id)
      else next.add(currentCard.id)
      return next
    })
  }

  const submitAnswer = (choiceIdx: number | 'idk') => {
    if (viewState !== 'question') return
    
    const isIdk = choiceIdx === 'idk'
    const isCorrect = !isIdk && choiceIdx === mcqData.answer

    setSelectedChoiceIndex(isIdk ? null : choiceIdx)
    
    if (isCorrect) {
      setChoiceStatus('correct')
      if (!partitionWrongIds.has(currentCard.id)) {
        setGlobalStats(s => ({ ...s, correctFirstTry: s.correctFirstTry + 1 }))
      }
    } else {
      setChoiceStatus('wrong')
      setPartitionWrongIds(prev => new Set(prev).add(currentCard.id))
      // Only penalize global score if it's the first time seeing it
      if (!partitionWrongIds.has(currentCard.id)) {
        setGlobalStats(s => ({ ...s, wrongFirstTry: s.wrongFirstTry + 1 }))
      }
    }
    
    setViewState('feedback')
  }

  const handleNext = () => {
    setViewState('question')
    setSelectedChoiceIndex(null)
    setChoiceStatus('unanswered')

    if (currentCardIndex < activeQueue.length - 1) {
      setCurrentCardIndex(prev => prev + 1)
    } else {
      // Reached end of partition queue
      handleEndOfQueue()
    }
  }

  const handleEndOfQueue = () => {
    if (partitionWrongIds.size === 0) {
      // All correct!
      setViewState('partition-complete')
    } else {
      // Retry wrong ones
      const nextQueue = activeQueue.filter(c => partitionWrongIds.has(c.id))
      setActiveQueue(nextQueue)
      setCurrentCardIndex(0)
      setPartitionWrongIds(new Set()) // Reset wrong tracking for this retry loop
      setViewState('question')
    }
  }

  const startNextPartitionPhase = () => {
    const nextIdx = currentPartitionIndex + 1
    if (nextIdx < partitions.length) {
      // Load next partition
      setCurrentPartitionIndex(nextIdx)
      setActiveQueue([...partitions[nextIdx]])
      setCurrentCardIndex(0)
      setPartitionWrongIds(new Set())
      setViewState('question')
      setSelectedChoiceIndex(null)
      setChoiceStatus('unanswered')
    } else {
      // Finished everything
      setViewState('summary')
      onComplete({
        correct: globalStats.correctFirstTry,
        wrong: globalStats.wrongFirstTry,
        bookmarked: bookmarkedIds.size
      })
    }
  }

  if (!cards || cards.length === 0) return null

  // RENDER SUMMARY
  if (viewState === 'summary') {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full bg-[#0D0D0D]">
        <div className="bg-[#161616] p-10 rounded-lg border border-[var(--accent-primary)] shadow-[0_0_30px_rgba(0,255,65,0.2)] max-w-md w-full text-center">
          <Flag className="w-16 h-16 text-[var(--accent-primary)] mx-auto mb-4" />
          <h2 className="text-3xl font-['Orbitron'] font-bold text-white mb-6 tracking-wider">LEARNING <span className="text-[var(--accent-primary)]">COMPLETE</span></h2>
          
          <div className="space-y-4 mb-8 text-left font-['IBM_Plex_Mono']">
            <div className="flex justify-between bg-[#111] p-3 rounded border border-[#222]">
              <span className="text-[#888]">Mastered (1st Try):</span>
              <span className="text-[var(--accent-primary)] font-bold">{globalStats.correctFirstTry}</span>
            </div>
            <div className="flex justify-between bg-[#111] p-3 rounded border border-[#222]">
              <span className="text-[#888]">Needed Retry:</span>
              <span className="text-[#FF3333] font-bold">{globalStats.wrongFirstTry}</span>
            </div>
            <div className="flex justify-between bg-[#111] p-3 rounded border border-[#222]">
              <span className="text-[#888]">Bookmarked:</span>
              <span className="text-[#FFB800] font-bold">{bookmarkedIds.size}</span>
            </div>
          </div>
          
          <button onClick={onExit} className="w-full py-4 bg-[var(--accent-primary)] text-black font-['Rajdhani'] font-bold text-lg uppercase tracking-widest rounded hover:bg-[var(--accent-dim)] transition-colors">
            Return to Study Hub
          </button>
        </div>
      </div>
    )
  }

  // RENDER PARTITION COMPLETE
  if (viewState === 'partition-complete') {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full bg-[#0D0D0D]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#161616] p-10 rounded-lg border border-[#333] flex flex-col items-center max-w-md w-full"
        >
          <div className="w-20 h-20 rounded-full bg-[var(--accent-glow)] flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-[var(--accent-primary)]" />
          </div>
          <h2 className="text-2xl font-['Orbitron'] font-bold text-white mb-2">Partition {currentPartitionIndex + 1} Cleared!</h2>
          <p className="text-[#888] font-['IBM_Plex_Mono'] text-center mb-8">You've successfully mastered this block of {partitions[currentPartitionIndex].length} cards.</p>
          
          <button 
            onClick={startNextPartitionPhase}
            className="w-full py-3 bg-[#111] border border-[var(--accent-primary)] text-[var(--accent-primary)] font-['Rajdhani'] font-bold text-lg uppercase tracking-widest rounded hover:bg-[var(--accent-glow)] transition-colors flex items-center justify-center"
          >
            Continue <ArrowRight className="ml-2 w-5 h-5" />
          </button>
        </motion.div>
      </div>
    )
  }

  // RENDER QUESTION OR FEEDBACK
  if (!currentCard || !isMcq) return <div className="text-white p-8">Only MCQ implemented for Learn Mode stub.</div>

  const isBookmarked = bookmarkedIds.has(currentCard.id)

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D] p-6 lg:p-10 relative">
      <div className="max-w-4xl w-full mx-auto flex justify-between items-center mb-6">
        <div>
          <div className="text-[#888] font-['IBM_Plex_Mono'] text-sm tracking-widest uppercase mb-1">
            Partition {currentPartitionIndex + 1} / {partitions.length}
          </div>
          <div className="flex gap-1 mt-2">
            {activeQueue.map((c, i) => (
              <div 
                key={i} 
                className={`w-8 h-1.5 rounded-full ${i === currentCardIndex ? 'bg-[var(--accent-primary)] shadow-[0_0_8px_rgba(0,255,65,0.6)]' : i < currentCardIndex ? 'bg-[#333]' : 'bg-[#1a1a1a]'}`} 
              />
            ))}
          </div>
        </div>
        
        <button onClick={onExit} className="px-4 py-2 border border-[#333] text-[#888] rounded hover:text-white hover:border-[#666] transition-colors font-['Rajdhani'] uppercase tracking-widest text-sm">
          Exit Learn Mode
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <motion.div 
          key={currentCard.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl bg-[#161616] border border-[#222] rounded-xl shadow-2xl p-8 relative flex flex-col"
        >
          {/* Bookmark Togggle */}
          <button 
            onClick={toggleBookmark}
            className="absolute top-6 right-6 text-[#666] hover:text-[var(--warning)] transition-colors"
            title="Bookmark"
          >
            <Bookmark className={`w-6 h-6 ${isBookmarked ? 'fill-[#FFB800] text-[#FFB800]' : ''}`} />
          </button>

          <div className="mb-10 pr-12">
            <span className="text-[var(--accent-primary)] font-['IBM_Plex_Mono'] text-sm font-bold tracking-widest mb-3 block">Question</span>
            <h3 className="text-2xl text-white font-medium leading-relaxed">
              {mcqData.question}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-8">
            {mcqData.choices?.map((choice: string, idx: number) => {
              
              let btnClass = "border-[#222] bg-[#111] text-[#E8E8E8] hover:border-[var(--accent-dim)] hover:bg-[var(--accent-glow)] cursor-pointer"
              let prefixClass = "text-[#666]"

              if (viewState === 'feedback') {
                if (idx === mcqData.answer) {
                  btnClass = "border-[var(--color-correct)] bg-[rgba(0,255,65,0.05)] text-white shadow-[0_0_15px_rgba(0,255,65,0.15)]"
                  prefixClass = "text-[var(--color-correct)] font-bold"
                } else if (idx === selectedChoiceIndex) {
                  btnClass = "border-[var(--color-wrong)] bg-[rgba(255,51,51,0.05)] text-[#aaa]"
                  prefixClass = "text-[var(--color-wrong)] font-bold"
                } else {
                  btnClass = "border-[#222] bg-[#111] text-[#555] opacity-60 cursor-default"
                }
              }

              const isKeyboardHint = viewState === 'question'

              return (
                <button
                  key={idx}
                  onClick={() => viewState === 'question' && submitAnswer(idx)}
                  disabled={viewState === 'feedback'}
                  className={`p-4 rounded-lg border text-left flex items-start transition-all font-['Rajdhani'] text-lg ${btnClass}`}
                >
                  <span className={`font-['IBM_Plex_Mono'] mr-4 w-6 flex-shrink-0 ${prefixClass}`}>
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span className="flex-1">{choice}</span>
                  {isKeyboardHint && <span className="text-[#333] font-['IBM_Plex_Mono'] text-xs ml-4 border border-[#333] rounded px-1.5 py-0.5">{idx + 1}</span>}
                </button>
              )
            })}
          </div>

          {viewState === 'question' ? (
            <div className="flex justify-center border-t border-[#222] pt-6 mt-auto">
              <button 
                onClick={() => submitAnswer('idk')}
                className="px-8 py-3 rounded text-[#888] font-['Rajdhani'] uppercase tracking-widest text-sm hover:bg-[#222] hover:text-white transition-colors"
              >
                I Don't Know
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center border-t border-[#222] pt-6 mt-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
               {choiceStatus === 'wrong' && (
                 <div className="text-[var(--color-wrong)] font-['Rajdhani'] flex items-center mb-4 uppercase tracking-widest text-sm font-bold">
                   <AlertCircle className="w-5 h-5 mr-2" />
                   Review the correct answer and continue
                 </div>
               )}
               {choiceStatus === 'correct' && (
                 <div className="text-[var(--color-correct)] font-['Rajdhani'] flex items-center mb-4 uppercase tracking-widest text-sm font-bold">
                   <Play className="w-5 h-5 mr-2" />
                   Correct!
                 </div>
               )}
               <button 
                 onClick={handleNext}
                 className="w-full max-w-sm py-4 rounded bg-[var(--accent-primary)] text-black font-bold font-['Orbitron'] tracking-widest uppercase hover:bg-[var(--accent-dim)] transition-colors shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)]"
               >
                 Next <span className="font-['IBM_Plex_Mono'] text-xs ml-2 opacity-60">(Space)</span>
               </button>
            </div>
          )}

        </motion.div>
      </div>
    </div>
  )
}