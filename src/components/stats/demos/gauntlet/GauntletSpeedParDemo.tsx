import React, { useMemo, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Zap, AlertCircle, Clock, Gauge } from 'lucide-react'
import { useDataLabStore } from '../../../../store/useDataLabStore'
import { SUBJECT_LINE_COLOR } from '../../../../lib/dashboardUtils'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from '../chartTooltipStyle'

export function GauntletSpeedParDemo() {
  const gauntletEda = useDataLabStore((s) => s.gauntletEda)
  const loading = useDataLabStore((s) => s.loading.gauntletEda)
  const error = useDataLabStore((s) => s.errors.gauntletEda)
  const fetchGauntletEda = useDataLabStore((s) => s.fetchGauntletEda)

  useEffect(() => {
    fetchGauntletEda()
  }, [fetchGauntletEda])

  const chartData = useMemo(() => {
    if (!gauntletEda?.speedPar) return []
    return gauntletEda.speedPar.map((sp) => ({
      subject: sp.subject,
      actualSec: Math.round((sp.avgTimeMs / 1000) * 10) / 10,
      parSec: Math.round((sp.avgParMs / 1000) * 10) / 10,
      speedRatio: sp.speedRatio,
      fastWrongCount: sp.fastWrongCount,
      totalAnswers: sp.totalAnswers,
      wrongCount: sp.wrongCount,
      fastWrongPct: Math.round(sp.fastWrongRate * 100),
    }))
  }, [gauntletEda])

  const totals = useMemo(() => {
    if (!gauntletEda?.speedPar || gauntletEda.speedPar.length === 0) {
      return { totalFastWrong: 0, totalWrong: 0, overallRatio: 1.0, impulsivePct: 0 }
    }
    const all = gauntletEda.speedPar
    const totalFastWrong = all.reduce((sum, s) => sum + s.fastWrongCount, 0)
    const totalWrong = all.reduce((sum, s) => sum + s.wrongCount, 0)
    const totalTime = all.reduce((sum, s) => sum + s.avgTimeMs * s.totalAnswers, 0)
    const totalPar = all.reduce((sum, s) => sum + s.avgParMs * s.totalAnswers, 0)
    const overallRatio = totalPar > 0 ? Math.round((totalTime / totalPar) * 100) / 100 : 1.0
    const impulsivePct = totalWrong > 0 ? Math.round((totalFastWrong / totalWrong) * 100) : 0

    return { totalFastWrong, totalWrong, overallRatio, impulsivePct }
  }, [gauntletEda])

  if (loading) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[340px] justify-center items-center">
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-widest animate-pulse">
          Loading Speed vs. Par Efficiency…
        </span>
      </div>
    )
  }

  if (error || !gauntletEda) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[340px] justify-center items-center text-center">
        <p className="font-['Rajdhani'] uppercase tracking-widest text-[#ef4444] text-sm font-bold">
          {error || 'Unable to load Gauntlet analytics'}
        </p>
      </div>
    )
  }

  const hasData = chartData.some((d) => d.totalAnswers > 0)

  if (!hasData) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="gauntlet-speed-par-demo">
        <div className="flex items-center justify-between border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Zap className="text-accent" size={16} />
            Response Speed vs. Par Time
          </h2>
        </div>
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
          <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-sm font-bold">
            No pace records found
          </p>
          <p className="text-text-muted text-xs font-['JetBrains_Mono']">
            Play Gauntlet questions to measure actual response speed against par calculation time.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 relative hover:z-20 transition-all" data-testid="gauntlet-speed-par-demo">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-base/50 pb-2.5">
        <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
          <Zap className="text-accent" size={16} />
          Response Speed vs. Par Time
        </h2>
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted shrink-0">
          Target Par Baseline
        </span>
      </div>

      {/* Chart */}
      <div className="w-full h-60 relative">
        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={160} debounce={200}>
          <BarChart data={chartData} margin={{ top: 14, right: 12, left: -14, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E1E1E" />
            <XAxis
              dataKey="subject"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#888', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#666', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => `${v}s`}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              labelStyle={CHART_TOOLTIP_LABEL_STYLE}
              itemStyle={CHART_TOOLTIP_ITEM_STYLE}
              wrapperStyle={{ outline: 'none', zIndex: 9999, pointerEvents: 'none' }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              formatter={(value: any, name: any, item: any) => {
                const isActual = name === 'Actual Speed'
                const p = item.payload
                if (isActual) {
                  return [`${value}s (${p.speedRatio}x par time)`, 'Actual Avg Speed']
                }
                return [`${value}s par estimate`, 'Calibrated Par Time']
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: '10px', fontFamily: 'JetBrains Mono', paddingBottom: '6px' }}
            />
            <Bar dataKey="actualSec" name="Actual Speed" fill="#00FF41" radius={[4, 4, 0, 0]} />
            <Bar dataKey="parSec" name="Par Time" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Speed & Impulsive Mistake Badges */}
      <div className="pt-2 border-t border-border-base/40 grid grid-cols-3 gap-2">
        <div className="bg-surface-2 rounded-lg p-2 border border-border-base flex flex-col items-center justify-center text-center">
          <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-text-muted font-bold">
            Pace Factor
          </span>
          <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary">
            {totals.overallRatio}x
          </span>
          <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-text-muted font-bold mt-0.5">
            {totals.overallRatio > 1.0 ? 'Deliberate Pacing' : 'Ahead of Par'}
          </span>
        </div>

        <div className="bg-surface-2 rounded-lg p-2 border border-border-base flex flex-col items-center justify-center text-center">
          <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-text-muted font-bold">
            Impulsive Errors
          </span>
          <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-[#F59E0B]">
            {totals.totalFastWrong}
          </span>
          <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#888] font-bold mt-0.5">
            &lt; 25% Par Time
          </span>
        </div>

        <div className="bg-surface-2 rounded-lg p-2 border border-border-base flex flex-col items-center justify-center text-center">
          <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-text-muted font-bold">
            Rushed Mistake Rate
          </span>
          <span className={`font-['JetBrains_Mono'] text-sm sm:text-base font-bold ${totals.impulsivePct > 15 ? 'text-[#EF4444]' : 'text-accent'}`}>
            {totals.impulsivePct}%
          </span>
          <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#888] font-bold mt-0.5">
            Of Total Mistakes
          </span>
        </div>
      </div>
    </div>
  )
}
export default GauntletSpeedParDemo
