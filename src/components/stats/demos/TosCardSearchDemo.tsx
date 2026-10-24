import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCheck,
  Loader2,
  Tag,
  BookOpen,
  Image as ImageIcon,
  Layers,
  ArrowRight,
  Sparkles,
  RotateCcw,
  Eye,
  EyeOff,
} from 'lucide-react'
import { renderMath } from '../../../lib/latex'
import { resolveCorrectChoiceIndex, shouldStackChoices } from '../../../lib/utils'
import { dbService } from '../../../services/db.service'
import { TOS_SUBJECT_COLORS } from '../../../lib/tosData'
import { getTosTopicGroupsBySubject, getTosTopicById } from '../../../lib/tosClassification'

export type SubjectTab = 'ALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST'
const SUBJECT_TABS: SubjectTab[] = ['ALL', 'MATH', 'GEAS', 'ELECS', 'EST']

type ClassificationFilter = 'all' | 'classified' | 'unclassified'

export interface TosCardSearchDemoProps {
  initialQuery?: string
  initialSubject?: SubjectTab
  onBackToHierarchy?: () => void
  onJumpToTopic?: (topicId: string, subject: string) => void
  onTagUpdated?: () => void
}

const PAGE_SIZE = 40

export function TosCardSearchDemo({
  initialQuery = '',
  initialSubject = 'ALL',
  onBackToHierarchy,
  onJumpToTopic,
  onTagUpdated,
}: TosCardSearchDemoProps) {
  const [searchInput, setSearchInput] = useState(initialQuery)
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery)
  const [selectedSubject, setSelectedSubject] = useState<SubjectTab>(initialSubject)
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('all')

  const [cards, setCards] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Explanation accordions
  const [expandedExplanationIds, setExpandedExplanationIds] = useState<Set<string>>(new Set())

  // Hidden definition/flip side overrides (default is VISIBLE)
  const [hiddenDefinitionIds, setHiddenDefinitionIds] = useState<Set<string>>(new Set())

  // Image zoom modal
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  // Tag editing popover
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [tagSearch, setTagSearch] = useState('')
  const [savingTagId, setSavingTagId] = useState<string | null>(null)
  const [popoverDirection, setPopoverDirection] = useState<'down' | 'up'>('down')
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // Debounce search input by 280ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 280)
    return () => clearTimeout(handler)
  }, [searchInput])

  // Sync initialQuery prop changes
  useEffect(() => {
    if (initialQuery !== undefined) {
      setSearchInput(initialQuery)
      setDebouncedSearch(initialQuery)
    }
  }, [initialQuery])

  // Fetch cards from backend
  const fetchCards = useCallback(
    async (offset: number, append: boolean = false) => {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        const payload: {
          subject?: string
          search?: string
          isUnclassified?: boolean
          limit: number
          offset: number
        } = {
          limit: PAGE_SIZE,
          offset,
        }

        if (selectedSubject !== 'ALL') {
          payload.subject = selectedSubject
        }

        if (debouncedSearch.trim()) {
          payload.search = debouncedSearch.trim()
        }

        if (classificationFilter === 'unclassified') {
          payload.isUnclassified = true
        }

        const res = await dbService.getCardsByTosTopic(payload)
        const fetchedCards = res?.cards || []
        const fetchedTotal = res?.total || 0

        // If classified filter is active (backend doesn't have isClassified boolean), filter client-side if needed
        let finalCards = fetchedCards
        if (classificationFilter === 'classified') {
          finalCards = fetchedCards.filter((c: any) => Boolean(c.tosTopicId))
        }

        if (append) {
          setCards((prev) => [...prev, ...finalCards])
        } else {
          setCards(finalCards)
          setTotal(fetchedTotal)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load cards')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [selectedSubject, debouncedSearch, classificationFilter]
  )

  // Refetch when filters or debounced search change
  useEffect(() => {
    fetchCards(0, false)
  }, [fetchCards])

  const handleLoadMore = () => {
    if (loadingMore || loading || cards.length >= total) return
    fetchCards(cards.length, true)
  }

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

  const toggleExplanation = (cardId: string) => {
    setExpandedExplanationIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }

  const toggleDefinition = (cardId: string) => {
    setHiddenDefinitionIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }

  const editingCard = useMemo(() => {
    return cards.find((c) => c.id === editingCardId)
  }, [cards, editingCardId])

  const availableTopicGroups = useMemo(() => {
    if (!editingCard) return []
    const cardSubject = editingCard.subject || (selectedSubject === 'ALL' ? 'ELECS' : selectedSubject)
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
  }, [editingCard, tagSearch, selectedSubject])

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

  return (
    <div className="flex flex-col gap-4 w-full" data-testid="tos-card-search-demo">
      {/* Control Bar: Search Input, Subject Filters & Classification Filter */}
      <div className="flex flex-col gap-3 bg-[#0A0A0A] p-3.5 rounded-xl border border-border-base">
        {/* Full-width Search Input */}
        <div className="relative w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent" />
          <input
            type="text"
            autoFocus
            placeholder="Search full question text, choices, formulas, tags, or deck name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-[#121212] border border-border-base focus:border-accent focus:ring-1 focus:ring-accent/40 rounded-xl pl-10 pr-10 py-2.5 text-sm text-text-primary font-['JetBrains_Mono'] outline-none transition-all placeholder:text-text-muted"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                setDebouncedSearch('')
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1 rounded-md transition-colors"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters Row: Subject Pills + Classification Chips */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Subject Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {SUBJECT_TABS.map((s) => {
              const isActive = selectedSubject === s
              const colors = s !== 'ALL' ? TOS_SUBJECT_COLORS[s] : null

              return (
                <button
                  key={s}
                  onClick={() => setSelectedSubject(s)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all font-['Rajdhani'] font-bold text-xs uppercase tracking-wider shrink-0"
                  style={
                    isActive
                      ? s === 'ALL'
                        ? {
                            background: 'rgba(0, 255, 65, 0.14)',
                            borderColor: 'rgba(0, 255, 65, 0.5)',
                            color: '#00FF41',
                            boxShadow: '0 0 12px rgba(0, 255, 65, 0.15)',
                          }
                        : {
                            background: `rgba(${colors?.accentRgb}, 0.16)`,
                            borderColor: `rgba(${colors?.accentRgb}, 0.5)`,
                            color: colors?.accent,
                            boxShadow: `0 0 12px rgba(${colors?.accentRgb}, 0.15)`,
                          }
                      : {
                          background: '#0c0c0c',
                          borderColor: '#262626',
                          color: '#777',
                        }
                  }
                >
                  <span>{s}</span>
                </button>
              )
            })}
          </div>

          {/* Classification Filter Chips */}
          <div className="flex items-center gap-1.5 bg-[#0e0e0e] p-1 rounded-lg border border-border-base shrink-0 self-start sm:self-auto">
            {(
              [
                { id: 'all', label: 'All Cards' },
                { id: 'classified', label: 'Classified' },
                { id: 'unclassified', label: 'Untagged' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setClassificationFilter(f.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider transition-all ${
                  classificationFilter === f.id
                    ? 'bg-accent/15 text-accent border border-accent/40 shadow-[0_0_8px_rgba(0,255,65,0.18)]'
                    : 'text-text-muted hover:text-text-primary border border-transparent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Header Info Bar */}
      <div className="flex items-center justify-between px-1 text-xs font-['JetBrains_Mono'] text-text-muted">
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="flex items-center gap-2 text-accent">
              <Loader2 size={13} className="animate-spin" />
              <span>Searching cards…</span>
            </div>
          ) : (
            <span>
              Found <strong className="text-text-primary font-bold">{total.toLocaleString()}</strong> cards
              {debouncedSearch ? (
                <>
                  {' '}matching &ldquo;
                  <span className="text-accent font-semibold">{debouncedSearch}</span>
                  &rdquo;
                </>
              ) : null}
            </span>
          )}
        </div>

        {onBackToHierarchy && (
          <button
            onClick={onBackToHierarchy}
            className="text-text-muted hover:text-accent flex items-center gap-1 transition-colors text-[11px] font-['Rajdhani'] uppercase tracking-wider font-bold"
          >
            <Layers size={12} />
            <span>Return to ToS Hierarchy</span>
          </button>
        )}
      </div>

      {/* Cards List or Empty / Error State */}
      {error ? (
        <div className="bg-[#121212] p-8 rounded-xl border border-red-500/30 text-center flex flex-col items-center justify-center gap-2">
          <p className="font-['Rajdhani'] uppercase tracking-wider text-red-400 font-bold text-sm">
            {error}
          </p>
          <button
            onClick={() => fetchCards(0, false)}
            className="px-3 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-['JetBrains_Mono'] border border-red-500/30"
          >
            Retry Search
          </button>
        </div>
      ) : cards.length === 0 && !loading ? (
        <div className="bg-[#0c0c0c] p-12 rounded-xl border border-border-base text-center flex flex-col items-center justify-center gap-3">
          <Search size={32} className="text-text-muted/50" />
          <h3 className="font-['Orbitron'] text-sm font-bold text-text-primary uppercase tracking-wider">
            No matching cards found
          </h3>
          <p className="text-xs text-text-muted max-w-md font-['Rajdhani']">
            {debouncedSearch
              ? `No cards found matching "${debouncedSearch}" under ${selectedSubject}. Try searching different keywords, formulas, or changing the subject.`
              : `No cards found in ${selectedSubject} with current filters.`}
          </p>
          {debouncedSearch && (
            <button
              onClick={() => {
                setSearchInput('')
                setDebouncedSearch('')
              }}
              className="mt-1 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-base text-xs font-['JetBrains_Mono'] text-accent transition-colors"
            >
              Clear Search Query
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((card) => {
            const subjectColor = TOS_SUBJECT_COLORS[card.subject]?.accent || '#00FF41'
            const tosTopic = card.tosTopicId ? getTosTopicById(card.tosTopicId) : null
            const isExplanationOpen = expandedExplanationIds.has(card.id)
            const isFormula = card.type === 'formula' || Boolean(card.latex)
            const isFlashcard =
              card.type === 'flashcard' ||
              card.type === 'concept' ||
              (!card.choices?.length && !isFormula && Boolean(card.back))
            const isDefHidden = hiddenDefinitionIds.has(card.id)

            return (
              <div
                key={card.id}
                className="bg-[#0b0b0b] hover:bg-[#0e0e0e] border border-border-base/70 hover:border-border-base rounded-xl p-4 transition-all flex flex-col gap-3 group relative shadow-md"
              >
                {/* Card Top Row: Deck, Subject, Card #, Type & ToS Tagging */}
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border-base/40 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Subject badge */}
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold font-['Rajdhani'] uppercase tracking-wider"
                      style={{
                        backgroundColor: `${subjectColor}18`,
                        color: subjectColor,
                        border: `1px solid ${subjectColor}40`,
                      }}
                    >
                      {card.subject}
                    </span>

                    {/* Deck Name & Card # */}
                    <span className="font-['JetBrains_Mono'] text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <BookOpen size={12} className="text-text-muted" />
                      <span className="truncate max-w-[200px] sm:max-w-[320px]">{card.deckName}</span>
                      <span className="text-text-muted font-normal">#{card.cardNumber || (card.orderIndex + 1)}</span>
                    </span>

                    {/* Card Type */}
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-['JetBrains_Mono'] uppercase tracking-wide bg-surface-2 text-text-muted border border-border-base">
                      {card.type}
                    </span>

                    {/* Difficulty */}
                    {card.difficulty && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-['JetBrains_Mono'] uppercase tracking-wide bg-surface-2 text-text-muted border border-border-base">
                        {card.difficulty}
                      </span>
                    )}
                  </div>

                  {/* ToS Classification Selector & Jump to Hierarchy Button */}
                  <div className="flex items-center gap-1.5 relative">
                    {/* Jump to Hierarchy Button (visible if tagged) */}
                    {card.tosTopicId && onJumpToTopic && (
                      <button
                        type="button"
                        onClick={() => onJumpToTopic(card.tosTopicId, card.subject)}
                        title="Jump to this topic in ToS Hierarchy view"
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted hover:text-accent bg-surface-2 hover:bg-accent/10 border border-border-base hover:border-accent/40 transition-colors"
                      >
                        <Layers size={11} />
                        <span className="hidden sm:inline">Jump</span>
                        <ArrowRight size={10} />
                      </button>
                    )}

                    {/* Interactive Tag Selector Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          if (editingCardId === card.id) {
                            setEditingCardId(null)
                            setTagSearch('')
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect()
                            const spaceBelow = window.innerHeight - rect.bottom
                            setPopoverDirection(spaceBelow < 320 ? 'up' : 'down')
                            setEditingCardId(card.id)
                            setTagSearch('')
                          }
                        }}
                        title="Click to classify or change ToS topic"
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-['JetBrains_Mono'] transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                          card.tosTopicId
                            ? 'bg-accent/10 hover:bg-accent/20 text-accent border border-accent/40 hover:border-accent shadow-[0_0_10px_rgba(0,255,65,0.1)]'
                            : 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 hover:border-amber-500/70 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                        }`}
                      >
                        <Tag size={11} />
                        <span className="max-w-[160px] sm:max-w-[240px] truncate">
                          {tosTopic ? `${tosTopic.code} ${tosTopic.title}` : card.tosTopicId || 'Untagged'}
                        </span>
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
                          className={`absolute right-0 ${
                            popoverDirection === 'up'
                              ? 'bottom-full mb-1.5 origin-bottom-right'
                              : 'top-full mt-1.5 origin-top-right'
                          } w-72 sm:w-84 max-h-80 bg-[#161616] border border-border-base rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.95)] z-40 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Popover Header */}
                          <div className="p-2.5 border-b border-border-base/50 bg-[#1c1c1c] flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold font-['Orbitron'] text-text-muted tracking-wider uppercase">
                                {card.subject} Topics & Subtopics
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
                                placeholder="Search subtopic (e.g. 1.3, calculus)…"
                                value={tagSearch}
                                onChange={(e) => setTagSearch(e.target.value)}
                                className="w-full bg-[#111] border border-border-base focus:border-accent rounded-md pl-7 pr-2 py-1 text-[11px] text-text-primary font-['JetBrains_Mono'] outline-none"
                              />
                            </div>
                          </div>

                          {/* Clear / Untag Option */}
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
                          <div className="overflow-y-auto show-scrollbar p-1.5 flex-1 max-h-56 space-y-2">
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

                {/* Card Stem / Question Content */}
                <div className="flex flex-col gap-2">
                  <div
                    className="font-['Rajdhani'] font-bold text-sm lg:text-base text-text-primary leading-relaxed mcq-question-text"
                    dangerouslySetInnerHTML={{ __html: renderMath(card.preview) }}
                  />

                  {/* Diagram / Image button if present */}
                  {card.imagePath && (
                    <div className="my-1">
                      <button
                        type="button"
                        onClick={() => setZoomedImage(card.imagePath!)}
                        className="flex items-center gap-1.5 text-xs text-accent hover:underline font-['JetBrains_Mono'] bg-surface-2 px-2.5 py-1 rounded border border-border-base"
                      >
                        <ImageIcon size={13} />
                        <span>View Question Diagram</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* MCQ Choices Preview */}
                {Array.isArray(card.choices) && card.choices.length > 0 && (() => {
                  const correctIdx = resolveCorrectChoiceIndex(card.answer, card.choices)
                  const isStacked = shouldStackChoices(card.choices)
                  return (
                    <div className={`grid ${isStacked ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-2 pt-1`}>
                      {card.choices.map((choice: string, cIdx: number) => {
                        const isCorrect = cIdx === correctIdx
                        const letter = String.fromCharCode(65 + cIdx)

                      return (
                        <div
                          key={cIdx}
                          className={`px-3 py-2 rounded-lg border text-xs font-['Rajdhani'] flex items-start gap-2.5 transition-all h-full ${
                            isCorrect
                              ? 'bg-accent/10 border-accent/60 text-white shadow-[0_0_14px_rgba(0,255,65,0.18)]'
                              : 'bg-surface-2 border-border-base text-text-muted'
                          }`}
                        >
                          <span
                            className={`font-['JetBrains_Mono'] font-bold text-[11px] shrink-0 mt-0.5 ${
                              isCorrect ? 'text-accent drop-shadow-[0_0_6px_rgba(0,255,65,0.4)]' : 'text-text-muted'
                            }`}
                          >
                            [{letter}]
                          </span>
                          <div
                            className={`flex-1 leading-snug ${isCorrect ? 'text-white font-semibold' : 'font-medium'}`}
                            dangerouslySetInnerHTML={{ __html: renderMath(choice) }}
                          />
                          {isCorrect && (
                            <span className="shrink-0 text-accent flex items-center gap-1 text-[10px] font-['JetBrains_Mono'] font-bold bg-accent/20 border border-accent/40 px-1.5 py-0.2 rounded shadow-[0_0_8px_rgba(0,255,65,0.2)]">
                              <CheckCheck size={11} /> Correct
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  )
                })()}

                {/* Flashcard / Concept Flip Side / Definition */}
                {isFlashcard && (card.back || card.imagePathBack) && (
                  <div className="rounded-xl border border-accent/40 bg-gradient-to-br from-accent/[0.08] via-surface-2 to-[#101010] p-3.5 flex flex-col gap-2.5 shadow-[0_0_16px_rgba(0,255,65,0.08)] transition-all">
                    <div className="flex items-center justify-between border-b border-accent/20 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-['Orbitron'] font-bold text-accent tracking-wider uppercase">
                        <Sparkles size={13} className="text-accent drop-shadow-[0_0_6px_rgba(0,255,65,0.5)]" />
                        <span>Answer &bull; Definition (Flip Side)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleDefinition(card.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] font-bold text-accent hover:text-white bg-accent/15 hover:bg-accent/25 border border-accent/30 transition-colors"
                        title={isDefHidden ? 'Reveal definition' : 'Hide definition'}
                      >
                        {isDefHidden ? <Eye size={11} /> : <EyeOff size={11} />}
                        <span>{isDefHidden ? 'Reveal Answer' : 'Hide'}</span>
                      </button>
                    </div>

                    {!isDefHidden && (
                      <>
                        {card.back && (
                          <div
                            className="font-['Rajdhani'] font-bold text-sm sm:text-base text-white leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: renderMath(card.back) }}
                          />
                        )}

                        {card.imagePathBack && (
                          <div className="my-1">
                            <button
                              type="button"
                              onClick={() => setZoomedImage(card.imagePathBack!)}
                              className="flex items-center gap-1.5 text-xs text-accent hover:underline font-['JetBrains_Mono'] bg-surface-2 px-2.5 py-1 rounded border border-border-base"
                            >
                              <ImageIcon size={13} />
                              <span>View Back Diagram</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Formula Equation & Variables (Flip Side) */}
                {isFormula && (card.latex || card.description || card.variables || card.back) && (
                  <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/[0.08] via-surface-2 to-[#101010] p-3.5 flex flex-col gap-2.5 shadow-[0_0_16px_rgba(6,182,212,0.08)] transition-all">
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-['Orbitron'] font-bold text-cyan-400 tracking-wider uppercase">
                        <Sparkles size={13} className="text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
                        <span>Formula &bull; Equation &amp; Variables (Flip Side)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleDefinition(card.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] font-bold text-cyan-400 hover:text-white bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 transition-colors"
                        title={isDefHidden ? 'Reveal formula' : 'Hide formula'}
                      >
                        {isDefHidden ? <Eye size={11} /> : <EyeOff size={11} />}
                        <span>{isDefHidden ? 'Reveal Formula' : 'Hide'}</span>
                      </button>
                    </div>

                    {!isDefHidden && (
                      <>
                        {/* Equation in KaTeX */}
                        {card.latex ? (
                          <div className="py-2.5 px-3 rounded-lg bg-black/60 border border-cyan-500/30 text-center flex items-center justify-center overflow-x-auto show-scrollbar shadow-inner">
                            <div
                              className="font-['Rajdhani'] font-bold text-base sm:text-lg text-white"
                              dangerouslySetInnerHTML={{ __html: renderMath(`$$${card.latex}$$`) }}
                            />
                          </div>
                        ) : card.back ? (
                          <div
                            className="font-['Rajdhani'] font-bold text-base text-white"
                            dangerouslySetInnerHTML={{ __html: renderMath(card.back) }}
                          />
                        ) : null}

                        {/* Description / Meaning */}
                        {card.description && (
                          <div
                            className="font-['Rajdhani'] font-medium text-xs sm:text-sm text-text-primary leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: renderMath(card.description) }}
                          />
                        )}

                        {/* Variables Breakdown */}
                        {card.variables && (
                          <div className="pt-1.5 border-t border-border-base/50 flex flex-col gap-1.5">
                            <span className="text-[10px] font-['JetBrains_Mono'] font-bold text-cyan-400/80 uppercase tracking-wider">
                              Variables:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {typeof card.variables === 'object' && !Array.isArray(card.variables)
                                ? Object.entries(card.variables).map(([k, v]) => (
                                    <div
                                      key={k}
                                      className="flex items-baseline gap-1.5 bg-black/40 px-2.5 py-1.5 rounded-lg border border-border-base/50 text-xs font-['JetBrains_Mono']"
                                    >
                                      <span
                                        className="text-cyan-400 font-bold shrink-0"
                                        dangerouslySetInnerHTML={{ __html: renderMath(`$${k}$`) }}
                                      />
                                      <span className="text-text-muted shrink-0">:</span>
                                      <span
                                        className="text-text-primary leading-snug truncate"
                                        dangerouslySetInnerHTML={{ __html: renderMath(String(v)) }}
                                      />
                                    </div>
                                  ))
                                : (
                                    <div
                                      className="text-text-primary text-xs font-['JetBrains_Mono']"
                                      dangerouslySetInnerHTML={{ __html: renderMath(String(card.variables)) }}
                                    />
                                  )}
                            </div>
                          </div>
                        )}

                        {card.imagePathBack && (
                          <div className="my-1">
                            <button
                              type="button"
                              onClick={() => setZoomedImage(card.imagePathBack!)}
                              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:underline font-['JetBrains_Mono'] bg-surface-2 px-2.5 py-1 rounded border border-border-base"
                            >
                              <ImageIcon size={13} />
                              <span>View Formula Diagram</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Explanation Accordion (if present) */}
                {card.explanation && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => toggleExplanation(card.id)}
                      className="text-xs text-text-muted hover:text-text-primary font-['JetBrains_Mono'] flex items-center gap-1 self-start transition-colors"
                    >
                      {isExplanationOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      <span>{isExplanationOpen ? 'Hide Explanation' : 'Show Explanation'}</span>
                    </button>

                    {isExplanationOpen && (
                      <div className="p-3 rounded-lg bg-surface-2 border border-border-base/70 text-xs font-['Rajdhani'] text-text-muted flex flex-col gap-2 animate-in fade-in duration-150">
                        <div dangerouslySetInnerHTML={{ __html: renderMath(card.explanation) }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Tags Footer */}
                {Array.isArray(card.tags) && card.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {card.tags.map((t: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] bg-[#161616] text-text-muted border border-border-base/60 flex items-center gap-1"
                      >
                        <Tag size={9} />
                        <span>{t}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Load More Button */}
          {cards.length < total && (
            <div className="flex justify-center pt-2 pb-4">
              <button
                type="button"
                disabled={loadingMore}
                onClick={handleLoadMore}
                className="px-5 py-2.5 rounded-xl bg-[#141414] hover:bg-[#1a1a1a] text-text-primary font-['Rajdhani'] font-bold text-xs uppercase tracking-wider border border-border-base hover:border-accent transition-all flex items-center gap-2 shadow-md"
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-accent" />
                    <span>Loading more cards…</span>
                  </>
                ) : (
                  <span>
                    Load More Cards ({cards.length} of {total.toLocaleString()})
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Zoomed Diagram Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] bg-[#111] p-3 rounded-2xl border border-border-base shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 text-text-muted hover:text-white p-1 rounded-md bg-surface-2 transition-colors z-10"
            >
              <X size={16} />
            </button>
            <img
              src={
                zoomedImage.startsWith('data:') || zoomedImage.startsWith('http')
                  ? zoomedImage
                  : zoomedImage.startsWith('ece-app://')
                  ? zoomedImage
                  : `ece-app://${zoomedImage}`
              }
              alt="Diagram Zoom"
              className="max-h-[75vh] w-auto object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  )
}
export default TosCardSearchDemo
