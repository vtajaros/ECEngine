import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, MCQData } from '../../types'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, Play, AlertCircle, ArrowRight, Flag, X, Copy, Sparkles, Volume2, VolumeX, CheckCircle2, XCircle } from 'lucide-react'
import { renderMath, renderPlainText } from '../../lib/latex'
import { shuffleChoices, isSafeToShuffleChoices } from '../../lib/scrambler'
import Toast from '../ui/Toast'
import { ExplanationPanel } from '../ui/ExplanationPanel'
import { Tooltip } from '../ui/Tooltip'
import { LeaveConfirmModal } from '../ui/LeaveConfirmModal'
import { useBlocker } from 'react-router-dom'
import { dbService } from '../../services/db.service'
import { useSound, useSoundVolume } from '../../hooks/useSound'
import { VolumeControl } from '../ui/VolumeControl'
import { useTTS } from '../../hooks/useTTS'

// Partitioned learning mode handling the custom "LEARN" flow

interface LearnModeProps {
  cards: Card[]
  title?: string
  // ── TTS ──────────────────────────────────────────────────────────────────────
  // Passed down from LooksFamStudy via LearnSettings. LearnMode does NOT own
  // the preference — it only consumes it. This keeps TTS state out of the
  // session store and co-located with the other learn settings.
  ttsEnabled?: boolean
  shuffleChoices?: boolean
  onComplete: (stats: { correct: number; wrong: number; bookmarked: number; correctIds: string[] }) => void
  onExit: () => void
}

function reshuffleCardChoices(card: Card): Card {
  if (
    card.type === 'mcq' &&
    card.data &&
    Array.isArray((card.data as MCQData).choices) &&
    isSafeToShuffleChoices((card.data as MCQData).choices)
  ) {
    const mcq = card.data as MCQData
    const sc = shuffleChoices(mcq.choices, mcq.answer, mcq.choicesPlainText)
    return {
      ...card,
      data: {
        ...mcq,
        choices: sc.choices,
        answer: sc.answer,
        ...(sc.choicesPlainText ? { choicesPlainText: sc.choicesPlainText } : {})
      }
    }
  }
  return card
}

/**
 * Partitions cards into chunks of partitionSize (default 5).
 * If the final chunk would have fewer than minTrailingSize (default 3) items
 * (i.e. 1 or 2 leftover items) and there is a preceding partition, those remainder
 * items are merged into the second-to-last partition (resulting in 6 or 7 items)
 * instead of creating an extra round with only 1 or 2 items.
 */
export function partitionCards(cards: Card[], partitionSize = 5, minTrailingSize = 3): Card[][] {
  if (!cards || cards.length === 0) return []
  const partitions: Card[][] = []
  for (let i = 0; i < cards.length; i += partitionSize) {
    partitions.push(cards.slice(i, i + partitionSize))
  }
  if (partitions.length > 1 && partitions[partitions.length - 1].length < minTrailingSize) {
    const last = partitions.pop()!
    partitions[partitions.length - 1] = [...partitions[partitions.length - 1], ...last]
  }
  return partitions
}

type QuestionStatus = 'unanswered' | 'correct' | 'wrong'
type ViewState = 'question' | 'feedback' | 'partition-complete' | 'summary'

export const LearnMode: React.FC<LearnModeProps> = ({ cards, title, ttsEnabled = false, shuffleChoices = false, onComplete, onExit }) => {
  // Partitioning logic
  const PARTITION_SIZE = 5

  const { play } = useSound()
  const { isMuted } = useSoundVolume()

  // ── TTS ────────────────────────────────────────────────────────────────────
  const { speak, stop } = useTTS(ttsEnabled && !isMuted)

  useEffect(() => {
    if (isMuted) {
      stop()
    }
  }, [isMuted, stop])

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
  const [showSolution, setShowSolution] = useState(false)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('bookmarkedIds')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })

  // Tracking
  const [partitionWrongIds, setPartitionWrongIds] = useState<Set<string>>(new Set())
  const [partitionCorrectIds, setPartitionCorrectIds] = useState<Set<string>>(new Set())
  const [globalStats, setGlobalStats] = useState({ correctFirstTry: 0, wrongFirstTry: 0 })
/**
 * Per-card tracking stats during a Learn session.
 * firstResponseMs is raw wall-clock, includes idle time, consumers must treat outliers robustly.
 */
interface LearnCardStat {
  wasCorrectFirstTry: boolean
  usedIDK: boolean
  attemptCount: number
  firstAnsweredAt?: number
  /** Raw wall-clock response time in ms; includes idle time, consumers must treat outliers robustly. */
  firstResponseMs?: number | null
}

  const [cardStats, setCardStats] = useState<Record<string, LearnCardStat>>({})
  const cardStatsRef = useRef<Record<string, LearnCardStat>>({})
  cardStatsRef.current = cardStats
  const shownAtRef = useRef<number>(0)
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

  const blockerRef = useRef(blocker)
  useEffect(() => {
    blockerRef.current = blocker
  }, [blocker])

  useEffect(() => {
    return () => {
      stop()
      if (blockerRef.current?.state === 'blocked') {
        blockerRef.current.reset()
      }
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (zoomedImage) {
          setZoomedImage(null)
          return
        }
        setShowExitConfirm(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomedImage])

  const handleExit = () => {
    stop() // cancel any in-flight speech before unmounting
    if (blocker.state === 'blocked') {
      blocker.reset()
    }
    onExit()
  }

  const renderLeaveConfirmModal = () => (
    <LeaveConfirmModal
      isOpen={blocker.state === 'blocked' || showExitConfirm}
      onConfirm={() => {
        stop()
        if (blocker.state === 'blocked' && blocker.proceed) {
          blocker.proceed()
        }
        setShowExitConfirm(false)
        handleExit()
      }}
      onCancel={() => {
        if (blocker.state === 'blocked' && blocker.reset) {
          blocker.reset()
        }
        setShowExitConfirm(false)
      }}
    />
  )

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
    const newPartitions = partitionCards(cards, PARTITION_SIZE, 3)
    setPartitions(newPartitions)
    setActiveQueue([...newPartitions[0]])
    setCurrentPartitionIndex(0)
    setCurrentCardIndex(0)
    setPartitionWrongIds(new Set())
    setPartitionCorrectIds(new Set())
    setViewState('question')
    cardStatsRef.current = {}
    setCardStats({})
    setGlobalStats({ correctFirstTry: 0, wrongFirstTry: 0 })
  }, [cards])

  const currentCard = activeQueue[currentCardIndex]
  const isMcq = currentCard?.type === 'mcq'
  const mcqData = currentCard?.data as MCQData

  // ── TTS trigger: read question text when a new card enters view ─────────────
  // Fires when currentCard changes AND viewState is 'question'.
  // We do NOT read on 'feedback' — the answer has already been submitted,
  // re-reading the question at that point is disorienting.
  useEffect(() => {
    if (!currentCard || viewState !== 'question') return
    shownAtRef.current = Date.now()
    if (!isMcq || !mcqData?.question) return
    speak(mcqData.question)
  }, [currentCard?.id, viewState])

  // ── Image Preloading: Preload question & solution images for instant rendering ──
  useEffect(() => {
    if (!activeQueue || activeQueue.length === 0) return

    // Preload current card + next 2 cards in queue
    const cardsToPreload = activeQueue.slice(currentCardIndex, currentCardIndex + 3)
    cardsToPreload.forEach(c => {
      if (c && c.type === 'mcq' && c.data) {
        const data = c.data as MCQData
        if (data.imagePath) {
          const img = new Image()
          img.src = `ece-app://${data.imagePath}`
        }
        if (data.solutionImagePath) {
          const img = new Image()
          img.src = `ece-app://${data.solutionImagePath}`
        }
      }
    })
  }, [currentCardIndex, activeQueue])
  // ── Solution delay: 0.5s delay before revealing solution in feedback mode ───
  useEffect(() => {
    if (viewState === 'feedback' && (mcqData?.explanation || mcqData?.solutionImagePath)) {
      const timer = setTimeout(() => {
        setShowSolution(true)
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setShowSolution(false)
    }
  }, [viewState, currentCard?.id, mcqData?.explanation, mcqData?.solutionImagePath])

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

    // Stop any in-flight speech when the user answers — don't keep reading
    // the question after they've already committed to an answer.
    stop()

    setZoomedImage(null)

    const isIdk = choiceIdx === 'idk'
    const isCorrect = !isIdk && choiceIdx === mcqData.answer

    setSelectedChoiceIndex(isIdk ? null : choiceIdx)

    const cardId = currentCard.id
    const prevStats = cardStatsRef.current[cardId] || { wasCorrectFirstTry: false, usedIDK: false, attemptCount: 0 }
    const isFirstAttempt = prevStats.attemptCount === 0

    const updatedStats: LearnCardStat = {
      attemptCount: prevStats.attemptCount + 1,
      wasCorrectFirstTry: isFirstAttempt ? isCorrect : prevStats.wasCorrectFirstTry,
      usedIDK: isFirstAttempt ? isIdk : prevStats.usedIDK,
      firstAnsweredAt: isFirstAttempt ? Date.now() : prevStats.firstAnsweredAt,
      firstResponseMs: isFirstAttempt
        ? (shownAtRef.current > 0 ? Date.now() - shownAtRef.current : null)
        : prevStats.firstResponseMs,
    }

    cardStatsRef.current = {
      ...cardStatsRef.current,
      [cardId]: updatedStats,
    }
    setCardStats(cardStatsRef.current)

    if (isFirstAttempt) {
      if (isCorrect) {
        setGlobalStats(s => ({ ...s, correctFirstTry: s.correctFirstTry + 1 }))
      } else {
        setGlobalStats(s => ({ ...s, wrongFirstTry: s.wrongFirstTry + 1 }))
      }
    }

    if (isCorrect) {
      setChoiceStatus('correct')
      setPartitionCorrectIds(prev => new Set(prev).add(cardId))
      setPartitionWrongIds(prev => { const next = new Set(prev); next.delete(cardId); return next })
      play('correct')
    } else {
      setChoiceStatus('wrong')
      setPartitionWrongIds(prev => new Set(prev).add(cardId))
      setPartitionCorrectIds(prev => { const next = new Set(prev); next.delete(cardId); return next })
      play('wrong')
    }
    setViewState('feedback')
  }

  const handleNext = () => {
    // Guard: if item has a solution, do not allow Next until solution is displayed
    if (viewState === 'feedback' && (mcqData?.explanation || mcqData?.solutionImagePath) && !showSolution) {
      return
    }

    setViewState('question')
    setSelectedChoiceIndex(null)
    setChoiceStatus('unanswered')
    setExplanationOpen(false)
    setZoomedImage(null)

    if (currentCardIndex < activeQueue.length - 1) {
      setCurrentCardIndex(prev => prev + 1)
    } else {
      handleEndOfQueue()
    }
  }

  const handleEndOfQueue = async () => {
    if (partitionWrongIds.size === 0) {
      setViewState('partition-complete')
      if (currentPartitionIndex === partitions.length - 1) {
        play('finish')
        const allCardStats = cardStatsRef.current
        const progressWrites: Promise<void>[] = []
        for (const [id, stats] of Object.entries(allCardStats)) {
          const card = cards.find(c => c.id === id)
          if (card && card.type === 'mcq' && !card.isGenerated) {
            progressWrites.push(
              dbService.recordCardResult(id, stats.wasCorrectFirstTry, {
                mode: 'learn',
                responseMs: stats.firstResponseMs ?? null,
                answeredAt: stats.firstAnsweredAt ?? null,
              }).catch(err => {
                console.warn('[LearnMode] Failed to record card result:', err)
              })
            )
          }
        }
        Promise.all(progressWrites).catch(() => { /* already caught above */ })

        const flawlessCount = cards.filter(c => allCardStats[c.id]?.wasCorrectFirstTry === true).length
        const missedCount = cards.length - flawlessCount
        const correctIds = cards.filter(c => allCardStats[c.id]?.wasCorrectFirstTry === true).map(c => c.id)

        onComplete({
          correct: flawlessCount,
          wrong: missedCount,
          bookmarked: cards.filter(c => bookmarkedIds.has(c.id)).length,
          correctIds,
        })
      } else {
        play('roundComplete')
      }
    } else {
      const nextQueue = activeQueue
        .filter(c => partitionWrongIds.has(c.id))
        .map(c => (shuffleChoices ? reshuffleCardChoices(c) : c))
      setActiveQueue(nextQueue)
      setCurrentCardIndex(0)
      setPartitionWrongIds(new Set())
      setPartitionCorrectIds(new Set())
      setViewState('question')
      setSelectedChoiceIndex(null)
      setChoiceStatus('unanswered')
      setZoomedImage(null)
    }
  }

  const startNextPartitionPhase = () => {
    const nextIdx = currentPartitionIndex + 1
    if (nextIdx < partitions.length) {
      setCurrentPartitionIndex(nextIdx)
      setActiveQueue([...partitions[nextIdx]])
      setCurrentCardIndex(0)
      setPartitionWrongIds(new Set())
      setPartitionCorrectIds(new Set())
      setViewState('question')
      setSelectedChoiceIndex(null)
      setChoiceStatus('unanswered')
      setZoomedImage(null)
    }
  }

  // Ref wrappers to avoid stale closure issues in keydown listener
  const handleNextRef = useRef(handleNext)
  handleNextRef.current = handleNext

  const submitAnswerRef = useRef(submitAnswer)
  submitAnswerRef.current = submitAnswer

  const startNextPartitionPhaseRef = useRef(startNextPartitionPhase)
  startNextPartitionPhaseRef.current = startNextPartitionPhase

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't respond if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const isSpaceOrEnter = e.key === 'Enter' || e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar'

      if (viewState === 'feedback') {
        if (isSpaceOrEnter) {
          e.preventDefault()
          handleNextRef.current()
        }
        return
      }

      if (viewState === 'partition-complete') {
        if (isSpaceOrEnter) {
          e.preventDefault()
          if (currentPartitionIndex < partitions.length - 1) {
            startNextPartitionPhaseRef.current()
          }
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
          submitAnswerRef.current(mappedIndex)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewState, isMcq, mcqData, currentPartitionIndex, partitions.length])

  const handleRestartRound = () => {
    const currentCards = partitions[currentPartitionIndex]
    const nextStats = { ...cardStatsRef.current }
    currentCards.forEach(c => delete nextStats[c.id])
    cardStatsRef.current = nextStats
    setCardStats(nextStats)

    // Recalculate globalStats
    const currentFlawless = cards.filter(c => nextStats[c.id]?.wasCorrectFirstTry === true).length
    const currentAttempted = Object.keys(nextStats).length
    setGlobalStats({
      correctFirstTry: currentFlawless,
      wrongFirstTry: currentAttempted - currentFlawless,
    })

    const restartedCards = currentCards.map(c => (shuffleChoices ? reshuffleCardChoices(c) : c))
    setPartitions(prev => {
      const updated = [...prev]
      updated[currentPartitionIndex] = restartedCards
      return updated
    })
    setActiveQueue([...restartedCards])
    setCurrentCardIndex(0)
    setPartitionWrongIds(new Set())
    setPartitionCorrectIds(new Set())
    setViewState('question')
    setSelectedChoiceIndex(null)
    setChoiceStatus('unanswered')
    setOpenExplanationId(null)
    setZoomedImage(null)
  }

  const handleStudyAgain = () => {
    cardStatsRef.current = {}
    setCardStats({})
    setGlobalStats({ correctFirstTry: 0, wrongFirstTry: 0 })
    setCurrentPartitionIndex(0)
    const reshuffledPartitions = shuffleChoices
      ? partitions.map(part => part.map(c => reshuffleCardChoices(c)))
      : partitions
    setPartitions(reshuffledPartitions)
    setActiveQueue([...reshuffledPartitions[0]])
    setCurrentCardIndex(0)
    setPartitionWrongIds(new Set())
    setPartitionCorrectIds(new Set())
    setViewState('question')
    setSelectedChoiceIndex(null)
    setChoiceStatus('unanswered')
    setZoomedImage(null)
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
      <div className="flex flex-col items-center justify-center p-6 lg:p-10 h-full bg-transparent">
        {renderLeaveConfirmModal()}
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="bg-[#111] border border-border-base rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-w-3xl w-full h-[80vh] max-h-[800px] overflow-hidden"
        >
          {/* Header */}
          <div className="p-3 border-b border-border-base text-center bg-surface-2 shrink-0">
            <h2 className="text-xl font-['Orbitron'] font-bold text-accent mb-0 tracking-widest uppercase">
              {isLastPartition ? 'Set Complete! 🎉' : 'Round Complete'}
            </h2>
            {title && (
              <div className="text-white font-['Orbitron'] font-bold text-sm tracking-[0.2em] uppercase mb-1">
                {title}
              </div>
            )}
            <div className="inline-block bg-engine-black border border-[#333] px-4 py-1.5 rounded-lg">
              <span className="text-text-primary font-['Rajdhani'] text-sm font-bold tracking-wider">
                {isLastPartition
                  ? `${overallCorrectFirstTryCount} / ${cards.length} flawless answers`
                  : `${partitionCorrectFirstTryCount} / ${currentPartitionCards.length} flawless answers`}
              </span>
            </div>
          </div>

          {/* Question Review List */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-engine-black">
            <div className="flex flex-col gap-2">
              {currentPartitionCards.map((c, idx) => {
                const stat = cardStats[c.id] || { wasCorrectFirstTry: false, usedIDK: false, attemptCount: 0 }
                const mcq = c.data as MCQData
                const correctAnswerText = mcq.choices[mcq.answer]
                const originalIndex = cards.findIndex(card => card.id === c.id)
                const overallPos = originalIndex >= 0 ? originalIndex + 1 : idx + 1

                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-surface-2 border border-[rgba(0,255,65,0.15)] rounded-lg p-[12px_16px] mb-2 shrink-0"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <span className="font-['Rajdhani'] font-bold text-text-muted whitespace-nowrap mt-0.5">Q{overallPos}</span>
                      <div className="text-text-primary font-['JetBrains_Mono'] text-[13px] leading-relaxed flex-1 mcq-question-text" dangerouslySetInnerHTML={{ __html: renderMath(mcq.question) }} />
                      <button
                        onClick={() => toggleBookmark(c.id)}
                        className={`p-1 rounded transition-colors shrink-0 mt-0.5 ${bookmarkedIds.has(c.id) ? 'text-accent bg-accent/10' : 'text-[#555] hover:text-accent hover:bg-accent/5'}`}
                        title="Bookmark Question"
                      >
                        <Bookmark className={`w-4 h-4 ${bookmarkedIds.has(c.id) ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => setOpenExplanationId(openExplanationId === idx ? null : idx)}
                        className={`p-1 rounded transition-colors shrink-0 mt-0.5 border ${openExplanationId === idx
                          ? 'border-accent text-accent bg-[rgba(0,255,65,0.1)]'
                          : 'border-[rgba(0,255,65,0.3)] text-accent hover:bg-[rgba(0,255,65,0.08)] hover:border-accent'
                          }`}
                        title={openExplanationId === idx ? 'Hide explanation' : 'AI Explain'}
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="pl-8 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-accent font-bold">✓</span>
                        <div className="text-accent font-['JetBrains_Mono'] text-[13px]" dangerouslySetInnerHTML={{ __html: (mcq.choicesPlainText?.[mcq.answer] ? renderPlainText : renderMath)(correctAnswerText) }} />
                      </div>
                      {stat.usedIDK && (
                        <span className="text-[10px] font-['JetBrains_Mono'] font-bold px-2 py-0.5 rounded bg-warn/20 text-warn border border-warn/30 shrink-0">IDK</span>
                      )}
                      {!stat.wasCorrectFirstTry && !stat.usedIDK && (
                        <span className="text-[10px] font-['JetBrains_Mono'] font-bold px-2 py-0.5 rounded bg-danger/20 text-danger border border-danger/30 shrink-0">Missed</span>
                      )}
                    </div>

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
          <div className="p-3 border-t border-border-base bg-surface-2 flex justify-between gap-4 shrink-0">
            <button
              onClick={handleRestartRound}
              className="px-4 py-2 text-sm bg-[#111] border border-accent text-accent rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[rgba(0,255,65,0.1)] transition-colors"
            >
              Restart Round
            </button>
            {isLastPartition ? (
              <div className="flex gap-4">
                <button
                  onClick={handleExit}
                  className="px-4 py-2 text-sm bg-border-base text-text-primary rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                >
                  Exit
                </button>
                <button
                  onClick={handleStudyAgain}
                  className="px-5 py-2 text-sm bg-accent text-black rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_15px_rgba(0,255,65,0.2)] transition-all"
                >
                  Study Again
                </button>
              </div>
            ) : (
              <button
                onClick={startNextPartitionPhase}
                className="px-5 py-2 text-sm bg-accent text-black rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_15px_rgba(0,255,65,0.2)] transition-all flex items-center"
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
  if (!currentCard || !isMcq) return <div className="text-white p-8">Only MCQ implemented for Learn Mode stub.</div>

  if (!mcqData || typeof mcqData === 'string' || !Array.isArray(mcqData.choices) || mcqData.choices.length !== 4) {
    console.warn('[ECEngine] Card data parse error — card may have been saved with double-escaped LaTeX. Please re-save this card in Edit Deck.', currentCard.id, currentCard.data)
    return (
      <div style={{ color: 'red', padding: 20 }}>
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
    <div className="flex flex-col h-full bg-transparent p-8 relative">
      {renderLeaveConfirmModal()}

      <div className="max-w-3xl w-full mx-auto flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-4 text-text-primary font-['JetBrains_Mono'] font-bold text-sm tracking-wider uppercase mb-3">
            <span>Question {overallCurrentQuestion} of {cards.length}</span>
            {title && (
              <span className="text-accent font-['Orbitron'] font-bold text-lg tracking-[0.1em] uppercase whitespace-nowrap flex-shrink-0">
                {title}
              </span>
            )}
          </div>
          <div className="w-64 max-w-full bg-surface h-[6px] rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-accent transition-all duration-300 ease-in-out shadow-[0_0_8px_rgba(0,255,65,0.6)]"
              style={{ width: `${(overallCurrentQuestion / cards.length) * 100}%` }}
            />
          </div>
          <div className="text-[11px] font-['JetBrains_Mono'] font-bold uppercase tracking-widest flex items-center gap-4 text-text-muted">
            <span className="flex items-center gap-1.5 text-accent"><div className="w-2 h-2 rounded-full bg-accent"></div> ✓ {totalCorrectInPartition} correct</span>
            <span className="flex items-center gap-1.5 text-danger"><div className="w-2 h-2 rounded-full bg-danger"></div> ✗ {totalWrongInPartition} to retry</span>
          </div>
        </div>

        <div className="flex justify-end items-center gap-3">
          <VolumeControl />
          <button
            onClick={() => setShowExitConfirm(true)}
            className="px-4 py-2 border border-[#333] bg-[#111]/80 text-[#d0d0d0] hover:text-white hover:border-[#666] hover:bg-[#1a1a1a] rounded transition-all font-['Rajdhani'] font-bold uppercase tracking-widest text-sm shadow-sm"
          >
            Exit Learn Mode
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center w-full">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl mx-auto bg-surface-2 border border-border-base rounded-xl shadow-2xl p-6 sm:p-8 relative flex flex-col overflow-y-auto"
        >
          {/* Bookmark Toggle */}
          <button
            onClick={() => toggleBookmark()}
            className="absolute top-6 right-6 text-[#666] hover:text-[var(--accent-primary)] transition-colors"
            title="Bookmark"
          >
            <Bookmark className={`w-6 h-6 ${isBookmarked ? 'fill-accent text-accent' : ''}`} />
          </button>

          <div className="mb-8 pr-4 h-auto flex-none">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-['Orbitron'] font-bold tracking-wider text-accent border border-accent/40 bg-accent/5 inline-block mb-3">
              QUESTION {overallCurrentQuestion}
            </span>
            <div
              className="text-white font-['Rajdhani'] font-semibold mb-6 text-lg leading-relaxed whitespace-pre-wrap mcq-question-text"
              dangerouslySetInnerHTML={{ __html: renderMath(mcqData.question) }}
            />

            {mcqData.imagePath && (
              <div className="mb-4 w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg hover:border-accent transition-all">
                <img
                  src={`ece-app://${mcqData.imagePath}`}
                  alt="Circuit diagram"
                  className="w-full h-full max-h-[300px] object-contain cursor-zoom-in"
                  onClick={() => setZoomedImage(mcqData.imagePath!)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {[0, 1, 2, 3].map((idx) => {
              const choice = mcqData.choices[idx];
              if (choice === undefined) return null;

              let btnClass = "border-[#2c2c2c] bg-[#121212] hover:bg-[#1c1c1c] hover:border-accent hover:shadow-[0_0_8px_rgba(0,255,65,0.2)] cursor-pointer text-text-muted"
              let prefixClass = "border-[#444] text-text-muted bg-surface/50 group-hover:border-accent group-hover:text-accent"
              let textClass = "text-text-primary"

              if (viewState === 'feedback') {
                if (idx === mcqData.answer) {
                  btnClass = "border-accent bg-[rgba(0,255,65,0.08)] shadow-[0_0_16px_rgba(0,255,65,0.22)] cursor-default"
                  prefixClass = "bg-accent text-[#0D0D0D] border-accent font-bold"
                  textClass = "text-white"
                } else if (idx === selectedChoiceIndex) {
                  btnClass = "border-danger bg-[rgba(255,51,51,0.08)] shadow-[0_0_16px_rgba(255,51,51,0.22)] cursor-default"
                  prefixClass = "bg-danger text-[#0D0D0D] border-danger font-bold"
                  textClass = "text-[#aaa]"
                } else {
                  btnClass = "border-[#222] bg-[#0e0e0e] opacity-50 cursor-default"
                  prefixClass = "border-[#333] text-[#444] bg-[#0a0a0a]"
                  textClass = "text-[#555]"
                }
              }

              let orderClass = ""
              if (idx === 0) orderClass = "order-1"
              else if (idx === 1) orderClass = "order-2 md:order-3"
              else if (idx === 2) orderClass = "order-3 md:order-2"
              else if (idx === 3) orderClass = "order-4"

              return (
                <button
                  key={idx}
                  onClick={() => viewState === 'question' && submitAnswer(idx)}
                  disabled={viewState === 'feedback'}
                  className={`w-full text-left py-4 px-4 rounded-xl border flex items-center transition-all group disabled:cursor-not-allowed ${btnClass} ${orderClass}`}
                >
                  <div
                    className={`w-6 h-6 flex items-center justify-center rounded border font-['Rajdhani'] font-bold text-sm mr-3 shrink-0 transition-colors ${prefixClass}`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <div
                    className={`flex-1 text-left break-words font-['Rajdhani'] font-semibold tracking-wide text-base leading-snug mcq-choice-text ${textClass}`}
                    dangerouslySetInnerHTML={{ __html: (mcqData.choicesPlainText?.[idx] ? renderPlainText : renderMath)(choice) }}
                  />
                  {viewState === 'feedback' && idx === mcqData.answer && (
                    <CheckCircle2 className="text-accent ml-3 shrink-0" size={20} />
                  )}
                  {viewState === 'feedback' && idx === selectedChoiceIndex && selectedChoiceIndex !== mcqData.answer && (
                    <XCircle className="text-danger ml-3 shrink-0" size={20} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Solution Block */}
          <AnimatePresence>
            {viewState === 'feedback' && showSolution && (mcqData.explanation || mcqData.solutionImagePath) && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: 12 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: 12 }}
                transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                className="px-6 pb-4 overflow-hidden"
              >
                <div className="p-4 bg-[#111] rounded border border-border-base">
                  <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-text-muted mb-2 block">
                    Solution
                  </span>
                  {mcqData.explanation && (
                    <p
                      className="text-sm text-[#CCC] font-['Rajdhani'] font-medium whitespace-pre-wrap leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMath(mcqData.explanation) }}
                    />
                  )}
                  {mcqData.solutionImagePath && (
                    <img
                      src={`ece-app://${mcqData.solutionImagePath}`}
                      alt="Solution diagram"
                      className="mt-3 max-w-full rounded border border-[#333] object-contain max-h-64 cursor-zoom-in"
                      onClick={() => setZoomedImage(mcqData.solutionImagePath!)}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {viewState === 'feedback' && explanationOpen && (
            <ExplanationPanel
              question={mcqData.question}
              choices={mcqData.choices}
              answerIndex={mcqData.answer}
              onClose={() => setExplanationOpen(false)}
            />
          )}

          {viewState === 'question' ? (
            <div className="flex justify-center border-t border-border-base pt-6 mt-auto">
              <button
                onClick={() => submitAnswer('idk')}
                className="px-8 py-2.5 rounded border border-[#333] bg-[#121212] hover:bg-[#1f1f1f] hover:border-[#555] text-[#b8b8b8] hover:text-white transition-all font-['Rajdhani'] font-bold uppercase tracking-widest text-sm shadow-sm"
              >
                I Don't Know
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center border-t border-border-base pt-6 mt-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
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
              {(() => {
                const hasSolution = Boolean(mcqData?.explanation || mcqData?.solutionImagePath)
                const isNextDisabled = viewState === 'feedback' && hasSolution && !showSolution
                return (
                  <button
                    onClick={handleNext}
                    disabled={isNextDisabled}
                    className={`w-full max-w-sm mx-auto py-3 text-base rounded font-bold font-['Orbitron'] tracking-widest uppercase transition-all mb-4 ${
                      isNextDisabled
                        ? 'bg-[#222] text-[#666] border border-[#333] cursor-not-allowed opacity-50 shadow-none'
                        : 'bg-[var(--accent-primary)] text-black hover:bg-[var(--accent-dim)] shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)]'
                    }`}
                  >
                    Next <span className="font-['JetBrains_Mono'] text-xs ml-2 opacity-60">(Space)</span>
                  </button>
                )
              })()}

              <div className="flex items-center gap-3 flex-wrap justify-center">
                <Tooltip content="Copy context to paste into GPT/Gemini/Claude for a better AI explanation.">
                  <button
                    onClick={handleGetContext}
                    className="flex items-center gap-2 px-4 py-2 border border-[rgba(255,255,255,0.3)] rounded text-[#CCCCCC] hover:text-white hover:border-text-muted transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs"
                  >
                    <Copy size={14} />
                    Get Context
                  </button>
                </Tooltip>

                <Tooltip position="right" content="Explain using GPT-OSS-120B">
                  <button
                    onClick={() => setExplanationOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-[rgba(0,255,65,0.3)] rounded text-accent hover:bg-[rgba(0,255,65,0.08)] hover:border-accent transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs"
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
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 lg:p-10 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <button
              className="absolute top-6 right-6 text-text-muted hover:text-accent transition-colors p-2 bg-[#111] rounded-full border border-[#333] hover:border-accent"
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