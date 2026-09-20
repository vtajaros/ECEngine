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
import { Layers } from 'lucide-react'
import { dbService } from '../../../services/db.service'
import { TOS_SUBJECT_WEIGHTS } from '../../toc/tosItems'
import { SUBJECT_LINE_COLOR } from '../../../lib/dashboardUtils'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from './chartTooltipStyle'
import { useDataVersionStore } from '../../../store/useDataVersionStore'

const SUBJECTS = ['MATH', 'GEAS', 'ELECS', 'EST'] as const

export function ContentCoverageDemo() {
  const dataVersion = useDataVersionStore((state) => state.version)
  const [data, setData] = useState<Record<string, { topics: number; cards: number }> | null>(null)
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
      .getContentCoverage()
      .then((res) => {
        if (isMountedRef.current) {
          setData(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMountedRef.current) {
          setError(err.message || 'Failed to load content coverage')
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
          Loading content coverage…
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

  const chartData = SUBJECTS.map((sub) => {
    const item = data[sub] || { topics: 0, cards: 0 }
    return {
      subject: sub,
      cards: item.cards,
      topics: item.topics,
      fill: SUBJECT_LINE_COLOR[sub] || '#00FF41',
    }
  })

  const totalCards = chartData.reduce((sum, d) => sum + d.cards, 0)
  const totalTopics = chartData.reduce((sum, d) => sum + d.topics, 0)

  // Empty state for fresh installs with zero cards
  if (totalCards === 0) {
    return (
      <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-border-base/50 pb-2.5">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Layers className="text-accent" size={16} />
            Content Coverage vs. PRC ToS Target
          </h2>
        </div>
        <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
          <p className="font-['Rajdhani'] uppercase tracking-widest text-text-muted text-sm font-bold">
            No cards found in library
          </p>
          <p className="text-text-muted text-xs font-['JetBrains_Mono']">
            Import or create study decks to visualize subject coverage distributions.
          </p>
        </div>
      </div>
    )
  }

  // Compute interpretation comparing share of total cards to PRC ToS subject weight
  const subjectTiles = SUBJECTS.map((sub) => {
    const count = data[sub]?.cards ?? 0
    const pct = (count / totalCards) * 100
    const target = TOS_SUBJECT_WEIGHTS[sub] ?? 25
    const diff = pct - target
    const sign = diff >= 0 ? '+' : ''
    return {
      sub,
      pct: pct.toFixed(1),
      diffLabel: `${sign}${diff.toFixed(1)}% vs ${target.toFixed(0)}% ToS weight`,
    }
  })

  return (
    <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col gap-3" data-testid="content-coverage-demo">
      <div className="flex items-center justify-between border-b border-border-base/50 pb-2.5">
        <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
          <Layers className="text-accent" size={16} />
          Content Coverage vs. PRC ToS Target
        </h2>
        <span className="font-['JetBrains_Mono'] text-xs text-text-muted">
          {totalCards.toLocaleString()} cards · {totalTopics} topics
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
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              labelStyle={CHART_TOOLTIP_LABEL_STYLE}
              itemStyle={CHART_TOOLTIP_ITEM_STYLE}
              wrapperStyle={{ outline: 'none' }}
              formatter={(value: any, _name: any, item: any) => [
                `${Number(value).toLocaleString()} cards (${item.payload.topics} topics)`,
                'Cards',
              ]}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="cards" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={`cell-${entry.subject}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-2 border-t border-border-base/40">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2" data-testid="coverage-interpretation">
          {subjectTiles.map(({ sub, pct, diffLabel }) => (
            <div
              key={sub}
              className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0"
            >
              <span
                className="font-['Rajdhani'] text-[10px] uppercase tracking-widest font-bold mb-0.5"
                style={{ color: SUBJECT_LINE_COLOR[sub] || '#888' }}
              >
                {sub}
              </span>
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {pct}%
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 leading-tight">
                {diffLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
export default ContentCoverageDemo
