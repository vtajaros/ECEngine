import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Timer, AlertCircle } from 'lucide-react'
import { mean, median } from '../../../lib/stats/descriptive'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from './chartTooltipStyle'
import { useDataLabStore, ResponseTimeDistributionData } from '../../../store/useDataLabStore'
import { StatInfoModal } from './StatInfoModal'
import { STAT_EXPLANATIONS } from './statExplanations'

type ResponseTimeData = ResponseTimeDistributionData

function computeHistogram(timesInSeconds: number[]) {
  const counts = [0, 0, 0, 0, 0]
  timesInSeconds.forEach((t) => {
    if (t < 2) counts[0]++
    else if (t < 5) counts[1]++
    else if (t < 10) counts[2]++
    else if (t < 30) counts[3]++
    else counts[4]++
  })
  return [
    { range: '0-2s', count: counts[0] },
    { range: '2-5s', count: counts[1] },
    { range: '5-10s', count: counts[2] },
    { range: '10-30s', count: counts[3] },
    { range: '30s+', count: counts[4] },
  ]
}

export function ResponseTimeDemo() {
  const data = useDataLabStore((state) => state.responseTimeDistribution)
  const loading = useDataLabStore((state) => state.loading.responseTimeDistribution)
  const error = useDataLabStore((state) => state.errors.responseTimeDistribution)
  const fetchResponseTimeDistribution = useDataLabStore((state) => state.fetchResponseTimeDistribution)
  const [activeStat, setActiveStat] = useState<{ id: string; value: string } | null>(null)

  useEffect(() => {
    fetchResponseTimeDistribution()
  }, [fetchResponseTimeDistribution])

  useEffect(() => {
    const handleFocus = () => {
      fetchResponseTimeDistribution()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchResponseTimeDistribution])

  if (loading) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[300px] justify-center items-center">
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted uppercase tracking-widest animate-pulse">
          Loading response time distribution…
        </span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3 min-h-[300px] justify-center items-center text-center">
        <p className="font-['Rajdhani'] uppercase tracking-widest text-[#ef4444] text-sm font-bold">
          {error || 'Unable to load data'}
        </p>
      </div>
    )
  }

  const learnRows = data.learn ?? []
  const flashcardRows = data.flashcard ?? []
  const nLearn = learnRows.length
  const nFlashcard = flashcardRows.length
  const totalN = nLearn + nFlashcard
  const headerCountsText = `n(learn)=${nLearn} · n(flashcard)=${nFlashcard}`

  const isLearnSufficient = nLearn >= 10
  const isFlashcardSufficient = nFlashcard >= 10

  // Gate on insufficient data: if both modes are insufficient, show combined placeholder
  if (!isLearnSufficient && !isFlashcardSufficient) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="response-time-demo">
        <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Timer className="text-accent" size={16} />
            Response Time Distribution
          </h2>
          <span className="font-['JetBrains_Mono'] text-xs text-text-muted shrink-0 whitespace-nowrap">
            {headerCountsText}
          </span>
        </div>
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2" data-testid="insufficient-data-placeholder">
          <AlertCircle className="text-text-muted opacity-60" size={32} />
          <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-sm font-bold">
            Not enough response-time data yet (n = {totalN})
          </p>
          <p className="text-text-muted text-xs font-['JetBrains_Mono']">
            Keep studying and this will fill in automatically (minimum 10 attempts per mode required).
          </p>
        </div>
      </div>
    )
  }

  // Learn calculations (strictly unpooled)
  const learnSeconds = learnRows.map((r) => r.responseMs / 1000)
  const learnMean = mean(learnSeconds)
  const learnMedian = median(learnSeconds)
  const learnHistogram = computeHistogram(learnSeconds)

  // Flashcard calculations (strictly unpooled)
  const flashcardSeconds = flashcardRows.map((r) => r.responseMs / 1000)
  const flashcardMean = mean(flashcardSeconds)
  const flashcardMedian = median(flashcardSeconds)
  const flashcardHistogram = computeHistogram(flashcardSeconds)

  return (
    <>
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-4" data-testid="response-time-demo">
        <div className="flex items-center justify-between flex-wrap gap-x-2 gap-y-1 border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Timer className="text-accent" size={16} />
            Response Time Distribution
          </h2>
          <span className="font-['JetBrains_Mono'] text-xs text-text-muted shrink-0 whitespace-nowrap">
            {headerCountsText}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          {/* Learn Mode Subsection */}
          <div className="flex flex-col gap-3 bg-engine-black rounded-lg p-3.5 border border-border-subtle" data-testid="learn-mode-section">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-widest text-text-primary">
                Learn Mode (MCQ)
              </span>
              <span className="font-['JetBrains_Mono'] text-[11px] text-text-muted">
                n = {nLearn}
              </span>
            </div>

            {!isLearnSufficient ? (
              <div className="py-10 flex flex-col items-center justify-center text-center gap-2 border border-dashed border-border-subtle rounded-lg p-4 bg-surface/30" data-testid="learn-insufficient">
                <AlertCircle className="text-text-muted opacity-60" size={24} />
                <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-xs font-bold">
                  Insufficient Data (n = {nLearn} &lt; 10)
                </p>
                <p className="text-text-muted text-[11px] font-['JetBrains_Mono']">
                  At least 10 learn-mode attempts are needed to compute response time distribution.
                </p>
              </div>
            ) : (
              <>
                <div className="w-full h-44 relative">
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={120} debounce={300}>
                    <BarChart data={learnHistogram} margin={{ top: 12, right: 12, left: -20, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E1E1E" />
                      <XAxis
                        dataKey="range"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#666', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        wrapperStyle={{ outline: 'none' }}
                        formatter={(value: any) => [`${value} attempts`, 'Frequency']}
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#00FF41" animationDuration={600} animationEasing="ease-out" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div
                    onClick={() => setActiveStat({ id: 'responseTimeMean', value: `${learnMean.toFixed(1)}s` })}
                    role="button"
                    tabIndex={0}
                    className="bg-surface-2 rounded-lg p-2.5 border border-border-subtle flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
                  >
                    <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                      {learnMean.toFixed(1)}s
                    </span>
                    <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                      Mean
                    </span>
                  </div>
                  <div
                    onClick={() => setActiveStat({ id: 'responseTimeMedian', value: `${learnMedian.toFixed(1)}s` })}
                    role="button"
                    tabIndex={0}
                    className="bg-surface-2 rounded-lg p-2.5 border border-border-subtle flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
                  >
                    <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                      {learnMedian.toFixed(1)}s
                    </span>
                    <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                      Median
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Flashcard Mode Subsection */}
          <div className="flex flex-col gap-3 bg-engine-black rounded-lg p-3.5 border border-border-subtle" data-testid="flashcard-mode-section">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-widest text-text-primary">
                Flashcard Mode (SM-2)
              </span>
              <span className="font-['JetBrains_Mono'] text-[11px] text-text-muted">
                n = {nFlashcard}
              </span>
            </div>

            {!isFlashcardSufficient ? (
              <div className="py-10 flex flex-col items-center justify-center text-center gap-2 border border-dashed border-border-subtle rounded-lg p-4 bg-surface/30" data-testid="flashcard-insufficient">
                <AlertCircle className="text-text-muted opacity-60" size={24} />
                <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-xs font-bold">
                  Insufficient Data (n = {nFlashcard} &lt; 10)
                </p>
                <p className="text-text-muted text-[11px] font-['JetBrains_Mono']">
                  At least 10 flashcard reviews are needed to compute response time distribution.
                </p>
              </div>
            ) : (
              <>
                <div className="w-full h-44 relative">
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={120} debounce={300}>
                    <BarChart data={flashcardHistogram} margin={{ top: 12, right: 12, left: -20, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E1E1E" />
                      <XAxis
                        dataKey="range"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#666', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                        itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                        wrapperStyle={{ outline: 'none' }}
                        formatter={(value: any) => [`${value} cards`, 'Count']}
                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#00FF41" animationDuration={600} animationEasing="ease-out" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div
                    onClick={() => setActiveStat({ id: 'responseTimeMean', value: `${flashcardMean.toFixed(1)}s` })}
                    role="button"
                    tabIndex={0}
                    className="bg-surface-2 rounded-lg p-2.5 border border-border-subtle flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
                  >
                    <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                      {flashcardMean.toFixed(1)}s
                    </span>
                    <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                      Mean
                    </span>
                  </div>
                  <div
                    onClick={() => setActiveStat({ id: 'responseTimeMedian', value: `${flashcardMedian.toFixed(1)}s` })}
                    role="button"
                    tabIndex={0}
                    className="bg-surface-2 rounded-lg p-2.5 border border-border-subtle flex flex-col items-center justify-center text-center min-w-0 cursor-pointer hover:border-accent/50 transition-colors"
                  >
                    <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                      {flashcardMedian.toFixed(1)}s
                    </span>
                    <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">
                      Median
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {activeStat && STAT_EXPLANATIONS[activeStat.id] && (
        <StatInfoModal
          isOpen={!!activeStat}
          onClose={() => setActiveStat(null)}
          title={STAT_EXPLANATIONS[activeStat.id].title}
          value={activeStat.value}
          formula={STAT_EXPLANATIONS[activeStat.id].formula}
          description={STAT_EXPLANATIONS[activeStat.id].description}
          takeaway={STAT_EXPLANATIONS[activeStat.id].takeaway}
        />
      )}
    </>
  )
}

export default ResponseTimeDemo
