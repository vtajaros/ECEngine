import React, { useEffect, useState, useMemo } from 'react'
import { X, Search, FileText, Tag, Loader2, BookOpen, AlertCircle, Layers } from 'lucide-react'
import { dbService } from '../../../services/db.service'
import { TOS_SUBJECT_COLORS } from '../../../lib/tosData'

interface TosCardInspectorModalProps {
  isOpen: boolean
  onClose: () => void
  subject: string
  tosTopicId?: string | null
  topicTitle: string
  isUnclassified?: boolean
}

export function TosCardInspectorModal({
  isOpen,
  onClose,
  subject,
  tosTopicId,
  topicTitle,
  isUnclassified = false,
}: TosCardInspectorModalProps) {
  const [cards, setCards] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    setLoading(true)
    setError(null)

    dbService
      .getCardsByTosTopic({
        subject: subject === 'ALL' ? undefined : subject,
        tosTopicId: isUnclassified ? undefined : (tosTopicId || undefined),
        isUnclassified,
        limit: 100,
      })
      .then((res) => {
        if (isMounted) {
          setCards(res?.cards || [])
          setTotal(res?.total || 0)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to fetch cards')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, subject, tosTopicId, isUnclassified])

  const filteredCards = useMemo(() => {
    if (!search.trim()) return cards
    const q = search.toLowerCase()
    return cards.filter(
      (c) =>
        c.preview.toLowerCase().includes(q) ||
        c.deckName.toLowerCase().includes(q) ||
        (c.tosTopicId && c.tosTopicId.toLowerCase().includes(q)) ||
        c.tags.some((t: string) => t.toLowerCase().includes(q))
    )
  }, [cards, search])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[85vh] bg-[#0E0E0E] border border-border-base rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border-base bg-[#141414]">
          <div className="flex flex-col gap-1 pr-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className="px-2 py-0.5 rounded text-[11px] font-bold font-['Rajdhani'] uppercase tracking-wider"
                style={{
                  backgroundColor: `${TOS_SUBJECT_COLORS[subject]?.accent || '#00FF41'}20`,
                  color: TOS_SUBJECT_COLORS[subject]?.accent || '#00FF41',
                  border: `1px solid ${TOS_SUBJECT_COLORS[subject]?.accent || '#00FF41'}40`,
                }}
              >
                {subject}
              </span>
              {isUnclassified ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold font-['Rajdhani'] uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40">
                  Unclassified Cards
                </span>
              ) : (
                tosTopicId && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold font-['JetBrains_Mono'] bg-[var(--bg-elevated)] text-[var(--accent-primary)] border border-border-base">
                    {tosTopicId}
                  </span>
                )
              )}
              <span className="text-text-muted text-xs font-['JetBrains_Mono']">
                {loading ? 'Loading…' : `${total} total card${total === 1 ? '' : 's'}`}
              </span>
            </div>
            <h3 className="font-['Orbitron'] text-base sm:text-lg font-bold text-text-primary tracking-wide mt-1">
              {topicTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors shrink-0"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-5 py-3 border-b border-border-base/50 bg-[#111] flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search in loaded cards (question, deck, tags)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#181818] border border-border-base focus:border-[var(--accent-primary)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-text-primary font-['JetBrains_Mono'] outline-none transition-colors"
            />
          </div>
          {search && (
            <span className="text-[11px] font-['JetBrains_Mono'] text-text-muted shrink-0">
              Showing {filteredCards.length} of {cards.length}
            </span>
          )}
        </div>

        {/* Card List Body */}
        <div className="p-5 overflow-y-auto show-scrollbar flex-1 flex flex-col gap-3 min-h-[300px] bg-[#0A0A0A]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-text-muted">
              <Loader2 className="animate-spin text-accent" size={32} />
              <span className="font-['JetBrains_Mono'] text-xs uppercase tracking-widest">
                Fetching classified cards…
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
              <AlertCircle className="text-red-500" size={32} />
              <p className="font-['Rajdhani'] text-red-400 font-bold uppercase tracking-wider text-sm">
                {error}
              </p>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-center text-text-muted">
              <BookOpen size={36} className="text-[#444]" />
              <p className="font-['Rajdhani'] uppercase tracking-widest text-sm font-bold text-[#777]">
                {search ? 'No cards match your filter' : 'No cards found under this topic'}
              </p>
              <p className="text-xs font-['JetBrains_Mono'] text-[#555] max-w-sm">
                {isUnclassified
                  ? 'Great news! All cards in this subject have been assigned to a ToS topic.'
                  : 'Import or classify decks to populate this topic with questions.'}
              </p>
            </div>
          ) : (
            filteredCards.map((card, idx) => (
              <div
                key={card.id || idx}
                className="bg-[#121212] hover:bg-[#161616] border border-border-base hover:border-border-base/80 transition-all rounded-xl p-4 flex flex-col gap-2.5 shadow-sm"
              >
                {/* Card Meta Row */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[#1f1f1f] text-[10px] font-['JetBrains_Mono'] uppercase font-bold text-text-muted">
                      {card.type}
                    </span>
                    <span className="font-['Rajdhani'] font-bold text-text-muted uppercase tracking-wider text-xs">
                      {card.deckName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {card.difficulty && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold font-['JetBrains_Mono'] uppercase"
                        style={{
                          color:
                            card.difficulty === 'easy'
                              ? 'var(--tier-easy)'
                              : card.difficulty === 'moderate'
                              ? 'var(--tier-moderate)'
                              : 'var(--tier-difficult)',
                          backgroundColor: 'var(--bg-elevated)',
                        }}
                      >
                        {card.difficulty}
                      </span>
                    )}
                    {card.tosTopicId ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-['JetBrains_Mono'] bg-accent/10 text-accent border border-accent/30">
                        {card.tosTopicId}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] text-red-400 bg-red-500/10 border border-red-500/20">
                        Untagged
                      </span>
                    )}
                  </div>
                </div>

                {/* Question / Front Snippet */}
                <p className="text-sm font-['JetBrains_Mono'] text-text-primary leading-relaxed whitespace-pre-wrap">
                  {card.preview || '<No content preview available>'}
                </p>

                {/* Tags if any */}
                {card.tags && card.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border-base/30">
                    <Tag size={12} className="text-text-muted shrink-0" />
                    {card.tags.map((t: string, i: number) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] text-text-muted bg-[#1c1c1c]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-base bg-[#141414] flex items-center justify-between text-xs font-['JetBrains_Mono'] text-text-muted">
          <span>Displaying up to 100 loaded samples</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-surface-2 text-text-primary transition-colors border border-border-base font-bold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
