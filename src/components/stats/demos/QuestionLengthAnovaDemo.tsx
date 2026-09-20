import React, { useEffect, useState } from 'react'
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
import { BarChart as BarChartIcon, AlertCircle } from 'lucide-react'
import { oneWayAnova } from '../../../lib/stats/anova'
import { mean } from '../../../lib/stats/descriptive'
import { SUBJECT_LINE_COLOR } from '../../../lib/dashboardUtils'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from './chartTooltipStyle'
import { useDataLabStore } from '../../../store/useDataLabStore'
import { StatInfoModal } from './StatInfoModal'
import { STAT_EXPLANATIONS } from './statExplanations'

const SUBJECTS = ['MATH', 'GEAS', 'ELECS', 'EST'] as const

export function QuestionLengthAnovaDemo() {
  const rows = useDataLabStore((state) => state.questionLengthDistribution)
  const loading = useDataLabStore((state) => state.loading.questionLengthDistribution)
  const error = useDataLabStore((state) => state.errors.questionLengthDistribution)
  const fetchQuestionLengthDistribution = useDataLabStore((state) => state.fetchQuestionLengthDistribution)
  const [activeStatId, setActiveStatId] = useState<string | null>(null)

  useEffect(() => {
    fetchQuestionLengthDistribution()
  }, [fetchQuestionLengthDistribution])

  useEffect(() => {
    const handleFocus = () => {
      fetchQuestionLengthDistribution()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchQuestionLengthDistribution])

  if (loading) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[300px] justify-center items-center">
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-widest animate-pulse">
          Loading question length ANOVA…
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

  // Group qlen values into 4 arrays by subject
  const grouped: Record<string, number[]> = { MATH: [], GEAS: [], ELECS: [], EST: [] }
  for (const r of rows) {
    if (grouped[r.subject]) {
      grouped[r.subject].push(r.qlen)
    }
  }

  const groupCountsText = `n(MATH)=${grouped.MATH.length} · n(GEAS)=${grouped.GEAS.length} · n(ELECS)=${grouped.ELECS.length} · n(EST)=${grouped.EST.length}`
  const isInsufficient = SUBJECTS.some((sub) => grouped[sub].length < 5)

  // Gate on insufficient data if any subject group has fewer than 5 values
  if (isInsufficient) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="question-length-anova-demo">
        <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <BarChartIcon className="text-accent" size={16} />
            Question Length: One-Way ANOVA (MCQ)
          </h2>
          <span className="font-['JetBrains_Mono'] text-[10px] sm:text-[11px] text-text-muted">
            {groupCountsText}
          </span>
        </div>
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2" data-testid="insufficient-data-placeholder">
          <AlertCircle className="text-text-muted opacity-60" size={32} />
          <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-sm font-bold">
            Insufficient Data (min 5 per subject)
          </p>
          <p className="text-text-muted text-xs font-['JetBrains_Mono']">
            At least 5 multiple-choice questions per subject are needed to run a one-way ANOVA test.
          </p>
        </div>
      </div>
    )
  }

  const groups = [grouped.MATH, grouped.GEAS, grouped.ELECS, grouped.EST]
  const result = oneWayAnova(groups)

  const chartData = SUBJECTS.map((sub) => {
    const group = grouped[sub]
    const m = mean(group)
    return {
      subject: sub,
      mean: isNaN(m) ? 0 : Math.round(m),
      count: group.length,
      fill: SUBJECT_LINE_COLOR[sub] || '#00FF41',
    }
  })

  const fText = isNaN(result.F) ? '0.00' : result.F.toFixed(2)
  const pText = isNaN(result.pValue)
    ? 'p = N/A'
    : result.pValue < 0.001
    ? 'p < 0.001'
    : `p = ${result.pValue.toFixed(3)}`
  const dfText = `${result.dfB} / ${result.dfW}`

  const isSignificant = !isNaN(result.pValue) && result.pValue < 0.05
  const interpretationText = isSignificant
    ? 'Question length differs meaningfully across at least one subject pair'
    : 'No statistically significant difference in question length across subjects at this sample size.'

  return (
    <>
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="question-length-anova-demo">
        <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <BarChartIcon className="text-accent" size={16} />
            Question Length: One-Way ANOVA (MCQ)
          </h2>
          <span className="font-['JetBrains_Mono'] text-[10px] sm:text-[11px] text-text-muted">
            {groupCountsText}
          </span>
        </div>

        <div className="w-full h-52 relative">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={150} debounce={300}>
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
                  `Mean: ${value} chars (n = ${item.payload.count})`,
                  'Length',
                ]}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="mean" radius={[4, 4, 0, 0]} animationDuration={600} animationEasing="ease-out">
                {chartData.map((entry) => (
                  <Cell key={`cell-len-anova-${entry.subject}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-2 flex flex-col gap-3" data-testid="anova-interpretation">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div
              onClick={() => setActiveStatId('fStatistic')}
              role="button"
              tabIndex={0}
              className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
            >
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {fText}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                F-statistic
              </span>
            </div>
            <div
              onClick={() => setActiveStatId('pValueAnova')}
              role="button"
              tabIndex={0}
              className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
            >
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {pText}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                p-value
              </span>
            </div>
            <div
              onClick={() => setActiveStatId('anovaDf')}
              role="button"
              tabIndex={0}
              className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
            >
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {dfText}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                df
              </span>
            </div>
          </div>
          <p className="font-['JetBrains_Mono'] text-xs text-text-muted leading-relaxed">
            {interpretationText}
          </p>
        </div>
      </div>

      {activeStatId && STAT_EXPLANATIONS[activeStatId] && (
        <StatInfoModal
          isOpen={!!activeStatId}
          onClose={() => setActiveStatId(null)}
          title={STAT_EXPLANATIONS[activeStatId].title}
          value={
            activeStatId === 'fStatistic'
              ? fText
              : activeStatId === 'pValueAnova'
              ? pText
              : dfText
          }
          formula={STAT_EXPLANATIONS[activeStatId].formula}
          description={STAT_EXPLANATIONS[activeStatId].description}
          takeaway={STAT_EXPLANATIONS[activeStatId].takeaway}
        />
      )}
    </>
  )
}

export default QuestionLengthAnovaDemo
