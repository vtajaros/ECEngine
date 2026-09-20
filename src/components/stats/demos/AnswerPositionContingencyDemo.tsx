import React, { useEffect, useState } from 'react'
import { Grid, AlertCircle, AlertTriangle } from 'lucide-react'
import { chiSquareIndependence } from '../../../lib/stats/contingency'
import { useDataLabStore } from '../../../store/useDataLabStore'
import { StatInfoModal } from './StatInfoModal'
import { STAT_EXPLANATIONS } from './statExplanations'

const SUBJECTS = ['MATH', 'GEAS', 'ELECS', 'EST'] as const

export function AnswerPositionContingencyDemo() {
  const rows = useDataLabStore((state) => state.answerPositionBySubject)
  const loading = useDataLabStore((state) => state.loading.answerPositionBySubject)
  const error = useDataLabStore((state) => state.errors.answerPositionBySubject)
  const fetchAnswerPositionBySubject = useDataLabStore((state) => state.fetchAnswerPositionBySubject)
  const [activeStatId, setActiveStatId] = useState<string | null>(null)

  useEffect(() => {
    fetchAnswerPositionBySubject()
  }, [fetchAnswerPositionBySubject])

  useEffect(() => {
    const handleFocus = () => {
      fetchAnswerPositionBySubject()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchAnswerPositionBySubject])

  if (loading) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[300px] justify-center items-center">
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-widest animate-pulse">
          Loading position contingency test…
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

  // Build 4x4 contingency table (rows = MATH/GEAS/ELECS/EST, columns = positions 0/1/2/3)
  const table = SUBJECTS.map((sub) =>
    [0, 1, 2, 3].map(
      (pos) => rows.find((r) => r.subject === sub && r.position === pos)?.count ?? 0
    )
  )

  const testedN = table.reduce(
    (total, row) => total + row.reduce((rowSum, count) => rowSum + count, 0),
    0
  )

  const anomalyCount = rows
    .filter((r) => r.position === null)
    .reduce((sum, r) => sum + r.count, 0)

  const result = chiSquareIndependence(table)

  // Gate on insufficient data: total N is 0 or any expected cell count is below 5
  const isInsufficient =
    testedN === 0 ||
    isNaN(result.chi2) ||
    result.expected.length === 0 ||
    result.expected.some((row) => row.some((exp) => exp < 5))

  if (isInsufficient) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="answer-position-contingency-demo">
        <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Grid className="text-accent" size={16} />
            Answer Position vs. Subject (Independence Test)
          </h2>
          <span className="font-['JetBrains_Mono'] text-xs text-text-muted shrink-0 whitespace-nowrap">
            n = {testedN.toLocaleString()}
          </span>
        </div>
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2" data-testid="insufficient-data-placeholder">
          <AlertCircle className="text-text-muted opacity-60" size={32} />
          <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-sm font-bold">
            {testedN === 0 ? 'No Data Available' : 'Insufficient Data (Expected Counts < 5)'}
          </p>
          <p className="text-text-muted text-xs font-['JetBrains_Mono']">
            {testedN === 0
              ? 'Import or practice questions to analyze choice key distribution across subjects.'
              : 'Chi-square test of independence requires expected cell counts of at least 5 in every cell.'}
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
    )
  }

  const chi2Text = result.chi2.toFixed(2)
  const pText = result.pValue < 0.001 ? 'p < 0.001' : `p = ${result.pValue.toFixed(3)}`
  const dfText = `${result.df}`

  const isSignificant = result.pValue < 0.05
  const interpretationText = isSignificant
    ? 'Answer key position is not independent of subject — at least one subject shows a distinct positional pattern.'
    : 'No evidence that answer key position depends on subject.'

  const POSITION_LABELS = ['A', 'B', 'C', 'D'] as const

  return (
    <>
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="answer-position-contingency-demo">
        <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Grid className="text-accent" size={16} />
            Answer Position vs. Subject (Independence Test)
          </h2>
          <span className="font-['JetBrains_Mono'] text-xs text-text-muted shrink-0 whitespace-nowrap">
            n = {testedN.toLocaleString()}
          </span>
        </div>

        {/* 4x4 Contingency Heatmap Grid */}
        <div className="w-full py-1">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-1.5 items-center">
            {/* Corner */}
            <div />
            {/* Column Labels */}
            {POSITION_LABELS.map((col) => (
              <div
                key={col}
                className="text-center font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold"
              >
                {col}
              </div>
            ))}

            {/* Rows */}
            {SUBJECTS.map((sub, rIdx) => {
              const rowCounts = table[rIdx]
              const rowMax = Math.max(...rowCounts)
              return (
                <React.Fragment key={sub}>
                  <div className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold text-right pr-2">
                    {sub}
                  </div>
                  {rowCounts.map((count, cIdx) => {
                    const ratio = rowMax > 0 ? count / rowMax : 0
                    const alpha = (0.15 + 0.6 * ratio).toFixed(3)
                    return (
                      <div
                        key={cIdx}
                        style={{ background: `rgba(0,255,65,${alpha})` }}
                        className="h-8 sm:h-9 flex items-center justify-center font-['JetBrains_Mono'] text-xs text-text-primary font-semibold rounded-sm border border-border-base"
                      >
                        {count}
                      </div>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-3" data-testid="contingency-interpretation">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div
              onClick={() => setActiveStatId('chiSquareIndependence')}
              role="button"
              tabIndex={0}
              className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
            >
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {chi2Text}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                χ²
              </span>
            </div>
            <div
              onClick={() => setActiveStatId('pValueIndependence')}
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
              onClick={() => setActiveStatId('dfIndependence')}
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

      {activeStatId && STAT_EXPLANATIONS[activeStatId] && (
        <StatInfoModal
          isOpen={!!activeStatId}
          onClose={() => setActiveStatId(null)}
          title={STAT_EXPLANATIONS[activeStatId].title}
          value={
            activeStatId === 'chiSquareIndependence'
              ? chi2Text
              : activeStatId === 'pValueIndependence'
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

export default AnswerPositionContingencyDemo
