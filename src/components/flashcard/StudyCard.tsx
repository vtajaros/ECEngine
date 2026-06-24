import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Bookmark, Check, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { renderMath } from '../../lib/latex'
import { getDynamicFontSize } from '../../lib/textUtils'
import type { Card, MCQData, FlashcardData } from '../../types'
import type { FormulaData } from '../../types'

// ── Pure helper functions (extracted from FlashcardLearn) ──────────────────
// These are exported so FlashcardLearn.tsx can use them in its TTS/autoplay effects.

export function getFrontText(card: Card, swapTermDef: boolean): string {
  if (card.type === 'mcq') {
    const mcq = card.data as MCQData
    return swapTermDef ? mcq.choices[mcq.answer] : mcq.question
  }
  if (card.type === 'formula') {
    const f = card.data as FormulaData
    const frontStr = f.name ?? ''
    let descVars = ''
    if (typeof f.variables === 'string') {
      descVars = [f.description, f.variables].filter(Boolean).join('\n\n')
    } else if (f.variables && typeof f.variables === 'object') {
      const varsStrings = Object.entries(f.variables).map(([key, val]) => {
        const v = String(val)
        const wrappedVal = /\\[a-zA-Z]/.test(v) ? `$${v}$` : v
        return `$${key}$: ${wrappedVal}`
      })
      descVars = [f.description, varsStrings.join('\n')].filter(Boolean).join('\n\n')
    } else {
      descVars = f.description || ''
    }
    const backStr = [f.latex ? `$$${f.latex}$$` : '', descVars].filter(Boolean).join('\n\n')
    return swapTermDef ? backStr : frontStr
  }
  return swapTermDef ? (card.data as FlashcardData).back : (card.data as FlashcardData).front
}

function getBackContent(card: Card, swapTermDef: boolean): React.ReactNode {
  if (card.type === 'mcq') {
    const mcq = card.data as MCQData
    const text = swapTermDef ? mcq.question : mcq.choices[mcq.answer]
    return <div className={`${getDynamicFontSize(text)} leading-relaxed font-['Rajdhani'] font-bold text-text-primary`} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />
  }
  if (card.type === 'formula') {
    const f = card.data as FormulaData
    const frontStr = f.name ?? ''
    let descVars = ''
    if (typeof f.variables === 'string') {
      descVars = [f.description, f.variables].filter(Boolean).join('\n\n')
    } else if (f.variables && typeof f.variables === 'object') {
      const varsStrings = Object.entries(f.variables).map(([key, val]) => {
        const v = String(val)
        const wrappedVal = /\\[a-zA-Z]/.test(v) ? `$${v}$` : v
        return `$${key}$: ${wrappedVal}`
      })
      descVars = [f.description, varsStrings.join('\n')].filter(Boolean).join('\n\n')
    } else {
      descVars = f.description || ''
    }
    const backStr = [f.latex ? `$$${f.latex}$$` : '', descVars].filter(Boolean).join('\n\n')
    const text = swapTermDef ? frontStr : backStr
    return <div className={`leading-relaxed ${getDynamicFontSize(text)} font-['Rajdhani'] font-bold text-text-primary`} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />
  }
  const fc = card.data as FlashcardData
  const text = swapTermDef ? fc.front : fc.back
  return <div className={`${getDynamicFontSize(text)} font-['Rajdhani'] font-bold leading-relaxed text-text-primary`} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />
}

export function getCorrectAnswer(card: Card, swapTermDef: boolean): string {
  if (card.type === 'mcq') {
    const mcq = card.data as MCQData
    return swapTermDef ? mcq.question : mcq.choices[mcq.answer]
  }
  if (card.type === 'formula') {
    const f = card.data as FormulaData
    const frontStr = f.name ?? ''
    let descVars = ''
    if (typeof f.variables === 'string') {
      descVars = [f.description, f.variables].filter(Boolean).join('\n\n')
    } else if (f.variables && typeof f.variables === 'object') {
      const varsStrings = Object.entries(f.variables).map(([key, val]) => {
        const v = String(val)
        const wrappedVal = /\\[a-zA-Z]/.test(v) ? `$${v}$` : v
        return `$${key}$: ${wrappedVal}`
      })
      descVars = [f.description, varsStrings.join('\n')].filter(Boolean).join('\n\n')
    } else {
      descVars = f.description || ''
    }
    const backStr = [f.latex ? `$$${f.latex}$$` : '', descVars].filter(Boolean).join('\n\n')
    return swapTermDef ? frontStr : backStr
  }
  const fc = card.data as FlashcardData
  return swapTermDef ? fc.front : fc.back
}

function getExplanation(card: Card): { text?: string; imagePath?: string } | null {
  if (card.type === 'mcq') {
    const mcq = card.data as MCQData
    return mcq.explanation ? { text: mcq.explanation, imagePath: (mcq as any).solutionImagePath } : null
  }
  if (card.type === 'flashcard') {
    const fc = card.data as FlashcardData
    return (fc.explanation || fc.explanationImagePath)
      ? { text: fc.explanation, imagePath: fc.explanationImagePath }
      : null
  }
  if (card.type === 'formula') {
    const f = card.data as FormulaData
    return (f.explanation || f.explanationImagePath)
      ? { text: f.explanation, imagePath: f.explanationImagePath }
      : null
  }
  return null
}

const ExplanationBlock: React.FC<{ card: Card; onZoomImage: (path: string) => void; onOpenChange?: (open: boolean) => void }> = ({ card, onZoomImage, onOpenChange }) => {
  const [open, setOpen] = React.useState(false)
  const explanation = getExplanation(card)
  if (!explanation) return null

  return (
    <div className="border-t border-[#222] mt-4 pt-3 px-8 pb-4" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => { const next = !o; onOpenChange?.(next); return next })}
        className="flex items-center gap-2 text-[11px] font-['Rajdhani'] uppercase tracking-widest text-text-muted hover:text-accent transition-colors font-bold w-full text-left"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Explanation
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {explanation.text && (
            <div
              className="text-sm font-['IBM_Plex_Mono'] text-text-muted leading-relaxed text-left"
              dangerouslySetInnerHTML={{ __html: renderMath(explanation.text) }}
            />
          )}
          {explanation.imagePath && (
            <div className="w-full flex justify-start">
              <img
                src={`ece-app://${explanation.imagePath}`}
                alt="Explanation diagram"
                className="max-w-full max-h-[160px] object-contain rounded border border-[#333] cursor-zoom-in hover:border-accent transition-all"
                onClick={(e) => { e.stopPropagation(); onZoomImage(explanation.imagePath!) }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

interface StudyCardProps {
  card: Card
  currentIndex: number
  isFlipped: boolean
  swapTermDef: boolean
  writtenMode: boolean
  writtenAnswer: string
  writtenSubmitted: boolean
  writtenCorrect: boolean | null
  isAutoplay: boolean
  isBookmarked: boolean
  onFlip: () => void
  onBookmarkToggle: (cardId: string) => void
  onWrittenChange: (value: string) => void
  onWrittenSubmit: () => void
  onViewCard: () => void
  onZoomImage: (path: string) => void
  onExplanationOpen?: (open: boolean) => void
}

export const StudyCard = React.memo(function StudyCard({
  card,
  currentIndex,
  isFlipped,
  swapTermDef,
  writtenMode,
  writtenAnswer,
  writtenSubmitted,
  writtenCorrect,
  isAutoplay,
  isBookmarked,
  onFlip,
  onBookmarkToggle,
  onWrittenChange,
  onWrittenSubmit,
  onViewCard,
  onZoomImage,
  onExplanationOpen,
}: StudyCardProps) {
  return (
    <motion.div key={`${card.id}-${currentIndex}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
      {/* 3D Flip Card Container */}
      <div
        className="w-full cursor-pointer"
        style={{ perspective: '1200px', minHeight: '350px' }}
        onClick={onFlip}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: '350px',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            willChange: 'transform',
          }}
        >
          {/* FRONT FACE */}
          <div
            className="bg-surface-2 border border-border-base rounded-xl shadow-2xl flex flex-col"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              minHeight: '100%',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {/* Bookmark */}
            <button onClick={(e) => { e.stopPropagation(); onBookmarkToggle(card.id) }} className="absolute top-5 right-5 z-10 text-[#666] hover:text-warn transition-colors" title="Bookmark">
              <Bookmark className={`w-6 h-6 ${isBookmarked ? 'fill-warn text-warn' : ''}`} />
            </button>

            {/* Card Label */}
            <div className="px-8 pt-6 pb-2">
              <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-text-muted">
                {swapTermDef ? 'Definition' : 'Term'}
              </span>
            </div>

            {/* Front Content */}
            <div className="flex-1 flex items-center justify-center px-8 pb-8">
              <div className="text-center w-full">
                <div className={`${getDynamicFontSize(getFrontText(card, swapTermDef))} font-['Rajdhani'] font-bold text-text-primary leading-relaxed`} dangerouslySetInnerHTML={{ __html: renderMath(getFrontText(card, swapTermDef)) }} />
                {card.data.imagePath && (
                  <div className="mt-4 w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg hover:border-accent transition-all">
                    <img
                      src={`ece-app://${card.data.imagePath}`}
                      alt="Card diagram"
                      className="w-full h-full max-h-[300px] object-contain cursor-zoom-in"
                      onClick={(e) => { e.stopPropagation(); onZoomImage(card.data.imagePath!); }}
                    />
                  </div>
                )}
                {!writtenMode && <p className="text-[#555] text-sm mt-6 font-['Rajdhani']">Click or press Space to flip</p>}
              </div>
            </div>
          </div>

          {/* BACK FACE */}
          <div
            className="bg-surface-2 border border-border-base rounded-xl shadow-2xl flex flex-col"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              minHeight: '100%',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {/* Card Label */}
            <div className="px-8 pt-6 pb-2">
              <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-text-muted">
                {swapTermDef ? 'Term' : 'Definition'}
              </span>
            </div>

            {/* Back Content */}
            <div className="flex-1 flex items-center justify-center px-8 pb-4">
              <div className="text-center w-full text-text-primary">
                {getBackContent(card, swapTermDef)}
              </div>
            </div>

            {/* Explanation — collapsible, only when card has one */}
            <ExplanationBlock card={card} onZoomImage={onZoomImage} onOpenChange={onExplanationOpen} />
          </div>
        </div>
      </div>

      {/* Written Mode Input */}
      {writtenMode && !isFlipped && (
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="text" value={writtenAnswer}
            onChange={e => onWrittenChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onWrittenSubmit() }}
            disabled={writtenSubmitted}
            placeholder="Type your answer..."
            className="w-full bg-[#111] border border-[#333] focus:border-[var(--accent-primary)] text-text-primary placeholder-[#555] py-4 px-6 rounded-lg font-['IBM_Plex_Mono'] outline-none transition-colors"
          />
          {!writtenSubmitted ? (
            <button onClick={onWrittenSubmit} className="w-full py-3 bg-[var(--accent-primary)] text-black rounded-lg font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[var(--accent-dim)] transition-colors">Submit</button>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-[#111]" style={{ borderColor: writtenCorrect ? '#00FF41' : '#FF3333' }}>
              {writtenCorrect
                ? <Check className="w-6 h-6 text-accent shrink-0" />
                : <XCircle className="w-6 h-6 text-danger shrink-0" />}
              <div className="flex-1">
                <span className={`font-['Rajdhani'] font-bold uppercase tracking-widest text-sm ${writtenCorrect ? 'text-accent' : 'text-danger'}`}>
                  {writtenCorrect ? 'Correct!' : 'Incorrect'}
                </span>
                {!writtenCorrect && (
                  <div className="text-text-muted text-sm font-['IBM_Plex_Mono'] mt-1">
                    Correct: <span className="text-accent" dangerouslySetInnerHTML={{ __html: renderMath(getCorrectAnswer(card, swapTermDef)) }} />
                  </div>
                )}
              </div>
              <button onClick={onViewCard} className="px-4 py-2 text-sm bg-border-base text-text-primary rounded font-['Rajdhani'] uppercase tracking-widest hover:bg-[#333] transition-colors">
                View Card
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
})
