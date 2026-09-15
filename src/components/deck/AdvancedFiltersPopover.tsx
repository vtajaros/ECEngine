import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Check, Star } from 'lucide-react'

interface AdvancedFiltersPopoverProps {
  searchQuery: string
  setSearchQuery: (v: string) => void
  sortBy: 'date' | 'title'
  setSortBy: (v: 'date' | 'title') => void
  sortOrder: 'desc' | 'asc'
  setSortOrder: (v: 'desc' | 'asc') => void
  filterType: 'all' | 'mcq' | 'flashcard' | 'mixed'
  setFilterType: (v: 'all' | 'mcq' | 'flashcard' | 'mixed') => void
  filterTags: string[]
  setFilterTags: React.Dispatch<React.SetStateAction<string[]>>
  availableTags: string[]
  favoritesOnly?: boolean
  setFavoritesOnly?: (v: boolean) => void
  onClose: () => void
}

export const AdvancedFiltersPopover: React.FC<AdvancedFiltersPopoverProps> = ({
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  filterType,
  setFilterType,
  filterTags,
  setFilterTags,
  availableTags,
  favoritesOnly,
  setFavoritesOnly,
  onClose
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 mt-2 w-72 bg-[#111] border border-[#333] rounded-lg shadow-2xl p-4 z-50 flex flex-col gap-4"
    >
      <div className="flex justify-between items-center pb-2 border-b border-[#333]">
        <span className="font-['Rajdhani'] font-bold text-sm tracking-widest uppercase text-accent">Filters & Sort</span>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X size={16} />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] w-4 h-4" />
        <input
          type="text"
          placeholder="Search decks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-surface border border-[#333] focus:border-accent rounded-lg py-2 pl-9 pr-3 text-sm text-text-primary placeholder-[#555] outline-none transition-colors font-['JetBrains_Mono']"
        />
      </div>

      {/* Favorites Filter */}
      {setFavoritesOnly && (
        <div className="flex items-center justify-between py-1 px-1 rounded bg-[#0d0d0d] border border-[#222]">
          <span className="text-xs font-['Rajdhani'] tracking-widest text-text-muted uppercase flex items-center gap-2">
            <Star size={14} className={favoritesOnly ? "text-accent fill-accent" : "text-gray-500"} />
            Favorites Only
          </span>
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`px-2.5 py-0.5 rounded text-[10px] font-['Rajdhani'] font-bold tracking-widest uppercase transition-all border ${
              favoritesOnly
                ? 'bg-accent/20 border-accent/60 text-accent shadow-[0_0_10px_rgba(0,255,65,0.25)]'
                : 'bg-surface border-[#333] text-text-muted hover:border-[#555] hover:text-text-primary'
            }`}
          >
            {favoritesOnly ? 'Active' : 'Off'}
          </button>
        </div>
      )}

      {/* Sort Selection */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-['Rajdhani'] tracking-widest text-text-muted uppercase">Sort By</label>
          <div className="flex bg-surface rounded overflow-hidden border border-[#333]">
            {(['asc', 'desc'] as const).map(order => (
              <button
                key={order}
                onClick={() => setSortOrder(order)}
                className={`px-2 py-0.5 text-[10px] font-['Rajdhani'] uppercase tracking-widest transition-colors ${sortOrder === order ? 'bg-accent text-black font-bold' : 'text-text-muted hover:text-text-primary'}`}
              >
                {order}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {(['date', 'title'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`text-xs py-1.5 rounded transition-colors uppercase font-['Rajdhani'] tracking-wider ${sortBy === opt ? 'bg-accent/20 text-accent font-bold' : 'bg-surface text-text-muted hover:bg-border-base'
                }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Type Filter */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-['Rajdhani'] tracking-widest text-text-muted uppercase">Type</label>
        <div className="grid grid-cols-4 gap-1">
          {(['all', 'mcq', 'flashcard', 'mixed'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setFilterType(opt)}
              className={`text-xs py-1.5 rounded transition-colors uppercase font-['Rajdhani'] tracking-wider ${filterType === opt ? 'bg-accent/20 text-accent font-bold' : 'bg-surface text-text-muted hover:bg-border-base'
                }`}
            >
              {opt === 'flashcard' ? 'FC' : opt}
            </button>
          ))}
        </div>
      </div>

      {/* Tag Filters */}
      {availableTags.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-['Rajdhani'] tracking-widest text-text-muted uppercase">Tags (AND)</label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
            {availableTags.map(tag => {
              const isActive = filterTags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => {
                    setFilterTags(prev =>
                      isActive ? prev.filter(t => t !== tag) : [...prev, tag]
                    )
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-['Rajdhani'] uppercase tracking-wider border transition-all ${isActive
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'bg-surface border-[#333] text-text-muted hover:border-[#555] hover:text-text-primary'
                    }`}
                >
                  {tag}
                  {isActive && <Check size={10} />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Clear Button */}
      {(filterTags.length > 0 || filterType !== 'flashcard' || sortBy !== 'date' || favoritesOnly) && (
        <button
          onClick={() => {
            setFilterTags([])
            setFilterType('flashcard')
            setSortBy('date')
            setFavoritesOnly?.(false)
          }}
          className="mt-2 text-xs font-['Rajdhani'] uppercase tracking-widest text-red-400 hover:text-red-300 text-center py-1 transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </motion.div>
  )
}
