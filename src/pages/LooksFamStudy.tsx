import React, { useState, useEffect, useMemo, useRef } from 'react'
import FolderPanel from '@/components/ui/FolderPanel'
import { useFolderState } from '../hooks/useFolderState'
import { useNavigate, useBlocker } from 'react-router-dom'
import { FlashDeck } from '../components/flashcard/FlashDeck'
import { MCQDeck } from '../components/mcq/MCQDeck'
import { LearnMode } from '../components/mcq/LearnMode'
import { TestMode } from '../components/mcq/TestMode'
import { LearnSettingsModal, LearnSettings, loadTTSPreference } from '../components/mcq/LearnSettingsModal'
import { TestSettingsModal, TestSettings } from '../components/mcq/TestSettingsModal'
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal'
import { MOCK_FLASHCARDS, MOCK_MCQS } from '../lib/mockData'
import { Play, Bookmark, X, Trash2, AlertTriangle, ClipboardList, SlidersHorizontal, Check, Pencil, Brain, Trophy, ScrollText, Search, Plus } from 'lucide-react'
import { getSubjectFilterClasses, getSubjectBadgeClasses, SUBJECT_MAP } from '../lib/subjectColors'
import { TOS_SUBJECT_COLORS } from '../lib/tosData'
import { useSessionStore } from '../store/useSessionStore'
import { motion, AnimatePresence } from 'framer-motion'
import { shuffle, shuffleChoices, isSafeToShuffleChoices } from '../lib/scrambler'
import { useIdleAwareTimer } from '../hooks/useIdleAwareTimer'

import { StudyHeader } from '../components/study/StudyHeader'
import { StudySessionStats } from '../components/study/StudySessionStats'
import { dbService } from '../services/db.service'
import { weightedSample } from '../lib/sampling'
import { DeckGrid } from '../components/deck/DeckGrid'
import { Tooltip } from '../components/ui/Tooltip'
import { PREDEFINED_TAGS } from '../lib/constants'
import { BookmarkedCardsModal } from '../components/mcq/BookmarkedCardsModal'



type StudyMode = 'flashcard' | 'mcq' | 'learn' | 'test'
type Subject = 'ALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST'

const SUBJECTS: Subject[] = ['ALL', 'MATH', 'GEAS', 'ELECS', 'EST']

// Map full subject names (from DB) to short codes used in the UI


interface StudySet {
  id: string
  title: string
  description: string
  subject: Subject
  count: number
  mastery: number
  deckType?: 'mcq' | 'flashcard' | 'mixed'
  tags?: string[]
  createdAt?: number
  folderName?: string
  folderId?: string
  order_index?: number
}

// In-memory cache to prevent layout pop-in on re-navigation
let studySetsCache: StudySet[] | null = null

export default function LooksFamStudy() {
  const navigate = useNavigate()

  const [allSets, setAllSets] = useState<StudySet[]>(() => studySetsCache ?? [])
  const [isLoading, setIsLoading] = useState(() => !studySetsCache)
  const [setToDelete, setSetToDelete] = useState<StudySet | null>(null)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  // ── Bookmarks ────────────────────────────────────────────────────────────────
  // Global bookmark set kept in sync with localStorage so the button visibility
  // updates live whenever the modal changes bookmarks.
  const readBookmarks = () => {
    try {
      const saved = localStorage.getItem('bookmarkedIds')
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>()
    } catch { return new Set<string>() }
  }
  const [globalBookmarks, setGlobalBookmarks] = useState<Set<string>>(readBookmarks)
  // Cache: topicId → card IDs loaded from DB (just IDs, not full data)
  const [topicCardIds, setTopicCardIds] = useState<Record<string, string[]>>({})
  // Which deck's bookmark modal is currently open
  const [bookmarkModalDeck, setBookmarkModalDeck] = useState<StudySet | null>(null)

  // Advanced Filters State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'mastery'>('date')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'flashcard' | 'mixed'>('all')
  const filterPopoverRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const availableTags = useMemo(() => {
    const tags = new Set<string>(PREDEFINED_TAGS)
    allSets.forEach(s => s.tags?.forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [allSets])

  // Load user-created sets from DB
  const loadDBSets = async () => {
    try {
      let dbSets: StudySet[] = []

      const topicsResult = await window.electron.decks.getTopicsWithCardCounts()
      if (topicsResult.success && topicsResult.data) {
        dbSets = topicsResult.data.map((row: any) => {
          const types = (row.types || '').split(',').filter(Boolean)

          // Skip formula-only decks or empty decks
          if (types.length === 0 || (types.length === 1 && types[0] === 'formula')) return null

          let deckType: 'mcq' | 'flashcard' | 'mixed' = 'mcq'
          if (types.includes('mcq') && types.includes('flashcard')) deckType = 'mixed'
          else if (types.includes('flashcard')) deckType = 'flashcard'

          const mastery = 0; // DB-based progress handles mastery calculation in the service layer

          let parsedTags: string[] = []
          try {
            if (row.tags) parsedTags = JSON.parse(row.tags)
          } catch (e) { }

          return {
            id: row.id,
            title: row.name,
            description: row.description || '',
            subject: SUBJECT_MAP[row.subject] || 'ELECS',
            count: row.card_count || 0,
            mastery,
            deckType,
            tags: parsedTags,
            createdAt: row.created_at || Date.now(),
            folderName: row.folder_name || 'Uncategorized',
            folderId: row.folder_id || null,
            order_index: row.order_index
          }
        }).filter((s: StudySet | null): s is StudySet => s !== null)
      }

      // Load mastery percentages and merge into sets
      try {
        const masteryResult = await window.electron.decks.getFormulaMastery()
        if (masteryResult.success && masteryResult.data) {
          const masteryMap = new Map<string, number>()
          for (const row of masteryResult.data) {
            const pct = row.mastery != null ? Math.round(row.mastery * 100) : 0
            masteryMap.set(row.topic_id, pct)
          }
          dbSets = dbSets.map(s => ({
            ...s,
            mastery: masteryMap.get(s.id) ?? 0,
          }))
        }
      } catch (e) {
        console.warn('[LooksFamStudy] Failed to load mastery:', e)
      }

      setAllSets(prev => {
        const nonDb = prev.filter(s => !s.id.startsWith('topic_'));
        const next = [...nonDb, ...dbSets];
        studySetsCache = next;
        return next;
      })

      // ── Background: load card IDs for all topics so we can show bookmark counts ──
      // Fire all in parallel; only store IDs (not full data) to keep it cheap.
      dbSets.forEach(async (s) => {
        if (!s.id.startsWith('topic_')) return
        try {
          const res = await window.electron.data.getCards(s.id)
          const rows: any[] = res?.data || []
          if (rows.length > 0) {
            setTopicCardIds(prev => ({ ...prev, [s.id]: rows.map((c: any) => c.id) }))
          }
        } catch { /* non-fatal */ }
      })
    } catch (err) {
      console.error('Failed to load DB sets', err)
    } finally {
      setIsLoading(false)
    }
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
  } = useFolderState(loadDBSets, 'study')

  useEffect(() => {
    loadDBSets()
  }, [])

  useEffect(() => {
    const saved = sessionStorage.getItem('ecengine:returnScroll:/study')
    if (saved) {
      window.scrollTo(0, parseInt(saved, 10))
      sessionStorage.removeItem('ecengine:returnScroll:/study')
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setShowAdvancedFilters(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [activeSubject, setActiveSubject] = useState<Subject>(
    () => (sessionStorage.getItem('looksfam:activeSubject') as Subject) ?? 'ALL'
  )

  useEffect(() => {
    sessionStorage.setItem('looksfam:activeSubject', activeSubject)
  }, [activeSubject])
  const [activeFolder, setActiveFolder] = useState<string | 'all'>(
    () => sessionStorage.getItem('looksfam:activeFolder') ?? 'all'
  )

  useEffect(() => {
    sessionStorage.setItem('looksfam:activeFolder', activeFolder)
  }, [activeFolder])

  useEffect(() => {
    const saved = sessionStorage.getItem('looksfam:scrollTop')
    if (saved && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = parseInt(saved, 10)
    }
  }, [isLoading])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const save = () => sessionStorage.setItem('looksfam:scrollTop', String(el.scrollTop))
    el.addEventListener('scroll', save, { passive: true })
    return () => el.removeEventListener('scroll', save)
  }, [isLoading])

  const folders = useMemo(() => {
    const folderMap = new Map<string, number>()
    allSets.forEach(d => {
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
  }, [allSets])

  const deckCountByFolder = useMemo(() => {
    const acc: Record<string, number> = {}
    const uncategorized = folderRows.find(f => f.name === 'Uncategorized')
    const uncategorizedId = uncategorized?.id
    
    for (const folder of folderRows) {
      let count = 0
      if (folder.name === 'Uncategorized') {
        count = allSets.filter(d => d.folderId === null || d.folderId === uncategorizedId).length
      } else {
        // Store only the DIRECT count for this folder (not subtree).
        // FolderPanel's subtreeCount() handles summing children.
        count = allSets.filter(d => d.folderId === folder.id).length
      }
      acc[folder.id] = count
      acc[folder.name] = count // for legacy mode fallback
    }
    return acc
  }, [allSets, folderRows])

  const filteredAndSortedSets = useMemo(() => {
    const folderFiltered = activeFolder === 'all'
      ? allSets
      : allSets.filter(d => {
          const ids = subtreeIds(activeFolder)
          return d.folderId ? ids.includes(d.folderId) : activeFolder === 'Uncategorized'
        })

    let result = folderFiltered.filter(s => activeSubject === 'ALL' || s.subject === activeSubject)

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s => s.title.toLowerCase().includes(q))
    }

    if (filterType !== 'all') {
      result = result.filter(s => s.deckType === filterType)
    }

    if (filterTags.length > 0) {
      result = result.filter(s => filterTags.every(tag => s.tags?.includes(tag)))
    }

    result.sort((a, b) => {
      let comparison = 0
      if (sortBy === 'date') comparison = (a.createdAt || 0) - (b.createdAt || 0)
      else if (sortBy === 'mastery') comparison = a.mastery - b.mastery
      else if (sortBy === 'title') comparison = a.title.localeCompare(b.title)

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return result
  }, [allSets, activeFolder, activeSubject, filterType, filterTags, sortBy, sortOrder, searchQuery])

  // Compute how many bookmarks each topic has (based on cached card IDs)
  const bookmarksPerTopic = useMemo(() => {
    const out: Record<string, number> = {}
    for (const [topicId, ids] of Object.entries(topicCardIds)) {
      out[topicId] = ids.filter(id => globalBookmarks.has(id)).length
    }
    return out
  }, [topicCardIds, globalBookmarks])

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
      if (setToDelete.id.startsWith('topic_')) {
        await window.electron.decks.deleteTopic(setToDelete.id)
      }
      setAllSets(prev => prev.filter(s => s.id !== setToDelete.id))
      setSetToDelete(null)
    } catch (err) {
      console.error('Failed to delete set', err)
    }
  }

  const [mode, setMode] = useState<StudyMode>('flashcard')

  const [isSessionActive, setIsSessionActive] = useState(false)
  const [activeSessionTitle, setActiveSessionTitle] = useState('')
  const [activeSessionSetId, setActiveSessionSetId] = useState('')
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const startSession = useSessionStore(state => state.startSession)
  const { currentDeck, currentIndex, isFinished, sessionStats } = useSessionStore()
  useIdleAwareTimer(isSessionActive)

  // Navigation Blocking logic
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isSessionActive && currentLocation.pathname !== nextLocation.pathname
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
    if (!isSessionActive) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowExitConfirm(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSessionActive])

  // Safe exit: reset any active blocker before handing control to parent
  const handleExit = () => {
    if (blocker.state === 'blocked') blocker.reset()
    setIsSessionActive(false)
    startSession([])
  }

  // Safe programmatic navigation — always resets any stale blocker first so
  // the router doesn't silently swallow navigate() calls when isSessionActive
  // was left true by a previous session that ended via onExit rather than useBlocker.
  const safeNavigate = (to: string) => {
    if (blocker.state === 'blocked') blocker.reset()
    setIsSessionActive(false)
    navigate(to)
  }

  // Pre-Learn Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState<{ isOpen: boolean; setId: string | null }>({ isOpen: false, setId: null })
  const [learnSettings, setLearnSettings] = useState<LearnSettings>({
    type: 'MCQ',
    shuffleQuestions: false,
    shuffleChoices: false,
    bookmarkedOnly: false,
    itemCount: 'All',
    randomSample: false,
    ttsEnabled: loadTTSPreference(),
  })



  // Pre-Test Settings Modal State
  const [showTestModal, setShowTestModal] = useState<{ isOpen: boolean; setId: string | null }>({ isOpen: false, setId: null })
  const [testSettings, setTestSettings] = useState<TestSettings>({
    instantChecking: false,
    shuffleQuestions: false,
    shuffleChoices: false,
    bookmarkedOnly: false,
    itemCount: 'All',
    randomSample: false
  })

  // Open learn settings
  const handleOpenLearn = (setId: string) => {
    setShowSettingsModal({ isOpen: true, setId })
  }

  // Open test settings
  const handleOpenTest = (setId: string) => {
    setShowTestModal({ isOpen: true, setId })
  }

  // Helper to build MCQs out of flashcards dynamically for the Learn/Test view
  const generateMCQs = (flashcards: any[]) => {
    const total = flashcards.length;
    return flashcards.map((fc, i) => {
      const distractorIndices = new Set<number>();
      let attempts = 0;
      const targetDistractors = Math.min(3, total - 1);

      while (distractorIndices.size < targetDistractors && attempts < 30) {
        const randIdx = Math.floor(Math.random() * total);
        if (randIdx !== i && flashcards[randIdx].back !== fc.back) {
          distractorIndices.add(randIdx);
        }
        attempts++;
      }

      const shuffledOthers = Array.from(distractorIndices).map(idx => flashcards[idx].back);
      const { choices, answer: answerIndex } = shuffleChoices([fc.back, ...shuffledOthers], 0);

      return {
        id: fc.id || `card_${i}`,
        topicId: 'custom',
        type: 'mcq',
        difficulty: 'medium',
        tags: [],
        isCustom: true,
        // isGenerated=true marks this as a synthetic card built from a flashcard.
        // Its id is the source flashcard's real DB id \u2014 we must NEVER write MCQ
        // correctness into that progress row or we corrupt the flashcard's SM-2 state.
        isGenerated: true,
        createdAt: new Date().toISOString(),
        data: {
          question: fc.front,
          choices: choices,
          answer: answerIndex,
          explanation: ''
        }
      }
    })
  }

  const handleStartLearn = async () => {
    const setId = showSettingsModal.setId
    if (!setId) return
    setMode('learn')
    setShowSettingsModal({ isOpen: false, setId: null })
    setIsSessionActive(true)
    setActiveSessionSetId(setId)

    const setInfo = allSets.find(s => s.id === setId)
    if (setInfo) setActiveSessionTitle(setInfo.title)

    let filteredData: any[] = []

    if (setId.startsWith('topic_')) {
      // Load real cards from DB
      const prioritizedCards = await dbService.getCardsWithProgress(setId)
      const rawCards = prioritizedCards.map(card => ({
        data: card.data,
        type: card.type,
        id: card.id,
        easeFactor: card.easeFactor ?? 2.5,
        repetitions: card.repetitions ?? 0,
        interval: card.interval ?? 1,
        correct_count: card.correct_count ?? 0,
        total_count: card.total_count ?? 0,
        last_result: card.last_result ?? null,
      }))

      const mcqs = rawCards.filter((r: any) => r.type === 'mcq').map((r: any) => ({
        id: r.id, topicId: 'custom', type: 'mcq', difficulty: 'medium', tags: [], isCustom: true, data: r.data,
        easeFactor: r.easeFactor,
        repetitions: r.repetitions,
        interval: r.interval,
        correct_count: r.correct_count,
        total_count: r.total_count,
        last_result: r.last_result,
      }))

      const flashcards = rawCards.filter((r: any) => r.type !== 'mcq').map((r: any) => ({ ...r.data, id: r.id }))
      const generated = generateMCQs(flashcards)

      filteredData = [...mcqs, ...generated]
    } else {
      // Mock flow
      filteredData = MOCK_MCQS;
      if (activeSubject === 'MATH') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('math') || c.topicId.includes('algebra'));
      else if (activeSubject === 'ELECS') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('elec') || c.topicId.includes('diode'));
      else if (activeSubject === 'GEAS') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('geas'));
      else if (activeSubject === 'EST') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('est') || c.topicId.includes('comms'));
    }

    if (filteredData.length === 0) filteredData = MOCK_MCQS;

    if (learnSettings.bookmarkedOnly) {
      const savedBookmarks = localStorage.getItem('bookmarkedIds')
      const bookmarkedSet = savedBookmarks ? new Set<string>(JSON.parse(savedBookmarks)) : new Set<string>()
      filteredData = filteredData.filter(card => bookmarkedSet.has(card.id))
    }

    // Apply basic shuffles if needed
    if (learnSettings.shuffleQuestions) {
      filteredData = shuffle(filteredData)
    }

    if (learnSettings.shuffleChoices) {
      filteredData = filteredData.map(card => {
        if (card.type === 'mcq' && card.data && Array.isArray(card.data.choices) && isSafeToShuffleChoices(card.data.choices)) {
          const sc = shuffleChoices(card.data.choices, card.data.answer, card.data.choicesPlainText)
          return {
            ...card,
            data: {
              ...card.data,
              choices: sc.choices,
              answer: sc.answer,
              ...(sc.choicesPlainText ? { choicesPlainText: sc.choicesPlainText } : {})
            }
          }
        }
        return card
      })
    }

    if (learnSettings.itemCount !== 'All' && filteredData.length > learnSettings.itemCount) {
      if (learnSettings.randomSample) {
        filteredData = weightedSample(filteredData as any, learnSettings.itemCount)
      } else {
        filteredData = filteredData.slice(0, learnSettings.itemCount)
      }
    }

    startSession(filteredData as any)
  }


  const handleStartTest = async () => {
    const setId = showTestModal.setId
    if (!setId) return
    setMode('test')
    setShowTestModal({ isOpen: false, setId: null })
    setIsSessionActive(true)
    setActiveSessionSetId(setId)

    const setInfo = allSets.find(s => s.id === setId)
    if (setInfo) setActiveSessionTitle(setInfo.title)

    let filteredData: any[] = []

    if (setId.startsWith('topic_')) {
      // Load real cards from DB
      const prioritizedCards = await dbService.getCardsWithProgress(setId)
      const rawCards = prioritizedCards.map(card => ({
        data: card.data,
        type: card.type,
        id: card.id,
        easeFactor: card.easeFactor ?? 2.5,
        repetitions: card.repetitions ?? 0,
        interval: card.interval ?? 1,
        correct_count: card.correct_count ?? 0,
        total_count: card.total_count ?? 0,
        last_result: card.last_result ?? null,
      }))

      const mcqs = rawCards.filter((r: any) => r.type === 'mcq').map((r: any) => ({
        id: r.id, topicId: 'custom', type: 'mcq', difficulty: 'medium', tags: [], isCustom: true, data: r.data,
        easeFactor: r.easeFactor,
        repetitions: r.repetitions,
        interval: r.interval,
        correct_count: r.correct_count,
        total_count: r.total_count,
        last_result: r.last_result,
      }))

      const flashcards = rawCards.filter((r: any) => r.type !== 'mcq').map((r: any) => ({ ...r.data, id: r.id }))
      const generated = generateMCQs(flashcards)

      filteredData = [...mcqs, ...generated]
    } else {
      // Mock flow
      filteredData = MOCK_MCQS;
      if (activeSubject === 'MATH') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('math') || c.topicId.includes('algebra'));
      else if (activeSubject === 'ELECS') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('elec') || c.topicId.includes('diode'));
      else if (activeSubject === 'GEAS') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('geas'));
      else if (activeSubject === 'EST') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('est') || c.topicId.includes('comms'));
    }

    if (filteredData.length === 0) filteredData = MOCK_MCQS;

    if (testSettings.bookmarkedOnly) {
      const savedBookmarks = localStorage.getItem('bookmarkedIds')
      const bookmarkedSet = savedBookmarks ? new Set<string>(JSON.parse(savedBookmarks)) : new Set<string>()
      filteredData = filteredData.filter(card => bookmarkedSet.has(card.id))
    }

    if (testSettings.shuffleQuestions) {
      filteredData = shuffle(filteredData)
    }

    if (testSettings.shuffleChoices) {
      filteredData = filteredData.map(card => {
        if (card.type === 'mcq' && card.data && Array.isArray(card.data.choices) && isSafeToShuffleChoices(card.data.choices)) {
          const sc = shuffleChoices(card.data.choices, card.data.answer, card.data.choicesPlainText)
          return {
            ...card,
            data: {
              ...card.data,
              choices: sc.choices,
              answer: sc.answer,
              ...(sc.choicesPlainText ? { choicesPlainText: sc.choicesPlainText } : {})
            }
          }
        }
        return card
      })
    }

    if (testSettings.itemCount !== 'All' && filteredData.length > testSettings.itemCount) {
      if (testSettings.randomSample) {
        filteredData = weightedSample(filteredData as any, testSettings.itemCount)
      } else {
        filteredData = filteredData.slice(0, testSettings.itemCount)
      }
    }

    startSession(filteredData as any)
  }

  const handleComplete = () => {
    // setIsSessionActive(false)
  }

  const progress = currentDeck.length > 0 ? (currentIndex / currentDeck.length) * 100 : 0

  if (isSessionActive) {
    if (mode === 'learn') {
      return (
        <LearnMode
          cards={currentDeck}
          title={activeSessionTitle}
          ttsEnabled={learnSettings.ttsEnabled}
          onComplete={(stats) => {
            console.log('Learn Mode Stats:', stats)
          }}
          onExit={() => {
            if (blocker.state === 'blocked') blocker.reset()
            setIsSessionActive(false)
            // Re-fetch mastery now that per-answer progress has been written.
            loadDBSets()
            setGlobalBookmarks(readBookmarks())
          }}
        />
      )
    }

    if (mode === 'test') {
      return (
        <TestMode
          cards={currentDeck}
          title={activeSessionTitle}
          settings={testSettings}
          onComplete={(stats) => {
            console.log('Test Mode Stats:', stats)
          }}
          onExit={() => {
            if (blocker.state === 'blocked') blocker.reset()
            setIsSessionActive(false)
            // TestMode batches writes at submit and fires them concurrently;
            // give SQLite ~300 ms to commit before re-fetching mastery.
            setTimeout(() => loadDBSets(), 300)
            setGlobalBookmarks(readBookmarks())
          }}
        />
      )
    }

    return (
      <div className="h-full bg-[var(--bg-primary)] p-6 lg:p-10 flex flex-col relative overflow-y-auto w-full">
        <LeaveConfirmModal
          isOpen={blocker.state === 'blocked' || showExitConfirm}
          onConfirm={() => {
            if (blocker.state === 'blocked') {
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

        <StudyHeader
          topicName={activeSessionTitle || 'Active Session'}
          currentCardIndex={currentIndex}
          totalCards={currentDeck.length}
          onBackClick={() => setShowExitConfirm(true)}
        />

        {!isFinished && (
          <StudySessionStats
            correctCount={(sessionStats?.good || 0) + (sessionStats?.easy || 0)}
            totalReviewed={currentIndex}
            streakDays={0}
          />
        )}

        {mode === 'flashcard' && <FlashDeck cards={currentDeck} onComplete={handleComplete} />}
        {mode === 'mcq' && <MCQDeck cards={currentDeck} onComplete={handleComplete} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full">
      <LearnSettingsModal
        isOpen={showSettingsModal.isOpen}
        setId={showSettingsModal.setId}
        settings={learnSettings}
        allSets={allSets}
        onSettingsChange={setLearnSettings}
        onStart={handleStartLearn}
        onClose={() => setShowSettingsModal({ isOpen: false, setId: null })}
      />


      <TestSettingsModal
        isOpen={showTestModal.isOpen}
        setId={showTestModal.setId}
        settings={testSettings}
        allSets={allSets}
        onSettingsChange={setTestSettings}
        onStart={handleStartTest}
        onClose={() => setShowTestModal({ isOpen: false, setId: null })}
      />

      <div className="flex flex-row flex-1 w-full overflow-hidden">
        <div ref={scrollContainerRef} className="flex flex-col flex-1 min-w-0 overflow-y-auto show-scrollbar">
          <div className="flex flex-col items-center w-full pt-6 pb-0 px-6">
            <div className="w-full max-w-5xl flex flex-col items-center justify-center gap-6 mb-2 border-b border-[var(--bg-card)] pb-4 relative z-30 pt-4">
              <div className="w-full flex items-center justify-center relative min-h-[40px]">
                <h1 className="text-3xl lg:text-4xl font-['Orbitron'] text-[var(--text-primary)] tracking-wider font-bold flex items-center gap-4 uppercase">
                  <Brain className="text-[var(--accent-primary)]" size={32} />
                  LOOKS<span className="text-[var(--accent-primary)]">FAM</span>
                </h1>
                <button
                  onClick={() => navigate('/add-decks?type=mcq')}
                  className="absolute right-0 flex items-center gap-2 px-4 py-2 rounded-md border border-[var(--bg-card)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] font-['Rajdhani'] font-bold text-sm uppercase tracking-widest transition-all"
                >
                  <Plus size={15} />
                  Add MCQ Deck
                </button>
              </div>

              <div className="flex items-center justify-center flex-wrap gap-2 w-full bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--bg-card)] no-scrollbar px-1">
                <div className="relative shrink-0" ref={filterPopoverRef}>
                  <Tooltip content="Filter & Sort" position="bottom">
                    <button
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className={`p-2 rounded-lg border transition-all ${showAdvancedFilters || filterTags.length > 0 || filterType !== 'all' || sortBy !== 'date' || sortOrder !== 'desc' || searchQuery
                        ? 'bg-accent/10 border-accent text-accent'
                        : 'bg-[var(--bg-secondary)] border-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                    >
                      <SlidersHorizontal size={20} />
                    </button>
                  </Tooltip>

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
                          <span className="font-['Rajdhani'] font-bold text-sm tracking-widest uppercase text-accent">Filters & Sort</span>
                          <button onClick={() => setShowAdvancedFilters(false)} className="text-text-muted hover:text-text-primary">
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

                        {/* Sort Selection */}
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-['Rajdhani'] tracking-widest text-text-muted uppercase">Sort By</label>
                            <div className="flex bg-surface rounded overflow-hidden border border-[#333]">
                              {(['asc', 'desc'] as const).map(order => (
                                <button
                                  key={order}
                                  onClick={() => setSortOrder(order)}
                                  className={`px-2 py-0.5 text-[10px] font-['Rajdhani'] uppercase tracking-widest transition-colors ${sortOrder === order ? 'bg-accent text-black font-bold' : 'text-text-muted hover:text-text-primary'}`}
                                >
                                  {order}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {(['date', 'title', 'mastery'] as const).map(opt => (
                              <button
                                key={opt}
                                onClick={() => setSortBy(opt)}
                                className={`text-xs py-1.5 rounded transition-colors uppercase font-['Rajdhani'] tracking-wider ${sortBy === opt ? 'bg-accent/20 text-accent font-bold' : 'bg-surface text-text-muted hover:bg-border-base'
                                  }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Type Filter */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-['Rajdhani'] tracking-widest text-text-muted uppercase">Type</label>
                          <div className="grid grid-cols-4 gap-1">
                            {(['all', 'mcq', 'flashcard', 'mixed'] as const).map(opt => (
                              <button
                                key={opt}
                                onClick={() => setFilterType(opt)}
                                className={`text-xs py-1.5 rounded transition-colors uppercase font-['Rajdhani'] tracking-wider ${filterType === opt ? 'bg-accent/20 text-accent font-bold' : 'bg-surface text-text-muted hover:bg-border-base'
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
                            <label className="text-xs font-['Rajdhani'] tracking-widest text-text-muted uppercase">Tags (AND)</label>
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

                        {/* Clear Button */}
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
                <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <Bookmark className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Bookmarked Items
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 px-6 pb-6">
            <div className="flex flex-col items-center">
              <div className="w-full max-w-5xl">
                <DeckGrid>
                  {filteredAndSortedSets.map(set => (
                    <div
                      key={set.id}
                      className="relative isolate group transition-all duration-300 border border-[#333] bg-surface p-5 flex flex-col w-full min-h-[180px] justify-between hover:-translate-x-[6px] hover:-translate-y-[6px] rounded-xl before:absolute before:w-full before:h-full before:top-0 before:left-0 before:bg-surface before:border before:border-[#333] before:rounded-xl before:translate-x-[6px] before:translate-y-[6px] before:z-[-1] before:transition-transform before:duration-300 group-hover:before:translate-x-[12px] group-hover:before:translate-y-[12px] after:absolute after:w-full after:h-full after:top-0 after:left-0 after:bg-surface after:border after:border-[#333] after:rounded-xl after:translate-x-[12px] after:translate-y-[12px] after:z-[-2] after:transition-transform after:duration-300 group-hover:after:translate-x-[18px] group-hover:after:translate-y-[18px]"
                    >
                      <div className="flex justify-between items-start gap-4">
                        {/* Left Column: Title & Tags */}
                        <div className="flex-1 min-w-0 flex flex-col gap-3">
                          {/* Title Row */}
                          <div className="flex items-center gap-3">
                            <span className={`w-[58px] flex justify-center py-0.5 rounded border border-[#333] bg-[#111] uppercase font-rajdhani font-bold tracking-widest text-[10px] shrink-0 ${getSubjectBadgeClasses(set.subject)}`}>
                              {set.subject}
                            </span>
                            <h3 className="text-2xl font-bold font-rajdhani tracking-wide text-text-primary uppercase truncate flex-1">
                              {set.title}
                            </h3>
                          </div>
                          {/* Tag Row: Type & Custom Tags (Aligned with Date) */}
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="px-2 py-0.5 rounded border border-[#333] bg-transparent text-gray-400 uppercase font-bold tracking-wider text-[10px]">
                              {set.deckType === 'mixed' ? 'MIX' : set.deckType === 'mcq' ? 'MCQ' : 'FC'}
                            </span>
                            {set.tags && set.tags.length > 0 && set.tags.map(tag => (
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
                          <span className="px-2 py-0.5 rounded border border-[#333] bg-transparent text-gray-400 uppercase font-bold tracking-wider text-[10px] shrink-0 whitespace-nowrap">
                            {set.count} ITEMS
                          </span>
                          {/* Date String */}
                          <span className="text-[10px] text-gray-400 uppercase font-['IBM_Plex_Mono'] tracking-widest">
                            {set.createdAt ? new Date(set.createdAt * 1000).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase() : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Deck Description */}
                      {set.description && set.description.trim() !== "" && (
                        <p className="text-xs text-gray-400 font-['IBM_Plex_Mono'] leading-relaxed mt-2 line-clamp-2 uppercase pr-4">
                          {set.description}
                        </p>
                      )}

                      {/* Bottom Row: Progress and Actions */}
                      <div className="flex items-center gap-4 w-full mt-4">
                        <span className="text-[10px] font-rajdhani tracking-widest uppercase text-gray-500 shrink-0">
                          Mastery
                        </span>

                        <div className="flex-1 bg-[#111] h-1 rounded-full overflow-hidden min-w-[40px]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${set.mastery}%` }}
                            className="h-full bg-accent shadow-[0_0_8px_rgba(0,255,65,0.4)]"
                          />
                        </div>

                        <span className="text-accent font-bold text-[10px] font-rajdhani shrink-0">
                          {set.mastery}%
                        </span>

                        <div className="h-4 w-px bg-slate-800 shrink-0" />

                        <div className="flex items-center gap-2 shrink-0">
                          <Tooltip content="Learn Mode" position="top">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenLearn(set.id); }}
                              className="py-2 px-3 bg-[#111] border border-[#333] hover:border-accent hover:text-accent text-text-primary rounded transition-colors font-rajdhani tracking-widest uppercase text-xs font-bold flex items-center justify-center gap-2"
                              aria-label="Learn"
                            >
                              <Play className="w-3 h-3" />
                              <span>Learn</span>
                            </button>
                          </Tooltip>

                          <Tooltip content="Test Mode" position="top">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenTest(set.id); }}
                              className="py-2 px-3 bg-[#111] border border-[#333] hover:border-accent hover:text-accent text-text-primary rounded transition-colors font-rajdhani tracking-widest uppercase text-xs font-bold flex items-center justify-center gap-2"
                              aria-label="Test"
                            >
                              <Trophy className="w-3 h-3" />
                              <span>Test</span>
                            </button>
                          </Tooltip>

                          {/* Bookmark button — only shown when this deck has bookmarked items */}
                          {(bookmarksPerTopic[set.id] ?? 0) > 0 && (
                            <Tooltip content={`Bookmarked Items (${bookmarksPerTopic[set.id]})`} position="top">
                              <button
                                onClick={(e) => { e.stopPropagation(); setBookmarkModalDeck(set) }}
                                className="p-2 bg-[#111] border border-accent/30 text-accent hover:border-accent hover:bg-accent/10 rounded transition-colors relative"
                                aria-label="Bookmarked Items"
                              >
                                <Bookmark className="w-4 h-4 fill-accent" />
                                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-accent text-black font-['IBM_Plex_Mono'] text-[9px] font-bold flex items-center justify-center">
                                  {bookmarksPerTopic[set.id] > 9 ? '9+' : bookmarksPerTopic[set.id]}
                                </span>
                              </button>
                            </Tooltip>
                          )}

                          {set.id.startsWith('topic_') && (
                            <Tooltip content="Test Paper View" position="top">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  window.electron.print.open(set.id, set.title)
                                }}
                                className="p-2 bg-[#111] border border-[#333] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] text-gray-400 rounded transition-colors"
                                aria-label="Test Paper View"
                              >
                                <ScrollText className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          )}

                          <Tooltip content="Edit Deck" position="top">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                sessionStorage.setItem('ecengine:returnScroll:/study', String(window.scrollY))
                                safeNavigate(`/edit-deck/${set.id}?returnTo=/study`)
                              }}
                              className="p-2 bg-[#111] border border-[#333] hover:border-[#555] text-gray-400 hover:text-white rounded transition-colors"
                              aria-label="Edit Deck"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </Tooltip>

                          {set.id !== 'set-1' && (
                            <Tooltip content="Delete Deck" position="top">
                              <button
                                onClick={(e) => { e.stopPropagation(); setSetToDelete(set); }}
                                className="p-2 bg-[#111] border border-[#333] hover:border-red-500/50 text-gray-500 hover:text-red-500 rounded transition-colors"
                                aria-label="Delete Deck"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </DeckGrid>

                {isLoading ? (
                  <div className="text-center py-20 text-[#555] font-['IBM_Plex_Mono'] text-sm tracking-widest animate-pulse">
                    Loading decks...
                  </div>
                ) : filteredAndSortedSets.length === 0 ? (
                  <div className="text-center py-20 text-text-muted font-rajdhani uppercase tracking-widest text-lg">
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
                    <p className="text-text-muted font-['IBM_Plex_Mono'] mb-8 leading-relaxed">
                      Are you absolutely sure you want to delete <strong className="text-white">{setToDelete.title}</strong>? This action cannot be undone and will permanently remove all {setToDelete.count} items in this set.
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
          {/* Bookmark Modal */}
          <AnimatePresence>
            {bookmarkModalDeck && (
              <BookmarkedCardsModal
                topicId={bookmarkModalDeck.id}
                topicTitle={bookmarkModalDeck.title}
                onClose={() => setBookmarkModalDeck(null)}
                onBookmarksChanged={(newIds) => {
                  setGlobalBookmarks(new Set(newIds))
                  // Update the card ID cache count for this deck in case items changed
                  setTopicCardIds(prev => ({ ...prev }))
                }}
              />
            )}
          </AnimatePresence>
        </div>
        <FolderPanel
          folderRows={folderRows}
          folders={folders}
          deckCountByFolder={deckCountByFolder}
          totalDeckCount={allSets.length}
          selected={activeFolder}
          onSelect={setActiveFolder}
          onDeleteFolder={handleDeleteFolder}
          onReorderFolders={handleReorderFolders}
          onCreateFolder={onCreateFolder}
          onPromoteFolder={onPromoteFolder}
          onNestFolder={onNestFolder}
          onRenameFolder={onRenameFolder}
        />
      </div>
    </div>
  )
}
