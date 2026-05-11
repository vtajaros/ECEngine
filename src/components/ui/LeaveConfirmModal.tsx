import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

interface LeaveConfirmModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  message?: string
}

export const LeaveConfirmModal: React.FC<LeaveConfirmModalProps> = ({ 
  isOpen, 
  onConfirm, 
  onCancel,
  message = "You have an active study session. Leaving now will lose your current progress. Are you sure you want to exit?"
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Cyberpunk accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#FF003C] to-transparent" />

            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#FF003C]/10 border border-[#FF003C]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,0,60,0.1)]">
                <AlertTriangle className="w-8 h-8 text-[#FF003C]" />
              </div>

              <h3 className="text-2xl font-['Orbitron'] font-bold text-white mb-4 tracking-widest uppercase">
                Abort Session?
              </h3>
              
              <p className="text-[#888] font-['IBM_Plex_Mono'] mb-8 leading-relaxed">
                {message}
              </p>

              <div className="flex flex-col gap-3 w-full">
                <button 
                  onClick={onConfirm}
                  className="w-full py-4 bg-[#FF003C] hover:bg-[#D00030] text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,0,60,0.2)] hover:shadow-[0_0_25px_rgba(255,0,60,0.4)]"
                >
                  Leave Session
                </button>
                <button 
                  onClick={onCancel}
                  className="w-full py-4 bg-[#1A1A1A] border border-[#333] hover:border-[#555] text-[#888] hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
                >
                  Keep Studying
                </button>
              </div>
            </div>

            {/* Close button (top right) */}
            <button 
              onClick={onCancel}
              className="absolute top-4 right-4 text-[#444] hover:text-white transition-colors p-1"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
