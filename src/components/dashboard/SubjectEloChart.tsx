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

function SubjectEloChart({ data, subject = 'ALL', isLoading = false }: SubjectEloChartProps) {
  const visibleSubjects = subject === 'ALL' ? SUBJECTS : [subject]
  const hasData =
    data.length > 0 &&
    data.some(d => visibleSubjects.some(s => d[s] !== null && d[s] !== undefined))

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
            <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                dy={10}
                interval="preserveStartEnd"
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
                contentStyle={{
                  backgroundColor: '#0D0D0D',
                  border: '1px solid #2A2A2A',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                  padding: '8px 12px',
                }}
                labelStyle={{ color: '#666', marginBottom: 4 }}
                formatter={(value: any, name: any) =>
                  value !== null && value !== undefined ? [`${value} Elo`, name] : ['—', name]
                }
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
