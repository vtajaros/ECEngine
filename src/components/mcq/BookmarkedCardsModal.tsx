import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bookmark, BookmarkX, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Card, MCQData, FlashcardData } from '../../types'
import { renderMath } from '../../lib/latex'

interface BookmarkedCardsModalProps {
  topicId: string
  topicTitle: string
  onClose: () => void
  /** Called whenever the bookmark set changes, so the parent can refresh its counts */
  onBookmarksChanged?: (newIds: Set<string>) => void
}

function readBookmarkedIds(): Set<string> {
  try {
    const saved = localStorage.getItem('bookmarkedIds')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  } catch {
    return new Set()
  }
}

function writeBookmarkedIds(ids: Set<string>) {
  localStorage.setItem('bookmarkedIds', JSON.stringify(Array.from(ids)))
}

function getQuestionText(card: Card): string {
  if (card.type === 'mcq') return (card.data as MCQData).question
  if (card.type === 'flashcard') return (card.data as FlashcardData).front
  return (card.data as any).name || (card.data as any).title || card.id
}

export function BookmarkedCardsModal({ topicId, topicTitle, onClose, onBookmarksChanged }: BookmarkedCardsModalProps) {
  const [cards, setCards] = useState<Card[]>([])
  const [bookmarkedIds, setBookmarkedIdsState] = useState<Set<string>>(readBookmarkedIds)
  const [loading, setLoading] = useState(true)
  const [showAddSection, setShowAddSection] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const result = await window.electron.data.getCards(topicId)
        const rows = (result?.data || []) as any[]
        const shaped: Card[] = rows.map((c: any) => ({
          ...c,
          data: typeof c.data === 'string' ? JSON.parse(c.data) : c.data,
          tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags || []),
        }))
        setCards(shaped)
      } catch (err) {
        console.error('[BookmarkedCardsModal] Failed to load cards:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [topicId])

  const toggleBookmark = useCallback((id: string) => {
    setBookmarkedIdsState(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeBookmarkedIds(next)
      onBookmarksChanged?.(next)
      return next
    })
  }, [onBookmarksChanged])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const bookmarkedCards = cards.filter(c => bookmarkedIds.has(c.id))
  const unbookmarkedCards = cards.filter(c => !bookmarkedIds.has(c.id))
  const filteredUnbookmarked = search.trim()
    ? unbookmarkedCards.filter(c => getQuestionText(c).toLowerCase().includes(search.toLowerCase()))
    : unbookmarkedCards

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative w-full max-w-2xl bg-[#111] border border-[rgba(0,255,65,0.25)] rounded-xl shadow-[0_0_60px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header accent line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-accent to-transparent shrink-0" />

        {/* Header */}
        <div className="p-5 border-b border-[#1c1c1c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Bookmark className="w-4 h-4 text-accent fill-accent" />
            </div>
            <div>
              <h2 className="font-['Orbitron'] font-bold text-sm uppercase tracking-widest text-white">
                Bookmarked Items
              </h2>
              <p className="font-['Rajdhani'] text-[11px] text-[#555] tracking-wider uppercase mt-0.5">
                {topicTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-['JetBrains_Mono'] text-xs text-accent">
              {bookmarkedCards.length} bookmarked
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-[#444] hover:text-white hover:bg-[#222] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#444] font-['JetBrains_Mono'] text-sm animate-pulse">
              Loading cards...
            </div>
          ) : (
            <>
              {/* Bookmarked cards list */}
              <div className="p-4">
                {bookmarkedCards.length === 0 ? (
                  <div className="text-center py-10">
                    <Bookmark className="w-9 h-9 text-[#222] mx-auto mb-3" />
                    <p className="font-['Rajdhani'] text-[#444] uppercase tracking-widest text-sm">
                      No bookmarks in this deck yet
                    </p>
                    <p className="font-['Rajdhani'] text-[#333] text-xs tracking-wider mt-1">
                      Expand the section below to add items
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {bookmarkedCards.map((card, idx) => (
                      <BookmarkRow
                        key={card.id}
                        card={card}
                        idx={idx}
                        isBookmarked={true}
                        onToggle={() => toggleBookmark(card.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Add section */}
              {unbookmarkedCards.length > 0 && (
                <div className="border-t border-[#1a1a1a]">
                  <button
                    onClick={() => setShowAddSection(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-[11px] font-['Rajdhani'] font-bold uppercase tracking-widest text-[#444] hover:text-[#666] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {showAddSection ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      Add items from this deck ({unbookmarkedCards.length} available)
                    </span>
                  </button>

                  <AnimatePresence>
                    {showAddSection && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3">
                          <div className="relative">
                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
                            <input
                              type="text"
                              placeholder="Search questions..."
                              value={search}
                              onChange={e => setSearch(e.target.value)}
                              className="w-full bg-surface border border-[#2a2a2a] focus:border-[#444] rounded-lg py-2 pl-8 pr-3 text-xs text-text-primary placeholder-[#444] outline-none transition-colors font-['JetBrains_Mono']"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 px-4 pb-4">
                          {filteredUnbookmarked.length === 0 ? (
                            <p className="text-center py-6 text-[#333] font-['Rajdhani'] text-xs uppercase tracking-widest">
                              No results
                            </p>
                          ) : (
                            filteredUnbookmarked.map((card, idx) => (
                              <BookmarkRow
                                key={card.id}
                                card={card}
                                idx={idx}
                                isBookmarked={false}
                                onToggle={() => toggleBookmark(card.id)}
                              />
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ── Row Component ─────────────────────────────────────────────────────────────
interface BookmarkRowProps {
  card: Card
  idx: number
  isBookmarked: boolean
  onToggle: () => void
}

function BookmarkRow({ card, idx, isBookmarked, onToggle }: BookmarkRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const questionText = getQuestionText(card)
  const isEmpty = !questionText || questionText.trim() === ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.025, 0.3), duration: 0.18 }}
      className={`flex flex-col gap-2 p-3 rounded-lg border transition-all group ${
        isBookmarked
          ? 'bg-[#0d0d0d] border-[rgba(0,255,65,0.12)] hover:border-[rgba(0,255,65,0.28)]'
          : 'bg-[#0a0a0a] border-[#1a1a1a] hover:border-[#2a2a2a]'
      }`}
    >
      <div 
        className="flex items-start gap-3 w-full cursor-pointer" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
      {/* Index badge */}
      <span className="shrink-0 w-6 h-6 rounded bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center font-['JetBrains_Mono'] text-[10px] text-[#444] mt-0.5">
        {idx + 1}
      </span>

      {/* Question text */}
      <div className="flex-1 min-w-0">
        {isEmpty ? (
          <span className="text-[#444] text-xs font-['JetBrains_Mono'] italic">
            [Image-only question — no text preview]
          </span>
        ) : (
          <div
            className={`font-['JetBrains_Mono'] text-[12px] leading-relaxed text-text-primary mcq-question-text ${!isExpanded ? 'line-clamp-3' : ''}`}
            dangerouslySetInnerHTML={{ __html: renderMath(questionText) }}
          />
        )}
        <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-[#2a2a2a] mt-0.5 block">
          {card.type}
        </span>
      </div>

      {/* Bookmark toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className={`shrink-0 p-1.5 rounded border transition-all mt-0.5 ${
          isBookmarked
            ? 'border-accent/30 text-accent bg-accent/5 hover:bg-danger/10 hover:border-danger/30 hover:text-danger'
            : 'border-[#2a2a2a] text-[#444] hover:border-accent/40 hover:text-accent hover:bg-accent/5'
        }`}
        title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
      >
        {isBookmarked ? <BookmarkX size={14} /> : <Bookmark size={14} />}
      </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 pl-9 pb-1">
              {card.type === 'mcq' && (card.data as MCQData).choices ? (
                <div className="flex flex-col gap-1.5">
                  {(card.data as MCQData).choices.map((choice, i) => {
                    const isCorrect = i === (card.data as MCQData).answer
                    return (
                      <div 
                        key={i} 
                        className={`px-3 py-2 rounded text-[11px] font-['JetBrains_Mono'] border ${
                          isCorrect 
                            ? 'bg-[var(--accent-glow)] border-[var(--accent-border)] text-[var(--accent-primary)] font-bold shadow-[0_0_12px_rgba(0,255,65,0.05)]' 
                            : 'bg-[#0f0f0f] border-[#222] text-[#888]'
                        }`}
                        dangerouslySetInnerHTML={{ __html: renderMath(choice) }}
                      />
                    )
                  })}
                </div>
              ) : card.type === 'flashcard' ? (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-[#555]">Answer</div>
                  <div 
                    className="px-3 py-2 rounded text-[11px] font-['JetBrains_Mono'] bg-[#0f0f0f] border border-accent/20 text-accent"
                    dangerouslySetInnerHTML={{ __html: renderMath((card.data as FlashcardData).back || '') }}
                  />
                </div>
              ) : (
                <div className="text-xs text-[#555] italic">No preview available for {card.type}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
