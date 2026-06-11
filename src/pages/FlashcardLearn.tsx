import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import FolderPanel from '@/components/ui/FolderPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate, useBlocker } from 'react-router-dom'
import { Layers, Bookmark, Settings2, X, ArrowLeft, ArrowRight, RotateCcw, Shuffle, PenLine, Check, XCircle, SlidersHorizontal, Pencil, Play, Pause, Trash2, AlertTriangle, Trophy, ScrollText, Search, Volume2, VolumeX, Copy, Sparkles } from 'lucide-react'
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal'
import { FlashCardSettingsModal, FlashCardSettings, FLASH_SETTINGS_DEFAULTS, loadFlashTTSPreference } from '../components/flashcard/FlashCardSettingsModal'
import type { Card, CardData, CardType } from '../types'
import { getSubjectFilterClasses, getSubjectBadgeClasses, SUBJECT_MAP } from '../lib/subjectColors'
import { TOS_SUBJECT_COLORS } from '../lib/tosData'
import { Card as CardLegacy, MCQData, FlashcardData } from '../types'
import type { FormulaData } from '../types'
import { renderMath } from '../lib/latex'
import { shuffleArray } from '../lib/utils'
import { dbService } from '../services/db.service'
import { useTTS } from '../hooks/useTTS'
import { useIdleAwareTimer } from '../hooks/useIdleAwareTimer'
import { FlashcardContextPanel } from '../components/flashcard/FlashcardContextPanel'
import { getDynamicFontSize } from '../lib/textUtils'
import { useSessionStore } from '../store/useSessionStore'



type Subject = 'MATH' | 'GEAS' | 'ELECS' | 'EST'
type FilterSubject = 'ALL' | Subject

const SUBJECTS: FilterSubject[] = ['ALL', 'MATH', 'GEAS', 'ELECS', 'EST']



interface DeckInfo {
  id: string
  title: string
  subject: Subject
  cardCount: number
  deckType: 'mcq' | 'flashcard' | 'mixed'
  description: string
  tags?: string[]
  createdAt?: number
  folderName?: string
  order_index?: number
  mastery?: number
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
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'flashcard' | 'mixed'>('flashcard')
  const [activeFolder, setActiveFolder] = useState<string | 'all'>('all')
  const filterPopoverRef = useRef<HTMLDivElement>(null)

  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    decks.forEach(d => d.tags?.forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [decks])

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
            order_index: row.order_index
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
  }, [activeDeck, currentIndex, sessionCards.length, isAutoplay])

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
  }

  const handleGetContext = () => {
    if (!currentCard) return
    const term = getFrontText(currentCard)
    const definition = getCorrectAnswer(currentCard)
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
      setTimeout(() => setIsAutoplay(true), 0)
    } else {
      setIsAutoplay(false)
    }

    setCurrentIndex(0)
    setIsFlipped(false)
    setSessionCards(cards)
    setActiveDeck({ id: deck.id, title: deck.title, cards })

    // Initialize SM-2 session so rateCard() writes to DB
    startSession(cards)
  }

  // ── Helpers ──
  const currentCard = sessionCards[currentIndex] || null

  function getFrontText(card: Card): string {
    if (card.type === 'mcq') {
      const mcq = card.data as MCQData
      return settings.swapTermDef ? mcq.choices[mcq.answer] : mcq.question
    }
    if (card.type === 'formula') {
      const f = card.data as FormulaData
      const frontStr = f.name + (f.latex ? `\n\n$$${f.latex}$$` : '')
      const backStr = [f.description, f.variables].filter(Boolean).join('\n\n')
      return settings.swapTermDef ? backStr : frontStr
    }
    return settings.swapTermDef ? (card.data as FlashcardData).back : (card.data as FlashcardData).front
  }

  function getBackContent(card: Card): React.ReactNode {
    if (card.type === 'mcq') {
      const mcq = card.data as MCQData
      const text = settings.swapTermDef ? mcq.question : mcq.choices[mcq.answer]
      return <div className={`${getDynamicFontSize(text)} leading-relaxed font-['Rajdhani'] font-bold text-[#E8E8E8]`} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />
    }
    if (card.type === 'formula') {
      const f = card.data as FormulaData
      const frontStr = f.name + (f.latex ? `\n\n$$${f.latex}$$` : '')
      const backStr = [f.description, f.variables].filter(Boolean).join('\n\n')
      const text = settings.swapTermDef ? frontStr : backStr
      return <div className={`leading-relaxed ${getDynamicFontSize(text)} font-['Rajdhani'] font-bold text-[#E8E8E8]`} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />
    }
    const fc = card.data as FlashcardData
    const text = settings.swapTermDef ? fc.front : fc.back
    return <div className={`${getDynamicFontSize(text)} font-['Rajdhani'] font-bold leading-relaxed text-[#E8E8E8]`} dangerouslySetInnerHTML={{ __html: renderMath(text) }} />
  }

  function getCorrectAnswer(card: Card): string {
    if (card.type === 'mcq') {
      const mcq = card.data as MCQData
      return settings.swapTermDef ? mcq.question : mcq.choices[mcq.answer]
    }
    if (card.type === 'formula') {
      const f = card.data as FormulaData
      const frontStr = f.name + (f.latex ? `\n\n$$${f.latex}$$` : '')
      const backStr = [f.description, f.variables].filter(Boolean).join('\n\n')
      return settings.swapTermDef ? frontStr : backStr
    }
    const fc = card.data as FlashcardData
    return settings.swapTermDef ? fc.front : fc.back
  }

  // ── TTS: read front face when card changes ─────────────────────────────────
  useEffect(() => {
    if (!currentCard || !activeDeck) return
    if (isAutoplay) return
    const text = getFrontText(currentCard)
    setShowContext(false)
    if (text) speak(text)
  }, [currentCard?.id, settings.swapTermDef])

  // ── TTS: read face when card is flipped ──────────────────────────────────
  useEffect(() => {
    if (!currentCard || !activeDeck) return
    if (isAutoplay) return // autoplay owns TTS sequencing entirely
    if (isFlipped) {
      const correct = getCorrectAnswer(currentCard)
      if (correct) speak(correct)
    } else {
      const front = getFrontText(currentCard)
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
      const frontText = getFrontText(currentCard)
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
          }
        }, delay)
      }
      const backText = getCorrectAnswer(currentCard)
      speakWithCallback(backText, () => autoplaySpeechDoneRef.current?.())
    }
  }, [isAutoplay, isFlipped, currentIndex, activeDeck, settings.swapTermDef, flashModalSettings.autoplayDelay])

  useEffect(() => {
    return () => {
      if (autoplayRef.current.timer) clearTimeout(autoplayRef.current.timer)
      autoplaySpeechDoneRef.current = null
    }
  }, [])

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
    decks.forEach(d => {
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
  }, [decks])

  const deckCountByFolder = useMemo(() =>
    folders.reduce((acc, f) => ({
      ...acc,
      [f]: decks.filter(d =>
        (d.folderName || 'Uncategorized') === f
      ).length
    }), {} as Record<string, number>)
    , [decks, folders])

  const filteredDecks = useMemo(() => {
    const folderFiltered = activeFolder === 'all'
      ? decks
      : decks.filter(d => (d.folderName || 'Uncategorized') === activeFolder)

    let result = folderFiltered.filter(d => activeSubject === 'ALL' || d.subject === activeSubject)

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
  }, [decks, activeFolder, activeSubject, filterType, filterTags, sortBy, sortOrder, searchQuery])

  const progress = sessionCards.length > 0 ? ((currentIndex + 1) / sessionCards.length) * 100 : 0
  const isBookmarked = currentCard ? bookmarks.has(`fc_bookmark_${currentCard.id}`) : false

  // ══════════════════════════════════════════════
  // RENDER — Flashcard View Mode
  // ══════════════════════════════════════════════
  if (activeDeck && currentCard) {
    return (
      <div className="h-full bg-[#0D0D0D] flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <div className="shrink-0 bg-[#111] border-b border-[#222] px-6 py-4 flex items-center justify-between z-20">
          <LeaveConfirmModal
            isOpen={blocker.state === 'blocked' || showExitConfirm}
            onConfirm={() => {
              if (blocker.state === 'blocked') {
                stop()
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
          <div className="flex items-center gap-4">
            <button onClick={() => setShowExitConfirm(true)} className="text-[#888] hover:text-white transition-colors p-2 rounded hover:bg-[#222]" title="Exit">
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <span className="text-[var(--accent-primary)] font-['Rajdhani'] font-bold tracking-widest text-base uppercase">{activeDeck.title}</span>
              <span className="text-[#E8E8E8] text-xs font-['Rajdhani'] font-bold uppercase tracking-widest">Card {currentIndex + 1} of {sessionCards.length}</span>
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
              onClick={() => {
                stop()
                if (autoplayRef.current.timer) clearTimeout(autoplayRef.current.timer)
                autoplaySpeechDoneRef.current = null
                autoplayRef.current.isNewCard = true
                setIsFlipped(false)
                setSettings(s => ({ ...s, swapTermDef: !s.swapTermDef }))
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${settings.swapTermDef
                ? 'bg-[#00FF41]/20 text-[#00FF41] border-[#00FF41]'
                : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:border-[#555] hover:text-[#E8E8E8]'
                }`}
              title="Swap Term / Definition (Shortcut: F)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {settings.swapTermDef ? 'SWAPPED' : 'SWAP'}
            </button>
            {!settings.writtenMode && (
              <button
                onClick={() => setIsAutoplay(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${isAutoplay
                  ? 'bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41] shadow-[0_0_8px_rgba(0,255,65,0.3)]'
                  : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:border-[#555] hover:text-[#E8E8E8]'
                  }`}
                title="Autoplay"
              >
                {isAutoplay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                AUTO
              </button>
            )}
            <button
              onClick={() => {
                const next = !fcTtsEnabled
                setFcTtsEnabled(next)
                try { localStorage.setItem('ecengine:tts:enabled', String(next)) } catch { }
                if (!next) stop()
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${fcTtsEnabled ? 'border-[#00FF41] text-[#00FF41] bg-[#00FF41]/10' : 'border-[#333] text-[#888] hover:text-[#E8E8E8] hover:border-[#555]'}`}
              title={fcTtsEnabled ? 'TTS On — click to disable' : 'TTS Off — click to enable'}
            >
              {fcTtsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-widest border transition-all ${showSettings ? 'bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]' : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:border-[#555] hover:text-[#E8E8E8]'}`}
              title="Settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
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
                    className={`px-4 py-2 rounded-lg text-sm font-['Rajdhani'] font-bold tracking-widest uppercase transition-all border ${settings[opt.key]
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

        {/* Card Area — single centered column, card + buttons + AI panel stacked together */}
        <div className="flex-1 flex items-center justify-center min-h-0 px-6 lg:px-10 py-4 overflow-y-auto">
          <div className="w-full max-w-3xl flex flex-col gap-4">

            <AnimatePresence mode="wait">
                <motion.div key={`${currentCard.id}-${currentIndex}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                  {/* 3D Flip Card Container */}
                  <div 
                    className="w-full cursor-pointer" 
                    style={{ perspective: '1200px', minHeight: '350px' }}
                    onClick={() => {
                      if (!settings.writtenMode) {
                        if (isAutoplay) setIsAutoplay(false)
                        setIsFlipped(f => !f)
                      }
                    }}
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
                        <button onClick={(e) => { e.stopPropagation(); toggleBookmark(currentCard.id) }} className="absolute top-5 right-5 z-10 text-[#666] hover:text-[#FFB800] transition-colors" title="Bookmark">
                          <Bookmark className={`w-6 h-6 ${isBookmarked ? 'fill-[#FFB800] text-[#FFB800]' : ''}`} />
                        </button>

                        {/* Card Label */}
                        <div className="px-8 pt-6 pb-2">
                          <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">
                            {settings.swapTermDef ? 'Definition' : 'Term'}
                          </span>
                        </div>

                        {/* Front Content */}
                        <div className="flex-1 flex items-center justify-center px-8 pb-8">
                          <div className="text-center w-full">
                            <div className={`${getDynamicFontSize(getFrontText(currentCard))} font-['Rajdhani'] font-bold text-[#E8E8E8] leading-relaxed`} dangerouslySetInnerHTML={{ __html: renderMath(getFrontText(currentCard)) }} />
                            {currentCard.data.imagePath && (
                              <div className="mt-4 w-full h-auto max-h-[300px] flex justify-center overflow-hidden rounded-lg border border-[#333] shadow-lg hover:border-[#00FF41] transition-all">
                                <img
                                  src={`ece-app://${currentCard.data.imagePath}`}
                                  alt="Card diagram"
                                  className="w-full h-full max-h-[300px] object-contain cursor-zoom-in"
                                  onClick={(e) => { e.stopPropagation(); setZoomedImage(currentCard.data.imagePath!); }}
                                />
                              </div>
                            )}
                            {!settings.writtenMode && <p className="text-[#555] text-sm mt-6 font-['Rajdhani']">Click or press Space to flip</p>}
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
                            {settings.swapTermDef ? 'Term' : 'Definition'}
                          </span>
                        </div>

                        {/* Back Content */}
                        <div className="flex-1 flex items-center justify-center px-8 pb-8">
                          <div className="text-center w-full text-[#E8E8E8]">
                            {getBackContent(currentCard)}
                          </div>
                        </div>
                      </div>
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
                </motion.div>
            </AnimatePresence>

            {/* Rating row — opacity toggle, no layout shift */}
            <div className="h-[84px] flex items-center justify-center w-full">
              <div className={`flex gap-3 transition-opacity duration-150 ${(isFlipped || (settings.writtenMode && writtenSubmitted)) && !isAutoplay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                {[
                  { rating: 1, label: 'Again', sub: '< 1m', hint: 'Wrong or blank',         color: '#FF3333' },
                  { rating: 2, label: 'Hard',  sub: '~5m',  hint: 'Right but struggled',    color: '#FFB800' },
                  { rating: 3, label: 'Good',  sub: '~10m', hint: 'Right with some effort', color: '#00FF41' },
                  { rating: 4, label: 'Easy',  sub: '4d+',  hint: 'Instant recall',         color: '#00BFFF' },
                ].map(({ rating, label, sub, hint, color }) => (
                  <button
                    key={rating}
                    onClick={async () => {
                      await rateCard(rating)
                      const nextIdx = useSessionStore.getState().currentIndex
                      if (useSessionStore.getState().isFinished) { exitSession(); return }
                      setCurrentIndex(nextIdx)
                      setIsFlipped(false)
                      setWrittenAnswer('')
                      setWrittenSubmitted(false)
                      setWrittenCorrect(null)
                    }}
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#111] border rounded transition-colors flex flex-col items-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#161616]"
                    style={{ borderColor: color, color }}
                  >
                    <span className="font-['Rajdhani'] font-bold text-lg mb-0.5">{label}</span>
                    <span className="text-xs text-[#888]">{sub}</span>
                    <span className="text-[10px] text-[#555] mt-0.5 font-['IBM_Plex_Mono']">{hint}</span>
                  </button>
                ))}
                {isSubmitting && (
                  <div className="self-center ml-2 flex items-center gap-2 text-[#888] text-xs font-['Rajdhani'] animate-pulse">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Saving…
                  </div>
                )}
              </div>
            </div>

            {/* Utility row — opacity toggle, no layout shift */}
            <div className="h-[40px] flex items-center justify-center gap-3 w-full">
              <div className={`flex items-center gap-3 transition-opacity duration-150 ${(isFlipped || (settings.writtenMode && writtenSubmitted)) && !isAutoplay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <button onClick={goPrev} disabled={currentIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#333] rounded text-[#888] font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[#222] hover:border-[#555] transition-all disabled:opacity-30 disabled:cursor-default text-xs">
                  <ArrowLeft className="w-3 h-3" /> Prev
                </button>
                <button onClick={handleGetContext}
                  className="flex items-center gap-2 px-4 py-2 border border-[rgba(255,255,255,0.3)] rounded text-[#CCCCCC] hover:text-white hover:border-[#888] transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs">
                  <Copy className="w-3.5 h-3.5" /> Get Context
                </button>
                <button onClick={() => setShowContext(c => !c)}
                  className="flex items-center gap-2 px-4 py-2 border border-[rgba(0,255,65,0.3)] rounded text-[#00FF41] hover:bg-[rgba(0,255,65,0.08)] hover:border-[#00FF41] transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs">
                  <Sparkles className="w-3.5 h-3.5" /> Explain
                </button>
                <button onClick={goNext} disabled={currentIndex === sessionCards.length - 1}
                  className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#333] rounded text-[#888] font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[#222] hover:border-[#555] transition-all disabled:opacity-30 disabled:cursor-default text-xs">
                  Skip <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* AI Context Panel — below buttons */}
            {showContext && isFlipped && currentCard && !settings.writtenMode && (() => {
              const term = getFrontText(currentCard)
              const definition = getCorrectAnswer(currentCard)
              return <FlashcardContextPanel term={term} definition={definition} onClose={() => setShowContext(false)} />
            })()}

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

        {/* Clipboard toast */}
        {showToast && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-[#1a1a1a] border border-[#333] text-[#E8E8E8] text-xs font-['Rajdhani'] uppercase tracking-widest px-5 py-3 rounded-lg shadow-2xl whitespace-nowrap">
            Context copied — paste into Gemini, ChatGPT, or Claude
          </div>
        )}
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
            onClick={handleExit}
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
  const handleDeleteFolder = async (folderName: string) => {
    const result = await dbService.updateDecksFolder(folderName, 'Uncategorized')
    if (result.success) {
      await loadDecks()
    }
  }

  const handleReorderFolders = async (newOrder: string[]) => {
    const folderOrders = newOrder.map((folderName, index) => ({
      folderName,
      orderIndex: index,
    }))
    const result = await dbService.updateFolderOrder(folderOrders)
    if (result.success) {
      await loadDecks()
    }
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-row flex-1 w-full overflow-hidden">
        <FolderPanel
          folders={folders}
          deckCountByFolder={deckCountByFolder}
          totalDeckCount={decks.length}
          selected={activeFolder}
          onSelect={setActiveFolder}
          onDeleteFolder={handleDeleteFolder}
          onReorderFolders={handleReorderFolders}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto show-scrollbar">
          {/* Header centered above decks */}
          <div className="flex flex-col items-center w-full pt-6 pb-0 px-6">
            <div className="w-full max-w-5xl flex flex-col items-center justify-center gap-6 mb-2 border-b border-[var(--bg-card)] pb-4 pt-4 relative z-30">
              <h1 className="text-2xl lg:text-3xl font-['Orbitron'] text-[var(--text-primary)] tracking-wider font-bold flex items-center gap-4 uppercase">
                <Layers className="text-[var(--accent-primary)]" size={28} />
                FLASH<span className="text-[var(--accent-primary)]">CARDS</span>
              </h1>

              <div className="flex items-center justify-center flex-wrap gap-2 w-full bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--bg-card)] no-scrollbar px-1">
                <div className="relative shrink-0" ref={filterPopoverRef}>
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`p-2 rounded-lg border transition-all ${showAdvancedFilters || filterTags.length > 0 || filterType !== 'flashcard' || sortBy !== 'date' || sortOrder !== 'desc' || searchQuery
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
                        className="absolute left-0 mt-2 w-72 bg-[#111] border border-[#333] rounded-lg shadow-2xl p-4 z-50 flex flex-col gap-4"
                      >
                        <div className="flex justify-between items-center pb-2 border-b border-[#333]">
                          <span className="font-['Rajdhani'] font-bold text-sm tracking-widest uppercase text-[#00FF41]">Filters & Sort</span>
                          <button onClick={() => setShowAdvancedFilters(false)} className="text-[#888] hover:text-[#E8E8E8]">
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
                            className="w-full bg-[#1A1A1A] border border-[#333] focus:border-[#00FF41] rounded-lg py-2 pl-9 pr-3 text-sm text-[#E8E8E8] placeholder-[#555] outline-none transition-colors font-['IBM_Plex_Mono']"
                          />
                        </div>

                        {/* Sort Selection */}
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-['Rajdhani'] tracking-widest text-[#888] uppercase">Sort By</label>
                            <div className="flex bg-[#1A1A1A] rounded overflow-hidden border border-[#333]">
                              {(['asc', 'desc'] as const).map(order => (
                                <button
                                  key={order}
                                  onClick={() => setSortOrder(order)}
                                  className={`px-2 py-0.5 text-[10px] font-['Rajdhani'] uppercase tracking-widest transition-colors ${sortOrder === order ? 'bg-[#00FF41] text-black font-bold' : 'text-[#888] hover:text-[#E8E8E8]'}`}
                                >
                                  {order}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {(['date', 'title'] as const).map(opt => (
                              <button
                                key={opt}
                                onClick={() => setSortBy(opt)}
                                className={`text-xs py-1.5 rounded transition-colors uppercase font-['Rajdhani'] tracking-wider ${sortBy === opt ? 'bg-[#00FF41]/20 text-[#00FF41] font-bold' : 'bg-[#1A1A1A] text-[#888] hover:bg-[#222]'
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
                                className={`text-xs py-1.5 rounded transition-colors uppercase font-['Rajdhani'] tracking-wider ${filterType === opt ? 'bg-[#00FF41]/20 text-[#00FF41] font-bold' : 'bg-[#1A1A1A] text-[#888] hover:bg-[#222]'
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
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-['Rajdhani'] uppercase tracking-wider border transition-all ${isActive
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
                        {(filterTags.length > 0 || filterType !== 'flashcard' || sortBy !== 'date') && (
                          <button
                            onClick={() => {
                              setFilterTags([])
                              setFilterType('flashcard')
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
                  <Trophy className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Test Mode
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-0 pb-4">
                  {filteredDecks.map(deck => (
                    <div
                      key={deck.id}
                      className="relative isolate group transition-all duration-300 border border-[#333] bg-[#1a1a1a] p-5 flex flex-col w-full min-h-[180px] justify-between hover:-translate-x-[6px] hover:-translate-y-[6px] rounded-xl before:absolute before:w-full before:h-full before:top-0 before:left-0 before:bg-[#1a1a1a] before:border before:border-[#333] before:rounded-xl before:translate-x-[6px] before:translate-y-[6px] before:z-[-1] before:transition-transform before:duration-300 group-hover:before:translate-x-[12px] group-hover:before:translate-y-[12px] after:absolute after:w-full after:h-full after:top-0 after:left-0 after:bg-[#1a1a1a] after:border after:border-[#333] after:rounded-xl after:translate-x-[12px] after:translate-y-[12px] after:z-[-2] after:transition-transform after:duration-300 group-hover:after:translate-x-[18px] group-hover:after:translate-y-[18px]"
                    >
                      {/* Top Section: Title & Stats Stack */}
                      <div className="flex justify-between items-start gap-4">
                        {/* Left Column: Title & Tags */}
                        <div className="flex-1 min-w-0 flex flex-col gap-3">
                          {/* Title Row */}
                          <div className="flex items-center gap-3">
                            <span className={`w-[58px] flex justify-center py-0.5 rounded border border-[#333] bg-[#111] uppercase font-rajdhani font-bold tracking-widest text-[10px] shrink-0 ${getSubjectBadgeClasses(deck.subject)}`}>
                              {deck.subject}
                            </span>
                            <h3 className="text-lg font-bold font-rajdhani tracking-wide text-[#E8E8E8] uppercase truncate flex-1">
                              {deck.title}
                            </h3>
                          </div>
                          {/* Tag Row: Type & Custom Tags (Aligned with Date) */}
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="px-2 py-0.5 rounded border border-[#333] bg-transparent text-gray-400 uppercase font-bold tracking-wider text-[10px]">
                              {deck.deckType === 'mixed' ? 'MIX' : deck.deckType === 'mcq' ? 'MCQ' : 'FC'}
                            </span>
                            {deck.tags && deck.tags.length > 0 && deck.tags.map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded border border-[#333] bg-transparent text-gray-400 uppercase font-bold tracking-wider text-[10px]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Right Column: Administrative Info */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {/* Items Tag */}
                          <span className="w-[58px] flex justify-center py-0.5 rounded border border-[#333] bg-[#111] text-[#E8E8E8] font-rajdhani font-bold tracking-widest text-[10px] shrink-0 uppercase whitespace-nowrap">
                            {deck.cardCount} ITEMS
                          </span>
                          {/* Date String */}
                          <span className="text-[10px] text-gray-500 uppercase font-['IBM_Plex_Mono'] tracking-widest">
                            {deck.createdAt ? new Date(deck.createdAt * 1000).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase() : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Deck Description */}
                      {deck.description && deck.description.trim() !== "" && (
                        <p className="text-[11px] text-gray-400 font-['IBM_Plex_Mono'] leading-relaxed mt-2 line-clamp-2 uppercase pr-4">
                          {deck.description}
                        </p>
                      )}

                      {/* Bottom Row: Progress and Actions */}
                      <div className="flex items-center gap-6 w-full mt-4">
                        {/* MASTERY label — fixed, does not grow */}
                        <span className="text-[10px] font-rajdhani tracking-widest uppercase text-gray-500 shrink-0">
                          Mastery
                        </span>

                        {/* Mastery bar — flex-1 so it fills all remaining space */}
                        <div className="flex-1 bg-[#111] h-1 rounded-full overflow-hidden min-w-[40px]">
                          <div
                            className="h-full bg-[#00FF41] shadow-[0_0_8px_rgba(0,255,65,0.4)] transition-all duration-500"
                            style={{ width: `${deck.mastery ?? 0}%` }}
                          />
                        </div>

                        {/* Mastery percentage — fixed, does not grow */}
                        <span className="text-[#00FF41] font-bold text-[10px] font-rajdhani shrink-0">
                          {deck.mastery ?? 0}%
                        </span>

                        {/* Divider */}
                        <div className="h-4 w-px bg-slate-800 shrink-0" />

                        {/* Secondary Action Icons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* LEARN button — sits right after the percentage, no gap */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowFlashModal({ isOpen: true, deckId: deck.id }); }}
                            className="py-2 px-3 bg-[#111] border border-[#333] hover:border-[#00FF41] hover:text-[#00FF41] text-[#E8E8E8] rounded transition-colors font-rajdhani tracking-widest uppercase text-xs font-bold flex items-center justify-center gap-2"
                            title="Learn this deck"
                            aria-label="Learn"
                          >
                            <Play className="w-3 h-3" />
                            <span className="hidden xl:inline">Learn</span>
                          </button>

                          {deck.id.startsWith('topic_') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                window.electron.print.open(deck.id, deck.title)
                              }}
                              className="p-2 bg-[#111] border border-[#333] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] text-gray-400 rounded transition-colors"
                              title="Test Paper View"
                            >
                              <ScrollText className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/edit-deck/${deck.id}`) }}
                            className="p-2 bg-[#111] border border-[#333] hover:border-[#555] text-gray-400 hover:text-white rounded transition-colors"
                            title="Edit Deck"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSetToDelete(deck); }}
                            className="p-2 bg-[#111] border border-[#333] hover:border-red-500/50 text-gray-500 hover:text-red-500 rounded transition-colors"
                            title="Delete Set"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {isLoading ? (
                  <div className="text-center py-20 text-[#555] font-['IBM_Plex_Mono'] text-sm tracking-widest animate-pulse">
                    Loading decks...
                  </div>
                ) : filteredDecks.length === 0 ? (
                  <div className="text-center py-20 text-[#888] font-rajdhani uppercase tracking-widest text-lg">
                    No decks found{activeSubject !== 'ALL' ? ` for ${activeSubject}` : ''}. Import some from Add Decks.
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
                    <p className="text-[#888] font-['IBM_Plex_Mono'] mb-8 leading-relaxed">
                      Are you absolutely sure you want to delete <strong className="text-white">{setToDelete.title}</strong>? This action cannot be undone and will permanently remove all {setToDelete.cardCount} items in this set.
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                      <button
                        onClick={handleConfirmDelete}
                        disabled={deleteCountdown > 0}
                        className="w-full py-4 bg-[#FF003C] hover:bg-[#D00030] disabled:bg-[#1A1A1A] disabled:text-[#444] disabled:cursor-not-allowed text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,0,60,0.2)] hover:shadow-[0_0_25px_rgba(255,0,60,0.4)]"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setSetToDelete(null)}
                        className="w-full py-4 bg-[#1A1A1A] border border-[#333] hover:border-[#555] text-[#888] hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
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
      <FlashCardSettingsModal
        isOpen={showFlashModal.isOpen}
        setId={showFlashModal.deckId}
        settings={flashModalSettings}
        allSets={decks.map(d => ({ id: d.id, count: d.cardCount }))}
        onSettingsChange={setFlashModalSettings}
        onStart={handleFlashModalStart}
        onClose={() => setShowFlashModal({ isOpen: false, deckId: null })}
      />
    </div>
  )
}
