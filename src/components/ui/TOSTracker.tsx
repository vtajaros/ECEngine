import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, ChevronUp, RotateCcw, TrendingUp,
  Square, CheckSquare
} from 'lucide-react'
import { TOS_DATA, TOS_SUBJECT_COLORS, TOSSubject, TOSTopic } from '../../lib/tosData'
import { useChecklistStore } from '../../store/useChecklistStore'
import { Tooltip } from './Tooltip'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECT_CODES = ['MATH', 'ELECS', 'GEAS', 'EST'] as const
type SubjectCode = typeof SUBJECT_CODES[number]

/** Stable checklist key: "MATH::1.1 Functions, Continuity, Limits" */
function subtopicKey(subjectCode: string, subtopicName: string): string {
  return `${subjectCode}::${subtopicName}`
}

/** Stable key for a parent topic accordion: "MATH::MATH-1.0" */
function topicAccordionKey(subjectCode: string, topicId: string): string {
  return `${subjectCode}::${topicId}`
}

// ─── TopicAccordion ───────────────────────────────────────────────────────────

interface TopicAccordionProps {
  subjectCode: string
  topic: TOSTopic
  colors: (typeof TOS_SUBJECT_COLORS)[string]
  reviewed: Record<string, boolean>
  refresher: Record<string, boolean>
  selfReview: Record<string, boolean>
  onToggleReview: (key: string) => void
  onToggleRefresher: (key: string) => void
  onToggleSelfReview: (key: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

const TopicAccordion: React.FC<TopicAccordionProps> = ({
  subjectCode, topic, colors, reviewed, refresher, selfReview,
  onToggleReview, onToggleRefresher, onToggleSelfReview,
  isExpanded, onToggleExpand
}) => {
  // Weighted progress: REVIEW 15% + REFRESHER 15% + SELF REVIEW 70%
  const { topicPct, allReviewed, allRefresher, allSelfReview } = useMemo(() => {
    if (topic.subtopics.length === 0) return { topicPct: 0, allReviewed: false, allRefresher: false, allSelfReview: false }
    let total = 0
    let everyReviewed = true
    let everyRefresher = true
    let everySelfReview = true
    topic.subtopics.forEach(sub => {
      const key = subtopicKey(subjectCode, sub.name)
      total +=
        (reviewed[key] ? 0.10 : 0) +
        (refresher[key] ? 0.20 : 0) +
        (selfReview[key] ? 0.70 : 0)
      if (!reviewed[key]) everyReviewed = false
      if (!refresher[key]) everyRefresher = false
      if (!selfReview[key]) everySelfReview = false
    })
    return {
      topicPct: Math.round((total / topic.subtopics.length) * 100),
      allReviewed: everyReviewed,
      allRefresher: everyRefresher,
      allSelfReview: everySelfReview,
    }
  }, [subjectCode, topic.subtopics, reviewed, refresher, selfReview])

  const pctColor =
    topicPct >= 80 ? '#00FF41'
      : topicPct >= 50 ? '#22c55e'
        : topicPct >= 25 ? '#f59e0b'
          : topicPct > 0 ? '#ef4444'
            : '#333'

  return (
    <>
      {/* ── Parent Topic Header Row ─────────────────────────────────────────── */}
      <tr
        onClick={onToggleExpand}
        className="cursor-pointer bg-white/[0.03] hover:bg-white/[0.07] border-b border-white/10 transition-colors select-none"
      >
        {/* Topic name + progress pill */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 shrink-0">
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
            <span className="font-['Rajdhani'] text-xl font-bold tracking-wide text-gray-200">
              {topic.name}
            </span>
            <span
              className="font-['JetBrains_Mono'] text-[11px] font-bold px-2 py-0.5 rounded ml-1"
              style={{
                color: pctColor,
                background: topicPct > 0 ? pctColor + '18' : '#1a1a1a',
                border: '1px solid ' + pctColor + '33',
              }}
            >
              {topicPct}%
            </span>
          </div>
        </td>

        {/* REVIEW all-done indicator */}
        <td className="px-3 py-3 text-center w-24">
          {allReviewed && (
            <Tooltip content="All subtopics reviewed" position="top">
              <span className="inline-flex items-center justify-center">
                <CheckSquare size={18} className="text-accent mx-auto opacity-70" />
              </span>
            </Tooltip>
          )}
        </td>

        {/* REFRESHER all-done indicator */}
        <td className="px-3 py-3 text-center w-24">
          {allRefresher && (
            <Tooltip content="All subtopics refreshed" position="top">
              <span className="inline-flex items-center justify-center">
                <CheckSquare size={18} className="text-accent mx-auto opacity-70" />
              </span>
            </Tooltip>
          )}
        </td>

        {/* SELF REVIEW all-done indicator */}
        <td className="px-3 py-3 text-center w-24">
          {allSelfReview && (
            <Tooltip content="All subtopics self-reviewed" position="top">
              <span className="inline-flex items-center justify-center">
                <CheckSquare size={18} className="text-accent mx-auto opacity-70" />
              </span>
            </Tooltip>
          )}
        </td>
      </tr>

      {/* ── Subtopic Rows ───────────────────────────────────────────────────── */}
      {isExpanded && topic.subtopics.map((sub) => {
        const key = subtopicKey(subjectCode, sub.name)
        const isReviewed = !!reviewed[key]
        const isRefresher = !!refresher[key]
        const isSelfReview = !!selfReview[key]

        return (
          <tr
            key={key}
            className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
          >
            {/* Subtopic Title (Left) */}
            <td className="px-4 py-2 pl-10">
              <span
                className="font-['JetBrains_Mono'] text-sm leading-relaxed transition-colors"
                style={{ color: isReviewed ? '#00FF41' : '#a3a3a3' }}
              >
                {sub.name}
              </span>
            </td>

            {/* Review Checkbox */}
            <td className="px-3 py-2 text-center w-24">
              <button
                onClick={() => onToggleReview(key)}
                className="inline-flex items-center justify-center p-2 rounded hover:bg-white/5 transition-colors"
                aria-label="Toggle Review status"
              >
                {isReviewed ? (
                  <CheckSquare size={18} className="text-accent" />
                ) : (
                  <Square size={18} className="text-gray-600 hover:text-gray-400" />
                )}
              </button>
            </td>

            {/* Refresher Checkbox */}
            <td className="px-3 py-2 text-center w-24">
              <button
                onClick={() => onToggleRefresher(key)}
                className="inline-flex items-center justify-center p-2 rounded hover:bg-white/5 transition-colors"
                aria-label="Toggle Refresher status"
              >
                {isRefresher ? (
                  <CheckSquare size={18} className="text-accent" />
                ) : (
                  <Square size={18} className="text-gray-600 hover:text-gray-400" />
                )}
              </button>
            </td>

            {/* Self Review Checkbox */}
            <td className="px-3 py-2 text-center w-24">
              <button
                onClick={() => onToggleSelfReview(key)}
                className="inline-flex items-center justify-center p-2 rounded hover:bg-white/5 transition-colors"
                aria-label="Toggle Self Review status"
              >
                {isSelfReview ? (
                  <CheckSquare size={18} className="text-accent" />
                ) : (
                  <Square size={18} className="text-gray-600 hover:text-gray-400" />
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
  selfReview: Record<string, boolean>
  onToggleReview: (key: string) => void
  onToggleRefresher: (key: string) => void
  onToggleSelfReview: (key: string) => void
  expandedTopics: Record<string, boolean>
  onToggleTopic: (key: string) => void
}

const SubjectPanel: React.FC<SubjectPanelProps> = ({
  subject, reviewed, refresher, selfReview,
  onToggleReview, onToggleRefresher, onToggleSelfReview,
  expandedTopics, onToggleTopic,
}) => {
  const colors = TOS_SUBJECT_COLORS[subject.code]

  return (
    <div className="rounded-xl border overflow-hidden flex flex-col bg-[#080808]" style={{ borderColor: '#222' }}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border-base bg-[#050505] font-['Rajdhani'] text-xs font-bold text-gray-400 uppercase tracking-widest select-none">
            <th className="px-4 py-2.5 text-xs">TOPICS & SYLLABUS</th>
            <th className="px-3 py-2.5 text-center w-24 whitespace-nowrap" style={{ color: '#00FF41' }}>REVIEW</th>
            <th className="px-3 py-2.5 text-center w-24 whitespace-nowrap" style={{ color: '#00FF41' }}>REFRESHER</th>
            <th className="px-3 py-2.5 text-center w-24 whitespace-nowrap" style={{ color: '#00FF41' }}>SELF REVIEW</th>
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
                selfReview={selfReview}
                onToggleReview={onToggleReview}
                onToggleRefresher={onToggleRefresher}
                onToggleSelfReview={onToggleSelfReview}
                isExpanded={!!expandedTopics[tKey]}
                onToggleExpand={() => onToggleTopic(tKey)}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Subject Tab Bar ──────────────────────────────────────────────────────────

interface SubjectTabBarProps {
  active: SubjectCode
  onChange: (code: SubjectCode) => void
  reviewed: Record<string, boolean>
  refresher: Record<string, boolean>
  selfReview: Record<string, boolean>
}

const SubjectTabBar: React.FC<SubjectTabBarProps> = ({ active, onChange, reviewed, refresher, selfReview }) => {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {TOS_DATA.map(subject => {
        const code = subject.code as SubjectCode
        const colors = TOS_SUBJECT_COLORS[code]
        const isActive = active === code

        // Per-subject reviewed count for badge
        let subtopicCount = 0
        let weightedSum = 0
        subject.topics.forEach(t =>
          t.subtopics.forEach(sub => {
            subtopicCount++
            const key = subtopicKey(code, sub.name)
            weightedSum +=
              (reviewed[key] ? 0.10 : 0) +
              (refresher[key] ? 0.20 : 0) +
              (selfReview[key] ? 0.70 : 0)
          })
        )
        const pct = subtopicCount > 0 ? Math.round((weightedSum / subtopicCount) * 100) : 0

        return (
          <button
            key={code}
            onClick={() => onChange(code)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all font-['Rajdhani'] font-bold text-sm uppercase tracking-widest"
            style={
              isActive
                ? {
                  background: `rgba(${colors.accentRgb},0.15)`,
                  borderColor: `rgba(${colors.accentRgb},0.5)`,
                  color: colors.accent,
                  boxShadow: `0 0 16px rgba(${colors.accentRgb},0.1)`,
                }
                : {
                  background: '#0c0c0c',
                  borderColor: '#2a2a2a',
                  color: '#555',
                }
            }
          >
            <span>{code}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── TOSTracker (Root) ────────────────────────────────────────────────────────

export const TOSTracker: React.FC = () => {
  const {
    reviewed,
    refresher,
    selfReview,
    expandedTopics,
    toggleReview: handleToggleReview,
    toggleRefresher: handleToggleRefresher,
    toggleSelfReview: handleToggleSelfReview,
    toggleTopic,
    resetAll,
  } = useChecklistStore()

  const [showReset, setShowReset] = useState(false)
  const [activeTab, setActiveTab] = useState<SubjectCode>('MATH')

  // Reset all progress
  const handleReset = useCallback(() => {
    resetAll()
    setShowReset(false)
  }, [resetAll])

  // Global stats (all subjects, review column only)
  const globalStats = useMemo(() => {
    let totalSubtopics = 0
    let weightedSum = 0
    let reviewedCount = 0
    TOS_DATA.forEach(s =>
      s.topics.forEach(t =>
        t.subtopics.forEach(sub => {
          totalSubtopics++
          const key = subtopicKey(s.code, sub.name)
          weightedSum +=
            (reviewed[key] ? 0.10 : 0) +
            (refresher[key] ? 0.20 : 0) +
            (selfReview[key] ? 0.70 : 0)
          if (reviewed[key]) reviewedCount++
        })
      )
    )
    const pct = totalSubtopics > 0 ? Math.round((weightedSum / totalSubtopics) * 100) : 0
    return { total: totalSubtopics, pct, reviewed: reviewedCount }
  }, [reviewed, refresher, selfReview])

  const progressColor =
    globalStats.pct >= 80 ? '#00FF41'
      : globalStats.pct >= 50 ? '#22c55e'
        : globalStats.pct >= 25 ? '#f59e0b'
          : globalStats.pct > 0 ? '#ef4444'
            : '#333'

  const activeSubject = TOS_DATA.find(s => s.code === activeTab)!
  const hasAnyProgress =
    globalStats.reviewed > 0 ||
    Object.values(refresher).some(Boolean) ||
    Object.values(selfReview).some(Boolean)

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">

      {/* ── Global Stats Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 py-3 rounded-xl border border-[#252525] bg-[#0c0c0c]">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 shrink-0">
            <TrendingUp size={18} className="text-accent" />
          </div>
          <div>
            <span className="font-['Rajdhani'] text-xs font-bold uppercase tracking-widest text-accent block leading-tight">
              OVERALL REVIEW PROGRESS
            </span>
            <span className="font-['JetBrains_Mono'] text-[10px] text-gray-500">
              {globalStats.total} subtopics · weighted progress
            </span>
          </div>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-52 h-2.5 rounded-full bg-[#1e1e1e] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={false}
                animate={{ width: `${globalStats.pct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{
                  width: `${globalStats.pct}%`,
                  background: progressColor,
                  boxShadow: globalStats.pct > 0 ? `0 0 10px ${progressColor}55` : 'none',
                }}
              />
            </div>
            <span
              className="font-['JetBrains_Mono'] text-sm font-black min-w-[42px] text-right transition-colors"
              style={{ color: globalStats.pct > 0 ? progressColor : '#666' }}
            >
              {globalStats.pct}%
            </span>
          </div>

          {hasAnyProgress && (
            <div className="border-l border-border-base pl-4">
              {!showReset ? (
                <Tooltip content="Reset all checklist progress" position="top">
                  <button
                    onClick={() => setShowReset(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded bg-surface hover:bg-red-950/20 text-gray-400 hover:text-red-400 transition-all border border-[#2d2d2d] hover:border-red-900/50 text-xs font-['Rajdhani'] uppercase tracking-widest font-semibold"
                  >
                    <RotateCcw size={12} />
                    Reset
                  </button>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded border border-red-900/40">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-red-400">Confirm Reset?</span>
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

      {/* ── Subject Tab Bar ── */}
      <SubjectTabBar
        active={activeTab}
        onChange={setActiveTab}
        reviewed={reviewed}
        refresher={refresher}
        selfReview={selfReview}
      />

      {/* ── Active Subject Label ── */}
      {(() => {
        const colors = TOS_SUBJECT_COLORS[activeTab]
        return (
          <div className="flex items-center gap-3 px-1">
            <span
              className="font-['JetBrains_Mono'] font-bold text-xs tracking-widest px-3 py-1.5 rounded border uppercase"
              style={{ color: colors.accent, background: colors.badge, borderColor: `rgba(${colors.accentRgb},0.3)` }}
            >
              {activeSubject.code}
            </span>
            <span className="font-['Rajdhani'] font-bold text-lg tracking-wide text-gray-200 uppercase">
              {activeSubject.label}
            </span>
            {(() => {
              let subtopicCount = 0
              let weightedSum = 0
              activeSubject.topics.forEach(t =>
                t.subtopics.forEach(sub => {
                  subtopicCount++
                  const key = subtopicKey(activeSubject.code, sub.name)
                  weightedSum +=
                    (reviewed[key] ? 0.10 : 0) +
                    (refresher[key] ? 0.20 : 0) +
                    (selfReview[key] ? 0.70 : 0)
                })
              )
              const subjectPct = subtopicCount > 0 ? Math.round((weightedSum / subtopicCount) * 100) : 0
              const pctColor =
                subjectPct >= 80 ? '#00FF41'
                  : subjectPct >= 50 ? '#22c55e'
                    : subjectPct >= 25 ? '#f59e0b'
                      : subjectPct > 0 ? '#ef4444'
                        : '#444'
              return (
                <span
                  className="font-['JetBrains_Mono'] text-xs font-bold px-2 py-0.5 rounded"
                  style={{ color: pctColor, background: `${pctColor}18`, border: `1px solid ${pctColor}33` }}
                >
                  {subjectPct}%
                </span>
              )
            })()}
          </div>
        )
      })()}

      {/* ── Subject Table (animated tab switch) ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <SubjectPanel
            subject={activeSubject}
            reviewed={reviewed}
            refresher={refresher}
            selfReview={selfReview}
            onToggleReview={handleToggleReview}
            onToggleRefresher={handleToggleRefresher}
            onToggleSelfReview={handleToggleSelfReview}
            expandedTopics={expandedTopics}
            onToggleTopic={toggleTopic}
          />
        </motion.div>
      </AnimatePresence>

    </div>
  )
}

export default TOSTracker