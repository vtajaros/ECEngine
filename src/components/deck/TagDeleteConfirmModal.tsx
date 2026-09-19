import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X, Loader2 } from 'lucide-react'

export interface AffectedDeck {
  id: string
  name: string
  subject?: string
  folderName?: string
}

export interface TagDeleteConfirmModalProps {
  tag: string | null
  affectedDecks: AffectedDeck[]
  isDeleting?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const TagDeleteConfirmModal: React.FC<TagDeleteConfirmModalProps> = ({
  tag,
  affectedDecks,
  isDeleting = false,
  onConfirm,
  onCancel,
}) => {
  if (typeof document === 'undefined' || !document.body) {
    return null
  }

  return createPortal(
    <AnimatePresence>
      {tag && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isDeleting ? undefined : onCancel}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative z-10 w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
          >
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#FF003C] to-transparent" />

            <div className="p-6 md:p-8 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#FF003C]/10 border border-[#FF003C]/30 flex items-center justify-center mb-5 shrink-0 shadow-[0_0_20px_rgba(255,0,60,0.15)]">
                <AlertTriangle className="w-7 h-7 text-[#FF003C]" />
              </div>

              <h3 className="text-xl font-['Orbitron'] font-bold text-white mb-2 tracking-widest uppercase">
                {affectedDecks.length > 0 ? 'TAG IN USE' : 'DELETE TAG'}
              </h3>

              <div className="inline-block px-3 py-1 rounded-full bg-accent/10 border border-accent/40 text-accent font-['Rajdhani'] font-bold text-xs uppercase tracking-wider mb-4">
                {tag}
              </div>

              {affectedDecks.length > 0 ? (
                <>
                  <p className="text-text-muted font-['JetBrains_Mono'] text-xs mb-3 leading-relaxed">
                    This tag is currently assigned to <strong className="text-white font-bold">{affectedDecks.length}</strong> deck{affectedDecks.length > 1 ? 's' : ''}:
                  </p>

                  <div className="w-full max-h-40 overflow-y-auto bg-[#0a0a0a] border border-[#222] rounded-lg p-2.5 mb-4 text-left divide-y divide-[#1e1e1e]">
                    {affectedDecks.map(deck => (
                      <div key={deck.id} className="py-2 px-1.5 flex items-center justify-between gap-2">
                        <span className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-wide truncate">
                          {deck.name || 'Untitled Deck'}
                        </span>
                        {deck.subject && (
                          <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted px-2 py-0.5 rounded bg-surface-2 shrink-0">
                            {deck.subject}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-[#FF6B6B] font-['JetBrains_Mono'] text-[11px] mb-6 leading-relaxed bg-[#FF003C]/5 border border-[#FF003C]/20 rounded p-2.5">
                    Deleting this tag will remove it from all {affectedDecks.length} deck{affectedDecks.length > 1 ? 's' : ''} and delete it from your source tags list.
                  </p>
                </>
              ) : (
                <p className="text-text-muted font-['JetBrains_Mono'] text-xs mb-6 leading-relaxed">
                  Are you sure you want to delete <strong className="text-white font-bold">{tag}</strong> from your available source tags list?
                </p>
              )}

              <div className="flex flex-col gap-2.5 w-full">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={onConfirm}
                  className="w-full py-3.5 bg-[#FF003C] hover:bg-[#D00030] disabled:opacity-50 text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,0,60,0.3)]"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>DELETING...</span>
                    </>
                  ) : (
                    <span>{affectedDecks.length > 0 ? 'DELETE TAG EVERYWHERE' : 'CONFIRM DELETE'}</span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={onCancel}
                  className="w-full py-3.5 bg-surface border border-[#333] hover:border-[#555] text-text-muted hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest text-xs transition-all"
                >
                  CANCEL
                </button>
              </div>
            </div>

            {!isDeleting && (
              <button
                type="button"
                onClick={onCancel}
                className="absolute top-4 right-4 text-[#555] hover:text-white transition-colors p-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
