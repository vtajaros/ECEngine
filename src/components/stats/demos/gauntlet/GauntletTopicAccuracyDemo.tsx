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
  SlidersHorizontal,
  Info,
  Check,
  Play,
} from 'lucide-react'
import { gauntletService, type TosTopicPerformanceStat, type GauntletSubjectCode } from '../../../../services/gauntlet.service'
import { dbService } from '../../../../services/db.service'
import type { Card } from '../../../../types'
import { LearnMode } from '../../../mcq/LearnMode'
import { LearnSettingsModal, type LearnSettings, loadTTSPreference } from '../../../mcq/LearnSettingsModal'
import { Tooltip } from '../../../ui/Tooltip'
import { TOS_SUBJECT_COLORS } from '../../../../lib/tosData'
import { getTosTopicGroupsBySubject, type TosTopicGroup, type FlatTosTopic } from '../../../../lib/tosClassification'

type SubjectTab = GauntletSubjectCode
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

const SUBJECT_TABS: SubjectTab[] = ['MATH', 'GEAS', 'ELECS', 'EST']

const SUBJECT_FULL_NAMES: Record<string, string> = {
  MATH: 'Mathematics',
  GEAS: 'General Engineering & Applied Sciences',
  ELECS: 'Electronics Engineering',
  EST: 'Electronic Systems & Technologies',
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

export interface ActiveDrillSession {
  cards: Card[]
  title: string
  subject: GauntletSubjectCode
  ttsEnabled?: boolean
  shuffleChoices?: boolean
}

export interface GauntletTopicAccuracyDemoProps {
  onStartSession?: (session: ActiveDrillSession) => void
}

export function GauntletTopicAccuracyDemo({ onStartSession }: GauntletTopicAccuracyDemoProps = {}) {
  const [subject, setSubject] = useState<SubjectTab>('MATH')
  const [scope, setScope] = useState<'gauntlet' | 'all'>('gauntlet')
  const [sortBy, setSortBy] = useState<SortKey>('code_asc')
  const [search, setSearch] = useState('')
  const [weakOnly, setWeakOnly] = useState(false)
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [stats, setStats] = useState<TosTopicPerformanceStat[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Custom sort menu dropdown state
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const sortDropdownRef = useRef<HTMLDivElement>(null)

  // Topic Drill / Learn Session State
  const [drillTarget, setDrillTarget] = useState<{
    id: string
    title: string
    totalCards: number
    subject: GauntletSubjectCode
  } | null>(null)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [learnSettings, setLearnSettings] = useState<LearnSettings>({
    type: 'MCQ',
    shuffleQuestions: false,
    shuffleChoices: false,
    bookmarkedOnly: false,
    itemCount: 'All',
    randomSample: false,
    ttsEnabled: loadTTSPreference(),
  })
  const [isStartingDrill, setIsStartingDrill] = useState(false)
  const [activeSession, setActiveSession] = useState<{
    cards: Card[]
    title: string
    subject: GauntletSubjectCode
  } | null>(null)

  const handleOpenDrillModal = useCallback((target: {
    id: string
    title: string
    totalCards: number
    subject: GauntletSubjectCode
  }) => {
    if (target.totalCards <= 0) return
    setDrillTarget(target)
    setLearnSettings(prev => ({
      ...prev,
      itemCount: 'All',
    }))
    setIsSettingsModalOpen(true)
  }, [])

  const handleStartDrill = useCallback(async () => {
    if (!drillTarget) return
    setIsStartingDrill(true)
    setIsSettingsModalOpen(false)
    try {
      const maxCount = typeof learnSettings.itemCount === 'number' ? learnSettings.itemCount : drillTarget.totalCards
      const rawCards = await gauntletService.getQuestions(
        [{ subject: drillTarget.subject, count: Math.min(maxCount, 5000) }],
        [],
        scope === 'all',
        drillTarget.id
      )

      if (!rawCards || rawCards.length === 0) {
        setError(`No questions available for ${drillTarget.title} with current filters`)
        return
      }

      let finalCards = rawCards as Card[]
      if (learnSettings.shuffleQuestions) {
        finalCards = [...finalCards].sort(() => Math.random() - 0.5)
      }

      const sessionData: ActiveDrillSession = {
        cards: finalCards,
        title: drillTarget.title,
        subject: drillTarget.subject,
        ttsEnabled: learnSettings.ttsEnabled,
        shuffleChoices: learnSettings.shuffleChoices,
      }

      if (onStartSession) {
        onStartSession(sessionData)
      } else {
        setActiveSession(sessionData)
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to start topic drill')
    } finally {
      setIsStartingDrill(false)
    }
  }, [drillTarget, learnSettings, scope, onStartSession])

  // Subtopic count per subject for tab counters
  const subjectCounts = useMemo(() => {
    const counts: Record<GauntletSubjectCode, number> = {
      MATH: 0,
      GEAS: 0,
      ELECS: 0,
      EST: 0,
    }
    for (const s of SUBJECT_TABS) {
      counts[s] = getTosTopicGroupsBySubject(s).reduce((acc, p) => acc + p.subtopics.length, 0)
    }
    return counts
  }, [])

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
        subject,
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
    const rawGroups: TosTopicGroup[] = getTosTopicGroupsBySubject(subject)

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

  // Subtopic sort helper based on active sortBy
  const sortSubtopics = useCallback(
    (subs: SubtopicStatItem[]): SubtopicStatItem[] => {
      return [...subs].sort((a, b) => {
        switch (sortBy) {
          case 'code_asc': {
            const numA = parseFloat(a.code) || 0
            const numB = parseFloat(b.code) || 0
            return numA - numB
          }
          case 'code_desc': {
            const numA = parseFloat(a.code) || 0
            const numB = parseFloat(b.code) || 0
            return numB - numA
          }
          case 'accuracy_asc': {
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
    },
    [sortBy]
  )

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
          subtopics: sortSubtopics(matchingSubs),
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
  }, [parentGroups, search, weakOnly, sortBy, sortSubtopics])

  // Active selected parent group in detail pane
  const activeGroup = useMemo(() => {
    if (filteredGroups.length === 0) return null
    if (selectedParentId) {
      const found = filteredGroups.find((g) => g.parent.id === selectedParentId)
      if (found) return found
    }
    return filteredGroups[0]
  }, [filteredGroups, selectedParentId])

  // Sync selected topic on subject change
  const handleSubjectChange = (newSubject: SubjectTab) => {
    setSubject(newSubject)
    setSelectedParentId(null)
  }

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

  const currentSortLabel = useMemo(() => {
    return SORT_OPTIONS.find((o) => o.key === sortBy)?.label || 'Sort Topics'
  }, [sortBy])

  if (activeSession) {
    return (
      <div className="w-full h-full flex flex-col overflow-y-auto">
        <LearnMode
          cards={activeSession.cards}
          title={activeSession.title}
          subject={activeSession.subject}
          ttsEnabled={learnSettings.ttsEnabled}
          shuffleChoices={learnSettings.shuffleChoices}
          onComplete={(sessionStats) => {
            const total = activeSession.cards.length || (sessionStats.correct + sessionStats.wrong)
            dbService.saveExamSession({
              topicId: null,
              mode: 'learn',
              score: sessionStats.correct,
              total,
              answers: JSON.stringify({
                deckTitle: activeSession.title,
                deckDescription: `Topic Drill: ${activeSession.title}`,
                subject: activeSession.subject,
                correctFirstTry: sessionStats.correct,
                wrongFirstTry: sessionStats.wrong,
                bookmarkedCount: sessionStats.bookmarked,
              }),
            }).catch(err => {
              console.warn('Failed to save topic drill exam session:', err)
            })
          }}
          onExit={() => {
            setActiveSession(null)
            void loadStats()
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="bg-surface p-4 lg:p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3.5 w-full max-w-7xl mx-auto"
      data-testid="gauntlet-topic-accuracy-demo"
    >
      {/* Header & Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border-base/50 pb-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <Target className="text-accent shrink-0" size={18} />
          <div>
            <h2 className="font-['Orbitron'] text-sm sm:text-base font-bold text-text-primary tracking-wide uppercase">
              Topic Accuracy &amp; Mastery
            </h2>
            <p className="text-[11px] font-['Rajdhani'] uppercase tracking-wider text-text-muted font-semibold">
              PRC Table of Specifications Performance &amp; Mastery Matrix
            </p>
          </div>
        </div>

        {/* Header Controls: Scope Switcher (Arena vs All Modes) & Weak Spot Status Chip */}
        <div className="flex items-center gap-2 self-start lg:self-auto flex-nowrap overflow-x-auto max-w-full py-0.5 scrollbar-none">
          {/* Sub-tab switcher: Arena vs All Modes */}
          <div className="flex items-center p-0.5 sm:p-1 bg-[#0c0c0c] rounded-lg border border-border-base shrink-0">
            <button
              type="button"
              onClick={() => setScope('gauntlet')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-['Rajdhani'] uppercase tracking-wider font-bold transition-all whitespace-nowrap cursor-pointer ${
                scope === 'gauntlet'
                  ? 'bg-accent/15 text-accent border border-accent/40 shadow-[0_0_10px_rgba(0,255,65,0.2)]'
                  : 'text-text-muted hover:text-text-primary border border-transparent'
              }`}
            >
              <Flame size={13} className={scope === 'gauntlet' ? 'text-accent' : 'text-text-muted'} />
              <span>Arena</span>
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-['Rajdhani'] uppercase tracking-wider font-bold transition-all whitespace-nowrap cursor-pointer ${
                scope === 'all'
                  ? 'bg-accent/15 text-accent border border-accent/40 shadow-[0_0_10px_rgba(0,255,65,0.2)]'
                  : 'text-text-muted hover:text-text-primary border border-transparent'
              }`}
            >
              <Layers size={13} className={scope === 'all' ? 'text-accent' : 'text-text-muted'} />
              <span>All Modes</span>
            </button>
          </div>

          {/* Weak Spot Status Chip */}
          {summary.weakCount > 0 ? (
            <button
              type="button"
              onClick={() => setWeakOnly(!weakOnly)}
              className={`px-2.5 py-1 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs font-['JetBrains_Mono'] font-bold flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                weakOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}
              title={weakOnly ? 'Showing weak topics only (Click to show all)' : 'Filter weak topics (<70%, ≥3 att)'}
            >
              <AlertTriangle size={12} />
              <span>{summary.weakCount} Weak Spots</span>
              {weakOnly && <span className="text-[10px] uppercase font-['Rajdhani'] opacity-80">(Filtering)</span>}
            </button>
          ) : (
            <span className="px-2.5 py-1 sm:py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[11px] sm:text-xs font-['JetBrains_Mono'] font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <CheckCircle2 size={12} />
              <span>100% Solid</span>
            </span>
          )}
        </div>
      </div>

      {/* Sleek Single-Line Summary Ribbon */}
      <div className="bg-[#0b0b0b] border border-border-base/70 rounded-lg px-3.5 py-2 flex items-center justify-between flex-wrap gap-2 text-xs font-['JetBrains_Mono']">
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Competencies */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[10px] font-['Rajdhani'] uppercase tracking-wider font-bold">
              Competencies:
            </span>
            <span className="font-bold text-text-primary">
              {summary.totalSubtopics}{' '}
              <span className="text-text-muted font-normal text-[10px]">
                ({summary.attemptedCount} tested)
              </span>
            </span>
          </div>

          <span className="text-[#333] hidden sm:inline">|</span>

          {/* Avg Accuracy */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[10px] font-['Rajdhani'] uppercase tracking-wider font-bold">
              Avg Accuracy:
            </span>
            <span
              className={`font-bold ${
                summary.avgAccuracy === null
                  ? 'text-text-muted'
                  : summary.avgAccuracy < 70
                  ? 'text-amber-400'
                  : 'text-accent'
              }`}
            >
              {summary.avgAccuracy !== null ? `${summary.avgAccuracy}%` : '—'}{' '}
              <span className="text-text-muted font-normal text-[10px]">
                ({summary.totalAnswers.toLocaleString()} att)
              </span>
            </span>
          </div>

          <span className="text-[#333] hidden sm:inline">|</span>

          {/* Weak Topics Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[10px] font-['Rajdhani'] uppercase tracking-wider font-bold">
              Weak (&lt;70%):
            </span>
            {summary.weakCount > 0 ? (
              <button
                type="button"
                onClick={() => setWeakOnly(!weakOnly)}
                className={`font-bold underline transition-colors cursor-pointer ${
                  weakOnly ? 'text-amber-300' : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                {summary.weakCount} topics {weakOnly ? '(filtered)' : ''}
              </button>
            ) : (
              <span className="text-emerald-400 font-bold">0 topics</span>
            )}
          </div>
        </div>

        {/* Card Penetration */}
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-[10px] font-['Rajdhani'] uppercase tracking-wider font-bold">
            Card Penetration:
          </span>
          <span className="font-bold text-accent">
            {summary.studyPenetration}%
          </span>
          <span className="text-text-muted text-[10px] font-normal">
            ({summary.totalStudiedCards.toLocaleString()}/{summary.totalLibraryCards.toLocaleString()})
          </span>
        </div>
      </div>

      {/* Control Bar: LooksFam Subject Pillboxes & Search / Sort Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* LooksFam Subject Filter Pillboxes */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {SUBJECT_TABS.map((s) => {
            const isActive = subject === s
            const colors = TOS_SUBJECT_COLORS[s]
            const count = subjectCounts[s]

            return (
              <button
                key={s}
                type="button"
                onClick={() => handleSubjectChange(s)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border transition-all font-['Rajdhani'] font-bold text-xs uppercase tracking-wider shrink-0 cursor-pointer"
                style={
                  isActive
                    ? {
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
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Topic Search Input, Sort Menu & Refresh Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <div className="relative w-full sm:w-56 lg:w-64 shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search topic or code (e.g. 1.1, Calculus)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0c0c0c] border border-border-base focus:border-[var(--accent-primary)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary font-['JetBrains_Mono'] outline-none transition-colors"
            />
          </div>

          {/* Custom Sort Menu Dropdown */}
          <div className="relative shrink-0" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0c0c0c] hover:bg-[#141414] border border-border-base hover:border-accent/40 rounded-lg text-xs font-['Rajdhani'] font-bold uppercase tracking-wider text-text-primary transition-all cursor-pointer shadow-sm"
            >
              <SlidersHorizontal size={11} className="text-accent" />
              <span className="truncate max-w-[120px]">{currentSortLabel}</span>
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
            className="p-1.5 rounded-lg bg-[#0c0c0c] hover:bg-[#161616] text-text-muted hover:text-text-primary border border-border-base hover:border-accent/40 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-accent' : ''} />
          </button>
        </div>
      </div>

      {/* Master-Detail Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 rounded-xl border border-border-base bg-[#0A0A0A] overflow-hidden h-[580px] lg:h-[640px]">
        {/* Left Column: Master Topics List */}
        <div className="md:col-span-5 lg:col-span-4 border-b md:border-b-0 md:border-r border-border-base flex flex-col h-[280px] md:h-full min-h-0 bg-[#080808]">
          <div className="shrink-0 px-3.5 py-2.5 bg-[#111] border-b border-border-base flex items-center justify-between text-xs font-['Rajdhani'] uppercase tracking-wider font-bold">
            <span className="text-text-muted">PRC Topics</span>
            <span className="text-text-muted font-['JetBrains_Mono'] text-[11px]">
              {filteredGroups.length} {filteredGroups.length === 1 ? 'Topic' : 'Topics'}
            </span>
          </div>

          <div className="overflow-y-auto show-scrollbar flex-1 min-h-0 divide-y divide-border-base/30 pb-4">
            {loading && stats.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin text-accent" />
                <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-wider">
                  Loading topics…
                </span>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="p-6 text-center text-text-muted font-['JetBrains_Mono'] text-xs">
                No topics match your filter.
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isSelected = group.parent.id === activeGroup?.parent.id
                const color = TOS_SUBJECT_COLORS[group.subject]?.accent || '#00FF41'
                const groupBadgeStyle = getAccuracyBadgeStyle(group.accuracy, group.totalAnswers)
                const hasWeakSubs = group.subtopics.some(
                  (s) => s.accuracy !== null && s.accuracy < 0.7 && s.totalAnswers >= 3
                )

                return (
                  <div
                    key={group.parent.id}
                    onClick={() => setSelectedParentId(group.parent.id)}
                    className={`p-3 transition-colors cursor-pointer flex items-center justify-between gap-3 border-l-2 ${
                      isSelected
                        ? 'bg-surface-2/90 text-text-primary'
                        : 'bg-transparent hover:bg-surface-2/30 text-text-muted border-l-transparent'
                    }`}
                    style={{
                      borderLeftColor: isSelected ? color : 'transparent',
                    }}
                  >

                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="px-1.5 py-0.2 rounded text-[9px] font-['Rajdhani'] font-bold uppercase tracking-wider shrink-0"
                        style={{
                          color: color,
                          backgroundColor: `${color}15`,
                          border: `1px solid ${color}35`,
                        }}
                      >
                        {group.subject}
                      </span>
                      <span
                        className={`font-['Orbitron'] text-xs font-bold truncate ${
                          isSelected ? 'text-text-primary' : 'text-text-muted'
                        }`}
                        title={group.parent.name}
                      >
                        {group.parent.name}
                      </span>
                    </div>

                    {/* Right: Accuracy & Attempt pill */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasWeakSubs && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                          title="Contains certified weak competencies"
                        />
                      )}
                      {group.accuracy !== null && group.totalAnswers > 0 ? (
                        <div
                          className={`px-2 py-0.5 rounded text-[11px] font-['JetBrains_Mono'] font-bold border ${groupBadgeStyle.bg} ${groupBadgeStyle.border} ${groupBadgeStyle.text}`}
                        >
                          {Math.round(group.accuracy * 100)}%
                          <span className="text-[9px] opacity-75 font-normal ml-1">
                            ({group.totalAnswers} att)
                          </span>
                        </div>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] text-[#555] bg-[#141414] border border-[#222]">
                          Untested
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Detail Pane for Selected Topic */}
        <div className="md:col-span-7 lg:col-span-8 flex flex-col h-[380px] md:h-full min-h-0 bg-[#0C0C0C]">
          {activeGroup ? (
            <>
              {/* Detail Header */}
              <div className="shrink-0 p-3.5 sm:p-4 bg-[#111] border-b border-border-base flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider"
                      style={{
                        color: TOS_SUBJECT_COLORS[activeGroup.subject]?.accent || '#00FF41',
                        backgroundColor: `${TOS_SUBJECT_COLORS[activeGroup.subject]?.accent || '#00FF41'}15`,
                        border: `1px solid ${TOS_SUBJECT_COLORS[activeGroup.subject]?.accent || '#00FF41'}30`,
                      }}
                    >
                      {activeGroup.subject} • {SUBJECT_FULL_NAMES[activeGroup.subject] || activeGroup.subject}
                    </span>
                    <span className="font-['JetBrains_Mono'] text-xs text-accent font-bold">
                      • {activeGroup.totalCards.toLocaleString()} cards
                    </span>
                    <span className="font-['JetBrains_Mono'] text-xs text-text-muted">
                      • {activeGroup.subtopics.length} {activeGroup.subtopics.length === 1 ? 'subtopic' : 'subtopics'}
                    </span>
                  </div>
                  <h3 className="font-['Orbitron'] text-sm sm:text-base font-bold text-text-primary tracking-wide">
                    {activeGroup.parent.name}
                  </h3>
                </div>

                {/* Parent Overall Accuracy & Studied Progress Meters + Drill Action */}
                <div className="flex items-center gap-4 sm:gap-6 shrink-0 self-start sm:self-center flex-wrap sm:flex-nowrap">
                  {/* Overall Acc */}
                  <div className="flex flex-col w-28 sm:w-32">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                        Overall Acc
                      </span>
                      <span
                        className={`font-['Orbitron'] text-xs font-bold ${
                          getAccuracyBadgeStyle(activeGroup.accuracy, activeGroup.totalAnswers).text
                        }`}
                      >
                        {activeGroup.accuracy !== null && activeGroup.totalAnswers > 0
                          ? `${Math.round(activeGroup.accuracy * 100)}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-[#222]">
                      {activeGroup.accuracy !== null && activeGroup.totalAnswers > 0 ? (
                        <div
                          className={`h-full ${
                            getAccuracyBadgeStyle(activeGroup.accuracy, activeGroup.totalAnswers).barColor
                          } transition-all duration-500 rounded-full`}
                          style={{ width: `${Math.min(100, Math.max(3, activeGroup.accuracy * 100))}%` }}
                        />
                      ) : (
                        <div className="h-full bg-border-base/40 w-0" />
                      )}
                    </div>
                    <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted/80 mt-1 truncate">
                      {activeGroup.totalAnswers > 0
                        ? `${activeGroup.correctAnswers}✓ · ${activeGroup.wrongAnswers}✗ (${activeGroup.totalAnswers} att)`
                        : '0 attempts'}
                    </span>
                  </div>

                  {/* Coverage */}
                  <div className="flex flex-col w-24 sm:w-28">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                        Coverage
                      </span>
                      <span className="font-['Orbitron'] text-xs font-bold text-text-primary">
                        {activeGroup.studyProgress}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-[#222]">
                      <div
                        className="h-full bg-accent/70 transition-all duration-500 rounded-full"
                        style={{ width: `${Math.min(100, activeGroup.studyProgress)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted/80 mt-1 truncate">
                      {activeGroup.studiedCards} / {activeGroup.totalCards} cards
                    </span>
                  </div>

                  {/* Practice Topic Action */}
                  <Tooltip
                    content={activeGroup.totalCards > 0 ? `Practice ${activeGroup.parent.name}` : 'No cards available'}
                    position="top"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenDrillModal({
                          id: activeGroup.parent.id,
                          title: `${activeGroup.parent.code} ${activeGroup.parent.name}`,
                          totalCards: activeGroup.totalCards,
                          subject: activeGroup.subject,
                        })
                      }
                      disabled={activeGroup.totalCards === 0 || isStartingDrill}
                      aria-label={`Practice ${activeGroup.parent.name}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-['Rajdhani'] font-bold uppercase tracking-wider transition-all shadow-sm shrink-0 cursor-pointer ${
                        activeGroup.totalCards > 0
                          ? 'bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 hover:border-accent hover:shadow-[0_0_12px_rgba(0,255,65,0.25)] active:scale-95'
                          : 'bg-surface-2 border border-border-base text-text-muted/40 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <Play size={12} className={activeGroup.totalCards > 0 ? 'fill-accent' : ''} />
                      <span>Practice Topic</span>
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Subtopics List */}
              <div className="overflow-y-auto show-scrollbar flex-1 min-h-0 p-3 sm:p-4 space-y-2 pb-6">
                {activeGroup.subtopics.map((sub) => {
                  const subBadgeStyle = getAccuracyBadgeStyle(sub.accuracy, sub.totalAnswers)
                  const subAccDisplay =
                    sub.accuracy !== null && sub.totalAnswers > 0
                      ? `${Math.round(sub.accuracy * 100)}%`
                      : '—'

                  return (
                    <div
                      key={sub.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 sm:p-3 rounded-lg border bg-[#101010] border-[#222] hover:border-accent/40 hover:bg-[#141414] transition-all gap-2.5 group"
                    >
                      {/* Left: Indicator dot + Code + Badges + Title */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                sub.accuracy === null || sub.totalAnswers === 0
                                  ? '#555'
                                  : sub.accuracy < 0.5 && sub.totalAnswers >= 3
                                  ? '#ef4444'
                                  : sub.accuracy < 0.7 && sub.totalAnswers >= 3
                                  ? '#f59e0b'
                                  : sub.totalAnswers < 3
                                  ? '#3b82f6'
                                  : '#00FF41',
                            }}
                          />
                          <span className="font-['JetBrains_Mono'] text-xs font-bold text-accent shrink-0">
                            {sub.id}
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

                      {/* Right: Accuracy & Studied Progress Meters */}
                      <div className="flex items-center gap-4 sm:gap-6 shrink-0 pl-3.5 sm:pl-0">
                        {/* Accuracy Meter */}
                        <div className="flex flex-col w-28 sm:w-32">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                              Accuracy
                            </span>
                            <span className={`font-['Orbitron'] text-xs font-bold ${subBadgeStyle.text}`}>
                              {subAccDisplay}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-[#222]">
                            {sub.accuracy !== null && sub.totalAnswers > 0 ? (
                              <div
                                className={`h-full ${subBadgeStyle.barColor} transition-all duration-500 rounded-full`}
                                style={{ width: `${Math.min(100, Math.max(3, sub.accuracy * 100))}%` }}
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

                        {/* Studied Meter */}
                        <div className="flex flex-col w-24 sm:w-28">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                              Studied
                            </span>
                            <span className="font-['Orbitron'] text-xs font-bold text-text-primary">
                              {sub.studyProgress}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-[#222]">
                            <div
                              className="h-full bg-accent/70 transition-all duration-500 rounded-full"
                              style={{ width: `${Math.min(100, sub.studyProgress)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted/80 mt-1 truncate">
                            {sub.studiedCards} / {sub.totalCards} cards
                          </span>
                        </div>

                        {/* Subtopic Drill Action */}
                        <div className="shrink-0 flex items-center pl-1 sm:pl-2">
                          <Tooltip
                            content={sub.totalCards > 0 ? `Drill ${sub.id}: ${sub.title} (${sub.totalCards} cards)` : 'No cards available'}
                            position="top"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenDrillModal({
                                  id: sub.id,
                                  title: `${sub.id} ${sub.title}`,
                                  totalCards: sub.totalCards,
                                  subject: sub.subject,
                                })
                              }
                              disabled={sub.totalCards === 0 || isStartingDrill}
                              aria-label={`Drill ${sub.id}`}
                              className={`flex items-center justify-center p-2 rounded transition-all cursor-pointer ${
                                sub.totalCards > 0
                                  ? 'bg-surface-2 border border-[#333] hover:border-accent hover:text-accent hover:bg-accent/10 text-text-muted active:scale-95'
                                  : 'bg-surface-2 border border-border-base text-text-muted/30 cursor-not-allowed'
                              }`}
                            >
                              <Play size={13} className={sub.totalCards > 0 ? 'fill-current' : ''} />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-text-muted font-['JetBrains_Mono'] text-xs gap-2">
              <p>No topic selected or matching current filter.</p>
              {(search || weakOnly) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setWeakOnly(false)
                  }}
                  className="text-accent underline text-xs font-['Rajdhani'] font-bold uppercase tracking-wider cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Learn Settings Modal for Topic Practice */}
      {drillTarget && (
        <LearnSettingsModal
          isOpen={isSettingsModalOpen}
          setId={drillTarget.id}
          settings={learnSettings}
          allSets={[{ id: drillTarget.id, count: drillTarget.totalCards }]}
          onSettingsChange={setLearnSettings}
          onStart={() => void handleStartDrill()}
          onClose={() => {
            setIsSettingsModalOpen(false)
            setDrillTarget(null)
          }}
        />
      )}
    </div>
  )
}

export default GauntletTopicAccuracyDemo
