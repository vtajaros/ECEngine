import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Card, FlashcardData } from '../../types'
import { renderMath } from '../../lib/latex'

interface FlashCardProps {
  card: Card
  onRate: (rating: number) => void // 1: Again, 2: Hard, 3: Good, 4: Easy
  /** When true, a DB write is in-flight — disable all rating controls. */
  isSubmitting?: boolean
  /**
   * Called whenever the card flips, with the new isFlipped value.
   * FlashDeck uses this to trigger TTS on the back face.
   * Optional so existing callers outside FlashDeck are unaffected.
   */
  onFlip?: (isFlipped: boolean) => void
}

const getContextColor = (difficulty: string) => {
  switch (difficulty) {
    case 'easy': return 'text-[#00FF41] border-[#00FF41]'
    case 'medium': return 'text-[#FFB800] border-[#FFB800]'
    case 'hard': return 'text-[#FF3333] border-[#FF3333]'
    default: return 'text-[#E8E8E8] border-[#E8E8E8]'
  }
}

export const FlashCard: React.FC<FlashCardProps> = ({ card, onRate, isSubmitting = false, onFlip }) => {
  const [isFlipped, setIsFlipped] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

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

  const data = card.data as FlashcardData

  // ── Flip helper: sets state AND notifies parent ──────────────────────────
  // Centralised here so both the click handler and the keyboard shortcut use
  // the same path — no risk of the onFlip callback being missed on one path.
  const doFlip = (next: boolean) => {
    setIsFlipped(next)
    onFlip?.(next)
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setIsFlipped(prev => {
          const next = !prev
          onFlip?.(next)
          return next
        })
      }

      if (isFlipped && e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        if (!isSubmitting) onRate(parseInt(e.key, 10))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFlipped, onRate, onFlip])

  // Reset flip when card changes — do NOT notify onFlip here: the parent
  // already handles the front-face TTS via its own useEffect on card id.
  useEffect(() => {
    setIsFlipped(false)
  }, [card.id])

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto min-h-[350px]">
      <div
        className="relative w-full h-[350px] cursor-pointer"
        style={{ perspective: 1000 }}
        onClick={() => doFlip(!isFlipped)}
      >
        <motion.div
          className="w-full h-full"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 200, damping: 20 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div
            className="absolute w-full h-full bg-[#161616] border border-[rgba(0,255,65,0.3)] shadow-[0_0_15px_rgba(0,255,65,0.1)] rounded-lg p-12 flex flex-col"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-2">
                {card.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 text-xs font-['Rajdhani'] bg-[#111111] text-[#00FF41] rounded border border-[#161616] uppercase">
                    {tag}
                  </span>
                ))}
              </div>
              <span className={`px-2 py-1 text-xs font-['Rajdhani'] uppercase border rounded ${getContextColor(card.difficulty)}`}>
                {card.difficulty}
              </span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center w-full">
              {data.imagePath && (
                <div className="mb-4 w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg hover:border-[#00FF41] transition-all">
                  <img
                    src={`ece-app://${data.imagePath}`}
                    alt="Flashcard diagram"
                    className="w-full h-full max-h-[300px] object-contain cursor-zoom-in"
                    onClick={(e) => { e.stopPropagation(); setZoomedImage(data.imagePath!); }}
                  />
                </div>
              )}
              <h2
                className="text-2xl font-['Rajdhani'] font-semibold leading-snug text-center break-words w-full"
                dangerouslySetInnerHTML={{ __html: renderMath(data.front) }}
              />
            </div>

            <div className="text-center text-[#888888] text-sm mt-4 font-['Rajdhani']">
              Press SPACE or click to flip
            </div>
          </div>

          {/* Back */}
          <div
            className="absolute w-full h-full bg-[#161616] border border-[#00FF41] shadow-[0_0_20px_rgba(0,255,65,0.2)] rounded-lg p-12 flex flex-col"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="text-center text-[#888888] text-sm mb-4 font-['Rajdhani'] uppercase tracking-widest border-b border-[#111111] pb-2">
              Answer
            </div>
            <div className="flex-1 flex items-center justify-center text-center overflow-y-auto w-full">
              <div
                className="text-2xl font-['Rajdhani'] font-medium leading-snug whitespace-pre-wrap text-center break-words w-full"
                dangerouslySetInnerHTML={{ __html: renderMath(data.back) }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <div className={`mt-8 flex gap-4 transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={() => onRate(1)}
          disabled={isSubmitting}
          className={`px-6 py-2 bg-[#111111] border border-[#FF3333] text-[#FF3333] rounded transition-colors flex flex-col items-center group ${isSubmitting ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#161616]'
            }`}
        >
          <span className="font-['Rajdhani'] font-bold text-lg mb-1 group-hover:drop-shadow-[0_0_5px_rgba(255,51,51,0.5)]">Again</span>
          <span className="text-xs text-[#888888]">(1) &lt; 1m</span>
        </button>
        <button
          onClick={() => onRate(2)}
          disabled={isSubmitting}
          className={`px-6 py-2 bg-[#111111] border border-[#FFB800] text-[#FFB800] rounded transition-colors flex flex-col items-center group ${isSubmitting ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#161616]'
            }`}
        >
          <span className="font-['Rajdhani'] font-bold text-lg mb-1 group-hover:drop-shadow-[0_0_5px_rgba(255,184,0,0.5)]">Hard</span>
          <span className="text-xs text-[#888888]">(2) 5m</span>
        </button>
        <button
          onClick={() => onRate(3)}
          disabled={isSubmitting}
          className={`px-6 py-2 bg-[#111111] border border-[#00FF41] text-[#00FF41] rounded transition-colors flex flex-col items-center group ${isSubmitting ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#161616]'
            }`}
        >
          <span className="font-['Rajdhani'] font-bold text-lg mb-1 group-hover:drop-shadow-[0_0_5px_rgba(0,255,65,0.5)]">Good</span>
          <span className="text-xs text-[#888888]">(3) 10m</span>
        </button>
        <button
          onClick={() => onRate(4)}
          disabled={isSubmitting}
          className={`px-6 py-2 bg-[#111111] border border-[#00BFFF] text-[#00BFFF] rounded transition-colors flex flex-col items-center group ${isSubmitting ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#161616]'
            }`}
        >
          <span className="font-['Rajdhani'] font-bold text-lg mb-1 group-hover:drop-shadow-[0_0_5px_rgba(0,191,255,0.5)]">Easy</span>
          <span className="text-xs text-[#888888]">(4) 4d</span>
        </button>

        {isSubmitting && (
          <div className="self-center ml-2 flex items-center gap-2 text-[#888888] text-xs font-['Rajdhani'] animate-pulse">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Saving…
          </div>
        )}
      </div>

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