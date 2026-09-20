import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Info, X } from 'lucide-react'
import { renderMath } from '../../../lib/latex'

export interface StatInfoModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  value: string
  formula: string
  description: string
  takeaway: string
}

export const StatInfoModal: React.FC<StatInfoModalProps> = ({
  isOpen,
  onClose,
  title,
  value,
  formula,
  description,
  takeaway,
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
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Cyberpunk accent bar in #00FF41 */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#00FF41] to-transparent" />

            <div className="p-8 flex flex-col items-center text-center">
              {/* Info Icon Circle */}
              <div className="w-16 h-16 rounded-full bg-[#00FF41]/10 border border-[#00FF41]/30 flex items-center justify-center mb-5 shadow-[0_0_20px_rgba(0,255,65,0.15)]">
                <Info className="w-8 h-8 text-[#00FF41]" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-['Orbitron'] font-bold text-white mb-2 tracking-widest uppercase">
                {title}
              </h3>

              {/* Prominent Value */}
              <div className="font-['JetBrains_Mono'] text-2xl font-bold text-accent mb-6">
                {value}
              </div>

              {/* Formula Box */}
              <div className="w-full bg-surface-2 rounded-lg p-5 border border-border-base flex flex-col gap-1 text-left mb-4">
                <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-[#555] font-bold">
                  FORMULA
                </span>
                <div
                  className="text-text-primary text-sm sm:text-base max-w-full overflow-x-auto flex items-center justify-center py-2"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                  dangerouslySetInnerHTML={{ __html: renderMath(formula) }}
                />
              </div>

              {/* Description */}
              {description.split('\n\n').map((para, i) => (
                <p key={i} className="font-['JetBrains_Mono'] text-sm text-text-muted leading-relaxed text-left mb-3 w-full">
                  {para}
                </p>
              ))}

              {/* Key Takeaway */}
              <div className="w-full text-left bg-accent/5 border-l-2 border-accent rounded-r px-4 py-3 mb-4">
                <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-accent font-bold block mb-1">
                  Key takeaway
                </span>
                <p className="font-['JetBrains_Mono'] text-sm text-text-primary leading-relaxed">
                  {takeaway}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-full py-4 bg-surface border border-[#333] hover:border-[#555] text-text-muted hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
              >
                Close
              </button>
            </div>

            {/* Close X Button (Top Right) */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-[#444] hover:text-white transition-colors p-1"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
export default StatInfoModal
