import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Layers, Bookmark, Settings2, X, ArrowLeft, ArrowRight, RotateCcw, Shuffle, PenLine, Check, XCircle, SlidersHorizontal, Pencil, Play, Trash2, AlertTriangle } from 'lucide-react'
import { getSubjectFilterClasses, getSubjectBadgeClasses } from '../lib/subjectColors'
import { Card, MCQData, FlashcardData } from '../types'
import { renderMath } from '../lib/latex'
import { shuffleArray } from '../lib/utils'

type Subject = 'MATH' | 'GEAS' | 'ELECS' | 'EST'
type FilterSubject = 'ALL' | Subject

const SUBJECTS: FilterSubject[] = ['ALL', 'MATH', 'GEAS', 'ELECS', 'EST']

const SUBJECT_MAP: Record<string, Subject> = {
  'Mathematics': 'MATH',
  'General Engineering & Applied Sciences': 'GEAS',
  'Electronics Engineering': 'ELECS',
  'Electronics Systems & Technologies': 'EST',
}

interface DeckInfo {
  id: string
  title: string
  subject: Subject
  cardCount: number
  deckType: 'mcq' | 'flashcard' | 'mixed'
  tags?: string[]
  createdAt?: number
}

interface FCSettings {
  shuffle: boolean
  bookmarkedOnly: boolean
  swapTermDef: boolean
  writtenMode: boolean
}

// ── Bookmark helpers (separate namespace from LooksFam) ──
function loadFCBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem('fc_bookmarks')
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}
function saveFCBookmarks(set: Set<string>) {
  localStorage.setItem('fc_bookmarks', JSON.stringify([...set]))
}

export default function FlashcardViewer() {
  // ── Deck listing state ──
  const [activeSubject, setActiveSubject] = useState<FilterSubject>('ALL')
  const [decks, setDecks] = useState<DeckInfo[]>([])
  const [setToDelete, setSetToDelete] = useState<DeckInfo | null>(null)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  // Advanced Filters State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date')
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'flashcard' | 'mixed'>('all')
  const filterPopoverRef = useRef<HTMLDivElement>(null)

  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    decks.forEach(d => d.tags?.forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [decks])

  // ── Active session state ──
  const [activeDeck, setActiveDeck] = useState<{ id: string; title: string; cards: Card[] } | null>(null)
  const [sessionCards, setSessionCards] = useState<Card[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<FCSettings>({ shuffle: false, bookmarkedOnly: false, swapTermDef: false, writtenMode: false })
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadFCBookmarks)

  // ── Written mode state ──
  const [writtenAnswer, setWrittenAnswer] = useState('')
  const [writtenSubmitted, setWrittenSubmitted] = useState(false)
  const [writtenCorrect, setWrittenCorrect] = useState<boolean | null>(null)
  const [writtenStats, setWrittenStats] = useState({ correct: 0, total: 0 })
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

  // ── Load decks from DB ──
  useEffect(() => {
    async function load() {
      try {
        if (!window.electron?.db) return
        const r = await window.electron.db.query(
          `SELECT t.id, t.name, t.subject, t.created_at, t.tags,
                  COUNT(c.id) as card_count,
                  GROUP_CONCAT(DISTINCT c.type) as types
           FROM topics t LEFT JOIN cards c ON c.topic_id = t.id
           GROUP BY t.id ORDER BY t.name`
        )
        if (r.success && r.data) {
          setDecks(r.data.map((row: any) => {
            const types = (row.types || '').split(',')
            let deckType: 'mcq' | 'flashcard' | 'mixed' = 'flashcard'
            if (types.includes('mcq') && types.includes('flashcard')) deckType = 'mixed'
            else if (types.includes('mcq')) deckType = 'mcq'

            let parsedTags: string[] = []
            try {
              if (row.tags) parsedTags = JSON.parse(row.tags)
            } catch (e) {}

            return {
              id: row.id,
              title: row.name,
              subject: SUBJECT_MAP[row.subject] || 'ELECS',
              cardCount: row.card_count || 0,
              deckType,
              tags: parsedTags,
              createdAt: row.created_at || Date.now()
            }
          }))
        }
      } catch (e) { console.error('Failed to load decks', e) }
    }
    load()
  }, [])

  // ── Countdown for delete ──
  useEffect(() => {
    if (setToDelete) {
      setDeleteCountdown(3)
      const timer = setInterval(() => {
        setDeleteCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [setToDelete])

  const handleConfirmDelete = async () => {
    if (!setToDelete) return
    try {
      if (window.electron?.db) {
        await window.electron.db.run(`DELETE FROM cards WHERE topic_id = ?`, [setToDelete.id])
        await window.electron.db.run(`DELETE FROM topics WHERE id = ?`, [setToDelete.id])
      }
      setDecks(prev => prev.filter(s => s.id !== setToDelete.id))
      setSetToDelete(null)
    } catch (err) {
      console.error('Failed to delete set', err)
    }
  }

  // ── Open a deck ──
  const openDeck = async (deck: DeckInfo) => {
    try {
      if (!window.electron?.db) return
      const r = await window.electron.db.query(
        `SELECT * FROM cards WHERE topic_id = ?`, [deck.id]
      )
      if (r.success && r.data) {
        const cards: Card[] = r.data.map((row: any) => ({
          id: row.id,
          topicId: row.topic_id,
          type: row.type,
          data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
          difficulty: row.difficulty || 'medium',
          tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
          isCustom: !!row.is_custom,
          createdAt: row.created_at || '',
        }))
        setActiveDeck({ id: deck.id, title: deck.title, cards })
        applySettings(cards, settings)
      }
    } catch (e) { console.error('Failed to load cards', e) }
  }

  // ── Apply settings to card list ──
  const applySettings = useCallback((cards: Card[], s: FCSettings) => {
    let filtered = [...cards]
    if (s.bookmarkedOnly) {
      filtered = filtered.filter(c => bookmarks.has(`fc_bookmark_${c.id}`))
    }
    if (s.shuffle) filtered = shuffleArray(filtered)
    setSessionCards(filtered)
    setCurrentIndex(0)
    setIsFlipped(false)
    setWrittenAnswer('')
    setWrittenSubmitted(false)
    setWrittenCorrect(null)
  }, [bookmarks])

  // Re-apply when settings change
  useEffect(() => {
    if (activeDeck) applySettings(activeDeck.cards, settings)
  }, [settings.shuffle, settings.bookmarkedOnly])

  // ── Navigation ──
  const goNext = () => {
    if (currentIndex < sessionCards.length - 1) {
      setCurrentIndex(i => i + 1)
      setIsFlipped(false)
      setWrittenAnswer('')
      setWrittenSubmitted(false)
      setWrittenCorrect(null)
    }
  }
  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1)
      setIsFlipped(false)
      setWrittenAnswer('')
      setWrittenSubmitted(false)
      setWrittenCorrect(null)
    }
  }

  // ── Keyboard ──
  useEffect(() => {
    if (!activeDeck) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); setIsFlipped(f => !f) }
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'f' || e.key === 'F') {
        // Toggle swap term/def and reset flip so front face shows first
        setSettings(s => ({ ...s, swapTermDef: !s.swapTermDef }))
        setIsFlipped(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeDeck, currentIndex, sessionCards.length])

  // ── Bookmark toggle ──
  const toggleBookmark = (cardId: string) => {
    const key = `fc_bookmark_${cardId}`
    setBookmarks(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      saveFCBookmarks(next)
      return next
    })
  }

  // ── Written mode submit ──
  const handleWrittenSubmit = () => {
    if (!currentCard || writtenSubmitted) return
    const correct = getCorrectAnswer(currentCard)
    const isCorrect = writtenAnswer.trim().toLowerCase() === correct.trim().toLowerCase()
    setWrittenCorrect(isCorrect)
    setWrittenSubmitted(true)
    setWrittenStats(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }))
  }

  // ── Exit session ──
  const exitSession = () => {
    setActiveDeck(null)
    setSessionCards([])
    setCurrentIndex(0)
    setIsFlipped(false)
    setShowSettings(false)
    setSettings(s => ({ ...s, bookmarkedOnly: false })) // Reset bookmark filter on exit
    setWrittenStats({ correct: 0, total: 0 })
  }

  // ── Helpers ──
  const currentCard = sessionCards[currentIndex] || null

  function getFrontText(card: Card): string {
    if (card.type === 'mcq') {
      const mcq = card.data as MCQData
      return settings.swapTermDef ? mcq.choices[mcq.answer] : mcq.question
    }
    return settings.swapTermDef ? (card.data as FlashcardData).back : (card.data as FlashcardData).front
  }

  function getBackContent(card: Card): React.ReactNode {
    if (card.type === 'mcq') {
      const mcq = card.data as MCQData
      const text = settings.swapTermDef ? mcq.question : mcq.choices[mcq.answer]
      return <div className="text-xl lg:text-2xl leading-relaxed font-['IBM_Plex_Mono'] text-[#00FF41] font-medium" dangerouslySetInnerHTML={{ __html: renderMath(text) }} />
    }
    const fc = card.data as FlashcardData
    const text = settings.swapTermDef ? fc.front : fc.back
    return <div className="text-xl leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMath(text) }} />
  }

  function getCorrectAnswer(card: Card): string {
    if (card.type === 'mcq') {
      const mcq = card.data as MCQData
      return settings.swapTermDef ? mcq.question : mcq.choices[mcq.answer]
    }
    const fc = card.data as FlashcardData
    return settings.swapTermDef ? fc.front : fc.back
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setShowAdvancedFilters(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredDecks = useMemo(() => {
    let result = decks.filter(d => activeSubject === 'ALL' || d.subject === activeSubject)
    
    if (filterType !== 'all') {
      result = result.filter(d => d.deckType === filterType)
    }

    if (filterTags.length > 0) {
      result = result.filter(d => filterTags.every(tag => d.tags?.includes(tag)))
    }

    result.sort((a, b) => {
      if (sortBy === 'date') return (b.createdAt || 0) - (a.createdAt || 0)
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      return 0
    })

    return result
  }, [decks, activeSubject, filterType, filterTags, sortBy])
  const progress = sessionCards.length > 0 ? ((currentIndex + 1) / sessionCards.length) * 100 : 0
  const isBookmarked = currentCard ? bookmarks.has(`fc_bookmark_${currentCard.id}`) : false

  // ══════════════════════════════════════════════
  // RENDER — Flashcard View Mode
  // ══════════════════════════════════════════════
  if (activeDeck && currentCard) {
    return (
      <div className="h-full bg-[#0D0D0D] flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="shrink-0 bg-[#111] border-b border-[#222] px-6 py-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-4">
            <button onClick={exitSession} className="text-[#888] hover:text-white transition-colors p-2 rounded hover:bg-[#222]" title="Exit">
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <span className="text-[var(--accent-primary)] font-['Orbitron'] font-bold tracking-widest text-sm uppercase">{activeDeck.title}</span>
              <span className="text-[#888] text-xs font-['Rajdhani'] uppercase tracking-widest">Card {currentIndex + 1} of {sessionCards.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {settings.writtenMode && (
              <span className="text-xs font-['IBM_Plex_Mono'] text-[#888] bg-[#1a1a1a] px-3 py-1 rounded border border-[#333]">
                Accuracy: <span className="text-[var(--accent-primary)]">{writtenStats.total > 0 ? Math.round((writtenStats.correct / writtenStats.total) * 100) : 0}%</span>
              </span>
            )}
            {/* Swap Term/Def toggle button — always visible */}
            <button
              onClick={() => { setSettings(s => ({ ...s, swapTermDef: !s.swapTermDef })); setIsFlipped(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${
                settings.swapTermDef
                  ? 'bg-[#00FF41]/20 text-[#00FF41] border-[#00FF41]'
                  : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:border-[#555] hover:text-[#E8E8E8]'
              }`}
              title="Swap Term / Definition (Shortcut: F)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {settings.swapTermDef ? 'SWAPPED' : 'SWAP'}
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="text-[#888] hover:text-[var(--accent-primary)] transition-colors p-2 rounded hover:bg-[#222]">
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="shrink-0 w-full bg-[#1a1a1a] h-[4px]">
          <motion.div className="h-full bg-[var(--accent-primary)] shadow-[0_0_8px_rgba(0,255,65,0.6)]" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="shrink-0 bg-[#111] border-b border-[#333] overflow-hidden">
              <div className="p-4 flex flex-wrap gap-6 items-center justify-center">
                {[
                  { key: 'shuffle' as const, label: 'Shuffle' },
                  { key: 'bookmarkedOnly' as const, label: 'Bookmarked Only' },
                  { key: 'swapTermDef' as const, label: 'Swap Term/Def' },
                  { key: 'writtenMode' as const, label: 'Written Mode' },
                ].map(opt => (
                  <button key={opt.key} onClick={() => setSettings(s => ({ ...s, [opt.key]: !s[opt.key] }))}
                    className={`px-4 py-2 rounded-lg text-sm font-['Rajdhani'] font-bold tracking-widest uppercase transition-all border ${
                      settings[opt.key]
                        ? 'bg-[var(--accent-primary)] text-black border-[var(--accent-primary)] shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                        : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:text-white hover:border-[#555]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card Area */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-3xl">
            <AnimatePresence mode="wait">
              <motion.div key={`${currentCard.id}-${currentIndex}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }}>
                {/* The Card */}
                <div className="relative bg-[#161616] border border-[#222] rounded-xl shadow-2xl min-h-[350px] flex flex-col">
                  {/* Bookmark */}
                  <button onClick={() => toggleBookmark(currentCard.id)} className="absolute top-5 right-5 z-10 text-[#666] hover:text-[#FFB800] transition-colors" title="Bookmark">
                    <Bookmark className={`w-6 h-6 ${isBookmarked ? 'fill-[#FFB800] text-[#FFB800]' : ''}`} />
                  </button>

                  {/* Card Label */}
                  <div className="px-8 pt-6 pb-2">
                    <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">
                      {isFlipped 
                        ? (currentCard.type === 'mcq' ? (settings.swapTermDef ? 'Question' : 'Answer') : (settings.swapTermDef ? 'Term' : 'Definition')) 
                        : (currentCard.type === 'mcq' ? (settings.swapTermDef ? 'Answer' : 'Question') : (settings.swapTermDef ? 'Definition' : 'Term'))}
                    </span>
                  </div>

                  {/* Card Content */}
                  <div className="flex-1 flex items-center justify-center px-8 pb-8 cursor-pointer" onClick={() => !settings.writtenMode && setIsFlipped(f => !f)}>
                    {!isFlipped ? (
                      <div className="text-center w-full">
                        {currentCard.data.imagePath && (
                          <div className="mb-4 w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg hover:border-[#00FF41] transition-all">
                            <img 
                              src={`ece-app://${currentCard.data.imagePath}`} 
                              alt="Card diagram"
                              className="w-full h-full max-h-[300px] object-contain cursor-zoom-in"
                              onClick={(e) => { e.stopPropagation(); setZoomedImage(currentCard.data.imagePath!); }}
                            />
                          </div>
                        )}
                        <div className="text-xl lg:text-2xl font-medium text-[#E8E8E8] leading-relaxed font-['IBM_Plex_Mono']" dangerouslySetInnerHTML={{ __html: renderMath(getFrontText(currentCard)) }} />
                        {!settings.writtenMode && <p className="text-[#555] text-sm mt-6 font-['Rajdhani']">Click or press Space to flip</p>}
                      </div>
                    ) : (
                      <div className="text-center w-full text-[#E8E8E8]">{getBackContent(currentCard)}</div>
                    )}
                  </div>
                </div>

                {/* Written Mode Input */}
                {settings.writtenMode && !isFlipped && (
                  <div className="mt-4 flex flex-col gap-3">
                    <input
                      type="text" value={writtenAnswer}
                      onChange={e => setWrittenAnswer(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleWrittenSubmit() }}
                      disabled={writtenSubmitted}
                      placeholder="Type your answer..."
                      className="w-full bg-[#111] border border-[#333] focus:border-[var(--accent-primary)] text-[#E8E8E8] placeholder-[#555] py-4 px-6 rounded-lg font-['IBM_Plex_Mono'] outline-none transition-colors"
                    />
                    {!writtenSubmitted ? (
                      <button onClick={handleWrittenSubmit} className="w-full py-3 bg-[var(--accent-primary)] text-black rounded-lg font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[var(--accent-dim)] transition-colors">Submit</button>
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
                              Correct: <span className="text-[#00FF41]" dangerouslySetInnerHTML={{ __html: renderMath(getCorrectAnswer(currentCard)) }} />
                            </div>
                          )}
                        </div>
                        <button onClick={() => { setIsFlipped(true) }} className="px-4 py-2 text-sm bg-[#222] text-[#E8E8E8] rounded font-['Rajdhani'] uppercase tracking-widest hover:bg-[#333] transition-colors">
                          View Card
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation Buttons */}
                {(isFlipped || (settings.writtenMode && writtenSubmitted)) && (
                  <div className="mt-6 flex justify-between items-center">
                    <button onClick={goPrev} disabled={currentIndex === 0}
                      className="flex items-center gap-2 px-6 py-3 bg-[#111] border border-[#333] rounded-lg text-[#E8E8E8] font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[#222] hover:border-[#555] transition-all disabled:opacity-30 disabled:cursor-default">
                      <ArrowLeft className="w-4 h-4" /> Prev
                    </button>
                    <button onClick={goNext} disabled={currentIndex === sessionCards.length - 1}
                      className="flex items-center gap-2 px-6 py-3 bg-[var(--accent-primary)] text-black rounded-lg font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[var(--accent-dim)] transition-all shadow-[0_0_15px_rgba(0,255,65,0.2)] disabled:opacity-30 disabled:cursor-default">
                      Next <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
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

  // Empty session fallback
  if (activeDeck && sessionCards.length === 0) {
    return (
      <div className="h-full bg-[#0D0D0D] flex flex-col items-center justify-center gap-6 p-10 text-center">
        <div className="flex flex-col items-center gap-2">
          <Bookmark className="w-12 h-12 text-[#FFB800] opacity-50 mb-2" />
          <p className="text-[#888] font-['IBM_Plex_Mono'] text-lg">No cards match your current filters.</p>
          <p className="text-[#555] font-['Rajdhani'] uppercase tracking-widest text-sm">
            (You might have 'Bookmarked Only' enabled with no bookmarks in this deck)
          </p>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={() => setSettings(s => ({ ...s, bookmarkedOnly: false }))}
            className="px-6 py-3 bg-[var(--accent-primary)] text-black rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[var(--accent-dim)] transition-colors shadow-[0_0_15px_rgba(0,255,65,0.2)]"
          >
            Show All Cards
          </button>
          <button 
            onClick={exitSession} 
            className="px-6 py-3 bg-[#111] border border-[#333] text-[#888] hover:text-white hover:border-[#555] rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
          >
            Back to Decks
          </button>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════
  // RENDER — Deck Listing
  // ══════════════════════════════════════════════
  return (
    <div className="h-full bg-[#0D0D0D] p-6 lg:p-12 overflow-y-auto w-full">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-10 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-[var(--bg-card)] pb-6 pt-4">
        <h1 className="text-3xl lg:text-4xl font-['Orbitron'] text-[var(--text-primary)] tracking-wider font-bold flex items-center gap-4">
          <Layers className="text-[var(--accent-primary)]" size={36} />
          FLASH<span className="text-[var(--accent-primary)]">CARDS</span>
        </h1>

        <div className="flex gap-2 items-center">
          <div className="relative" ref={filterPopoverRef}>
            <button 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`p-2 rounded-lg border transition-all ${
                showAdvancedFilters || filterTags.length > 0 || filterType !== 'all' || sortBy !== 'date'
                  ? 'bg-[#00FF41]/10 border-[#00FF41] text-[#00FF41]'
                  : 'bg-[var(--bg-secondary)] border-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <SlidersHorizontal size={20} />
            </button>
            
            <AnimatePresence>
              {showAdvancedFilters && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-72 bg-[#111] border border-[#333] rounded-lg shadow-2xl p-4 z-50 flex flex-col gap-4"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-[#333]">
                    <span className="font-['Rajdhani'] font-bold text-sm tracking-widest uppercase text-[#00FF41]">Filters & Sort</span>
                    <button onClick={() => setShowAdvancedFilters(false)} className="text-[#888] hover:text-[#E8E8E8]">
                      <X size={16} />
                    </button>
                  </div>
                  
                  {/* Sort Selection */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-['Rajdhani'] tracking-widest text-[#888] uppercase">Sort By</label>
                    <div className="grid grid-cols-2 gap-1">
                      {(['date', 'title'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setSortBy(opt)}
                          className={`text-xs py-1.5 rounded transition-colors uppercase font-['Rajdhani'] tracking-wider ${
                            sortBy === opt ? 'bg-[#00FF41]/20 text-[#00FF41] font-bold' : 'bg-[#1A1A1A] text-[#888] hover:bg-[#222]'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Type Filter */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-['Rajdhani'] tracking-widest text-[#888] uppercase">Type</label>
                    <div className="grid grid-cols-4 gap-1">
                      {(['all', 'mcq', 'flashcard', 'mixed'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setFilterType(opt)}
                          className={`text-xs py-1.5 rounded transition-colors uppercase font-['Rajdhani'] tracking-wider ${
                            filterType === opt ? 'bg-[#00FF41]/20 text-[#00FF41] font-bold' : 'bg-[#1A1A1A] text-[#888] hover:bg-[#222]'
                          }`}
                        >
                          {opt === 'flashcard' ? 'FC' : opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tag Filters */}
                  {availableTags.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-['Rajdhani'] tracking-widest text-[#888] uppercase">Tags (AND)</label>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                        {availableTags.map(tag => {
                          const isActive = filterTags.includes(tag)
                          return (
                            <button
                              key={tag}
                              onClick={() => {
                                setFilterTags(prev => 
                                  isActive ? prev.filter(t => t !== tag) : [...prev, tag]
                                )
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-['Rajdhani'] uppercase tracking-wider border transition-all ${
                                isActive 
                                  ? 'bg-[#00FF41]/10 border-[#00FF41] text-[#00FF41]'
                                  : 'bg-[#1A1A1A] border-[#333] text-[#888] hover:border-[#555] hover:text-[#E8E8E8]'
                              }`}
                            >
                              {tag}
                              {isActive && <Check size={10} />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Clear Button */}
                  {(filterTags.length > 0 || filterType !== 'all' || sortBy !== 'date') && (
                    <button
                      onClick={() => {
                        setFilterTags([])
                        setFilterType('all')
                        setSortBy('date')
                      }}
                      className="mt-2 text-xs font-['Rajdhani'] uppercase tracking-widest text-red-400 hover:text-red-300 text-center py-1 transition-colors"
                    >
                      Clear All Filters
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-2 bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--bg-card)]">
            {SUBJECTS.map(s => (
              <button key={s} onClick={() => setActiveSubject(s)}
                className={`px-4 py-2 rounded-md font-['Rajdhani'] tracking-widest text-sm font-bold transition-all ${getSubjectFilterClasses(s, activeSubject === s)}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Deck Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
        {filteredDecks.map(deck => (
          <div key={deck.id}
            className="bg-[var(--bg-card)] rounded-xl border border-[#222] hover:border-[var(--accent-dim)] transition-all hover:shadow-[0_0_20px_rgba(0,255,65,0.05)] overflow-hidden flex flex-col h-full">
            
            {/* Card Content */}
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4 gap-2">
                <div className="flex flex-col flex-1 gap-1">
                  <h3 className="text-lg font-['Orbitron'] font-bold text-[var(--text-primary)] tracking-wide leading-tight">{deck.title}</h3>
                  <div className="flex flex-wrap items-center gap-[6px]">
                    <span className={`w-fit text-[10px] font-['IBM_Plex_Mono'] font-bold px-2 py-0.5 rounded border shrink-0 uppercase ${
                      deck.deckType === 'mcq'
                        ? 'text-[#00BFFF] border-[#00BFFF]/30 bg-[#00BFFF]/10'
                        : deck.deckType === 'mixed'
                        ? 'text-[#B983FF] border-[#B983FF]/30 bg-[#B983FF]/10'
                        : 'text-[#00FF41] border-[#00FF41]/30 bg-[#00FF41]/10'
                    }`}>
                      {deck.deckType === 'mixed' ? 'MIX' : deck.deckType === 'mcq' ? 'MCQ' : 'FC'}
                    </span>

                    {deck.tags && deck.tags.length > 0 && deck.tags.map(tag => (
                      <span 
                        key={tag}
                        className="text-[0.65rem] font-['IBM_Plex_Mono'] font-bold px-2 py-0.5 rounded border border-white/20 text-[#888888] uppercase tracking-wider"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-['Rajdhani'] px-2 py-1 bg-[#1A1A1A] rounded border whitespace-nowrap ${getSubjectBadgeClasses(deck.subject)}`}>
                    {deck.cardCount} Items
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSetToDelete(deck); }}
                    className="p-1.5 text-[#555] hover:text-[#FF3333] bg-[#1A1A1A] rounded border border-[#333] hover:border-[#FF3333] transition-colors shrink-0"
                    title="Delete Set"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Date Added */}
              <div className="mb-2">
                <span className="text-[#666] font-['IBM_Plex_Mono'] text-[10px] tracking-widest uppercase">
                  ADDED: {deck.createdAt ? new Date(deck.createdAt * 1000).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase() : 'N/A'}
                </span>
              </div>

              {/* Mastery Bar (Defaults to 0% in this view) */}
              <div className="mt-auto">
                <div className="flex justify-between text-xs font-['Rajdhani'] tracking-widest mb-2">
                  <span className="text-[var(--text-secondary)] uppercase">Mastery</span>
                  <span className="text-[var(--accent-primary)] font-bold">0%</span>
                </div>
                <div className="w-full bg-[var(--bg-secondary)] h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `0%` }}
                    className="h-full bg-[var(--accent-primary)] shadow-[0_0_10px_rgba(0,255,65,0.4)]"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-[var(--bg-secondary)] py-4 px-6 flex items-center gap-3 bg-[var(--bg-elevated)] mt-auto">
              <Link 
                to={`/edit-deck/${deck.id}`} 
                onClick={(e) => e.stopPropagation()} 
                className="p-2 flex items-center justify-center bg-[var(--bg-secondary)] border border-[#333] hover:border-[#555] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded transition-colors"
                title="Edit Deck"
              >
                <Pencil className="w-4 h-4" />
              </Link>
              <button 
                onClick={(e) => { e.stopPropagation(); openDeck(deck); }}
                className="flex-1 py-2 flex items-center justify-center bg-[var(--accent-primary)] text-black rounded transition-colors hover:bg-[var(--accent-dim)] font-['Rajdhani'] tracking-widest font-bold uppercase text-sm shadow-[0_0_10px_rgba(0,255,65,0.1)]"
              >
                <Play className="w-4 h-4 mr-2" />
                Play Flashcards
              </button>
            </div>
          </div>
        ))}

        {filteredDecks.length === 0 && (
          <div className="col-span-full text-center py-20 text-[#888] font-['Rajdhani'] uppercase tracking-widest text-lg">
            No decks found{activeSubject !== 'ALL' ? ` for ${activeSubject}` : ''}. Import some from Add Decks.
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {setToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#111] border border-[#FF3333] rounded-lg shadow-[0_0_30px_rgba(255,51,51,0.15)] w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-[#222] flex items-center gap-3 bg-[#161616]">
                <AlertTriangle className="w-6 h-6 text-[#FF3333]" />
                <h2 className="text-xl font-bold text-[#E8E8E8] font-['Orbitron'] uppercase tracking-wider">
                  DELETE {setToDelete.deckType === 'mcq' ? 'MCQ SET' : 'FLASHCARD SET'}
                </h2>
              </div>
              <div className="p-6">
                <p className="text-[#CCCCCC] font-['Rajdhani'] tracking-wider mb-4 leading-relaxed text-base">
                  Are you absolutely sure you want to delete <strong className="text-[#E8E8E8] font-bold">{setToDelete.title}</strong>? 
                  This action cannot be undone and will permanently remove all {setToDelete.cardCount} {setToDelete.deckType === 'mcq' ? 'questions' : 'cards'} inside this set.
                </p>
              </div>
              <div className="p-6 border-t border-[#222] bg-[#161616] flex justify-end gap-3">
                <button 
                  onClick={() => setSetToDelete(null)}
                  className="px-5 py-2 rounded bg-transparent border border-[#333] text-[#888] hover:text-[#E8E8E8] hover:border-[#555] transition-colors font-['Rajdhani'] uppercase tracking-wider text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  disabled={deleteCountdown > 0}
                  className={`px-6 py-2 rounded font-bold transition-all font-['Rajdhani'] uppercase tracking-wider text-sm shadow-lg ${
                    deleteCountdown > 0 
                      ? 'bg-[#222] text-[#666] border border-[#333] cursor-not-allowed' 
                      : 'bg-[#FF3333] text-white hover:bg-[#CC0000] shadow-[0_0_15px_rgba(255,51,51,0.3)]'
                  }`}
                >
                  {deleteCountdown > 0 ? (
                    <span className="inline-flex items-baseline gap-0.5 font-['Rajdhani']">
                      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#00FF41', lineHeight: 1 }}>{deleteCountdown}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#888888', lineHeight: 1 }}>s</span>
                    </span>
                  ) : (
                    'Confirm Delete'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
