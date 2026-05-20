import React, { useState, useEffect, useMemo, useRef } from 'react'
import FolderPanel from '@/components/ui/FolderPanel'
import { useNavigate, useBlocker } from 'react-router-dom'
import { FlashDeck } from '../components/flashcard/FlashDeck'
import { MCQDeck } from '../components/mcq/MCQDeck'
import { LearnMode } from '../components/mcq/LearnMode'
import { TestMode } from '../components/mcq/TestMode'
import { LearnSettingsModal, LearnSettings } from '../components/mcq/LearnSettingsModal'
import { TestSettingsModal, TestSettings } from '../components/mcq/TestSettingsModal'
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal'
import { MOCK_FLASHCARDS, MOCK_MCQS } from '../lib/mockData'
import { Play, Bookmark, X, Trash2, AlertTriangle, ClipboardList, SlidersHorizontal, Check, Pencil, Brain, Trophy, ScrollText } from 'lucide-react'
import { getSubjectFilterClasses, getSubjectBadgeClasses } from '../lib/subjectColors'
import { useSessionStore } from '../store/useSessionStore'
import { motion, AnimatePresence } from 'framer-motion'
import { shuffle, shuffleChoices } from '../lib/scrambler'

type StudyMode = 'flashcard' | 'mcq' | 'learn' | 'test'
type Subject = 'ALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST'

const SUBJECTS: Subject[] = ['ALL', 'MATH', 'GEAS', 'ELECS', 'EST']

// Map full subject names (from DB) to short codes used in the UI
const SUBJECT_MAP: Record<string, Subject> = {
  'Mathematics': 'MATH',
  'General Engineering & Applied Sciences': 'GEAS',
  'Electronics Engineering': 'ELECS',
  'Electronics Systems & Technologies': 'EST',
}

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
}

// Removed Mock Sets

export default function FlashcardStudy() {
  const navigate = useNavigate()
  const [allSets, setAllSets] = useState<StudySet[]>([])
  const [setToDelete, setSetToDelete] = useState<StudySet | null>(null)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  // Advanced Filters State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'mastery'>('date')
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'flashcard' | 'mixed'>('all')
  const filterPopoverRef = useRef<HTMLDivElement>(null)

  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    allSets.forEach(s => s.tags?.forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [allSets])

  // Load user-created sets from DB on mount
  useEffect(() => {
    async function loadDBSets() {
      try {
        if (!window.electron?.db) return
        const topicsResult = await window.electron.db.query(
          `SELECT t.id, t.name, t.subject, t.description, t.created_at, t.tags, t.folder_name,
                  COUNT(c.id) as card_count,
                  GROUP_CONCAT(DISTINCT c.type) as types
           FROM topics t LEFT JOIN cards c ON c.topic_id = t.id
           GROUP BY t.id`
        )
        if (topicsResult.success && topicsResult.data) {
          const dbSets: StudySet[] = topicsResult.data.map((row: any) => {
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
              folderName: row.folder_name || 'Uncategorized'
            }
          }).filter((s: StudySet | null): s is StudySet => s !== null)
          setAllSets(prev => {
            const nonDb = prev.filter(s => !s.id.startsWith('topic_'));
            return [...nonDb, ...dbSets];
          })
        }
      } catch (err) {
        console.error('Failed to load DB sets', err)
      }
    }
    loadDBSets()
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

  const [activeSubject, setActiveSubject] = useState<Subject>('ALL')
  const [activeFolder, setActiveFolder] = useState<string | 'all'>('all')

  const folders = useMemo(() => {
    const names = [...new Set(
      allSets.map(d => d.folderName || 'Uncategorized')
    )].sort()
    const idx = names.indexOf('Uncategorized')
    if (idx > -1) { names.splice(idx, 1); names.push('Uncategorized') }
    return names
  }, [allSets])

  const deckCountByFolder = useMemo(() =>
    folders.reduce((acc, f) => ({
      ...acc,
      [f]: allSets.filter(d =>
        (d.folderName || 'Uncategorized') === f
      ).length
    }), {} as Record<string, number>)
    , [allSets, folders])

  const filteredAndSortedSets = useMemo(() => {
    const folderFiltered = activeFolder === 'all'
      ? allSets
      : allSets.filter(d => (d.folderName || 'Uncategorized') === activeFolder)

    let result = folderFiltered.filter(s => activeSubject === 'ALL' || s.subject === activeSubject)

    if (filterType !== 'all') {
      result = result.filter(s => s.deckType === filterType)
    }

    if (filterTags.length > 0) {
      result = result.filter(s => filterTags.every(tag => s.tags?.includes(tag)))
    }

    result.sort((a, b) => {
      if (sortBy === 'date') return (b.createdAt || 0) - (a.createdAt || 0)
      if (sortBy === 'mastery') return b.mastery - a.mastery
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      return 0
    })

    return result
  }, [allSets, activeFolder, activeSubject, filterType, filterTags, sortBy])

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
      if (window.electron?.db && setToDelete.id.startsWith('topic_')) {
        await window.electron.db.run(`DELETE FROM cards WHERE topic_id = ?`, [setToDelete.id])
        await window.electron.db.run(`DELETE FROM topics WHERE id = ?`, [setToDelete.id])
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
  const { currentDeck, currentIndex, isFinished } = useSessionStore()

  // Navigation Blocking logic
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isSessionActive && (mode === 'flashcard' || mode === 'mcq') && currentLocation.pathname !== nextLocation.pathname
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
    setIsSessionActive(false)
    startSession([])
  }

  // Pre-Learn Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState<{ isOpen: boolean; setId: string | null }>({ isOpen: false, setId: null })
  const [learnSettings, setLearnSettings] = useState<LearnSettings>({
    type: 'MCQ',
    shuffleQuestions: false,
    shuffleChoices: false,
    bookmarkedOnly: false,
    itemCount: 'All'
  })

  // Pre-Test Settings Modal State
  const [showTestModal, setShowTestModal] = useState<{ isOpen: boolean; setId: string | null }>({ isOpen: false, setId: null })
  const [testSettings, setTestSettings] = useState<TestSettings>({
    instantChecking: false,
    shuffleQuestions: false,
    shuffleChoices: false,
    bookmarkedOnly: false,
    itemCount: 'All'
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
    return flashcards.map((fc, i) => {
      const allOtherDefs = flashcards.filter((_, idx) => idx !== i).map(c => c.back)
      // Pick up to 3 random distractors
      const shuffledOthers = shuffle(allOtherDefs).slice(0, 3)
      const { choices, answer: answerIndex } = shuffleChoices([fc.back, ...shuffledOthers], 0)
      return {
        id: fc.id || `card_${i}`,
        topicId: 'custom',
        type: 'mcq',
        difficulty: 'medium',
        tags: [],
        isCustom: true,
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
      const res = await window.electron.db.query(`SELECT data, type, id FROM cards WHERE topic_id = ?`, [setId])
      if (res.success && res.data) {
        const rawCards = res.data.map((r: any) => ({ data: JSON.parse(r.data), type: r.type, id: r.id }))

        const mcqs = rawCards.filter((r: any) => r.type === 'mcq').map((r: any) => ({
          id: r.id, topicId: 'custom', type: 'mcq', difficulty: 'medium', tags: [], isCustom: true, data: r.data
        }))

        const flashcards = rawCards.filter((r: any) => r.type !== 'mcq').map((r: any) => ({ ...r.data, id: r.id }))
        const generated = generateMCQs(flashcards)

        filteredData = [...mcqs, ...generated]
      }
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
        if (card.type === 'mcq' && card.data && Array.isArray(card.data.choices)) {
          const sc = shuffleChoices(card.data.choices, card.data.answer)
          return {
            ...card,
            data: {
              ...card.data,
              choices: sc.choices,
              answer: sc.answer
            }
          }
        }
        return card
      })
    }

    if (learnSettings.itemCount !== 'All' && filteredData.length > learnSettings.itemCount) {
      filteredData = filteredData.slice(0, learnSettings.itemCount)
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
      const res = await window.electron.db.query(`SELECT data, type, id FROM cards WHERE topic_id = ?`, [setId])
      if (res.success && res.data) {
        const rawCards = res.data.map((r: any) => ({ data: JSON.parse(r.data), type: r.type, id: r.id }))

        const mcqs = rawCards.filter((r: any) => r.type === 'mcq').map((r: any) => ({
          id: r.id, topicId: 'custom', type: 'mcq', difficulty: 'medium', tags: [], isCustom: true, data: r.data
        }))

        const flashcards = rawCards.filter((r: any) => r.type !== 'mcq').map((r: any) => ({ ...r.data, id: r.id }))
        const generated = generateMCQs(flashcards)

        filteredData = [...mcqs, ...generated]
      }
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
        if (card.type === 'mcq' && card.data && Array.isArray(card.data.choices)) {
          const sc = shuffleChoices(card.data.choices, card.data.answer)
          return {
            ...card,
            data: {
              ...card.data,
              choices: sc.choices,
              answer: sc.answer
            }
          }
        }
        return card
      })
    }

    if (testSettings.itemCount !== 'All' && filteredData.length > testSettings.itemCount) {
      filteredData = filteredData.slice(0, testSettings.itemCount)
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
          onComplete={(stats) => {
            console.log('Learn Mode Stats:', stats)
          }}
          onExit={() => setIsSessionActive(false)}
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
          onExit={() => setIsSessionActive(false)}
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
        <button
          onClick={() => setShowExitConfirm(true)}
          className="absolute top-6 right-6 px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded border border-[var(--bg-card)] hover:text-[var(--text-primary)] hover:border-[var(--accent-border)] transition-colors font-['Rajdhani'] uppercase tracking-wider z-50"
        >
          Exit Session
        </button>

        {/* Global Progress Bar */}
        {!isFinished && (
          <div className="fixed top-0 left-0 w-full bg-[var(--bg-secondary)] h-1.5 z-50 shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
            <motion.div
              className="bg-[var(--accent-primary)] h-full shadow-[0_0_12px_rgba(0,255,65,0.8)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
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

      <div className="flex flex-1 w-full overflow-hidden">
        <FolderPanel
          folders={folders}
          deckCountByFolder={deckCountByFolder}
          totalDeckCount={allSets.length}
          selected={activeFolder}
          onSelect={setActiveFolder}
        />
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
          {/* Header centered above decks */}
          <div className="flex flex-col items-center w-full pt-6 pb-2 px-6">
            <div className="w-full max-w-5xl mb-10 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-[var(--bg-card)] pb-6 relative z-30 pt-4">
              <h1 className="text-3xl lg:text-4xl font-['Orbitron'] text-[var(--text-primary)] tracking-wider font-bold flex items-center gap-4 uppercase">
                <Brain className="text-[var(--accent-primary)]" size={36} />
                LOOKS<span className="text-[var(--accent-primary)]">FAM</span>
              </h1>

              <div className="flex gap-2 items-center">
                <div className="relative" ref={filterPopoverRef}>
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`p-2 rounded-lg border transition-all ${showAdvancedFilters || filterTags.length > 0 || filterType !== 'all' || sortBy !== 'date'
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
                          <div className="grid grid-cols-3 gap-1">
                            {(['date', 'title', 'mastery'] as const).map(opt => (
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
          </div>

          <div className="flex-1 px-6 pb-6">
            <div className="flex flex-col items-center">
              <div className="w-full max-w-5xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-2 pb-4">
                  {filteredAndSortedSets.map(set => (
                    <div
                      key={set.id}
                      className="relative isolate group transition-all duration-300 border border-[#333] bg-[#1a1a1a] p-5 flex flex-col w-full min-h-[180px] justify-between hover:-translate-x-[6px] hover:-translate-y-[6px] rounded-xl before:absolute before:w-full before:h-full before:top-0 before:left-0 before:bg-[#1a1a1a] before:border before:border-[#333] before:rounded-xl before:translate-x-[6px] before:translate-y-[6px] before:z-[-1] before:transition-transform before:duration-300 group-hover:before:translate-x-[12px] group-hover:before:translate-y-[12px] after:absolute after:w-full after:h-full after:top-0 after:left-0 after:bg-[#1a1a1a] after:border after:border-[#333] after:rounded-xl after:translate-x-[12px] after:translate-y-[12px] after:z-[-2] after:transition-transform after:duration-300 group-hover:after:translate-x-[18px] group-hover:after:translate-y-[18px]"
                    >
                      <div className="flex justify-between items-start gap-4">
                        {/* Left Column: Title & Tags */}
                        <div className="flex-1 min-w-0 flex flex-col gap-3">
                          {/* Title Row */}
                          <div className="flex items-center gap-3">
                            <span className={`w-[58px] flex justify-center py-0.5 rounded border border-[#333] bg-[#111] uppercase font-rajdhani font-bold tracking-widest text-[10px] shrink-0 ${getSubjectBadgeClasses(set.subject)}`}>
                              {set.subject}
                            </span>
                            <h3 className="text-lg font-bold font-rajdhani tracking-wide text-[#E8E8E8] uppercase truncate flex-1">
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
                          <span className="w-[58px] flex justify-center py-0.5 rounded border border-[#333] bg-[#111] text-[#E8E8E8] font-rajdhani font-bold tracking-widest text-[10px] shrink-0 uppercase whitespace-nowrap">
                            {set.count} ITEMS
                          </span>
                          {/* Date String */}
                          <span className="text-[10px] text-gray-500 uppercase font-['IBM_Plex_Mono'] tracking-widest">
                            {set.createdAt ? new Date(set.createdAt * 1000).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase() : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Deck Description */}
                      {set.description && set.description.trim() !== "" && (
                        <p className="text-[11px] text-gray-400 font-['IBM_Plex_Mono'] leading-relaxed mt-2 line-clamp-2 uppercase pr-4">
                          {set.description}
                        </p>
                      )}

                      {/* Bottom Row: Progress and Actions */}
                      <div className="flex justify-between items-end mt-4 gap-4">
                        {/* Left Side: Progress Bar (Condensed Width) */}
                        <div className="flex-1 max-w-[200px]">
                          <div className="flex justify-between text-[10px] font-rajdhani tracking-widest mb-1 uppercase text-gray-500">
                            <span>MASTERY</span>
                            <span className="text-[#00FF41] font-bold">{set.mastery}%</span>
                          </div>
                      <div className="w-full bg-[#111] h-1 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${set.mastery}%` }}
                          className="h-full bg-[#00FF41] shadow-[0_0_8px_rgba(0,255,65,0.4)]"
                        />
                      </div>
                    </div>

                    {/* Right Side: Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/edit-deck/${set.id}`) }}
                        className="p-2 bg-[#111] border border-[#333] hover:border-[#555] text-gray-400 hover:text-white rounded transition-colors"
                        title="Edit Deck"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {set.id !== 'set-1' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSetToDelete(set); }}
                          className="p-2 bg-[#111] border border-[#333] hover:border-red-500/50 text-gray-500 hover:text-red-500 rounded transition-colors"
                          title="Delete Set"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {set.id.startsWith('topic_') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); window.electron.print.open(set.id, set.title) }}
                          className="p-2 bg-[#111] border border-[#333] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] text-gray-400 rounded transition-colors"
                          title="Test Paper View"
                        >
                          <ScrollText className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenLearn(set.id); }}
                        className="w-[105px] py-2 bg-[#111] border border-[#333] hover:border-[#00FF41] hover:text-[#00FF41] text-[#E8E8E8] rounded transition-colors font-rajdhani tracking-widest uppercase text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <Play className="w-3 h-3" />
                        Learn
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenTest(set.id); }}
                        className="w-[105px] py-2 bg-[#111] border border-[#333] hover:border-[#00FF41] hover:text-[#00FF41] text-[#E8E8E8] rounded transition-colors font-rajdhani tracking-widest uppercase text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <Trophy className="w-3 h-3" />
                        Test
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredAndSortedSets.length === 0 && (
              <div className="text-center py-20 text-[#888] font-rajdhani uppercase tracking-widest text-lg">
                No decks found{activeSubject !== 'ALL' ? ` for ${activeSubject}` : ''}. Import some from Add Decks.
              </div>
            )}
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
                  Are you absolutely sure you want to delete <strong className="text-white">{setToDelete.title}</strong>? This action cannot be undone and will permanently remove all {setToDelete.count} items in this set.
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
    </div>
  )
}
