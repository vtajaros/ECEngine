import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { ArrowLeft, Timer, Flame, AlertTriangle, Info, Play, Check } from 'lucide-react'
import type { Subject } from '../../types'
import {
  GAUNTLET_SUBJECTS,
  allocateCounts,
  isRatedRun,
  blendedPaceMs,
  paceSource,
  itemsPlanWarning,
  tightTimerWarning,
  type AllocationStrategy,
  type GauntletMode,
} from '../../lib/gauntlet'
import { SUBJECT_LINE_COLOR } from '../../lib/dashboardUtils'
import {
  DEFAULT_CONFIG,
  useGauntletStore,
  type GauntletConfig,
} from '../../store/useGauntletStore'
import { GauntletBackdrop } from './GauntletBackdrop'

const loadConfigForMode = (mode: GauntletMode): GauntletConfig => {
  try {
    const raw =
      localStorage.getItem(`ecengine:gauntlet:config:${mode}`) ||
      localStorage.getItem('ecengine:gauntlet:config')
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        mode,
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : DEFAULT_CONFIG.subjects,
        customCounts: parsed.customCounts ?? DEFAULT_CONFIG.customCounts,
      }
    }
  } catch {}
  return { ...DEFAULT_CONFIG, mode }
}

const DURATION_PRESETS = [
  { label: '5m', sec: 5 * 60 },
  { label: '10m', sec: 10 * 60 },
  { label: '15m', sec: 15 * 60 },
  { label: '20m', sec: 20 * 60 },
  { label: '30m', sec: 30 * 60 },
]

export const GauntletSetup: React.FC = () => {
  const setupMode = useGauntletStore(s => s.setupMode) ?? 'timed'
  const hub = useGauntletStore(s => s.hub)
  const phase = useGauntletStore(s => s.phase)
  const loadError = useGauntletStore(s => s.loadError)
  const closeSetup = useGauntletStore(s => s.closeSetup)
  const startRun = useGauntletStore(s => s.startRun)

  const [config, setConfig] = useState<GauntletConfig>(() => loadConfigForMode(setupMode))

  // Persist config per mode
  useEffect(() => {
    try {
      localStorage.setItem(`ecengine:gauntlet:config:${setupMode}`, JSON.stringify(config))
    } catch {}
  }, [config, setupMode])

  const poolSizes = hub?.poolSizes ?? { MATH: 0, GEAS: 0, ELECS: 0, EST: 0 }
  const paceStats = hub?.pace ?? {}

  const toggleSubject = (sub: Subject) => {
    setConfig(prev => {
      const exists = prev.subjects.includes(sub)
      const nextSubs = exists ? prev.subjects.filter(s => s !== sub) : [...prev.subjects, sub]
      return { ...prev, subjects: nextSubs }
    })
  }

  // Derived counts for timed mode
  const previewCounts = useMemo(() => {
    if (setupMode !== 'timed') return {}
    if (config.allocation === 'custom') return config.customCounts
    return allocateCounts(config.totalItems, config.subjects, config.allocation as AllocationStrategy)
  }, [setupMode, config.totalItems, config.subjects, config.allocation, config.customCounts])

  // Warnings (i) Pool exhaustion
  const poolWarnings = useMemo(() => {
    const warnings: string[] = []
    if (setupMode === 'timed') {
      for (const s of config.subjects) {
        const req = previewCounts[s] ?? 0
        const avail = poolSizes[s] ?? 0
        if (req > avail) {
          warnings.push(`${s}: requested ${req} exceeds pool (${avail})`)
        }
      }
    }
    return warnings
  }, [setupMode, config.subjects, previewCounts, poolSizes])

  // Warnings (ii) Items plan warning for timed mode
  const planWarning = useMemo(() => {
    if (setupMode !== 'timed' || config.subjects.length === 0) return null
    const paceMs = blendedPaceMs(previewCounts, paceStats)
    const source = paceSource(config.subjects, paceStats)
    return itemsPlanWarning({
      durationSec: config.durationSec,
      totalItems: config.totalItems,
      paceMs,
      source,
    })
  }, [setupMode, config.durationSec, config.totalItems, config.subjects, previewCounts, paceStats])

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

  const isCustomEmpty = setupMode === 'timed' && config.allocation === 'custom' && customTotal === 0
  const noSubjects = config.subjects.length === 0
  const isStartDisabled = phase === 'loading' || noSubjects || isCustomEmpty

  const handleStart = useCallback(() => {
    if (isStartDisabled) return
    const finalTotal = setupMode === 'timed' && config.allocation === 'custom' ? customTotal : config.totalItems
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
        if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON')) {
          // let normal button activation or input work
        }
        handleStart()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeSetup, handleStart])

  return (
    <div className="absolute inset-0 z-20 min-h-0 w-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-[#0D0D0D]">
      {/* Dimmed Cyber Backdrop */}
      <GauntletBackdrop dimmed />

      {/* Centered Setup Card (max-w ~720px) */}
      <div className="relative z-10 w-full max-w-[720px] bg-[#141414] border border-[#262626] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] p-5 sm:p-6 flex flex-col gap-4">
        {/* Header: Back arrow + Mode Icon & Title */}
        <div className="flex items-center justify-between border-b border-border-base/70 pb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeSetup}
              className="w-8 h-8 rounded-lg bg-surface border border-border-base hover:border-text-primary text-text-muted hover:text-white flex items-center justify-center transition-colors"
              title="Back to Mode Selection (Esc)"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              {setupMode === 'timed' ? (
                <Timer size={22} className="text-accent" />
              ) : (
                <Flame size={22} className="text-[#ef4444]" />
              )}
              <h2 className="font-['Orbitron'] font-bold text-lg text-text-primary uppercase tracking-wider">
                {setupMode === 'timed' ? 'Time Trial Setup' : 'Survival Setup'}
              </h2>
            </div>
          </div>
          <span className="text-[11px] font-['Rajdhani'] font-bold text-text-muted uppercase tracking-wider hidden sm:block">
            {setupMode === 'timed' ? 'Race the Clock' : 'Beat the Timer'}
          </span>
        </div>

        {/* Load Error alert */}
        {loadError && (
          <div className="p-2.5 rounded-lg bg-[#FF3333]/15 border border-[#FF3333]/40 text-[#FF3333] text-xs font-['JetBrains_Mono'] flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Common: Subjects selection with pool sizes & problem-solving note */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
              Select Subjects
            </span>
            <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted">
              (Problem-solving items excluded)
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
                  onClick={() => toggleSubject(subject)}
                  className={`p-2 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all ${
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

        {/* Mode-Specific Settings */}
        {setupMode === 'timed' ? (
          <div className="flex flex-col gap-4">
            {/* Duration Presets */}
            <div className="flex flex-col gap-1.5">
              <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
                Session Duration
              </span>
              <div className="grid grid-cols-5 gap-2">
                {DURATION_PRESETS.map(preset => {
                  const active = config.durationSec === preset.sec
                  return (
                    <button
                      key={preset.sec}
                      type="button"
                      onClick={() => setConfig(c => ({ ...c, durationSec: preset.sec }))}
                      className={`py-2 rounded-lg font-['Orbitron'] font-bold text-xs transition-colors ${
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

            {/* Total Items & Quick buttons */}
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
        ) : (
          /* Survival Mode Settings */
          <div className="flex flex-col gap-4">
            {/* Lives: 3 / 5 */}
            <div className="flex flex-col gap-1.5">
              <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
                Starting Lives
              </span>
              <div className="grid grid-cols-2 gap-3">
                {[3, 5].map(lives => {
                  const active = config.lives === lives
                  return (
                    <button
                      key={lives}
                      type="button"
                      onClick={() => setConfig(c => ({ ...c, lives }))}
                      className={`py-3 rounded-xl font-['Orbitron'] font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-all ${
                        active
                          ? 'bg-[#ef4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                          : 'bg-surface-2 border border-border-base text-text-muted hover:text-white'
                      }`}
                    >
                      <Flame size={16} fill="currentColor" />
                      {lives} LIVES
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Per-Question Limit: 15 / 30 / 60 s */}
            <div className="flex flex-col gap-1.5">
              <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-text-primary">
                Per-Question Time Limit
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[15, 30, 60].map(sec => {
                  const active = config.perQuestionSec === sec
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setConfig(c => ({ ...c, perQuestionSec: sec }))}
                      className={`py-2 rounded-lg font-['Orbitron'] font-bold text-xs transition-colors ${
                        active
                          ? 'bg-accent text-black shadow'
                          : 'bg-surface-2 border border-border-base text-text-muted hover:text-white'
                      }`}
                    >
                      {sec} SECONDS
                    </button>
                  )
                })}
              </div>

              {/* Warnings (iii): Tight timer warning */}
              {survivalTightWarning && (
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

        {/* Bottom Row: RATED toggle + START button */}
        <div className="flex items-center justify-between pt-3 border-t border-border-base/70 mt-1">
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
                Rated Run
              </span>
              <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted">
                {config.rated
                  ? isRatedRun({ subjects: config.subjects })
                    ? 'Counts toward subject Elo ratings'
                    : 'Unrated: select all subjects without filters'
                  : 'Practice run: ratings unchanged'}
              </span>
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
    </div>
  )
}
