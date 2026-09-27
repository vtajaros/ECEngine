import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, X, AlertTriangle, CheckCircle2, ChevronRight, RefreshCw, Sparkles, Flame } from 'lucide-react'
import { gauntletService, type WeakTopicStat } from '../../services/gauntlet.service'
import { GAUNTLET_SUBJECTS } from '../../lib/gauntlet'
import { SUBJECT_LINE_COLOR } from '../../lib/dashboardUtils'
import { formatTosBadge, getTosTopicById } from '../../lib/tosClassification'
import { useGauntletStore } from '../../store/useGauntletStore'
import { Tooltip } from '../ui/Tooltip'
import type { Subject } from '../../types'

interface GauntletWeakAreasModalProps {
  isOpen: boolean
  onClose: () => void
}

type SubjectFilter = 'ALL' | Subject

export const GauntletWeakAreasModal: React.FC<GauntletWeakAreasModalProps> = ({ isOpen, onClose }) => {
  const [activeSubject, setActiveSubject] = useState<SubjectFilter>('ALL')
  const [activeMode, setActiveMode] = useState<'all' | 'timed' | 'survival'>('all')
  const [sortBy, setSortBy] = useState<'misses' | 'accuracy'>('misses')
  const [loading, setLoading] = useState(false)
  const [weakTopics, setWeakTopics] = useState<WeakTopicStat[]>([])
  const [error, setError] = useState<string | null>(null)

  const openSetup = useGauntletStore(s => s.openSetup)

  const loadWeakAreas = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await gauntletService.getWeakTosTopics({
        subject: activeSubject === 'ALL' ? undefined : activeSubject,
        mode: activeMode,
        sortBy,
        limit: 50,
      })
      setWeakTopics(data)
    } catch (e) {
      setError((e as Error).message || 'Failed to load weak areas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      void loadWeakAreas()
    }
  }, [isOpen, activeSubject, activeMode, sortBy])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const filteredTopics = useMemo(() => {
    if (activeSubject === 'ALL') return weakTopics
    return weakTopics.filter(t => t.subject === activeSubject)
  }, [weakTopics, activeSubject])

  const summary = useMemo(() => {
    if (filteredTopics.length === 0) return null
    const lowest = [...filteredTopics].sort((a, b) => a.accuracy - b.accuracy)[0]
    const mostMissed = [...filteredTopics].sort((a, b) => b.wrongAnswers - a.wrongAnswers)[0]
    return {
      total: filteredTopics.length,
      lowestAcc: Math.round(lowest.accuracy * 100),
      lowestTopic: formatTosBadge(lowest.tosTopicId) || lowest.tosTopicId,
      mostMissedCount: mostMissed.wrongAnswers,
      mostMissedTopic: formatTosBadge(mostMissed.tosTopicId) || mostMissed.tosTopicId,
    }
  }, [filteredTopics])

  const handleLaunchDrill = (subject: Subject, tosTopicId?: string) => {
    onClose()
    openSetup('timed', {
      subjects: [subject],
      tosTopicId: tosTopicId ?? null,
    })
  }

  const getSeverityInfo = (acc: number) => {
    if (acc < 0.4) {
      return {
        label: 'CRITICAL',
        color: '#EF4444',
        border: 'border-red-500/30',
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        bar: 'bg-red-500',
      }
    }
    if (acc < 0.55) {
      return {
        label: 'HIGH RISK',
        color: '#F97316',
        border: 'border-orange-500/30',
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        bar: 'bg-orange-500',
      }
    }
    return {
      label: 'NEEDS POLISH',
      color: '#EAB308',
      border: 'border-yellow-500/30',
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      bar: 'bg-yellow-500',
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative w-full max-w-3xl bg-[#111] border border-border-base rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col h-[650px] max-h-[90vh]"
          >
            {/* Top Accent Gradient */}
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-warn to-transparent" />

            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border-base flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-warn/10 border border-warn/30 flex items-center justify-center text-warn">
                  <Target size={20} />
                </div>
                <div>
                  <h3 className="font-['Orbitron'] font-bold text-base sm:text-lg text-text-primary tracking-wider uppercase flex items-center gap-2">
                    Diagnostic Radar: Weak Areas
                  </h3>
                  <p className="text-[11px] sm:text-xs font-['Rajdhani'] text-text-muted uppercase tracking-wider">
                    Syllabus competencies where {activeMode === 'timed' ? 'Time Trial' : activeMode === 'survival' ? 'Survival' : 'Gauntlet'} accuracy is below 70%
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Tooltip content="Refresh Diagnostics" position="bottom">
                  <button
                    type="button"
                    onClick={() => void loadWeakAreas()}
                    disabled={loading}
                    className="w-8 h-8 rounded-lg bg-surface border border-border-base hover:border-warn text-text-muted hover:text-warn flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                  </button>
                </Tooltip>

                <Tooltip content="Close (Esc)" position="bottom">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg bg-surface border border-border-base hover:border-text-primary text-text-muted hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Subject Tabs */}
            <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-border-base/60 bg-[#0d0d0d] flex items-center justify-between gap-2 overflow-x-auto shrink-0 flex-wrap">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveSubject('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-['Rajdhani'] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeSubject === 'ALL'
                      ? 'bg-warn text-black shadow-[0_0_12px_rgba(255,184,0,0.3)]'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface'
                  }`}
                >
                  All Subjects
                </button>
                {GAUNTLET_SUBJECTS.map(subj => {
                  const isSelected = activeSubject === subj
                  const subjColor = SUBJECT_LINE_COLOR[subj]
                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => setActiveSubject(subj)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-['Rajdhani'] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'text-black font-extrabold shadow-sm'
                          : 'text-text-muted hover:text-text-primary hover:bg-surface border border-border-base/40'
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: subjColor, color: '#000' }
                          : {}
                      }
                    >
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: subjColor }}
                      />
                      {subj}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Mode & Sort Sub-bar */}
            <div className="px-4 sm:px-6 py-2 border-b border-border-base/40 bg-[#0a0a0a] flex items-center justify-between gap-3 text-xs shrink-0 flex-wrap">
              {/* Mode filter pills */}
              <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded-lg border border-border-base/60">
                {(['all', 'timed', 'survival'] as const).map(m => {
                  const label = m === 'all' ? 'All Modes' : m === 'timed' ? 'Time Trial' : 'Survival'
                  const active = activeMode === m
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setActiveMode(m)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        active
                          ? 'bg-warn/20 text-warn border border-warn/40 shadow-sm'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Sort by toggle */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-['Rajdhani'] font-bold text-text-muted uppercase tracking-wider">
                  Sort:
                </span>
                <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded-lg border border-border-base/60">
                  <button
                    type="button"
                    onClick={() => setSortBy('misses')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      sortBy === 'misses'
                        ? 'bg-accent/20 text-accent border border-accent/40 shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Most Misses
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('accuracy')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      sortBy === 'accuracy'
                        ? 'bg-accent/20 text-accent border border-accent/40 shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Lowest Acc
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Summary Banner if weak topics exist */}
              {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-surface/50 border border-border-base rounded-xl text-left">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                      Flagged Competencies
                    </span>
                    <span className="font-['Orbitron'] text-xl font-bold text-warn mt-0.5">
                      {summary.total} <span className="text-xs font-['Rajdhani'] text-text-muted">Topics</span>
                    </span>
                  </div>
                  <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-border-base/60 pt-2 sm:pt-0 sm:pl-3">
                    <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                      Lowest Accuracy
                    </span>
                    <span className="font-['Orbitron'] text-xl font-bold text-danger mt-0.5">
                      {summary.lowestAcc}%
                    </span>
                    <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted truncate max-w-[200px]" title={summary.lowestTopic}>
                      {summary.lowestTopic}
                    </span>
                  </div>
                  <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-border-base/60 pt-2 sm:pt-0 sm:pl-3">
                    <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                      Most Missed Area
                    </span>
                    <span className="font-['Orbitron'] text-xl font-bold text-warn mt-0.5">
                      {summary.mostMissedCount} <span className="text-xs font-['Rajdhani'] text-text-muted">Misses</span>
                    </span>
                    <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted truncate max-w-[200px]" title={summary.mostMissedTopic}>
                      {summary.mostMissedTopic}
                    </span>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-center">
                  <AlertTriangle className="text-danger mx-auto mb-2" size={24} />
                  <p className="font-['Rajdhani'] text-sm text-danger">{error}</p>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <RefreshCw size={28} className="animate-spin text-warn" />
                  <p className="font-['Rajdhani'] text-sm text-text-muted uppercase tracking-wider">
                    Analyzing Gauntlet Performance History...
                  </p>
                </div>
              )}

              {/* Empty State */}
              {!loading && !error && filteredTopics.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-border-base rounded-2xl bg-surface/20">
                  <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent mb-4 shadow-[0_0_20px_rgba(0,255,65,0.15)]">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="font-['Orbitron'] font-bold text-base text-text-primary uppercase tracking-wide">
                    Arena Radar Clear
                  </h4>
                  <p className="font-['Rajdhani'] text-sm text-text-muted max-w-md mt-1.5">
                    {activeSubject === 'ALL'
                      ? 'No struggling topics detected! You have maintained at least 70% accuracy across tested areas, or haven\'t reached the 3-question threshold yet.'
                      : `No struggling topics detected under ${activeSubject}! Accuracy is high or more attempts are needed to establish baseline trends.`}
                  </p>
                  <div className="flex items-center gap-2.5 mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        openSetup('timed')
                      }}
                      className="px-4 py-2 rounded-xl bg-accent text-black font-['Rajdhani'] font-bold text-xs uppercase tracking-wider hover:bg-[#00e63a] transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(0,255,65,0.2)]"
                    >
                      Start Time Trial
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        openSetup('survival')
                      }}
                      className="px-4 py-2 rounded-xl bg-surface border border-border-base text-text-primary font-['Rajdhani'] font-bold text-xs uppercase tracking-wider hover:border-warn hover:text-warn transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Flame size={14} />
                      Start Survival
                    </button>
                  </div>
                </div>
              )}

              {/* Topics List */}
              {!loading && !error && filteredTopics.length > 0 && (
                <div className="space-y-2.5">
                  {filteredTopics.map(item => {
                    const sev = getSeverityInfo(item.accuracy)
                    const badgeText = formatTosBadge(item.tosTopicId) || item.tosTopicId
                    const subjColor = SUBJECT_LINE_COLOR[item.subject as Subject]
                    const accPercent = Math.round(item.accuracy * 100)

                    return (
                      <div
                        key={item.tosTopicId}
                        className="p-3.5 bg-[#141414] hover:bg-[#181818] border border-border-base rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                      >
                        {/* Topic Information */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span
                              className="font-['Orbitron'] text-[10px] font-black px-1.5 py-0.5 rounded text-black shrink-0"
                              style={{ backgroundColor: subjColor }}
                            >
                              {item.subject}
                            </span>
                            <span className="font-['JetBrains_Mono'] text-xs text-text-muted shrink-0">
                              {item.tosTopicId}
                            </span>
                            <span
                              className={`text-[9px] font-['Rajdhani'] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${sev.bg} ${sev.border} ${sev.text}`}
                            >
                              {sev.label}
                            </span>
                          </div>

                          <h4 className="font-['Rajdhani'] font-bold text-sm text-text-primary leading-tight truncate">
                            {badgeText}
                          </h4>

                          {/* Progress bar + Attempt stats */}
                          <div className="flex items-center gap-3 mt-2">
                            <div className="w-28 sm:w-36 h-2 bg-surface-2 rounded-full overflow-hidden shrink-0 border border-border-base/50">
                              <div
                                className={`h-full ${sev.bar} rounded-full transition-all duration-500`}
                                style={{ width: `${Math.max(5, accPercent)}%` }}
                              />
                            </div>
                            <span className="font-['JetBrains_Mono'] text-xs font-bold text-text-primary">
                              {accPercent}%
                            </span>
                            <span className="text-[11px] font-['JetBrains_Mono'] text-text-muted">
                              ({item.wrongAnswers} missed of {item.totalAnswers})
                            </span>
                          </div>
                        </div>

                        {/* Action CTA */}
                        <div className="sm:self-center shrink-0 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleLaunchDrill(item.subject as Subject, item.tosTopicId)}
                            className="px-3.5 py-1.5 rounded-lg bg-surface border border-border-base hover:border-warn text-text-muted hover:text-warn text-xs font-['Rajdhani'] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span>Drill {item.subject}</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-border-base bg-[#0d0d0d] flex items-center justify-between text-xs font-['Rajdhani'] text-text-muted">
              <span>Adaptive engine prioritizes these topics automatically during runs.</span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-surface border border-border-base hover:border-text-primary text-text-primary font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
