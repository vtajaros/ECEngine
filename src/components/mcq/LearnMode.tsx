import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, MCQData } from '../../types'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, Play, AlertCircle, ArrowRight, Flag, X, Copy, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { renderMath } from '../../lib/latex'
import Toast from '../ui/Toast'
import { ExplanationPanel } from '../ui/ExplanationPanel'
import { Tooltip } from '../ui/Tooltip'
import { LeaveConfirmModal } from '../ui/LeaveConfirmModal'
import { useBlocker } from 'react-router-dom'
import { dbService } from '../../services/db.service'
import { useSound, getSoundsMuted, setSoundsMuted } from '../../hooks/useSound'

// Partitioned learning mode handling the custom "LEARN" flow

interface LearnModeProps {
  cards: Card[]
  title?: string
  onComplete: (stats: { correct: number; wrong: number; bookmarked: number; correctIds: string[] }) => void
  onExit: () => void
}

type QuestionStatus = 'unanswered' | 'correct' | 'wrong'
type ViewState = 'question' | 'feedback' | 'partition-complete' | 'summary'

export const LearnMode: React.FC<LearnModeProps> = ({ cards, title, onComplete, onExit }) => {
  // Partitioning logic
  const PARTITION_SIZE = 5

  const { play } = useSound()
  const [isMuted, setIsMuted] = useState(() => getSoundsMuted())

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    setSoundsMuted(next)
  }
  
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
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [explanationOpen, setExplanationOpen] = useState(false)
    // Summary view: which question row has its panel open (null = all closed)
  const [openExplanationId, setOpenExplanationId] = useState<number | null>(null)

  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Navigation Blocking logic
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      viewState !== 'summary' &&
      viewState !== 'partition-complete' &&
      currentLocation.pathname !== nextLocation.pathname
  )

  // Keep a live ref to the blocker so the unmount cleanup always calls reset()
  // on the *current* blocker instance — not a stale closure copy.
  const blockerRef = useRef(blocker)
  useEffect(() => {
    blockerRef.current = blocker
    ;(window as any).__reactRouterBlocker = blocker
  }, [blocker])

  // On unmount, unconditionally reset any lingering blocked state so the
  // sidebar never gets permanently locked after the user exits a learn session.
  useEffect(() => {
    return () => {
      if (blockerRef.current.state === 'blocked') {
        blockerRef.current.reset()
      }
    }
  }, []) // intentionally empty — runs only on unmount

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowExitConfirm(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Safe exit: reset any active blocker before handing control to parent
  const handleExit = () => {
    if (blocker.state === 'blocked') blocker.reset()
    onExit()
  }

  // Reset the explanation panel when the round changes
  useEffect(() => {
    setOpenExplanationId(null);
  }, [currentPartitionIndex, activeQueue]);

  useEffect(() => {
    if (zoomedImage) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [zoomedImage])

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
      play('correct')
    } else {
      setChoiceStatus('wrong')
      setPartitionWrongIds(prev => new Set(prev).add(currentCard.id))
      setPartitionCorrectIds(prev => { const next = new Set(prev); next.delete(currentCard.id); return next })
      if (!partitionWrongIds.has(currentCard.id)) {
        setGlobalStats(s => ({ ...s, wrongFirstTry: s.wrongFirstTry + 1 }))
      }
      play('wrong')
    }
    
    setViewState('feedback')
  }

  const handleNext = () => {
    setViewState('question')
    setSelectedChoiceIndex(null)
    setChoiceStatus('unanswered')
    setExplanationOpen(false) // Reset explanation on each new question

    if (currentCardIndex < activeQueue.length - 1) {
      setCurrentCardIndex(prev => prev + 1)
    } else {
      // Reached end of partition queue
      handleEndOfQueue()
    }
  }

  const handleEndOfQueue = async () => {
    if (partitionWrongIds.size === 0) {
      // All correct!
      setViewState('partition-complete')
      if (currentPartitionIndex === partitions.length - 1) {
        play('finish')
        // Record progress for all cards in session
        for (const [id, stats] of Object.entries(cardStats)) {
          await dbService.recordCardResult(id, stats.wasCorrectFirstTry)
        }

        onComplete({
          correct: globalStats.correctFirstTry,
          wrong: globalStats.wrongFirstTry,
          bookmarked: bookmarkedIds.size,
          correctIds: Object.entries(cardStats).filter(([_, stats]) => stats.wasCorrectFirstTry).map(([id]) => id)
        })
      } else {
        play('roundComplete')
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
    setOpenExplanationId(null) // close any open summary panel
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

  const handleGetContext = () => {
    if (!mcqData) return

    const template = `---
Please explain the correct answer to this multiple choice question:

QUESTION:
${mcqData.question}

CHOICES:
A. ${mcqData.choices[0]}
B. ${mcqData.choices[1]}
C. ${mcqData.choices[2]}
D. ${mcqData.choices[3]}

CORRECT ANSWER: ${String.fromCharCode(65 + mcqData.answer)}. ${mcqData.choices[mcqData.answer]}

Please explain:
1. Why the correct answer is right
2. Why each of the other choices is wrong
3. Any relevant formula, law, or concept that applies
4. A memory tip or way to remember this for the board exam
---`

    navigator.clipboard.writeText(template).then(() => {
      setShowToast(true)
    })
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
          <div className="p-3 border-b border-[#222] text-center bg-[#161616] shrink-0">
            <h2 className="text-xl font-['Orbitron'] font-bold text-[#00FF41] mb-0 tracking-widest uppercase">
              {isLastPartition ? 'Set Complete! 🎉' : 'Round Complete'}
            </h2>
            {title && (
              <div className="text-white font-['Orbitron'] font-bold text-sm tracking-[0.2em] uppercase mb-1">
                {title}
              </div>
            )}
            <div className="inline-block bg-[#0D0D0D] border border-[#333] px-4 py-1.5 rounded-lg">
              <span className="text-[#E8E8E8] font-['Rajdhani'] text-sm font-bold tracking-wider">
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
                      <button 
                        onClick={() => toggleBookmark(c.id)}
                        className={`p-1 rounded transition-colors shrink-0 mt-0.5 ${bookmarkedIds.has(c.id) ? 'text-[#FFB800] bg-[#FFB800]/10' : 'text-[#555] hover:text-[#FFB800] hover:bg-[#FFB800]/5'}`}
                        title="Bookmark Question"
                      >
                        <Bookmark className={`w-4 h-4 ${bookmarkedIds.has(c.id) ? 'fill-current' : ''}`} />
                      </button>
                      {/* Sparkles: toggle AI explanation for this row */}
                      <button
                        onClick={() => setOpenExplanationId(openExplanationId === idx ? null : idx)}
                        className={`p-1 rounded transition-colors shrink-0 mt-0.5 border ${
                          openExplanationId === idx
                            ? 'border-[#00FF41] text-[#00FF41] bg-[rgba(0,255,65,0.1)]'
                            : 'border-[rgba(0,255,65,0.3)] text-[#00FF41] hover:bg-[rgba(0,255,65,0.08)] hover:border-[#00FF41]'
                        }`}
                        title={openExplanationId === idx ? 'Hide explanation' : 'AI Explain'}
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="pl-8 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-[#00FF41] font-bold">✓</span>
                        <div className="text-[#00FF41] font-['IBM_Plex_Mono'] text-[13px]" dangerouslySetInnerHTML={{ __html: renderMath(correctAnswerText) }} />
                      </div>
                      {stat.usedIDK && (
                        <span className="text-[10px] font-['IBM_Plex_Mono'] font-bold px-2 py-0.5 rounded bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/30 shrink-0">IDK</span>
                      )}
                      {!stat.wasCorrectFirstTry && !stat.usedIDK && (
                        <span className="text-[10px] font-['IBM_Plex_Mono'] font-bold px-2 py-0.5 rounded bg-[#FF3333]/20 text-[#FF3333] border border-[#FF3333]/30 shrink-0">Missed</span>
                      )}
                    </div>

                    {/* ExplanationPanel: slides in below this row when selected */}
                    <AnimatePresence>
                      {openExplanationId === idx && (
                        <motion.div
                          key="explanation"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: 'easeOut' }}
                          style={{ overflow: 'hidden' }}
                        >
                          <ExplanationPanel
                            question={mcq.question}
                            choices={mcq.choices}
                            answerIndex={mcq.answer}
                            onClose={() => setOpenExplanationId(null)}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="p-3 border-t border-[#222] bg-[#161616] flex justify-between gap-4 shrink-0">
            <button 
              onClick={handleRestartRound}
              className="px-4 py-2 text-sm bg-[#111] border border-[#00FF41] text-[#00FF41] rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[rgba(0,255,65,0.1)] transition-colors"
            >
              Restart Round
            </button>
            {isLastPartition ? (
              <div className="flex gap-4">
                <button 
                  onClick={handleExit}
                  className="px-4 py-2 text-sm bg-[#222] text-[#E8E8E8] rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                >
                  Exit
                </button>
                <button 
                  onClick={handleStudyAgain}
                  className="px-5 py-2 text-sm bg-[#00FF41] text-black rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_15px_rgba(0,255,65,0.2)] transition-all"
                >
                  Study Again
                </button>
              </div>
            ) : (
              <button 
                onClick={startNextPartitionPhase}
                className="px-5 py-2 text-sm bg-[#00FF41] text-black rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_15px_rgba(0,255,65,0.2)] transition-all flex items-center"
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
  if (!currentCard || !isMcq) return <div className="text-white p-8">Only MCQ implemented for Learn Mode stub.</div>
  
  if (!mcqData || typeof mcqData === 'string' || !Array.isArray(mcqData.choices) || mcqData.choices.length !== 4) {
    console.warn('[ECEngine] Card data parse error — card may have been saved with double-escaped LaTeX. Please re-save this card in Edit Deck.', currentCard.id, currentCard.data)
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
    <div className="flex flex-col h-full bg-[#0D0D0D] p-8 relative">
      <LeaveConfirmModal 
        isOpen={blocker.state === 'blocked' || showExitConfirm}
        onConfirm={() => {
          if (blocker.state === 'blocked') {
            blocker.proceed && blocker.proceed()
          } else {
            setShowExitConfirm(false)
            handleExit()
          }
        }}
        onCancel={() => {
          if (blocker.state === 'blocked') {
            blocker.reset && blocker.reset()
          } else {
            setShowExitConfirm(false)
          }
        }}
      />
      
      <div className="max-w-3xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-4 text-[#E8E8E8] font-['IBM_Plex_Mono'] font-bold text-sm tracking-wider uppercase mb-3">
            <span>Question {overallCurrentQuestion} of {cards.length}</span>
            {title && (
              <span className="text-[#00FF41] font-['Orbitron'] font-bold text-lg tracking-[0.1em] uppercase whitespace-nowrap flex-shrink-0">
                {title}
              </span>
            )}
          </div>
          <div className="w-64 max-w-full bg-[#1a1a1a] h-[6px] rounded-full overflow-hidden mb-3">
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
        
        <div className="flex justify-end items-center gap-3">
          <button
            onClick={toggleMute}
            className={`p-2 rounded border transition-colors ${isMuted ? 'border-[#FF3333] text-[#FF3333] bg-[rgba(255,51,51,0.08)]' : 'border-[#333] text-[#888] hover:text-white hover:border-[#666]'}`}
            title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button onClick={() => setShowExitConfirm(true)} className="px-4 py-2 border border-[#333] text-[#888] rounded hover:text-white hover:border-[#666] transition-colors font-['Rajdhani'] uppercase tracking-widest text-sm">
            Exit Learn Mode
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center w-full">
        <motion.div 
          key={currentCard.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl mx-auto bg-[#161616] border border-[#222] rounded-xl shadow-2xl p-10 relative flex flex-col overflow-y-auto"
        >
          {/* Bookmark Togggle */}
          <button 
            onClick={() => toggleBookmark()}
            className="absolute top-6 right-6 text-[#666] hover:text-[var(--warning)] transition-colors"
            title="Bookmark"
          >
            <Bookmark className={`w-6 h-6 ${isBookmarked ? 'fill-[#FFB800] text-[#FFB800]' : ''}`} />
          </button>

          <div className="mb-10 pr-4 h-auto flex-none">
            <span className="text-[var(--accent-primary)] font-['IBM_Plex_Mono'] text-sm font-bold tracking-widest mb-3 block">Question {overallCurrentQuestion}</span>
            <div 
              className="text-white font-['Rajdhani'] font-semibold mb-6 text-lg leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: renderMath(mcqData.question) }}
            />

            {mcqData.imagePath && (
              <div className="mb-4 w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg hover:border-[#00FF41] transition-all">
                <img 
                  src={`ece-app://${mcqData.imagePath}`} 
                  alt="Circuit diagram"
                  className="w-full h-full max-h-[300px] object-contain cursor-zoom-in"
                  onClick={() => setZoomedImage(mcqData.imagePath!)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            {[0, 1, 2, 3].map((idx) => {
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
                  className={`py-4 px-4 text-base rounded-lg border text-left flex items-center transition-all font-['Rajdhani'] ${btnClass}`}
                >
                  <span className={`font-['IBM_Plex_Mono'] mr-4 w-8 text-base flex-shrink-0 ${prefixClass}`}>
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <div 
                    className={`flex-1 text-left break-words font-['Rajdhani'] font-medium text-base leading-normal ${textClass}`} 
                    dangerouslySetInnerHTML={{ __html: renderMath(choice) }} 
                  />
                </button>
              )
            })}
          </div>

          {/* ExplanationPanel: slides in below choices when open */}
          {viewState === 'feedback' && explanationOpen && (
            <ExplanationPanel
              question={mcqData.question}
              choices={mcqData.choices}
              answerIndex={mcqData.answer}
              onClose={() => setExplanationOpen(false)}
            />
          )}

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
                  className="w-full max-w-sm mx-auto py-3 text-base rounded bg-[var(--accent-primary)] text-black font-bold font-['Orbitron'] tracking-widest uppercase hover:bg-[var(--accent-dim)] transition-colors shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)] mb-4"
                >
                  Next <span className="font-['IBM_Plex_Mono'] text-xs ml-2 opacity-60">(Space)</span>
                </button>

               {/* Secondary action buttons: GET CONTEXT and EXPLAIN */}
               <div className="flex items-center gap-3 flex-wrap justify-center">
                 <Tooltip content="Copy context to paste into GPT/Gemini/Claude for a better AI explanation.">
                   <button 
                     onClick={handleGetContext}
                     className="flex items-center gap-2 px-4 py-2 border border-[rgba(255,255,255,0.3)] rounded text-[#CCCCCC] hover:text-white hover:border-[#888] transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs"
                   >
                     <Copy size={14} />
                     Get Context
                   </button>
                 </Tooltip>

                 <Tooltip position="right" content="Explain using Grok Llama-3.3-70B">

                   <button 
                     onClick={() => setExplanationOpen(true)}
                     className="flex items-center gap-2 px-4 py-2 border border-[rgba(0,255,65,0.3)] rounded text-[#00FF41] hover:bg-[rgba(0,255,65,0.08)] hover:border-[#00FF41] transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs"
                   >
                     <Sparkles size={14} />
                     Explain
                   </button>
                 </Tooltip>

               </div>
            </div>
          )}

        </motion.div>
      </div>

      <AnimatePresence>
        {showToast && (
          <Toast 
            message="Context copied to clipboard — paste into Gemini, ChatGPT, or Claude" 
            onDismiss={() => setShowToast(false)} 
          />
        )}
      </AnimatePresence>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 lg:p-10 cursor-zoom-out backdrop-blur-sm"
            onClick={() => setZoomedImage(null)}
          >
            <button 
              className="absolute top-6 right-6 text-[#888] hover:text-[#00FF41] transition-colors p-2 bg-[#111] rounded-full border border-[#333] hover:border-[#00FF41]"
              onClick={() => setZoomedImage(null)}
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
    </div>
  )
}