import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import FolderPanel from '@/components/ui/FolderPanel'
import { useFolderState } from '../hooks/useFolderState'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate, useBlocker } from 'react-router-dom'
import { Layers, Bookmark, Settings2, X, ArrowLeft, ArrowRight, RotateCcw, Shuffle, PenLine, SlidersHorizontal, Pencil, Play, Pause, Trash2, AlertTriangle, Trophy, ScrollText, Search, Volume2, VolumeX, Copy, Sparkles } from 'lucide-react'
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal'
import { FlashCardSettingsModal, FlashCardSettings, FLASH_SETTINGS_DEFAULTS, loadFlashTTSPreference } from '../components/flashcard/FlashCardSettingsModal'
import type { Card, CardData, CardType } from '../types'
import { getSubjectFilterClasses, getSubjectBadgeClasses, SUBJECT_MAP } from '../lib/subjectColors'
import { TOS_SUBJECT_COLORS } from '../lib/tosData'
import { Card as CardLegacy, MCQData, FlashcardData } from '../types'
import type { FormulaData } from '../types'
import { shuffleArray } from '../lib/utils'
import { AdvancedFiltersPopover } from '../components/deck/AdvancedFiltersPopover'
import { DeckCard } from '../components/deck/DeckCard'
import { StudyCard, getFrontText, getCorrectAnswer } from '../components/flashcard/StudyCard'
import { dbService } from '../services/db.service'
import { useTTS } from '../hooks/useTTS'
import { useIdleAwareTimer } from '../hooks/useIdleAwareTimer'
import { FlashcardSession } from '../components/flashcard/FlashcardSession'
import { FlashcardDeckBrowser } from '../components/flashcard/FlashcardDeckBrowser'
import { useSessionStore } from '../store/useSessionStore'
import { PREDEFINED_TAGS } from '../lib/constants'

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
  tags?: string[]
  createdAt?: number
  folderName?: string
  folderId?: string
  order_index?: number
  mastery?: number
  isFavorite?: boolean
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




export default function FlashcardLearn() {
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
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'flashcard' | 'mixed'>('all')
  const [includeMCQ, setIncludeMCQ] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ecengine:flashcards:includeMCQ') === 'true'
    } catch {
      return false
    }
  })

  const handleToggleIncludeMCQ = (val: boolean) => {
    setIncludeMCQ(val)
    try {
      localStorage.setItem('ecengine:flashcards:includeMCQ', String(val))
    } catch {}
  }
  const [activeFolder, setActiveFolder] = useState<string | 'all'>('all')
  const filterPopoverRef = useRef<HTMLDivElement>(null)

  // Decks available in Flashcards view depending on includeMCQ toggle
  const availableDecks = useMemo(() => {
    if (includeMCQ) return decks
    return decks.filter(d => d.deckType === 'flashcard' || d.deckType === 'mixed')
  }, [decks, includeMCQ])

  const availableTags = useMemo(() => {
    const tags = new Set<string>(PREDEFINED_TAGS)
    availableDecks.forEach(d => d.tags?.forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [availableDecks])

  // ── Pre-session flashcard settings modal ──
  const [showFlashModal, setShowFlashModal] = useState<{ isOpen: boolean; deckId: string | null }>({ isOpen: false, deckId: null })
  const [flashModalSettings, setFlashModalSettings] = useState<FlashCardSettings>({
    ...FLASH_SETTINGS_DEFAULTS,
    ttsEnabled: loadFlashTTSPreference(),
  })

  // ── Active session state ──
  const [activeDeck, setActiveDeck] = useState<{ id: string; title: string; cards: Card[] } | null>(null)
  const [sessionCards, setSessionCards] = useState<Card[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<FCSettings>({ shuffle: false, bookmarkedOnly: false, swapTermDef: false, writtenMode: false })
  const [isAutoplay, setIsAutoplay] = useState(false)
  const [wasAutoplayed, setWasAutoplayed] = useState(false)
  const [sessionMode, setSessionMode] = useState<'study' | 'preview'>('study')

  const autoplayRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null
    activeIndex: number
    phase: 'front' | 'back'
    isNewCard: boolean
  }>({ timer: null, activeIndex: -1, phase: 'front', isNewCard: false })
  const autoplaySpeechDoneRef = useRef<(() => void) | null>(null)

  // ── TTS ────────────────────────────────────────────────────────────────────
  const [fcTtsEnabled, setFcTtsEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('ecengine:tts:enabled') === 'true' } catch { return false }
  })
  const { speak, stop, speakWithCallback } = useTTS(fcTtsEnabled)
  useIdleAwareTimer(activeDeck !== null)
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadFCBookmarks)

  // ── Written mode state ──
  const [writtenAnswer, setWrittenAnswer] = useState('')
  const [writtenSubmitted, setWrittenSubmitted] = useState(false)
  const [writtenCorrect, setWrittenCorrect] = useState<boolean | null>(null)
  const [writtenStats, setWrittenStats] = useState({ correct: 0, total: 0 })
  const [showContext, setShowContext] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showToast, setShowToast] = useState(false)

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
    const saved = sessionStorage.getItem('ecengine:returnScroll:/flashcards')
    if (saved) {
      window.scrollTo(0, parseInt(saved, 10))
      sessionStorage.removeItem('ecengine:returnScroll:/flashcards')
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
      let processedDecks: any[] = []
      const r = await window.electron.decks.getTopicsWithCardCounts()
      if (r.success && r.data) {
        processedDecks = r.data.map((row: any) => {
          const types = (row.types || '').split(',')

          // Skip formula-only decks
          if (types.length === 1 && types[0] === 'formula') return null

          let deckType: 'mcq' | 'flashcard' | 'mixed' = 'flashcard'
          if (types.includes('mcq') && types.includes('flashcard')) deckType = 'mixed'
          else if (types.includes('mcq')) deckType = 'mcq'

          let parsedTags: string[] = []
          try {
            if (row.tags) parsedTags = JSON.parse(row.tags)
          } catch (e) { }

          return {
            id: row.id,
            title: row.name,
            subject: SUBJECT_MAP[row.subject] || 'ELECS',
            cardCount: row.card_count || 0,
            deckType,
            description: row.description || '',
            tags: parsedTags,
            createdAt: row.created_at || Date.now(),
            folderName: row.folder_name || 'Uncategorized',
            folderId: row.folder_id || null,
            order_index: row.order_index,
            isFavorite: Boolean(row.is_favorite)
          }
        }).filter((d: DeckInfo | null): d is DeckInfo => d !== null)
        // Load mastery and merge
        try {
          const masteryResult = await window.electron.decks.getFormulaMastery()
          if (masteryResult.success && masteryResult.data) {
            const masteryMap = new Map<string, number>()
            for (const row of masteryResult.data) {
              const pct = row.mastery != null ? Math.round(row.mastery * 100) : 0
              masteryMap.set(row.topic_id, pct)
            }
            processedDecks = processedDecks.map((d: DeckInfo) => ({
              ...d,
              mastery: masteryMap.get(d.id) ?? 0,
            }))
          }
        } catch (e) {
          console.warn('[FlashcardLearn] Failed to load mastery:', e)
        }
        setDecks(processedDecks)
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
  } = useFolderState(loadDecks, 'study')

  useEffect(() => {
    loadDecks()
  }, [])

  // ── Countdown for delete ──
  useEffect(() => {
    if (setToDelete) {
      setDeleteCountdown(2)
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
      await window.electron.decks.deleteTopic(setToDelete.id)
      setDecks(prev => prev.filter(s => s.id !== setToDelete.id))
      setSetToDelete(null)
    } catch (err) {
      console.error('Failed to delete set', err)
    }
  }

  // ── Open a deck ──
  const openDeck = async (deck: DeckInfo) => {
    try {
      const cards = await dbService.getAllCardsByTopic(deck.id)
      if (cards.length === 0) return
      setActiveDeck({ id: deck.id, title: deck.title, cards })
      applySettings(cards, settings)
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
    if (isAutoplay) setIsAutoplay(false)
    if (currentIndex < sessionCards.length - 1) {
      setCurrentIndex(i => i + 1)
      setIsFlipped(false)
      setWrittenAnswer('')
      setWrittenSubmitted(false)
      setWrittenCorrect(null)
    }
  }

  const handleFinish = async () => {
    if (isSubmitting) return
    if (isAutoplay) setIsAutoplay(false)
    
    // Save SM-2 progress for the final card before exiting
    let quality = 3
    if (settings.writtenMode && writtenSubmitted) {
      quality = writtenCorrect ? 4 : 1
    }
    await rateCard(quality)
    exitSession()
  }
  const goPrev = () => {
    if (isAutoplay) setIsAutoplay(false)
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
      if (e.key === 'Escape') {
        e.preventDefault()
        if (zoomedImage) {
          setZoomedImage(null)
          return
        }
        setShowExitConfirm(true)
        return
      }
      if (e.key === ' ' || e.code === 'Space') { 
        e.preventDefault()
        if (isAutoplay) setIsAutoplay(false)
        setIsFlipped(f => !f) 
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (isAutoplay) setIsAutoplay(false)
        setIsFlipped(f => !f)
      }
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'f' || e.key === 'F') {
        // Toggle swap term/def and reset flip so front face shows first
        stop()
        if (autoplayRef.current.timer) clearTimeout(autoplayRef.current.timer)
        autoplaySpeechDoneRef.current = null
        autoplayRef.current.isNewCard = true
        setIsAutoplay(false)
        setSettings(s => ({ ...s, swapTermDef: !s.swapTermDef }))
        setIsFlipped(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeDeck, currentIndex, sessionCards.length, isAutoplay, zoomedImage])

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
    const correct = getCorrectAnswer(currentCard, settings.swapTermDef)
    const isCorrect = writtenAnswer.trim().toLowerCase() === correct.trim().toLowerCase()
    setWrittenCorrect(isCorrect)
    setWrittenSubmitted(true)
    setWrittenStats(prev => ({ correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 }))
  }

  // ── Exit session ──
  const exitSession = () => {
    if (blocker.state === 'blocked') blocker.reset()
    setActiveDeck(null)
    setSessionCards([])
    setCurrentIndex(0)
    setIsFlipped(false)
    setShowSettings(false)
    setSettings(s => ({ ...s, bookmarkedOnly: false })) // Reset bookmark filter on exit
    setWrittenStats({ correct: 0, total: 0 })
    setShowContext(false)
    setShowToast(false)
    stop()
    // Re-fetch mastery so the deck list shows updated SM-2 progress.
    // SM-2 writes are per-card and synchronous (rateCard awaits before
    // advancing), so all writes are committed by the time we exit.
    loadDecks()
  }

  const handleGetContext = () => {
    if (!currentCard) return
    const term = getFrontText(currentCard, settings.swapTermDef)
    const definition = getCorrectAnswer(currentCard, settings.swapTermDef)
    const template = `Please explain the following Electronics Engineering flashcard concept in depth:

TERM:
${term}

DEFINITION:
${definition}

Provide a thorough explanation covering ALL of the following:

1. CONCEPT BREAKDOWN
   - What exactly is this term/concept and what does it do?
   - What are its key characteristics or properties?
   - Where and how is it used in real-world Electronics Engineering?

2. UNDERLYING PRINCIPLES
   - What fundamental laws, theorems, or principles govern this concept?
   - Include any relevant formulas, equations, or derivations.
   - Explain the units, variables, and their physical meaning.

3. BOARD EXAM CONTEXT
   - What types of questions appear on the Philippine ECE Board Exam about this?
   - What are common traps, misconceptions, or tricky variations to watch out for?
   - How does this concept connect to other topics in the exam syllabus?

4. WORKED EXAMPLE
   - Give a concrete numerical example or scenario if applicable.
   - Walk through the solution step by step.

5. MEMORY AIDS
   - Provide a mnemonic, analogy, or mental model to remember this.
   - Give a one-sentence summary that captures the essence of the concept.`
    navigator.clipboard.writeText(template).then(() => {
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    })
  }

  const handleFlashModalStart = async () => {
    const deckId = showFlashModal.deckId
    if (!deckId) return
    setShowFlashModal({ isOpen: false, deckId: null })

    const deck = decks.find(d => d.id === deckId)
    if (!deck) return

    let cards: Card[] = []
    try {
      cards = await dbService.getCardsPrioritized(deckId)
      if (cards.length === 0) return
    } catch (e) {
      console.error('[FlashcardLearn] Failed to load cards:', e)
      return
    }

    if (flashModalSettings.bookmarkedOnly) {
      const bm = loadFCBookmarks()
      cards = cards.filter(c => bm.has(`fc_bookmark_${c.id}`))
    }

    if (flashModalSettings.shuffleCards) {
      cards = shuffleArray(cards)
    }

    if (cards.length === 0) return

    // Sync modal TTS setting into the existing fcTtsEnabled state
    setFcTtsEnabled(flashModalSettings.ttsEnabled)

    // Sync swap setting into existing FCSettings
    setSettings(s => ({ ...s, swapTermDef: flashModalSettings.swappedTerms }))

    // Defer autoplay by one tick so swapTermDef/ttsEnabled are committed first
    if (flashModalSettings.autoplay) {
      setWasAutoplayed(true)
      setTimeout(() => setIsAutoplay(true), 0)
    } else {
      setWasAutoplayed(false)
      setIsAutoplay(false)
    }

    setCurrentIndex(0)
    setIsFlipped(false)
    setSessionCards(cards)
    setActiveDeck({ id: deck.id, title: deck.title, cards })

    // Initialize SM-2 session so rateCard() writes to DB
    setSessionMode('study')
    startSession(cards)
  }

  // ── Helpers ──
  const currentCard = sessionCards[currentIndex] || null

  // ── Preview handler ──
  const handlePreviewStart = async (deckId: string) => {
    const deck = decks.find(d => d.id === deckId)
    if (!deck) return
    let cards: Card[] = []
    try {
      cards = await dbService.getAllCardsByTopic(deckId)
      if (cards.length === 0) return
    } catch (e) {
      console.error('[FlashcardLearn] Failed to load preview cards:', e)
      return
    }
    setSessionMode('preview')
    setCurrentIndex(0)
    setIsFlipped(false)
    setSessionCards(cards)
    setActiveDeck({ id: deck.id, title: deck.title, cards })
    // Deliberately no startSession() call — preview never touches SM-2/progress table
  }

  // ── TTS: read front face when card changes ─────────────────────────────────
  useEffect(() => {
    if (!currentCard || !activeDeck) return
    if (isAutoplay) return
    const text = getFrontText(currentCard, settings.swapTermDef)
    setShowContext(false)
    if (text) speak(text)
  }, [currentCard?.id, settings.swapTermDef])

  // ── TTS: read face when card is flipped ──────────────────────────────────
  useEffect(() => {
    if (!currentCard || !activeDeck) return
    if (isAutoplay) return // autoplay owns TTS sequencing entirely
    if (isFlipped) {
      const correct = getCorrectAnswer(currentCard, settings.swapTermDef)
      if (correct) speak(correct)
    } else {
      const front = getFrontText(currentCard, settings.swapTermDef)
      if (front) speak(front)
    }
  }, [isFlipped])

  // ── Autoplay Sequencer ──
  useEffect(() => {
    if (autoplayRef.current.timer) clearTimeout(autoplayRef.current.timer)
    autoplaySpeechDoneRef.current = null

    if (!isAutoplay || !activeDeck || !currentCard || settings.writtenMode) return

    const index = currentIndex
    autoplayRef.current.activeIndex = index

    const isNewCard = autoplayRef.current.isNewCard
    autoplayRef.current.isNewCard = false

    if (!isFlipped) {
      autoplayRef.current.phase = 'front'
      // Wait for front TTS to finish, then wait 1s, then flip
      autoplaySpeechDoneRef.current = () => {
        if (autoplayRef.current.activeIndex !== index) return
        autoplayRef.current.timer = setTimeout(() => {
          if (autoplayRef.current.activeIndex !== index) return
          setIsFlipped(true)
        }, 2000)
      }
      const frontText = getFrontText(currentCard, settings.swapTermDef)
      speakWithCallback(frontText, () => autoplaySpeechDoneRef.current?.())
    } else {
      autoplayRef.current.phase = 'back'
      // Wait for back TTS to finish, then wait 1s (or 2s), then advance
      autoplaySpeechDoneRef.current = () => {
        if (autoplayRef.current.activeIndex !== index) return
        const delay = Math.max(flashModalSettings.autoplayDelay * 1000, 2000)
        autoplayRef.current.timer = setTimeout(async () => {
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
        }, delay)
      }
      const backText = getCorrectAnswer(currentCard, settings.swapTermDef)
      speakWithCallback(backText, () => autoplaySpeechDoneRef.current?.())
    }
  }, [isAutoplay, isFlipped, currentIndex, activeDeck, settings.swapTermDef, flashModalSettings.autoplayDelay])

  useEffect(() => {
    return () => {
      if (autoplayRef.current.timer) clearTimeout(autoplayRef.current.timer)
      autoplaySpeechDoneRef.current = null
    }
  }, [])

  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(
    () => sessionStorage.getItem('flashcard:favoritesOnly') === 'true'
  )

  useEffect(() => {
    sessionStorage.setItem('flashcard:favoritesOnly', String(favoritesOnly))
  }, [favoritesOnly])

  const handleToggleFavorite = async (deckId: string) => {
    setDecks(prev => prev.map(d => d.id === deckId ? { ...d, isFavorite: !d.isFavorite } : d))
    try {
      await window.electron.decks.toggleFavorite(deckId)
    } catch (err) {
      console.error('[FlashcardLearn] Failed to toggle favorite:', err)
      setDecks(prev => prev.map(d => d.id === deckId ? { ...d, isFavorite: !d.isFavorite } : d))
    }
  }

  useEffect(() => {
    if (!activeDeck) {
      setIsAutoplay(false)
      if (autoplayRef.current.timer) clearTimeout(autoplayRef.current.timer)
      autoplaySpeechDoneRef.current = null
    }
  }, [activeDeck])

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
    availableDecks.forEach(d => {
      const name = d.folderName || 'Uncategorized'
      const existing = folderMap.get(name) ?? Infinity
      const idx = d.order_index ?? Infinity
      folderMap.set(name, Math.min(existing, idx))
    })
    const names = [...folderMap.keys()]
      .filter(n => n !== 'Uncategorized')
      .sort((a, b) => (folderMap.get(a)! - folderMap.get(b)!))
    names.push('Uncategorized')
    return names
  }, [availableDecks])

  const deckCountByFolder = useMemo(() => {
    const acc: Record<string, number> = {}
    const uncategorized = folderRows.find(f => f.name === 'Uncategorized')
    const uncategorizedId = uncategorized?.id
    
    for (const folder of folderRows) {
      let count = 0
      if (folder.name === 'Uncategorized') {
        count = availableDecks.filter(d => d.folderId === null || d.folderId === uncategorizedId).length
      } else {
        count = availableDecks.filter(d => {
          const ids = subtreeIds(folder.id)
          return d.folderId ? ids.includes(d.folderId) : false
        }).length
      }
      acc[folder.id] = count
      acc[folder.name] = count // for legacy mode fallback
    }
    return acc
  }, [availableDecks, folderRows, subtreeIds])

  const filteredDecks = useMemo(() => {
    const folderFiltered = activeFolder === 'all'
      ? availableDecks
      : availableDecks.filter(d => {
          const ids = subtreeIds(activeFolder)
          return d.folderId ? ids.includes(d.folderId) : activeFolder === 'Uncategorized'
        })

    let result = folderFiltered.filter(d => activeSubject === 'ALL' || d.subject === activeSubject)

    if (favoritesOnly) {
      result = result.filter(d => d.isFavorite)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(d => d.title.toLowerCase().includes(q))
    }

    if (filterType !== 'all') {
      result = result.filter(d => d.deckType === filterType)
    }

    if (filterTags.length > 0) {
      result = result.filter(d => filterTags.every(tag => d.tags?.includes(tag)))
    }

    result.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'date') comparison = (a.createdAt || 0) - (b.createdAt || 0)
      else if (sortBy === 'title') comparison = a.title.localeCompare(b.title)

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return result
  }, [availableDecks, activeFolder, activeSubject, favoritesOnly, filterType, filterTags, sortBy, sortOrder, searchQuery])

  const progress = sessionCards.length > 0 ? ((currentIndex + 1) / sessionCards.length) * 100 : 0
  const isBookmarked = currentCard ? bookmarks.has(`fc_bookmark_${currentCard.id}`) : false

  // ══════════════════════════════════════════════
  // RENDER — Flashcard View Mode
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
        isBookmarked={isBookmarked}
        isSubmitting={isSubmitting}
        fcTtsEnabled={fcTtsEnabled}
        showSettings={showSettings}
        settings={settings}
        writtenAnswer={writtenAnswer}
        writtenSubmitted={writtenSubmitted}
        writtenCorrect={writtenCorrect}
        writtenStats={writtenStats}
        showContext={showContext}
        zoomedImage={zoomedImage}
        showToast={showToast}
        showExitConfirm={showExitConfirm}
        blockerState={blocker.state}
        progress={progress}
        mode={sessionMode}
        enableTTS={true}
        enableAutoplay={sessionMode === 'study'}
        onExit={handleExit}
        onBlockerProceed={() => { stop(); blocker.proceed && blocker.proceed() }}
        onBlockerReset={() => blocker.reset && blocker.reset()}
        onSetExitConfirm={setShowExitConfirm}
        onFlip={() => { if (!settings.writtenMode) { if (isAutoplay) setIsAutoplay(false); setIsFlipped(f => !f) } }}
        onToggleAutoplay={() => setIsAutoplay(prev => {
          const next = !prev
          if (next) setWasAutoplayed(true)
          return next
        })}
        onToggleTTS={() => {
          const next = !fcTtsEnabled
          setFcTtsEnabled(next)
          try { localStorage.setItem('ecengine:tts:enabled', String(next)) } catch {}
          if (!next) stop()
        }}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onSettingChange={(key) => setSettings(s => ({ ...s, [key]: !s[key] }))}
        onSwapTermDef={() => {
          stop()
          if (autoplayRef.current.timer) clearTimeout(autoplayRef.current.timer)
          autoplaySpeechDoneRef.current = null
          autoplayRef.current.isNewCard = true
          setIsFlipped(false)
          setSettings(s => ({ ...s, swapTermDef: !s.swapTermDef }))
        }}
        onBookmarkToggle={toggleBookmark}
        onWrittenChange={setWrittenAnswer}
        onWrittenSubmit={handleWrittenSubmit}
        onViewCard={() => setIsFlipped(true)}
        onZoomImage={setZoomedImage}
        onShowContext={setShowContext}
        onRateCard={sessionMode === 'preview' ? async () => {} : async (rating) => {
          await rateCard(rating)
          if (useSessionStore.getState().isFinished) { exitSession() }
        }}
        onGetContext={handleGetContext}
        onGoNext={sessionMode === 'preview' ? goNext : () => {
          const nextIdx = useSessionStore.getState().currentIndex
          if (useSessionStore.getState().isFinished) { exitSession(); return }
          setCurrentIndex(nextIdx)
          setIsFlipped(false)
          setWrittenAnswer('')
          setWrittenSubmitted(false)
          setWrittenCorrect(null)
          goNext()
        }}
        onGoPrev={goPrev}
        stop={stop}
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
          <Bookmark className="w-12 h-12 text-[var(--accent-primary)] opacity-50 mb-2" />
          <p className="text-text-muted font-['IBM_Plex_Mono'] text-lg">No cards match your current filters.</p>
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
    <FlashcardDeckBrowser
      decks={availableDecks}
      filteredDecks={filteredDecks}
      includeMCQ={includeMCQ}
      onToggleIncludeMCQ={handleToggleIncludeMCQ}
      onAddDeck={() => navigate('/add-decks?type=flashcard')}
      folders={folders}
      folderRows={folderRows}
      onCreateFolder={onCreateFolder}
      onPromoteFolder={onPromoteFolder}
      onNestFolder={onNestFolder}
      onRenameFolder={onRenameFolder}
      deckCountByFolder={deckCountByFolder}
      activeFolder={activeFolder}
      activeSubject={activeSubject}
      isLoading={isLoading}
      setToDelete={setToDelete}
      deleteCountdown={deleteCountdown}
      showAdvancedFilters={showAdvancedFilters}
      filterTags={filterTags}
      sortBy={sortBy}
      sortOrder={sortOrder}
      searchQuery={searchQuery}
      filterType={filterType}
      availableTags={availableTags}
      showFlashModal={showFlashModal}
      flashModalSettings={flashModalSettings}
      filterPopoverRef={filterPopoverRef}
      onFolderSelect={setActiveFolder}
      onSubjectSelect={setActiveSubject}
      onShowAdvancedFilters={setShowAdvancedFilters}
      onLearnDeck={(id) => setShowFlashModal({ isOpen: true, deckId: id })}
      onPreviewDeck={handlePreviewStart}
      onEditDeck={(id) => {
        sessionStorage.setItem('ecengine:returnScroll:/flashcards', String(window.scrollY))
        navigate(`/edit-deck/${id}?returnTo=/flashcards`)
      }}
      onDeleteDeck={setSetToDelete}
      onPrintDeck={(id, title) => window.electron.print.open(id, title)}
      onConfirmDelete={handleConfirmDelete}
      onCancelDelete={() => setSetToDelete(null)}
      onDeleteFolder={handleDeleteFolder}
      onReorderFolders={handleReorderFolders}
      onFlashModalSettingsChange={setFlashModalSettings}
      onFlashModalStart={handleFlashModalStart}
      onFlashModalClose={() => setShowFlashModal({ isOpen: false, deckId: null })}
      setSearchQuery={setSearchQuery}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      setFilterType={setFilterType}
      setFilterTags={setFilterTags}
      favoritesOnly={favoritesOnly}
      setFavoritesOnly={setFavoritesOnly}
      onToggleFavorite={handleToggleFavorite}
    />
  )
}
