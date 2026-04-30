import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlashDeck } from '../components/flashcard/FlashDeck'
import { MCQDeck } from '../components/mcq/MCQDeck'
import { LearnMode } from '../components/mcq/LearnMode'
import { TestMode } from '../components/mcq/TestMode'
import { MOCK_FLASHCARDS, MOCK_MCQS } from '../lib/mockData'
import { Play, Filter, LayoutGrid, CheckCircle2, ChevronRight, Bookmark, X, Settings2, Trash2, AlertTriangle, ClipboardList, Shuffle, Zap } from 'lucide-react'
import { getSubjectFilterClasses, getSubjectBadgeClasses } from '../lib/subjectColors'
import { useSessionStore } from '../store/useSessionStore'
import { motion, AnimatePresence } from 'framer-motion'
import { shuffle, shuffleChoices } from '../lib/scrambler'

type StudyMode = 'flashcard' | 'mcq' | 'learn' | 'test'
type Subject = 'MATH' | 'GEAS' | 'ELECS' | 'EST'

const SUBJECTS: Subject[] = ['MATH', 'GEAS', 'ELECS', 'EST']

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
}

// Removed Mock Sets

export default function FlashcardStudy() {
  const navigate = useNavigate()
  const [allSets, setAllSets] = useState<StudySet[]>([])
  const [setToDelete, setSetToDelete] = useState<StudySet | null>(null)
  const [deleteCountdown, setDeleteCountdown] = useState(0)

  // Load user-created sets from DB on mount
  useEffect(() => {
    async function loadDBSets() {
      try {
        if (!window.electron?.db) return
        const topicsResult = await window.electron.db.query(
          `SELECT t.id, t.name, t.subject, t.description, COUNT(c.id) as card_count,
                  GROUP_CONCAT(DISTINCT c.type) as types
           FROM topics t LEFT JOIN cards c ON c.topic_id = t.id
           GROUP BY t.id`
        )
        if (topicsResult.success && topicsResult.data) {
          const dbSets: StudySet[] = topicsResult.data.map((row: any) => {
            const types = (row.types || '').split(',')
            let deckType: 'mcq' | 'flashcard' | 'mixed' = 'mcq'
            if (types.includes('mcq') && types.includes('flashcard')) deckType = 'mixed'
            else if (types.includes('flashcard')) deckType = 'flashcard'

            return {
              id: row.id,
              title: row.name,
              description: row.description || 'User-created set',
              subject: SUBJECT_MAP[row.subject] || 'ELECS',
              count: row.card_count || 0,
              mastery: JSON.parse(localStorage.getItem('setMastery') || '{}')[row.id] || 0,
              deckType,
            }
          })
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
  const [activeSubject, setActiveSubject] = useState<Subject>('ELECS')
  
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [activeSessionTitle, setActiveSessionTitle] = useState('')
  const [activeSessionSetId, setActiveSessionSetId] = useState('')
  const startSession = useSessionStore(state => state.startSession)
  const { currentDeck, currentIndex, isFinished } = useSessionStore()

  // Pre-Learn Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState<{ isOpen: boolean; setId: string | null }>({ isOpen: false, setId: null })
  const [learnSettings, setLearnSettings] = useState({
    type: 'MCQ', // 'MCQ', 'Flashcard', 'Written'
    shuffleQuestions: false,
    shuffleChoices: false,
    bookmarkedOnly: false,
    itemCount: 'All' as 'All' | number
  })

  // Pre-Test Settings Modal State
  const [showTestModal, setShowTestModal] = useState<{ isOpen: boolean; setId: string | null }>({ isOpen: false, setId: null })
  const [testSettings, setTestSettings] = useState({
    instantChecking: false,
    shuffleQuestions: false,
    shuffleChoices: false,
    bookmarkedOnly: false,
    itemCount: 'All' as 'All' | number
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
            const total = stats.correct + stats.wrong;
            if (total > 0 && activeSessionSetId) {
              const runMastery = Math.round((stats.correct / total) * 100);
              setAllSets(prev => prev.map(s => {
                if (s.id === activeSessionSetId) {
                  const newMastery = s.mastery === 0 ? runMastery : Math.round((s.mastery + runMastery) / 2);
                  const saved = JSON.parse(localStorage.getItem('setMastery') || '{}');
                  saved[s.id] = newMastery;
                  localStorage.setItem('setMastery', JSON.stringify(saved));
                  return { ...s, mastery: newMastery };
                }
                return s;
              }));
            }
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
            // handle summary or save to db
          }}
          onExit={() => setIsSessionActive(false)} 
        />
      )
    }

    return (
      <div className="h-full bg-[var(--bg-primary)] p-6 lg:p-10 flex flex-col relative overflow-y-auto w-full">
        <button 
          onClick={() => { setIsSessionActive(false); startSession([]) }}
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
    <div className="h-full bg-[var(--bg-primary)] p-6 lg:p-12 flex flex-col items-center justify-start overflow-y-auto w-full">
      {/* Learn Settings Modal */}
      <AnimatePresence>
        {showSettingsModal.isOpen && (
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
              className="bg-[#111] border border-[#333] rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#222] flex justify-between items-center bg-[#161616]">
                <div className="flex items-center gap-3">
                  <Settings2 className="w-5 h-5 text-[#00FF41]" />
                  <h2 className="text-xl font-bold text-[#E8E8E8] font-['Orbitron'] uppercase tracking-wider">
                    Learn Settings
                  </h2>
                </div>
                <button 
                  onClick={() => setShowSettingsModal({ isOpen: false, setId: null })}
                  className="text-[#888] hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col gap-6">

                {/* Item Count */}
                {(() => {
                  const setInfo = allSets.find(s => s.id === showSettingsModal.setId)
                  if (!setInfo || setInfo.count <= 20) return null
                  
                  const options = ['All', ...[20, 50, 100].filter(c => c < setInfo.count)]
                  return (
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">Number of Items</label>
                      <div className="grid grid-cols-4 gap-2">
                        {options.map(count => (
                          <button
                            key={count}
                            onClick={() => setLearnSettings(s => ({ ...s, itemCount: count as any }))}
                            className={`py-2 rounded font-['Rajdhani'] uppercase tracking-wider text-sm transition-all border ${
                              learnSettings.itemCount === count 
                                ? 'bg-[rgba(0,255,65,0.1)] border-[#00FF41] text-[#00FF41]' 
                                : 'bg-[#161616] border-[#333] text-[#888] hover:border-[#555]'
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                        <input
                          type="number"
                          min="1"
                          max={setInfo.count}
                          placeholder="Custom"
                          value={typeof learnSettings.itemCount === 'number' && !options.includes(learnSettings.itemCount) ? learnSettings.itemCount : ''}
                          onChange={e => {
                            if (e.target.value === '') {
                              setLearnSettings(s => ({ ...s, itemCount: 'All' }))
                              return
                            }
                            const val = parseInt(e.target.value)
                            if (!isNaN(val)) {
                              setLearnSettings(s => ({ ...s, itemCount: Math.min(Math.max(val, 1), setInfo.count) }))
                            }
                          }}
                          className={`py-2 px-1 rounded font-['Rajdhani'] uppercase tracking-wider text-sm transition-all border outline-none text-center bg-[#161616] ${
                            typeof learnSettings.itemCount === 'number' && !options.includes(learnSettings.itemCount)
                              ? 'bg-[rgba(0,255,65,0.1)] border-[#00FF41] text-[#00FF41]' 
                              : 'border-[#333] text-[#888] hover:border-[#555] focus:border-[#555] placeholder-[#555]'
                          }`}
                        />
                      </div>
                    </div>
                  )
                })()}

                {/* Toggles */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">Modifiers</label>
                  
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setLearnSettings(s => ({ ...s, shuffleQuestions: !s.shuffleQuestions }))}
                      className="flex items-center justify-between p-3 bg-[#161616] rounded border border-[#222] hover:border-[#333] transition-colors"
                    >
                      <div className="flex items-center gap-3 text-[#E8E8E8] font-['Rajdhani'] tracking-wider text-sm">
                        <Shuffle className="w-4 h-4 text-[#888]" />
                        Shuffle Questions
                      </div>
                      <div className={`w-10 h-5 rounded-full transition-colors relative ${learnSettings.shuffleQuestions ? 'bg-[rgba(0,255,65,0.2)]' : 'bg-[#222]'}`}>
                        <div className={`absolute top-1 max-w-[calc(100%-8px)] h-3 w-3 rounded-full transition-all ${learnSettings.shuffleQuestions ? 'bg-[#00FF41] left-6' : 'bg-[#888] left-1'}`} />
                      </div>
                    </button>

                    <button 
                      onClick={() => setLearnSettings(s => ({ ...s, shuffleChoices: !s.shuffleChoices }))}
                      className="flex items-center justify-between p-3 bg-[#161616] rounded border border-[#222] hover:border-[#333] transition-colors"
                    >
                      <div className="flex items-center gap-3 text-[#E8E8E8] font-['Rajdhani'] tracking-wider text-sm">
                        <Shuffle className="w-4 h-4 text-[#888]" />
                        Shuffle Choices
                      </div>
                      <div className={`w-10 h-5 rounded-full transition-colors relative ${learnSettings.shuffleChoices ? 'bg-[rgba(0,255,65,0.2)]' : 'bg-[#222]'}`}>
                        <div className={`absolute top-1 max-w-[calc(100%-8px)] h-3 w-3 rounded-full transition-all ${learnSettings.shuffleChoices ? 'bg-[#00FF41] left-6' : 'bg-[#888] left-1'}`} />
                      </div>
                    </button>

                    <button 
                      onClick={() => setLearnSettings(s => ({ ...s, bookmarkedOnly: !s.bookmarkedOnly }))}
                      className="flex items-center justify-between p-3 bg-[#161616] rounded border border-[#222] hover:border-[#333] transition-colors"
                    >
                      <div className="flex items-center gap-3 text-[#E8E8E8] font-['Rajdhani'] tracking-wider text-sm">
                        <Bookmark className="w-4 h-4 text-[#888]" />
                        Bookmarked Only
                      </div>
                      <div className={`w-10 h-5 rounded-full transition-colors relative ${learnSettings.bookmarkedOnly ? 'bg-[rgba(0,255,65,0.2)]' : 'bg-[#222]'}`}>
                        <div className={`absolute top-1 max-w-[calc(100%-8px)] h-3 w-3 rounded-full transition-all ${learnSettings.bookmarkedOnly ? 'bg-[#00FF41] left-6' : 'bg-[#888] left-1'}`} />
                      </div>
                    </button>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#222] bg-[#161616] flex justify-end gap-3">
                <button 
                  onClick={() => setShowSettingsModal({ isOpen: false, setId: null })}
                  className="px-5 py-2 rounded bg-transparent border border-[#333] text-[#888] hover:text-[#E8E8E8] hover:border-[#555] transition-colors font-['Rajdhani'] uppercase tracking-wider text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleStartLearn}
                  className="flex items-center px-6 py-2 rounded bg-[#00FF41] text-black font-bold hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all font-['Rajdhani'] uppercase tracking-wider text-sm"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Start Session
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test Settings Modal */}
      <AnimatePresence>
        {showTestModal.isOpen && (
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
              className="bg-[#111] border border-[#333] rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#222] flex justify-between items-center bg-[#161616]">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-5 h-5 text-[#00FF41]" />
                  <h2 className="text-xl font-bold text-[#E8E8E8] font-['Orbitron'] uppercase tracking-wider">
                    Test Settings
                  </h2>
                </div>
                <button 
                  onClick={() => setShowTestModal({ isOpen: false, setId: null })}
                  className="text-[#888] hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col gap-6">
                
                {/* Item Count */}
                {(() => {
                  const setInfo = allSets.find(s => s.id === showTestModal.setId)
                  if (!setInfo || setInfo.count <= 20) return null
                  
                  const options = ['All', ...[20, 50, 100].filter(c => c < setInfo.count)]
                  return (
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">Number of Items</label>
                      <div className="grid grid-cols-4 gap-2">
                        {options.map(count => (
                          <button
                            key={count}
                            onClick={() => setTestSettings(s => ({ ...s, itemCount: count as any }))}
                            className={`py-2 rounded font-['Rajdhani'] uppercase tracking-wider text-sm transition-all border ${
                              testSettings.itemCount === count 
                                ? 'bg-[rgba(0,255,65,0.1)] border-[#00FF41] text-[#00FF41]' 
                                : 'bg-[#161616] border-[#333] text-[#888] hover:border-[#555]'
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                        <input
                          type="number"
                          min="1"
                          max={setInfo.count}
                          placeholder="Custom"
                          value={typeof testSettings.itemCount === 'number' && !options.includes(testSettings.itemCount) ? testSettings.itemCount : ''}
                          onChange={e => {
                            if (e.target.value === '') {
                              setTestSettings(s => ({ ...s, itemCount: 'All' }))
                              return
                            }
                            const val = parseInt(e.target.value)
                            if (!isNaN(val)) {
                              setTestSettings(s => ({ ...s, itemCount: Math.min(Math.max(val, 1), setInfo.count) }))
                            }
                          }}
                          className={`py-2 px-1 rounded font-['Rajdhani'] uppercase tracking-wider text-sm transition-all border outline-none text-center bg-[#161616] ${
                            typeof testSettings.itemCount === 'number' && !options.includes(testSettings.itemCount)
                              ? 'bg-[rgba(0,255,65,0.1)] border-[#00FF41] text-[#00FF41]' 
                              : 'border-[#333] text-[#888] hover:border-[#555] focus:border-[#555] placeholder-[#555]'
                          }`}
                        />
                      </div>
                    </div>
                  )
                })()}

                {/* Toggles */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">Options</label>
                  
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setTestSettings(s => ({ ...s, instantChecking: !s.instantChecking }))}
                      className="flex items-center justify-between p-3 bg-[#161616] rounded border border-[#222] hover:border-[#333] transition-colors"
                    >
                      <div className="flex items-center gap-3 text-[#E8E8E8] font-['Rajdhani'] tracking-wider text-sm">
                        <Zap className="w-4 h-4 text-[#888]" />
                        Instant Checking
                      </div>
                      <div className={`w-10 h-5 rounded-full transition-colors relative ${testSettings.instantChecking ? 'bg-[rgba(0,255,65,0.2)]' : 'bg-[#222]'}`}>
                        <div className={`absolute top-1 max-w-[calc(100%-8px)] h-3 w-3 rounded-full transition-all ${testSettings.instantChecking ? 'bg-[#00FF41] left-6' : 'bg-[#888] left-1'}`} />
                      </div>
                    </button>

                    <button 
                      onClick={() => setTestSettings(s => ({ ...s, shuffleQuestions: !s.shuffleQuestions }))}
                      className="flex items-center justify-between p-3 bg-[#161616] rounded border border-[#222] hover:border-[#333] transition-colors"
                    >
                      <div className="flex items-center gap-3 text-[#E8E8E8] font-['Rajdhani'] tracking-wider text-sm">
                        <Shuffle className="w-4 h-4 text-[#888]" />
                        Shuffle Questions
                      </div>
                      <div className={`w-10 h-5 rounded-full transition-colors relative ${testSettings.shuffleQuestions ? 'bg-[rgba(0,255,65,0.2)]' : 'bg-[#222]'}`}>
                        <div className={`absolute top-1 max-w-[calc(100%-8px)] h-3 w-3 rounded-full transition-all ${testSettings.shuffleQuestions ? 'bg-[#00FF41] left-6' : 'bg-[#888] left-1'}`} />
                      </div>
                    </button>

                    <button 
                      onClick={() => setTestSettings(s => ({ ...s, shuffleChoices: !s.shuffleChoices }))}
                      className="flex items-center justify-between p-3 bg-[#161616] rounded border border-[#222] hover:border-[#333] transition-colors"
                    >
                      <div className="flex items-center gap-3 text-[#E8E8E8] font-['Rajdhani'] tracking-wider text-sm">
                        <Shuffle className="w-4 h-4 text-[#888]" />
                        Shuffle Choices
                      </div>
                      <div className={`w-10 h-5 rounded-full transition-colors relative ${testSettings.shuffleChoices ? 'bg-[rgba(0,255,65,0.2)]' : 'bg-[#222]'}`}>
                        <div className={`absolute top-1 max-w-[calc(100%-8px)] h-3 w-3 rounded-full transition-all ${testSettings.shuffleChoices ? 'bg-[#00FF41] left-6' : 'bg-[#888] left-1'}`} />
                      </div>
                    </button>

                    <button 
                      onClick={() => setTestSettings(s => ({ ...s, bookmarkedOnly: !s.bookmarkedOnly }))}
                      className="flex items-center justify-between p-3 bg-[#161616] rounded border border-[#222] hover:border-[#333] transition-colors"
                    >
                      <div className="flex items-center gap-3 text-[#E8E8E8] font-['Rajdhani'] tracking-wider text-sm">
                        <Bookmark className="w-4 h-4 text-[#888]" />
                        Bookmarked Only
                      </div>
                      <div className={`w-10 h-5 rounded-full transition-colors relative ${testSettings.bookmarkedOnly ? 'bg-[rgba(0,255,65,0.2)]' : 'bg-[#222]'}`}>
                        <div className={`absolute top-1 max-w-[calc(100%-8px)] h-3 w-3 rounded-full transition-all ${testSettings.bookmarkedOnly ? 'bg-[#00FF41] left-6' : 'bg-[#888] left-1'}`} />
                      </div>
                    </button>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-6 border-t border-[#222] bg-[#161616] flex justify-end gap-3">
                <button 
                  onClick={() => setShowTestModal({ isOpen: false, setId: null })}
                  className="px-5 py-2 rounded bg-transparent border border-[#333] text-[#888] hover:text-[#E8E8E8] hover:border-[#555] transition-colors font-['Rajdhani'] uppercase tracking-wider text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleStartTest}
                  className="flex items-center px-6 py-2 rounded bg-[var(--accent-primary)] text-black font-bold hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all font-['Rajdhani'] uppercase tracking-wider text-sm"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Start Test
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subject Selector Header */}
      <div className="w-full max-w-4xl mb-10 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-[var(--bg-card)] pb-6 relative z-10 pt-4">
        <h1 className="text-3xl lg:text-4xl font-['Orbitron'] text-[var(--text-primary)] tracking-wider font-bold">
          LOOKS<span className="text-[var(--accent-primary)]">FAM</span>
        </h1>

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

      {/* Deck Grid */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 pb-12 items-start">
        {allSets.filter(s => s.subject === activeSubject).map(set => (
          <div 
            key={set.id} 
            className="bg-[var(--bg-card)] rounded-xl border border-[#222] hover:border-[var(--accent-dim)] transition-all hover:shadow-[0_0_20px_rgba(0,255,65,0.05)] overflow-hidden flex flex-col"
          >
            {/* Card Content */}
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4 gap-2">
                <div className="flex flex-col flex-1 gap-1">
                  <h3 className="text-xl font-['Orbitron'] font-bold text-[var(--text-primary)] tracking-wide">{set.title}</h3>
                  {set.deckType && (
                    <span className={`w-fit text-[10px] font-['IBM_Plex_Mono'] font-bold px-2 py-0.5 rounded border shrink-0 uppercase ${
                      set.deckType === 'mcq'
                        ? 'text-[#00BFFF] border-[#00BFFF]/30 bg-[#00BFFF]/10'
                        : set.deckType === 'mixed'
                        ? 'text-[#B983FF] border-[#B983FF]/30 bg-[#B983FF]/10'
                        : 'text-[#00FF41] border-[#00FF41]/30 bg-[#00FF41]/10'
                    }`}>
                      {set.deckType === 'mixed' ? 'MIX' : set.deckType === 'mcq' ? 'MCQ' : 'FC'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-['Rajdhani'] px-2 py-1 bg-[#1A1A1A] rounded border whitespace-nowrap ${getSubjectBadgeClasses(set.subject)}`}>
                    {set.count} Items
                  </span>
                  {set.id !== 'set-1' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSetToDelete(set); }}
                      className="p-1.5 text-[#555] hover:text-[#FF3333] bg-[#1A1A1A] rounded border border-[#333] hover:border-[#FF3333] transition-colors shrink-0"
                      title="Delete Set"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[#888888] text-sm mb-6 flex-1">{set.description}</p>
              
              {/* Mastery Bar */}
              <div className="mt-auto">
                <div className="flex justify-between text-xs font-['Rajdhani'] tracking-widest mb-2">
                  <span className="text-[var(--text-secondary)] uppercase">Mastery</span>
                  <span className="text-[var(--accent-primary)] font-bold">{set.mastery}%</span>
                </div>
                <div className="w-full bg-[var(--bg-secondary)] h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${set.mastery}%` }}
                    className="h-full bg-[var(--accent-primary)] shadow-[0_0_10px_rgba(0,255,65,0.4)]"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons (Always Visible) */}
            <div className="border-t border-[var(--bg-secondary)] py-4 px-6 grid grid-cols-2 gap-4 bg-[var(--bg-elevated)] mt-auto">
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenLearn(set.id); }}
                className="py-2 flex items-center justify-center bg-[var(--bg-secondary)] border border-[#333] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] text-[var(--text-primary)] rounded transition-colors font-['Rajdhani'] tracking-widest uppercase text-sm font-bold"
              >
                <Play className="w-4 h-4 mr-2" />
                Learn
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpenTest(set.id); }}
                className="py-2 flex items-center justify-center bg-[var(--accent-primary)] text-black rounded transition-colors hover:bg-[var(--accent-dim)] font-['Rajdhani'] tracking-widest font-bold uppercase text-sm shadow-[0_0_10px_rgba(0,255,65,0.1)]"
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                Test
              </button>
            </div>
          </div>
        ))}
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
                  Delete Flashcard Set
                </h2>
              </div>
              <div className="p-6">
                <p className="text-[#888] font-['Outfit'] mb-4">
                  Are you absolutely sure you want to delete <strong className="text-[#E8E8E8]">{setToDelete.title}</strong>? 
                  This action cannot be undone and will permanently remove all {setToDelete.count} questions inside this set.
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
                  {deleteCountdown > 0 ? `Confirm (${deleteCountdown}s)` : 'Confirm Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
