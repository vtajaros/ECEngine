import React, { useState } from 'react'
import { FlashDeck } from '../components/flashcard/FlashDeck'
import { MCQDeck } from '../components/mcq/MCQDeck'
import { MOCK_FLASHCARDS, MOCK_MCQS } from '../lib/mockData'
import { Play } from 'lucide-react'

type StudyMode = 'flashcard' | 'mcq'
type ItemCount = 10 | 25 | 50 | 'all'

export default function FlashcardStudy() {
  const [mode, setMode] = useState<StudyMode>('flashcard')
  const [topic, setTopic] = useState('electronics')
  const [count, setCount] = useState<ItemCount>(10)
  const [isSessionActive, setIsSessionActive] = useState(false)

  const handleStart = () => {
    setIsSessionActive(true)
  }

  const handleComplete = () => {
    // Show summary or something, deck handled it mostly
    // setIsSessionActive(false)
  }

  if (isSessionActive) {
    return (
      <div className="h-full bg-[#0D0D0D] p-6 lg:p-10 flex flex-col relative overflow-y-auto w-full">
        <button 
          onClick={() => setIsSessionActive(false)}
          className="absolute top-6 right-6 px-4 py-2 bg-[#111111] text-[#888888] rounded border border-[#161616] hover:text-[#E8E8E8] hover:border-[rgba(0,255,65,0.3)] transition-colors font-['Rajdhani'] uppercase tracking-wider z-50"
        >
          Exit Session
        </button>
        {mode === 'flashcard' && <FlashDeck cards={MOCK_FLASHCARDS} onComplete={handleComplete} />}
        {mode === 'mcq' && <MCQDeck cards={MOCK_MCQS} onComplete={handleComplete} />}
      </div>
    )
  }

  return (
    <div className="h-full bg-[#0D0D0D] p-6 lg:p-12 flex items-center justify-center overflow-y-auto">
      <div className="w-full max-w-xl mx-auto bg-[#161616] border border-[#111111] rounded-lg shadow-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col">
        
        {/* Header Tabs */}
        <div className="flex border-b border-[#111111] flex-none">
          <button
            onClick={() => setMode('flashcard')}
            className={`flex-1 py-5 text-center font-['Orbitron'] tracking-wider text-sm transition-colors ${
              mode === 'flashcard' 
                ? 'bg-[#111111] text-[#00FF41] border-b-2 border-[#00FF41]' 
                : 'text-[#888888] hover:text-[#E8E8E8] hover:bg-[#161616]'
            }`}
          >
            Flashcards
          </button>
          <button
            onClick={() => setMode('mcq')}
            className={`flex-1 py-5 text-center font-['Orbitron'] tracking-wider text-sm transition-colors ${
              mode === 'mcq' 
                ? 'bg-[#111111] text-[#00FF41] border-b-2 border-[#00FF41]' 
                : 'text-[#888888] hover:text-[#E8E8E8] hover:bg-[#161616]'
            }`}
          >
            MCQ Quiz
          </button>
        </div>

        {/* Content Body */}
        <div className="p-8 md:p-10 space-y-8 flex-1">
          
          <div className="space-y-3">
            <label className="block text-sm font-['Rajdhani'] uppercase tracking-widest text-[#888888]">
              Select Topic
            </label>
            <div className="relative">
              <select 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full bg-[#111111] border border-[#161616] text-[#E8E8E8] py-3 px-4 rounded appearance-none font-['IBM_Plex_Mono'] focus:outline-none focus:border-[rgba(0,255,65,0.5)] transition-colors"
                style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
              >
                <option value="electronics">Electronics Engineering</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#00FF41]">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-['Rajdhani'] uppercase tracking-widest text-[#888888]">
              Number of Items
            </label>
            <div className="flex bg-[#111111] border border-[#161616] rounded p-1">
              {[10, 25, 50, 'all'].map((val) => (
                <button
                  key={val}
                  onClick={() => setCount(val as ItemCount)}
                  className={`flex-1 py-2 text-sm font-['IBM_Plex_Mono'] rounded transition-all ${
                    count === val 
                      ? 'bg-[#161616] text-[#E8E8E8] border border-[#161616] shadow-[inset_0_0_8px_rgba(0,0,0,0.5)]' 
                      : 'text-[#888888] hover:text-[#E8E8E8]'
                  }`}
                >
                  {typeof val === 'string' ? 'ALL' : val}
                </button>
              ))}
            </div>
            <div className="text-right text-[#888888] text-xs font-['Rajdhani'] mt-2">
              Cards available: {mode === 'flashcard' ? MOCK_FLASHCARDS.length : MOCK_MCQS.length}
            </div>
          </div>

          <button 
            onClick={handleStart}
            className="w-full py-4 mt-8 bg-[#00FF41] text-[#0D0D0D] rounded font-['Orbitron'] font-bold tracking-widest uppercase transition-all hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)] flex items-center justify-center group"
          >
            <Play className="mr-3 fill-current w-5 h-5 group-hover:scale-110 transition-transform" />
            Start Session
          </button>
          
        </div>
      </div>
    </div>
  )
}
