import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSubjectBadgeClasses } from '../../lib/subjectColors'

interface SubjectDonutChartProps {
  subjectCounts: { subject: string; count: number }[]
}

const SUBJECT_COLORS: Record<string, string> = {
  MATH: '#f59e0b',
  GEAS: '#3b82f6',
  ELECS: '#ef4444',
  EST: '#22c55e',
}

export const SubjectDonutChart = React.memo(function SubjectDonutChart({ subjectCounts }: SubjectDonutChartProps) {
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null)

  const { total, slices, circumference, cx, cy, r, stroke } = useMemo(() => {
    const total = subjectCounts.reduce((s, r) => s + r.count, 0) || 1
    const cx = 48, cy = 48, r = 36, stroke = 9
    const circumference = 2 * Math.PI * r
    let offset = 0
    const slices = subjectCounts.map(item => {
      const pct = item.count / total
      const dash = pct * circumference
      const slice = {
        subject: item.subject,
        count: item.count,
        dash,
        offset,
        color: SUBJECT_COLORS[item.subject] ?? '#555',
      }
      offset += dash
      return slice
    })
    return { total, slices, circumference, cx, cy, r, stroke }
  }, [subjectCounts])

  return (
    <div
      className="flex flex-col items-center gap-2.5 justify-center relative"
      onMouseLeave={() => setHoveredSubject(null)}
    >
      {/* SVG Donut */}
      <div className="relative">
        <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#222" strokeWidth={stroke} />
          {/* Slices */}
          {slices.map((s, i) => {
            const isHovered = hoveredSubject === s.subject
            const isDimmed = hoveredSubject && hoveredSubject !== s.subject
            return (
              <circle
                key={s.subject}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                strokeDashoffset={-(s.offset - circumference / 4)}
                style={{
                  transition: 'opacity 0.2s ease, filter 0.2s ease',
                  opacity: isDimmed ? 0.35 : 1,
                  filter: isHovered ? `drop-shadow(0 0 5px ${s.color}) brightness(1.25)` : undefined,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredSubject(s.subject)}
                onMouseLeave={() => setHoveredSubject(null)}
              />
            )
          })}
          {/* Center label */}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fill="#E8E8E8"
            fontSize="15"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="bold"
          >
            {total}
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            fill="#555"
            fontSize="8"
            fontFamily="'Rajdhani', sans-serif"
            fontWeight="bold"
            letterSpacing="1"
          >
            DECKS
          </text>
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredSubject && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface text-white text-xs px-3 py-1 rounded-full whitespace-nowrap pointer-events-none z-10 shadow-xl border border-[#333]"
            >
              {(() => {
                const activeSlice = slices.find(s => s.subject === hoveredSubject)
                return activeSlice ? `${activeSlice.subject} — ${activeSlice.count} decks` : ''
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-1 w-full">
        {subjectCounts.map((item) => {
          const isHovered = hoveredSubject === item.subject
          const isDimmed = hoveredSubject && hoveredSubject !== item.subject
          return (
            <div
              key={item.subject}
              onMouseEnter={() => setHoveredSubject(item.subject)}
              onMouseLeave={() => setHoveredSubject(null)}
              className={`px-1.5 py-0.5 rounded border text-[8.5px] font-bold font-['Rajdhani'] uppercase tracking-wider text-center transition-all duration-200 cursor-pointer ${getSubjectBadgeClasses(item.subject)}`}
              style={{
                opacity: isDimmed ? 0.4 : 1,
                boxShadow: isHovered ? `0 0 0 2px ${SUBJECT_COLORS[item.subject] ?? '#555'}40` : 'none',
                borderColor: isHovered ? (SUBJECT_COLORS[item.subject] ?? '#555') : undefined,
              }}
            >
              {item.subject}: {item.count}
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default SubjectDonutChart
