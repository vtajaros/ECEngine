import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  ShieldAlert,
  CheckCircle,
  RotateCcw,
  Search,
  Filter,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  CheckCheck,
  RefreshCw,
  Sparkles,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { gauntletService, ExcludedGauntletCard, ExcludedGauntletResult } from '../../../../services/gauntlet.service'
import { useDataLabStore } from '../../../../store/useDataLabStore'
import { TOS_SUBJECT_COLORS } from '../../../../lib/tosData'
import { resolveCorrectChoiceIndex, shouldStackChoices } from '../../../../lib/utils'
import { TOC_DATA } from '../../../toc/data'
import { renderMath } from '../../../../lib/latex'

type SubjectTab = 'ALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST'
const SUBJECT_TABS: SubjectTab[] = ['ALL', 'MATH', 'GEAS', 'ELECS', 'EST']

function getTopicName(id: string | null): string {
  if (!id) return 'Unclassified'
  for (const s of TOC_DATA) {
    for (const t of s.topics) {
      if (t.id === id) return `${t.id} - ${t.name}`
      for (const st of t.subtopics) {
        if (st.id === id) return `${st.id} - ${st.name}`
      }
    }
  }
  return id
}

interface GauntletExcludedQuestionsDemoProps {
  onBackToHierarchy?: () => void
  onQuestionReinserted?: () => void
}

export function GauntletExcludedQuestionsDemo({
  onBackToHierarchy,
  onQuestionReinserted,
}: GauntletExcludedQuestionsDemoProps) {
  const [exclusionType, setExclusionType] = useState<'all' | 'flagged' | 'problem_solving'>('all')
  const [selectedSubject, setSelectedSubject] = useState<SubjectTab>('ALL')
  const [selectedReason, setSelectedReason] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ExcludedGauntletResult>({
    cards: [],
    total: 0,
    totalExcludedCount: 0,
    flaggedCount: 0,
    autoExcludedCount: 0,
    reasonsBreakdown: {},
    subjectsBreakdown: {},
  })

  // Action states
  const [reinsertingId, setReinsertingId] = useState<string | null>(null)
  const [bulkReinserting, setBulkReinserting] = useState(false)
  const [expandedExplanationId, setExpandedExplanationId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showConfirmBulk, setShowConfirmBulk] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)

  const fetchTosCoverageMatrix = useDataLabStore((s) => s.fetchTosCoverageMatrix)
  const fetchGauntletEda = useDataLabStore((s) => s.fetchGauntletEda)

  const loadExcludedQuestions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await gauntletService.getExcludedQuestions({
        type: exclusionType,
        subject: selectedSubject === 'ALL' ? undefined : selectedSubject,
        reason: selectedReason === 'ALL' ? undefined : selectedReason,
        search: searchQuery.trim() || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      setData(res)
    } catch (err: any) {
      setError(err.message || 'Failed to load excluded questions')
    } finally {
      setLoading(false)
    }
  }, [exclusionType, selectedSubject, selectedReason, searchQuery, page, pageSize])

  useEffect(() => {
    loadExcludedQuestions()
  }, [loadExcludedQuestions])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }

  // Handle single question reinsertion
  const handleReinsert = async (cardId: string) => {
    setReinsertingId(cardId)
    try {
      await gauntletService.unflagQuestion(cardId)
      showToast('Question restored! Reinserted into Gauntlet fetching pool.')
      setData((prev) => {
        const removed = prev.cards.find((c) => c.id === cardId)
        return {
          ...prev,
          cards: prev.cards.filter((c) => c.id !== cardId),
          total: Math.max(0, prev.total - 1),
          totalExcludedCount: Math.max(0, (prev.totalExcludedCount || 0) - 1),
          flaggedCount:
            removed?.exclusionType === 'flagged'
              ? Math.max(0, prev.flaggedCount - 1)
              : prev.flaggedCount,
          autoExcludedCount:
            removed?.exclusionType === 'problem_solving'
              ? Math.max(0, prev.autoExcludedCount - 1)
              : prev.autoExcludedCount,
        }
      })
      fetchTosCoverageMatrix(true)
      fetchGauntletEda(true)
      onQuestionReinserted?.()
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Could not reinsert question'}`)
    } finally {
      setReinsertingId(null)
    }
  }

  // Handle bulk reinsertion of all filtered cards
  const handleBulkReinsert = async () => {
    if (data.cards.length === 0) return
    setBulkReinserting(true)
    setShowConfirmBulk(false)
    try {
      const ids = data.cards.map((c) => c.id)
      await gauntletService.reinsertQuestions(ids)
      showToast(`Successfully reinserted ${ids.length} questions into Gauntlet pool!`)
      loadExcludedQuestions()
      fetchTosCoverageMatrix(true)
      fetchGauntletEda(true)
      onQuestionReinserted?.()
    } catch (err: any) {
      showToast(`Error: ${err.message || 'Could not reinsert questions'}`)
    } finally {
      setBulkReinserting(false)
    }
  }

  const reasonOptions = useMemo(() => {
    return Object.keys(data.reasonsBreakdown || {})
  }, [data.reasonsBreakdown])

  return (
    <div
      className="bg-surface p-4 lg:p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-4 w-full max-w-7xl mx-auto relative"
      data-testid="gauntlet-excluded-questions-demo"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="bg-[#111] border border-accent/60 text-text-primary px-4 py-3 rounded-xl shadow-[0_0_20px_rgba(0,255,65,0.25)] flex items-center gap-3">
            <Sparkles className="text-accent" size={18} />
            <span className="font-['Rajdhani'] font-bold text-sm tracking-wide text-white">
              {toastMessage}
            </span>
          </div>
        </div>
      )}

      {/* Zoomed Image Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-[#111] border border-border-base p-2 rounded-xl">
            <img
              src={`ece-app://${zoomedImage}`}
              alt="Zoomed diagram"
              className="max-h-[80vh] w-auto object-contain rounded-lg"
            />
            <p className="text-center text-xs text-text-muted mt-2 font-['JetBrains_Mono']">
              Click anywhere to close
            </p>
          </div>
        </div>
      )}

      {/* Bulk Confirm Modal */}
      {showConfirmBulk && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#111] border border-accent/40 rounded-xl p-6 max-w-md w-full shadow-[0_0_30px_rgba(0,255,65,0.2)] flex flex-col gap-4">
            <div className="flex items-center gap-3 text-accent">
              <ShieldAlert size={24} />
              <h3 className="font-['Orbitron'] font-bold text-lg text-white">
                Reinsert All Filtered?
              </h3>
            </div>
            <p className="text-text-muted text-sm font-['Rajdhani'] leading-relaxed">
              This will reinsert{' '}
              <strong className="text-white">{data.cards.length} questions</strong> back into your
              active Gauntlet fetching pool. They will immediately become eligible to appear in future
              timed and survival gauntlet runs.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-base/50">
              <button
                type="button"
                onClick={() => setShowConfirmBulk(false)}
                className="px-4 py-2 rounded-lg border border-border-base text-text-muted hover:text-white text-xs font-['Rajdhani'] font-bold uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkReinsert}
                className="px-4 py-2 rounded-lg bg-accent text-black font-['Orbitron'] font-bold text-xs uppercase tracking-wider hover:bg-accent/80 transition-all shadow-[0_0_12px_rgba(0,255,65,0.3)]"
              >
                Confirm Reinsert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-base/50 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 className="font-['Orbitron'] text-base sm:text-lg font-bold text-text-primary tracking-wide uppercase flex items-center gap-2">
              Gauntlet Excluded Questions
            </h2>
            <p className="text-xs font-['Rajdhani'] uppercase tracking-wider text-text-muted font-semibold">
              Review questions flagged or filtered from the gauntlet pool & reinsert valid questions
            </p>
          </div>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center p-1 bg-[#0c0c0c] rounded-lg border border-border-base">
            <button
              onClick={() => {
                setExclusionType('all')
                setSelectedReason('ALL')
                setPage(1)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-['Rajdhani'] uppercase tracking-wider font-bold transition-all ${
                exclusionType === 'all'
                  ? 'bg-accent/20 text-accent border border-accent/40 shadow-[0_0_10px_rgba(0,255,65,0.2)]'
                  : 'text-text-muted hover:text-text-primary border border-transparent'
              }`}
            >
              <span>All Excluded</span>
              <span className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.2 rounded bg-surface border border-border-base text-accent">
                {(data.totalExcludedCount || (data.flaggedCount + data.autoExcludedCount)).toLocaleString()}
              </span>
            </button>
            <button
              onClick={() => {
                setExclusionType('flagged')
                setSelectedReason('ALL')
                setPage(1)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-['Rajdhani'] uppercase tracking-wider font-bold transition-all ${
                exclusionType === 'flagged'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'text-text-muted hover:text-text-primary border border-transparent'
              }`}
            >
              <span>Flagged Questions</span>
              <span className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.2 rounded bg-surface border border-border-base text-amber-400">
                {data.flaggedCount.toLocaleString()}
              </span>
            </button>
            <button
              onClick={() => {
                setExclusionType('problem_solving')
                setSelectedReason('ALL')
                setPage(1)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-['Rajdhani'] uppercase tracking-wider font-bold transition-all ${
                exclusionType === 'problem_solving'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                  : 'text-text-muted hover:text-text-primary border border-transparent'
              }`}
            >
              <span>Auto-Filtered (Calc)</span>
              <span className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.2 rounded bg-surface border border-border-base text-text-muted">
                {data.autoExcludedCount.toLocaleString()}
              </span>
            </button>
          </div>

          {onBackToHierarchy && (
            <button
              onClick={onBackToHierarchy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 border border-border-base hover:border-accent text-text-muted hover:text-text-primary text-xs font-['Rajdhani'] uppercase font-bold tracking-wider transition-colors"
            >
              <Layers size={13} />
              <span>Back to Hierarchy</span>
            </button>
          )}
        </div>
      </div>

      {/* Control Ribbon: Subject Filter, Reason Filter, Search, Bulk Action */}
      <div className="bg-[#0b0b0b] border border-border-base/70 rounded-lg p-3 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* LooksFam Subject Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {SUBJECT_TABS.map((s) => {
              const isActive = selectedSubject === s
              const colors = s !== 'ALL' ? TOS_SUBJECT_COLORS[s] : null
              const count =
                s === 'ALL'
                  ? exclusionType === 'all'
                    ? (data.totalExcludedCount || (data.flaggedCount + data.autoExcludedCount))
                    : exclusionType === 'flagged'
                    ? data.flaggedCount
                    : data.autoExcludedCount
                  : data.subjectsBreakdown[s] || 0

              return (
                <button
                  key={s}
                  onClick={() => {
                    setSelectedSubject(s)
                    setPage(1)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg border transition-all font-['Rajdhani'] font-bold text-xs uppercase tracking-wider shrink-0"
                  style={
                    isActive
                      ? s === 'ALL'
                        ? {
                            background: 'rgba(245, 158, 11, 0.15)',
                            borderColor: 'rgba(245, 158, 11, 0.5)',
                            color: '#F59E0B',
                            boxShadow: '0 0 12px rgba(245, 158, 11, 0.15)',
                          }
                        : {
                            background: `rgba(${colors?.accentRgb}, 0.15)`,
                            borderColor: `rgba(${colors?.accentRgb}, 0.5)`,
                            color: colors?.accent,
                            boxShadow: `0 0 12px rgba(${colors?.accentRgb}, 0.12)`,
                          }
                      : {
                          background: '#0c0c0c',
                          borderColor: '#2a2a2a',
                          color: '#777',
                        }
                  }
                >
                  <span>{s}</span>
                  <span className="font-['JetBrains_Mono'] text-[10px] px-1 py-0.2 rounded bg-black/40 text-inherit border border-white/5">
                    {count.toLocaleString()}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-64 shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search question, choice, code…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="w-full bg-[#0c0c0c] border border-border-base focus:border-accent rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary font-['JetBrains_Mono'] outline-none transition-colors"
            />
          </div>
        </div>

        {/* Second Row: Reason Filter & Bulk Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border-base/40">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-['Rajdhani'] uppercase tracking-wider text-text-muted font-bold flex items-center gap-1">
              <Filter size={12} /> Reason:
            </span>
            <button
              onClick={() => {
                setSelectedReason('ALL')
                setPage(1)
              }}
              className={`px-2.5 py-0.5 rounded text-xs font-['Rajdhani'] font-bold uppercase transition-all ${
                selectedReason === 'ALL'
                  ? 'bg-surface-2 text-white border border-border-base'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              All Reasons
            </button>
            {reasonOptions.map((reason) => {
              const isCalc = reason.toLowerCase().includes('problem solving') || reason.toLowerCase().includes('calculation')
              const isSelected = selectedReason === reason
              return (
                <button
                  key={reason}
                  onClick={() => {
                    setSelectedReason(reason)
                    setPage(1)
                  }}
                  className={`px-2.5 py-0.5 rounded text-xs font-['Rajdhani'] font-bold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? isCalc
                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/40 font-semibold'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/40 font-semibold'
                      : 'text-text-muted hover:text-white'
                  }`}
                >
                  <span>{reason}</span>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-text-muted">
                    ({data.reasonsBreakdown[reason]})
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadExcludedQuestions()}
              disabled={loading}
              className="p-1.5 rounded-lg border border-border-base text-text-muted hover:text-white hover:border-border-hover transition-colors"
              title="Refresh questions"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>

            {data.cards.length > 0 && (
              <button
                onClick={() => setShowConfirmBulk(true)}
                disabled={bulkReinserting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 border border-accent/40 text-accent hover:bg-accent hover:text-black font-['Rajdhani'] text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(0,255,65,0.15)]"
              >
                <RotateCcw size={12} />
                <span>Reinsert All Filtered ({data.cards.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards List View */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3 min-h-[300px]">
          <RefreshCw className="animate-spin text-accent" size={24} />
          <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-widest">
            Loading excluded questions…
          </span>
        </div>
      ) : error ? (
        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
          <p className="text-red-400 font-['Rajdhani'] font-bold text-sm tracking-wider uppercase">
            {error}
          </p>
          <button
            onClick={() => loadExcludedQuestions()}
            className="text-xs font-['JetBrains_Mono'] text-accent underline mt-2"
          >
            Retry
          </button>
        </div>
      ) : data.cards.length === 0 ? (
        <div className="p-12 border border-border-base/60 rounded-xl bg-[#0b0b0b] flex flex-col items-center justify-center text-center gap-3 min-h-[320px]">
          <div className="p-3 rounded-full bg-accent/10 border border-accent/30 text-accent">
            <CheckCircle size={32} />
          </div>
          <h3 className="font-['Orbitron'] text-base font-bold text-white tracking-wide uppercase">
            No Excluded Questions Found
          </h3>
          <p className="text-text-muted text-xs font-['Rajdhani'] max-w-md leading-relaxed">
            {exclusionType === 'flagged'
              ? 'There are currently no flagged questions matching your filter. All eligible MCQs in this subject are active in your Gauntlet fetching pool!'
              : exclusionType === 'problem_solving'
              ? 'No problem-solving calculation cards found matching your filter.'
              : 'No excluded questions found matching your filter. All eligible MCQs in this subject are active in your Gauntlet fetching pool!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-['JetBrains_Mono'] text-text-muted px-1">
            <span>
              Showing <strong className="text-white">{data.total === 0 ? 0 : (page - 1) * pageSize + 1}</strong> -{' '}
              <strong className="text-white">{Math.min(page * pageSize, data.total)}</strong> of{' '}
              <strong className="text-white">{data.total.toLocaleString()}</strong> excluded questions
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[11px]">
                <span>Show:</span>
                {[25, 50, 100].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setPageSize(sz)
                      setPage(1)
                    }}
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-bold transition-colors ${
                      pageSize === sz
                        ? 'bg-accent/20 border-accent/50 text-accent'
                        : 'border-border-base bg-[#0c0c0c] hover:text-white'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
              <span className="text-[11px] hidden md:inline">Click "Reinsert into Pool" to restore any question</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {data.cards.map((card) => {
              const subjectColor = TOS_SUBJECT_COLORS[card.subject as SubjectTab]?.accent || '#00FF41'
              const isExplanationOpen = expandedExplanationId === card.id
              const isProcessing = reinsertingId === card.id
              const isFlagged = card.exclusionType === 'flagged'

              return (
                <div
                  key={card.id}
                  className="bg-[#0c0c0c] border border-border-base hover:border-border-hover/80 rounded-xl p-4 flex flex-col gap-3.5 transition-all shadow-md relative"
                >
                  {/* Top Bar: Subject, ToS Code, Source Deck, Reason Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-base/50 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] font-bold border"
                        style={{
                          backgroundColor: `${subjectColor}15`,
                          borderColor: `${subjectColor}40`,
                          color: subjectColor,
                        }}
                      >
                        {card.subject}
                      </span>

                      <span className="px-2 py-0.5 rounded text-[11px] font-['JetBrains_Mono'] bg-surface-2 border border-border-base text-text-primary">
                        {getTopicName(card.tosTopicId)}
                      </span>

                      <span className="text-[11px] font-['Rajdhani'] text-text-muted truncate max-w-xs">
                        From: {card.deckName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[11px] font-['Rajdhani'] font-bold border flex items-center gap-1 ${
                          isFlagged
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                            : 'bg-sky-500/15 border-sky-500/40 text-sky-400'
                        }`}
                      >
                        {isFlagged ? <AlertTriangle size={12} /> : <Calculator size={12} />}
                        {card.reason}
                      </span>
                      {card.flaggedAt && isFlagged && (
                        <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted">
                          {new Date(card.flaggedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Question Stem */}
                  <div className="flex flex-col gap-2">
                    <div
                      className="font-['Rajdhani'] font-bold text-sm lg:text-base text-text-primary leading-relaxed mcq-question-text"
                      dangerouslySetInnerHTML={{ __html: renderMath(card.question) }}
                    />

                    {/* Question Image if present */}
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

                  {/* Choices Grid */}
                  {(() => {
                    const correctIdx = resolveCorrectChoiceIndex(card.answer, card.choices)
                    const isStacked = shouldStackChoices(card.choices)
                    return (
                      <div className={`grid ${isStacked ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-2`}>
                        {card.choices.map((choice, cIdx) => {
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

                  {/* Optional Solution / Explanation */}
                  {(card.explanation || card.solutionImagePath) && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedExplanationId(isExplanationOpen ? null : card.id)
                        }
                        className="text-xs text-text-muted hover:text-text-primary font-['JetBrains_Mono'] flex items-center gap-1 self-start"
                      >
                        {isExplanationOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        <span>{isExplanationOpen ? 'Hide Explanation' : 'Show Explanation'}</span>
                      </button>

                      {isExplanationOpen && (
                        <div className="p-3 rounded-lg bg-surface-2 border border-border-base/70 text-xs font-['Rajdhani'] text-text-muted flex flex-col gap-2 animate-in fade-in duration-150">
                          {card.explanation && (
                            <div
                              dangerouslySetInnerHTML={{ __html: renderMath(card.explanation) }}
                            />
                          )}
                          {card.solutionImagePath && (
                            <button
                              type="button"
                              onClick={() => setZoomedImage(card.solutionImagePath!)}
                              className="flex items-center gap-1 text-accent hover:underline font-['JetBrains_Mono'] text-[11px]"
                            >
                              <ImageIcon size={12} />
                              <span>View Solution Diagram</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom Action Footer */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-border-base/50">
                    <span className="text-[11px] font-['JetBrains_Mono'] flex items-center gap-1 text-text-muted">
                      <ShieldAlert
                        size={13}
                        className={isFlagged ? 'text-amber-400' : 'text-sky-400'}
                      />
                      <span>
                        {isFlagged ? 'Flagged Question' : 'Calculation Heuristic'}
                      </span>
                    </span>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleReinsert(card.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent/15 border border-accent/50 text-accent hover:bg-accent hover:text-black text-xs font-['Rajdhani'] uppercase tracking-wider font-bold transition-all shadow-[0_0_12px_rgba(0,255,65,0.15)] disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Reinserting…</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={13} />
                          <span>Reinsert into Pool</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination Controls */}
          {Math.ceil(data.total / pageSize) > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border-base/50 text-xs font-['JetBrains_Mono']">
              <div className="text-text-muted">
                Page <strong className="text-white">{page}</strong> of{' '}
                <strong className="text-white">{Math.ceil(data.total / pageSize)}</strong>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded border border-border-base bg-[#0c0c0c] text-text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded border border-border-base bg-[#0c0c0c] text-text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                </button>

                <span className="px-3 py-1 rounded border border-border-base/80 bg-surface-2 text-text-primary font-bold">
                  {page} / {Math.ceil(data.total / pageSize)}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(Math.ceil(data.total / pageSize), p + 1))}
                  disabled={page >= Math.ceil(data.total / pageSize)}
                  className="p-1.5 rounded border border-border-base bg-[#0c0c0c] text-text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next Page"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.ceil(data.total / pageSize))}
                  disabled={page >= Math.ceil(data.total / pageSize)}
                  className="p-1.5 rounded border border-border-base bg-[#0c0c0c] text-text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>

              {/* Page size selector */}
              <div className="flex items-center gap-1.5 text-text-muted">
                <span>Per page:</span>
                {[25, 50, 100].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setPageSize(sz)
                      setPage(1)
                    }}
                    className={`px-2 py-0.5 rounded border text-[11px] font-bold transition-colors ${
                      pageSize === sz
                        ? 'bg-accent/20 border-accent/50 text-accent'
                        : 'border-border-base bg-[#0c0c0c] hover:text-white'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default GauntletExcludedQuestionsDemo
