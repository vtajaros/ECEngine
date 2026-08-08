import React, { useState } from 'react'
import { Play, Clock, FileText, Settings2, SkipForward } from 'lucide-react'
import { useSessionStore } from '../store/useSessionStore'
import { useExamTimer } from '../hooks/useExamTimer'
import { useIdleAwareTimer } from '../hooks/useIdleAwareTimer'
import { renderMath, renderPlainText } from '../lib/latex'
import { motion, AnimatePresence } from 'framer-motion'
import { MOCK_MCQS } from '../lib/mockData'
import { MCQData } from '../types'

export default function ExamMode() {
  const [isStarted, setIsStarted] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isRevealed, setIsRevealed] = useState(false)
  
  useIdleAwareTimer(isStarted)
  
  const [subjectFilter, setSubjectFilter] = useState('full')
  const [timeLimit, setTimeLimit] = useState('4h')

  const { startSession, currentDeck, currentIndex, isFinished, rateCard } = useSessionStore()
  const { formatted, start, pause, reset } = useExamTimer(4 * 3600, true) // 4 hours countdown

  const handleStartExam = () => {
    startSession(MOCK_MCQS as any) // Replace with selected subject data
    start()
    setIsStarted(true)
  }
  
  const handleExit = () => {
    pause()
    setIsStarted(false)
    startSession([])
    reset()
  }

  const progress = currentDeck.length > 0 ? (currentIndex / currentDeck.length) * 100 : 0
  const currentCard = currentDeck[currentIndex]
  
  if (isStarted) {
    return (
      <div className="h-full bg-[var(--bg-primary)] p-6 lg:p-10 flex flex-col relative overflow-y-auto show-scrollbar w-full">
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

        {/* Top Bar Navigation */}
        <div className="flex justify-between items-center mb-8 border-b border-[var(--bg-card)] pb-6 mt-4">
           <div className="flex items-center gap-4">
              <FileText className="text-[var(--accent-primary)]" size={28} />
              <div>
                <h2 className="text-[var(--text-primary)] font-['Orbitron'] font-bold text-xl tracking-wider">MOCK EXAM IN PROGRESS</h2>
                <div className="text-[var(--text-secondary)] font-['Rajdhani'] uppercase tracking-widest text-sm mt-1">
                  Item {currentIndex + 1} of {currentDeck.length}
                </div>
              </div>
           </div>

           <div className="flex items-center gap-8">
             <div className="flex items-center bg-[var(--bg-secondary)] border border-[var(--bg-card)] px-5 py-2.5 rounded shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
               <Clock className="text-[var(--color-warning)] mr-3" size={20} />
               <span className="font-['IBM_Plex_Mono'] text-xl font-bold text-[var(--text-primary)] tracking-widest">{formatted}</span>
             </div>
             <button 
               onClick={handleExit}
               className="px-5 py-2.5 bg-transparent border border-[var(--color-wrong)] text-[var(--color-wrong)] rounded hover:bg-[var(--color-wrong)] hover:text-[var(--bg-primary)] transition-colors font-['Rajdhani'] font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(255,51,51,0.2)] hover:shadow-[0_0_20px_rgba(255,51,51,0.5)]"
             >
               Forfeit Exam
             </button>
           </div>
        </div>

        {/* Mock Exam Content UI */}
        <div className="flex-1 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!isFinished && currentCard ? (
              <motion.div
                key={currentCard.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
                 className="w-full max-w-4xl bg-[var(--bg-card)] border border-[var(--bg-secondary)] rounded-lg p-6 shadow-2xl relative"
              >
                 <div className="flex justify-between items-start mb-6">
                    <span className="text-[var(--text-secondary)] font-['IBM_Plex_Mono'] text-sm tracking-wider">QUESTION {currentIndex + 1}</span>
                 </div>
                 
                  <div className="text-xl text-[var(--text-primary)] mb-6 leading-relaxed font-medium">
                   {(currentCard.data as MCQData).question}
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {(currentCard.data as MCQData).choices?.map((choice: string, idx: number) => {
                     let btnClass = "p-3 text-left border rounded transition-all font-['Rajdhani'] text-base group "
                     let prefixClass = "mr-3 font-['IBM_Plex_Mono'] transition-colors "
                     
                     if (isRevealed) {
                       const isCorrectAnswer = idx === (currentCard.data as MCQData).answer
                       const isSelectedAnswer = idx === selectedAnswer
                       
                       if (isCorrectAnswer) {
                         btnClass += "border-[var(--color-correct)] bg-[rgba(0,255,65,0.1)] text-[var(--color-correct)] shadow-[0_0_15px_rgba(0,255,65,0.15)] cursor-default"
                         prefixClass += "text-[var(--color-correct)] font-bold"
                       } else if (isSelectedAnswer && !isCorrectAnswer) {
                         btnClass += "border-[var(--color-wrong)] bg-[rgba(255,51,51,0.1)] text-[var(--color-wrong)] cursor-default"
                         prefixClass += "text-[var(--color-wrong)] font-bold"
                       } else {
                         btnClass += "border-[var(--text-muted)] bg-[var(--bg-secondary)] text-[var(--text-muted)] opacity-60 cursor-default"
                         prefixClass += "text-[var(--text-muted)]"
                       }
                     } else {
                       if (selectedAnswer === idx) {
                         btnClass += "border-[var(--accent-primary)] bg-[rgba(0,255,65,0.05)] text-[var(--text-primary)] cursor-default"
                         prefixClass += "text-[var(--accent-primary)]"
                       } else {
                         btnClass += "border-[var(--text-muted)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] hover:bg-[rgba(0,255,65,0.05)] cursor-pointer"
                         prefixClass += "text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)]"
                       }
                     }

                     let orderClass = ""
                     if (idx === 0) orderClass = "order-1"
                     else if (idx === 1) orderClass = "order-2 md:order-3"
                     else if (idx === 2) orderClass = "order-3 md:order-2"
                     else if (idx === 3) orderClass = "order-4"

                     return (
                       <button 
                         key={idx}
                         disabled={isRevealed}
                         onClick={() => {
                           setSelectedAnswer(idx)
                           setIsRevealed(true)
                         }}
                         className={`${btnClass} ${orderClass}`}
                       >
                         <span className={prefixClass}>
                           {String.fromCharCode(65 + idx)}.
                         </span>
                         <span dangerouslySetInnerHTML={{ __html: ((currentCard.data as MCQData).choicesPlainText?.[idx] ? renderPlainText : renderMath)(choice) }} className="flex-1 text-left" />
                       </button>
                     )
                   })}
                 </div>
                 
                 <div className="mt-8 flex justify-end gap-4">
                   {!isRevealed ? (
                     <button 
                       onClick={() => rateCard(1)} // Skip
                       className="flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-['Rajdhani'] uppercase tracking-widest"
                     >
                       Skip &amp; Review Later <SkipForward size={18} className="ml-2" />
                     </button>
                   ) : (
                     <button 
                       onClick={() => {
                         const correctIdx = (currentCard.data as MCQData).answer
                         const quality = selectedAnswer === correctIdx ? 4 : 1
                         setSelectedAnswer(null)
                         setIsRevealed(false)
                         rateCard(quality)
                       }}
                       className="flex items-center text-[var(--bg-primary)] bg-[var(--accent-primary)] px-6 py-2 rounded transition-colors font-['Rajdhani'] font-bold uppercase tracking-widest hover:bg-[var(--accent-dim)]"
                     >
                       Continue <Play size={16} className="ml-2 fill-[currentColor]" />
                     </button>
                   )}
                 </div>
              </motion.div>
            ) : (
              <motion.div 
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="text-5xl font-['Orbitron'] text-[var(--accent-primary)] font-bold mb-4 tracking-wider">EXAM FINISHED</div>
                <div className="text-[var(--text-secondary)] font-['Rajdhani'] text-xl uppercase tracking-widest">
                  Processing Results...
                </div>
                <button 
                  onClick={handleExit}
                  className="mt-8 px-8 py-3 border border-[var(--accent-primary)] text-[var(--accent-primary)] rounded hover:bg-[rgba(0,255,65,0.1)] transition-colors font-['Rajdhani'] text-lg tracking-widest uppercase"
                >
                  View Summary
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    )
  }

  return (
    <div className="h-full bg-[var(--bg-primary)] p-8 lg:p-12 overflow-y-auto show-scrollbar w-full">
      <header className="mb-10">
        <h1 className="font-['Orbitron'] text-4xl font-bold text-[var(--text-primary)] mb-2 tracking-wider flex items-center">
          <FileText className="text-[var(--accent-primary)] mr-4" size={36} />
          MOCK EXAM MODE
        </h1>
        <p className="text-[var(--text-secondary)] font-['Rajdhani'] text-lg uppercase tracking-widest">
          Simulate the actual Board Exam Environment
        </p>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-[var(--bg-secondary)] p-8 rounded-xl border border-[var(--bg-card)] shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[rgba(0,255,65,0.05)] rounded-bl-full group-hover:bg-[rgba(0,255,65,0.1)] transition-colors duration-500 pointer-events-none" />
          
          <h2 className="font-['Rajdhani'] font-bold text-2xl text-[var(--text-primary)] mb-8 uppercase tracking-wider flex items-center">
            <Settings2 className="mr-3 text-[var(--accent-primary)]" size={24} />
            Exam Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <div className="space-y-4">
              <label className="block text-sm font-['Rajdhani'] uppercase tracking-widest text-[var(--text-secondary)]">
                Subject Area
              </label>
              <select 
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--text-muted)] text-[var(--text-primary)] py-3 px-4 rounded font-['IBM_Plex_Mono'] focus:outline-none focus:border-[var(--accent-primary)] transition-colors focus:shadow-[0_0_10px_rgba(0,255,65,0.2)]"
              >
                <option value="full">Pre-Board Examination (Full)</option>
                <option value="math">Mathematics (100 Items)</option>
                <option value="elecs">Electronics Engineering (100 Items)</option>
                <option value="geas">General Engineering and Applied Sciences (100 Items)</option>
                <option value="est">Electronic Systems and Technologies (100 Items)</option>
              </select>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-['Rajdhani'] uppercase tracking-widest text-[var(--text-secondary)]">
                Time Limit
              </label>
              <select 
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--text-muted)] text-[var(--text-primary)] py-3 px-4 rounded font-['IBM_Plex_Mono'] focus:outline-none focus:border-[var(--accent-primary)] transition-colors focus:shadow-[0_0_10px_rgba(0,255,65,0.2)]"
              >
                <option value="4h">4 Hours (Standard)</option>
                <option value="2h">2 Hours (Half)</option>
                <option value="1h">1 Hour (Sprint)</option>
                <option value="unlimited">No Limit</option>
              </select>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] p-6 rounded border border-[var(--text-muted)] mb-10 flex items-start gap-4">
            <Clock className="text-[var(--color-warning)] mt-1 shrink-0" size={24} />
            <div>
              <h3 className="font-['Rajdhani'] text-[var(--color-warning)] text-lg font-bold tracking-wider mb-1">Strict Mode is ON</h3>
              <p className="text-[var(--text-secondary)] font-['IBM_Plex_Mono'] text-sm leading-relaxed">
                You cannot pause or exit the exam once started without forfeiting your score. Make sure you have uninterrupted time before proceeding.
              </p>
            </div>
          </div>

          <button 
            onClick={handleStartExam}
            className="w-full py-5 bg-[var(--accent-primary)] text-[var(--bg-primary)] rounded font-['Orbitron'] font-bold text-xl tracking-widest uppercase transition-all hover:bg-[var(--accent-dim)] shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)] flex items-center justify-center group"
          >
            <Play className="mr-3 fill-[currentColor] group-hover:scale-110 transition-transform" size={24} />
            Begin Mock Exam
          </button>
        </div>
      </div>
    </div>
  )
}
