import React from 'react'
import { motion } from 'framer-motion'
import { Bookmark, Check, XCircle } from 'lucide-react'
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
    const frontStr = f.name + (f.latex ? `\n\n$$${f.latex}$$` : '')
    const backStr = [f.description, f.variables].filter(Boolean).join('\n\n')
    return swapTermDef ? backStr : frontStr
  }
  return swapTermDef ? (card.data as FlashcardData).back : (card.data as FlashcardData).front
}

function getBackContent(card: Card, swapTermDef: boolean): React.ReactNode {
  if (card.type === 'mcq') {
    const mcq = card.data as MCQData
    const text = swapTermDef ? mcq.question : mcq.choices[mcq.answer]
    return <div className={`${getDynamicFontSize(text)} leading-relaxed font-['Rajdhani'] font-bold text-[#E8E8E8]`} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />
  }
  if (card.type === 'formula') {
    const f = card.data as FormulaData
    const frontStr = f.name + (f.latex ? `\n\n$$${f.latex}$$` : '')
    const backStr = [f.description, f.variables].filter(Boolean).join('\n\n')
    const text = swapTermDef ? frontStr : backStr
    return <div className={`leading-relaxed ${getDynamicFontSize(text)} font-['Rajdhani'] font-bold text-[#E8E8E8]`} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />
  }
  const fc = card.data as FlashcardData
  const text = swapTermDef ? fc.front : fc.back
  return <div className={`${getDynamicFontSize(text)} font-['Rajdhani'] font-bold leading-relaxed text-[#E8E8E8]`} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />
}

export function getCorrectAnswer(card: Card, swapTermDef: boolean): string {
  if (card.type === 'mcq') {
    const mcq = card.data as MCQData
    return swapTermDef ? mcq.question : mcq.choices[mcq.answer]
  }
  if (card.type === 'formula') {
    const f = card.data as FormulaData
    const frontStr = f.name + (f.latex ? `\n\n$$${f.latex}$$` : '')
    const backStr = [f.description, f.variables].filter(Boolean).join('\n\n')
    return swapTermDef ? frontStr : backStr
  }
  const fc = card.data as FlashcardData
  return swapTermDef ? fc.front : fc.back
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
            height: '100%',
            minHeight: '350px',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            willChange: 'transform',
          }}
        >
          {/* FRONT FACE */}
          <div
            className="bg-[#161616] border border-[#222] rounded-xl shadow-2xl flex flex-col"
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {/* Bookmark */}
            <button onClick={(e) => { e.stopPropagation(); onBookmarkToggle(card.id) }} className="absolute top-5 right-5 z-10 text-[#666] hover:text-[#FFB800] transition-colors" title="Bookmark">
              <Bookmark className={`w-6 h-6 ${isBookmarked ? 'fill-[#FFB800] text-[#FFB800]' : ''}`} />
            </button>

            {/* Card Label */}
            <div className="px-8 pt-6 pb-2">
              <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">
                {swapTermDef ? 'Definition' : 'Term'}
              </span>
            </div>

            {/* Front Content */}
            <div className="flex-1 flex items-center justify-center px-8 pb-8">
              <div className="text-center w-full">
                <div className={`${getDynamicFontSize(getFrontText(card, swapTermDef))} font-['Rajdhani'] font-bold text-[#E8E8E8] leading-relaxed`} dangerouslySetInnerHTML={{ __html: renderMath(getFrontText(card, swapTermDef)) }} />
                {card.data.imagePath && (
                  <div className="mt-4 w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg hover:border-[#00FF41] transition-all">
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
            className="bg-[#161616] border border-[#222] rounded-xl shadow-2xl flex flex-col"
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {/* Card Label */}
            <div className="px-8 pt-6 pb-2">
              <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">
                {swapTermDef ? 'Term' : 'Definition'}
              </span>
            </div>

            {/* Back Content */}
            <div className="flex-1 flex items-center justify-center px-8 pb-8">
              <div className="text-center w-full text-[#E8E8E8]">
                {getBackContent(card, swapTermDef)}
              </div>
            </div>
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
            className="w-full bg-[#111] border border-[#333] focus:border-[var(--accent-primary)] text-[#E8E8E8] placeholder-[#555] py-4 px-6 rounded-lg font-['IBM_Plex_Mono'] outline-none transition-colors"
          />
          {!writtenSubmitted ? (
            <button onClick={onWrittenSubmit} className="w-full py-3 bg-[var(--accent-primary)] text-black rounded-lg font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[var(--accent-dim)] transition-colors">Submit</button>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-[#111]" style={{ borderColor: writtenCorrect ? '#00FF41' : '#FF3333' }}>
              {writtenCorrect
                ? <Check className="w-6 h-6 text-[#00FF41] shrink-0" />
                : <XCircle className="w-6 h-6 text-[#FF3333] shrink-0" />}
              <div className="flex-1">
                <span className={`font-['Rajdhani'] font-bold uppercase tracking-widest text-sm ${writtenCorrect ? 'text-[#00FF41]' : 'text-[#FF3333]'}`}>
                  {writtenCorrect ? 'Correct!' : 'Incorrect'}
                </span>
                {!writtenCorrect && (
                  <div className="text-[#888] text-sm font-['IBM_Plex_Mono'] mt-1">
                    Correct: <span className="text-[#00FF41]" dangerouslySetInnerHTML={{ __html: renderMath(getCorrectAnswer(card, swapTermDef)) }} />
                  </div>
                )}
              </div>
              <button onClick={onViewCard} className="px-4 py-2 text-sm bg-[#222] text-[#E8E8E8] rounded font-['Rajdhani'] uppercase tracking-widest hover:bg-[#333] transition-colors">
                View Card
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
})
