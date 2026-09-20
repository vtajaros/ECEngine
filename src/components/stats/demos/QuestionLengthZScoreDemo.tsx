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
import { Target, AlertCircle } from 'lucide-react'
import { zScores } from '../../../lib/stats/descriptive'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from './chartTooltipStyle'
import { useDataLabStore } from '../../../store/useDataLabStore'
import { StatInfoModal } from './StatInfoModal'
import { STAT_EXPLANATIONS } from './statExplanations'

export function QuestionLengthZScoreDemo() {
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
          Loading question length z-scores…
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

  // Gate on insufficient data if total n < 10
  if (totalN < 10) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="question-length-zscore-demo">
        <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Target className="text-accent" size={16} />
            Outlier Detection via Z-Scores (Question Length)
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
            At least 10 multiple-choice questions are needed to run outlier analysis.
          </p>
        </div>
      </div>
    )
  }

  // Compute z-scores across all question lengths pooled together
  const allLengths = rows.map((r) => r.qlen)
  const scores = zScores(allLengths)

  let typicalCount = 0
  let outlierCount = 0
  let extremeCount = 0

  let mostExtreme = {
    subject: rows[0]?.subject || 'N/A',
    qlen: rows[0]?.qlen || 0,
    z: 0,
    absZ: 0,
  }

  for (let i = 0; i < rows.length; i++) {
    const z = scores[i]
    const absZ = isNaN(z) ? 0 : Math.abs(z)

    if (absZ > 3) {
      extremeCount++
    } else if (absZ > 2) {
      outlierCount++
    } else {
      typicalCount++
    }

    if (absZ > mostExtreme.absZ) {
      mostExtreme = {
        subject: rows[i].subject,
        qlen: rows[i].qlen,
        z: isNaN(z) ? 0 : z,
        absZ,
      }
    }
  }

  const totalOutliers = outlierCount + extremeCount
  const mostExtremeZText = `z = ${mostExtreme.z.toFixed(2)}`

  const chartData = [
    {
      bucket: 'Typical (|z| ≤ 2)',
      count: typicalCount,
      fill: '#00FF41',
    },
    {
      bucket: 'Outlier (2 < |z| ≤ 3)',
      count: outlierCount,
      fill: '#f59e0b',
    },
    {
      bucket: 'Extreme (|z| > 3)',
      count: extremeCount,
      fill: '#ef4444',
    },
  ]

  const direction = mostExtreme.z >= 0 ? 'longer' : 'shorter'
  const interpretationText =
    totalOutliers > 0
      ? `Most extreme outlier is in ${mostExtreme.subject} (${mostExtreme.qlen} characters, z = ${mostExtreme.z.toFixed(2)}), which is ${Math.abs(mostExtreme.z).toFixed(1)} standard deviations ${direction} than average (${totalOutliers} outlier${totalOutliers === 1 ? '' : 's'} detected).`
      : `All question lengths are within standard variance (|z| ≤ 2). The most extreme question is in ${mostExtreme.subject} (${mostExtreme.qlen} characters, z = ${mostExtreme.z.toFixed(2)}).`

  return (
    <>
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="question-length-zscore-demo">
        <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Target className="text-accent" size={16} />
            Outlier Detection via Z-Scores (Question Length)
          </h2>
          <span className="font-['JetBrains_Mono'] text-xs text-text-muted shrink-0 whitespace-nowrap">
            n = {totalN.toLocaleString()}
          </span>
        </div>

        <div className="w-full h-52 relative">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={150} debounce={300}>
            <BarChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
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
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                wrapperStyle={{ outline: 'none' }}
                formatter={(value: any) => [`${value} questions`, 'Count']}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={600} animationEasing="ease-out">
                {chartData.map((entry) => (
                  <Cell key={`cell-zscore-${entry.bucket}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="pt-2 flex flex-col gap-3" data-testid="zscore-interpretation">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div
              onClick={() => setActiveStatId('zScoreOutlier')}
              role="button"
              tabIndex={0}
              className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
            >
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {totalOutliers}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                Outliers
              </span>
            </div>
            <div
              onClick={() => setActiveStatId('maxZScore')}
              role="button"
              tabIndex={0}
              className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
            >
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {mostExtremeZText}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                Most Extreme
              </span>
            </div>
            <div
              onClick={() => setActiveStatId('extremeSubject')}
              role="button"
              tabIndex={0}
              className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
            >
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {mostExtreme.subject}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                Extreme Subject
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
            activeStatId === 'zScoreOutlier'
              ? `${totalOutliers}`
              : activeStatId === 'maxZScore'
              ? mostExtremeZText
              : mostExtreme.subject
          }
          formula={STAT_EXPLANATIONS[activeStatId].formula}
          description={STAT_EXPLANATIONS[activeStatId].description}
          takeaway={STAT_EXPLANATIONS[activeStatId].takeaway}
        />
      )}
    </>
  )
}

export default QuestionLengthZScoreDemo
