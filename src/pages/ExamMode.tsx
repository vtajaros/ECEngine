import React, { useState } from 'react'
import { Play, Clock, FileText, Settings2, SkipForward } from 'lucide-react'
import { useSessionStore } from '../store/useSessionStore'
import { useExamTimer } from '../hooks/useExamTimer'
import { motion, AnimatePresence } from 'framer-motion'
import { MOCK_MCQS } from '../lib/mockData'

export default function ExamMode() {
  const [isStarted, setIsStarted] = useState(false)
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
      <div className="h-full bg-[#0D0D0D] p-6 lg:p-10 flex flex-col relative overflow-y-auto w-full">
        {/* Global Progress Bar */}
        {!isFinished && (
          <div className="fixed top-0 left-0 w-full bg-[#111111] h-1.5 z-50 shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
            <motion.div
              className="bg-[#00FF41] h-full shadow-[0_0_12px_rgba(0,255,65,0.8)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        {/* Top Bar Navigation */}
        <div className="flex justify-between items-center mb-8 border-b border-[#161616] pb-6 mt-4">
           <div className="flex items-center gap-4">
              <FileText className="text-[#00FF41]" size={28} />
              <div>
                <h2 className="text-[#E8E8E8] font-['Orbitron'] font-bold text-xl tracking-wider">MOCK EXAM IN PROGRESS</h2>
                <div className="text-[#888888] font-['Rajdhani'] uppercase tracking-widest text-sm mt-1">
                  Item {currentIndex + 1} of {currentDeck.length}
                </div>
              </div>
           </div>

           <div className="flex items-center gap-8">
             <div className="flex items-center bg-[#111111] border border-[#161616] px-5 py-2.5 rounded shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
               <Clock className="text-[#FFB800] mr-3" size={20} />
               <span className="font-['IBM_Plex_Mono'] text-xl font-bold text-[#E8E8E8] tracking-widest">{formatted}</span>
             </div>
             <button 
               onClick={handleExit}
               className="px-5 py-2.5 bg-transparent border border-[#FF3333] text-[#FF3333] rounded hover:bg-[#FF3333] hover:text-[#0D0D0D] transition-colors font-['Rajdhani'] font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(255,51,51,0.2)] hover:shadow-[0_0_20px_rgba(255,51,51,0.5)]"
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
                className="w-full max-w-4xl bg-[#161616] border border-[#111111] rounded-lg p-6 shadow-2xl relative"
              >
                 <div className="flex justify-between items-start mb-6">
                    <span className="text-[#888888] font-['IBM_Plex_Mono'] text-sm tracking-wider">QUESTION {currentIndex + 1}</span>
                 </div>
                 
                 <div className="text-xl text-[#E8E8E8] mb-6 leading-relaxed font-medium">
                   {(currentCard.data as any).question}
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {(currentCard.data as any).choices?.map((choice: string, idx: number) => (
                     <button 
                       key={idx}
                       onClick={() => rateCard(3)} // Simplified answering for Exam
                       className="p-3 text-left border border-[#222] rounded bg-[#111111] hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.05)] transition-all font-['Rajdhani'] text-base text-[#E8E8E8] group"
                     >
                       <span className="text-[#888888] mr-3 font-['IBM_Plex_Mono'] group-hover:text-[#00FF41] transition-colors">
                         {String.fromCharCode(65 + idx)}.
                       </span>
                       {choice}
                     </button>
                   ))}
                 </div>
                 
                 <div className="mt-8 flex justify-end">
                   <button 
                     onClick={() => rateCard(1)} // Skip
                     className="flex items-center text-[#888888] hover:text-[#E8E8E8] transition-colors font-['Rajdhani'] uppercase tracking-widest"
                   >
                     Skip &amp; Review Later <SkipForward size={18} className="ml-2" />
                   </button>
                 </div>
              </motion.div>
            ) : (
              <motion.div 
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="text-5xl font-['Orbitron'] text-[#00FF41] font-bold mb-4 tracking-wider">EXAM FINISHED</div>
                <div className="text-[#888888] font-['Rajdhani'] text-xl uppercase tracking-widest">
                  Processing Results...
                </div>
                <button 
                  onClick={handleExit}
                  className="mt-8 px-8 py-3 border border-[#00FF41] text-[#00FF41] rounded hover:bg-[rgba(0,255,65,0.1)] transition-colors font-['Rajdhani'] text-lg tracking-widest uppercase"
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
    <div className="h-full bg-[#0D0D0D] p-8 lg:p-12 overflow-y-auto w-full">
      <header className="mb-10">
        <h1 className="font-['Orbitron'] text-4xl font-bold text-[#E8E8E8] mb-2 tracking-wider flex items-center">
          <FileText className="text-[#00FF41] mr-4" size={36} />
          MOCK EXAM MODE
        </h1>
        <p className="text-[#888888] font-['Rajdhani'] text-lg uppercase tracking-widest">
          Simulate the actual Board Exam Environment
        </p>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-[#111111] p-8 rounded-xl border border-[#161616] shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[rgba(0,255,65,0.05)] rounded-bl-full group-hover:bg-[rgba(0,255,65,0.1)] transition-colors duration-500 pointer-events-none" />
          
          <h2 className="font-['Rajdhani'] font-bold text-2xl text-[#E8E8E8] mb-8 uppercase tracking-wider flex items-center">
            <Settings2 className="mr-3 text-[#00FF41]" size={24} />
            Exam Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <div className="space-y-4">
              <label className="block text-sm font-['Rajdhani'] uppercase tracking-widest text-[#888888]">
                Subject Area
              </label>
              <select className="w-full bg-[#161616] border border-[#222] text-[#E8E8E8] py-3 px-4 rounded font-['IBM_Plex_Mono'] focus:outline-none focus:border-[#00FF41] transition-colors focus:shadow-[0_0_10px_rgba(0,255,65,0.2)]">
                <option>Pre-Board Examination (Full)</option>
                <option>Mathematics (100 Items)</option>
                <option>Electronics Engineering (100 Items)</option>
                <option>General Engineering and Applied Sciences (100 Items)</option>
                <option>Electronic Systems and Technologies (100 Items)</option>
              </select>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-['Rajdhani'] uppercase tracking-widest text-[#888888]">
                Time Limit
              </label>
              <select className="w-full bg-[#161616] border border-[#222] text-[#E8E8E8] py-3 px-4 rounded font-['IBM_Plex_Mono'] focus:outline-none focus:border-[#00FF41] transition-colors focus:shadow-[0_0_10px_rgba(0,255,65,0.2)]">
                <option>4 Hours (Standard)</option>
                <option>2 Hours (Half)</option>
                <option>1 Hour (Sprint)</option>
                <option>No Limit</option>
              </select>
            </div>
          </div>

          <div className="bg-[#161616] p-6 rounded border border-[#222] mb-10 flex items-start gap-4">
            <Clock className="text-[#FFB800] mt-1 shrink-0" size={24} />
            <div>
              <h3 className="font-['Rajdhani'] text-[#FFB800] text-lg font-bold tracking-wider mb-1">Strict Mode is ON</h3>
              <p className="text-[#888888] font-['IBM_Plex_Mono'] text-sm leading-relaxed">
                You cannot pause or exit the exam once started without forfeiting your score. Make sure you have uninterrupted time before proceeding.
              </p>
            </div>
          </div>

          <button 
            onClick={handleStartExam}
            className="w-full py-5 bg-[#00FF41] text-[#0D0D0D] rounded font-['Orbitron'] font-bold text-xl tracking-widest uppercase transition-all hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)] flex items-center justify-center group"
          >
            <Play className="mr-3 fill-[currentColor] group-hover:scale-110 transition-transform" size={24} />
            Begin Mock Exam
          </button>
        </div>
      </div>
    </div>
  )
}
