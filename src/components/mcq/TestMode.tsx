import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import { Card, MCQData } from '../../types'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, Clock, ArrowRight, RefreshCw, ClipboardCheck, X, AlertTriangle, Copy, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { shuffle, shuffleChoices } from '../../lib/scrambler'
import { renderMath } from '../../lib/latex'
import { ExplanationPanel } from '../ui/ExplanationPanel'
import { Tooltip } from '../ui/Tooltip'
import Toast from '../ui/Toast'
import { useBlocker } from 'react-router-dom'
import { LeaveConfirmModal } from '../ui/LeaveConfirmModal'
import { dbService } from '../../services/db.service'
import { useSound, getSoundsMuted, setSoundsMuted } from '../../hooks/useSound'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TestNavRail } from '../ui/TestNavRail'


interface TestModeProps {
  cards: Card[]
  title?: string
  settings: {
    instantChecking: boolean
    shuffleQuestions: boolean
    shuffleChoices: boolean
    bookmarkedOnly: boolean
  }
  onComplete: (stats: { score: number; total: number; bookmarked: number; correctIds: string[] }) => void
  onExit: () => void
}

type ViewState = 'test' | 'summary' | 'review'

// ─── Memoised Question Card ───────────────────────────────────────────────────
interface TestQuestionCardProps {
  card: Card
  index: number
  viewState: ViewState
  answers: Record<string, number>
  bookmarkedIds: Set<string>
  currentVisibleIndex: number
  settings: { instantChecking: boolean }
  openExplanationId: number | null
  onSelectChoice: (cardId: string, choiceIndex: number) => void
  onToggleBookmark: (cardId: string) => void
  onScrollTo: (index: number) => void
  onToggleExplanation: (index: number) => void
  onGetContext: (mcq: MCQData) => void
  onSetZoomedImage: (path: string) => void
}

const TestQuestionCard = memo(({
  card,
  index,
  viewState,
  answers,
  bookmarkedIds,
  currentVisibleIndex,
  settings,
  openExplanationId,
  onSelectChoice,
  onToggleBookmark,
  onScrollTo,
  onToggleExplanation,
  onGetContext,
  onSetZoomedImage,
}: TestQuestionCardProps) => {
  const mcq = card.data as MCQData

  if (!mcq || typeof mcq === 'string' || !Array.isArray(mcq.choices) || mcq.choices.length !== 4) {
    console.warn('[ECEngine] Card data parse error', card.id, card.data)
    return (
      <div
        className="rounded-xl p-6 border"
        style={{ color: 'var(--color-wrong)', background: 'var(--bg-card)', borderColor: 'var(--color-wrong)' }}
      >
        <p className="font-['Rajdhani'] font-bold uppercase tracking-widest text-sm mb-1">Card Load Error</p>
        <p className="font-['Rajdhani'] text-sm opacity-80">Card data could not be loaded. Check import format.</p>
      </div>
    )
  }

  const userAnswer = answers[card.id]
  const isAnswered = userAnswer !== undefined
  const isCorrect = isAnswered && userAnswer === mcq.answer
  const isBookmarked = bookmarkedIds.has(card.id)

  const showFeedback = viewState === 'review' || (settings.instantChecking && isAnswered)

  return (
    <div
      id={`test-question-${index}`}
      onClick={() => onScrollTo(index)}
      className={`flex-shrink-0 bg-[var(--bg-card)] border rounded-xl overflow-hidden shadow-lg transition-colors duration-300 relative cursor-pointer scroll-mt-20
        ${showFeedback
          ? (isCorrect ? 'border-[#00FF41]/30 bg-[#00FF41]/5' : (isAnswered ? 'border-[#FF003C]/30 bg-[#FF003C]/5' : 'border-[#333]'))
          : (isAnswered ? 'border-[#555]' : 'border-[#222]')
        }`}
    >
      <div className="p-6 border-b border-[#333] flex items-start gap-4">
        <div className="flex-1 flex flex-col h-auto pr-2">
          <h3
            className="font-['Rajdhani'] font-semibold text-[var(--text-primary)] whitespace-pre-wrap flex items-start gap-3 text-lg leading-relaxed"
          >
            <span
              className="text-[var(--accent-primary)] font-bold shrink-0 text-base"
            >
              {index + 1}.
            </span>
            <span
              className="flex-1 mt-[2px]"
              dangerouslySetInnerHTML={{ __html: renderMath(mcq.question) }}
            />
          </h3>

          {mcq.imagePath && (
            <div className="mt-4 w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg hover:border-[#00FF41] transition-all">
              <img
                src={`ece-app://${mcq.imagePath}`}
                alt="Question diagram"
                className="w-full h-full max-h-[300px] object-contain cursor-zoom-in"
                onClick={(e) => { e.stopPropagation(); onSetZoomedImage(mcq.imagePath!) }}
              />
            </div>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onToggleBookmark(card.id) }}
          className={`p-2 rounded transition-colors ${isBookmarked
            ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
            : 'text-[#555] hover:bg-[#222] hover:text-[#888]'
          }`}
          title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
        >
          <Bookmark className="w-5 h-5 fill-current" />
        </button>
      </div>

      <div className="p-6 grid grid-cols-2 gap-4 items-start">
        {[0, 1, 2, 3].map((cIdx) => {
          const choice = mcq.choices[cIdx]
          if (choice === undefined) return null

          const isSelected = userAnswer === cIdx

          let stateStyles = 'border-[#333] hover:border-[#00FF41] hover:shadow-[0_0_8px_rgba(0,255,65,0.2)] bg-[#111] text-[#E8E8E8]'
          let iconElement: React.ReactNode = null
          let prefixStyles = 'text-[#666]'

          if (showFeedback) {
            const isChoiceCorrect = cIdx === mcq.answer
            if (isChoiceCorrect) {
              stateStyles = 'border-[#00FF41] bg-[rgba(0,255,65,0.1)] text-[#00FF41] shadow-[0_0_15px_rgba(0,255,65,0.15)]'
              iconElement = <div className="text-[#00FF41] font-bold">✓</div>
              prefixStyles = 'text-[#00FF41] font-bold'
            } else if (isSelected && !isChoiceCorrect) {
              stateStyles = 'border-[#FF003C] bg-[rgba(255,0,60,0.1)] text-[#FF003C]'
              iconElement = <div className="text-[#FF003C] font-bold">✗</div>
              prefixStyles = 'text-[#FF003C] font-bold'
            } else {
              stateStyles = 'border-[#222] bg-[#111] text-[#666] opacity-60'
              prefixStyles = 'text-[#555]'
            }
          } else {
            if (isSelected) {
              stateStyles = 'border-[var(--accent-primary)] bg-[rgba(0,255,65,0.1)] text-[var(--accent-primary)]'
              prefixStyles = 'text-[var(--accent-primary)] font-bold'
            }
          }

          const choiceLabel = String.fromCharCode(65 + cIdx)

          return (
            <button
              key={cIdx}
              onClick={(e) => { e.stopPropagation(); onSelectChoice(card.id, cIdx) }}
              disabled={viewState === 'review' || (settings.instantChecking && isAnswered)}
              className={`flex items-center text-left py-4 px-4 min-h-[56px] rounded-lg border transition-all duration-200 font-['Rajdhani'] ${stateStyles} ${
                viewState === 'review' || (settings.instantChecking && isAnswered) ? 'cursor-default' : 'cursor-pointer'
              }`}
            >
              <div className={`flex-shrink-0 mr-3 font-['IBM_Plex_Mono'] ${prefixStyles}`}>
                {choiceLabel}.
              </div>
              <span
                className="flex-1 break-words font-['Rajdhani'] font-medium text-base leading-normal"
                dangerouslySetInnerHTML={{ __html: renderMath(choice) }}
              />
              {iconElement && <div className="ml-4 flex-shrink-0">{iconElement}</div>}
            </button>
          )
        })}
      </div>

      {showFeedback && mcq.explanation && (
        <div className="px-6 pb-6 pt-2">
          <div className="p-4 bg-[#111] rounded border border-[#222]">
            <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888] mb-1 block">Explanation</span>
            <p
              className="text-sm text-[#CCC] font-['Rajdhani'] font-medium whitespace-pre-wrap leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMath(mcq.explanation) }}
            />
          </div>
        </div>
      )}

      {viewState === 'review' && (
        <div className="px-6 pb-6 pt-1 flex items-center gap-3">
          <Tooltip content="Copy context to paste into GPT/Gemini/Claude for a better AI explanation.">
            <button
              onClick={(e) => { e.stopPropagation(); onGetContext(mcq) }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[rgba(255,255,255,0.3)] rounded text-[#CCCCCC] hover:text-white hover:border-[#888] transition-colors font-['Rajdhani'] uppercase tracking-widest text-[0.75rem]"
            >
              <Copy size={12} />
              Get Context
            </button>
          </Tooltip>

          <Tooltip position="right" content="Explain using Grok Llama-3.3-70B">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleExplanation(index) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded transition-colors font-['Rajdhani'] uppercase tracking-widest text-[0.75rem] ${
                openExplanationId === index
                  ? 'border-[#00FF41] bg-[rgba(0,255,65,0.08)] text-[#00FF41]'
                  : 'border-[rgba(0,255,65,0.3)] text-[#00FF41] hover:bg-[rgba(0,255,65,0.08)] hover:border-[#00FF41]'
              }`}
            >
              <Sparkles size={12} />
              {openExplanationId === index ? 'Hide Explanation' : 'Explain'}
            </button>
          </Tooltip>
        </div>
      )}

      {viewState === 'review' && openExplanationId === index && (
        <div onClick={(e) => e.stopPropagation()}>
          <ExplanationPanel
            question={mcq.question}
            choices={mcq.choices}
            answerIndex={mcq.answer}
            onClose={() => onToggleExplanation(index)}
          />
        </div>
      )}
    </div>
  )
})

TestQuestionCard.displayName = 'TestQuestionCard'

// ─── Main Component ───────────────────────────────────────────────────────────
export const TestMode: React.FC<TestModeProps> = ({ cards, title, settings, onComplete, onExit }) => {
  const { play } = useSound()
  const [isMuted, setIsMuted] = useState(() => getSoundsMuted())

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    setSoundsMuted(next)
  }

  const [testCards, setTestCards] = useState<Card[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('bookmarkedIds')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [viewState, setViewState] = useState<ViewState>('test')
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  const [timeElapsed, setTimeElapsed] = useState(0)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  const [openExplanationId, setOpenExplanationId] = useState<number | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showToast, setShowToast] = useState(false)

  // Scroll tracking
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isClickNavigating = useRef(false)
  const clickNavTimeout = useRef<NodeJS.Timeout | null>(null)
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0)

  // ── Virtualizer ────────────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: testCards.length,
    getScrollElement: () => scrollContainerRef.current,
    // Estimated height covers a medium question + 4 choices; actual sizes are
    // measured on first render and cached, so accuracy only matters for the
    // initial scroll-bar thumb size.
    estimateSize: () => 380,
    overscan: 4,
  })

  // ── Scroll-spy: determine current visible index from scroll position ────────
  const handleContainerScroll = useCallback(() => {
    if (isClickNavigating.current || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const { scrollTop, scrollHeight, clientHeight } = container

    // At absolute bottom → highlight last card
    if (Math.abs(scrollHeight - scrollTop - clientHeight) < 2) {
      setCurrentVisibleIndex(testCards.length - 1)
      return
    }

    // Find the virtual item whose top is closest to the upper third of viewport
    const targetY = scrollTop + clientHeight * 0.3
    const items = virtualizer.getVirtualItems()
    let bestIdx = currentVisibleIndex
    let bestDist = Infinity
    for (const item of items) {
      const dist = Math.abs(item.start - targetY)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = item.index
      }
    }
    if (bestIdx !== currentVisibleIndex) {
      setCurrentVisibleIndex(bestIdx)
    }
  }, [testCards.length, virtualizer, currentVisibleIndex])

  // Scroll to a question via virtualizer
  const scrollToQuestion = useCallback((index: number) => {
    isClickNavigating.current = true
    if (clickNavTimeout.current) clearTimeout(clickNavTimeout.current)
    setCurrentVisibleIndex(index)
    virtualizer.scrollToIndex(index, { align: 'center', behavior: 'auto' })
    clickNavTimeout.current = setTimeout(() => {
      isClickNavigating.current = false
    }, 300)
  }, [virtualizer])

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (clickNavTimeout.current) clearTimeout(clickNavTimeout.current)
    }
  }, [])

  // Navigation Blocking
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      viewState === 'test' && currentLocation.pathname !== nextLocation.pathname
  )
  const blockerRef = useRef(blocker)
  useEffect(() => { blockerRef.current = blocker }, [blocker])
  useEffect(() => {
    return () => {
      if (blockerRef.current.state === 'blocked') blockerRef.current.reset()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (viewState === 'test') {
          setShowExitConfirm(true)
        } else {
          handleExit()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewState])

  const handleExit = () => {
    if (blocker.state === 'blocked') blocker.reset()
    onExit()
  }

  // Reset explanation panel on view change
  useEffect(() => {
    setOpenExplanationId(null)
  }, [viewState, testCards])

  // GET CONTEXT helper
  const handleGetContext = useCallback((mcq: MCQData) => {
    const template = `---
Please explain the correct answer to this multiple choice question:

QUESTION:
${mcq.question}

CHOICES:
A. ${mcq.choices[0]}
B. ${mcq.choices[1]}
C. ${mcq.choices[2]}
D. ${mcq.choices[3]}

CORRECT ANSWER: ${String.fromCharCode(65 + mcq.answer)}. ${mcq.choices[mcq.answer]}

Please explain:
1. Why the correct answer is right
2. Why each of the other choices is wrong
3. Any relevant formula, law, or concept that applies
4. A memory tip or way to remember this for the board exam
---`
    navigator.clipboard.writeText(template).then(() => setShowToast(true))
  }, [])

  useEffect(() => {
    if (zoomedImage) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [zoomedImage])

  // Initialize test cards
  useEffect(() => {
    let finalCards = [...cards]
    if (settings.shuffleQuestions) finalCards = shuffle(finalCards)
    if (settings.shuffleChoices) {
      finalCards = finalCards.map(card => {
        const mcq = card.data as MCQData
        if (mcq?.choices) {
          const sc = shuffleChoices(mcq.choices, mcq.answer)
          return { ...card, data: { ...mcq, choices: sc.choices, answer: sc.answer } }
        }
        return card
      })
    }
    setTestCards(finalCards)
  }, [cards, settings])

  // Timer
  useEffect(() => {
    if (viewState !== 'test') return
    const interval = setInterval(() => setTimeElapsed(prev => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [viewState])

  const handleSelectChoice = useCallback((cardId: string, choiceIndex: number) => {
    if (viewState !== 'test') return
    if (settings.instantChecking && answers[cardId] !== undefined) return
    setAnswers(prev => ({ ...prev, [cardId]: choiceIndex }))
    if (settings.instantChecking) {
      const card = testCards.find(c => c.id === cardId)
      if (card) {
        const mcq = card.data as MCQData
        play(choiceIndex === mcq.answer ? 'correct' : 'wrong')
      }
    }
  }, [viewState, settings.instantChecking, answers, testCards, play])

  const toggleBookmark = useCallback((cardId: string) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      localStorage.setItem('bookmarkedIds', JSON.stringify(Array.from(next)))
      return next
    })
  }, [])

  const handleSubmit = async () => {
    setShowSubmitConfirm(false)
    let correct = 0
    testCards.forEach(card => {
      const mcq = card.data as MCQData
      if (answers[card.id] === mcq.answer) correct++
    })
    for (const card of testCards) {
      const mcq = card.data as MCQData
      const isCorrect = answers[card.id] === mcq.answer
      await dbService.recordCardResult(card.id, isCorrect)
    }
    setScore({ correct, total: testCards.length })
    setViewState('summary')
    play('finish')
    const correctIds = testCards.filter(card => {
      const mcq = card.data as MCQData
      return answers[card.id] === mcq.answer
    }).map(card => card.id)
    onComplete({ score: correct, total: testCards.length, bookmarked: bookmarkedIds.size, correctIds })
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const answeredCount = Object.keys(answers).length
  const passThreshold = 0.75
  const isPassed = score.total > 0 && (score.correct / score.total) >= passThreshold

  // Derive a Set<number> of answered positional indices for the nav rail
  const answeredIndices = useMemo(() => {
    const s = new Set<number>()
    testCards.forEach((card, idx) => {
      if (answers[card.id] !== undefined) s.add(idx)
    })
    return s
  }, [answers, testCards])

  const handleToggleExplanation = useCallback((index: number) => {
    setOpenExplanationId(prev => prev === index ? null : index)
  }, [])

  // ── Top Bar ─────────────────────────────────────────────────────────────────
  const renderTopBar = () => (
    <div className="sticky top-0 left-0 w-full bg-[var(--bg-secondary)] border-b border-[var(--bg-card)] shadow-lg z-50 flex flex-row items-center justify-between gap-2 px-6 py-4 shrink-0">
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <button
          onClick={() => { if (viewState === 'test') setShowExitConfirm(true); else handleExit() }}
          className="text-[#888] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center p-2 rounded hover:bg-[#222] shrink-0"
          title="Exit Test"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[var(--text-primary)] font-['Orbitron'] tracking-widest font-bold text-2xl truncate uppercase flex items-center min-w-0">
            {title ? (
              <>
                <span className="text-[#888] mr-2 shrink-0">TEST:</span>
                <span className="text-[var(--accent-primary)] truncate">{title}</span>
              </>
            ) : 'Test Mode'}
          </span>
          {/* subtitle removed — answered count is shown in the nav rail */}
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        <button
          onClick={toggleMute}
          className={`p-2 rounded border transition-colors ${isMuted ? 'border-[#FF3333] text-[#FF3333] bg-[rgba(255,51,51,0.08)]' : 'border-[#333] text-[#888] hover:text-white hover:border-[#666]'}`}
          title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <div className="flex items-center gap-2 text-lg font-bold tracking-widest bg-[#111] px-4 py-1.5 rounded border border-[#333] shrink-0">
          <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
          {formatTime(timeElapsed)}
        </div>

        {viewState === 'test' ? (
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="bg-[var(--accent-primary)] text-black px-4 py-2 text-base rounded font-['Rajdhani'] font-bold tracking-widest uppercase hover:bg-[var(--accent-dim)] transition-colors whitespace-nowrap"
          >
            Submit Test
          </button>
        ) : (
          <button
            onClick={handleExit}
            className="bg-[#222] text-[#E8E8E8] px-4 py-2 text-base rounded font-['Rajdhani'] font-bold tracking-widest uppercase hover:bg-[#333] border border-[#444] transition-colors whitespace-nowrap"
          >
            Finish Review
          </button>
        )}
      </div>
    </div>
  )

  // ── Summary View ─────────────────────────────────────────────────────────────
  if (viewState === 'summary') {
    const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0

    return (
      <div className="h-full bg-[var(--bg-primary)] flex flex-col relative overflow-hidden">
        {renderTopBar()}
        <LeaveConfirmModal
          isOpen={blocker.state === 'blocked' || showExitConfirm}
          onConfirm={() => {
            if (blocker.state === 'blocked') blocker.proceed?.()
            else { setShowExitConfirm(false); handleExit() }
          }}
          onCancel={() => {
            if (blocker.state === 'blocked') blocker.reset?.()
            else setShowExitConfirm(false)
          }}
        />

        <div className="flex-1 overflow-y-auto mt-20 p-6 lg:p-12 flex flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[var(--bg-card)] border border-[#333] rounded-xl p-10 max-w-2xl w-full flex flex-col items-center text-center shadow-2xl relative overflow-hidden"
          >
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 blur-[100px] opacity-20 pointer-events-none transition-colors duration-1000 ${isPassed ? 'bg-[#00FF41]' : 'bg-[#FF003C]'}`} />

            <div className="z-10 flex flex-col items-center w-full">
              <ClipboardCheck className={`w-16 h-16 mb-6 ${isPassed ? 'text-[#00FF41]' : 'text-[#FF003C]'}`} />
              <h2 className="text-3xl font-['Orbitron'] font-bold text-[var(--text-primary)] mb-1 uppercase tracking-wide">
                Test Completed
              </h2>
              {title && (
                <div className="text-[#00FF41] font-['Orbitron'] font-bold text-xl tracking-[0.2em] uppercase mb-4">
                  {title}
                </div>
              )}
              <p className="text-[#888] font-['Rajdhani'] text-lg tracking-widest mb-8">
                {isPassed ? 'Passed (≥ 75%)' : 'Failed (< 75%)'}
              </p>

              <div className="flex items-center justify-center gap-12 w-full border-y border-[#222] py-8 mb-8 bg-[#161616] rounded-lg">
                <div className="flex flex-col items-center">
                  <span className="text-[var(--text-secondary)] text-sm font-['Rajdhani'] uppercase tracking-widest mb-1">Score</span>
                  <span className={`text-5xl font-['Rajdhani'] font-bold ${isPassed ? 'text-[#00FF41]' : 'text-[#FF003C]'}`}>
                    {percentage}%
                  </span>
                </div>
                <div className="w-px h-16 bg-[#333]"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[var(--text-secondary)] text-sm font-['Rajdhani'] uppercase tracking-widest mb-1">Correct</span>
                  <span className="text-3xl font-['Rajdhani'] font-bold text-[#E8E8E8]">
                    {score.correct} <span className="text-[#888] text-xl">/ {score.total}</span>
                  </span>
                </div>
                <div className="w-px h-16 bg-[#333]"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[var(--text-secondary)] text-sm font-['Rajdhani'] uppercase tracking-widest mb-1">Time</span>
                  <span className="text-3xl font-['Rajdhani'] font-bold text-[#E8E8E8]">
                    {formatTime(timeElapsed)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full">
                {score.correct < score.total && (
                  <button
                    onClick={() => {
                      const wrongCards = testCards.filter(c => {
                        const mcq = c.data as MCQData
                        return answers[c.id] !== mcq.answer
                      })
                      setTestCards(wrongCards)
                      setAnswers({})
                      setTimeElapsed(0)
                      setViewState('test')
                    }}
                    className="flex-1 py-3 px-6 rounded bg-[#222] border border-[#333] hover:bg-[#333] hover:border-[#555] text-[var(--text-primary)] transition-all font-['Rajdhani'] font-bold tracking-widest uppercase flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Retry Wrong Items
                  </button>
                )}

                <button
                  onClick={() => setViewState('review')}
                  className="flex-1 py-3 px-6 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-dim)] text-black transition-all font-['Rajdhani'] font-bold tracking-widest uppercase flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,65,0.2)]"
                >
                  <ArrowRight className="w-5 h-5" />
                  Review Answers
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Test / Review Render ─────────────────────────────────────────────────────
  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div className="h-full bg-[var(--bg-primary)] flex flex-col relative overflow-hidden">
      {renderTopBar()}

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

      {/* Main Content Wrapper — independent scroll columns, no shared scroll container */}
      <div className="flex-1 flex flex-row overflow-hidden pl-2 lg:pl-4 gap-5 pt-4 lg:pt-8">
        {/* Left Column: Navigation Rail (self-contained scroll) */}
        <div className="shrink-0 flex flex-col w-auto">
          <TestNavRail
            totalItems={testCards.length}
            currentIndex={currentVisibleIndex}
            answeredIndices={answeredIndices}
            onNavigate={scrollToQuestion}
          />
        </div>

        {/* Right Column: Question list — sole scroll owner for the virtualizer */}
        <div
          ref={scrollContainerRef}
          onScroll={handleContainerScroll}
          className="flex-1 min-w-0 overflow-y-auto pb-32"
        >
          <div className="max-w-4xl mx-auto px-6 w-full">
            {/* Total height sentinel — tells the browser how tall the full list is */}
            <div
              className="w-full relative"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualItems.map(virtualRow => (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '2rem', // gap between cards
                  }}
                >
                  <TestQuestionCard
                    card={testCards[virtualRow.index]}
                    index={virtualRow.index}
                    viewState={viewState}
                    answers={answers}
                    bookmarkedIds={bookmarkedIds}
                    currentVisibleIndex={currentVisibleIndex}
                    settings={settings}
                    openExplanationId={openExplanationId}
                    onSelectChoice={handleSelectChoice}
                    onToggleBookmark={toggleBookmark}
                    onScrollTo={scrollToQuestion}
                    onToggleExplanation={handleToggleExplanation}
                    onGetContext={handleGetContext}
                    onSetZoomedImage={setZoomedImage}
                  />
                </div>
              ))}
            </div>

            {testCards.length === 0 && (
              <div className="text-center text-[#888] mt-20 font-['Rajdhani'] uppercase tracking-widest">
                No questions available for this test.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      <AnimatePresence>
        {showSubmitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-[#333] p-8 rounded-xl max-w-md w-full shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <AlertTriangle className="w-16 h-16 text-[#FFB800] mb-4" />
                <h3 className="text-2xl font-['Orbitron'] font-bold text-white mb-2 tracking-widest uppercase">
                  Submit Test?
                </h3>

                {testCards.length - answeredCount > 0 ? (
                  <p className="text-[#E8E8E8] font-['IBM_Plex_Mono'] mb-6">
                    You still have <span className="text-[#FF3333] font-bold">{testCards.length - answeredCount}</span> unanswered questions. Are you sure you want to submit?
                  </p>
                ) : (
                  <p className="text-[#E8E8E8] font-['IBM_Plex_Mono'] mb-6">
                    You have answered all questions. Are you ready to submit and see your score?
                  </p>
                )}

                <div className="flex gap-4 w-full">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    className="flex-1 py-3 bg-[#222] text-[#E8E8E8] rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="flex-1 py-3 bg-[var(--accent-primary)] text-black rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[var(--accent-dim)] transition-colors shadow-[0_0_15px_rgba(0,255,65,0.2)]"
                  >
                    Confirm Submit
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <Toast
            message="Context copied to clipboard — paste into Gemini, ChatGPT, or Claude"
            onDismiss={() => setShowToast(false)}
          />
        )}
      </AnimatePresence>

      {/* Lightbox */}
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