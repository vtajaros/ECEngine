import React, { useState, useRef, useEffect } from 'react'
import { motion, useIsPresent } from 'framer-motion'
import { Bookmark, Check, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { renderMath } from '../../lib/latex'
import { getDynamicFontSize } from '../../lib/textUtils'
import type { Card, MCQData, FlashcardData } from '../../types'
import type { FormulaData } from '../../types'
import { AutoFitText } from '../ui/AutoFitText'
import { formatTosBadge } from '../../lib/tosClassification'

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
    const backStr = f.backIsPlainText
      ? [f.latex || '', descVars].filter(Boolean).join('\n\n')
      : [f.latex ? `$$${f.latex}$$` : '', descVars].filter(Boolean).join('\n\n')
    return swapTermDef ? backStr : frontStr
  }
  return swapTermDef ? (card.data as FlashcardData).back : (card.data as FlashcardData).front
}

function getBackContent(card: Card, swapTermDef: boolean): React.ReactNode {
  if (card.type === 'mcq') {
    const mcq = card.data as MCQData
    const text = swapTermDef ? mcq.question : mcq.choices[mcq.answer]
    return <AutoFitText className={`${getDynamicFontSize(text)} leading-relaxed font-['Rajdhani'] font-bold text-text-primary`} html={renderMath(text)} />
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
    const backStr = f.backIsPlainText
      ? [f.latex || '', descVars].filter(Boolean).join('\n\n')
      : [f.latex ? `$$${f.latex}$$` : '', descVars].filter(Boolean).join('\n\n')
    const text = swapTermDef ? frontStr : backStr
    return <AutoFitText className={`leading-relaxed ${getDynamicFontSize(text)} font-['Rajdhani'] font-bold text-text-primary text-center`} html={renderMath(text)} />
  }
  const fc = card.data as FlashcardData
  const text = swapTermDef ? fc.front : fc.back
  return <AutoFitText className={`${getDynamicFontSize(text)} font-['Rajdhani'] font-bold leading-relaxed text-text-primary text-center`} html={renderMath(text)} />
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
    const backStr = f.backIsPlainText
      ? [f.latex || '', descVars].filter(Boolean).join('\n\n')
      : [f.latex ? `$$${f.latex}$$` : '', descVars].filter(Boolean).join('\n\n')
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

const ExplanationBlock: React.FC<{
  card: Card
  onZoomImage: (path: string) => void
  onOpenChange?: (open: boolean, measuredPx: number, hasImage: boolean) => void
  forceOpen?: boolean
}> = ({ card, onZoomImage, onOpenChange, forceOpen }) => {
  const [open, setOpen] = React.useState(false)
  const sizerRef = React.useRef<HTMLDivElement>(null)
  const explanation = getExplanation(card)
  if (!explanation) return null

  // Sync with external forceOpen (arrow key control)
  React.useEffect(() => {
    if (forceOpen === undefined) return
    if (forceOpen === open) return
    const h = sizerRef.current?.offsetHeight ?? 0
    setOpen(forceOpen)
    onOpenChange?.(forceOpen, forceOpen ? h : 0, Boolean(explanation.imagePath))
  }, [forceOpen])

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !open
    const h = sizerRef.current?.offsetHeight ?? 0
    setOpen(next)
    onOpenChange?.(next, next ? h : 0, Boolean(explanation.imagePath))
  }

  const explanationContent = (
    <>
      {explanation.text && (
        <div
          className="text-sm font-['JetBrains_Mono'] text-[#d4d4d4] leading-relaxed text-left"
          dangerouslySetInnerHTML={{ __html: renderMath(explanation.text) }}
        />
      )}
      {explanation.imagePath && (
        <div className="w-full flex justify-center mt-2">
          <img
            src={`ece-app://${explanation.imagePath}`}
            alt="Explanation diagram"
            className="max-w-full max-h-[160px] object-contain rounded border border-[#333] cursor-zoom-in hover:border-accent transition-all"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onZoomImage(explanation.imagePath!) }}
          />
        </div>
      )}
    </>
  )

  return (
    <div className="border-t border-[#222] mt-4 pt-3 px-8 pb-4" onClick={e => e.stopPropagation()}>
      <button
        onClick={toggle}
        className="flex items-center gap-2 text-[11px] font-['Rajdhani'] uppercase tracking-widest text-text-muted hover:text-accent transition-colors font-bold w-full text-left"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Explanation
      </button>

      {/* Hidden sizer — always rendered at natural height, invisible, zero-height in flow */}
      <div
        ref={sizerRef}
        aria-hidden="true"
        style={{ visibility: 'hidden', position: 'absolute', top: 0, left: 0, width: '100%', pointerEvents: 'none' }}
        className="flex flex-col gap-3 mt-3"
      >
        {explanationContent}
      </div>

      {/* Animated reveal */}
      <div
        style={{
          maxHeight: open ? '600px' : '0px',
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.28s ease-in-out, opacity 0.22s ease-in-out',
        }}
        className="flex flex-col gap-3 mt-3"
      >
        {explanationContent}
      </div>
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
  onExplanationOpen?: (open: boolean, measuredPx: number, hasImage: boolean) => void
  forceExplanationOpen?: boolean
  direction?: number
}

export const StudyCard = React.memo(function StudyCard({
  card,
  currentIndex,
  direction = 1,
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
  forceExplanationOpen,
}: StudyCardProps) {
  const [explanationOpen, setExplanationOpen] = React.useState(false)
  const isPresent = useIsPresent()
  const wasFlippedRef = useRef(isFlipped)

  useEffect(() => {
    if (isPresent) {
      wasFlippedRef.current = isFlipped
    }
  }, [isFlipped, isPresent])

  const effectiveTransform = isPresent
    ? isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
    : wasFlippedRef.current ? 'rotateY(180deg)' : 'rotateY(0deg)'

  const effectiveTransition = isPresent
    ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
    : 'none'

  return (
    <motion.div
      key={`${card.id}-${currentIndex}`}
      initial={{ opacity: 0, x: direction * 35 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -direction * 35, pointerEvents: 'none' } as any}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="w-full"
      style={{ gridColumn: 1, gridRow: 1 }}
    >
      {/* 3D Flip Card Container */}
      <div
        className={`w-full ${explanationOpen ? 'cursor-default' : 'cursor-pointer'}`}
        style={{ perspective: '1200px', minHeight: '350px' }}
        onClick={explanationOpen ? undefined : onFlip}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            minHeight: '350px',
            transformStyle: 'preserve-3d',
            transition: effectiveTransition,
            transform: effectiveTransform,
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
            <button onClick={(e) => { e.stopPropagation(); onBookmarkToggle(card.id) }} className="absolute top-5 right-5 z-10 text-[#666] hover:text-[var(--accent-primary)] transition-colors" title="Bookmark">
              <Bookmark className={`w-6 h-6 ${isBookmarked ? 'fill-accent text-accent' : ''}`} />
            </button>

            {/* Card Label */}
            <div className="px-8 pt-6 pb-2 flex items-center justify-between">
              <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-text-muted">
                {swapTermDef ? 'Definition' : 'Term'}
              </span>
              {card.tosTopicId && (
                <span
                  className="px-2 py-0.5 text-[10px] font-['JetBrains_Mono'] font-bold bg-[#181818] text-accent/90 rounded border border-accent/30 mr-8"
                  title={formatTosBadge(card.tosTopicId) || ''}
                >
                  {formatTosBadge(card.tosTopicId) || card.tosTopicId}
                </span>
              )}
            </div>

            {/* Front Content */}
            <div className="flex-1 flex items-center justify-center px-8 pb-8 overflow-hidden w-full max-w-full">
              <div className="text-center w-full max-w-full">
                <AutoFitText className={`${getDynamicFontSize(getFrontText(card, swapTermDef))} font-['Rajdhani'] font-bold text-text-primary leading-relaxed text-center`} html={renderMath(getFrontText(card, swapTermDef))} />
                {((card.data as any).imagePathFront || card.data.imagePath) && (() => {
                  const frontImg = (card.data as any).imagePathFront || card.data.imagePath!
                  return (
                    <div className="mt-4 w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg hover:border-accent transition-all">
                      <img
                        src={`ece-app://${frontImg}`}
                        alt="Card diagram"
                        className="w-full h-full max-h-[300px] object-contain cursor-zoom-in"
                        onClick={(e) => { e.stopPropagation(); onZoomImage(frontImg) }}
                      />
                    </div>
                  )
                })()}
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
            <div className="px-8 pt-6 pb-2 flex items-center justify-between">
              <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-text-muted">
                {swapTermDef ? 'Term' : 'Definition'}
              </span>
              {card.tosTopicId && (
                <span
                  className="px-2 py-0.5 text-[10px] font-['JetBrains_Mono'] font-bold bg-[#181818] text-accent/90 rounded border border-accent/30"
                  title={formatTosBadge(card.tosTopicId) || ''}
                >
                  {formatTosBadge(card.tosTopicId) || card.tosTopicId}
                </span>
              )}
            </div>

            {/* Back Content */}
            <div className="flex-1 flex items-center justify-center px-8 pb-4 overflow-hidden w-full max-w-full">
              <div className="text-center w-full text-text-primary flex flex-col items-center gap-4 max-w-full">
                {getBackContent(card, swapTermDef)}
                {(card.data as any).imageBack && (
                  <div className="w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg hover:border-accent transition-all">
                    <img
                      src={`ece-app://${(card.data as any).imageBack}`}
                      alt="Card back diagram"
                      className="w-full h-full max-h-[300px] object-contain cursor-zoom-in"
                      onClick={(e) => { e.stopPropagation(); onZoomImage((card.data as any).imageBack) }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Explanation — collapsible, only when card has one */}
            <ExplanationBlock
              card={card}
              onZoomImage={onZoomImage}
              forceOpen={forceExplanationOpen}
              onOpenChange={(open, measuredPx, hasImage) => {
                setExplanationOpen(open)
                onExplanationOpen?.(open, measuredPx, hasImage)
              }}
            />
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
            className="w-full bg-[#111] border border-[#333] focus:border-[var(--accent-primary)] text-text-primary placeholder-[#555] py-4 px-6 rounded-lg font-['JetBrains_Mono'] outline-none transition-colors"
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
                  <div className="text-text-muted text-sm font-['JetBrains_Mono'] mt-1">
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
