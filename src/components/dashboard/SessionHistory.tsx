import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  History, 
  BookOpen, 
  Trophy, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Filter, 
  Calendar,
  Sparkles,
  Layers,
  ChevronDown,
  RotateCcw
} from 'lucide-react'
import { dbService, ExamSessionRecord } from '../../services/db.service'
import { getSubjectBadgeClasses, SUBJECT_MAP } from '../../lib/subjectColors'
import { SUBJECT_LINE_COLOR } from '../../lib/dashboardUtils'
import { Tooltip } from '../ui/Tooltip'
import { renderMath } from '../../lib/latex'

type ModeFilter = 'ALL' | 'learn' | 'test'
type SubjectFilter = 'ALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST'

interface SessionHistoryProps {
  onSessionUpdated?: () => void
}

function SessionHistory({ onSessionUpdated }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<ExamSessionRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modeFilter, setModeFilter] = useState<ModeFilter>('ALL')
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>('ALL')
  const [displayCount, setDisplayCount] = useState(8)
  const [sessionToDelete, setSessionToDelete] = useState<ExamSessionRecord | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadSessions = async () => {
    try {
      setIsLoading(true)
      const data = await dbService.getExamSessions(100)
      setSessions(data)
    } catch (err) {
      console.error('[SessionHistory] Failed to load sessions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const handleDeleteSession = async (id: string) => {
    try {
      setIsDeleting(true)
      await dbService.deleteExamSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      setSessionToDelete(null)
      onSessionUpdated?.()
    } catch (err) {
      console.error('[SessionHistory] Failed to delete session:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClearAll = async () => {
    try {
      setIsDeleting(true)
      await dbService.clearExamSessions()
      setSessions([])
      setShowClearConfirm(false)
      onSessionUpdated?.()
    } catch (err) {
      console.error('[SessionHistory] Failed to clear sessions:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Mode filter
      if (modeFilter !== 'ALL') {
        if (modeFilter === 'learn' && session.mode !== 'learn') return false
        if (modeFilter === 'test' && session.mode !== 'test' && session.mode !== 'exam') return false
      }

      // Subject filter
      if (subjectFilter !== 'ALL') {
        const rawSubj = session.topicSubject || session.metadata?.subject || ''
        const mappedSubj = SUBJECT_MAP[rawSubj] || rawSubj.toUpperCase()
        if (mappedSubj !== subjectFilter) return false
      }

      return true
    })
  }, [sessions, modeFilter, subjectFilter])

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const learnSessions = sessions.filter(s => s.mode === 'learn')
    const testSessions = sessions.filter(s => s.mode === 'test' || s.mode === 'exam')

    const learnAcc = learnSessions.length > 0
      ? Math.round(
          (learnSessions.reduce((acc, s) => acc + (s.total > 0 ? (s.score / s.total) * 100 : 0), 0)) / learnSessions.length
        )
      : null

    const testAcc = testSessions.length > 0
      ? Math.round(
          (testSessions.reduce((acc, s) => acc + (s.total > 0 ? (s.score / s.total) * 100 : 0), 0)) / testSessions.length
        )
      : null

    const passedTests = testSessions.filter(s => s.total > 0 && (s.score / s.total) >= 0.75).length
    const passRate = testSessions.length > 0 ? Math.round((passedTests / testSessions.length) * 100) : null

    const totalQuestionsAnswered = sessions.reduce((acc, s) => acc + s.total, 0)

    return {
      totalCount: sessions.length,
      learnCount: learnSessions.length,
      testCount: testSessions.length,
      learnAvgFirstTry: learnAcc,
      testAvgScore: testAcc,
      passRate,
      totalQuestionsAnswered
    }
  }, [sessions])

  const formatDate = (dateStr: string | number) => {
    if (!dateStr) return 'N/A'
    try {
      const d = typeof dateStr === 'number' ? new Date(dateStr * (dateStr < 10000000000 ? 1000 : 1)) : new Date(dateStr)
      if (isNaN(d.getTime())) return 'Recently'
      
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24 && now.getDate() === d.getDate()) return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      if (diffDays === 1) return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Recently'
    }
  }

  const getScoreColor = (score: number, total: number) => {
    if (!total || total === 0) return { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', bar: '#888' }
    const pct = (score / total) * 100
    if (pct >= 75) {
      return { text: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/30', bar: '#00FF41' }
    }
    if (pct >= 50) {
      return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', bar: '#FB923C' }
    }
    return { text: 'text-[#FF003C]', bg: 'bg-[#FF003C]/10', border: 'border-[#FF003C]/30', bar: '#FF003C' }
  }

  return (
    <div className="bg-surface border border-border-base rounded-xl p-5 lg:p-6 shadow-xl relative overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 border-b border-[#1E1E1E] pb-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2 rounded-lg bg-[#111] border border-border-base text-accent shrink-0">
            <History size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <h2 className="font-['Rajdhani'] font-bold text-lg text-text-primary uppercase tracking-widest whitespace-nowrap">
                Session History
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#111] border border-border-base font-['JetBrains_Mono'] text-accent whitespace-nowrap">
                {sessions.length} Recorded
              </span>
            </div>
            <p className="text-xs text-text-muted font-['Rajdhani'] uppercase tracking-wider mt-0.5">
              Learn Mode (Flawless Scores) &amp; Test Mode Results
            </p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 w-full lg:w-auto">
          {/* Mode Filter Tabs */}
          <div className="flex items-center bg-[#111] p-1 rounded-lg border border-border-base shrink-0">
            <button
              onClick={() => setModeFilter('ALL')}
              className={`px-3 py-1 text-[10px] font-bold font-['Rajdhani'] uppercase tracking-widest rounded transition-all ${
                modeFilter === 'ALL'
                  ? 'bg-accent text-black shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-border-base'
              }`}
            >
              All Modes
            </button>
            <button
              onClick={() => setModeFilter('learn')}
              className={`px-3 py-1 text-[10px] font-bold font-['Rajdhani'] uppercase tracking-widest rounded flex items-center gap-1.5 transition-all ${
                modeFilter === 'learn'
                  ? 'bg-accent text-black shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-border-base'
              }`}
            >
              <BookOpen size={11} />
              Learn Mode
            </button>
            <button
              onClick={() => setModeFilter('test')}
              className={`px-3 py-1 text-[10px] font-bold font-['Rajdhani'] uppercase tracking-widest rounded flex items-center gap-1.5 transition-all ${
                modeFilter === 'test'
                  ? 'bg-accent text-black shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-border-base'
              }`}
            >
              <Trophy size={11} />
              Test Mode
            </button>
          </div>

          {/* Subject Filter Dropdown / Pill */}
          <div className="flex items-center bg-[#111] p-1 rounded-lg border border-border-base shrink-0">
            {(['ALL', 'MATH', 'GEAS', 'ELECS', 'EST'] as const).map(subj => (
              <button
                key={subj}
                onClick={() => setSubjectFilter(subj)}
                className={`px-2.5 py-1 text-[10px] font-bold font-['Rajdhani'] uppercase tracking-widest rounded transition-all ${
                  subjectFilter === subj
                    ? 'text-black font-extrabold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                style={subjectFilter === subj ? { backgroundColor: SUBJECT_LINE_COLOR[subj] } : {}}
              >
                {subj}
              </button>
            ))}
          </div>

          {/* Clear History Button */}
          {sessions.length > 0 && (
            <Tooltip content="Clear session history" position="top">
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 rounded-lg bg-[#111] border border-border-base text-[#666] hover:text-[#FF003C] hover:border-[#FF003C]/40 hover:bg-[#FF003C]/10 transition-colors shrink-0"
                aria-label="Clear All History"
              >
                <RotateCcw size={15} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Mini Summary Cards Bar */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-5">
          <div className="bg-surface-2 p-3 rounded-lg border border-border-base flex flex-col min-w-0">
            <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-text-muted font-bold truncate">Total Sessions</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-['JetBrains_Mono'] text-lg font-bold text-text-primary">{summaryMetrics.totalCount}</span>
              <span className="font-['Rajdhani'] text-[9px] text-[#666] uppercase">runs</span>
            </div>
            <span className="font-['Rajdhani'] text-[9px] text-[#555] mt-0.5 truncate">
              {summaryMetrics.learnCount} Learn • {summaryMetrics.testCount} Test
            </span>
          </div>

          <div className="bg-surface-2 p-3 rounded-lg border border-border-base flex flex-col min-w-0">
            <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-accent font-bold flex items-center gap-1 truncate">
              <BookOpen size={10} className="shrink-0" />
              <span className="truncate">Flawless Answer Avg</span>
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-['JetBrains_Mono'] text-lg font-bold text-accent">
                {summaryMetrics.learnAvgFirstTry != null ? `${summaryMetrics.learnAvgFirstTry}%` : '—'}
              </span>
            </div>
            <span className="font-['Rajdhani'] text-[9px] text-[#555] mt-0.5 truncate">
              First-attempt flawless rate
            </span>
          </div>

          <div className="bg-surface-2 p-3 rounded-lg border border-border-base flex flex-col min-w-0">
            <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-accent font-bold flex items-center gap-1 truncate">
              <Trophy size={10} className="shrink-0" />
              <span className="truncate">Test Mode Avg</span>
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-['JetBrains_Mono'] text-lg font-bold text-accent">
                {summaryMetrics.testAvgScore != null ? `${summaryMetrics.testAvgScore}%` : '—'}
              </span>
            </div>
            <span className="font-['Rajdhani'] text-[9px] text-[#555] mt-0.5 truncate">
              {summaryMetrics.passRate != null ? `${summaryMetrics.passRate}% pass rate (≥75%)` : 'No tests yet'}
            </span>
          </div>

          <div className="bg-surface-2 p-3 rounded-lg border border-border-base flex flex-col min-w-0">
            <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-accent font-bold flex items-center gap-1 truncate">
              <Sparkles size={10} className="shrink-0" />
              <span className="truncate">Items Solved</span>
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-['JetBrains_Mono'] text-lg font-bold text-text-primary">
                {summaryMetrics.totalQuestionsAnswered}
              </span>
              <span className="font-['Rajdhani'] text-[9px] text-accent uppercase font-bold">MCQs</span>
            </div>
            <span className="font-['Rajdhani'] text-[9px] text-[#555] mt-0.5 truncate">
              Across all recorded runs
            </span>
          </div>
        </div>
      )}

      {/* Session List Table / Cards */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-text-muted gap-2">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="font-['Rajdhani'] uppercase tracking-widest text-xs">Loading session history...</span>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="py-12 px-4 rounded-xl border border-dashed border-border-base bg-[#0A0A0A] flex flex-col items-center justify-center text-center">
          <div className="p-3 rounded-full bg-surface border border-border-base text-text-muted mb-3">
            <History size={24} className="opacity-40" />
          </div>
          <h3 className="font-['Rajdhani'] font-bold text-text-primary uppercase tracking-wider text-base mb-1">
            {sessions.length === 0 ? 'No Session History Recorded Yet' : 'No Sessions Match Selected Filters'}
          </h3>
          <p className="font-['Rajdhani'] text-xs text-text-muted max-w-md leading-relaxed uppercase tracking-wider">
            {sessions.length === 0
              ? 'Complete a Learn Mode session (records first-try recall) or Test Mode quiz in LooksFam to start tracking your performance history.'
              : 'Try selecting "All Modes" or "ALL" subjects to view other recorded sessions.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence mode="popLayout">
            {filteredSessions.slice(0, displayCount).map((session, index) => {
              const rawSubj = session.topicSubject || session.metadata?.subject || 'ELECS'
              const subject = SUBJECT_MAP[rawSubj] || rawSubj.toUpperCase()
              const title = session.topicName || session.metadata?.deckTitle || 'LooksFam Deck'
              const description = session.topicDescription || session.metadata?.deckDescription || session.metadata?.description || ''
              const isLearn = session.mode === 'learn'
              const pct = session.total > 0 ? Math.round((session.score / session.total) * 100) : 0
              const scoreStyle = getScoreColor(session.score, session.total)
              const isPassed = pct >= 75

              return (
                <motion.div
                  key={session.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className="group relative bg-[#0C0C0C] hover:bg-surface-2 border border-border-base hover:border-[#333] rounded-xl p-3.5 sm:p-4 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:shadow-md"
                >
                  {/* Left: Mode Badge & Deck Info */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Mode Indicator Pill */}
                    <div className="shrink-0 flex flex-col items-center w-14 sm:w-16">
                      {isLearn ? (
                        <div className="w-full py-1 rounded-md border border-accent/30 bg-accent/10 text-accent flex items-center justify-center gap-1.5 font-['Rajdhani'] font-bold text-[10px] uppercase tracking-wider">
                          <BookOpen size={11} className="shrink-0" />
                          <span>LEARN</span>
                        </div>
                      ) : (
                        <div className="w-full py-1 rounded-md border border-accent/30 bg-accent/10 text-accent flex items-center justify-center gap-1.5 font-['Rajdhani'] font-bold text-[10px] uppercase tracking-wider">
                          <Trophy size={11} className="shrink-0" />
                          <span>TEST</span>
                        </div>
                      )}
                      <span className="text-[8px] font-['JetBrains_Mono'] text-text-muted mt-0.5 uppercase tracking-tighter">
                        {isLearn ? 'Flawless' : 'Exam'}
                      </span>
                    </div>

                    {/* Subject + Deck Title + Description + Date */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold font-['Rajdhani'] uppercase tracking-wider shrink-0 ${getSubjectBadgeClasses(subject)}`}>
                          {subject}
                        </span>
                        <h4 
                          className="font-['Rajdhani'] font-bold text-sm text-text-primary tracking-wide uppercase truncate"
                          dangerouslySetInnerHTML={{ __html: renderMath(title) }}
                          title={title}
                        />
                      </div>
                      {description.trim() !== '' && (
                        <p className="text-xs text-text-muted font-['JetBrains_Mono'] line-clamp-1 leading-relaxed mt-0.5" title={description}>
                          {description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted font-['JetBrains_Mono']">
                        <Calendar size={11} className="text-[#555] shrink-0" />
                        <span>{formatDate(session.finishedAt || session.startedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Score, Percentage, Bar & Delete */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1E1E1E]">
                    {/* Score / Ratio details */}
                    <div className="flex flex-col items-start sm:items-end">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-['JetBrains_Mono'] text-base font-bold text-text-primary">
                          {session.score}
                          <span className="text-[#555] text-xs font-normal"> / {session.total}</span>
                        </span>
                        <span className={`font-['JetBrains_Mono'] text-xs font-bold px-1.5 py-0.5 rounded border ${scoreStyle.text} ${scoreStyle.bg} ${scoreStyle.border}`}>
                          {pct}%
                        </span>
                      </div>

                      {/* Explicit Tag */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isLearn ? (
                          <span className="text-[9px] font-['Rajdhani'] font-bold uppercase tracking-wider text-accent whitespace-nowrap">
                            Flawless Score
                          </span>
                        ) : (
                          <span className={`text-[9px] font-['Rajdhani'] font-bold uppercase tracking-wider whitespace-nowrap ${isPassed ? 'text-accent' : 'text-[#FF003C]'}`}>
                            {isPassed ? 'Passed (≥75%)' : 'Needs Practice'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Visual Progress Bar (Hidden on compact screens/130% zoom) */}
                    <div className="hidden lg:flex flex-col gap-1 w-16 sm:w-20 shrink-0">
                      <div className="w-full bg-[#111] h-1.5 rounded-full overflow-hidden border border-border-base">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            backgroundColor: scoreStyle.bar,
                            boxShadow: pct > 0 ? `0 0 6px ${scoreStyle.bar}60` : 'none'
                          }}
                        />
                      </div>
                    </div>

                    {/* Delete Session Button */}
                    <Tooltip content="Delete this session record" position="top">
                      <button
                        onClick={() => setSessionToDelete(session)}
                        className="opacity-40 group-hover:opacity-100 p-1.5 rounded-md hover:bg-[#FF003C]/10 text-text-muted hover:text-[#FF003C] hover:border hover:border-[#FF003C]/30 transition-all shrink-0"
                        aria-label="Delete session"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Tooltip>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Show More / Show Less Button */}
          {filteredSessions.length > 8 && (
            <div className="flex justify-center pt-2">
              {displayCount < filteredSessions.length ? (
                <button
                  onClick={() => setDisplayCount(prev => prev + 8)}
                  className="px-4 py-1.5 rounded-lg bg-[#111] border border-border-base text-text-muted hover:text-text-primary hover:border-accent/40 font-['Rajdhani'] text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1.5"
                >
                  <span>Show More ({filteredSessions.length - displayCount} Remaining)</span>
                  <ChevronDown size={14} />
                </button>
              ) : (
                <button
                  onClick={() => setDisplayCount(8)}
                  className="px-4 py-1.5 rounded-lg bg-[#111] border border-border-base text-text-muted hover:text-text-primary font-['Rajdhani'] text-xs font-bold uppercase tracking-widest transition-all"
                >
                  Show Less
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete Single Session Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface border border-border-base rounded-xl p-6 max-w-sm w-full shadow-2xl relative"
          >
            <div className="flex items-center gap-3 text-[#FF003C] mb-3">
              <AlertCircle size={22} />
              <h3 className="font-['Rajdhani'] font-bold text-lg text-text-primary uppercase tracking-wider">
                Delete Session Record
              </h3>
            </div>
            <p className="text-xs text-text-muted font-['Rajdhani'] uppercase tracking-wider leading-relaxed mb-5">
              Are you sure you want to remove this {sessionToDelete.mode === 'learn' ? 'Learn' : 'Test'} session record for &quot;{sessionToDelete.topicName || 'LooksFam Deck'}&quot;?
            </p>
            <div className="flex justify-end gap-2">
              <button
                disabled={isDeleting}
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 rounded-lg bg-[#111] border border-border-base text-text-muted hover:text-text-primary font-['Rajdhani'] font-bold text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={() => handleDeleteSession(sessionToDelete.id)}
                className="px-4 py-2 rounded-lg bg-[#FF003C] text-white hover:bg-red-600 font-['Rajdhani'] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,0,60,0.4)]"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Clear All Sessions Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface border border-border-base rounded-xl p-6 max-w-sm w-full shadow-2xl relative"
          >
            <div className="flex items-center gap-3 text-[#FF003C] mb-3">
              <RotateCcw size={22} />
              <h3 className="font-['Rajdhani'] font-bold text-lg text-text-primary uppercase tracking-wider">
                Clear All Session History
              </h3>
            </div>
            <p className="text-xs text-text-muted font-['Rajdhani'] uppercase tracking-wider leading-relaxed mb-5">
              This will permanently delete all {sessions.length} recorded Learn and Test session results from your database. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                disabled={isDeleting}
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-lg bg-[#111] border border-border-base text-text-muted hover:text-text-primary font-['Rajdhani'] font-bold text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleClearAll}
                className="px-4 py-2 rounded-lg bg-[#FF003C] text-white hover:bg-red-600 font-['Rajdhani'] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,0,60,0.4)]"
              >
                {isDeleting ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

export default React.memo(SessionHistory)
