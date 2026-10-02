import React, { useMemo, useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { TrendingUp, ShieldCheck, Award } from 'lucide-react'
import { useDataLabStore } from '../../../../store/useDataLabStore'
import { SUBJECT_LINE_COLOR } from '../../../../lib/dashboardUtils'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from '../chartTooltipStyle'

type VisibleLine = 'ALL' | 'OVERALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST'

const SUBJECT_COLORS: Record<string, string> = {
  MATH: '#F59E0B',
  GEAS: '#3B82F6',
  ELECS: '#EF4444',
  EST: '#00FF41',
  overall: '#A855F7',
}

interface CustomTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string | number
}

function CustomEloTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0]?.payload
  if (!data) return null

  return (
    <div
      style={CHART_TOOLTIP_STYLE}
      className="flex flex-col gap-2 min-w-[200px] border border-accent/40 bg-[#0D0D0D] p-3 rounded-lg shadow-[0_0_18px_rgba(0,255,65,0.25)]"
    >
      <div className="flex items-center justify-between border-b border-border-base/60 pb-1.5">
        <span className="font-['Rajdhani'] font-bold text-xs text-text-primary uppercase tracking-wider">
          Run #{label}
        </span>
        <span className="font-['JetBrains_Mono'] text-[10px] text-text-muted">
          {data.date}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-['JetBrains_Mono']">
        <div className="flex items-center justify-between">
          <span style={{ color: SUBJECT_COLORS.MATH }}>MATH</span>
          <span className="text-text-primary font-bold">{data.MATH != null ? Math.round(data.MATH) : '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: SUBJECT_COLORS.GEAS }}>GEAS</span>
          <span className="text-text-primary font-bold">{data.GEAS != null ? Math.round(data.GEAS) : '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: SUBJECT_COLORS.ELECS }}>ELECS</span>
          <span className="text-text-primary font-bold">{data.ELECS != null ? Math.round(data.ELECS) : '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: SUBJECT_COLORS.EST }}>EST</span>
          <span className="text-text-primary font-bold">{data.EST != null ? Math.round(data.EST) : '—'}</span>
        </div>
      </div>

      {data.overall != null && (
        <div className="pt-1.5 border-t border-border-base/60 flex items-center justify-between text-xs font-['JetBrains_Mono']">
          <span style={{ color: SUBJECT_COLORS.overall }} className="font-bold">OVERALL</span>
          <span className="text-accent font-bold">{Math.round(data.overall)}</span>
        </div>
      )}
    </div>
  )
}

export function GauntletEloTrajectoryDemo() {
  const gauntletEda = useDataLabStore((s) => s.gauntletEda)
  const loading = useDataLabStore((s) => s.loading.gauntletEda)
  const error = useDataLabStore((s) => s.errors.gauntletEda)
  const fetchGauntletEda = useDataLabStore((s) => s.fetchGauntletEda)

  const [activeFilter, setActiveFilter] = useState<VisibleLine>('ALL')

  useEffect(() => {
    fetchGauntletEda()
  }, [fetchGauntletEda])

  const chartData = useMemo(() => {
    if (!gauntletEda?.eloTrajectory) return []
    // Add run index 1..N for x-axis
    return gauntletEda.eloTrajectory.map((pt, idx) => ({
      ...pt,
      runNum: idx + 1,
    }))
  }, [gauntletEda])

  const ratingsOverview = useMemo(() => {
    if (!gauntletEda?.currentRatings) return []
    const codes = ['MATH', 'GEAS', 'ELECS', 'EST'] as const
    const items = codes.map((code) => {
      const cr = gauntletEda.currentRatings[code] || { rating: 500, peak: 500, answers: 0 }
      return {
        code,
        rating: Math.round(cr.rating),
        peak: Math.round(cr.peak),
        answers: cr.answers,
        color: SUBJECT_COLORS[code],
      }
    })

    const avgRating = Math.round(items.reduce((s, i) => s + i.rating, 0) / items.length)
    const avgPeak = Math.round(items.reduce((s, i) => s + i.peak, 0) / items.length)
    const totalAnswers = items.reduce((s, i) => s + i.answers, 0)

    return [
      ...items,
      {
        code: 'OVERALL',
        rating: avgRating,
        peak: avgPeak,
        answers: totalAnswers,
        color: SUBJECT_COLORS.overall,
      },
    ]
  }, [gauntletEda])

  if (loading) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[380px] justify-center items-center">
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-widest animate-pulse">
          Loading Elo Trajectory…
        </span>
      </div>
    )
  }

  if (error || !gauntletEda) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[380px] justify-center items-center text-center">
        <p className="font-['Rajdhani'] uppercase tracking-widest text-[#ef4444] text-sm font-bold">
          {error || 'Unable to load Gauntlet analytics'}
        </p>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="gauntlet-elo-trajectory-demo">
        <div className="flex items-center justify-between border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="text-accent" size={16} />
            Elo Rating Growth & Trajectory
          </h2>
        </div>
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
          <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-sm font-bold">
            No rated runs recorded
          </p>
          <p className="text-text-muted text-xs font-['JetBrains_Mono']">
            Play rated Gauntlet arena matches to establish and track skill rating growth.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-4 relative hover:z-20 transition-all" data-testid="gauntlet-elo-trajectory-demo">
      {/* Header and Filter Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border-base/50 pb-3">
        <div className="flex items-center gap-3">
          <h2 className="font-['Rajdhani'] font-bold text-base text-text-primary uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="text-accent" size={18} />
            Elo Rating Growth & Trajectory
          </h2>
          <span className="font-['JetBrains_Mono'] text-xs text-text-muted px-2 py-0.5 rounded bg-surface-2 border border-border-base">
            {chartData.length} Completed Runs
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(['ALL', 'OVERALL', 'MATH', 'GEAS', 'ELECS', 'EST'] as VisibleLine[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1 rounded text-xs font-['JetBrains_Mono'] uppercase transition-colors ${
                activeFilter === filter
                  ? 'bg-accent/20 text-accent border border-accent/40 font-bold shadow-[0_0_10px_rgba(0,255,65,0.2)]'
                  : 'text-text-muted hover:text-text-primary bg-surface-2 border border-border-base'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Spacious Full-Width Chart */}
      <div className="w-full h-72 sm:h-80 relative">
        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200} debounce={200}>
          <LineChart data={chartData} margin={{ top: 14, right: 16, left: -10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E1E1E" />
            <XAxis
              dataKey="runNum"
              axisLine={false}
              tickLine={false}
              minTickGap={45}
              tick={{ fill: '#888', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => `#${v}`}
            />
            <YAxis
              domain={['dataMin - 40', 'dataMax + 40']}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#666', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            />
            <ReferenceLine y={500} stroke="#444" strokeDasharray="3 3" label={{ value: 'Base 500', fill: '#555', fontSize: 10, position: 'insideBottomRight' }} />
            <Tooltip
              content={<CustomEloTooltip />}
              wrapperStyle={{ outline: 'none', zIndex: 9999, pointerEvents: 'none' }}
            />

            {(activeFilter === 'ALL' || activeFilter === 'MATH') && (
              <Line
                type="monotone"
                dataKey="MATH"
                stroke={SUBJECT_COLORS.MATH}
                strokeWidth={2}
                dot={false}
                name="MATH"
                isAnimationActive={false}
                connectNulls={true}
              />
            )}
            {(activeFilter === 'ALL' || activeFilter === 'GEAS') && (
              <Line
                type="monotone"
                dataKey="GEAS"
                stroke={SUBJECT_COLORS.GEAS}
                strokeWidth={2}
                dot={false}
                name="GEAS"
                isAnimationActive={false}
                connectNulls={true}
              />
            )}
            {(activeFilter === 'ALL' || activeFilter === 'ELECS') && (
              <Line
                type="monotone"
                dataKey="ELECS"
                stroke={SUBJECT_COLORS.ELECS}
                strokeWidth={2}
                dot={false}
                name="ELECS"
                isAnimationActive={false}
                connectNulls={true}
              />
            )}
            {(activeFilter === 'ALL' || activeFilter === 'EST') && (
              <Line
                type="monotone"
                dataKey="EST"
                stroke={SUBJECT_COLORS.EST}
                strokeWidth={2}
                dot={false}
                name="EST"
                isAnimationActive={false}
                connectNulls={true}
              />
            )}
            {(activeFilter === 'ALL' || activeFilter === 'OVERALL') && (
              <Line
                type="monotone"
                dataKey="overall"
                stroke={SUBJECT_COLORS.overall}
                strokeWidth={activeFilter === 'OVERALL' ? 3 : 2}
                strokeDasharray={activeFilter === 'ALL' ? '4 4' : undefined}
                dot={false}
                name="Overall"
                isAnimationActive={false}
                connectNulls={true}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Ratings Overview Grid (5 Columns) */}
      <div className="pt-2 border-t border-border-base/40 grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        {ratingsOverview.map((r) => (
          <div
            key={r.code}
            className="bg-surface-2 rounded-lg p-2.5 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0"
          >
            <span
              className="font-['Rajdhani'] text-xs uppercase tracking-widest font-bold mb-0.5"
              style={{ color: r.color }}
            >
              {r.code}
            </span>
            <span className="font-['JetBrains_Mono'] text-base sm:text-lg font-bold text-text-primary leading-tight">
              {r.rating}
            </span>
            <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-[#777] font-bold mt-1 leading-tight">
              Peak: {r.peak}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
export default GauntletEloTrajectoryDemo
