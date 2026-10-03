import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Target,
  Search,
  Flame,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Info,
  Check,
} from 'lucide-react'
import { gauntletService, type TosTopicPerformanceStat, type GauntletSubjectCode } from '../../../../services/gauntlet.service'
import { GAUNTLET_SUBJECT_COLORS } from '../../../../lib/dashboardUtils'
import { getTosTopicGroupsBySubject, type TosTopicGroup, type FlatTosTopic } from '../../../../lib/tosClassification'

type SubjectTab = 'ALL' | GauntletSubjectCode
type SortKey =
  | 'code_asc'
  | 'code_desc'
  | 'accuracy_asc'
  | 'accuracy_desc'
  | 'studied_desc'
  | 'studied_asc'
  | 'misses_desc'
  | 'attempts_desc'

interface SubtopicStatItem {
  id: string
  code: string
  title: string
  name: string
  subject: GauntletSubjectCode
  totalCards: number
  studiedCards: number
  totalAnswers: number
  correctAnswers: number
  wrongAnswers: number
  accuracy: number | null
  studyProgress: number
}

interface ParentTopicGroupItem {
  parent: FlatTosTopic
  subject: GauntletSubjectCode
  totalCards: number
  studiedCards: number
  totalAnswers: number
  correctAnswers: number
  wrongAnswers: number
  accuracy: number | null
  studyProgress: number
  subtopics: SubtopicStatItem[]
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string; description: string }> = [
  { key: 'code_asc', label: 'Syllabus Order (1.0, 2.0...)', description: 'PRC syllabus hierarchy' },
  { key: 'code_desc', label: 'Reverse Syllabus Order', description: 'PRC syllabus descending' },
  { key: 'accuracy_asc', label: 'Lowest Accuracy (Weakest)', description: 'Struggling topics first' },
  { key: 'accuracy_desc', label: 'Highest Accuracy', description: 'Mastered topics first' },
  { key: 'studied_desc', label: 'Highest Studied Progress', description: 'Most card coverage first' },
  { key: 'studied_asc', label: 'Lowest Studied Progress', description: 'Untested card pools first' },
  { key: 'misses_desc', label: 'Most Misses (Wrong Answers)', description: 'Highest count of errors' },
  { key: 'attempts_desc', label: 'Most Practiced (Attempts)', description: 'Most drilled competencies' },
]

export function getAccuracyBadgeStyle(accuracy: number | null, totalAnswers: number) {
  if (accuracy === null || totalAnswers === 0) {
    return {
      bg: 'bg-surface-2',
      border: 'border-border-base',
      text: 'text-text-muted',
      label: 'Untested',
      barColor: 'bg-text-muted/30',
      isWeak: false,
    }
  }

  // Calibration phase (sample too small: <3 attempts)
  if (totalAnswers < 3) {
    return {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      label: 'Calibrating',
      barColor: 'bg-blue-500',
      isWeak: false,
    }
  }

  // Robust sample (>= 3 attempts)
  if (accuracy < 0.5) {
    return {
      bg: 'bg-red-500/15',
      border: 'border-red-500/40',
      text: 'text-red-400',
      label: 'Critical Weakness',
      barColor: 'bg-red-500',
      isWeak: true,
    }
  }

  if (accuracy < 0.7) {
    return {
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/40',
      text: 'text-amber-400',
      label: 'Needs Review',
      barColor: 'bg-amber-500',
      isWeak: true,
    }
  }

  if (accuracy < 0.85) {
    return {
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/40',
      text: 'text-emerald-400',
      label: 'Solid',
      barColor: 'bg-emerald-500',
      isWeak: false,
    }
  }

  // Accuracy >= 0.85: Requires >= 5 attempts to earn "Mastered"
  if (totalAnswers >= 5) {
    return {
      bg: 'bg-cyan-500/15',
      border: 'border-cyan-500/40',
      text: 'text-cyan-400',
      label: 'Mastered',
      barColor: 'bg-accent',
      isWeak: false,
    }
  }

  // 85%+ accuracy with 3-4 attempts
  return {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    label: 'Strong',
    barColor: 'bg-emerald-500',
    isWeak: false,
  }
}

export function GauntletTopicAccuracyDemo() {
  const [subject, setSubject] = useState<SubjectTab>('ALL')
  const [scope, setScope] = useState<'gauntlet' | 'all'>('gauntlet')
  const [sortBy, setSortBy] = useState<SortKey>('code_asc')
  const [search, setSearch] = useState('')
  const [weakOnly, setWeakOnly] = useState(false)
  const [stats, setStats] = useState<TosTopicPerformanceStat[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Collapsed state per parent topic id (empty set = all expanded by default from frame 1)
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(new Set())

  // Custom sort menu dropdown state
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const sortDropdownRef = useRef<HTMLDivElement>(null)

  // Close sort dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false)
      }
    }
    if (isSortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSortDropdownOpen])

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await gauntletService.getTopicAccuracyStats({
        subject: subject === 'ALL' ? undefined : subject,
        scope,
        sortBy: 'code',
      })
      setStats(data)
    } catch (e) {
      setError((e as Error).message || 'Failed to load competency accuracy stats')
    } finally {
      setLoading(false)
    }
  }, [subject, scope])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  // Build a lookup map of stats by tosTopicId
  const statsMap = useMemo(() => {
    const map = new Map<string, TosTopicPerformanceStat>()
    for (const s of stats) {
      map.set(s.tosTopicId.toUpperCase().trim(), s)
    }
    return map
  }, [stats])

  // Aggregate hierarchical structure (Parent 1.0 -> Subtopics 1.1, 1.2...)
  const parentGroups = useMemo<ParentTopicGroupItem[]>(() => {
    const rawGroups: TosTopicGroup[] = getTosTopicGroupsBySubject(subject === 'ALL' ? null : subject)

    return rawGroups.map((g) => {
      const subj = g.parent.subject as GauntletSubjectCode

      const subtopics: SubtopicStatItem[] = g.subtopics.map((sub) => {
        const stat = statsMap.get(sub.id.toUpperCase().trim())
        const totalCards = stat?.totalCards || 0
        const studiedCards = stat?.studiedCards || 0
        const totalAnswers = stat?.totalAnswers || 0
        const correctAnswers = stat?.correctAnswers || 0
        const wrongAnswers = stat?.wrongAnswers || 0
        const accuracy = totalAnswers > 0 ? correctAnswers / totalAnswers : null
        const studyProgress = totalCards > 0 ? Math.round((studiedCards / totalCards) * 1000) / 10 : 0

        return {
          id: sub.id,
          code: sub.code,
          title: sub.title,
          name: sub.name,
          subject: subj,
          totalCards,
          studiedCards,
          totalAnswers,
          correctAnswers,
          wrongAnswers,
          accuracy,
          studyProgress,
        }
      })

      const parentTotalCards = subtopics.reduce((sum, s) => sum + s.totalCards, 0)
      const parentStudiedCards = subtopics.reduce((sum, s) => sum + s.studiedCards, 0)
      const parentTotalAnswers = subtopics.reduce((sum, s) => sum + s.totalAnswers, 0)
      const parentCorrectAnswers = subtopics.reduce((sum, s) => sum + s.correctAnswers, 0)
      const parentWrongAnswers = subtopics.reduce((sum, s) => sum + s.wrongAnswers, 0)
      const parentAccuracy = parentTotalAnswers > 0 ? parentCorrectAnswers / parentTotalAnswers : null
      const parentStudyProgress =
        parentTotalCards > 0 ? Math.round((parentStudiedCards / parentTotalCards) * 1000) / 10 : 0

      return {
        parent: g.parent,
        subject: subj,
        totalCards: parentTotalCards,
        studiedCards: parentStudiedCards,
        totalAnswers: parentTotalAnswers,
        correctAnswers: parentCorrectAnswers,
        wrongAnswers: parentWrongAnswers,
        accuracy: parentAccuracy,
        studyProgress: parentStudyProgress,
        subtopics,
      }
    })
  }, [subject, statsMap])

  // Filter and sort the hierarchical parent groups
  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().trim()

    const filtered = parentGroups
      .map((group) => {
        let matchingSubs = group.subtopics

        if (q) {
          matchingSubs = matchingSubs.filter(
            (sub) =>
              sub.title.toLowerCase().includes(q) ||
              sub.code.toLowerCase().includes(q) ||
              sub.id.toLowerCase().includes(q) ||
              group.parent.title.toLowerCase().includes(q) ||
              group.parent.code.toLowerCase().includes(q)
          )
        }

        if (weakOnly) {
          matchingSubs = matchingSubs.filter(
            (sub) => sub.accuracy !== null && sub.accuracy < 0.7 && sub.totalAnswers >= 3
          )
        }

        const isParentMatched =
          q &&
          (group.parent.title.toLowerCase().includes(q) ||
            group.parent.code.toLowerCase().includes(q) ||
            group.parent.id.toLowerCase().includes(q))

        if (matchingSubs.length === 0 && !isParentMatched) {
          return null
        }

        return {
          ...group,
          subtopics: matchingSubs,
        }
      })
      .filter((g): g is ParentTopicGroupItem => g !== null)

    // Sort parent groups based on sortBy
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'code_asc': {
          const numA = parseFloat(a.parent.code) || 0
          const numB = parseFloat(b.parent.code) || 0
          return numA - numB
        }
        case 'code_desc': {
          const numA = parseFloat(a.parent.code) || 0
          const numB = parseFloat(b.parent.code) || 0
          return numB - numA
        }
        case 'accuracy_asc': {
          // Untested topics at the bottom
          if (a.accuracy === null && b.accuracy === null) return 0
          if (a.accuracy === null) return 1
          if (b.accuracy === null) return -1
          return a.accuracy - b.accuracy
        }
        case 'accuracy_desc': {
          if (a.accuracy === null && b.accuracy === null) return 0
          if (a.accuracy === null) return 1
          if (b.accuracy === null) return -1
          return b.accuracy - a.accuracy
        }
        case 'studied_desc':
          return b.studyProgress - a.studyProgress
        case 'studied_asc':
          return a.studyProgress - b.studyProgress
        case 'misses_desc':
          return b.wrongAnswers - a.wrongAnswers
        case 'attempts_desc':
          return b.totalAnswers - a.totalAnswers
        default:
          return 0
      }
    })
  }, [parentGroups, search, weakOnly, sortBy])

  // Summary computations
  const summary = useMemo(() => {
    const allSubtopics = parentGroups.flatMap((p) => p.subtopics)
    const totalSubtopics = allSubtopics.length
    const attempted = allSubtopics.filter((s) => s.totalAnswers > 0)
    // Only certified weak topics with >= 3 attempts and < 70% accuracy
    const certifiedWeak = attempted.filter((s) => s.accuracy !== null && s.accuracy < 0.7 && s.totalAnswers >= 3)
    const calibrating = attempted.filter((s) => s.totalAnswers < 3)

    const totalAnswers = parentGroups.reduce((sum, s) => sum + s.totalAnswers, 0)
    const totalCorrect = parentGroups.reduce((sum, s) => sum + s.correctAnswers, 0)
    const totalStudiedCards = parentGroups.reduce((sum, s) => sum + s.studiedCards, 0)
    const totalLibraryCards = parentGroups.reduce((sum, s) => sum + s.totalCards, 0)

    const avgAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 1000) / 10 : null
    const studyPenetration = totalLibraryCards > 0 ? Math.round((totalStudiedCards / totalLibraryCards) * 1000) / 10 : 0

    return {
      totalSubtopics,
      attemptedCount: attempted.length,
      weakCount: certifiedWeak.length,
      calibratingCount: calibrating.length,
      totalAnswers,
      avgAccuracy,
      totalStudiedCards,
      totalLibraryCards,
      studyPenetration,
    }
  }, [parentGroups])

  // Toggle single parent collapsed state
  const toggleParentExpand = (parentId: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev)
      if (next.has(parentId)) {
        next.delete(parentId)
      } else {
        next.add(parentId)
      }
      return next
    })
  }

  // Check if all filtered groups are expanded
  const areAllExpanded = useMemo(() => {
    return filteredGroups.length > 0 && filteredGroups.every((g) => !collapsedParentIds.has(g.parent.id))
  }, [filteredGroups, collapsedParentIds])

  const toggleExpandAll = () => {
    if (areAllExpanded) {
      // Collapse all
      setCollapsedParentIds(new Set(filteredGroups.map((g) => g.parent.id)))
    } else {
      // Expand all
      setCollapsedParentIds(new Set())
    }
  }

  // Toggle column header sorting
  const handleSortAccuracy = () => {
    if (sortBy === 'accuracy_asc') {
      setSortBy('accuracy_desc')
    } else {
      setSortBy('accuracy_asc')
    }
  }

  const handleSortStudied = () => {
    if (sortBy === 'studied_desc') {
      setSortBy('studied_asc')
    } else {
      setSortBy('studied_desc')
    }
  }

  const handleSortSyllabus = () => {
    if (sortBy === 'code_asc') {
      setSortBy('code_desc')
    } else {
      setSortBy('code_asc')
    }
  }

  const currentSortLabel = useMemo(() => {
    return SORT_OPTIONS.find((o) => o.key === sortBy)?.label || 'Sort Topics'
  }, [sortBy])

  return (
    <div className="bg-surface p-3.5 sm:p-4 rounded-xl border border-border-base shadow-xl flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border-base/50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent shadow-[0_0_10px_rgba(0,255,65,0.12)]">
            <Target size={16} />
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="font-['Orbitron'] font-bold text-base text-text-primary tracking-wide">
              Topic Accuracy &amp; Mastery
            </h2>
            <span className="hidden md:inline text-[11px] font-['Rajdhani'] uppercase tracking-wider text-text-muted">
              PRC TOS Breakdown
            </span>
          </div>
        </div>

        {/* Scope Toggle: Gauntlet Arena Only vs All Study Modes */}
        <div className="flex items-center bg-surface-2 p-0.5 rounded-lg border border-border-base shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setScope('gauntlet')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-['Rajdhani'] uppercase font-bold tracking-wider transition-all cursor-pointer ${
              scope === 'gauntlet'
                ? 'bg-accent/20 text-accent border border-accent/40 shadow-sm'
                : 'text-text-muted hover:text-text-primary border border-transparent'
            }`}
          >
            <Flame size={12} className={scope === 'gauntlet' ? 'text-accent' : 'text-text-muted'} />
            <span>Arena</span>
          </button>
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-['Rajdhani'] uppercase font-bold tracking-wider transition-all cursor-pointer ${
              scope === 'all'
                ? 'bg-accent/20 text-accent border border-accent/40 shadow-sm'
                : 'text-text-muted hover:text-text-primary border border-transparent'
            }`}
          >
            <Layers size={12} className={scope === 'all' ? 'text-accent' : 'text-text-muted'} />
            <span>All Modes</span>
          </button>
        </div>
      </div>

      {/* Compact KPI Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="px-3 py-1.5 bg-surface-2/60 border border-border-base/70 rounded-lg flex items-center justify-between">
          <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
            Competencies
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-['Orbitron'] text-sm font-bold text-text-primary">
              {summary.totalSubtopics}
            </span>
            <span className="text-[10px] font-['Rajdhani'] text-text-muted">
              ({summary.attemptedCount} tested)
            </span>
          </div>
        </div>

        <div className="px-3 py-1.5 bg-surface-2/60 border border-border-base/70 rounded-lg flex items-center justify-between">
          <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
            Avg Accuracy
          </span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`font-['Orbitron'] text-sm font-bold ${
                summary.avgAccuracy === null
                  ? 'text-text-muted'
                  : summary.avgAccuracy < 70
                  ? 'text-amber-400'
                  : 'text-accent'
              }`}
            >
              {summary.avgAccuracy !== null ? `${summary.avgAccuracy}%` : '—'}
            </span>
            <span className="text-[10px] font-['Rajdhani'] text-text-muted">
              {summary.totalAnswers} att
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setWeakOnly(!weakOnly)}
          className={`px-3 py-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
            weakOnly
              ? 'bg-amber-500/15 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
              : 'bg-surface-2/60 border-border-base/70 hover:border-amber-500/40'
          }`}
          title={weakOnly ? 'Show all topics' : 'Filter weak topics (<70%, ≥3 att)'}
        >
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={11} className="text-amber-400 shrink-0" />
            <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-amber-400">
              Weak (&lt;70%)
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-['Orbitron'] text-sm font-bold text-amber-400">
              {summary.weakCount}
            </span>
            <span className="text-[9px] font-['Rajdhani'] uppercase tracking-wider text-text-muted">
              {weakOnly ? 'Active' : 'Filter'}
            </span>
          </div>
        </button>

        <div className="px-3 py-1.5 bg-surface-2/60 border border-border-base/70 rounded-lg flex items-center justify-between">
          <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
            Card Penetration
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-['Orbitron'] text-sm font-bold text-accent">
              {summary.studyPenetration}%
            </span>
            <span className="text-[10px] font-['Rajdhani'] text-text-muted">
              {summary.totalStudiedCards}/{summary.totalLibraryCards}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        {/* Subject Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 lg:pb-0">
          {(['ALL', 'MATH', 'GEAS', 'ELECS', 'EST'] as SubjectTab[]).map((tab) => {
            const isSelected = subject === tab
            const count =
              tab === 'ALL'
                ? parentGroups.reduce((acc, p) => acc + p.subtopics.length, 0)
                : parentGroups
                    .filter((p) => p.subject === tab)
                    .reduce((acc, p) => acc + p.subtopics.length, 0)

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSubject(tab)}
                className={`px-2.5 py-1 rounded-md text-xs font-['Rajdhani'] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-accent/20 text-accent border border-accent/40 shadow-sm'
                    : 'bg-surface-2/60 text-text-muted hover:text-text-primary border border-border-base/60'
                }`}
              >
                {tab !== 'ALL' && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: GAUNTLET_SUBJECT_COLORS[tab as GauntletSubjectCode] }}
                  />
                )}
                <span>{tab}</span>
                <span className="font-['JetBrains_Mono'] text-[10px] opacity-70">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Right Controls: Search, Expand All, Custom Sort Menu, Refresh */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-56 min-w-[180px]">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topic or code..."
              className="w-full pl-7 pr-2.5 py-1 bg-surface-2/80 border border-border-base rounded-md text-xs text-text-primary placeholder:text-text-muted/60 font-['Rajdhani'] focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Expand/Collapse All Button */}
          <button
            type="button"
            onClick={toggleExpandAll}
            className="px-2 py-1 bg-surface-2 hover:bg-surface-2/80 border border-border-base rounded-md text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            title={areAllExpanded ? 'Collapse all parent topics' : 'Expand all parent topics'}
          >
            <ChevronsUpDown size={12} className="text-accent" />
            <span>{areAllExpanded ? 'Collapse' : 'Expand'}</span>
          </button>

          {/* Custom Dark Sort Dropdown Menu */}
          <div className="relative shrink-0" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-2 hover:bg-surface-2/80 border border-border-base hover:border-accent/40 rounded-md text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-text-primary transition-all cursor-pointer shadow-sm"
            >
              <SlidersHorizontal size={11} className="text-accent" />
              <span className="truncate max-w-[140px]">{currentSortLabel}</span>
              <ChevronDown
                size={12}
                className={`text-text-muted transition-transform duration-200 ${
                  isSortDropdownOpen ? 'rotate-180 text-accent' : ''
                }`}
              />
            </button>

            {isSortDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 p-1.5 bg-[#141414] border border-border-base rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
                <div className="px-2 py-1 border-b border-border-base/50 mb-1">
                  <span className="font-['Rajdhani'] text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Order Competencies By
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {SORT_OPTIONS.map((opt) => {
                    const isCurrent = sortBy === opt.key
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.key)
                          setIsSortDropdownOpen(false)
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-left transition-colors flex items-center justify-between cursor-pointer group ${
                          isCurrent
                            ? 'bg-accent/15 text-accent border border-accent/30 font-bold'
                            : 'text-text-muted hover:text-text-primary hover:bg-surface-2/60 border border-transparent'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-['Rajdhani'] text-xs tracking-wide">
                            {opt.label}
                          </span>
                          <span className="text-[10px] text-text-muted/60 font-['JetBrains_Mono']">
                            {opt.description}
                          </span>
                        </div>
                        {isCurrent && <Check size={14} className="text-accent shrink-0 ml-2" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => void loadStats()}
            title="Refresh statistics"
            className="p-1 rounded-md bg-surface-2 text-text-muted hover:text-text-primary border border-border-base hover:border-accent/40 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-accent' : ''} />
          </button>
        </div>
      </div>

      {/* Interactive Column Sort Headers */}
      <div className="hidden sm:flex items-center justify-between px-3.5 py-1.5 bg-surface-2/40 border border-border-base/60 rounded-lg text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
        <button
          type="button"
          onClick={handleSortSyllabus}
          className="flex items-center gap-1.5 hover:text-text-primary transition-colors cursor-pointer group"
        >
          <span>PRC Syllabus Topic &amp; Subtopics</span>
          {sortBy === 'code_asc' ? (
            <ArrowUp size={12} className="text-accent" />
          ) : sortBy === 'code_desc' ? (
            <ArrowDown size={12} className="text-accent" />
          ) : (
            <ChevronsUpDown size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" />
          )}
        </button>

        <div className="flex items-center gap-8 pr-3">
          <button
            type="button"
            onClick={handleSortAccuracy}
            className="flex items-center gap-1.5 w-36 justify-between hover:text-text-primary transition-colors cursor-pointer group"
          >
            <span>Accuracy</span>
            {sortBy === 'accuracy_asc' ? (
              <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                Low <ArrowUp size={12} />
              </span>
            ) : sortBy === 'accuracy_desc' ? (
              <span className="flex items-center gap-0.5 text-accent font-bold">
                High <ArrowDown size={12} />
              </span>
            ) : (
              <ChevronsUpDown size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" />
            )}
          </button>

          <button
            type="button"
            onClick={handleSortStudied}
            className="flex items-center gap-1.5 w-32 justify-between hover:text-text-primary transition-colors cursor-pointer group"
          >
            <span>Studied</span>
            {sortBy === 'studied_desc' ? (
              <span className="flex items-center gap-0.5 text-accent font-bold">
                High <ArrowDown size={12} />
              </span>
            ) : sortBy === 'studied_asc' ? (
              <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                Low <ArrowUp size={12} />
              </span>
            ) : (
              <ChevronsUpDown size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </div>
      </div>

      {/* Main Hierarchical Topics List */}
      <div className="flex flex-col gap-3 min-h-[350px]">
        {loading && stats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw size={26} className="animate-spin text-accent" />
            <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-widest animate-pulse">
              Structuring Syllabus Competency Mastery…
            </span>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-center flex flex-col items-center gap-2">
            <AlertTriangle className="text-red-400" size={24} />
            <p className="font-['Rajdhani'] text-sm text-red-400 font-bold">{error}</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="py-16 px-4 text-center border border-dashed border-border-base rounded-xl bg-surface-2/30 flex flex-col items-center gap-2">
            <CheckCircle2 size={32} className="text-accent/60 mb-1" />
            <p className="font-['Orbitron'] text-sm font-bold text-text-primary uppercase tracking-wide">
              No Competencies Match
            </p>
            <p className="font-['Rajdhani'] text-xs text-text-muted max-w-md">
              {weakOnly
                ? 'No weak subtopics (<70% accuracy with ≥3 attempts) found under the selected filter!'
                : search
                ? `No topics found matching "${search}".`
                : 'No topic statistics available.'}
            </p>
            {weakOnly && (
              <button
                type="button"
                onClick={() => setWeakOnly(false)}
                className="mt-2 px-3 py-1.5 bg-accent/20 border border-accent/40 text-accent font-['Rajdhani'] text-xs font-bold uppercase rounded-lg hover:bg-accent/30 transition-all cursor-pointer"
              >
                Show All Competencies
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1.5 show-scrollbar">
            {filteredGroups.map((group) => {
              const isExpanded = !collapsedParentIds.has(group.parent.id)
              const parentBadgeStyle = getAccuracyBadgeStyle(group.accuracy, group.totalAnswers)
              const subjColor = GAUNTLET_SUBJECT_COLORS[group.subject] || '#00FF41'
              const parentAccDisplay =
                group.accuracy !== null && group.totalAnswers > 0
                  ? `${Math.round(group.accuracy * 100)}%`
                  : '—'

              return (
                <div
                  key={group.parent.id}
                  className="w-full shrink-0 bg-surface-2/40 border border-border-base rounded-xl overflow-hidden transition-all shadow-sm"
                >
                  {/* Parent Topic Header Card (1.0) */}
                  <div
                    onClick={() => toggleParentExpand(group.parent.id)}
                    className={`p-3.5 min-h-[52px] bg-surface-2/70 hover:bg-surface-2/90 ${
                      isExpanded ? 'border-b border-border-base/50' : ''
                    } transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left cursor-pointer select-none`}
                  >
                    {/* Left: Chevron + Subject + Code + Title + Subtopic Count */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="p-1 rounded-md bg-surface text-text-muted hover:text-accent transition-colors shrink-0">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>

                      <span
                        className="font-['Orbitron'] text-[10px] font-black px-1.5 py-0.5 rounded text-black shrink-0 tracking-wider"
                        style={{ backgroundColor: subjColor }}
                      >
                        {group.subject}
                      </span>

                      <div className="flex items-baseline gap-2 min-w-0 truncate">
                        <span className="font-['Orbitron'] text-sm font-bold text-text-primary tracking-wide">
                          {group.parent.code}
                        </span>
                        <h3
                          className="font-['Rajdhani'] font-bold text-sm text-text-primary tracking-wide truncate"
                          title={group.parent.title}
                        >
                          {group.parent.title}
                        </h3>
                      </div>

                      <span className="hidden md:inline-flex text-[10px] font-['JetBrains_Mono'] text-text-muted bg-surface/60 px-2 py-0.5 rounded border border-border-base/40 shrink-0">
                        {group.subtopics.length} Subtopics · {group.totalCards} cards
                      </span>
                    </div>

                    {/* Right: Parent Overall Accuracy & Studied Progress */}
                    <div className="flex items-center gap-6 sm:gap-8 shrink-0 pl-7 sm:pl-0">
                      {/* Overall Accuracy */}
                      <div className="flex flex-col w-32 sm:w-36">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                            Overall Acc
                          </span>
                          <span className={`font-['Orbitron'] text-xs font-bold ${parentBadgeStyle.text}`}>
                            {parentAccDisplay}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-border-base/40">
                          {group.accuracy !== null && group.totalAnswers > 0 ? (
                            <div
                              className={`h-full ${parentBadgeStyle.barColor} transition-all duration-500 rounded-full`}
                              style={{ width: `${Math.min(100, Math.max(3, group.accuracy * 100))}%` }}
                            />
                          ) : (
                            <div className="h-full bg-border-base/40 w-0" />
                          )}
                        </div>
                        <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted/80 mt-1 truncate">
                          {group.totalAnswers > 0
                            ? `${group.correctAnswers}✓ · ${group.wrongAnswers}✗ (${group.totalAnswers} att)`
                            : '0 attempts'}
                        </span>
                      </div>

                      {/* Overall Studied */}
                      <div className="flex flex-col w-28 sm:w-32">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                            Coverage
                          </span>
                          <span className="font-['Orbitron'] text-xs font-bold text-text-primary">
                            {group.studyProgress}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-border-base/40">
                          <div
                            className="h-full bg-accent/70 transition-all duration-500 rounded-full"
                            style={{ width: `${Math.min(100, group.studyProgress)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted/80 mt-1 truncate">
                          {group.studiedCards} / {group.totalCards} cards
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Subtopics List (1.1, 1.2, 1.3...) */}
                  {isExpanded && (
                    <div className="divide-y divide-border-base/30 bg-[#121212]/60">
                      {group.subtopics.map((sub) => {
                        const subBadgeStyle = getAccuracyBadgeStyle(sub.accuracy, sub.totalAnswers)
                        const subAccDisplay =
                          sub.accuracy !== null && sub.totalAnswers > 0
                            ? `${Math.round(sub.accuracy * 100)}%`
                            : '—'

                        return (
                          <div
                            key={sub.id}
                            className="p-3 sm:pl-10 sm:pr-4 hover:bg-surface-2/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left group"
                          >
                            {/* Decimal Topic Code & Title */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-['JetBrains_Mono'] text-xs font-bold text-accent shrink-0">
                                  {sub.code}
                                </span>

                                <span
                                  className={`text-[9px] font-['Rajdhani'] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${subBadgeStyle.bg} ${subBadgeStyle.border} ${subBadgeStyle.text}`}
                                >
                                  {subBadgeStyle.label}
                                </span>

                                {subBadgeStyle.isWeak && (
                                  <span className="flex items-center gap-1 text-[9px] font-['Rajdhani'] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                                    <AlertTriangle size={10} />
                                    Weak Spot
                                  </span>
                                )}

                                {sub.totalAnswers > 0 && sub.totalAnswers < 3 && (
                                  <span
                                    className="flex items-center gap-1 text-[9px] font-['Rajdhani'] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0"
                                    title="Under 3 attempts. Baseline calibration in progress."
                                  >
                                    <Info size={10} />
                                    Low Sample
                                  </span>
                                )}
                              </div>

                              <h4
                                className="font-['Rajdhani'] font-semibold text-xs sm:text-sm text-text-primary tracking-wide truncate group-hover:text-accent transition-colors"
                                title={sub.title}
                              >
                                {sub.title}
                              </h4>
                            </div>

                            {/* Subtopic Accuracy Bar & Numerical Stats */}
                            <div className="flex items-center gap-6 sm:gap-8 shrink-0 pl-5 sm:pl-0">
                              {/* Subtopic Accuracy */}
                              <div className="flex flex-col w-32 sm:w-36">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                                    Accuracy
                                  </span>
                                  <span className={`font-['Orbitron'] text-xs font-bold ${subBadgeStyle.text}`}>
                                    {subAccDisplay}
                                  </span>
                                </div>

                                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-border-base/40">
                                  {sub.accuracy !== null && sub.totalAnswers > 0 ? (
                                    <div
                                      className={`h-full ${subBadgeStyle.barColor} transition-all duration-500 rounded-full`}
                                      style={{
                                        width: `${Math.min(100, Math.max(3, sub.accuracy * 100))}%`,
                                      }}
                                    />
                                  ) : (
                                    <div className="h-full bg-border-base/40 w-0" />
                                  )}
                                </div>

                                <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted/80 mt-1 truncate">
                                  {sub.totalAnswers > 0
                                    ? `${sub.correctAnswers}✓ · ${sub.wrongAnswers}✗ (${sub.totalAnswers} att)`
                                    : '0 attempts'}
                                </span>
                              </div>

                              {/* Subtopic Studied Progress */}
                              <div className="flex flex-col w-28 sm:w-32">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                                    Studied
                                  </span>
                                  <span className="font-['Orbitron'] text-xs font-bold text-text-primary">
                                    {sub.studyProgress}%
                                  </span>
                                </div>

                                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-border-base/40">
                                  <div
                                    className="h-full bg-accent/70 transition-all duration-500 rounded-full"
                                    style={{ width: `${Math.min(100, sub.studyProgress)}%` }}
                                  />
                                </div>

                                <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted/80 mt-1 truncate">
                                  {sub.studiedCards} / {sub.totalCards} cards
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
