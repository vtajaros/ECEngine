import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, X, AlertTriangle, Trophy, ScrollText, Play, Pencil, Trash2, Search, SlidersHorizontal } from 'lucide-react'
import FolderPanel from '@/components/ui/FolderPanel'
import { AdvancedFiltersPopover } from '../deck/AdvancedFiltersPopover'
import { DeckCard } from '../deck/DeckCard'
import { FlashCardSettingsModal, FlashCardSettings } from './FlashCardSettingsModal'
import { getSubjectBadgeClasses, SUBJECT_MAP } from '../../lib/subjectColors'
import { TOS_SUBJECT_COLORS } from '../../lib/tosData'

export type Subject = 'MATH' | 'GEAS' | 'ELECS' | 'EST'
export type FilterSubject = 'ALL' | Subject

const SUBJECTS: FilterSubject[] = ['ALL', 'MATH', 'GEAS', 'ELECS', 'EST']

export interface DeckInfo {
  id: string
  title: string
  subject: Subject
  cardCount: number
  deckType: 'mcq' | 'flashcard' | 'mixed'
  description: string
  tags?: string[]
  createdAt?: number
  folderName?: string
  order_index?: number
  mastery?: number
}

interface FCSettings {
  shuffle: boolean
  bookmarkedOnly: boolean
  swapTermDef: boolean
  writtenMode: boolean
}

export interface FlashcardDeckBrowserProps {
  decks: DeckInfo[]
  filteredDecks: DeckInfo[]
  folders: string[]
  deckCountByFolder: Record<string, number>
  activeFolder: string | 'all'
  activeSubject: FilterSubject
  isLoading: boolean
  setToDelete: DeckInfo | null
  deleteCountdown: number
  showAdvancedFilters: boolean
  filterTags: string[]
  sortBy: 'date' | 'title'
  sortOrder: 'desc' | 'asc'
  searchQuery: string
  filterType: 'all' | 'mcq' | 'flashcard' | 'mixed'
  availableTags: string[]
  showFlashModal: { isOpen: boolean; deckId: string | null }
  flashModalSettings: FlashCardSettings
  filterPopoverRef: React.RefObject<HTMLDivElement>
  onFolderSelect: (f: string | 'all') => void
  onSubjectSelect: (s: FilterSubject) => void
  onShowAdvancedFilters: (v: boolean) => void
  onLearnDeck: (deckId: string) => void
  onEditDeck: (deckId: string) => void
  onDeleteDeck: (deck: DeckInfo) => void
  onPrintDeck: (deckId: string, title: string) => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onDeleteFolder: (folderName: string) => void
  onReorderFolders: (newOrder: string[]) => void
  onFlashModalSettingsChange: (s: FlashCardSettings) => void
  onFlashModalStart: () => void
  onFlashModalClose: () => void
  setSearchQuery: (v: string) => void
  setSortBy: (v: 'date' | 'title') => void
  setSortOrder: (v: 'desc' | 'asc') => void
  setFilterType: (v: 'all' | 'mcq' | 'flashcard' | 'mixed') => void
  setFilterTags: React.Dispatch<React.SetStateAction<string[]>>
}

export function FlashcardDeckBrowser({
  decks,
  filteredDecks,
  folders,
  deckCountByFolder,
  activeFolder,
  activeSubject,
  isLoading,
  setToDelete,
  deleteCountdown,
  showAdvancedFilters,
  filterTags,
  sortBy,
  sortOrder,
  searchQuery,
  filterType,
  availableTags,
  showFlashModal,
  flashModalSettings,
  filterPopoverRef,
  onFolderSelect,
  onSubjectSelect,
  onShowAdvancedFilters,
  onLearnDeck,
  onEditDeck,
  onDeleteDeck,
  onPrintDeck,
  onConfirmDelete,
  onCancelDelete,
  onDeleteFolder,
  onReorderFolders,
  onFlashModalSettingsChange,
  onFlashModalStart,
  onFlashModalClose,
  setSearchQuery,
  setSortBy,
  setSortOrder,
  setFilterType,
  setFilterTags
}: FlashcardDeckBrowserProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-row flex-1 w-full overflow-hidden">
        <FolderPanel
          folders={folders}
          deckCountByFolder={deckCountByFolder}
          totalDeckCount={decks.length}
          selected={activeFolder}
          onSelect={onFolderSelect}
          onDeleteFolder={onDeleteFolder}
          onReorderFolders={onReorderFolders}
        />

        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto show-scrollbar">
          {/* Header centered above decks */}
          <div className="flex flex-col items-center w-full pt-6 pb-0 px-6">
            <div className="w-full max-w-5xl flex flex-col items-center justify-center gap-6 mb-2 border-b border-[var(--bg-card)] pb-4 pt-4 relative z-30">
              <h1 className="text-2xl lg:text-3xl font-['Orbitron'] text-[var(--text-primary)] tracking-wider font-bold flex items-center gap-4 uppercase">
                <Layers className="text-[var(--accent-primary)]" size={28} />
                FLASH<span className="text-[var(--accent-primary)]">CARDS</span>
              </h1>

              <div className="flex items-center justify-center flex-wrap gap-2 w-full bg-[var(--bg-secondary)] p-1 rounded-lg border border-[var(--bg-card)] no-scrollbar px-1">
                <div className="relative shrink-0" ref={filterPopoverRef}>
                  <button
                    onClick={() => onShowAdvancedFilters(!showAdvancedFilters)}
                    className={`p-2 rounded-lg border transition-all ${showAdvancedFilters || filterTags.length > 0 || filterType !== 'flashcard' || sortBy !== 'date' || sortOrder !== 'desc' || searchQuery
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-[var(--bg-secondary)] border-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                  >
                    <SlidersHorizontal size={20} />
                  </button>

                  <AnimatePresence>
                    {showAdvancedFilters && (
                      <AdvancedFiltersPopover
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        sortOrder={sortOrder}
                        setSortOrder={setSortOrder}
                        filterType={filterType}
                        setFilterType={setFilterType}
                        filterTags={filterTags}
                        setFilterTags={setFilterTags}
                        availableTags={availableTags}
                        onClose={() => onShowAdvancedFilters(false)}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {SUBJECTS.map(s => {
                  const isActive = activeSubject === s
                  const colors = s !== 'ALL' ? TOS_SUBJECT_COLORS[s] : null

                  return (
                    <button
                      key={s}
                      onClick={() => onSubjectSelect(s)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all font-['Rajdhani'] font-bold text-sm uppercase tracking-widest"
                      style={
                        isActive
                          ? s === 'ALL'
                            ? {
                              background: 'var(--accent-glow)',
                              borderColor: 'var(--accent-border)',
                              color: 'var(--accent-primary)',
                              boxShadow: '0 0 16px rgba(0,255,65,0.1)',
                            }
                            : {
                              background: `rgba(${colors?.accentRgb},0.15)`,
                              borderColor: `rgba(${colors?.accentRgb},0.5)`,
                              color: colors?.accent,
                              boxShadow: `0 0 16px rgba(${colors?.accentRgb},0.1)`,
                            }
                          : {
                            background: '#0c0c0c',
                            borderColor: '#2a2a2a',
                            color: '#555',
                          }
                      }
                    >
                      {s}
                    </button>
                  )
                })}
              </div>

              <div
                className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 w-full text-xs text-slate-500 font-medium uppercase tracking-wider mb-0"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <Play className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Learn Mode
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <Trophy className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Test Mode
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <ScrollText className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Test Paper View
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <Pencil className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Edit Deck
                </span>
                <span className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  <Trash2 className="shrink-0" size={14} style={{ color: 'rgba(255,255,255,0.45)' }} /> Delete Deck
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 px-6 pb-6">
            <div className="flex flex-col items-center">
              <div className="w-full max-w-5xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-0 pb-4">
                  {filteredDecks.map(deck => (
                    <DeckCard
                      key={deck.id}
                      deck={deck}
                      onLearn={onLearnDeck}
                      onEdit={onEditDeck}
                      onDelete={onDeleteDeck}
                      onPrint={onPrintDeck}
                    />
                  ))}
                </div>

                {isLoading ? (
                  <div className="text-center py-20 text-[#555] font-['IBM_Plex_Mono'] text-sm tracking-widest animate-pulse">
                    Loading decks...
                  </div>
                ) : filteredDecks.length === 0 ? (
                  <div className="text-center py-20 text-text-muted font-rajdhani uppercase tracking-widest text-lg">
                    No decks found{activeSubject !== 'ALL' ? ` for ${activeSubject}` : ''}. Import some from Add Decks.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {setToDelete && (
              <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={onCancelDelete}
                  className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="relative w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
                >
                  <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#FF003C] to-transparent" />
                  <div className="p-8 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-[#FF003C]/10 border border-[#FF003C]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,0,60,0.1)]">
                      <AlertTriangle className="w-8 h-8 text-[#FF003C]" />
                    </div>
                    <h3 className="text-2xl font-['Orbitron'] font-bold text-white mb-4 tracking-widest uppercase">
                      DELETE DECK?
                    </h3>
                    <p className="text-text-muted font-['IBM_Plex_Mono'] mb-8 leading-relaxed">
                      Are you absolutely sure you want to delete <strong className="text-white">{setToDelete.title}</strong>? This action cannot be undone and will permanently remove all {setToDelete.cardCount} items in this set.
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                      <button
                        onClick={onConfirmDelete}
                        disabled={deleteCountdown > 0}
                        className="w-full py-4 bg-[#FF003C] hover:bg-[#D00030] disabled:bg-surface disabled:text-[#444] disabled:cursor-not-allowed text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,0,60,0.2)] hover:shadow-[0_0_25px_rgba(255,0,60,0.4)]"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={onCancelDelete}
                        className="w-full py-4 bg-surface border border-[#333] hover:border-[#555] text-text-muted hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={onCancelDelete}
                    className="absolute top-4 right-4 text-[#444] hover:text-white transition-colors p-1"
                  >
                    <X size={20} />
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <FlashCardSettingsModal
        isOpen={showFlashModal.isOpen}
        setId={showFlashModal.deckId}
        settings={flashModalSettings}
        allSets={decks.map(d => ({ id: d.id, count: d.cardCount }))}
        onSettingsChange={onFlashModalSettingsChange}
        onStart={onFlashModalStart}
        onClose={onFlashModalClose}
      />
    </div>
  )
}
