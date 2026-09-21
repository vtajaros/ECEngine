import React, { useState, useEffect, useMemo } from 'react'
import { Subject } from '../../types'
import {
  GAUNTLET_SUBJECTS,
  allocateCounts,
  isRatedRun,
  type AllocationStrategy,
} from '../../lib/gauntlet'
import {
  DEFAULT_CONFIG,
  useGauntletStore,
  type GauntletConfig,
} from '../../store/useGauntletStore'
import { Play, Timer, Flame, AlertTriangle, Info } from 'lucide-react'

const STORAGE_KEY = 'ecengine:gauntlet:config'

const loadInitialConfig = (): GauntletConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : DEFAULT_CONFIG.subjects,
        customCounts: parsed.customCounts ?? {},
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_CONFIG
}

export const SetupPanel: React.FC = () => {
  const phase = useGauntletStore(s => s.phase)
  const hub = useGauntletStore(s => s.hub)
  const startRun = useGauntletStore(s => s.startRun)

  const [config, setConfig] = useState<GauntletConfig>(loadInitialConfig)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      // storage unavailable
    }
  }, [config])

  const poolSizes = hub?.poolSizes ?? { MATH: 0, GEAS: 0, ELECS: 0, EST: 0 }

  const toggleSubject = (sub: Subject) => {
    setConfig(prev => {
      const exists = prev.subjects.includes(sub)
      const nextSubs = exists
        ? prev.subjects.filter(s => s !== sub)
        : [...prev.subjects, sub]
      return { ...prev, subjects: nextSubs }
    })
  }

  // Derived allocated counts for Timed mode preview
  const previewCounts = useMemo(() => {
    if (config.mode !== 'timed') return {}
    if (config.allocation === 'custom') return config.customCounts
    return allocateCounts(config.totalItems, config.subjects, config.allocation as AllocationStrategy)
  }, [config.mode, config.totalItems, config.subjects, config.allocation, config.customCounts])

  // Check if any requested subject exceeds pool size
  const poolWarnings = useMemo(() => {
    const warnings: string[] = []
    if (config.mode === 'timed') {
      for (const s of config.subjects) {
        const req = previewCounts[s] ?? 0
        const avail = poolSizes[s] ?? 0
        if (req > avail) {
          warnings.push(`${s}: requested ${req} exceeds pool (${avail})`)
        }
      }
    }
    return warnings
  }, [config.mode, config.subjects, previewCounts, poolSizes])

  const customTotal = useMemo(() => {
    if (config.allocation !== 'custom') return 0
    return config.subjects.reduce((sum, s) => sum + (config.customCounts[s] ?? 0), 0)
  }, [config.allocation, config.subjects, config.customCounts])

  const isCustomEmpty = config.mode === 'timed' && config.allocation === 'custom' && customTotal === 0
  const noSubjects = config.subjects.length === 0
  const isStartDisabled = phase === 'loading' || noSubjects || isCustomEmpty

  const meetsRatedCriteria = isRatedRun({ subjects: config.subjects })

  return (
    <div className="bg-surface rounded-xl p-3 border border-border-base flex flex-col justify-between h-full min-h-0 gap-2.5">
      {/* Row A: Mode Tabs (compact, h-9) */}
      <div className="flex bg-surface-2 p-0.5 rounded-lg border border-border-base h-9 shrink-0">
        <button
          type="button"
          onClick={() => setConfig(c => ({ ...c, mode: 'timed' }))}
          className={`flex-1 rounded font-['Rajdhani'] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
            config.mode === 'timed'
              ? 'bg-accent text-black font-bold shadow'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Timer size={13} />
          Timed Run
        </button>
        <button
          type="button"
          onClick={() => setConfig(c => ({ ...c, mode: 'survival' }))}
          className={`flex-1 rounded font-['Rajdhani'] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
            config.mode === 'survival'
              ? 'bg-accent text-black font-bold shadow'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <Flame size={13} />
          Survival Mode
        </button>
      </div>

      {/* Row B: Subject Chips (4 equal columns, height ~48px) */}
      <div className="flex flex-col gap-1 shrink-0">
        <div className="flex items-center justify-between text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted">
          <span>SUBJECTS INCLUDED</span>
          <span className="text-text-muted font-normal normal-case flex items-center gap-1">
            <Info size={10} /> Problem-solving items excluded
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {GAUNTLET_SUBJECTS.map(subject => {
            const isSelected = config.subjects.includes(subject)
            const pool = poolSizes[subject] ?? 0

            const selectedStyle =
              subject === 'MATH'
                ? 'bg-[#f59e0b] text-black font-bold border-[#f59e0b]'
                : subject === 'GEAS'
                ? 'bg-[#3b82f6] text-white font-bold border-[#3b82f6]'
                : subject === 'ELECS'
                ? 'bg-[#ef4444] text-white font-bold border-[#ef4444]'
                : 'bg-[#22c55e] text-black font-bold border-[#22c55e]'

            const unselectedStyle =
              subject === 'MATH'
                ? 'bg-surface-2 text-[#f59e0b] border-border-base hover:border-[#f59e0b]'
                : subject === 'GEAS'
                ? 'bg-surface-2 text-[#3b82f6] border-border-base hover:border-[#3b82f6]'
                : subject === 'ELECS'
                ? 'bg-surface-2 text-[#ef4444] border-border-base hover:border-[#ef4444]'
                : 'bg-surface-2 text-[#22c55e] border-border-base hover:border-[#22c55e]'

            return (
              <button
                key={subject}
                type="button"
                onClick={() => toggleSubject(subject)}
                className={`h-12 px-2 py-1 rounded-lg border text-left transition-all flex flex-col justify-center leading-tight ${
                  isSelected ? selectedStyle : unselectedStyle
                }`}
              >
                <span className="font-['Orbitron'] text-xs font-bold tracking-wider leading-none">
                  {subject}
                </span>
                <span className={`text-[10px] font-['JetBrains_Mono'] mt-1 leading-none ${isSelected ? 'opacity-90' : 'text-text-muted'}`}>
                  {pool.toLocaleString()} items
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Row C & D for Timed OR Row C for Survival */}
      {config.mode === 'timed' ? (
        <div className="flex flex-col gap-2 shrink-0">
          {/* Row C: 2-column grid (Duration + Total Items) */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Left: Duration */}
            <div>
              <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted block mb-1">
                RUN DURATION
              </span>
              <div className="flex gap-1 h-8">
                {[5, 10, 15, 20, 30].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setConfig(c => ({ ...c, durationSec: mins * 60 }))}
                    className={`flex-1 rounded border text-xs font-['JetBrains_Mono'] font-bold transition-colors ${
                      config.durationSec === mins * 60
                        ? 'bg-accent text-black border-accent'
                        : 'bg-surface-2 text-text-muted border-border-base hover:text-text-primary'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Total Items */}
            <div>
              <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted block mb-1">
                TOTAL ITEMS
              </span>
              <div className="flex items-center gap-1.5 h-8">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={config.totalItems}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val)) setConfig(c => ({ ...c, totalItems: val }))
                  }}
                  className="w-16 h-8 bg-surface-2 border border-border-base rounded px-2 text-xs font-['JetBrains_Mono'] text-text-primary focus:outline-none focus:border-accent text-center"
                />
                <div className="flex flex-1 gap-1 h-8">
                  {[50, 100, 150].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setConfig(c => ({ ...c, totalItems: n }))}
                      className={`flex-1 rounded border text-[11px] font-['JetBrains_Mono'] transition-colors ${
                        config.totalItems === n
                          ? 'bg-surface border-accent text-accent font-bold'
                          : 'bg-surface-2 text-text-muted border-border-base hover:text-text-primary'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row D: Allocation segmented control + Live preview on same row */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted block">
              ITEM ALLOCATION
            </span>
            <div className="flex items-center gap-2 h-8">
              {/* Segmented control (~60% width) */}
              <div className="flex bg-surface-2 p-0.5 rounded-lg border border-border-base h-8 w-[60%] shrink-0">
                {(['tos', 'even', 'custom'] as const).map(alloc => (
                  <button
                    key={alloc}
                    type="button"
                    onClick={() => setConfig(c => ({ ...c, allocation: alloc }))}
                    className={`flex-1 rounded text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider transition-colors ${
                      config.allocation === alloc
                        ? 'bg-accent text-black font-bold shadow'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {alloc === 'tos' ? 'TOS-Weighted' : alloc === 'even' ? 'Even' : 'Custom'}
                  </button>
                ))}
              </div>

              {/* Live Preview on same row */}
              {config.allocation !== 'custom' && (
                <div className="flex-1 flex items-center justify-end gap-1.5 text-[10px] font-['JetBrains_Mono'] text-text-muted overflow-hidden truncate">
                  <span className="text-text-muted">Preview:</span>
                  {config.subjects.map(s => (
                    <span key={s} className="truncate">
                      {s}:<strong className="text-accent">{previewCounts[s] ?? 0}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Custom inputs on 2nd line if CUSTOM is selected */}
            {config.allocation === 'custom' && (
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {config.subjects.map(s => (
                  <div key={s} className="flex items-center gap-1 bg-surface-2 px-1.5 py-1 rounded border border-border-base">
                    <span className="text-[10px] font-['Orbitron'] font-bold text-text-muted">{s}</span>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={config.customCounts[s] ?? 0}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                        setConfig(c => ({
                          ...c,
                          customCounts: { ...c.customCounts, [s]: val },
                        }))
                      }}
                      className="w-full bg-surface border border-border-base rounded px-1 py-0.5 text-xs font-['JetBrains_Mono'] text-text-primary text-right focus:outline-none focus:border-accent"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Pool warnings info line */}
            {poolWarnings.length > 0 && (
              <div className="flex items-center gap-1 text-[#FFB800] text-[10px] font-['JetBrains_Mono'] truncate pt-0.5">
                <AlertTriangle size={11} className="shrink-0" />
                <span className="truncate">{poolWarnings.join(' • ')}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Survival Row C: Lives + Per-Question Limit side-by-side */
        <div className="grid grid-cols-2 gap-2.5 shrink-0">
          <div>
            <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted block mb-1">
              LIVES
            </span>
            <div className="flex gap-1.5 h-8">
              {[3, 5, 10].map(lives => (
                <button
                  key={lives}
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, lives }))}
                  className={`flex-1 rounded border text-xs font-['JetBrains_Mono'] font-bold transition-colors ${
                    config.lives === lives
                      ? 'bg-accent text-black border-accent'
                      : 'bg-surface-2 text-text-muted border-border-base hover:text-text-primary'
                  }`}
                >
                  {lives} Lives
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted block mb-1">
              PER-QUESTION LIMIT
            </span>
            <div className="flex gap-1 h-8">
              {[
                { sec: 20, label: '20s' },
                { sec: 30, label: '30s' },
                { sec: 45, label: '45s' },
                { sec: 60, label: '60s' },
                { sec: 120, label: '2m' },
                { sec: 0, label: '∞' },
              ].map(({ sec, label }) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setConfig(c => ({ ...c, perQuestionSec: sec }))}
                  className={`flex-1 rounded border text-xs font-['JetBrains_Mono'] font-bold transition-colors ${
                    config.perQuestionSec === sec
                      ? 'bg-accent text-black border-accent'
                      : 'bg-surface-2 text-text-muted border-border-base hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Last Row: Rated toggle on left, START button on right in SAME row */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border-base/60 shrink-0 mt-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfig(c => ({ ...c, rated: !c.rated }))}
            className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
              config.rated ? 'bg-accent' : 'bg-surface-2 border border-border-base'
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-black transition-transform ${
                config.rated ? 'translate-x-3.5' : 'translate-x-0 bg-gray-400'
              }`}
            />
          </button>
          <div className="flex flex-col">
            <span className="text-[11px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-primary leading-tight">
              Ranked
            </span>
            <span className="text-[9px] text-text-muted leading-tight">
              {meetsRatedCriteria ? 'Updates per-subject ratings' : 'Requires all 4 subjects'}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={isStartDisabled}
          onClick={() => startRun(config)}
          className="h-11 px-6 rounded-xl bg-accent text-black font-bold font-['Orbitron'] tracking-wider text-sm hover:bg-[#00e63a] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2 shrink-0"
        >
          <Play size={15} fill="currentColor" />
          {phase === 'loading' ? 'Building queue…' : 'START GAUNTLET'}
        </button>
      </div>
    </div>
  )
}
