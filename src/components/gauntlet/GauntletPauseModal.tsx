import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pause, Play, LogOut } from 'lucide-react'

interface GauntletPauseModalProps {
  isOpen: boolean
  onResume: () => void
  onQuit: () => void
}

export const GauntletPauseModal: React.FC<GauntletPauseModalProps> = ({
  isOpen,
  onResume,
  onQuit,
}) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onResume()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onResume])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onResume}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 15 }}
            className="relative w-full max-w-sm bg-[#111] border border-[#333] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            {/* Top amber accent line */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#FFB800] to-transparent" />

            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#FFB800]/10 border border-[#FFB800]/30 flex items-center justify-center mb-4 text-[#FFB800] shadow-[0_0_20px_rgba(255,184,0,0.15)]">
                <Pause size={24} />
              </div>

              <h3 className="text-xl font-['Orbitron'] font-bold text-white mb-1 tracking-wider uppercase">
                Run Paused
              </h3>
              <p className="text-text-muted font-['JetBrains_Mono'] text-xs mb-6">
                Clock is stopped. Take a breath.
              </p>

              <div className="flex flex-col gap-3 w-full">
                <button
                  type="button"
                  onClick={onResume}
                  className="w-full py-3 bg-accent hover:bg-[#00e63a] text-black rounded-xl font-['Rajdhani'] font-bold text-sm uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(0,255,65,0.2)] flex items-center justify-center gap-2"
                >
                  <Play size={16} fill="currentColor" />
                  Resume Run
                </button>

                <button
                  type="button"
                  onClick={onQuit}
                  className="w-full py-3 bg-surface border border-border-base hover:border-[#FF3333] text-text-muted hover:text-[#FF3333] rounded-xl font-['Rajdhani'] font-bold text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  Quit & Save
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
