import React, { useMemo, useEffect } from 'react'
import { BookOpen, Compass, AlertTriangle, CheckCircle } from 'lucide-react'
import { useDataLabStore } from '../../../../store/useDataLabStore'
import { SUBJECT_LINE_COLOR } from '../../../../lib/dashboardUtils'
import { TOC_DATA } from '../../../toc/data'

function getTopicName(id: string): string {
  for (const s of TOC_DATA) {
    for (const t of s.topics) {
      if (t.id === id) return `${t.id} - ${t.name}`
      for (const st of t.subtopics) {
        if (st.id === id) return `${st.id} - ${st.name}`
      }
    }
  }
  return id
}

export function GauntletCoverageDensityDemo() {
  const gauntletEda = useDataLabStore((s) => s.gauntletEda)
  const loading = useDataLabStore((s) => s.loading.gauntletEda)
  const error = useDataLabStore((s) => s.errors.gauntletEda)
  const fetchGauntletEda = useDataLabStore((s) => s.fetchGauntletEda)

  useEffect(() => {
    fetchGauntletEda()
  }, [fetchGauntletEda])

  const coverage = useMemo(() => {
    if (!gauntletEda?.coverageDensity) {
      return { bySubject: [], blindSpots: [], totalLib: 0, totalArena: 0, overallPct: 0 }
    }
    const bySub = gauntletEda.coverageDensity.bySubject
    const totalLib = bySub.reduce((sum, s) => sum + s.libraryCards, 0)
    const totalArena = bySub.reduce((sum, s) => sum + s.arenaCards, 0)
    const overallPct = totalLib > 0 ? Math.round((totalArena / totalLib) * 1000) / 10 : 0

    const blindSpots = (gauntletEda.coverageDensity.untestedBlindSpots || []).slice(0, 6).map((b) => ({
      ...b,
      title: getTopicName(b.tosTopicId),
      untestedCount: b.libraryCards - b.arenaCards,
    }))

    return { bySubject: bySub, blindSpots, totalLib, totalArena, overallPct }
  }, [gauntletEda])

  if (loading) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[300px] justify-center items-center">
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-widest animate-pulse">
          Loading Coverage Density…
        </span>
      </div>
    )
  }

  if (error || !gauntletEda) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[300px] justify-center items-center text-center">
        <p className="font-['Rajdhani'] uppercase tracking-widest text-[#ef4444] text-sm font-bold">
          {error || 'Unable to load Gauntlet analytics'}
        </p>
      </div>
    )
  }

  if (coverage.totalLib === 0) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="gauntlet-coverage-density-demo">
        <div className="flex items-center justify-between border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Compass className="text-accent" size={16} />
            Topic Coverage Density: Gauntlet vs. Pool
          </h2>
        </div>
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
          <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-sm font-bold">
            No playable cards found
          </p>
          <p className="text-text-muted text-xs font-['JetBrains_Mono']">
            Import cards to inspect your gauntlet penetration rates.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-4 relative hover:z-20 transition-all" data-testid="gauntlet-coverage-density-demo">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-base/50 pb-3">
        <div className="flex items-center gap-3">
          <h2 className="font-['Rajdhani'] font-bold text-base text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Compass className="text-accent" size={18} />
            Topic Coverage Density: Gauntlet vs. Pool
          </h2>
        </div>
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted px-2.5 py-0.5 rounded bg-surface-2 border border-border-base">
          {coverage.totalArena.toLocaleString()} / {coverage.totalLib.toLocaleString()} Pool Cards Drilled ({coverage.overallPct}%)
        </span>
      </div>

      {/* Two-Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Pane: Subject Horizontal Progress Bars */}
        <div className="flex flex-col gap-3 justify-center">
          <span className="font-['Rajdhani'] text-xs uppercase tracking-widest text-text-muted font-bold">
            Subject Pool Penetration
          </span>
          <div className="flex flex-col gap-3">
            {coverage.bySubject.map((item) => {
              const color = SUBJECT_LINE_COLOR[item.subject] || '#00FF41'
              return (
                <div key={item.subject} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-['JetBrains_Mono']">
                    <span className="font-bold" style={{ color }}>
                      {item.subject}
                    </span>
                    <span className="text-text-muted text-[11px]">
                      {item.arenaCards.toLocaleString()} / {item.libraryCards.toLocaleString()} cards (
                      <span className="text-text-primary font-semibold">{item.penetrationPct}%</span>)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-surface-2 rounded-full overflow-hidden border border-border-base/50 relative">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, item.penetrationPct))}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Pane: Untested Blind Spots Section */}
        <div className="flex flex-col gap-3 border-t lg:border-t-0 lg:border-l border-border-base/50 pt-3 lg:pt-0 lg:pl-6">
          <div className="flex items-center justify-between">
            <span className="font-['Rajdhani'] text-xs uppercase tracking-widest text-[#F59E0B] font-bold flex items-center gap-1.5">
              <AlertTriangle size={14} />
              Highest Untested Blind Spots
            </span>
            <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted">
              Unseen in Gauntlet
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {coverage.blindSpots.map((spot) => (
              <div
                key={spot.tosTopicId}
                className="bg-surface-2 rounded-lg px-3 py-2 border border-border-base flex items-center justify-between gap-2"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-['Rajdhani'] text-xs font-bold text-text-primary truncate">
                    {spot.title}
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-text-muted">
                    {spot.arenaCards} seen · {spot.libraryCards} pool
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] font-bold text-[#F59E0B] bg-[#F59E0B]/10 shrink-0">
                  +{spot.untestedCount} pool
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
export default GauntletCoverageDensityDemo
