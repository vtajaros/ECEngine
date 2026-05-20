import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, ChevronUp, RotateCcw, TrendingUp,
  Square, CheckSquare
} from 'lucide-react'
import { TOS_DATA, TOS_SUBJECT_COLORS, TOSSubject, TOSTopic } from '../../lib/tosData'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_REVIEWED = 'tos_checklist_reviewed_v1'
const STORAGE_REFRESHER = 'tos_checklist_refresher_v1'

const EXAM_DAY_LABELS: Record<string, string> = {
  MATH:  'Day 1 · AM Exam Coverage',
  ELECS: 'Day 1 · PM Exam Coverage',
  GEAS:  'Day 2 · AM Exam Coverage',
  EST:   'Day 2 · PM Exam Coverage',
}

/** Stable checklist key: "MATH::1.1 Functions, Continuity, Limits" */
function subtopicKey(subjectCode: string, subtopicName: string): string {
  return `${subjectCode}::${subtopicName}`
}

/** Stable key for a parent topic accordion: "MATH::MATH-1.0" */
function topicAccordionKey(subjectCode: string, topicId: string): string {
  return `${subjectCode}::${topicId}`
}

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadState(key: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const data = JSON.parse(raw)
    return typeof data === 'object' && data !== null
      ? (data as Record<string, boolean>)
      : {}
  } catch {
    return {}
  }
}

function saveState(key: string, state: Record<string, boolean>): void {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

// ─── TopicAccordion ───────────────────────────────────────────────────────────

interface TopicAccordionProps {
  subjectCode: string
  topic: TOSTopic
  colors: (typeof TOS_SUBJECT_COLORS)[string]
  reviewed: Record<string, boolean>
  refresher: Record<string, boolean>
  onToggleReview: (key: string) => void
  onToggleRefresher: (key: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

const TopicAccordion: React.FC<TopicAccordionProps> = ({
  subjectCode, topic, colors, reviewed, refresher,
  onToggleReview, onToggleRefresher, isExpanded, onToggleExpand
}) => {
  return (
    <>
      {/* ── Parent Topic Header Row ─────────────────────────────────────────── */}
      <tr 
        onClick={onToggleExpand}
        className="cursor-pointer bg-white/[0.03] hover:bg-white/[0.07] border-b border-white/10 transition-colors select-none"
      >
        <td colSpan={3} className="px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 shrink-0">
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
            <span className="font-['Rajdhani'] text-lg sm:text-xl font-bold tracking-wide text-gray-200">
              {topic.name}
            </span>
          </div>
        </td>
      </tr>

      {/* ── Subtopic Rows ───────────────────────────────────────────────────── */}
      {isExpanded && topic.subtopics.map((sub) => {
        const key = subtopicKey(subjectCode, sub.name)
        const isReviewed = !!reviewed[key]
        const isRefresher = !!refresher[key]

        return (
          <tr
            key={key}
            className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
          >
            {/* Subtopic Title (Left) */}
            <td className="px-8 py-3.5 sm:py-4 pl-10 sm:pl-12">
              <span 
                className="font-['IBM_Plex_Mono'] text-sm sm:text-base leading-relaxed transition-colors"
                style={{ color: isReviewed ? '#00FF41' : '#a3a3a3' }}
              >
                {sub.name}
              </span>
            </td>

            {/* Review Checkbox (Center) */}
            <td className="px-4 py-3.5 sm:py-4 text-center w-28 sm:w-36">
              <button
                onClick={() => onToggleReview(key)}
                className="inline-flex items-center justify-center p-2 rounded hover:bg-white/5 transition-colors"
                aria-label="Toggle Review status"
              >
                {isReviewed ? (
                  <CheckSquare size={20} className="text-[#00FF41]" />
                ) : (
                  <Square size={20} className="text-gray-600 hover:text-gray-400" />
                )}
              </button>
            </td>

            {/* Refresher Checkbox (Center) */}
            <td className="px-4 py-3.5 sm:py-4 text-center w-28 sm:w-36">
              <button
                onClick={() => onToggleRefresher(key)}
                className="inline-flex items-center justify-center p-2 rounded hover:bg-white/5 transition-colors"
                aria-label="Toggle Refresher status"
              >
                {isRefresher ? (
                  <CheckSquare size={20} className="text-[#00FF41]" />
                ) : (
                  <Square size={20} className="text-gray-600 hover:text-gray-400" />
                )}
              </button>
            </td>
          </tr>
        )
      })}
    </>
  )
}

// ─── SubjectPanel ─────────────────────────────────────────────────────────────

interface SubjectPanelProps {
  subject: TOSSubject
  reviewed: Record<string, boolean>
  refresher: Record<string, boolean>
  onToggleReview: (key: string) => void
  onToggleRefresher: (key: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
  expandedTopics: Record<string, boolean>
  onToggleTopic: (key: string) => void
}

const SubjectPanel: React.FC<SubjectPanelProps> = ({
  subject, reviewed, refresher,
  onToggleReview, onToggleRefresher,
  isExpanded, onToggleExpand,
  expandedTopics, onToggleTopic,
}) => {
  const colors = TOS_SUBJECT_COLORS[subject.code]

  return (
    <div
      className="rounded-xl border overflow-hidden flex flex-col bg-[#080808]"
      style={{
        borderColor: '#222',
        boxShadow: isExpanded ? `0 0 32px rgba(${colors.accentRgb},0.03)` : 'none',
      }}
    >
      {/* ── Subject Section Header ──────────────────────────────────────────── */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-4 px-6 py-5 text-left bg-[#0c0c0c] hover:bg-[#121212] transition-colors border-b border-[#222]"
      >
        {/* Subject code badge */}
        <span
          className="font-['IBM_Plex_Mono'] font-bold text-xs tracking-widest px-3 py-1.5 rounded border shrink-0 uppercase min-w-[70px] text-center"
          style={{ color: colors.accent, background: colors.badge, borderColor: `rgba(${colors.accentRgb},0.3)` }}
        >
          {subject.code}
        </span>

        {/* Info Stack */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-['Rajdhani'] font-bold text-lg sm:text-xl tracking-wide text-gray-100 uppercase leading-none">
              {subject.label}
            </span>
            <span
              className="font-['IBM_Plex_Mono'] text-xs font-bold px-2 py-0.5 rounded"
              style={{ color: colors.accent, background: `rgba(${colors.accentRgb},0.12)` }}
            >
              {subject.weight}%
            </span>
          </div>
        </div>

        {/* Chevron status */}
        <span className="text-gray-500 hover:text-gray-300 transition-colors">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      </button>

      {/* ── Subject Notion-Style Table ─────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="subject-table-container"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-x-auto w-full"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222] bg-[#050505] font-['Rajdhani'] text-xs font-bold text-gray-400 uppercase tracking-widest select-none">
                  <th className="px-6 py-3.5">TOPICS & SYLLABUS</th>
                  <th className="px-4 py-3.5 text-center w-28 sm:w-36">REVIEW</th>
                  <th className="px-4 py-3.5 text-center w-28 sm:w-36">REFRESHER</th>
                </tr>
              </thead>
              <tbody>
                {subject.topics.map(topic => {
                  const tKey = topicAccordionKey(subject.code, topic.id)
                  return (
                    <TopicAccordion
                      key={tKey}
                      subjectCode={subject.code}
                      topic={topic}
                      colors={colors}
                      reviewed={reviewed}
                      refresher={refresher}
                      onToggleReview={onToggleReview}
                      onToggleRefresher={onToggleRefresher}
                      isExpanded={!!expandedTopics[tKey]}
                      onToggleExpand={() => onToggleTopic(tKey)}
                    />
                  )
                })}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── TOSTracker (Root) ────────────────────────────────────────────────────────

export const TOSTracker: React.FC = () => {
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({})
  const [refresher, setRefresher] = useState<Record<string, boolean>>({})
  const [showReset, setShowReset] = useState(false)
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({
    MATH: true, ELECS: true, GEAS: true, EST: true,
  })
  
  // Auto-expand the first topic of each subject by default
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({
    'MATH::MATH-1.0': true,
    'ELECS::ELECS-1.0': true,
    'GEAS::GEAS-1.0': true,
    'EST::EST-1.0': true,
  })

  // Load states on mount
  useEffect(() => {
    setReviewed(loadState(STORAGE_REVIEWED))
    setRefresher(loadState(STORAGE_REFRESHER))
  }, [])

  // Toggle handlers
  const handleToggleReview = useCallback((key: string) => {
    setReviewed(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveState(STORAGE_REVIEWED, next)
      return next
    })
  }, [])

  const handleToggleRefresher = useCallback((key: string) => {
    setRefresher(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveState(STORAGE_REFRESHER, next)
      return next
    })
  }, [])

  // Reset all progress
  const handleReset = useCallback(() => {
    setReviewed({})
    setRefresher({})
    saveState(STORAGE_REVIEWED, {})
    saveState(STORAGE_REFRESHER, {})
    setShowReset(false)
  }, [])

  const toggleSubject = useCallback((code: string) => {
    setExpandedSubjects(prev => ({ ...prev, [code]: !prev[code] }))
  }, [])

  const toggleTopic = useCallback((key: string) => {
    setExpandedTopics(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Global stats computation (178 subtopics total)
  const globalStats = useMemo(() => {
    let totalSubtopics = 0
    let reviewedCount = 0

    TOS_DATA.forEach(s =>
      s.topics.forEach(t =>
        t.subtopics.forEach(sub => {
          totalSubtopics++
          if (reviewed[subtopicKey(s.code, sub.name)]) {
            reviewedCount++
          }
        })
      )
    )

    const pct = totalSubtopics > 0 ? Math.round((reviewedCount / totalSubtopics) * 100) : 0
    return { total: totalSubtopics, reviewed: reviewedCount, pct }
  }, [reviewed])

  const progressColor =
    globalStats.pct >= 80 ? '#00FF41'
    : globalStats.pct >= 50 ? '#22c55e'
    : globalStats.pct >= 25 ? '#f59e0b'
    : '#ef4444'

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── Global Stats Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 p-5 rounded-xl border border-[#252525] bg-[#0c0c0c]">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/20 shrink-0">
            <TrendingUp size={18} className="text-[#00FF41]" />
          </div>
          <div>
            <span className="font-['Rajdhani'] text-xs font-bold uppercase tracking-widest text-[#00FF41] block leading-tight">
              REVIEW PROGRESS
            </span>
            <span className="font-['IBM_Plex_Mono'] text-[10px] text-gray-500">
              {globalStats.reviewed} / {globalStats.total} subtopics reviewed
            </span>
          </div>
        </div>

        {/* Progress Bar & Reset Button */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-36 sm:w-52 h-2.5 rounded-full bg-[#1e1e1e] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${globalStats.pct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{
                  background: progressColor,
                  boxShadow: `0 0 10px ${progressColor}55`,
                }}
              />
            </div>
            <span
              className="font-['IBM_Plex_Mono'] text-sm font-black min-w-[42px] text-right"
              style={{ color: progressColor }}
            >
              {globalStats.pct}%
            </span>
          </div>

          {/* Reset */}
          {(globalStats.reviewed > 0 || Object.keys(refresher).filter(k => refresher[k]).length > 0) && (
            <div className="border-l border-[#222] pl-4">
              {!showReset ? (
                <button
                  onClick={() => setShowReset(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded bg-[#1a1a1a] hover:bg-red-950/20 text-gray-400 hover:text-red-400 transition-all border border-[#2d2d2d] hover:border-red-900/50 text-xs font-['Rajdhani'] uppercase tracking-widest font-semibold"
                  title="Reset all checklist progress"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded border border-red-900/40">
                  <span className="font-['IBM_Plex_Mono'] text-[10px] text-red-400">Confirm Reset?</span>
                  <button
                    onClick={handleReset}
                    className="px-2 py-0.5 rounded bg-red-900/30 border border-red-700/50 text-red-300 text-[10px] font-['Rajdhani'] uppercase tracking-widest hover:bg-red-800/50 transition-colors font-bold"
                  >
                    YES
                  </button>
                  <button
                    onClick={() => setShowReset(false)}
                    className="px-2 py-0.5 rounded bg-[#1e1e1e] border border-[#333] text-gray-400 text-[10px] font-['Rajdhani'] uppercase tracking-widest hover:text-white transition-colors"
                  >
                    NO
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Document Stack of Subjects ── */}
      <div className="flex flex-col gap-6 w-full">
        {TOS_DATA.map(subject => (
          <SubjectPanel
            key={subject.code}
            subject={subject}
            reviewed={reviewed}
            refresher={refresher}
            onToggleReview={handleToggleReview}
            onToggleRefresher={handleToggleRefresher}
            isExpanded={!!expandedSubjects[subject.code]}
            onToggleExpand={() => toggleSubject(subject.code)}
            expandedTopics={expandedTopics}
            onToggleTopic={toggleTopic}
          />
        ))}
      </div>
    </div>
  )
}

export default TOSTracker
