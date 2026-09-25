import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { History, X } from 'lucide-react'
import { RunHistory } from './RunHistory'
import { Tooltip } from '../ui/Tooltip'

interface GauntletRecordsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const GauntletRecordsModal: React.FC<GauntletRecordsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative w-full max-w-2xl bg-[#111] border border-border-base rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col h-[600px] max-h-[85vh]"
          >
            {/* Top Accent line */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-accent to-transparent" />

            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border-base flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="font-['Orbitron'] font-bold text-base text-text-primary tracking-wider uppercase">
                    Gauntlet Records & History
                  </h3>
                  <p className="text-[11px] font-['Rajdhani'] text-text-muted uppercase tracking-wider">
                    Personal Bests and Recent Performance
                  </p>
                </div>
              </div>

              <Tooltip content="Close (Esc)" position="left">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-surface border border-border-base hover:border-text-primary text-text-muted hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={18} />
                </button>
              </Tooltip>
            </div>

            {/* Modal Body: Reuse RunHistory which scrolls internally */}
            <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-hidden flex flex-col">
              <RunHistory hideHeader />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
