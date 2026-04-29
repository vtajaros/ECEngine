import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlashDeck } from '../components/flashcard/FlashDeck'
import { MCQDeck } from '../components/mcq/MCQDeck'
import { LearnMode } from '../components/mcq/LearnMode'
import { TestMode } from '../components/mcq/TestMode'
import { MOCK_FLASHCARDS, MOCK_MCQS } from '../lib/mockData'
import { Play, ClipboardList, Plus, Settings2, X, Bookmark, Shuffle, Zap } from 'lucide-react'
import { useSessionStore } from '../store/useSessionStore'
import { motion, AnimatePresence } from 'framer-motion'

type StudyMode = 'flashcard' | 'mcq' | 'learn' | 'test'
type Subject = 'MATH' | 'GEAS' | 'ELECS' | 'EST'

const SUBJECTS: Subject[] = ['MATH', 'GEAS', 'ELECS', 'EST']

// Temporary Mock Sets for demonstration before DB integeration
const MOCK_SETS = [
  { id: 'set-1', title: 'Set Alpha — Diodes', description: 'Basic PN junction theory & applications', subject: 'ELECS', count: 20, mastery: 45 },
  { id: 'set-2', title: 'Set Beta — BJT', description: 'Transistor configurations and bias', subject: 'ELECS', count: 35, mastery: 12 },
  { id: 'set-3', title: 'Operational Amplifiers', description: 'Ideal op-amp characteristics and active filters', subject: 'ELECS', count: 25, mastery: 68 },
  { id: 'set-4', title: 'Calculus Fundamentals', description: 'Derivatives, Integrals, and Limits', subject: 'MATH', count: 50, mastery: 80 },
  { id: 'set-5', title: 'Differential Equations', description: 'First-order and linear DEs', subject: 'MATH', count: 30, mastery: 25 },
  { id: 'set-6', title: 'Thermodynamics', description: 'Laws of thermodynamics and cycles', subject: 'GEAS', count: 40, mastery: 10 },
  { id: 'set-7', title: 'Material Science', description: 'Stress, strain, and material properties', subject: 'GEAS', count: 25, mastery: 55 },
  { id: 'set-8', title: 'Digital Communications', description: 'Modulation, sampling, and PCM', subject: 'EST', count: 45, mastery: 30 },
]

export default function FlashcardStudy() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<StudyMode>('flashcard')
  const [activeSubject, setActiveSubject] = useState<Subject>('ELECS')
  
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [activeSessionTitle, setActiveSessionTitle] = useState('')
  const startSession = useSessionStore(state => state.startSession)
  const { currentDeck, currentIndex, isFinished } = useSessionStore()

  // Pre-Learn Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState<{ isOpen: boolean; setId: string | null }>({ isOpen: false, setId: null })
  const [learnSettings, setLearnSettings] = useState({
    type: 'MCQ', // 'MCQ', 'Flashcard', 'Written'
    shuffleQuestions: false,
    shuffleChoices: false,
    bookmarkedOnly: false
  })

  // Pre-Test Settings Modal State
  const [showTestModal, setShowTestModal] = useState<{ isOpen: boolean; setId: string | null }>({ isOpen: false, setId: null })
  const [testSettings, setTestSettings] = useState({
    instantChecking: false,
    shuffleQuestions: false,
    shuffleChoices: false,
    bookmarkedOnly: false
  })

  // Open learn settings
  const handleOpenLearn = (setId: string) => {
    setShowSettingsModal({ isOpen: true, setId })
  }

  // Open test settings
  const handleOpenTest = (setId: string) => {
    setShowTestModal({ isOpen: true, setId })
  }

  // Actually start learn mode
  const handleStartLearn = () => {
    const setId = showSettingsModal.setId
    if (!setId) return
    setMode('learn')
    setShowSettingsModal({ isOpen: false, setId: null })
    setIsSessionActive(true)

    const setInfo = MOCK_SETS.find(s => s.id === setId)
    if (setInfo) setActiveSessionTitle(setInfo.title)

    // Using MCQ Data for Learn stub implementation
    let filteredData = MOCK_MCQS;
    if (activeSubject === 'MATH') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('math') || c.topicId.includes('algebra'));
    else if (activeSubject === 'ELECS') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('elec') || c.topicId.includes('diode'));
    else if (activeSubject === 'GEAS') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('geas'));
    else if (activeSubject === 'EST') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('est') || c.topicId.includes('comms'));

    if (filteredData.length === 0) filteredData = MOCK_MCQS;

    // Apply basic shuffles if needed
    if (learnSettings.shuffleQuestions) {
      filteredData = [...filteredData].sort(() => Math.random() - 0.5)
    }

    startSession(filteredData as any)
  }

  const handleStartTest = () => {
    const setId = showTestModal.setId
    if (!setId) return
    setMode('test')
    setShowTestModal({ isOpen: false, setId: null })
    setIsSessionActive(true)

    const setInfo = MOCK_SETS.find(s => s.id === setId)
    if (setInfo) setActiveSessionTitle(setInfo.title)

    // Using MCQ Data for Test stub implementation
    let filteredData = MOCK_MCQS;
    if (activeSubject === 'MATH') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('math') || c.topicId.includes('algebra'));
    else if (activeSubject === 'ELECS') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('elec') || c.topicId.includes('diode'));
    else if (activeSubject === 'GEAS') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('geas'));
    else if (activeSubject === 'EST') filteredData = MOCK_MCQS.filter(c => c.topicId.includes('est') || c.topicId.includes('comms'));

    if (filteredData.length === 0) filteredData = MOCK_MCQS;

    if (testSettings.shuffleQuestions) {
      filteredData = [...filteredData].sort(() => Math.random() - 0.5)
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
            // handle summary or save to db
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
                
                {/* Question Type */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">Question Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['MCQ', 'Flashcard', 'Written'].map(type => (
                      <button
                        key={type}
                        onClick={() => setLearnSettings(s => ({ ...s, type }))}
                        className={`py-2 rounded font-['Rajdhani'] uppercase tracking-wider text-sm transition-all border ${
                          learnSettings.type === type 
                            ? 'bg-[rgba(0,255,65,0.1)] border-[#00FF41] text-[#00FF41]' 
                            : 'bg-[#161616] border-[#333] text-[#888] hover:border-[#555]'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

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
          STUDY <span className="text-[var(--accent-primary)]">HUB</span>
        </h1>

        <div className="flex gap-2 bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--bg-card)]">
          {SUBJECTS.map(subject => (
            <button
              key={subject}
              onClick={() => setActiveSubject(subject)}
              className={`px-4 py-2 rounded-md font-['Rajdhani'] tracking-widest text-sm font-bold transition-all ${
                activeSubject === subject
                  ? 'bg-[var(--accent-primary)] text-[#0D0D0D] shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                  : 'text-[var(--text-secondary)] hover:text-[#E8E8E8] hover:bg-[#1A1A1A]'
              }`}
            >
              {subject}
            </button>
          ))}
        </div>
      </div>

      {/* Deck Grid */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 pb-12 items-start">
        {MOCK_SETS.filter(s => s.subject === activeSubject).map(set => (
          <div 
            key={set.id} 
            className="bg-[var(--bg-card)] rounded-xl border border-[#222] hover:border-[var(--accent-dim)] transition-all hover:shadow-[0_0_20px_rgba(0,255,65,0.05)] overflow-hidden flex flex-col"
          >
            {/* Card Content */}
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-['Orbitron'] font-bold text-[var(--text-primary)] tracking-wide">{set.title}</h3>
                <span className="text-xs font-['Rajdhani'] px-2 py-1 bg-[#1A1A1A] text-[var(--accent-primary)] rounded border border-[#333]">
                  {set.count} Items
                </span>
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
    </div>
  )
}
