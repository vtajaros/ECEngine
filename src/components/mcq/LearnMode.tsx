import React, { useState, useEffect, useCallback } from 'react'
import { Card, MCQData } from '../../types'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, Play, AlertCircle, ArrowRight, Flag } from 'lucide-react'
import { renderMath } from '../../lib/latex'

// Partitioned learning mode handling the custom "LEARN" flow

interface LearnModeProps {
  cards: Card[]
  title?: string
  onComplete: (stats: { correct: number; wrong: number; bookmarked: number }) => void
  onExit: () => void
}

type QuestionStatus = 'unanswered' | 'correct' | 'wrong'
type ViewState = 'question' | 'feedback' | 'partition-complete' | 'summary'

const getQuestionFontSize = (text: string): string => {
  if (text.length < 80)  return '1.5rem'
  if (text.length < 150) return '1.2rem'
  if (text.length < 250) return '1rem'
  return '0.9rem'
}

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
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('bookmarkedIds')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  
  // Tracking
  const [partitionWrongIds, setPartitionWrongIds] = useState<Set<string>>(new Set())
  const [partitionCorrectIds, setPartitionCorrectIds] = useState<Set<string>>(new Set())
  const [globalStats, setGlobalStats] = useState({ correctFirstTry: 0, wrongFirstTry: 0 })
  const [cardStats, setCardStats] = useState<Record<string, { wasCorrectFirstTry: boolean, usedIDK: boolean, attemptCount: number }>>({})

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
    setPartitionCorrectIds(new Set())
    setViewState('question')
    setCardStats({})
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
      // Allow enter to continue, but we need to know what button it triggers.
      // Easiest is to ignore Enter on this screen since there are multiple buttons (Restart vs Continue).
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

  const toggleBookmark = (id?: string) => {
    const targetId = typeof id === 'string' ? id : currentCard?.id
    if (!targetId) return
    setBookmarkedIds(prev => {
      const next = new Set(prev)
      if (next.has(targetId)) next.delete(targetId)
      else next.add(targetId)
      localStorage.setItem('bookmarkedIds', JSON.stringify(Array.from(next)))
      return next
    })
  }

  const submitAnswer = (choiceIdx: number | 'idk') => {
    if (viewState !== 'question') return
    
    const isIdk = choiceIdx === 'idk'
    const isCorrect = !isIdk && choiceIdx === mcqData.answer

    setSelectedChoiceIndex(isIdk ? null : choiceIdx)
    
    setCardStats(prev => {
      const existing = prev[currentCard.id] || { wasCorrectFirstTry: true, usedIDK: false, attemptCount: 0 }
      const newStats = { ...existing }
      newStats.attemptCount += 1
      if (isIdk) {
        newStats.usedIDK = true
        newStats.wasCorrectFirstTry = false
      } else if (!isCorrect) {
        newStats.wasCorrectFirstTry = false
      }
      return { ...prev, [currentCard.id]: newStats }
    })
    
    if (isCorrect) {
      setChoiceStatus('correct')
      setPartitionCorrectIds(prev => new Set(prev).add(currentCard.id))
      setPartitionWrongIds(prev => { const next = new Set(prev); next.delete(currentCard.id); return next })
      if (!partitionWrongIds.has(currentCard.id)) {
        setGlobalStats(s => ({ ...s, correctFirstTry: s.correctFirstTry + 1 }))
      }
    } else {
      setChoiceStatus('wrong')
      setPartitionWrongIds(prev => new Set(prev).add(currentCard.id))
      setPartitionCorrectIds(prev => { const next = new Set(prev); next.delete(currentCard.id); return next })
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
      if (currentPartitionIndex === partitions.length - 1) {
        onComplete({
          correct: globalStats.correctFirstTry,
          wrong: globalStats.wrongFirstTry,
          bookmarked: bookmarkedIds.size
        })
      }
    } else {
      // Retry wrong ones
      const nextQueue = activeQueue.filter(c => partitionWrongIds.has(c.id))
      setActiveQueue(nextQueue)
      setCurrentCardIndex(0)
      setPartitionWrongIds(new Set()) // Reset wrong tracking for this retry loop
      setPartitionCorrectIds(new Set())
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
      setPartitionCorrectIds(new Set())
      setViewState('question')
      setSelectedChoiceIndex(null)
      setChoiceStatus('unanswered')
    }
  }

  const handleRestartRound = () => {
    const currentCards = partitions[currentPartitionIndex]
    setCardStats(prev => {
      const next = { ...prev }
      currentCards.forEach(c => delete next[c.id])
      return next
    })
    setActiveQueue([...currentCards])
    setCurrentCardIndex(0)
    setPartitionWrongIds(new Set())
    setPartitionCorrectIds(new Set())
    setViewState('question')
    setSelectedChoiceIndex(null)
    setChoiceStatus('unanswered')
  }

  const handleStudyAgain = () => {
    setCardStats({})
    setGlobalStats({ correctFirstTry: 0, wrongFirstTry: 0 })
    setCurrentPartitionIndex(0)
    setActiveQueue([...partitions[0]])
    setCurrentCardIndex(0)
    setPartitionWrongIds(new Set())
    setPartitionCorrectIds(new Set())
    setViewState('question')
    setSelectedChoiceIndex(null)
    setChoiceStatus('unanswered')
  }

  if (!cards || cards.length === 0) return null

  // RENDER SUMMARY / PARTITION COMPLETE
  if (viewState === 'partition-complete' || viewState === 'summary') {
    const isLastPartition = currentPartitionIndex === partitions.length - 1
    const currentPartitionCards = partitions[currentPartitionIndex]
    const partitionCorrectFirstTryCount = currentPartitionCards.filter(c => cardStats[c.id]?.wasCorrectFirstTry).length
    const overallCorrectFirstTryCount = cards.filter(c => cardStats[c.id]?.wasCorrectFirstTry).length

    return (
      <div className="flex flex-col items-center justify-center p-6 lg:p-10 h-full bg-[#0D0D0D]">
        <motion.div 
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="bg-[#111] border border-[#222] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-w-3xl w-full h-[80vh] max-h-[800px] overflow-hidden"
        >
          {/* Header */}
          <div className="p-8 border-b border-[#222] text-center bg-[#161616] shrink-0">
            <h2 className="text-4xl font-['Orbitron'] font-bold text-[#00FF41] mb-2 tracking-widest uppercase">
              {isLastPartition ? 'Set Complete! 🎉' : 'Round Complete'}
            </h2>
            <p className="text-[#888] font-['IBM_Plex_Mono'] mb-6">
              {isLastPartition ? `You've reviewed all ${cards.length} questions` : "Here's what you just studied"}
            </p>
            <div className="inline-block bg-[#0D0D0D] border border-[#333] px-6 py-3 rounded-lg">
              <span className="text-[#E8E8E8] font-['Rajdhani'] text-lg font-bold tracking-wider">
                {isLastPartition 
                  ? `${overallCorrectFirstTryCount} / ${cards.length} flawless answers` 
                  : `${partitionCorrectFirstTryCount} / ${currentPartitionCards.length} flawless answers`}
              </span>
            </div>
          </div>

          {/* Question Review List */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#0D0D0D]">
            <div className="flex flex-col gap-2">
              {currentPartitionCards.map((c, idx) => {
                const stat = cardStats[c.id] || { wasCorrectFirstTry: false, usedIDK: false, attemptCount: 0 }
                const mcq = c.data as MCQData
                const correctAnswerText = mcq.choices[mcq.answer]
                const overallPos = (currentPartitionIndex * PARTITION_SIZE) + idx + 1

                return (
                  <motion.div 
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-[#161616] border border-[rgba(0,255,65,0.15)] rounded-lg p-[12px_16px] mb-2 shrink-0"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <span className="font-['Rajdhani'] font-bold text-[#888] whitespace-nowrap mt-0.5">Q{overallPos}</span>
                      <div className="text-[#E8E8E8] font-['IBM_Plex_Mono'] text-[13px] leading-relaxed flex-1" dangerouslySetInnerHTML={{ __html: renderMath(mcq.question) }} />
                      <div className="flex items-center gap-2 shrink-0 mt-0.5">
                        <button 
                          onClick={() => toggleBookmark(c.id)}
                          className={`p-1 rounded transition-colors ${bookmarkedIds.has(c.id) ? 'text-[#FFB800] bg-[#FFB800]/10' : 'text-[#555] hover:text-[#FFB800] hover:bg-[#FFB800]/5'}`}
                          title="Bookmark Question"
                        >
                          <Bookmark className={`w-4 h-4 ${bookmarkedIds.has(c.id) ? 'fill-current' : ''}`} />
                        </button>
                        {stat.usedIDK && (
                          <span className="text-[10px] font-['IBM_Plex_Mono'] font-bold px-2 py-0.5 rounded bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/30">IDK</span>
                        )}
                        {!stat.wasCorrectFirstTry && !stat.usedIDK && (
                          <span className="text-[10px] font-['IBM_Plex_Mono'] font-bold px-2 py-0.5 rounded bg-[#FF3333]/20 text-[#FF3333] border border-[#FF3333]/30">Missed</span>
                        )}
                      </div>
                    </div>
                    <div className="pl-8 flex items-start gap-2">
                      <span className="text-[#00FF41] font-bold">✓</span>
                      <div className="text-[#00FF41] font-['IBM_Plex_Mono'] text-[13px]" dangerouslySetInnerHTML={{ __html: renderMath(correctAnswerText) }} />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="p-6 border-t border-[#222] bg-[#161616] flex justify-between gap-4 shrink-0">
            <button 
              onClick={handleRestartRound}
              className="px-6 py-3 bg-[#111] border border-[#00FF41] text-[#00FF41] rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[rgba(0,255,65,0.1)] transition-colors"
            >
              Restart Round
            </button>
            {isLastPartition ? (
              <div className="flex gap-4">
                <button 
                  onClick={onExit}
                  className="px-6 py-3 bg-[#222] text-[#E8E8E8] rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                >
                  Exit
                </button>
                <button 
                  onClick={handleStudyAgain}
                  className="px-8 py-3 bg-[#00FF41] text-black rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_15px_rgba(0,255,65,0.2)] transition-all"
                >
                  Study Again
                </button>
              </div>
            ) : (
              <button 
                onClick={startNextPartitionPhase}
                className="px-8 py-3 bg-[#00FF41] text-black rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_15px_rgba(0,255,65,0.2)] transition-all flex items-center"
              >
                Continue <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  // RENDER QUESTION OR FEEDBACK
  // Guards
  console.log('Current card raw data:', JSON.stringify(currentCard))
  if (!currentCard || !isMcq) return <div className="text-white p-8">Only MCQ implemented for Learn Mode stub.</div>
  
  if (!mcqData || !Array.isArray(mcqData.choices) || mcqData.choices.length !== 4) {
    return (
      <div style={{color: 'red', padding: 20}}>
        DEBUG — Bad card data: {JSON.stringify(currentCard.data)}
      </div>
    )
  }

  const isBookmarked = bookmarkedIds.has(currentCard.id)

  const originalIndex = cards.findIndex(c => c.id === currentCard.id)
  const overallCurrentQuestion = originalIndex >= 0 ? originalIndex + 1 : 1
  const partitionTotal = partitions[currentPartitionIndex].length
  const totalCorrectInPartition = partitionTotal - activeQueue.length + partitionCorrectIds.size
  const totalWrongInPartition = partitionWrongIds.size

  return (
    <div className="flex flex-col h-full bg-[#0D0D0D] p-6 lg:p-10 relative">
      <div className="max-w-4xl w-full mx-auto flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-4 text-[#E8E8E8] font-['IBM_Plex_Mono'] font-bold text-sm tracking-wider uppercase mb-3">
            <span>Question {overallCurrentQuestion} of {cards.length}</span>
          </div>
          <div className="w-64 bg-[#1a1a1a] h-[6px] rounded-full overflow-hidden mb-3">
            <div 
              className="h-full bg-[#00FF41] transition-all duration-300 ease-in-out shadow-[0_0_8px_rgba(0,255,65,0.6)]" 
              style={{ width: `${(overallCurrentQuestion / cards.length) * 100}%` }} 
            />
          </div>
          <div className="text-[11px] font-['IBM_Plex_Mono'] flex items-center gap-4 text-[#888]">
            <span className="flex items-center gap-1 text-[#00FF41]"><div className="w-2 h-2 rounded-full bg-[#00FF41]"></div> ✓ {totalCorrectInPartition} correct</span>
            <span className="flex items-center gap-1 text-[#FF3333]"><div className="w-2 h-2 rounded-full bg-[#FF3333]"></div> ✗ {totalWrongInPartition} to retry</span>
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
            onClick={() => toggleBookmark()}
            className="absolute top-6 right-6 text-[#666] hover:text-[var(--warning)] transition-colors"
            title="Bookmark"
          >
            <Bookmark className={`w-6 h-6 ${isBookmarked ? 'fill-[#FFB800] text-[#FFB800]' : ''}`} />
          </button>

          <div className="mb-10 pr-4 max-h-[40vh] overflow-y-auto custom-scrollbar">
            <span className="text-[var(--accent-primary)] font-['IBM_Plex_Mono'] text-sm font-bold tracking-widest mb-3 block">Question {overallCurrentQuestion}</span>
            <div 
              className="text-white font-medium font-['IBM_Plex_Mono']"
              style={{
                fontSize: getQuestionFontSize(mcqData.question),
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap'
              }}
              dangerouslySetInnerHTML={{ __html: renderMath(mcqData.question) }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            {[0, 2, 1, 3].map((idx) => {
              const choice = mcqData.choices[idx];
              if (choice === undefined) return null;
              
              let btnClass = "border-[#222] bg-[#111] hover:border-[#00FF41] hover:shadow-[0_0_8px_rgba(0,255,65,0.2)] cursor-pointer"
              let prefixClass = "text-[#666]"
              let textClass = "text-[#E8E8E8]"

              if (viewState === 'feedback') {
                if (idx === mcqData.answer) {
                  btnClass = "border-[var(--color-correct)] bg-[rgba(0,255,65,0.05)] shadow-[0_0_15px_rgba(0,255,65,0.15)]"
                  prefixClass = "text-[var(--color-correct)] font-bold"
                  textClass = "text-white"
                } else if (idx === selectedChoiceIndex) {
                  btnClass = "border-[var(--color-wrong)] bg-[rgba(255,51,51,0.05)]"
                  prefixClass = "text-[var(--color-wrong)] font-bold"
                  textClass = "text-[#aaa]"
                } else {
                  btnClass = "border-[#222] bg-[#111] opacity-60 cursor-default"
                  textClass = "text-[#555]"
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => viewState === 'question' && submitAnswer(idx)}
                  disabled={viewState === 'feedback'}
                  className={`p-[16px_20px] min-h-[64px] rounded-lg border text-left flex items-start transition-all font-['Rajdhani'] text-lg ${btnClass}`}
                >
                  <span className={`font-['IBM_Plex_Mono'] mr-3 w-6 flex-shrink-0 ${prefixClass}`}>
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <div className={`flex-1 break-words leading-snug pt-0.5 font-['IBM_Plex_Mono'] ${textClass}`} dangerouslySetInnerHTML={{ __html: renderMath(choice) }} />
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