import React, { useEffect, useState, useMemo, useRef } from 'react'
import { X, Search, Tag, Loader2, BookOpen, AlertCircle, ChevronDown, Check, Image as ImageIcon } from 'lucide-react'
import { dbService } from '../../../services/db.service'
import { TOS_SUBJECT_COLORS } from '../../../lib/tosData'
import { getTosTopicGroupsBySubject } from '../../../lib/tosClassification'

interface TosCardInspectorModalProps {
  isOpen: boolean
  onClose: () => void
  subject: string
  tosTopicId?: string | null
  topicTitle: string
  isUnclassified?: boolean
  onTagUpdated?: () => void
}

export function TosCardInspectorModal({
  isOpen,
  onClose,
  subject,
  tosTopicId,
  topicTitle,
  isUnclassified = false,
  onTagUpdated,
}: TosCardInspectorModalProps) {
  const [cards, setCards] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Tag editing state
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [tagSearch, setTagSearch] = useState('')
  const [savingTagId, setSavingTagId] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    setLoading(true)
    setError(null)
    setEditingCardId(null)
    setTagSearch('')

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

  // Close tag dropdown popover on click outside
  useEffect(() => {
    if (!editingCardId) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setEditingCardId(null)
        setTagSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingCardId])

  const filteredCards = useMemo(() => {
    if (!search.trim()) return cards
    const q = search.toLowerCase()
    return cards.filter(
      (c) =>
        c.preview.toLowerCase().includes(q) ||
        c.deckName.toLowerCase().includes(q) ||
        (c.tosTopicId && c.tosTopicId.toLowerCase().includes(q)) ||
        (c.cardNumber && `#${c.cardNumber}`.includes(q)) ||
        c.tags.some((t: string) => t.toLowerCase().includes(q))
    )
  }, [cards, search])

  const editingCard = useMemo(() => {
    return cards.find((c) => c.id === editingCardId)
  }, [cards, editingCardId])

  const availableTopicGroups = useMemo(() => {
    if (!editingCard) return []
    const cardSubject = editingCard.subject || (subject === 'ALL' ? 'ELECS' : subject)
    const groups = getTosTopicGroupsBySubject(cardSubject)
    if (!tagSearch.trim()) return groups
    const q = tagSearch.toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        subtopics: g.subtopics.filter(
          (st) =>
            st.code.toLowerCase().includes(q) ||
            st.name.toLowerCase().includes(q) ||
            st.title.toLowerCase().includes(q) ||
            st.id.toLowerCase().includes(q) ||
            g.parent.name.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.subtopics.length > 0)
  }, [editingCard, tagSearch, subject])

  const handleUpdateCardTag = async (cardId: string, newTosTopicId: string | null) => {
    setSavingTagId(cardId)
    try {
      await dbService.decks.batchUpdateCardTosTopic([{ id: cardId, tos_topic_id: newTosTopicId }])
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, tosTopicId: newTosTopicId } : c))
      )
      setEditingCardId(null)
      setTagSearch('')
      onTagUpdated?.()
    } catch (err: any) {
      console.error('Failed to update card tag:', err)
    } finally {
      setSavingTagId(null)
    }
  }

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
              placeholder="Search in loaded cards (question, deck, #number, tags)…"
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
                    {card.cardNumber != null && (
                      <span className="px-1.5 py-0.5 rounded bg-[#181818] border border-border-base/60 text-[10px] font-['JetBrains_Mono'] text-accent font-semibold">
                        #{card.cardNumber}
                      </span>
                    )}
                    {(card.hasImage || card.imagePath || (card.tags && card.tags.includes('needs-image-review'))) && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] font-bold flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        title="Question diagram or circuit is in an image"
                      >
                        <ImageIcon size={10} />
                        Has Image
                      </span>
                    )}
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

                    {/* Interactive Tag Selector Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (editingCardId === card.id) {
                            setEditingCardId(null)
                            setTagSearch('')
                          } else {
                            setEditingCardId(card.id)
                            setTagSearch('')
                          }
                        }}
                        title="Click to change or set topic tag"
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-['JetBrains_Mono'] transition-all flex items-center gap-1 cursor-pointer select-none ${
                          card.tosTopicId
                            ? 'bg-accent/10 hover:bg-accent/20 text-accent border border-accent/40 hover:border-accent'
                            : 'text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/60'
                        }`}
                      >
                        <span>{card.tosTopicId || 'Untagged'}</span>
                        <ChevronDown
                          size={11}
                          className={`transition-transform duration-150 ${
                            editingCardId === card.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {/* Dropdown Popover */}
                      {editingCardId === card.id && (
                        <div
                          ref={popoverRef}
                          className="absolute right-0 top-full mt-1.5 w-72 sm:w-80 max-h-72 bg-[#161616] border border-border-base rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.9)] z-30 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Popover Search Header */}
                          <div className="p-2.5 border-b border-border-base/50 bg-[#1c1c1c] flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold font-['Orbitron'] text-text-muted tracking-wider uppercase">
                                {card.subject || subject} Subtopics
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCardId(null)
                                  setTagSearch('')
                                }}
                                className="text-text-muted hover:text-white p-0.5 rounded transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                            <div className="relative">
                              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                              <input
                                type="text"
                                autoFocus
                                placeholder="Filter (e.g. 1.3 or theorem)..."
                                value={tagSearch}
                                onChange={(e) => setTagSearch(e.target.value)}
                                className="w-full bg-[#111] border border-border-base focus:border-accent rounded-md pl-7 pr-2 py-1 text-[11px] text-text-primary font-['JetBrains_Mono'] outline-none"
                              />
                            </div>
                          </div>

                          {/* Untag option button */}
                          <div className="px-2 pt-1.5 pb-1 border-b border-border-base/30">
                            <button
                              type="button"
                              disabled={savingTagId === card.id}
                              onClick={() => handleUpdateCardTag(card.id, null)}
                              className={`w-full px-2 py-1 rounded text-left text-[11px] font-['JetBrains_Mono'] flex items-center justify-between transition-colors ${
                                !card.tosTopicId
                                  ? 'bg-red-500/15 text-red-300 border border-red-500/40 font-bold'
                                  : 'text-text-muted hover:text-red-400 hover:bg-red-500/10'
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                Clear / Untag
                              </span>
                              {!card.tosTopicId && <Check size={12} className="text-red-400" />}
                            </button>
                          </div>

                          {/* Subtopics List */}
                          <div className="overflow-y-auto show-scrollbar p-1.5 flex-1 max-h-48 space-y-2">
                            {availableTopicGroups.length === 0 ? (
                              <div className="p-3 text-center text-[11px] font-['JetBrains_Mono'] text-text-muted">
                                No subtopics match &ldquo;{tagSearch}&rdquo;
                              </div>
                            ) : (
                              availableTopicGroups.map((group) => (
                                <div key={group.parent.id} className="space-y-0.5">
                                  <div className="px-2 py-0.5 text-[9px] font-['Orbitron'] font-bold text-text-muted/70 tracking-wider truncate uppercase">
                                    {group.parent.name}
                                  </div>
                                  {group.subtopics.map((st) => {
                                    const isSelected = card.tosTopicId === st.id
                                    return (
                                      <button
                                        key={st.id}
                                        type="button"
                                        disabled={savingTagId === card.id}
                                        onClick={() => handleUpdateCardTag(card.id, st.id)}
                                        className={`w-full px-2 py-1 rounded text-left text-[11px] font-['JetBrains_Mono'] flex items-center justify-between gap-1.5 transition-colors ${
                                          isSelected
                                            ? 'bg-accent/15 text-accent font-bold border border-accent/40'
                                            : 'text-text-primary hover:bg-[#252525]'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="text-[10px] font-bold text-accent shrink-0">{st.code}</span>
                                          <span className="truncate text-text-primary">{st.title}</span>
                                        </div>
                                        {isSelected && <Check size={12} className="text-accent shrink-0" />}
                                      </button>
                                    )
                                  })}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Question / Front Snippet */}
                <p className="text-sm font-['JetBrains_Mono'] text-text-primary leading-relaxed whitespace-pre-wrap">
                  {card.preview || '<No content preview available>'}
                </p>

                {/* Question Image Preview if available */}
                {card.imagePath && (
                  <div className="my-1 p-2 rounded-lg bg-[#0c0c0c] border border-border-base/50 flex flex-col gap-1 items-start">
                    <img
                      src={`ece-app://${card.imagePath}`}
                      alt="Question diagram"
                      className="max-h-56 max-w-full rounded border border-[#222] object-contain cursor-pointer hover:border-accent transition-colors"
                      onClick={() => window.open(`ece-app://${card.imagePath}`, '_blank')}
                      title="Click to view full image in new window"
                    />
                    <span className="text-[9px] font-['JetBrains_Mono'] text-text-muted">Click image to expand in new window</span>
                  </div>
                )}

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
