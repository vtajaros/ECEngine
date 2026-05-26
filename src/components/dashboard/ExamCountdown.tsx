import React, { useState, useEffect } from 'react'
import { Edit2, Calendar, X, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ExamCountdownProps {
  examDate: string           // 'YYYY-MM-DD'
  onExamDateChange: (date: string) => void
}

export default function ExamCountdown({ examDate, onExamDateChange }: ExamCountdownProps) {
  const calculateTimeLeft = (target: string) => {
    const targetDate = new Date(`${target}T00:00:00`).getTime()
    const now = new Date().getTime()
    const distance = targetDate - now

    if (distance < 0) return { days: 0, hours: 0, mins: 0, secs: 0 }

    return {
      days: Math.floor(distance / (1000 * 60 * 60 * 24)),
      hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      mins: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
      secs: Math.floor((distance % (1000 * 60)) / 1000)
    }
  }

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(examDate))
  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState(examDate)
  const [modalError, setModalError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(examDate))
    }, 1000)
    return () => clearInterval(timer)
  }, [examDate])

  const openDateModal = () => {
    setModalDate(examDate)
    setModalError(null)
    setModalOpen(true)
  }

  const closeDateModal = () => {
    setModalOpen(false)
    setModalError(null)
  }

  const handleModalDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setModalDate(val)
    if (!val) {
      setModalError('Please enter a date.')
      return
    }
    const chosen = new Date(val + 'T00:00:00')
    const today  = new Date()
    today.setHours(0, 0, 0, 0)
    if (chosen <= today) {
      setModalError('That date has already passed. Please choose a future date.')
    } else {
      setModalError(null)
    }
  }

  const confirmDateChange = () => {
    if (modalError || !modalDate) return
    const chosen = new Date(modalDate + 'T00:00:00')
    const today  = new Date()
    today.setHours(0, 0, 0, 0)
    if (chosen <= today) {
      setModalError('That date has already passed. Please choose a future date.')
      return
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(modalDate)) {
      setModalError('Invalid date format. Use YYYY-MM-DD.')
      return
    }
    const parsed = new Date(`${modalDate}T00:00:00`)
    if (isNaN(parsed.getTime())) {
      setModalError('Invalid date. Please enter a valid calendar date.')
      return
    }

    onExamDateChange(modalDate)
    setModalOpen(false)
    setModalError(null)
  }

  return (
    <>
      <div className="bg-[#111] border border-[#00FF41]/10 rounded-lg px-4 py-2 flex items-center gap-6 shadow-xl relative group">
        <button
          onClick={openDateModal}
          className="absolute -top-2 -right-2 p-1.5 bg-[#1A1A1A] border border-[#333] rounded-full text-[#666] hover:text-[#00FF41] opacity-70 hover:opacity-100 transition-all z-10 shadow-lg"
          title="Change exam date"
        >
          <Edit2 size={12} />
        </button>

        <div className="flex flex-col">
          <span className="text-[10px] font-['Orbitron'] text-[#00FF41] uppercase tracking-widest opacity-80">
            Exam Target
          </span>
          <span className="text-[11px] font-['Rajdhani'] text-[#888] uppercase tracking-widest font-bold">
            {new Date(examDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
          </span>
        </div>

        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold font-['IBM_Plex_Mono'] text-[#E8E8E8] leading-none">{timeLeft.days}</span>
            <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Days</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold font-['IBM_Plex_Mono'] text-[#E8E8E8] leading-none">{timeLeft.hours.toString().padStart(2, '0')}</span>
            <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Hrs</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold font-['IBM_Plex_Mono'] text-[#E8E8E8] leading-none">{timeLeft.mins.toString().padStart(2, '0')}</span>
            <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Min</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold font-['IBM_Plex_Mono'] text-[#00FF41] leading-none">{timeLeft.secs.toString().padStart(2, '0')}</span>
            <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Sec</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              key="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={closeDateModal}
            />
            <motion.div
              key="modal-dialog"
              initial={{ opacity: 0, scale: 0.95, y: -12 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{   opacity: 0, scale: 0.95,  y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-w-sm mx-4 bg-[#111] border border-[#2A2A2A] rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#1E1E1E]">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-[#00FF41]" size={16} />
                    <span className="font-['Rajdhani'] font-bold text-sm text-[#E8E8E8] uppercase tracking-widest">
                      Set Exam Target
                    </span>
                  </div>
                  <button
                    onClick={closeDateModal}
                    className="text-[#555] hover:text-[#E8E8E8] transition-colors p-1 rounded-lg hover:bg-[#1A1A1A]"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="px-6 py-6 space-y-5">
                  <div className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-[#555]">
                    Current target:&nbsp;
                    <span className="text-[#00FF41]">
                      {new Date(examDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-[#666]">
                      New Date
                    </label>
                    <input
                      type="date"
                      value={modalDate}
                      onChange={handleModalDateChange}
                      min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                      className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl px-4 py-3 text-[#E8E8E8] font-['IBM_Plex_Mono'] text-sm focus:outline-none focus:border-[#00FF41]/40 transition-colors [color-scheme:dark]"
                    />
                  </div>

                  <AnimatePresence mode="wait">
                    {modalError && (
                      <motion.div
                        key="modal-error"
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0,  height: 'auto' }}
                        exit={{   opacity: 0, y: -4,  height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                          <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={14} />
                          <span className="font-['Rajdhani'] text-red-400 text-xs font-bold leading-relaxed">
                            {modalError}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {modalDate && !modalError && (() => {
                      const d = Math.ceil(
                        (new Date(modalDate + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000
                      )
                      return d > 0 ? (
                        <motion.div
                          key="days-preview"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center justify-center gap-2 py-2"
                        >
                          <span className="font-['IBM_Plex_Mono'] text-2xl font-bold text-[#00FF41]">{d}</span>
                          <span className="font-['Rajdhani'] text-[#555] text-xs uppercase tracking-widest font-bold">
                            days until exam
                          </span>
                        </motion.div>
                      ) : null
                    })()}
                  </AnimatePresence>
                </div>

                <div className="flex gap-3 px-6 pb-6">
                  <button
                    onClick={closeDateModal}
                    className="flex-1 px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-[#888] font-['Rajdhani'] font-bold text-xs uppercase tracking-widest hover:text-[#E8E8E8] hover:bg-[#222] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDateChange}
                    disabled={!!modalError || !modalDate}
                    className="flex-1 px-4 py-2.5 rounded-xl font-['Rajdhani'] font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: (!modalError && modalDate) ? '#00FF41' : '#1A1A1A',
                      color: (!modalError && modalDate) ? '#000' : '#555',
                    }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
