import React, { useEffect, useState, useCallback, useRef } from 'react'
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
import { HelpCircle, AlertTriangle } from 'lucide-react'
import { dbService } from '../../../services/db.service'
import { chiSquareGof, cramersW } from '../../../lib/stats/inference'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from './chartTooltipStyle'
import { useDataVersionStore } from '../../../store/useDataVersionStore'

const POSITION_LABELS: Record<number, string> = {
  0: 'Choice A (0)',
  1: 'Choice B (1)',
  2: 'Choice C (2)',
  3: 'Choice D (3)',
}

const POSITION_COLORS = ['#38BDF8', '#818CF8', '#A78BFA', '#F472B6']

export function AnswerPositionDemo() {
  const dataVersion = useDataVersionStore((state) => state.version)
  const [rows, setRows] = useState<Array<{ position: number | null; count: number }> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchData = useCallback(() => {
    dbService
      .getAnswerPositionCounts()
      .then((res) => {
        if (isMountedRef.current) {
          setRows(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMountedRef.current) {
          setError(err.message || 'Failed to load answer position counts')
          setLoading(false)
        }
      })
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData, dataVersion])

  useEffect(() => {
    const handleFocus = () => {
      fetchData()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchData])

  if (loading) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[300px] justify-center items-center">
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-widest animate-pulse">
          Loading answer position balance…
        </span>
      </div>
    )
  }

  if (error || !rows) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[300px] justify-center items-center text-center">
        <p className="font-['Rajdhani'] uppercase tracking-widest text-[#ef4444] text-sm font-bold">
          {error || 'Unable to load data'}
        </p>
      </div>
    )
  }

  // Extract positions 0-3 for statistical test; capture null anomaly separately
  const pos0 = rows.find((r) => r.position === 0)?.count ?? 0
  const pos1 = rows.find((r) => r.position === 1)?.count ?? 0
  const pos2 = rows.find((r) => r.position === 2)?.count ?? 0
  const pos3 = rows.find((r) => r.position === 3)?.count ?? 0
  const anomalyCount = rows.find((r) => r.position === null)?.count ?? 0

  const observed = [pos0, pos1, pos2, pos3]
  const testedN = pos0 + pos1 + pos2 + pos3

  if (testedN === 0) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="answer-position-demo">
        <div className="flex items-center justify-between border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <HelpCircle className="text-accent" size={16} />
            Answer Key Position Balance (MCQ)
          </h2>
        </div>
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
          <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-sm font-bold">
            No MCQ answer position data available
          </p>
          <p className="text-text-muted text-xs font-['JetBrains_Mono']">
            Import or practice questions to analyze choice key distribution.
          </p>
        </div>
      </div>
    )
  }

  // Goodness-of-fit test against uniform null (25% per choice)
  const gof = chiSquareGof(observed, [0.25, 0.25, 0.25, 0.25])
  const effectW = !isNaN(gof.cramersW) ? gof.cramersW : cramersW(gof.chi2, testedN)

  const pText = gof.pValue < 0.001 ? 'p < 0.001' : `p = ${gof.pValue.toFixed(3)}`
  const wText = !isNaN(effectW) ? effectW.toFixed(3) : '0.000'

  // Practical effect size interpretation
  const effectInterpretation =
    effectW < 0.1
      ? 'negligible effect size (effectively uniform balance across options)'
      : effectW < 0.3
      ? 'small option preference observed'
      : 'moderate-to-large position bias detected'

  const chartData = [
    { position: 0, label: 'A (0)', count: pos0, fill: POSITION_COLORS[0] },
    { position: 1, label: 'B (1)', count: pos1, fill: POSITION_COLORS[1] },
    { position: 2, label: 'C (2)', count: pos2, fill: POSITION_COLORS[2] },
    { position: 3, label: 'D (3)', count: pos3, fill: POSITION_COLORS[3] },
  ]

  return (
    <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="answer-position-demo">
      <div className="flex items-center justify-between border-b border-border-base/50 pb-2.5">
        <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
          <HelpCircle className="text-accent" size={16} />
          Answer Key Position Balance (MCQ)
        </h2>
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted">
          n = {testedN.toLocaleString()}
        </span>
      </div>

      <div className="w-full h-52 relative">
        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={150}>
          <BarChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E1E1E" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#888', fontSize: 11, fontFamily: 'JetBrains Mono' }}
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
              wrapperStyle={{ outline: 'none' }}
              formatter={(value: any, _name: any, item: any) => [
                `${Number(value).toLocaleString()} cards (${((Number(value) / testedN) * 100).toFixed(1)}%)`,
                POSITION_LABELS[item.payload.position] || 'Option',
              ]}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={`cell-pos-${entry.position}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-2 border-t border-border-base/40 flex flex-col gap-2">
        <div className="flex flex-col gap-2" data-testid="answer-position-interpretation">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0">
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {gof.chi2.toFixed(2)}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                χ²
              </span>
            </div>
            <div className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0">
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {pText}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                p-value
              </span>
            </div>
            <div className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0">
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {wText}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                Cramér's W
              </span>
            </div>
          </div>
          <p className="font-['JetBrains_Mono'] text-xs text-text-muted leading-relaxed">
            {effectInterpretation}
          </p>
        </div>

        {anomalyCount > 0 && (
          <div
            className="flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] text-[#eab308] bg-[#eab308]/10 px-3 py-1.5 rounded border border-[#eab308]/20"
            data-testid="answer-position-anomaly"
          >
            <AlertTriangle size={14} className="shrink-0" />
            <span>
              Data Quality Note: {anomalyCount.toLocaleString()} card(s) have unassigned or out-of-range answer keys (excluded from χ² test).
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
export default AnswerPositionDemo
