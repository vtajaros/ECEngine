import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  ArrowLeft,
  Timer,
  Flame,
  AlertTriangle,
  Info,
  Play,
  Check,
  Sparkles,
  Target,
  Zap,
  Layers,
  X,
} from 'lucide-react'
import type { Subject } from '../../types'
import {
  GAUNTLET_SUBJECTS,
  allocateCounts,
  isRatedRun,
  blendedPaceMs,
  paceSource,
  itemsPlanWarning,
  tightTimerWarning,
  getSurvivalDifficultyMultiplier,
  TUNING,
  overallRating,
  ratingTier,
  TIER_COLORS,
  type AllocationStrategy,
  type GauntletMode,
} from '../../lib/gauntlet'
import { SUBJECT_LINE_COLOR } from '../../lib/dashboardUtils'
import { ALL_TOS_TOPICS } from '../../lib/tosClassification'
import { gauntletService } from '../../services/gauntlet.service'
import {
  DEFAULT_CONFIG,
  useGauntletStore,
  type GauntletConfig,
} from '../../store/useGauntletStore'
import { Tooltip } from '../ui/Tooltip'
import { GauntletTopicModal } from './GauntletTopicModal'
import { GauntletRanksModal } from './GauntletRanksModal'

const loadConfigForMode = (mode: GauntletMode): GauntletConfig => {
  try {
    const raw =
      localStorage.getItem(`ecengine:gauntlet:config:${mode}`) ||
      localStorage.getItem('ecengine:gauntlet:config')
    if (raw) {
      const parsed = JSON.parse(raw)
      delete parsed.allowSolutions
      const tosTopicIds = Array.isArray(parsed.tosTopicIds)
        ? parsed.tosTopicIds
        : parsed.tosTopicId
          ? [parsed.tosTopicId]
          : []
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        mode,
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : DEFAULT_CONFIG.subjects,
        customCounts: parsed.customCounts ?? DEFAULT_CONFIG.customCounts,
        unlimitedItems: parsed.unlimitedItems ?? (mode === 'timed' ? true : false),
        tosTopicId: parsed.tosTopicId ?? null,
        tosTopicIds,
        durationSec: [300, 600, 1500, 3600].includes(parsed.durationSec) ? parsed.durationSec : 600,
        perQuestionSec: [30, 60, 120, 0].includes(parsed.perQuestionSec) ? parsed.perQuestionSec : 30,
        lives: [3, 5, 0].includes(parsed.lives) ? parsed.lives : 3,
      }
    }
  } catch {}
  return {
    ...DEFAULT_CONFIG,
    mode,
    unlimitedItems: mode === 'timed' ? true : false,
    tosTopicId: null,
    tosTopicIds: [],
    durationSec: 600,
    perQuestionSec: 30,
    lives: 3,
  }
}

const DURATION_PRESETS = [
  { label: '5m', sec: 5 * 60 },
  { label: '10m', sec: 10 * 60 },
  { label: '25m', sec: 25 * 60 },
  { label: '1 hr', sec: 60 * 60 },
]

export const GauntletSetup: React.FC = () => {
  const setupMode = useGauntletStore(s => s.setupMode) ?? 'timed'
  const setupPrefill = useGauntletStore(s => s.setupPrefill)
  const hub = useGauntletStore(s => s.hub)
  const phase = useGauntletStore(s => s.phase)
  const loadError = useGauntletStore(s => s.loadError)
  const closeSetup = useGauntletStore(s => s.closeSetup)
  const startRun = useGauntletStore(s => s.startRun)

  const [config, setConfig] = useState<GauntletConfig>(() => ({
    ...loadConfigForMode(setupMode),
    ...(setupPrefill ?? {}),
  }))
  const [dynamicPoolSizes, setDynamicPoolSizes] = useState<Record<Subject, number> | null>(null)
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false)
  const [isRanksOpen, setIsRanksOpen] = useState(false)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up click timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
    }
  }, [])

  // Apply prefill if updated from an external trigger (like Drill button)
  useEffect(() => {
    if (setupPrefill) {
      setConfig(prev => ({
        ...prev,
        ...setupPrefill,
      }))
    }
  }, [setupPrefill])

  // Persist config per mode
  useEffect(() => {
    try {
      const { allowSolutions: _, ...toSave } = config as any
      localStorage.setItem(`ecengine:gauntlet:config:${setupMode}`, JSON.stringify(toSave))
    } catch {}
  }, [config, setupMode])

  // Fetch dynamic pool sizes when topic filters change
  useEffect(() => {
    let isMounted = true
    const topicIds = config.tosTopicIds?.length
      ? config.tosTopicIds
      : config.tosTopicId
        ? [config.tosTopicId]
        : undefined

    gauntletService
      .getPoolSizes({
        tosTopicId: config.tosTopicId || undefined,
        tosTopicIds: topicIds,
      })
      .then(sizes => {
        if (isMounted) {
          setDynamicPoolSizes(sizes)
        }
      })
      .catch(() => {
        // Fallback gracefully to store hub data
      })
    return () => {
      isMounted = false
    }
  }, [config.tosTopicId, config.tosTopicIds])

  const poolSizes = dynamicPoolSizes ?? hub?.poolSizes ?? { MATH: 0, GEAS: 0, ELECS: 0, EST: 0 }
  const paceStats = hub?.pace ?? {}

  const ratings = hub?.ratings ?? {
    MATH: { rating: TUNING.startRating, answers: 0 },
    GEAS: { rating: TUNING.startRating, answers: 0 },
    ELECS: { rating: TUNING.startRating, answers: 0 },
    EST: { rating: TUNING.startRating, answers: 0 },
  }
  const overall = overallRating(ratings)

  const isSolo = config.subjects.length === 1
  const activeSubject = isSolo ? config.subjects[0] : null
  const activeRating = activeSubject
    ? (ratings[activeSubject]?.rating ?? TUNING.startRating)
    : overall.rating
  const isProvisional = activeSubject
    ? (ratings[activeSubject]?.answers ?? 0) < TUNING.provisionalAnswers
    : overall.provisional

  const currentTierInfo = ratingTier(activeRating)
  const tierColor = TIER_COLORS[currentTierInfo.name] ?? '#00FF41'

  let progressPercent = 100
  let pointsToNext: number | null = null
  if (currentTierInfo.next !== null) {
    const rangeSpan = currentTierInfo.next - currentTierInfo.floor
    const pointsGained = Math.max(0, activeRating - currentTierInfo.floor)
    progressPercent = Math.min(100, Math.max(0, Math.round((pointsGained / rangeSpan) * 100)))
    pointsToNext = Math.max(0, Math.ceil(currentTierInfo.next - activeRating))
  }

  const hasActiveTopics = (config.tosTopicIds && config.tosTopicIds.length > 0) || !!config.tosTopicId
  const selectedCount = (config.tosTopicIds && config.tosTopicIds.length > 0)
    ? config.tosTopicIds.length
    : config.tosTopicId ? 1 : 0

  // Single-click: solo that subject
  const soloSubject = (sub: Subject) => {
    setConfig(prev => {
      const nextTopicIds = (prev.tosTopicIds || []).filter(tid => {
        const found = ALL_TOS_TOPICS.find(t => t.id === tid)
        return found ? found.subject === sub : false
      })
      return {
        ...prev,
        subjects: [sub],
        tosTopicIds: nextTopicIds,
        tosTopicId: nextTopicIds[0] ?? null,
      }
    })
  }

  // Double-click: toggle/add subject to the pool
  const toggleSubject = (sub: Subject) => {
    setConfig(prev => {
      const exists = prev.subjects.includes(sub)
      let nextSubs: Subject[]
      if (exists) {
        if (prev.subjects.length <= 1) return prev // keep at least 1 subject
        nextSubs = prev.subjects.filter(s => s !== sub)
      } else {
        nextSubs = [...prev.subjects, sub]
      }
      const nextTopicIds = (prev.tosTopicIds || []).filter(tid => {
        const found = ALL_TOS_TOPICS.find(t => t.id === tid)
        return found ? nextSubs.includes(found.subject) : false
      })
      return {
        ...prev,
        subjects: nextSubs,
        tosTopicIds: nextTopicIds,
        tosTopicId: nextTopicIds[0] ?? null,
      }
    })
  }

  // Handle subject click with snappy 160ms debounce
  const handleSubjectClick = (sub: Subject) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
      toggleSubject(sub)
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null
        soloSubject(sub)
      }, 160)
    }
  }

  const handleApplyTopics = (topicIds: string[]) => {
    if (topicIds.length === 0) {
      setConfig(prev => ({
        ...prev,
        tosTopicIds: [],
        tosTopicId: null,
      }))
      return
    }

    const topicSubjects = new Set<Subject>()
    for (const tid of topicIds) {
      const found = ALL_TOS_TOPICS.find(t => t.id === tid)
      if (found) topicSubjects.add(found.subject)
    }
    const requiredSubjects = Array.from(topicSubjects)

    setConfig(prev => {
      const mergedSubs = Array.from(new Set([...prev.subjects, ...requiredSubjects]))
      return {
        ...prev,
        tosTopicIds: topicIds,
        tosTopicId: topicIds[0] ?? null,
        subjects: mergedSubs.length > 0 ? mergedSubs : prev.subjects,
      }
    })
  }

  // Derived counts for timed mode (used in fixed target mode)
  const previewCounts = useMemo(() => {
    if (setupMode !== 'timed' || config.unlimitedItems) return {}
    if (config.allocation === 'custom') return config.customCounts
    return allocateCounts(config.totalItems, config.subjects, config.allocation as AllocationStrategy)
  }, [setupMode, config.unlimitedItems, config.totalItems, config.subjects, config.allocation, config.customCounts])

  // Warnings (i) Pool exhaustion
  const poolWarnings = useMemo(() => {
    const warnings: string[] = []
    if (setupMode === 'timed' && !config.unlimitedItems) {
      for (const s of config.subjects) {
        const req = previewCounts[s] ?? 0
        const avail = poolSizes[s] ?? 0
        if (req > avail) {
          warnings.push(`${s}: requested ${req} exceeds pool (${avail})`)
        }
      }
    }
    for (const s of config.subjects) {
      const avail = poolSizes[s] ?? 0
      if (avail === 0) {
        warnings.push(`${s}: 0 cards available${hasActiveTopics ? ' in selected topics' : ''}`)
      }
    }
    return warnings
  }, [setupMode, config.unlimitedItems, config.subjects, hasActiveTopics, previewCounts, poolSizes])

  // Warnings (ii) Items plan warning for timed mode
  const planWarning = useMemo(() => {
    if (setupMode !== 'timed' || config.unlimitedItems || config.subjects.length === 0) return null
    const paceMs = blendedPaceMs(previewCounts, paceStats)
    const source = paceSource(config.subjects, paceStats)
    return itemsPlanWarning({
      durationSec: config.durationSec,
      totalItems: config.totalItems,
      paceMs,
      source,
    })
  }, [setupMode, config.unlimitedItems, config.durationSec, config.totalItems, config.subjects, previewCounts, paceStats])

  // Warnings (iii) Tight timer warning for survival mode
  const survivalTightWarning = useMemo(() => {
    if (setupMode !== 'survival' || config.subjects.length === 0) return null
    const dummyCounts: Partial<Record<Subject, number>> = Object.fromEntries(config.subjects.map(s => [s, 1]))
    const paceMs = blendedPaceMs(dummyCounts, paceStats)
    const isTight = tightTimerWarning({ perQuestionSec: config.perQuestionSec, paceMs })
    if (isTight) {
      return { paceSec: Math.round(paceMs / 1000) }
    }
    return null
  }, [setupMode, config.subjects, config.perQuestionSec, paceStats])

  const customTotal = useMemo(() => {
    if (config.allocation !== 'custom') return 0
    return config.subjects.reduce((sum, s) => sum + (config.customCounts[s] ?? 0), 0)
  }, [config.allocation, config.subjects, config.customCounts])

  const isCustomEmpty = setupMode === 'timed' && !config.unlimitedItems && config.allocation === 'custom' && customTotal === 0
  const noSubjects = config.subjects.length === 0
  const totalAvailable = config.subjects.reduce((sum, s) => sum + (poolSizes[s] ?? 0), 0)
  const isStartDisabled = phase === 'loading' || noSubjects || isCustomEmpty || totalAvailable === 0

  const handleStart = useCallback(() => {
    if (isStartDisabled) return
    const finalTotal =
      setupMode === 'timed'
        ? config.unlimitedItems
          ? 500
          : config.allocation === 'custom'
            ? customTotal
            : config.totalItems
        : config.totalItems
    void startRun({ ...config, mode: setupMode, totalItems: finalTotal })
  }, [isStartDisabled, setupMode, config, customTotal, startRun])

  // Enter starts, Esc goes back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeSetup()
      } else if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'SELECT')) {
          return
        }
        handleStart()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeSetup, handleStart])

  return (
    <div className="absolute inset-0 z-20 min-h-0 w-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Centered Setup Card (max-w ~720px) */}
      <div className="relative z-10 w-full max-w-[720px] bg-[#141414] border border-[#262626] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] p-5 sm:p-6 flex flex-col gap-4">
        {/* Header: Back arrow + Mode Icon & Title + Current Rank Pill with XP Meter */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-border-base/70 pb-3 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Tooltip content="Back to Mode Selection (Esc)" position="right">
              <button
                type="button"
                onClick={closeSetup}
                className="w-8 h-8 rounded-lg bg-surface border border-border-base hover:border-text-primary text-text-muted hover:text-white flex items-center justify-center transition-colors shrink-0"
              >
                <ArrowLeft size={16} />
              </button>
            </Tooltip>
            <div className="flex items-center gap-2 min-w-0">
              {setupMode === 'timed' ? (
                <Timer size={22} className="text-accent shrink-0" />
              ) : (
                <Flame size={22} className="text-[#ef4444] shrink-0" />
              )}
              <h2 className="font-['Orbitron'] font-bold text-base sm:text-lg text-text-primary uppercase tracking-wider truncate">
                {setupMode === 'timed' ? 'Time Trial Setup' : 'Survival Setup'}
              </h2>
            </div>
          </div>

          {/* Current Rank Pill with XP Meter (matches Gauntlet Home rankings button design) */}
          <Tooltip content="Click to view Elo Ranking Tiers" position="bottom">
            <button
              type="button"
              onClick={() => setIsRanksOpen(true)}
              className="bg-[#141414] border hover:border-accent rounded-xl px-2.5 sm:px-3 py-1.5 flex items-center gap-2 sm:gap-2.5 text-xs shrink-0 transition-all cursor-pointer group shadow-[0_0_12px_rgba(0,0,0,0.5)]"
              style={{
                borderColor: `${tierColor}55`,
                boxShadow: `0 0 12px ${tierColor}18`,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="font-['Orbitron'] font-bold text-[10px] sm:text-[11px] group-hover:underline"
                  style={{ color: tierColor }}
                >
                  {activeSubject ?? 'OVERALL'}
                </span>
                <span className="font-['JetBrains_Mono'] font-bold text-white text-xs sm:text-sm">
                  {Math.round(activeRating)}
                </span>
                <span
                  className="font-['Rajdhani'] font-bold text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded uppercase tracking-wider"
                  style={{
                    backgroundColor: `${tierColor}20`,
                    color: tierColor,
                    border: `1px solid ${tierColor}40`,
                  }}
                >
                  {currentTierInfo.name}
                </span>
                {isProvisional && (
                  <span className="text-[9px] font-['Rajdhani'] font-bold text-[#FFB800] uppercase tracking-wider">
                    PROV
                  </span>
                )}
              </div>

              {/* XP Meter to Next Rank */}
              {currentTierInfo.next !== null ? (
                <div className="flex flex-col gap-0.5 pl-2 border-l border-white/10 min-w-[70px] sm:min-w-[85px] text-left">
                  <div className="flex items-center justify-between text-[9px] font-['JetBrains_Mono'] text-text-muted leading-none">
                    <span className="text-[8px] uppercase tracking-wider">XP</span>
                    <span className="font-bold text-white">+{pointsToNext} pts</span>
                  </div>
                  <div className="w-full h-1.5 bg-black/70 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: tierColor,
                        boxShadow: `0 0 6px ${tierColor}`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="pl-2 border-l border-white/10 text-[9px] font-['Rajdhani'] font-bold text-[#C084FC] uppercase tracking-wider">
                  MAX RANK
                </div>
              )}
            </button>
          </Tooltip>
        </div>

        {/* Load Error alert */}
        {loadError && (
          <div className="p-2.5 rounded-lg bg-[#FF3333]/15 border border-[#FF3333]/40 text-[#FF3333] text-xs font-['JetBrains_Mono'] flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Common: Subjects selection with pool sizes */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
              Select Subjects
            </span>
            <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted hidden sm:inline">
              Single-click to solo · Double-click to combine
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {GAUNTLET_SUBJECTS.map(subject => {
              const selected = config.subjects.includes(subject)
              const color = SUBJECT_LINE_COLOR[subject]
              const pool = poolSizes[subject] ?? 0
              return (
                <button
                  key={subject}
                  type="button"
                  onClick={() => handleSubjectClick(subject)}
                  className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    selected
                      ? 'bg-surface-2'
                      : 'bg-surface/50 border-border-base opacity-60 hover:opacity-100'
                  }`}
                  style={
                    selected
                      ? {
                          border: `2px solid ${color}`,
                          boxShadow: `0 0 12px ${color}26`,
                        }
                      : undefined
                  }
                >
                  <div className="inline-flex items-center justify-center gap-1.5">
                    <span
                      className={`font-['Orbitron'] font-bold text-xs ${
                        selected ? '' : 'text-text-muted'
                      }`}
                      style={{ color: selected ? color : undefined }}
                    >
                      {subject}
                    </span>
                    {selected && <Check size={12} style={{ color }} />}
                  </div>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-text-muted mt-1">
                    {pool} available
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Topic Focus (Optional Category Drill-down) */}
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface/60 border border-border-base/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers size={13} className={hasActiveTopics ? 'text-accent' : 'text-text-muted'} />
              <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
                Topic Focus (Optional)
              </span>
            </div>
            {hasActiveTopics && (
              <button
                type="button"
                onClick={() => setConfig(c => ({ ...c, tosTopicId: null, tosTopicIds: [] }))}
                className="text-[10px] font-['JetBrains_Mono'] text-accent hover:underline flex items-center gap-1 transition-colors cursor-pointer"
              >
                <X size={10} /> Clear Filter (All Topics)
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface-2 border border-border-base">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  hasActiveTopics
                    ? 'bg-accent animate-pulse shadow-[0_0_8px_#00FF41]'
                    : 'bg-[#555]'
                }`}
              />
              <div className="flex flex-col min-w-0">
                <span className="font-['Orbitron'] font-bold text-xs text-text-primary truncate">
                  {hasActiveTopics
                    ? `${selectedCount} ${selectedCount === 1 ? 'Topic Selected' : 'Topics Selected'}`
                    : 'All Topics (Comprehensive Pool)'}
                </span>
                <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted truncate">
                  {hasActiveTopics
                    ? 'Questions will be sampled exclusively from chosen topics'
                    : 'Random pool across all syllabus chapters'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsTopicModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-surface border border-border-base hover:border-accent hover:text-white text-text-muted font-['Rajdhani'] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
            >
              <Layers size={13} />
              {hasActiveTopics ? 'Edit Topics' : 'Filter Topics'}
            </button>
          </div>

          {/* Selected Topic Badges Preview */}
          {hasActiveTopics && (
            <div className="flex flex-wrap gap-1.5 mt-0.5 max-h-16 overflow-y-auto">
              {(config.tosTopicIds || []).map(tid => {
                const topic = ALL_TOS_TOPICS.find(t => t.id === tid)
                if (!topic) return null
                return (
                  <span
                    key={tid}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] bg-surface border border-accent/30 text-text-primary"
                  >
                    <span className="text-accent font-bold">{topic.code}</span>
                    <span className="truncate max-w-[140px]">{topic.title}</span>
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Mode-Specific Settings */}
        {setupMode === 'timed' ? (
          <div className="flex flex-col gap-4">
            {/* Duration Presets */}
            <div className="flex flex-col gap-1.5">
              <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
                Session Duration
              </span>
              <div className="grid grid-cols-4 gap-2">
                {DURATION_PRESETS.map(preset => {
                  const active = config.durationSec === preset.sec
                  return (
                    <button
                      key={preset.sec}
                      type="button"
                      onClick={() => setConfig(c => ({ ...c, durationSec: preset.sec }))}
                      className={`py-2 rounded-lg font-['Orbitron'] font-bold text-xs transition-colors cursor-pointer ${
                        active
                          ? 'bg-accent text-black shadow'
                          : 'bg-surface-2 border border-border-base text-text-muted hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Question Mode: Unlimited Sprint vs Fixed Target */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
                  Question Mode
                </span>
                <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted">
                  {config.unlimitedItems ? 'Continuous streaming' : 'Custom question cap'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, unlimitedItems: true }))}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                    config.unlimitedItems
                      ? 'bg-accent/15 border-accent text-accent shadow-[0_0_15px_rgba(0,255,65,0.2)]'
                      : 'bg-surface-2 border-border-base text-text-muted hover:text-white'
                  }`}
                >
                  <Sparkles size={14} className={config.unlimitedItems ? 'text-accent' : 'text-text-muted'} />
                  <span className="font-['Orbitron'] font-bold text-xs">UNLIMITED SPRINT</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, unlimitedItems: false }))}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                    !config.unlimitedItems
                      ? 'bg-accent/15 border-accent text-accent shadow-[0_0_15px_rgba(0,255,65,0.2)]'
                      : 'bg-surface-2 border-border-base text-text-muted hover:text-white'
                  }`}
                >
                  <Target size={14} className={!config.unlimitedItems ? 'text-accent' : 'text-text-muted'} />
                  <span className="font-['Orbitron'] font-bold text-xs">FIXED TARGET</span>
                </button>
              </div>

              {config.unlimitedItems ? (
                <div className="p-3 rounded-xl bg-surface border border-accent/30 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                      <Zap size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-['Rajdhani'] font-bold text-xs text-text-primary uppercase tracking-wider">
                        Continuous Question Flow
                      </span>
                      <span className="text-[11px] font-['JetBrains_Mono'] text-text-muted">
                        Answer as fast as you can until the {Math.round(config.durationSec / 60)}m clock expires. Questions refill dynamically.
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded bg-accent/10 border border-accent/30 text-accent font-['Orbitron'] font-bold text-[10px] uppercase tracking-wider shrink-0">
                    CONTINUOUS
                  </span>
                </div>
              ) : (
                /* Fixed Target mode: Total Items & Quick buttons */
                <div className="flex flex-col gap-3 p-3 rounded-xl bg-surface-2/40 border border-border-base/70">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
                        Total Questions
                      </span>
                      <div className="flex items-center gap-1.5">
                        {[50, 100, 150].map(cnt => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setConfig(c => ({ ...c, totalItems: cnt }))}
                            className={`px-2 py-0.5 rounded text-[11px] font-['JetBrains_Mono'] border transition-colors ${
                              config.totalItems === cnt && config.allocation !== 'custom'
                                ? 'bg-accent/20 border-accent text-accent'
                                : 'bg-surface border-border-base text-text-muted hover:text-white'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {config.allocation !== 'custom' && (
                      <input
                        type="range"
                        min={10}
                        max={250}
                        step={5}
                        value={config.totalItems}
                        onChange={e => setConfig(c => ({ ...c, totalItems: Number(e.target.value) }))}
                        className="w-full accent-accent h-1.5 bg-surface-2 rounded-lg cursor-pointer"
                      />
                    )}

                    {/* Warnings (ii): Items Plan Warning */}
                    {planWarning && (
                      <div className="mt-1 p-2.5 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] text-xs font-['JetBrains_Mono'] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={14} className="shrink-0" />
                          <span>
                            {planWarning.kind === 'too-many'
                              ? `At ~${planWarning.paceSec}s per item (${
                                  planWarning.source === 'observed' ? 'your pace' : 'estimated pace'
                                }) about ${planWarning.capacity} items fit in ${Math.round(
                                  config.durationSec / 60,
                                )} min. ${config.totalItems} is likely more than you can finish.`
                              : `${config.totalItems} items may run out with ~${planWarning.leftMin} min left.`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfig(c => ({ ...c, totalItems: planWarning.suggested }))}
                          className="px-2 py-1 rounded bg-[#FFB800] text-black font-['Rajdhani'] font-bold text-xs uppercase tracking-wider shrink-0 hover:bg-[#e6a600] transition-colors"
                        >
                          Set to {planWarning.suggested}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Allocation Strategy: EVEN | TOS-WEIGHTED | CUSTOM with inline preview */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
                      Item Allocation
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {(['even', 'tos', 'custom'] as const).map(strat => {
                        const active = config.allocation === strat
                        const labels = { even: 'EVEN', tos: 'TOS-WEIGHTED', custom: 'CUSTOM' }
                        return (
                          <button
                            key={strat}
                            type="button"
                            onClick={() => setConfig(c => ({ ...c, allocation: strat }))}
                            className={`py-1.5 rounded-lg font-['Orbitron'] font-bold text-xs tracking-wider transition-colors ${
                              active
                                ? 'bg-accent text-black shadow'
                                : 'bg-surface-2 border border-border-base text-text-muted hover:text-white'
                            }`}
                          >
                            {labels[strat]}
                          </button>
                        )
                      })}
                    </div>

                    {/* Inline Allocation Preview or Custom Steppers */}
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {config.subjects.map(s => {
                        const count = previewCounts[s] ?? 0
                        return (
                          <div
                            key={s}
                            className="p-2 rounded-lg bg-surface border border-border-base flex items-center justify-between text-xs"
                          >
                            <span className="font-['Orbitron'] font-bold text-[11px] text-text-muted">
                              {s}
                            </span>
                            {config.allocation === 'custom' ? (
                              <input
                                type="number"
                                min={0}
                                max={200}
                                value={config.customCounts[s] ?? 0}
                                onChange={e => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0)
                                  setConfig(c => ({
                                    ...c,
                                    customCounts: { ...c.customCounts, [s]: val },
                                  }))
                                }}
                                className="w-12 text-right bg-surface-2 border border-border-base rounded px-1.5 py-0.5 text-text-primary font-['JetBrains_Mono'] text-xs focus:border-accent outline-none"
                              />
                            ) : (
                              <span className="font-['JetBrains_Mono'] font-bold text-text-primary">
                                {count}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Survival Mode Settings */
          <div className="flex flex-col gap-4">
            {/* Lives: 3 / 5 / Unlimited */}
            <div className="flex flex-col gap-1.5">
              <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
                Starting Lives
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { lives: 3, label: '3 LIVES' },
                  { lives: 5, label: '5 LIVES' },
                  { lives: 0, label: 'UNLIMITED' },
                ].map(({ lives, label }) => {
                  const active = config.lives === lives
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setConfig(c => ({ ...c, lives }))}
                      className={`py-3 rounded-xl font-['Orbitron'] font-bold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                        active
                          ? 'bg-[#ef4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                          : 'bg-surface-2 border border-border-base text-text-muted hover:text-white'
                      }`}
                    >
                      <Flame size={15} fill="currentColor" />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Per-Question Limit: 30s, 1m, 2m, Unlimited */}
            <div className="flex flex-col gap-1.5">
              <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
                Per-Question Time Limit
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { sec: 30, label: '30 SECONDS' },
                  { sec: 60, label: '1 MINUTE' },
                  { sec: 120, label: '2 MINUTES' },
                  { sec: 0, label: 'UNLIMITED' },
                ].map(({ sec, label }) => {
                  const active = config.perQuestionSec === sec
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setConfig(c => ({ ...c, perQuestionSec: sec }))}
                      className={`py-2 rounded-lg font-['Orbitron'] font-bold text-xs transition-colors cursor-pointer ${
                        active
                          ? 'bg-accent text-black shadow'
                          : 'bg-surface-2 border border-border-base text-text-muted hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Difficulty Multiplier Info */}
              {(() => {
                const diff = getSurvivalDifficultyMultiplier(config.perQuestionSec, config.lives)
                return (
                  <div className="mt-1 px-3 py-1.5 rounded-lg bg-surface-2 border border-border-base flex items-center justify-between text-xs font-['JetBrains_Mono']">
                    <span className="text-text-muted">DIFFICULTY MULTIPLIER</span>
                    {diff.isUnlimited ? (
                      <span className="text-accent font-bold">
                        Score: 0.08x • Rating: ±1 (Accuracy Mode)
                      </span>
                    ) : (
                      <span className="text-accent font-bold">
                        Score & Rating: {diff.scoreMult}x
                      </span>
                    )}
                  </div>
                )
              })()}

              {/* Warnings (iii): Tight timer warning */}
              {survivalTightWarning && config.perQuestionSec > 0 && (
                <div className="mt-1 p-2 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] text-xs font-['JetBrains_Mono'] flex items-center gap-2">
                  <Info size={14} className="shrink-0" />
                  <span>
                    The per-question timer is tighter than your usual pace (~{survivalTightWarning.paceSec}s).
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Warnings (i): Pool Exhaustion */}
        {poolWarnings.length > 0 && (
          <div className="p-2 rounded-lg bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFB800] text-xs font-['JetBrains_Mono'] flex flex-col gap-1">
            {poolWarnings.map((w, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <AlertTriangle size={13} />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Row: Toggles (RATED & SOLUTIONS) + START button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border-base/70 mt-1">
          <div className="flex items-center gap-6">
            {/* RATED toggle with one-line helper */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfig(c => ({ ...c, rated: !c.rated }))}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                  config.rated ? 'bg-accent' : 'bg-surface-2 border border-border-base'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform ${
                    config.rated ? 'translate-x-5 bg-black' : 'translate-x-0 bg-text-muted'
                  }`}
                />
              </button>
              <div className="flex flex-col">
                <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
                  {hasActiveTopics ? 'Ranked (0.4x Scale)' : 'Ranked'}
                </span>
                <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted">
                  {config.rated
                    ? hasActiveTopics
                      ? 'Topic focused: 0.4x Elo rating adjustment'
                      : isRatedRun({ subjects: config.subjects })
                        ? 'Counts toward subject Elo ratings'
                        : 'Unranked: select all subjects'
                    : 'Unranked: ratings unchanged'}
                </span>
              </div>
            </div>
          </div>

          {/* START button (accent, black bold text) */}
          <button
            type="button"
            onClick={handleStart}
            disabled={isStartDisabled}
            className={`px-8 py-3 rounded-xl font-['Orbitron'] font-bold text-sm uppercase tracking-wider flex items-center gap-2 transition-all ${
              isStartDisabled
                ? 'bg-surface-2 text-text-muted cursor-not-allowed border border-border-base'
                : 'bg-accent text-black hover:bg-[#00e63a] shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)] cursor-pointer'
            }`}
          >
            <Play size={16} fill="currentColor" />
            START
          </button>
        </div>
      </div>

      <GauntletTopicModal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        selectedTopicIds={config.tosTopicIds || []}
        onApply={handleApplyTopics}
        activeSubjects={config.subjects}
      />

      <GauntletRanksModal
        isOpen={isRanksOpen}
        onClose={() => setIsRanksOpen(false)}
        overallRating={activeRating}
        isProvisional={isProvisional}
        subjectName={activeSubject ?? undefined}
      />
    </div>
  )
}
