import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, RefreshCw, PlusCircle } from 'lucide-react'

interface AutoTagConfirmModalProps {
  isOpen: boolean
  taggedCount: number
  totalCount: number
  onOverwriteAll: () => void
  onTagUntaggedOnly: () => void
  onClose: () => void
}

export const AutoTagConfirmModal: React.FC<AutoTagConfirmModalProps> = ({
  isOpen,
  taggedCount,
  totalCount,
  onOverwriteAll,
  onTagUntaggedOnly,
  onClose,
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
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            className="relative w-full max-w-lg bg-[#111] border border-[#2a2a2a] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-accent to-transparent" />

            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-['Orbitron'] font-bold text-white tracking-wider uppercase">
                      Auto-Tag TOS Categories
                    </h3>
                    <p className="text-xs font-['JetBrains_Mono'] text-text-muted">
                      {taggedCount} of {totalCount} cards currently have a TOS category assigned.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-text-muted hover:text-white p-1 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm font-['JetBrains_Mono'] text-[#aaa] mb-6 leading-relaxed">
                Choose how you want to apply the classifier to the cards in this deck:
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={onOverwriteAll}
                  className="group relative flex items-start gap-4 p-4 rounded-lg border border-accent/40 bg-accent/10 hover:bg-accent/20 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded bg-accent/20 border border-accent/40 flex items-center justify-center flex-shrink-0 mt-0.5 text-accent group-hover:scale-105 transition-transform">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-['Rajdhani'] font-bold uppercase tracking-wider text-accent mb-0.5">
                      Overwrite All Cards
                    </div>
                    <div className="text-xs font-['JetBrains_Mono'] text-[#999] leading-relaxed">
                      Re-evaluates every card using updated PRC TOS rules. Overwrites previous tags with high-confidence classifications.
                    </div>
                  </div>
                </button>

                <button
                  onClick={onTagUntaggedOnly}
                  className="group relative flex items-start gap-4 p-4 rounded-lg border border-[#333] bg-[#181818] hover:border-[#555] hover:bg-[#222] transition-all text-left"
                >
                  <div className="w-8 h-8 rounded bg-[#252525] border border-[#444] flex items-center justify-center flex-shrink-0 mt-0.5 text-white group-hover:scale-105 transition-transform">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-['Rajdhani'] font-bold uppercase tracking-wider text-white mb-0.5">
                      Tag Only Untagged
                    </div>
                    <div className="text-xs font-['JetBrains_Mono'] text-[#888] leading-relaxed">
                      Leaves your currently assigned categories untouched and only auto-classifies cards that have no category.
                    </div>
                  </div>
                </button>
              </div>

              {/* Cancel Button */}
              <div className="mt-5 pt-4 border-t border-[#222] flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
