import React, { useMemo, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Flame, HeartCrack, Timer, Activity } from 'lucide-react'
import { useDataLabStore } from '../../../../store/useDataLabStore'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from '../chartTooltipStyle'

export function GauntletEnduranceStreakDemo() {
  const gauntletEda = useDataLabStore((s) => s.gauntletEda)
  const loading = useDataLabStore((s) => s.loading.gauntletEda)
  const error = useDataLabStore((s) => s.errors.gauntletEda)
  const fetchGauntletEda = useDataLabStore((s) => s.fetchGauntletEda)

  useEffect(() => {
    fetchGauntletEda()
  }, [fetchGauntletEda])

  const endurance = useMemo(() => {
    if (!gauntletEda?.endurance) return null
    return gauntletEda.endurance
  }, [gauntletEda])

  if (loading) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[340px] justify-center items-center">
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-widest animate-pulse">
          Loading Streak & Endurance Curve…
        </span>
      </div>
    )
  }

  if (error || !endurance) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[340px] justify-center items-center text-center">
        <p className="font-['Rajdhani'] uppercase tracking-widest text-[#ef4444] text-sm font-bold">
          {error || 'Unable to load Gauntlet analytics'}
        </p>
      </div>
    )
  }

  if (endurance.totalRuns === 0) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="gauntlet-endurance-streak-demo">
        <div className="flex items-center justify-between border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Flame className="text-accent" size={16} />
            Endurance & Streak Survival Curve
          </h2>
        </div>
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
          <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-sm font-bold">
            No completed runs yet
          </p>
          <p className="text-text-muted text-xs font-['JetBrains_Mono']">
            Play Gauntlet matches to measure answer streaks and endurance survival distributions.
          </p>
        </div>
      </div>
    )
  }

  const streakData = endurance.streakBuckets.map((b) => ({
    ...b,
    fill: b.bucket === '30+' || b.bucket === '20-29' ? '#00FF41' : b.bucket === '15-19' || b.bucket === '10-14' ? '#3B82F6' : '#F59E0B',
  }))

  return (
    <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 relative hover:z-20 transition-all" data-testid="gauntlet-endurance-streak-demo">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-base/50 pb-2.5">
        <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
          <Flame className="text-accent" size={16} />
          Endurance & Streak Survival Curve
        </h2>
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted shrink-0">
          {endurance.totalRuns} runs · Best: {endurance.bestStreakOverall} streak
        </span>
      </div>

      {/* Chart: Streak Frequency Histogram */}
      <div className="w-full h-60 relative">
        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={160} debounce={200}>
          <BarChart data={streakData} margin={{ top: 14, right: 12, left: -14, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E1E1E" />
            <XAxis
              dataKey="bucket"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#666', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              labelStyle={CHART_TOOLTIP_LABEL_STYLE}
              itemStyle={CHART_TOOLTIP_ITEM_STYLE}
              wrapperStyle={{ outline: 'none', zIndex: 9999, pointerEvents: 'none' }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              formatter={(val: any, _name: any, item: any) => [
                `${val} runs (${item.payload.pct}%)`,
                `Streak Range ${item.payload.bucket}`,
              ]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={500}>
              {streakData.map((entry) => (
                <Cell key={`cell-${entry.bucket}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* KPI Tiles and Failure Breakdown */}
      <div className="pt-2 border-t border-border-base/40 grid grid-cols-3 gap-2">
        <div className="bg-surface-2 rounded-lg p-2 border border-border-base flex flex-col items-center justify-center text-center">
          <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-text-muted font-bold">
            Avg Run Survival
          </span>
          <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary">
            {endurance.avgQuestionsPerRun} Qs
          </span>
          <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-accent font-bold mt-0.5">
            {Math.round(endurance.avgRunDurationSec)}s duration
          </span>
        </div>

        <div className="bg-surface-2 rounded-lg p-2 border border-border-base flex flex-col items-center justify-center text-center">
          <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-text-muted font-bold">
            Average Run Score
          </span>
          <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-[#3B82F6]">
            {Math.round(endurance.avgRunScore)}
          </span>
          <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#888] font-bold mt-0.5">
            Pts Per Session
          </span>
        </div>

        <div className="bg-surface-2 rounded-lg p-2 border border-border-base flex flex-col items-center justify-center text-center">
          <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-text-muted font-bold">
            Primary Exit Mode
          </span>
          <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-[#F59E0B] uppercase">
            {endurance.failureModes[0]?.mode || 'None'}
          </span>
          <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#888] font-bold mt-0.5">
            {endurance.failureModes[0]?.pct || 0}% of all runs
          </span>
        </div>
      </div>
    </div>
  )
}
export default GauntletEnduranceStreakDemo
