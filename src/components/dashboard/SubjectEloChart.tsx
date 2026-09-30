import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { GAUNTLET_SUBJECT_COLORS } from '../../lib/dashboardUtils'
import { SubjectEloPoint } from '../../lib/gauntlet'

interface SubjectEloChartProps {
  data: SubjectEloPoint[]
  subject?: 'ALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST'
  isLoading?: boolean
}

const SUBJECTS: Array<'MATH' | 'GEAS' | 'ELECS' | 'EST'> = ['MATH', 'GEAS', 'ELECS', 'EST']

// Custom tooltip that shows the actual ELO at the hovered point, not null-interpolated values
const CustomTooltip = ({
  active,
  payload,
  label,
  visibleSubjects,
}: {
  active?: boolean
  payload?: any[]
  label?: string | number
  visibleSubjects: Array<'MATH' | 'GEAS' | 'ELECS' | 'EST'>
}) => {
  if (!active || !payload || payload.length === 0) return null

  // Get the data point's date from the first payload entry
  const dateLabel = payload[0]?.payload?.date ?? label

  // Only show subjects that have a real (non-null) value at this exact point
  const validItems = payload.filter(
    (p) => p.dataKey && visibleSubjects.includes(p.dataKey) && p.value !== null && p.value !== undefined,
  )

  if (validItems.length === 0) return null

  return (
    <div
      style={{
        backgroundColor: '#0D0D0D',
        border: '1px solid #2A2A2A',
        borderRadius: 8,
        fontSize: 11,
        fontFamily: 'JetBrains Mono',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        padding: '8px 12px',
        minWidth: 120,
      }}
    >
      <div style={{ color: '#666', marginBottom: 4, fontSize: 10 }}>{dateLabel}</div>
      {validItems.map((item) => (
        <div key={item.dataKey} style={{ color: item.color ?? GAUNTLET_SUBJECT_COLORS[item.dataKey as keyof typeof GAUNTLET_SUBJECT_COLORS], fontWeight: 700, marginTop: 2 }}>
          {item.dataKey} : {Math.round(item.value)} Elo
        </div>
      ))}
    </div>
  )
}

function SubjectEloChart({ data, subject = 'ALL', isLoading = false }: SubjectEloChartProps) {
  const visibleSubjects = subject === 'ALL' ? SUBJECTS : [subject]
  const hasData =
    data.length > 0 &&
    data.some(d => visibleSubjects.some(s => d[s] !== null && d[s] !== undefined))

  // Enrich data with an index so each point has a unique x position
  const indexedData = data.map((d, i) => ({ ...d, _idx: i }))

  // Build tick positions spaced evenly across the data range to avoid crowding
  const maxTicks = 8
  const tickIndices: number[] = []
  if (data.length > 0) {
    if (data.length <= maxTicks) {
      for (let i = 0; i < data.length; i++) tickIndices.push(i)
    } else {
      tickIndices.push(0)
      const step = (data.length - 1) / (maxTicks - 1)
      for (let i = 1; i < maxTicks - 1; i++) tickIndices.push(Math.round(i * step))
      tickIndices.push(data.length - 1)
    }
  }

  return (
    <div className="flex-1 w-full relative" style={{ minHeight: 200 }}>
      {isLoading && !hasData ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-['JetBrains_Mono'] text-[10px] text-[#444] uppercase tracking-widest animate-pulse">
            Loading…
          </span>
        </div>
      ) : !hasData ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-['Rajdhani'] uppercase tracking-widest text-[#444] text-sm font-bold">
            No rated {subject !== 'ALL' ? subject : 'Gauntlet'} runs yet
          </p>
        </div>
      ) : (
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={indexedData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <filter id="elo-lineglow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E1E1E" />
              <XAxis
                dataKey="_idx"
                type="number"
                domain={[0, Math.max(0, indexedData.length - 1)]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                dy={10}
                ticks={tickIndices}
                tickFormatter={(idx: number) => {
                  const point = indexedData[idx]
                  return point?.date ?? ''
                }}
              />
              <YAxis
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(v: number) => Math.round(v).toString()}
                width={42}
              />
              <ReferenceLine
                y={1000}
                stroke="#2A2A2A"
                strokeDasharray="4 4"
                label={{ value: '1000 Base', fill: '#3A3A3A', fontSize: 9, fontFamily: 'JetBrains Mono', position: 'insideTopRight' }}
              />
              <Tooltip
                content={<CustomTooltip visibleSubjects={visibleSubjects} />}
                cursor={{ stroke: '#2A2A2A', strokeWidth: 1 }}
              />
              {visibleSubjects.map(subj => (
                <Line
                  key={subj}
                  type="monotone"
                  dataKey={subj}
                  name={subj}
                  stroke={GAUNTLET_SUBJECT_COLORS[subj]}
                  strokeWidth={2}
                  filter="url(#elo-lineglow)"
                  dot={(props: any) => {
                    const { cx, cy, payload, index } = props
                    if (payload[subj] === null || payload[subj] === undefined) return <g key={index} />
                    return (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill={GAUNTLET_SUBJECT_COLORS[subj]}
                        stroke="#1A1A1A"
                        strokeWidth={2}
                      />
                    )
                  }}
                  activeDot={{ r: 5, fill: GAUNTLET_SUBJECT_COLORS[subj], stroke: '#0D0D0D', strokeWidth: 2 }}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {isLoading && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 pointer-events-none">
              <span className="font-['JetBrains_Mono'] text-[9px] text-[#555] uppercase tracking-widest animate-pulse">
                Refreshing…
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default React.memo(SubjectEloChart)
