import React, { useEffect, useState, useMemo } from 'react'
import {
  Search,
  ExternalLink,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Filter,
} from 'lucide-react'
import { TOC_DATA, SubjectArea, Topic } from '../../toc/data'
import { TOS_SUBJECT_COLORS } from '../../../lib/tosData'
import { useDataLabStore } from '../../../store/useDataLabStore'
import { TosCardInspectorModal } from './TosCardInspectorModal'

type StatusFilter = 'all' | 'covered' | 'missing' | 'unclassified'
type SubjectTab = 'ALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST'

const SUBJECT_TABS: SubjectTab[] = ['ALL', 'MATH', 'GEAS', 'ELECS', 'EST']

export function TosCoverageMatrixDemo() {
  const matrix = useDataLabStore((state) => state.tosCoverageMatrix)
  const loading = useDataLabStore((state) => state.loading.tosCoverageMatrix)
  const error = useDataLabStore((state) => state.errors.tosCoverageMatrix)
  const fetchTosCoverageMatrix = useDataLabStore((state) => state.fetchTosCoverageMatrix)

  const [selectedSubject, setSelectedSubject] = useState<SubjectTab>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)

  // Inspector modal state
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectParams, setInspectParams] = useState<{
    subject: string
    tosTopicId?: string | null
    topicTitle: string
    isUnclassified?: boolean
  }>({
    subject: 'ELECS',
    topicTitle: '',
  })

  useEffect(() => {
    fetchTosCoverageMatrix()
  }, [fetchTosCoverageMatrix])

  useEffect(() => {
    const handleFocus = () => {
      fetchTosCoverageMatrix()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchTosCoverageMatrix])

  // Handle subject switching cleanly, syncing the active topic
  const handleSubjectChange = (newSubject: SubjectTab) => {
    setSelectedSubject(newSubject)
    if (newSubject === 'ALL') {
      const firstTopic = TOC_DATA[0]?.topics[0]
      if (firstTopic) {
        setSelectedTopicId(firstTopic.id)
      }
    } else {
      const subjectArea = TOC_DATA.find((s) => s.id === newSubject)
      const firstTopic = subjectArea?.topics[0]
      if (firstTopic) {
        setSelectedTopicId(firstTopic.id)
      }
    }
  }

  const openInspector = (
    subject: string,
    topicTitle: string,
    tosTopicId?: string | null,
    isUnclassified: boolean = false
  ) => {
    setInspectParams({
      subject,
      topicTitle,
      tosTopicId,
      isUnclassified,
    })
    setInspectorOpen(true)
  }

  // Filtered Subject List
  const subjectsToRender = useMemo(() => {
    if (selectedSubject === 'ALL') return TOC_DATA
    return TOC_DATA.filter((s) => s.id === selectedSubject)
  }, [selectedSubject])

  // Aggregate statistics for ribbon
  const stats = useMemo(() => {
    if (!matrix) {
      return {
        totalCards: 0,
        classified: 0,
        unclassified: 0,
        coveredSubtopics: 0,
        totalSubtopics: 0,
      }
    }

    let coveredSubtopics = 0
    let totalSubtopics = 0

    TOC_DATA.forEach((subject) => {
      const subCounts = matrix.bySubject[subject.id]?.countsByTosId || {}
      subject.topics.forEach((t) => {
        t.subtopics.forEach((st) => {
          totalSubtopics++
          if ((subCounts[st.id] || 0) > 0) {
            coveredSubtopics++
          }
        })
      })
    })

    return {
      totalCards: matrix.totalCards,
      classified: matrix.totalClassified,
      unclassified: matrix.totalUnclassified,
      coveredSubtopics,
      totalSubtopics,
    }
  }, [matrix])

  // Flat list of topics based on subject, status filter, and search
  const filteredTopics = useMemo(() => {
    const list: Array<{
      subject: SubjectArea
      topic: Topic
      totalCards: number
      coveredSubCount: number
      subCounts: Record<string, number>
    }> = []

    subjectsToRender.forEach((subject) => {
      const subCounts = matrix?.bySubject[subject.id]?.countsByTosId || {}
      subject.topics.forEach((topic) => {
        const topicParentCount = subCounts[topic.id] || 0
        let totalTopicCards = topicParentCount
        let coveredSubCount = 0

        topic.subtopics.forEach((st) => {
          const count = subCounts[st.id] || 0
          totalTopicCards += count
          if (count > 0) coveredSubCount++
        })

        if (statusFilter === 'covered' && totalTopicCards === 0) return
        if (statusFilter === 'missing' && totalTopicCards > 0) return

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchesTopic =
            topic.id.toLowerCase().includes(q) || topic.name.toLowerCase().includes(q)
          const matchesSub = topic.subtopics.some(
            (st) => st.id.toLowerCase().includes(q) || st.name.toLowerCase().includes(q)
          )
          if (!matchesTopic && !matchesSub) return
        }

        list.push({
          subject,
          topic,
          totalCards: totalTopicCards,
          coveredSubCount,
          subCounts,
        })
      })
    })

    return list
  }, [subjectsToRender, matrix, statusFilter, searchQuery])

  // Active topic item in Detail pane
  const activeTopicItem = useMemo(() => {
    if (!filteredTopics.length) return null
    if (!selectedTopicId) return filteredTopics[0]
    const found = filteredTopics.find((item) => item.topic.id === selectedTopicId)
    return found || filteredTopics[0]
  }, [filteredTopics, selectedTopicId])

  if (loading && !matrix) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[350px] justify-center items-center">
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-widest animate-pulse">
          Loading Table of Specifications classification matrix…
        </span>
      </div>
    )
  }

  if (error && !matrix) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[300px] justify-center items-center text-center">
        <p className="font-['Rajdhani'] uppercase tracking-widest text-[#ef4444] text-sm font-bold">
          {error}
        </p>
      </div>
    )
  }

  return (
    <div
      className="bg-surface p-4 lg:p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3.5 w-full max-w-7xl mx-auto"
      data-testid="tos-coverage-matrix-demo"
    >
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-base/50 pb-3">
        <div className="flex items-center gap-2.5">
          <Layers className="text-accent shrink-0" size={18} />
          <div>
            <h2 className="font-['Orbitron'] text-sm sm:text-base font-bold text-text-primary tracking-wide uppercase">
              ToS Classification & Coverage Matrix
            </h2>
            <p className="text-[11px] font-['Rajdhani'] uppercase tracking-wider text-text-muted font-semibold">
              PRC Table of Specifications mapping & card coverage
            </p>
          </div>
        </div>

        {/* Global untagged status chip */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {stats.unclassified > 0 ? (
            <button
              onClick={() =>
                openInspector(
                  selectedSubject === 'ALL' ? 'ELECS' : selectedSubject,
                  'All Unclassified / Untagged Cards in Library',
                  null,
                  true
                )
              }
              className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-['JetBrains_Mono'] font-bold flex items-center gap-1.5 transition-colors"
            >
              <AlertTriangle size={12} />
              <span>{stats.unclassified} Untagged Cards</span>
            </button>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-xs font-['JetBrains_Mono'] font-bold flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              <span>100% Classified</span>
            </span>
          )}
        </div>
      </div>

      {/* Sleek Single-Line Summary Ribbon */}
      <div className="bg-[#0b0b0b] border border-border-base/70 rounded-lg px-3.5 py-2 flex items-center justify-between flex-wrap gap-2 text-xs font-['JetBrains_Mono']">
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[10px] font-['Rajdhani'] uppercase tracking-wider font-bold">
              Total Cards:
            </span>
            <span className="font-bold text-text-primary">{stats.totalCards.toLocaleString()}</span>
          </div>

          <span className="text-[#333] hidden sm:inline">|</span>

          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[10px] font-['Rajdhani'] uppercase tracking-wider font-bold">
              Classified:
            </span>
            <span className="font-bold text-accent">
              {stats.classified.toLocaleString()}{' '}
              <span className="text-text-muted font-normal text-[10px]">
                ({stats.totalCards > 0 ? ((stats.classified / stats.totalCards) * 100).toFixed(1) : '0'}%)
              </span>
            </span>
          </div>

          <span className="text-[#333] hidden sm:inline">|</span>

          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[10px] font-['Rajdhani'] uppercase tracking-wider font-bold">
              Untagged:
            </span>
            {stats.unclassified > 0 ? (
              <button
                onClick={() =>
                  openInspector(
                    selectedSubject === 'ALL' ? 'ELECS' : selectedSubject,
                    'All Unclassified / Untagged Cards in Library',
                    null,
                    true
                  )
                }
                className="text-red-400 hover:text-red-300 font-bold underline transition-colors"
              >
                {stats.unclassified} cards
              </button>
            ) : (
              <span className="text-emerald-400 font-bold">0 cards</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-text-muted text-[10px] font-['Rajdhani'] uppercase tracking-wider font-bold">
            Coverage:
          </span>
          <span className="font-bold text-text-primary">
            {stats.coveredSubtopics}/{stats.totalSubtopics} Subtopics
          </span>
          <span className="text-accent text-[11px] font-bold">
            ({stats.totalSubtopics > 0 ? ((stats.coveredSubtopics / stats.totalSubtopics) * 100).toFixed(0) : '0'}%)
          </span>
        </div>
      </div>

      {/* Control Bar: LooksFam Subject Pillboxes & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* LooksFam Subject Filter Pillboxes */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {SUBJECT_TABS.map((s) => {
            const isActive = selectedSubject === s
            const colors = s !== 'ALL' ? TOS_SUBJECT_COLORS[s] : null
            const count =
              s === 'ALL'
                ? stats.totalCards
                : matrix?.bySubject[s]?.totalCards || 0

            return (
              <button
                key={s}
                onClick={() => handleSubjectChange(s)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border transition-all font-['Rajdhani'] font-bold text-xs uppercase tracking-wider shrink-0"
                style={
                  isActive
                    ? s === 'ALL'
                      ? {
                          background: 'rgba(0, 255, 65, 0.12)',
                          borderColor: 'rgba(0, 255, 65, 0.5)',
                          color: '#00FF41',
                          boxShadow: '0 0 16px rgba(0, 255, 65, 0.12)',
                        }
                      : {
                          background: `rgba(${colors?.accentRgb}, 0.15)`,
                          borderColor: `rgba(${colors?.accentRgb}, 0.5)`,
                          color: colors?.accent,
                          boxShadow: `0 0 16px rgba(${colors?.accentRgb}, 0.12)`,
                        }
                    : {
                        background: '#0c0c0c',
                        borderColor: '#2a2a2a',
                        color: '#777',
                      }
                }
              >
                <span>{s}</span>
                <span
                  className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.2 rounded transition-colors"
                  style={{
                    backgroundColor: isActive ? 'rgba(0, 0, 0, 0.4)' : '#161616',
                    color: isActive ? 'inherit' : '#666',
                    border: isActive ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #222',
                  }}
                >
                  {count.toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>

        {/* Topic Search Input */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search topic or code (e.g. 6.4, PLC)…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0c0c0c] border border-border-base focus:border-[var(--accent-primary)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary font-['JetBrains_Mono'] outline-none transition-colors"
          />
        </div>
      </div>

      {/* Status Filter Badges */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-text-muted font-['Rajdhani'] uppercase tracking-wider font-bold text-[11px] flex items-center gap-1">
          <Filter size={11} />
          <span>Filter:</span>
        </span>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-2.5 py-1 rounded text-[11px] font-['JetBrains_Mono'] transition-colors ${
            statusFilter === 'all'
              ? 'bg-accent/20 text-accent border border-accent/40 font-bold'
              : 'bg-[#0c0c0c] text-text-muted hover:text-text-primary border border-border-base'
          }`}
        >
          All Topics
        </button>
        <button
          onClick={() => setStatusFilter('covered')}
          className={`px-2.5 py-1 rounded text-[11px] font-['JetBrains_Mono'] transition-colors ${
            statusFilter === 'covered'
              ? 'bg-green-500/20 text-green-400 border border-green-500/40 font-bold'
              : 'bg-[#0c0c0c] text-text-muted hover:text-text-primary border border-border-base'
          }`}
        >
          Covered Only (&gt; 0)
        </button>
        <button
          onClick={() => setStatusFilter('missing')}
          className={`px-2.5 py-1 rounded text-[11px] font-['JetBrains_Mono'] transition-colors ${
            statusFilter === 'missing'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold'
              : 'bg-[#0c0c0c] text-text-muted hover:text-text-primary border border-border-base'
          }`}
        >
          Missing Only (0)
        </button>
        {stats.unclassified > 0 && (
          <button
            onClick={() => setStatusFilter('unclassified')}
            className={`px-2.5 py-1 rounded text-[11px] font-['JetBrains_Mono'] transition-colors ${
              statusFilter === 'unclassified'
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 font-bold'
                : 'bg-[#0c0c0c] text-text-muted hover:text-text-primary border border-border-base'
            }`}
          >
            Untagged Bucket ({stats.unclassified})
          </button>
        )}
      </div>

      {/* Master-Detail Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 rounded-xl border border-border-base bg-[#0A0A0A] overflow-hidden h-[580px] lg:h-[640px]">
        {/* Left Column: Master Topics List */}
        <div className="md:col-span-5 lg:col-span-4 border-b md:border-b-0 md:border-r border-border-base flex flex-col h-[280px] md:h-full min-h-0 bg-[#080808]">
          <div className="shrink-0 px-3.5 py-2.5 bg-[#111] border-b border-border-base flex items-center justify-between text-xs font-['Rajdhani'] uppercase tracking-wider font-bold">
            <span className="text-text-muted">PRC Topics</span>
            <span className="text-text-muted font-['JetBrains_Mono'] text-[11px]">
              {filteredTopics.length} {filteredTopics.length === 1 ? 'Topic' : 'Topics'}
            </span>
          </div>

          <div className="overflow-y-auto show-scrollbar flex-1 min-h-0 divide-y divide-border-base/30 pb-4">
            {filteredTopics.length === 0 ? (
              <div className="p-6 text-center text-text-muted font-['JetBrains_Mono'] text-xs">
                No topics match your filter.
              </div>
            ) : (
              filteredTopics.map((item) => {
                const isSelected = item.topic.id === activeTopicItem?.topic.id
                const color = TOS_SUBJECT_COLORS[item.subject.id]?.accent || '#00FF41'
                const subtopicPct =
                  (item.coveredSubCount / Math.max(item.topic.subtopics.length, 1)) * 100

                return (
                  <div
                    key={item.topic.id}
                    onClick={() => setSelectedTopicId(item.topic.id)}
                    className={`p-3 transition-colors cursor-pointer flex flex-col gap-1.5 border-l-2 ${
                      isSelected
                        ? 'bg-surface-2/90 text-text-primary'
                        : 'bg-transparent hover:bg-surface-2/30 text-text-muted border-l-transparent'
                    }`}
                    style={{
                      borderLeftColor: isSelected ? color : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="px-1.5 py-0.2 rounded text-[9px] font-['Rajdhani'] font-bold uppercase tracking-wider shrink-0"
                        style={{
                          color: color,
                          backgroundColor: `${color}15`,
                          border: `1px solid ${color}35`,
                        }}
                      >
                        {item.subject.id}
                      </span>
                      <span
                        className={`font-['Orbitron'] text-xs font-bold truncate flex-1 ${
                          isSelected ? 'text-text-primary' : 'text-text-muted'
                        }`}
                      >
                        {item.topic.name}
                      </span>
                    </div>

                    {/* Progress & Card Count — full width responsive track */}
                    <div className="flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] mt-0.5">
                      <span className="text-text-muted text-[10px] shrink-0 font-medium">
                        {item.coveredSubCount}/{item.topic.subtopics.length}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-[#181818] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${subtopicPct}%`,
                            backgroundColor:
                              subtopicPct === 100
                                ? '#00FF41'
                                : subtopicPct > 0
                                ? '#eab308'
                                : '#ef4444',
                          }}
                        />
                      </div>
                      <span
                        className={`font-bold shrink-0 text-[10px] ${
                          item.totalCards > 0 ? 'text-accent' : 'text-[#555]'
                        }`}
                      >
                        {item.totalCards} cards
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Detail Pane for Selected Topic */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col h-[380px] md:h-full min-h-0 bg-[#0C0C0C]">
          {activeTopicItem ? (
            <>
              {/* Detail Header */}
              <div className="shrink-0 p-3.5 sm:p-4 bg-[#111] border-b border-border-base flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider"
                        style={{
                          color: TOS_SUBJECT_COLORS[activeTopicItem.subject.id]?.accent || '#00FF41',
                          backgroundColor: `${TOS_SUBJECT_COLORS[activeTopicItem.subject.id]?.accent || '#00FF41'}15`,
                          border: `1px solid ${TOS_SUBJECT_COLORS[activeTopicItem.subject.id]?.accent || '#00FF41'}30`,
                        }}
                      >
                        {activeTopicItem.subject.id} • {activeTopicItem.subject.name}
                      </span>
                    </div>
                    <h3 className="font-['Orbitron'] text-xs sm:text-sm font-bold text-text-primary tracking-wide">
                      {activeTopicItem.topic.name}
                    </h3>
                  </div>

                  {activeTopicItem.totalCards > 0 && (
                    <button
                      onClick={() =>
                        openInspector(
                          activeTopicItem.subject.id,
                          `All Cards in ${activeTopicItem.topic.name}`,
                          activeTopicItem.topic.id,
                          false
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-2/80 text-text-primary border border-border-base text-xs font-['Rajdhani'] uppercase tracking-wider font-bold flex items-center gap-1.5 shrink-0 transition-colors"
                      title="Inspect all cards under this parent topic"
                    >
                      <span>Inspect All</span>
                      <ExternalLink size={12} className="text-accent" />
                    </button>
                  )}
                </div>

                {/* Full-Width Dedicated Coverage Progress Meter */}
                <div className="flex flex-col gap-1.5 pt-1 border-t border-border-base/40">
                  <div className="flex items-center justify-between text-xs font-['JetBrains_Mono'] text-text-muted">
                    <span className="text-[11px] flex items-center gap-1.5">
                      <span className="font-bold text-text-primary">
                        {activeTopicItem.coveredSubCount} of {activeTopicItem.topic.subtopics.length}
                      </span>
                      <span>subtopics covered</span>
                      <span className="text-accent font-bold">
                        ({Math.round((activeTopicItem.coveredSubCount / Math.max(activeTopicItem.topic.subtopics.length, 1)) * 100)}%)
                      </span>
                    </span>
                    <span className="font-bold text-text-primary text-[11px]">
                      {activeTopicItem.totalCards.toLocaleString()} cards
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#181818] overflow-hidden border border-white/[0.04]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(activeTopicItem.coveredSubCount / Math.max(activeTopicItem.topic.subtopics.length, 1)) * 100}%`,
                        backgroundColor:
                          activeTopicItem.coveredSubCount === activeTopicItem.topic.subtopics.length
                            ? '#00FF41'
                            : activeTopicItem.coveredSubCount > 0
                            ? '#eab308'
                            : '#ef4444',
                        boxShadow:
                          activeTopicItem.coveredSubCount === activeTopicItem.topic.subtopics.length
                            ? '0 0 10px rgba(0, 255, 65, 0.4)'
                            : undefined,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Direct Parent Tag Notice (if cards exist directly on parent topic code) */}
              {activeTopicItem.subCounts[activeTopicItem.topic.id] > 0 && (
                <div
                  onClick={() =>
                    openInspector(
                      activeTopicItem.subject.id,
                      `${activeTopicItem.topic.name} (Direct Parent Tag)`,
                      activeTopicItem.topic.id,
                      false
                    )
                  }
                  className="mx-3 sm:mx-4 mt-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between cursor-pointer hover:bg-amber-500/15 transition-colors shrink-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="font-['JetBrains_Mono'] text-xs text-amber-300 truncate">
                      {activeTopicItem.topic.id} Direct parent tag: {activeTopicItem.subCounts[activeTopicItem.topic.id]} cards
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-300 text-xs font-['JetBrains_Mono']">
                    <span>Inspect</span>
                    <Eye size={12} />
                  </div>
                </div>
              )}

              {/* Subtopics List */}
              <div className="overflow-y-auto show-scrollbar flex-1 min-h-0 p-3 sm:p-4 space-y-1.5 pb-6">
                {activeTopicItem.topic.subtopics.map((st) => {
                  const count = activeTopicItem.subCounts[st.id] || 0

                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        if (count > 0) {
                          openInspector(activeTopicItem.subject.id, `${st.id} ${st.name}`, st.id, false)
                        }
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                        count > 0
                          ? 'bg-[#101010] border-[#222] hover:border-accent/40 hover:bg-[#141414] cursor-pointer'
                          : 'bg-[#0a0a0a] border-[#1a1a1a] opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: count > 0 ? '#00FF41' : '#444' }}
                        />
                        <span className="font-['JetBrains_Mono'] text-xs text-accent/80 font-bold shrink-0">
                          {st.id}
                        </span>
                        <span className="font-['JetBrains_Mono'] text-xs text-text-muted hover:text-text-primary transition-colors truncate">
                          {st.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {count > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-['JetBrains_Mono'] font-bold bg-accent/10 text-accent border border-accent/25">
                            {count} card{count === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] text-[#555] bg-[#141414] border border-[#222]">
                            0 cards
                          </span>
                        )}
                        {count > 0 && (
                          <Eye size={12} className="text-text-muted hover:text-accent transition-colors" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-text-muted font-['JetBrains_Mono'] text-xs gap-2">
              <p>No topic selected or matching current filter.</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-accent underline text-xs font-['Rajdhani'] font-bold uppercase tracking-wider"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Inspector Modal */}
      <TosCardInspectorModal
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        subject={inspectParams.subject}
        tosTopicId={inspectParams.tosTopicId}
        topicTitle={inspectParams.topicTitle}
        isUnclassified={inspectParams.isUnclassified}
      />
    </div>
  )
}

export default TosCoverageMatrixDemo
