import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { SUBJECT_LINE_COLOR } from '../../lib/dashboardUtils'
import { AccuracySubject } from '../../services/db.service'

interface AccuracyChartProps {
  data: Array<{ date: string; accuracy: number }>
  subject: string  // current subject filter
  isLoading: boolean
}

function AccuracyChart({ data, subject, isLoading }: AccuracyChartProps) {
  const selectedSubject = subject as AccuracySubject
  
  return (
    <div className="flex-1 w-full relative" style={{ minHeight: 200 }}>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#444] uppercase tracking-widest animate-pulse">
              Loading…
            </span>
          </motion.div>
        ) : data.length === 0 || data.every(d => d.accuracy === null) ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <p className="font-['Rajdhani'] uppercase tracking-widest text-[#444] text-sm font-bold">
              No data yet
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={`${selectedSubject}-chart`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <filter id="lineglow" x="-20%" y="-20%" width="140%" height="140%">
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
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#555', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  tickFormatter={(v: number) => `${v}%`}
                  width={38}
                />
                <ReferenceLine
                  y={50}
                  stroke="#2A2A2A"
                  strokeDasharray="4 4"
                  label={{ value: '50%', fill: '#3A3A3A', fontSize: 9, fontFamily: 'JetBrains Mono', position: 'insideTopRight' }}
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
                  itemStyle={{ color: SUBJECT_LINE_COLOR[selectedSubject] }}
                  formatter={(value: any) =>
                    value !== null ? [`${value}%`, 'Accuracy'] : ['—', 'No data']
                  }
                  cursor={{ stroke: '#2A2A2A', strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke={SUBJECT_LINE_COLOR[selectedSubject]}
                  strokeWidth={2}
                  filter="url(#lineglow)"
                  dot={(props: any) => {
                    const { cx, cy, payload, index } = props
                    if (payload.accuracy === null) return <g key={index} />
                    return (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill={SUBJECT_LINE_COLOR[selectedSubject]}
                        stroke="#1A1A1A"
                        strokeWidth={2}
                      />
                    )
                  }}
                  activeDot={{ r: 5, fill: SUBJECT_LINE_COLOR[selectedSubject], stroke: '#0D0D0D', strokeWidth: 2 }}
                  connectNulls={true}
                  animationDuration={500}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default React.memo(AccuracyChart)
