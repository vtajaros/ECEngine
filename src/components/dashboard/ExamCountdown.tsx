import React, { useState, useEffect } from 'react'
import { Edit2, Calendar, X, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tooltip } from '../ui/Tooltip'

interface ExamCountdownProps {
  examDate: string
  onExamDateChange: (date: string) => void
  preboardDate: string | null
  onPreboardDateChange: (date: string | null) => void
}

function ExamCountdown({ examDate, onExamDateChange, preboardDate, onPreboardDateChange }: ExamCountdownProps) {
  const calculateTimeLeft = (target: string) => {
    const distance = new Date(`${target}T00:00:00`).getTime() - new Date().getTime()
    if (distance < 0) return { weeks: 0, days: 0, hours: 0, mins: 0, secs: 0 }
    const totalDays = Math.floor(distance / (1000 * 60 * 60 * 24))
    return {
      weeks: Math.floor(totalDays / 7),
      days: totalDays,
      hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      mins: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
      secs: Math.floor((distance % (1000 * 60)) / 1000)
    }
  }

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(examDate))
  const [preboardTimeLeft, setPreboardTimeLeft] = useState(
    preboardDate ? calculateTimeLeft(preboardDate) : null
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState(examDate)
  const [modalError, setModalError] = useState<string | null>(null)

  const [preboardModalOpen, setPreboardModalOpen] = useState(false)
  const [preboardModalDate, setPreboardModalDate] = useState(preboardDate ?? '')
  const [preboardModalError, setPreboardModalError] = useState<string | null>(null)

  useEffect(() => {
    const updateTimers = () => {
      setTimeLeft(calculateTimeLeft(examDate))
      setPreboardTimeLeft(preboardDate ? calculateTimeLeft(preboardDate) : null)
    }

    // Immediately calculate so there's no 1s delay on prop change
    updateTimers()
    
    const timer = setInterval(updateTimers, 1000)
    return () => clearInterval(timer)
  }, [examDate, preboardDate])

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

  const openPreboardModal = () => {
    setPreboardModalDate(preboardDate ?? '')
    setPreboardModalError(null)
    setPreboardModalOpen(true)
  }

  const closePreboardModal = () => {
    setPreboardModalOpen(false)
    setPreboardModalError(null)
  }

  const handlePreboardModalDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setPreboardModalDate(val)
    if (!val) {
      setPreboardModalError('Please enter a date.')
      return
    }
    const chosen = new Date(val + 'T00:00:00')
    const today  = new Date()
    today.setHours(0, 0, 0, 0)
    if (chosen <= today) {
      setPreboardModalError('That date has already passed. Please choose a future date.')
    } else {
      setPreboardModalError(null)
    }
  }

  const confirmPreboardDateChange = () => {
    if (preboardModalError || !preboardModalDate) return
    const chosen = new Date(preboardModalDate + 'T00:00:00')
    const today  = new Date()
    today.setHours(0, 0, 0, 0)
    if (chosen <= today) {
      setPreboardModalError('That date has already passed. Please choose a future date.')
      return
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(preboardModalDate)) {
      setPreboardModalError('Invalid date format. Use YYYY-MM-DD.')
      return
    }
    const parsed = new Date(`${preboardModalDate}T00:00:00`)
    if (isNaN(parsed.getTime())) {
      setPreboardModalError('Invalid date. Please enter a valid calendar date.')
      return
    }

    onPreboardDateChange(preboardModalDate)
    setPreboardModalOpen(false)
    setPreboardModalError(null)
  }

  const removePreboardDate = () => {
    onPreboardDateChange(null)
    setPreboardModalOpen(false)
    setPreboardModalError(null)
  }

  return (
    <div className="flex items-center gap-3">
      {/* PREBOARD TIMER OR ADD BUTTON */}
      {preboardDate && preboardTimeLeft ? (
        <div className="bg-surface border border-warn/10 rounded-lg px-4 py-2 flex items-center gap-6 shadow-xl relative group">
          <Tooltip content="Change preboard date" position="top">
            <button
              onClick={openPreboardModal}
              className="absolute -top-2 -right-2 p-1.5 bg-surface border border-[#333] rounded-full text-[#666] hover:text-warn opacity-70 hover:opacity-100 transition-all z-10 shadow-lg"
            >
              <Edit2 size={12} />
            </button>
          </Tooltip>
          <Tooltip content="Remove preboard date" position="top">
            <button
              onClick={removePreboardDate}
              className="absolute -top-2 -right-8 p-1.5 bg-surface border border-[#333] rounded-full text-[#666] hover:text-danger opacity-70 hover:opacity-100 transition-all z-10 shadow-lg"
            >
              <X size={12} />
            </button>
          </Tooltip>

          <div className="flex flex-col">
            <span className="text-[10px] font-['Orbitron'] text-warn uppercase tracking-widest opacity-80">
              Preboards Target
            </span>
            <span className="text-[11px] font-['Rajdhani'] text-text-muted uppercase tracking-widest font-bold">
              {new Date(preboardDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
            </span>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold font-['JetBrains_Mono'] text-text-primary leading-none">{preboardTimeLeft.weeks}</span>
              <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Wks</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold font-['JetBrains_Mono'] text-text-primary leading-none">{preboardTimeLeft.days}</span>
              <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Days</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold font-['JetBrains_Mono'] text-text-primary leading-none">{preboardTimeLeft.hours.toString().padStart(2, '0')}</span>
              <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Hrs</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold font-['JetBrains_Mono'] text-text-primary leading-none">{preboardTimeLeft.mins.toString().padStart(2, '0')}</span>
              <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Min</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold font-['JetBrains_Mono'] text-warn leading-none">{preboardTimeLeft.secs.toString().padStart(2, '0')}</span>
              <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Sec</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-start px-2">
          <button
            onClick={openPreboardModal}
            className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-[#666] hover:text-warn transition-colors flex items-center gap-1 opacity-70 hover:opacity-100"
          >
            <Edit2 size={10} /> Add Preboard
          </button>
        </div>
      )}

      {/* EXAM TARGET TIMER */}
      <div className={`bg-surface border border-accent/10 rounded-lg flex items-center shadow-xl relative group transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'px-8 py-3 gap-10' : 'px-4 py-2 gap-6'}`}>
        <Tooltip content="Change exam date" position="top">
          <button
            onClick={openDateModal}
            className={`absolute p-1.5 bg-surface border border-[#333] rounded-full text-[#666] hover:text-accent opacity-70 hover:opacity-100 transition-all z-10 shadow-lg ${(!preboardDate || !preboardTimeLeft) ? '-top-3 -right-3 scale-110' : '-top-2 -right-2'}`}
          >
            <Edit2 size={12} />
          </button>
        </Tooltip>

        <div className="flex flex-col transition-all duration-300">
          <span className={`font-['Orbitron'] text-accent uppercase tracking-widest opacity-80 ${(!preboardDate || !preboardTimeLeft) ? 'text-xs mb-0.5' : 'text-[10px]'}`}>
            Exam Target
          </span>
          <span className={`font-['Rajdhani'] text-text-muted uppercase tracking-widest font-bold ${(!preboardDate || !preboardTimeLeft) ? 'text-sm' : 'text-[11px]'}`}>
            {new Date(examDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
          </span>
        </div>

        <div className={`flex transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'gap-6' : 'gap-4'}`}>
          <div className="flex flex-col items-center">
            <span className={`font-bold font-['JetBrains_Mono'] text-text-primary leading-none transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'text-3xl' : 'text-xl'}`}>{timeLeft.weeks}</span>
            <span className={`uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'text-[10px] mt-1' : 'text-[9px]'}`}>Wks</span>
          </div>
          <div className="flex flex-col items-center">
            <span className={`font-bold font-['JetBrains_Mono'] text-text-primary leading-none transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'text-3xl' : 'text-xl'}`}>{timeLeft.days}</span>
            <span className={`uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'text-[10px] mt-1' : 'text-[9px]'}`}>Days</span>
          </div>
          <div className="flex flex-col items-center">
            <span className={`font-bold font-['JetBrains_Mono'] text-text-primary leading-none transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'text-3xl' : 'text-xl'}`}>{timeLeft.hours.toString().padStart(2, '0')}</span>
            <span className={`uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'text-[10px] mt-1' : 'text-[9px]'}`}>Hrs</span>
          </div>
          <div className="flex flex-col items-center">
            <span className={`font-bold font-['JetBrains_Mono'] text-text-primary leading-none transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'text-3xl' : 'text-xl'}`}>{timeLeft.mins.toString().padStart(2, '0')}</span>
            <span className={`uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'text-[10px] mt-1' : 'text-[9px]'}`}>Min</span>
          </div>
          <div className="flex flex-col items-center">
            <span className={`font-bold font-['JetBrains_Mono'] text-accent leading-none transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'text-3xl' : 'text-xl'}`}>{timeLeft.secs.toString().padStart(2, '0')}</span>
            <span className={`uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest transition-all duration-300 ${(!preboardDate || !preboardTimeLeft) ? 'text-[10px] mt-1' : 'text-[9px]'}`}>Sec</span>
          </div>
        </div>
      </div>

      {/* EXAM MODAL */}
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
                className="pointer-events-auto w-full max-w-sm mx-4 bg-[#111] border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#1E1E1E]">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-accent" size={16} />
                    <span className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest">
                      Set Exam Target
                    </span>
                  </div>
                  <button
                    onClick={closeDateModal}
                    className="text-[#555] hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-surface"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="px-6 py-6 space-y-5">
                  <div className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-[#555]">
                    Current target:&nbsp;
                    <span className="text-accent">
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
                      className="w-full bg-engine-black border border-border-subtle rounded-xl px-4 py-3 text-text-primary font-['JetBrains_Mono'] text-sm focus:outline-none focus:border-accent/40 transition-colors [color-scheme:dark]"
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
                          <span className="font-['JetBrains_Mono'] text-2xl font-bold text-accent">{d}</span>
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
                    className="flex-1 px-4 py-2.5 bg-surface border border-border-subtle rounded-xl text-text-muted font-['Rajdhani'] font-bold text-xs uppercase tracking-widest hover:text-text-primary hover:bg-border-base transition-all"
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

      {/* PREBOARD MODAL */}
      <AnimatePresence>
        {preboardModalOpen && (
          <>
            <motion.div
              key="preboard-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={closePreboardModal}
            />
            <motion.div
              key="preboard-modal-dialog"
              initial={{ opacity: 0, scale: 0.95, y: -12 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{   opacity: 0, scale: 0.95,  y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-w-sm mx-4 bg-[#111] border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#1E1E1E]">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-warn" size={16} />
                    <span className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest">
                      Set Preboards Target
                    </span>
                  </div>
                  <button
                    onClick={closePreboardModal}
                    className="text-[#555] hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-surface"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="px-6 py-6 space-y-5">
                  <div className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-[#555]">
                    Current target:&nbsp;
                    <span className="text-warn">
                      {preboardDate ? new Date(preboardDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'None'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-[#666]">
                      New Date
                    </label>
                    <input
                      type="date"
                      value={preboardModalDate}
                      onChange={handlePreboardModalDateChange}
                      min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                      className="w-full bg-engine-black border border-border-subtle rounded-xl px-4 py-3 text-text-primary font-['JetBrains_Mono'] text-sm focus:outline-none focus:border-warn/40 transition-colors [color-scheme:dark]"
                    />
                  </div>

                  <AnimatePresence mode="wait">
                    {preboardModalError && (
                      <motion.div
                        key="preboard-modal-error"
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0,  height: 'auto' }}
                        exit={{   opacity: 0, y: -4,  height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                          <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={14} />
                          <span className="font-['Rajdhani'] text-red-400 text-xs font-bold leading-relaxed">
                            {preboardModalError}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {preboardModalDate && !preboardModalError && (() => {
                      const d = Math.ceil(
                        (new Date(preboardModalDate + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000
                      )
                      return d > 0 ? (
                        <motion.div
                          key="preboard-days-preview"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center justify-center gap-2 py-2"
                        >
                          <span className="font-['JetBrains_Mono'] text-2xl font-bold text-warn">{d}</span>
                          <span className="font-['Rajdhani'] text-[#555] text-xs uppercase tracking-widest font-bold">
                            days until preboard
                          </span>
                        </motion.div>
                      ) : null
                    })()}
                  </AnimatePresence>
                </div>

                <div className="flex gap-3 px-6 pb-6">
                  {preboardDate && (
                    <Tooltip content="Remove Preboard Date" position="top">
                      <button
                        onClick={removePreboardDate}
                        className="px-4 py-2.5 bg-danger/10 border border-danger/20 rounded-xl text-danger font-['Rajdhani'] font-bold text-xs uppercase tracking-widest hover:bg-danger/20 transition-all"
                      >
                        <X size={16} />
                      </button>
                    </Tooltip>
                  )}
                  <button
                    onClick={closePreboardModal}
                    className="flex-1 px-4 py-2.5 bg-surface border border-border-subtle rounded-xl text-text-muted font-['Rajdhani'] font-bold text-xs uppercase tracking-widest hover:text-text-primary hover:bg-border-base transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmPreboardDateChange}
                    disabled={!!preboardModalError || !preboardModalDate}
                    className="flex-1 px-4 py-2.5 rounded-xl font-['Rajdhani'] font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: (!preboardModalError && preboardModalDate) ? '#FFB800' : '#1A1A1A',
                      color: (!preboardModalError && preboardModalDate) ? '#000' : '#555',
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
    </div>
  )
}

export default React.memo(ExamCountdown)
