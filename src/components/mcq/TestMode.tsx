import React, { useState, useEffect } from 'react'
import { Card, MCQData } from '../../types'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, Clock, ArrowRight, RefreshCw, ClipboardCheck, X, AlertTriangle, Copy, Sparkles } from 'lucide-react'
import { shuffle, shuffleChoices } from '../../lib/scrambler'
import { renderMath } from '../../lib/latex'
import { ExplanationPanel } from '../ui/ExplanationPanel'
import { Tooltip } from '../ui/Tooltip'
import Toast from '../ui/Toast'
import { useBlocker } from 'react-router-dom'
import { LeaveConfirmModal } from '../ui/LeaveConfirmModal'
import { useRef } from 'react'
import { dbService } from '../../services/db.service'


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

const getQuestionFontSize = (text: string): string => {
  if (text.length < 80) return '1.5rem'
  if (text.length < 150) return '1.2rem'
  if (text.length < 250) return '1rem'
  return '0.9rem'
}

const getChoiceFontSize = (text: string): string => {
  if (text.length < 40) return '1rem'
  if (text.length < 80) return '0.9rem'
  if (text.length < 120) return '0.82rem'
  return '0.75rem'
}

export const TestMode: React.FC<TestModeProps> = ({ cards, title, settings, onComplete, onExit }) => {
  const [testCards, setTestCards] = useState<Card[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({}) // card.id -> choiceIndex
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('bookmarkedIds')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })
  const [viewState, setViewState] = useState<ViewState>('test')
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  const [timeElapsed, setTimeElapsed] = useState(0)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  // AI Explanation state — stores the index of the currently open panel (null = all closed)
  const [openExplanationId, setOpenExplanationId] = useState<number | null>(null)

  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Question tracking refs for scrolling
  const questionRefs = useRef<(HTMLDivElement | null)[]>([])
  const navItemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isClickNavigating = useRef(false)
  const clickNavTimeout = useRef<NodeJS.Timeout | null>(null)
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0)

  // IntersectionObserver Scroll-Spy logic to sync sidebar with manual scrolling
  useEffect(() => {
    if (isClickNavigating.current || !scrollContainerRef.current) return

    const observerOptions = {
      root: scrollContainerRef.current,
      rootMargin: '-30% 0px -30% 0px', // Focus on the middle 40% of the viewport
      threshold: 0
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      // If we are currently animating a click-scroll, ignore observer updates
      if (isClickNavigating.current) return

      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id
          const index = parseInt(id.split('-').pop() || '0', 10)
          if (!isNaN(index) && index !== currentVisibleIndex) {
            setCurrentVisibleIndex(index)
          }
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)

    // Observe all question containers
    const questionElements = document.querySelectorAll('[id^="test-question-"]')
    questionElements.forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [testCards, currentVisibleIndex]) // Re-run when cards change or index updates to stay fresh, but callback handles logic

  // Auto-scroll sidebar to current question instantly without animation queueing lag
  useEffect(() => {
    if (navItemRefs.current[currentVisibleIndex]) {
      navItemRefs.current[currentVisibleIndex]?.scrollIntoView({
        behavior: 'auto',
        block: 'center'
      })
    }
  }, [currentVisibleIndex])

  // Navigation Blocking logic
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      viewState === 'test' && currentLocation.pathname !== nextLocation.pathname
  )

  // Keep a live ref to the blocker so the unmount cleanup always calls reset()
  // on the *current* blocker instance — not a stale closure copy.
  const blockerRef = useRef(blocker)
  useEffect(() => { blockerRef.current = blocker }, [blocker])

  // On unmount, unconditionally reset any lingering blocked state so the
  // sidebar never gets permanently locked after the user exits a test.
  useEffect(() => {
    return () => {
      if (blockerRef.current.state === 'blocked') {
        blockerRef.current.reset()
      }
    }
  }, []) // intentionally empty — runs only on unmount

  // Safe exit: reset any active blocker before handing control to parent
  const handleExit = () => {
    if (blocker.state === 'blocked') blocker.reset()
    onExit()
  }

  // Reset the explanation panel when transitioning between views
  useEffect(() => {
    setOpenExplanationId(null);
  }, [viewState, testCards]);
  const [showToast, setShowToast] = useState(false)

  // GET CONTEXT helper — formats the question into a structured clipboard prompt
  const handleGetContext = (mcq: MCQData) => {
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
  }

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

  // Initialize test cards
  useEffect(() => {
    let finalCards = [...cards]

    if (settings.shuffleQuestions) {
      finalCards = shuffle(finalCards)
    }

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
    const interval = setInterval(() => {
      setTimeElapsed(prev => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [viewState])

  // Highly optimized synchronous scroll tracking to guarantee zero-delay updating
  const handleContainerScroll = () => {
    // Scroll-Spy is now handled by IntersectionObserver for cleaner state management
    if (isClickNavigating.current || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    // Fix: Force active rail to final item when at absolute bottom
    const isAtBottom = Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 2
    if (isAtBottom) {
      setCurrentVisibleIndex(testCards.length - 1)
    }
  }

  // Clear pending click-nav timeout on unmount to avoid stale timer callbacks
  useEffect(() => {
    return () => {
      if (clickNavTimeout.current) clearTimeout(clickNavTimeout.current)
    }
  }, [])

  const scrollToQuestion = (index: number) => {
    isClickNavigating.current = true
    if (clickNavTimeout.current) clearTimeout(clickNavTimeout.current)
    
    // Immediate state update
    setCurrentVisibleIndex(index)

    const targetElement = document.getElementById(`test-question-${index}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    clickNavTimeout.current = setTimeout(() => {
      isClickNavigating.current = false
    }, 800)
  }

  const handleSelectChoice = (cardId: string, choiceIndex: number) => {
    if (viewState !== 'test') return

    // If instant checking is on, lock the answer once submitted?
    // Often instant checking just shows green/red as you click, allowing changes or locking it.
    // Let's assume it locks the first answer if instant check is true.
    if (settings.instantChecking && answers[cardId] !== undefined) {
      return // Already answered, locked.
    }

    setAnswers(prev => ({ ...prev, [cardId]: choiceIndex }))
  }

  const toggleBookmark = (cardId: string) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      localStorage.setItem('bookmarkedIds', JSON.stringify(Array.from(next)))
      return next
    })
  }

  const handleSubmit = async () => {
    setShowSubmitConfirm(false)
    // Score test
    let correct = 0
    testCards.forEach(card => {
      const mcq = card.data as MCQData
      if (answers[card.id] === mcq.answer) {
        correct++
      }
    })

    // Record progress for all cards in session
    for (const card of testCards) {
      const mcq = card.data as MCQData
      const isCorrect = answers[card.id] === mcq.answer
      await dbService.recordCardResult(card.id, isCorrect)
    }

    setScore({ correct, total: testCards.length })
    setViewState('summary')
    const correctIds = testCards.filter(card => {
      const mcq = card.data as MCQData;
      return answers[card.id] === mcq.answer;
    }).map(card => card.id);
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

  // Render top bar
  const renderTopBar = () => (
    <div className="sticky top-0 left-0 w-full bg-[var(--bg-secondary)] border-b border-[var(--bg-card)] shadow-lg z-50 px-6 py-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-6">
        <button
          onClick={() => {
            if (viewState === 'test') setShowExitConfirm(true)
            else handleExit()
          }}
          className="text-[#888] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center p-2 rounded hover:bg-[#222]"
          title="Exit Test"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col">
          <span className="text-[var(--text-primary)] font-['Orbitron'] tracking-widest font-bold text-lg uppercase flex items-center">
            {title ? (
              <>
                <span className="text-[#888] mr-2">TEST:</span>
                <span className="text-[var(--accent-primary)]">{title}</span>
              </>
            ) : 'Test Mode'}
          </span>
          {viewState === 'test' && (
            <span className="text-[#888] text-xs font-['Rajdhani'] uppercase tracking-widest mt-0.5">
              {answeredCount} of {testCards.length} Answered
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-[#E8E8E8] font-['Rajdhani'] text-lg font-bold tracking-widest bg-[#111] px-4 py-1.5 rounded border border-[#333]">
          <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
          {formatTime(timeElapsed)}
        </div>

        {viewState === 'test' ? (
          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="bg-[var(--accent-primary)] text-black px-6 py-2 rounded font-['Rajdhani'] font-bold tracking-widest uppercase hover:bg-[var(--accent-dim)] transition-colors"
          >
            Submit Test
          </button>
        ) : (
          <button
            onClick={handleExit}
            className="bg-[#222] text-[#E8E8E8] px-6 py-2 rounded font-['Rajdhani'] font-bold tracking-widest uppercase hover:bg-[#333] border border-[#444] transition-colors"
          >
            Finish Review
          </button>
        )}
      </div>
    </div>
  )

  if (viewState === 'summary') {
    const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0

    return (
      <div className="h-full bg-[var(--bg-primary)] flex flex-col relative overflow-hidden">
        {renderTopBar()}

        <div className="flex-1 overflow-y-auto mt-20 p-6 lg:p-12 flex flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[var(--bg-card)] border border-[#333] rounded-xl p-10 max-w-2xl w-full flex flex-col items-center text-center shadow-2xl relative overflow-hidden"
          >
            {/* Background Glow */}
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
                {/* Retry Wrong Items */}
                {score.correct < score.total && (
                  <button
                    onClick={() => {
                      // Filter cards to only wrong ones and restart
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

  // Common Question Rendering
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

      {/* Main Content Wrapper */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Right Scrollable Questions Container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleContainerScroll}
          className="flex-1 overflow-y-auto p-6 lg:p-12 pb-32 scroll-smooth"
        >
          <div className="w-full max-w-4xl mx-auto flex flex-col gap-8">
            {testCards.map((card, index) => {
              const mcq = card.data as MCQData
              if (!mcq || typeof mcq === 'string' || !Array.isArray(mcq.choices) || mcq.choices.length !== 4) {
                console.warn('[ECEngine] Card data parse error — card may have been saved with double-escaped LaTeX. Please re-save this card in Edit Deck.', card.id, card.data)
                return (
                  <div
                    key={card.id}
                    className="rounded-xl p-6 border"
                    style={{
                      color: 'var(--color-wrong)',
                      background: 'var(--bg-card)',
                      borderColor: 'var(--color-wrong)',
                    }}
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
              const isCurrent = currentVisibleIndex === index

              // Evaluate state logic
              // If in test state:
              //   if instantChecking == true && answered: show colors
              //   else: show normal selection color
              // If in review state:
              //   always show colors, mark correct, mark wrong 

              const showFeedback = viewState === 'review' || (settings.instantChecking && isAnswered)

              return (
                <div
                  key={card.id}
                  id={`test-question-${index}`}
                  ref={el => questionRefs.current[index] = el}
                  onClick={() => scrollToQuestion(index)}
                  className={`flex-shrink-0 bg-[var(--bg-card)] border rounded-xl overflow-hidden shadow-lg transition-colors duration-300 relative cursor-pointer scroll-mt-20
                ${showFeedback
                      ? (isCorrect ? 'border-[#00FF41]/30 bg-[#00FF41]/5' : (isAnswered ? 'border-[#FF003C]/30 bg-[#FF003C]/5' : 'border-[#333]'))
                      : (isAnswered ? 'border-[#555]' : 'border-[#222]')
                    }`}
                >
                  <div className="p-6 border-b border-[#333] flex items-start gap-4">

                    <div className="flex-1 flex flex-col max-h-[50vh] overflow-y-auto pr-2">
                      <h3
                        className="font-['Rajdhani'] font-semibold text-[var(--text-primary)] whitespace-pre-wrap flex items-start gap-3"
                        style={{
                          fontSize: getQuestionFontSize(mcq.question),
                          lineHeight: 1.4
                        }}
                      >
                        <span 
                          className="text-[var(--accent-primary)] font-bold shrink-0"
                          style={{ fontSize: '1.25rem', lineHeight: 1.4 }}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomedImage(mcq.imagePath!);
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(card.id);
                      }}
                      className={`p-2 rounded transition-colors ${isBookmarked
                          ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                          : 'text-[#555] hover:bg-[#222] hover:text-[#888]'
                        }`}
                      title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                    >
                      <Bookmark className="w-5 h-5 fill-current" />
                    </button>
                  </div>

                  <div className="p-6 grid grid-cols-2 gap-3 items-start">
                    {[0, 2, 1, 3].map((cIdx) => {
                      const choice = mcq.choices[cIdx]
                      if (choice === undefined) return null

                      const isSelected = userAnswer === cIdx

                      let stateStyles = 'border-[#333] hover:border-[#00FF41] hover:shadow-[0_0_8px_rgba(0,255,65,0.2)] bg-[#111] text-[#E8E8E8]'
                      let iconElement = null
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

                      const choiceLabel = String.fromCharCode(65 + cIdx) // A, B, C, D

                      return (
                        <button
                          key={cIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectChoice(card.id, cIdx);
                          }}
                          disabled={viewState === 'review' || (settings.instantChecking && isAnswered)}
                          className={`flex items-center text-left p-[16px_20px] min-h-[56px] rounded-lg border transition-all duration-200 font-['Rajdhani'] ${stateStyles} ${viewState === 'review' || (settings.instantChecking && isAnswered) ? 'cursor-default' : 'cursor-pointer'
                            }`}
                        >
                          <div className={`flex-shrink-0 mr-3 font-['IBM_Plex_Mono'] ${prefixStyles}`}>
                            {choiceLabel}.
                          </div>
                          <span
                            className="flex-1 break-words font-['Rajdhani'] font-medium"
                            style={{ fontSize: getChoiceFontSize(choice), lineHeight: 1.4 }}
                            dangerouslySetInnerHTML={{ __html: renderMath(choice) }}
                          />

                          {iconElement && (
                            <div className="ml-4 flex-shrink-0">
                              {iconElement}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Optional Explanation Display logic can fit here when showFeedback == true */}
                  {showFeedback && mcq.explanation && (
                    <div className="px-6 pb-6 pt-2">
                      <div className="p-4 bg-[#111] rounded border border-[#222]">
                        <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888] mb-1 block">Explanation</span>
                        <p className="text-sm text-[#CCC] font-['Rajdhani'] font-medium whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMath(mcq.explanation) }} />
                      </div>
                    </div>
                  )}

                  {/* AI Action Buttons — only visible in review phase */}
                  {viewState === 'review' && (
                    <div className="px-6 pb-6 pt-1 flex items-center gap-3">
                      <Tooltip content="Copy context to paste into GPT/Gemini/Claude for a better AI explanation.">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGetContext(mcq);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-[rgba(255,255,255,0.3)] rounded text-[#CCCCCC] hover:text-white hover:border-[#888] transition-colors font-['Rajdhani'] uppercase tracking-widest text-[0.75rem]"
                        >
                          <Copy size={12} />
                          Get Context
                        </button>
                      </Tooltip>

                      <Tooltip position="right" content="Explain using Grok Llama-3.3-70B">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenExplanationId(openExplanationId === index ? null : index);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded transition-colors font-['Rajdhani'] uppercase tracking-widest text-[0.75rem] ${openExplanationId === index
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

                  {/* ExplanationPanel — mounts inline below this card's choices when its index is active */}
                  {viewState === 'review' && openExplanationId === index && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <ExplanationPanel
                        question={mcq.question}
                        choices={mcq.choices}
                        answerIndex={mcq.answer}
                        onClose={() => setOpenExplanationId(null)}
                      />
                    </div>
                  )}
                </div>
              )
            })}

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

      {/* Toast Notification for clipboard copy */}
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