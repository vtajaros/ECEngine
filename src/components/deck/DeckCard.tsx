import React from 'react'
import { Play, ScrollText, Pencil, Trash2, Eye, Star } from 'lucide-react'
import { getSubjectBadgeClasses } from '../../lib/subjectColors'
import { Tooltip } from '../ui/Tooltip'

type Subject = 'MATH' | 'GEAS' | 'ELECS' | 'EST'

export interface DeckInfo {
  id: string
  title: string
  subject: Subject
  cardCount: number
  deckType: 'mcq' | 'flashcard' | 'formula' | 'mixed'
  description: string
  tags?: string[]
  createdAt?: number
  folderName?: string
  order_index?: number
  mastery?: number
  isFavorite?: boolean
}

interface DeckCardProps {
  deck: DeckInfo
  onLearn: (deckId: string) => void
  onPreview: (deckId: string) => void
  onEdit: (deckId: string) => void
  onDelete: (deck: DeckInfo) => void
  onPrint: (deckId: string, title: string) => void
  onToggleFavorite?: (deckId: string) => void
}

export const DeckCard = React.memo(function DeckCard({ deck, onLearn, onPreview, onEdit, onDelete, onPrint, onToggleFavorite }: DeckCardProps) {
  return (
    <div
      className="relative isolate group transition-all duration-300 border border-[#333] bg-surface p-5 flex flex-col w-full min-h-[180px] justify-between hover:-translate-x-[6px] hover:-translate-y-[6px] rounded-xl before:absolute before:w-full before:h-full before:top-0 before:left-0 before:bg-surface before:border before:border-[#333] before:rounded-xl before:translate-x-[6px] before:translate-y-[6px] before:z-[-1] before:transition-transform before:duration-300 group-hover:before:translate-x-[12px] group-hover:before:translate-y-[12px] after:absolute after:w-full after:h-full after:top-0 after:left-0 after:bg-surface after:border after:border-[#333] after:rounded-xl after:translate-x-[12px] after:translate-y-[12px] after:z-[-2] after:transition-transform after:duration-300 group-hover:after:translate-x-[18px] group-hover:after:translate-y-[18px]"
    >
      {/* Top Section: Title & Stats Stack */}
      <div className="flex justify-between items-start gap-4">
        {/* Left Column: Title & Tags */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Title Row */}
          <div className="flex items-center gap-3">
            <span className={`w-[58px] flex justify-center py-0.5 rounded border border-[#333] bg-[#111] uppercase font-rajdhani font-bold tracking-widest text-[10px] shrink-0 ${getSubjectBadgeClasses(deck.subject)}`}>
              {deck.subject}
            </span>
            <h3 className="text-2xl font-bold font-rajdhani tracking-wide text-text-primary uppercase truncate flex-1">
              {deck.title}
            </h3>
          </div>
          {/* Tag Row: Type & Custom Tags (Aligned with Date) */}
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="px-2 py-0.5 rounded border border-[#333] bg-transparent text-gray-400 uppercase font-bold tracking-wider text-[10px]">
              {deck.deckType === 'mixed' ? 'MIX' : deck.deckType === 'mcq' ? 'MCQ' : deck.deckType === 'formula' ? 'FM' : 'FC'}
            </span>
            {deck.tags && deck.tags.length > 0 && deck.tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded border border-[#333] bg-transparent text-gray-400 uppercase font-bold tracking-wider text-[10px]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Right Column: Favorite Star & Administrative Info */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* Favorite Star Button */}
          {onToggleFavorite && (
            <Tooltip content={deck.isFavorite ? "Remove from Favorites" : "Mark as Favorite"} position="top">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite(deck.id)
                }}
                className={`p-1.5 rounded-lg border transition-all ${
                  deck.isFavorite
                    ? 'border-accent/50 bg-accent/15 text-accent shadow-[0_0_12px_rgba(0,255,65,0.25)]'
                    : 'border-[#333] bg-[#111] text-gray-500 hover:text-accent hover:border-accent/40 opacity-40 group-hover:opacity-100 hover:!opacity-100'
                }`}
                aria-label={deck.isFavorite ? "Unfavorite Deck" : "Favorite Deck"}
              >
                <Star
                  className={`w-4 h-4 transition-transform active:scale-125 ${
                    deck.isFavorite ? 'fill-accent text-accent' : ''
                  }`}
                />
              </button>
            </Tooltip>
          )}

          {/* Items Tag */}
          <span className="px-2 py-0.5 rounded border border-[#333] bg-transparent text-gray-400 uppercase font-bold tracking-wider text-[10px] shrink-0 whitespace-nowrap">
            {deck.cardCount} ITEMS
          </span>
          {/* Date String */}
          <span className="text-[10px] text-gray-400 uppercase font-['IBM_Plex_Mono'] tracking-widest">
            {deck.createdAt ? new Date(deck.createdAt * 1000).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase() : 'N/A'}
          </span>
        </div>
      </div>

      {/* Deck Description */}
      {deck.description && deck.description.trim() !== "" && (
        <p className="text-xs text-gray-400 font-['IBM_Plex_Mono'] leading-relaxed mt-2 line-clamp-2 uppercase pr-4">
          {deck.description}
        </p>
      )}

      {/* Bottom Row: Progress and Actions */}
      <div className="flex items-center gap-4 w-full mt-4">
        {/* MASTERY label — fixed, does not grow */}
        <span className="text-[10px] font-rajdhani tracking-widest uppercase text-gray-500 shrink-0">
          Mastery
        </span>

        {/* Mastery bar — flex-1 so it fills all remaining space */}
        <div className="flex-1 bg-[#111] h-1 rounded-full overflow-hidden min-w-[40px]">
          <div
            className="h-full bg-accent shadow-[0_0_8px_rgba(0,255,65,0.4)] transition-all duration-500"
            style={{ width: `${deck.mastery ?? 0}%` }}
          />
        </div>

        {/* Mastery percentage — fixed, does not grow */}
        <span className="text-accent font-bold text-[10px] font-rajdhani shrink-0">
          {deck.mastery ?? 0}%
        </span>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-800 shrink-0" />

        {/* Secondary Action Icons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* LEARN button — sits right after the percentage, no gap */}
          <Tooltip content="Learn Mode" position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onLearn(deck.id); }}
              className="py-2 px-3 bg-[#111] border border-[#333] hover:border-accent hover:text-accent text-text-primary rounded transition-colors font-rajdhani tracking-widest uppercase text-xs font-bold flex items-center justify-center gap-2"
              aria-label="Learn"
            >
              <Play className="w-3 h-3" />
              <span>Learn</span>
            </button>
          </Tooltip>

          <Tooltip content="Preview Mode" position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onPreview(deck.id); }}
              className="p-2 bg-[#111] border border-[#333] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] text-gray-400 rounded transition-colors"
              aria-label="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
          </Tooltip>

          {deck.id.startsWith('topic_') && (
            <Tooltip content="Test Paper View" position="top">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPrint(deck.id, deck.title)
                }}
                className="p-2 bg-[#111] border border-[#333] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] text-gray-400 rounded transition-colors"
                aria-label="Test Paper View"
              >
                <ScrollText className="w-4 h-4" />
              </button>
            </Tooltip>
          )}

          <Tooltip content="Edit Deck" position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(deck.id) }}
              className="p-2 bg-[#111] border border-[#333] hover:border-[#555] text-gray-400 hover:text-white rounded transition-colors"
              aria-label="Edit Deck"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content="Delete Deck" position="top">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(deck); }}
              className="p-2 bg-[#111] border border-[#333] hover:border-red-500/50 text-gray-500 hover:text-red-500 rounded transition-colors"
              aria-label="Delete Deck"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
})
