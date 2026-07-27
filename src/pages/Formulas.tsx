import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import FolderPanel from '@/components/ui/FolderPanel'
import { useFolderState } from '../hooks/useFolderState'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate, useBlocker } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'
import {
  Sigma,
  Layers,
  Bookmark,
  X,
  SlidersHorizontal,
  Pencil,
  Play,
  Trash2,
  AlertTriangle,
  ScrollText,
  Search,
  Check,
  Eye,
  Plus,
} from 'lucide-react'
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal'
import { FlashcardSession } from '../components/flashcard/FlashcardSession'
import type { Card, CardData, CardType } from '../types'
import { useIdleAwareTimer } from '../hooks/useIdleAwareTimer'
import { DeckCard } from '../components/deck/DeckCard'
import { DeckGrid } from '../components/deck/DeckGrid'
import { SUBJECT_MAP } from '../lib/subjectColors'
import { TOS_SUBJECT_COLORS } from '../lib/tosData'
import { Card as CardLegacy, MCQData, FlashcardData } from '../types'
import type { FormulaData } from '../types'
import { renderMath } from '../lib/latex'
import { shuffleArray } from '../lib/utils'
import { dbService } from '../services/db.service'
import { getFrontText, getCorrectAnswer } from '../components/flashcard/StudyCard'



type Subject = 'MATH' | 'GEAS' | 'ELECS' | 'EST'
type FilterSubject = 'ALL' | Subject

const SUBJECTS: FilterSubject[] = ['ALL', 'MATH', 'GEAS', 'ELECS', 'EST']



interface DeckInfo {
  id: string
  title: string
  subject: Subject
  cardCount: number
  deckType: 'mcq' | 'flashcard' | 'formula' | 'mixed'
  description: string
  mastery?: number
  tags?: string[]
  createdAt?: number
  folderName?: string
  folderId?: string
  order_index?: number
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
  } catch {
    return new Set()
  }
}
function saveFCBookmarks(set: Set<string>) {
  localStorage.setItem('fc_bookmarks', JSON.stringify([...set]))
}




export default function Formulas() {
  const navigate = useNavigate()
  const { startSession, rateCard, isSubmitting } = useSessionStore()

  // ── Deck listing state ──
  const [activeSubject, setActiveSubject] = useState<FilterSubject>('ALL')
  const [decks, setDecks] = useState<DeckInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [setToDelete, setSetToDelete] = useState<DeckInfo | null>(null)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  // Advanced Filters State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'mastery'>('date')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'formula' | 'mixed'>('all')
  const [activeFolder, setActiveFolder] = useState<string | 'all'>('all')
  const filterPopoverRef = useRef<HTMLDivElement>(null)

  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    decks.forEach((d) => d.tags?.forEach((t) => tags.add(t)))
    return Array.from(tags).sort()
  }, [decks])

  // ── Active session state ──
  const [activeDeck, setActiveDeck] = useState<{ id: string; title: string; cards: Card[] } | null>(
    null
  )
  const [sessionCards, setSessionCards] = useState<Card[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionMode, setSessionMode] = useState<'study' | 'preview'>('study')

  useIdleAwareTimer(activeDeck !== null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<FCSettings>({
    shuffle: false,
    bookmarkedOnly: false,
    swapTermDef: false,
    writtenMode: false,
  })
  const [isAutoplay, setIsAutoplay] = useState(false)
  const [wasAutoplayed, setWasAutoplayed] = useState(false)
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadFCBookmarks)

  const autoplayRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null
    activeIndex: number
    phase: 'front' | 'back'
    isNewCard: boolean
  }>({ timer: null, activeIndex: -1, phase: 'front', isNewCard: false })
  const autoplaySpeechDoneRef = useRef<(() => void) | null>(null)

  // ── Written mode state ──
  const [writtenAnswer, setWrittenAnswer] = useState('')
  const [writtenSubmitted, setWrittenSubmitted] = useState(false)
  const [writtenCorrect, setWrittenCorrect] = useState<boolean | null>(null)
  const [writtenStats, setWrittenStats] = useState({ correct: 0, total: 0 })
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Navigation Blocking logic
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      activeDeck !== null && currentLocation.pathname !== nextLocation.pathname
  )



  // Reset blocker on unmount if still in blocked state
  useEffect(() => {
    return () => {
      if (blocker.state === 'blocked') {
        blocker.reset()
      }
    }
  }, [blocker])

  useEffect(() => {
    const saved = sessionStorage.getItem('ecengine:returnScroll:/formulas')
    if (saved) {
      window.scrollTo(0, parseInt(saved, 10))
      sessionStorage.removeItem('ecengine:returnScroll:/formulas')
    }
  }, [])

  // Safe exit: reset any active blocker before handing control to parent
  const handleExit = () => {
    if (blocker.state === 'blocked') blocker.reset()
    exitSession()
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

  // ── Load decks from DB ──
  const loadDecks = async () => {
    try {
      const [r, masteryRes] = await Promise.all([
        window.electron.decks.getFormulaTopics(),
        dbService.decks.getFormulaMastery()
      ])

        const masteryMap: Record<string, number> = {}
        if (masteryRes.success && Array.isArray(masteryRes.data)) {
          for (const row of masteryRes.data) {
            masteryMap[row.topic_id] = row.mastery != null
              ? Math.round(row.mastery * 100)
              : 0
          }
        }

        if (r.success && r.data) {
          setDecks(
            r.data.map((row: any) => {
              const types = (row.types || '').split(',')
              let deckType: 'mcq' | 'flashcard' | 'formula' | 'mixed' = 'formula'
              if (types.includes('mcq') && types.includes('flashcard')) deckType = 'mixed'
              else if (types.includes('mcq')) deckType = 'mcq'
              else if (types.includes('flashcard')) deckType = 'flashcard'
              else if (types.includes('formula')) deckType = 'formula'

              let parsedTags: string[] = []
              try {
                if (row.tags) parsedTags = JSON.parse(row.tags)
              } catch (e) {}

              const mastery = masteryMap[row.id] ?? 0

              return {
                id: row.id,
                title: row.name,
                subject: SUBJECT_MAP[row.subject] || 'ELECS',
                cardCount: row.card_count || 0,
                deckType,
                description: row.description || '',
                mastery,
                tags: parsedTags,
                createdAt: row.created_at || Date.now(),
                folderName: row.folder_name || 'Uncategorized',
                folderId: row.folder_id || null,
                order_index: row.order_index,
              }
            })
          )
        }
    } catch (e) { console.error('Failed to load decks', e) }
    finally { setIsLoading(false) }
  }

  const {
    folderRows,
    onCreateFolder,
    onDeleteFolder: handleDeleteFolder,
    onReorderFolders: handleReorderFolders,
    onPromoteFolder,
    onNestFolder,
    onRenameFolder,
    subtreeIds,
  } = useFolderState(loadDecks, 'formula')

  useEffect(() => {
    loadDecks()
  }, [])

  // ── Countdown for delete ──
  useEffect(() => {
    if (setToDelete) {
      setDeleteCountdown(2)
      const timer = setInterval(() => {
        setDeleteCountdown((prev) => {
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
      await window.electron.decks.deleteTopic(setToDelete.id)
      setDecks((prev) => prev.filter((s) => s.id !== setToDelete.id))
      setSetToDelete(null)
    } catch (err) {
      console.error('Failed to delete set', err)
    }
  }

  // ── Open a deck ──
  const openDeck = async (deck: DeckInfo, mode: 'study' | 'preview') => {
    try {
      const cards = await dbService.getAllCardsByTopic(deck.id)
      if (cards.length === 0) return
      setSessionMode(mode)
      setActiveDeck({ id: deck.id, title: deck.title, cards })
      applySettings(cards, settings)
      if (mode === 'study') {
        startSession(cards)
      }
    } catch (e) {
      console.error('Failed to load cards', e)
    }
  }

  // ── Apply settings to card list ──
  const applySettings = useCallback(
    (cards: Card[], s: FCSettings) => {
      let filtered = [...cards]
      if (s.bookmarkedOnly) {
        filtered = filtered.filter((c) => bookmarks.has(`fc_bookmark_${c.id}`))
      }
      if (s.shuffle) filtered = shuffleArray(filtered)
      setSessionCards(filtered)
      setCurrentIndex(0)
      setIsFlipped(false)
      setWrittenAnswer('')
      setWrittenSubmitted(false)
      setWrittenCorrect(null)
    },
    [bookmarks]
  )

  // Re-apply when settings change
  useEffect(() => {
    if (activeDeck) applySettings(activeDeck.cards, settings)
  }, [settings.shuffle, settings.bookmarkedOnly])

  // ── Navigation ──
  const goNext = () => {
    if (currentIndex < sessionCards.length - 1) {
      setCurrentIndex((i) => i + 1)
      setIsFlipped(false)
      setWrittenAnswer('')
      setWrittenSubmitted(false)
      setWrittenCorrect(null)
    }
  }
  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
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
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowExitConfirm(true)
        return
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        setIsFlipped((f) => !f)
      }
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'f' || e.key === 'F') {
        // Toggle swap term/def and reset flip so front face shows first
        setSettings((s) => ({ ...s, swapTermDef: !s.swapTermDef }))
        setIsFlipped(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeDeck, currentIndex, sessionCards.length])

  // ── Bookmark toggle ──
  const toggleBookmark = (cardId: string) => {
    const key = `fc_bookmark_${cardId}`
    setBookmarks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveFCBookmarks(next)
      return next
    })
  }

  // ── Written mode submit ──
  const handleWrittenSubmit = () => {
    if (!currentCard || writtenSubmitted) return
    const correct = getCorrectAnswer(currentCard, settings.swapTermDef)
    const isCorrect = writtenAnswer.trim().toLowerCase() === correct.trim().toLowerCase()
    setWrittenCorrect(isCorrect)
    setWrittenSubmitted(true)
    setWrittenStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }))
  }

  // ── Helpers ──
  const currentCard = sessionCards[currentIndex] || null

  // ── Autoplay Sequencer (Timer-based for Formulas, no TTS) ──
  useEffect(() => {
    if (autoplayRef.current.timer) clearTimeout(autoplayRef.current.timer)

    if (!isAutoplay || !activeDeck || !currentCard || settings.writtenMode) return

    const index = currentIndex
    autoplayRef.current.activeIndex = index

    if (!isFlipped) {
      autoplayRef.current.phase = 'front'
      autoplayRef.current.timer = setTimeout(() => {
        if (autoplayRef.current.activeIndex !== index) return
        setIsFlipped(true)
      }, 2000)
    } else {
      autoplayRef.current.phase = 'back'
      autoplayRef.current.timer = setTimeout(() => {
        if (autoplayRef.current.activeIndex !== index) return
        if (index < sessionCards.length - 1) {
          autoplayRef.current.isNewCard = true
          autoplayRef.current.activeIndex = index + 1
          setCurrentIndex(index + 1)
          setIsFlipped(false)
          setWrittenAnswer('')
          setWrittenSubmitted(false)
          setWrittenCorrect(null)
        } else {
          setIsAutoplay(false)
          setWasAutoplayed(true)
        }
      }, 2500)
    }
  }, [isAutoplay, isFlipped, currentIndex, activeDeck, settings.writtenMode])

  useEffect(() => {
    return () => {
      if (autoplayRef.current.timer) clearTimeout(autoplayRef.current.timer)
    }
  }, [])

  // ── Exit session ──
  const exitSession = () => {
    if (autoplayRef.current.timer) clearTimeout(autoplayRef.current.timer)
    setIsAutoplay(false)
    setWasAutoplayed(false)
    if (blocker.state === 'blocked') blocker.reset()
    setActiveDeck(null)
    setSessionCards([])
    setCurrentIndex(0)
    setIsFlipped(false)
    setShowSettings(false)
    setSettings((s) => ({ ...s, bookmarkedOnly: false })) // Reset bookmark filter on exit
    setWrittenStats({ correct: 0, total: 0 })
    // Re-fetch mastery so the deck list shows updated SM-2 progress after study.
    loadDecks()
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

  const folders = useMemo(() => {
    const folderMap = new Map<string, number>()
    decks.forEach((d) => {
      const name = d.folderName || 'Uncategorized'
      const existing = folderMap.get(name) ?? Infinity
      const idx = d.order_index ?? Infinity
      folderMap.set(name, Math.min(existing, idx))
    })
    const names = [...folderMap.keys()]
      .filter((n) => n !== 'Uncategorized')
      .sort((a, b) => folderMap.get(a)! - folderMap.get(b)!)
    names.push('Uncategorized')
    return names
  }, [decks])

  const deckCountByFolder = useMemo(() => {
    const acc: Record<string, number> = {}
    const uncategorized = folderRows.find(f => f.name === 'Uncategorized')
    const uncategorizedId = uncategorized?.id
    
    for (const folder of folderRows) {
      let count = 0
      if (folder.name === 'Uncategorized') {
        count = decks.filter(d => d.folderId === null || d.folderId === uncategorizedId).length
      } else {
        count = decks.filter(d => {
          const ids = subtreeIds(folder.id)
          return d.folderId ? ids.includes(d.folderId) : false
        }).length
      }
      acc[folder.id] = count
      acc[folder.name] = count // for legacy mode fallback
    }
    return acc
  }, [decks, folderRows, subtreeIds])

  const filteredDecks = useMemo(() => {
    // Formula type filter is already applied at DB level (HAVING clause)
    // Folder filter → subject filter → type filter → tag filter → sort
    const folderFiltered = activeFolder === 'all'
        ? decks
        : decks.filter(d => {
            const ids = subtreeIds(activeFolder)
            return d.folderId ? ids.includes(d.folderId) : activeFolder === 'Uncategorized'
          })

    let result = folderFiltered.filter(
      (d) => activeSubject === 'ALL' || d.subject === activeSubject
    )

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(d => d.title.toLowerCase().includes(q))
    }

    if (filterType !== 'all') {
      result = result.filter((d) => d.deckType === filterType)
    }

    if (filterTags.length > 0) {
      result = result.filter((d) => filterTags.every((tag) => d.tags?.includes(tag)))
    }

    result.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'date') comparison = (a.createdAt || 0) - (b.createdAt || 0)
      else if (sortBy === 'title') comparison = a.title.localeCompare(b.title)
      else if (sortBy === 'mastery') comparison = (a.mastery ?? 0) - (b.mastery ?? 0)
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return result
  }, [decks, activeFolder, activeSubject, filterType, filterTags, sortBy, sortOrder, searchQuery])
  const progress = sessionCards.length > 0 ? ((currentIndex + 1) / sessionCards.length) * 100 : 0
  const isBookmarked = currentCard ? bookmarks.has(`fc_bookmark_${currentCard.id}`) : false

  // ══════════════════════════════════════════════
  // RENDER — Flashcard View Mode
  // ══════════════════════════════════════════════
  // ══════════════════════════════════════════════
  // RENDER — Flashcard View Mode (via FlashcardSession)
  // ══════════════════════════════════════════════
  if (activeDeck && currentCard) {
    return (
      <FlashcardSession
        activeDeck={activeDeck}
        currentCard={currentCard}
        currentIndex={currentIndex}
        sessionCards={sessionCards}
        isFlipped={isFlipped}
        isAutoplay={isAutoplay}
        wasAutoplayed={wasAutoplayed}
        isBookmarked={currentCard ? bookmarks.has(`fc_bookmark_${currentCard.id}`) : false}
        isSubmitting={isSubmitting}
        fcTtsEnabled={false}
        showSettings={showSettings}
        settings={settings}
        writtenAnswer={writtenAnswer}
        writtenSubmitted={writtenSubmitted}
        writtenCorrect={writtenCorrect}
        writtenStats={writtenStats}
        zoomedImage={zoomedImage}
        showExitConfirm={showExitConfirm}
        blockerState={blocker.state}
        progress={sessionCards.length > 0 ? ((currentIndex + 1) / sessionCards.length) * 100 : 0}
        mode={sessionMode}
        enableTTS={false}
        enableAutoplay={sessionMode === 'study'}
        onExit={handleExit}
        onBlockerProceed={() => { blocker.proceed && blocker.proceed() }}
        onBlockerReset={() => blocker.reset && blocker.reset()}
        onSetExitConfirm={setShowExitConfirm}
        onFlip={() => { if (!settings.writtenMode) { if (isAutoplay) setIsAutoplay(false); setIsFlipped(f => !f) } }}
        onToggleAutoplay={() => setIsAutoplay(prev => {
          const next = !prev
          if (next) setWasAutoplayed(true)
          return next
        })}
        onToggleTTS={() => {}}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onSettingChange={(key) => setSettings(s => ({ ...s, [key]: !s[key] }))}
        onSwapTermDef={() => {
          if (autoplayRef.current.timer) clearTimeout(autoplayRef.current.timer)
          setSettings(s => ({ ...s, swapTermDef: !s.swapTermDef }))
          setIsFlipped(false)
        }}
        onBookmarkToggle={toggleBookmark}
        onWrittenChange={setWrittenAnswer}
        onWrittenSubmit={handleWrittenSubmit}
        onViewCard={() => setIsFlipped(true)}
        onZoomImage={setZoomedImage}
        onRateCard={sessionMode === 'preview' ? async () => {} : async (rating) => {
          await rateCard(rating)
        }}
        onGoNext={goNext}
        onGoPrev={goPrev}
        stop={() => {}}
        autoplayRef={autoplayRef}
        autoplaySpeechDoneRef={autoplaySpeechDoneRef}
      />
    )
  }

  // Empty session fallback
  if (activeDeck && sessionCards.length === 0) {
    return (
      <div className="h-full bg-engine-black flex flex-col items-center justify-center gap-6 p-10 text-center">
        <div className="flex flex-col items-center gap-2">
          <Bookmark className="w-12 h-12 text-warn opacity-50 mb-2" />
          <p className="text-text-muted font-['IBM_Plex_Mono'] text-lg">
            No cards match your current filters.
          </p>
          <p className="text-[#555] font-['Rajdhani'] uppercase tracking-widest text-sm">
            (You might have 'Bookmarked Only' enabled with no bookmarks in this deck)
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setSettings((s) => ({ ...s, bookmarkedOnly: false }))}
            className="px-6 py-3 bg-[var(--accent-primary)] text-black rounded font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[var(--accent-dim)] transition-colors shadow-[0_0_15px_rgba(0,255,65,0.2)]"
          >
            Show All Cards
          </button>
          <button
            onClick={handleExit}
            className="px-6 py-3 bg-[#111] border border-[#333] text-text-muted hover:text-white hover:border-[#555] rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
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
    <div className="flex flex-col h-full w-full">
      {/* Folder Panel + Deck Grid */}
      <div className="flex flex-row flex-1 w-full overflow-hidden">
        <FolderPanel
          folderRows={folderRows}
          folders={folders}
          deckCountByFolder={deckCountByFolder}
          totalDeckCount={decks.length}
          selected={activeFolder}
          onSelect={setActiveFolder}
          onDeleteFolder={handleDeleteFolder}
          onReorderFolders={handleReorderFolders}
          onCreateFolder={onCreateFolder}
          onPromoteFolder={onPromoteFolder}
          onNestFolder={onNestFolder}
          onRenameFolder={onRenameFolder}
        />
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto show-scrollbar">
          {/* Header centered above decks */}
          <div className="flex flex-col items-center w-full pt-6 pb-0 px-6">
            <div className="w-full max-w-5xl flex flex-col items-center justify-center gap-6 mb-2 border-b border-[var(--bg-card)] pb-4 pt-4 relative z-30">
              <div className="w-full flex items-center justify-center relative min-h-[40px]">
                <h1 className="text-3xl lg:text-4xl font-['Orbitron'] text-[var(--text-primary)] tracking-wider font-bold flex items-center gap-4 uppercase">
                  <Sigma className="text-[var(--accent-primary)]" size={32} />
                  FORMULAS
                </h1>
                <button
                  onClick={() => navigate('/add-decks?type=formula')}
                  className="absolute right-0 flex items-center gap-2 px-4 py-2 rounded-md border border-[var(--bg-card)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] font-['Rajdhani'] font-bold text-sm uppercase tracking-widest transition-all"
                >
                  <Plus size={15} />
                  Add Formula Set
                </button>
              </div>

              <div className="flex items-center justify-center flex-wrap gap-2 w-full bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--bg-card)] no-scrollbar px-1">
                <div className="relative shrink-0" ref={filterPopoverRef}>
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`p-2 rounded-lg border transition-all ${
                      showAdvancedFilters ||
                      filterTags.length > 0 ||
                      filterType !== 'all' ||
                      sortBy !== 'date' ||
                      sortOrder !== 'desc' ||
                      searchQuery
                        ? 'bg-accent/10 border-accent text-accent'
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
                        className="absolute left-0 mt-2 w-72 bg-[#111] border border-[#333] rounded-lg shadow-2xl p-4 z-50 flex flex-col gap-4"
                      >
                        <div className="flex justify-between items-center pb-2 border-b border-[#333]">
                          <span className="font-['Rajdhani'] font-bold text-sm tracking-widest uppercase text-accent">
                            Filters & Sort
                          </span>
                          <button
                            onClick={() => setShowAdvancedFilters(false)}
                            className="text-text-muted hover:text-text-primary"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] w-4 h-4" />
                          <input
                            type="text"
                            placeholder="Search decks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-surface border border-[#333] focus:border-accent rounded-lg py-2 pl-9 pr-3 text-sm text-text-primary placeholder-[#555] outline-none transition-colors font-['IBM_Plex_Mono']"
                          />
                        </div>

                        {/* Type Filter */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-['Rajdhani'] tracking-widest text-text-muted uppercase">
                            Type
                          </label>
                          <div className="grid grid-cols-4 gap-1">
                            {(['all', 'mcq', 'formula', 'mixed'] as const).map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setFilterType(opt)}
                                className={`text-xs py-1.5 rounded transition-colors uppercase font-['Rajdhani'] tracking-wider ${
                                  filterType === opt
                                    ? 'bg-accent/20 text-accent font-bold'
                                    : 'bg-surface text-text-muted hover:bg-border-base'
                                }`}
                              >
                                {opt === 'formula' ? 'F1' : opt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Tag Filters */}
                        {availableTags.length > 0 && (
                          <div className="flex flex-col gap-2">
                            <label className="text-xs font-['Rajdhani'] tracking-widest text-text-muted uppercase">
                              Tags (AND)
                            </label>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                              {availableTags.map((tag) => {
                                const isActive = filterTags.includes(tag)
                                return (
                                  <button
                                    key={tag}
                                    onClick={() => {
                                      setFilterTags((prev) =>
                                        isActive ? prev.filter((t) => t !== tag) : [...prev, tag]
                                      )
                                    }}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-['Rajdhani'] uppercase tracking-wider border transition-all ${
                                      isActive
                                        ? 'bg-accent/10 border-accent text-accent'
                                        : 'bg-surface border-[#333] text-text-muted hover:border-[#555] hover:text-text-primary'
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

                        {/* Sort Selection */}
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-['Rajdhani'] tracking-widest text-text-muted uppercase">
                              Sort By
                            </label>
                            <div className="flex bg-surface rounded overflow-hidden border border-[#333]">
                              {(['asc', 'desc'] as const).map((order) => (
                                <button
                                  key={order}
                                  onClick={() => setSortOrder(order)}
                                  className={`px-2 py-0.5 text-[10px] font-['Rajdhani'] uppercase tracking-widest transition-colors ${
                                    sortOrder === order
                                      ? 'bg-accent text-black font-bold'
                                      : 'text-text-muted hover:text-text-primary'
                                  }`}
                                >
                                  {order}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {(['date', 'title', 'mastery'] as const).map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setSortBy(opt)}
                                className={`text-xs py-1.5 rounded transition-colors uppercase font-['Rajdhani'] tracking-wider ${
                                  sortBy === opt
                                    ? 'bg-accent/20 text-accent font-bold'
                                    : 'bg-surface text-text-muted hover:bg-border-base'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {(filterTags.length > 0 || filterType !== 'all' || sortBy !== 'date' || sortOrder !== 'desc' || searchQuery) && (
                          <button
                            onClick={() => {
                              setFilterTags([])
                              setFilterType('all')
                              setSortBy('date')
                              setSortOrder('desc')
                              setSearchQuery('')
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

                {SUBJECTS.map(s => {
                  const isActive = activeSubject === s
                  const colors = s !== 'ALL' ? TOS_SUBJECT_COLORS[s] : null

                  return (
                    <button
                      key={s}
                      onClick={() => setActiveSubject(s)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all font-['Rajdhani'] font-bold text-sm uppercase tracking-widest"
                      style={
                        isActive
                          ? s === 'ALL'
                            ? {
                                background: 'var(--accent-glow)',
                                borderColor: 'var(--accent-border)',
                                color: 'var(--accent-primary)',
                                boxShadow: '0 0 16px rgba(0,255,65,0.1)',
                              }
                            : {
                                background: `rgba(${colors?.accentRgb},0.15)`,
                                borderColor: `rgba(${colors?.accentRgb},0.5)`,
                                color: colors?.accent,
                                boxShadow: `0 0 16px rgba(${colors?.accentRgb},0.1)`,
                              }
                          : {
                              background: '#0c0c0c',
                              borderColor: '#2a2a2a',
                              color: '#555',
                            }
                      }
                    >
                      {s}
                    </button>
                  )
                })}
              </div>

              <div
                className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 w-full text-xs text-slate-500 font-medium uppercase tracking-wider mb-0"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <Play className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Learn Mode
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <Eye className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Preview Mode
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <ScrollText className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Test Paper View
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <Pencil className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Edit Deck
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <Trash2 className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Delete Deck
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 px-6 pb-6">
            <div className="flex flex-col items-center">
              <div className="w-full max-w-5xl">
                <DeckGrid>
                  {filteredDecks.map((deck) => (
                    <DeckCard
                      key={deck.id}
                      deck={deck}
                      onLearn={(id) => openDeck(decks.find(d => d.id === id)!, 'study')}
                      onPreview={(id) => openDeck(decks.find(d => d.id === id)!, 'preview')}
                      onEdit={(id) => {
                        sessionStorage.setItem('ecengine:returnScroll:/formulas', String(window.scrollY))
                        navigate(`/edit-deck/${id}?returnTo=/formulas`)
                      }}
                      onDelete={setSetToDelete}
                      onPrint={(id, title) => window.electron.print.open(id, title)}
                    />
                  ))}
                </DeckGrid>

                {isLoading ? (
                  <div className="text-center py-20 text-[#555] font-['IBM_Plex_Mono'] text-sm tracking-widest animate-pulse">
                    Loading decks...
                  </div>
                ) : filteredDecks.length === 0 ? (
                  <div className="text-center py-20 text-text-muted font-rajdhani uppercase tracking-widest text-lg">
                    No decks found{activeSubject !== 'ALL' ? ` for ${activeSubject}` : ''}. Import
                    some from Add Decks.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {setToDelete && (
              <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSetToDelete(null)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="relative w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
                >
                  <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#FF003C] to-transparent" />
                  <div className="p-8 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-[#FF003C]/10 border border-[#FF003C]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,0,60,0.1)]">
                      <AlertTriangle className="w-8 h-8 text-[#FF003C]" />
                    </div>
                    <h3 className="text-2xl font-['Orbitron'] font-bold text-white mb-4 tracking-widest uppercase">
                      DELETE DECK?
                    </h3>
                    <p className="text-text-muted font-['IBM_Plex_Mono'] mb-8 leading-relaxed">
                      Are you absolutely sure you want to delete{' '}
                      <strong className="text-white">{setToDelete.title}</strong>? This action
                      cannot be undone and will permanently remove all {setToDelete.cardCount} items
                      in this set.
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                      <button
                        onClick={handleConfirmDelete}
                        disabled={deleteCountdown > 0}
                        className="w-full py-4 bg-[#FF003C] hover:bg-[#D00030] disabled:bg-surface disabled:text-[#444] disabled:cursor-not-allowed text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,0,60,0.2)] hover:shadow-[0_0_25px_rgba(255,0,60,0.4)]"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setSetToDelete(null)}
                        className="w-full py-4 bg-surface border border-[#333] hover:border-[#555] text-text-muted hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setSetToDelete(null)}
                    className="absolute top-4 right-4 text-[#444] hover:text-white transition-colors p-1"
                  >
                    <X size={20} />
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

