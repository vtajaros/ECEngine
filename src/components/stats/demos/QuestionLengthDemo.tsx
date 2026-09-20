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
import { AlignLeft, AlertCircle } from 'lucide-react'
import { dbService } from '../../../services/db.service'
import { summarize } from '../../../lib/stats/descriptive'
import { SUBJECT_LINE_COLOR } from '../../../lib/dashboardUtils'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from './chartTooltipStyle'
import { useDataVersionStore } from '../../../store/useDataVersionStore'
import { StatInfoModal } from './StatInfoModal'
import { STAT_EXPLANATIONS } from './statExplanations'

const SUBJECTS = ['MATH', 'GEAS', 'ELECS', 'EST'] as const

export function QuestionLengthDemo() {
  const dataVersion = useDataVersionStore((state) => state.version)
  const [rows, setRows] = useState<Array<{ subject: string; qlen: number }> | null>(null)
  const [activeStatId, setActiveStatId] = useState<string | null>(null)
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
      .getQuestionLengthDistribution()
      .then((res) => {
        if (isMountedRef.current) {
          setRows(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMountedRef.current) {
          setError(err.message || 'Failed to load question length distribution')
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
          Loading question length distribution…
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

  const totalN = rows.length

  // Gate: if total n < 10, show insufficient data placeholder
  if (totalN < 10) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="question-length-demo">
        <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <AlignLeft className="text-accent" size={16} />
            Question Length Distribution (MCQ)
          </h2>
          <span className="font-['JetBrains_Mono'] text-xs text-text-muted shrink-0 whitespace-nowrap">
            n = {totalN}
          </span>
        </div>
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2" data-testid="insufficient-data-placeholder">
          <AlertCircle className="text-text-muted opacity-60" size={32} />
          <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-sm font-bold">
            Insufficient Data (n = {totalN} &lt; 10)
          </p>
          <p className="text-text-muted text-xs font-['JetBrains_Mono']">
            At least 10 multiple-choice questions are needed to compute descriptive length distributions.
          </p>
        </div>
      </div>
    )
  }

  // Group per subject in the component
  const grouped: Record<string, number[]> = { MATH: [], GEAS: [], ELECS: [], EST: [] }
  const allLengths: number[] = []

  for (const r of rows) {
    if (grouped[r.subject]) {
      grouped[r.subject].push(r.qlen)
    }
    allLengths.push(r.qlen)
  }

  // Overall descriptive statistics
  const overallStats = summarize(allLengths)
  const meanAll = Math.round(overallStats.mean)
  const medianAll = Math.round(overallStats.median)

  // Per-subject statistics
  const chartData = SUBJECTS.map((sub) => {
    const lengths = grouped[sub]
    const stats = summarize(lengths)
    return {
      subject: sub,
      mean: isNaN(stats.mean) ? 0 : Math.round(stats.mean),
      median: isNaN(stats.median) ? 0 : Math.round(stats.median),
      count: stats.n,
      fill: SUBJECT_LINE_COLOR[sub] || '#00FF41',
    }
  })

  // Skewness interpretation using live numbers
  const skewNote =
    meanAll > medianAll
      ? 'mean > median indicates right-skew (extended problem scenarios pull up the mean)'
      : meanAll < medianAll
      ? 'mean < median indicates left-skew'
      : 'mean = median indicates symmetric question lengths'

  return (
    <>
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="question-length-demo">
        <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <AlignLeft className="text-accent" size={16} />
            Mean Question Length by Subject (MCQ)
          </h2>
          <span className="font-['JetBrains_Mono'] text-xs text-text-muted shrink-0 whitespace-nowrap">
            n = {totalN.toLocaleString()}
          </span>
        </div>

        <div className="w-full h-52 relative">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={150}>
            <BarChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
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
                tickFormatter={(v) => `${v}c`}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                wrapperStyle={{ outline: 'none' }}
                formatter={(value: any, _name: any, item: any) => [
                  `Mean: ${value} chars (Median: ${item.payload.median}c, n = ${item.payload.count})`,
                  'Length',
                ]}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="mean" radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={`cell-len-${entry.subject}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-2 border-t border-border-base/40 flex flex-col gap-2" data-testid="question-length-interpretation">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div
              onClick={() => setActiveStatId('totalN')}
              role="button"
              tabIndex={0}
              className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
            >
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {totalN.toLocaleString()}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                Total n
              </span>
            </div>
            <div
              onClick={() => setActiveStatId('mean')}
              role="button"
              tabIndex={0}
              className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
            >
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {meanAll} chars
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                Mean
              </span>
            </div>
            <div
              onClick={() => setActiveStatId('median')}
              role="button"
              tabIndex={0}
              className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
            >
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {medianAll} chars
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                Median
              </span>
            </div>
          </div>
          <p className="font-['JetBrains_Mono'] text-xs text-text-muted leading-relaxed">
            {skewNote}
          </p>
        </div>
      </div>

      {activeStatId && (
        <StatInfoModal
          isOpen={!!activeStatId}
          onClose={() => setActiveStatId(null)}
          title={STAT_EXPLANATIONS[activeStatId].title}
          value={
            activeStatId === 'totalN'
              ? totalN.toLocaleString()
              : activeStatId === 'mean'
              ? `${meanAll} chars`
              : `${medianAll} chars`
          }
          formula={STAT_EXPLANATIONS[activeStatId].formula}
          description={STAT_EXPLANATIONS[activeStatId].description}
          takeaway={STAT_EXPLANATIONS[activeStatId].takeaway}
        />
      )}
    </>
  )
}
export default QuestionLengthDemo
