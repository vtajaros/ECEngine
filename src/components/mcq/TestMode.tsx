import React, { useState, useEffect } from 'react'
import { Card, MCQData } from '../../types'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, Clock, ArrowRight, RefreshCw, ClipboardCheck, X } from 'lucide-react'

interface TestModeProps {
  cards: Card[]
  title?: string
  settings: {
    instantChecking: boolean
    shuffleQuestions: boolean
    shuffleChoices: boolean
    bookmarkedOnly: boolean
  }
  onComplete: (stats: { score: number; total: number; bookmarked: number }) => void
  onExit: () => void
}

type ViewState = 'test' | 'summary' | 'review'

export const TestMode: React.FC<TestModeProps> = ({ cards, title, settings, onComplete, onExit }) => {
  const [testCards, setTestCards] = useState<Card[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({}) // card.id -> choiceIndex
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [viewState, setViewState] = useState<ViewState>('test')
  
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  // Initialize test cards
  useEffect(() => {
    let finalCards = [...cards]
    
    // Optionally filter bookmarked
    if (settings.bookmarkedOnly) {
      // In a real scenario, we'd fetch bookmarked from user's save. 
      // For now, this is a mock.
      // finalCards = finalCards.filter(c => bookmarkedIds.has(c.id))
      // It might be empty, so we keep it as is if empty for fallback.
    }

    if (settings.shuffleQuestions) {
      finalCards.sort(() => Math.random() - 0.5)
    }

    // Handle shuffle choices per card. 
    // Usually we don't mutate original `choices`, or we store a map of shuffled order.
    // For simplicity, we assume `MCQData` choices are static, but we can render them shuffled.
    // However, if we shuffle them dynamically, tracking correct index becomes complex.
    // So we'll skip deep-choice scrambling in this mock unless requested explicitly to alter data structure.

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
      return next
    })
  }

  const handleSubmit = () => {
    // Score test
    let correct = 0
    testCards.forEach(card => {
      const mcq = card.data as MCQData
      if (answers[card.id] === mcq.answer) {
        correct++
      }
    })
    setScore({ correct, total: testCards.length })
    setViewState('summary')
    onComplete({ score: correct, total: testCards.length, bookmarked: bookmarkedIds.size })
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
    <div className="fixed top-0 left-0 w-full bg-[var(--bg-secondary)] border-b border-[var(--bg-card)] shadow-lg z-50 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <button 
          onClick={onExit}
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
            onClick={handleSubmit}
            className="bg-[var(--accent-primary)] text-black px-6 py-2 rounded font-['Rajdhani'] font-bold tracking-widest uppercase hover:bg-[var(--accent-dim)] transition-colors"
          >
            Submit Test
          </button>
        ) : (
          <button 
            onClick={onExit}
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
              <h2 className="text-3xl font-['Orbitron'] font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wide">
                Test Completed
              </h2>
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

      <div className="flex-1 overflow-y-auto mt-20 p-6 lg:p-12 pb-32 w-full max-w-4xl mx-auto flex flex-col gap-6">
        {testCards.map((card, index) => {
          const mcq = card.data as MCQData
          const userAnswer = answers[card.id]
          const isAnswered = userAnswer !== undefined
          const isCorrect = isAnswered && userAnswer === mcq.answer
          const isBookmarked = bookmarkedIds.has(card.id)

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
              className={`flex-shrink-0 bg-[var(--bg-card)] border rounded-xl overflow-hidden shadow-lg transition-colors duration-300 relative
                ${showFeedback 
                  ? (isCorrect ? 'border-[#00FF41]/30 bg-[#00FF41]/5' : (isAnswered ? 'border-[#FF003C]/30 bg-[#FF003C]/5' : 'border-[#333]')) 
                  : (isAnswered ? 'border-[#555]' : 'border-[#222]')
                }`}
            >
              <div className="p-6 border-b border-[#333] flex items-start gap-4">
                <span className="text-[var(--accent-primary)] font-['Rajdhani'] font-bold text-xl leading-none mt-1">
                  Q{index + 1}.
                </span>
                
                <div className="flex-1 flex flex-col">
                  <h3 className="text-lg font-['Outfit'] text-[var(--text-primary)] leading-snug whitespace-pre-wrap">
                    {mcq.question}
                  </h3>
                </div>

                <button 
                  onClick={() => toggleBookmark(card.id)}
                  className={`p-2 rounded transition-colors ${
                    isBookmarked 
                    ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10' 
                    : 'text-[#555] hover:bg-[#222] hover:text-[#888]'
                  }`}
                  title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
                >
                  <Bookmark className="w-5 h-5 fill-current" />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-3">
                {mcq.choices.map((choice, cIdx) => {
                  const isSelected = userAnswer === cIdx

                  let stateStyles = 'border-[#333] hover:border-[#555] bg-[#161616] text-[#E8E8E8]'
                  let iconElement = null

                  if (showFeedback) {
                    const isChoiceCorrect = cIdx === mcq.answer

                    if (isChoiceCorrect) {
                      stateStyles = 'border-[#00FF41] bg-[rgba(0,255,65,0.1)] text-[#00FF41]'
                      iconElement = <div className="text-[#00FF41] font-bold">✓</div>
                    } else if (isSelected && !isChoiceCorrect) {
                      stateStyles = 'border-[#FF003C] bg-[rgba(255,0,60,0.1)] text-[#FF003C]'
                      iconElement = <div className="text-[#FF003C] font-bold">✗</div>
                    } else {
                      stateStyles = 'border-[#222] bg-[#161616] text-[#666] opacity-60'
                    }
                  } else {
                    if (isSelected) {
                      stateStyles = 'border-[var(--accent-primary)] bg-[rgba(0,255,65,0.1)] text-[var(--accent-primary)]'
                    }
                  }

                  const choiceLabel = String.fromCharCode(65 + cIdx) // A, B, C, D

                  return (
                    <button
                      key={cIdx}
                      onClick={() => handleSelectChoice(card.id, cIdx)}
                      disabled={viewState === 'review' || (settings.instantChecking && isAnswered)}
                      className={`flex items-start text-left p-4 rounded-lg border transition-all duration-200 ${stateStyles} ${
                        viewState === 'review' || (settings.instantChecking && isAnswered) ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex-shrink-0 w-6 h-6 mr-4 flex items-center justify-center font-['Rajdhani'] font-bold rounded bg-[#111] border border-inherit text-xs">
                        {choiceLabel}
                      </div>
                      <span className="font-['Outfit'] flex-1 translate-y-[2px]">{choice}</span>
                      
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
                    <p className="text-sm text-[#CCC] font-['Outfit'] whitespace-pre-wrap">{mcq.explanation}</p>
                  </div>
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
  )
}