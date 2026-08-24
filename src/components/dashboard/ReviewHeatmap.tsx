import React, { useMemo, useRef, useEffect } from 'react'

interface ReviewHeatmapProps {
  activityHistory: Record<string, { count: number; timeSpent: number }>
  /** The calendar year to display (e.g. 2026). All months Jan–Dec of that year are shown. */
  year: number
}

export default function ReviewHeatmap({ activityHistory, year }: ReviewHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { grid, monthLabels, gridStartDate, gridEndDate, firstActiveWeekIndex } = useMemo(() => {
    const today = new Date()
    const isCurrentYear = year === today.getFullYear()

    // Show Jan 1 → Dec 31 (or today if current year)
    const startDate = new Date(year, 0, 1)
    const endDate = isCurrentYear
      ? new Date(today.getFullYear(), today.getMonth() + 1, 0)
      : new Date(year, 11, 31)

    // Align to the Sunday before Jan 1
    const firstSunday = new Date(startDate)
    firstSunday.setDate(startDate.getDate() - startDate.getDay())

    // Align to the Saturday after the end date
    const lastSaturday = new Date(endDate)
    lastSaturday.setDate(endDate.getDate() + (6 - endDate.getDay()))

    const weeks: string[][] = []
    let curr = new Date(firstSunday)

    while (curr <= lastSaturday) {
      const week: string[] = []
      for (let i = 0; i < 7; i++) {
        const y = curr.getFullYear()
        const m = String(curr.getMonth() + 1).padStart(2, '0')
        const d = String(curr.getDate()).padStart(2, '0')
        week.push(`${y}-${m}-${d}`)
        curr.setDate(curr.getDate() + 1)
      }
      weeks.push(week)
    }

    // Month labels — one per calendar month
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const labels: { name: string; weekIndex: number }[] = []
    let lastLabeledMonth = -1

    weeks.forEach((week, index) => {
      const anchor = new Date(week[1] ?? week[0])
      const m = anchor.getMonth()
      const anchorYear = anchor.getFullYear()
      if (m !== lastLabeledMonth && anchorYear === year && anchor >= startDate && anchor <= endDate) {
        labels.push({ name: monthNames[m], weekIndex: index })
        lastLabeledMonth = m
      }
    })

    // Find first week with any activity in this year
    let firstActiveWeekIndex = -1
    for (let wi = 0; wi < weeks.length; wi++) {
      const hasActivity = weeks[wi].some(day => {
        const d = new Date(day)
        if (d < startDate || d > endDate) return false
        return (activityHistory[day]?.timeSpent ?? 0) > 0
      })
      if (hasActivity) {
        firstActiveWeekIndex = wi
        break
      }
    }

    return { grid: weeks, monthLabels: labels, gridStartDate: startDate, gridEndDate: endDate, firstActiveWeekIndex }
  }, [year, activityHistory])

  // Auto-scroll so the first active week (or Jan) is visible on the left
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const CELL = 16, GAP = 8, DAY_COL = 35
    const targetWeek = firstActiveWeekIndex >= 0 ? Math.max(0, firstActiveWeekIndex - 1) : 0
    const scrollLeft = DAY_COL + targetWeek * (CELL + GAP)
    el.scrollLeft = scrollLeft
  }, [firstActiveWeekIndex, year])

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const getLevel = (timeSpent: number) => {
    if (!timeSpent) return 'bg-surface border-border-subtle'
    if (timeSpent <= 30) return 'bg-[#003311] border-[#005511] shadow-[0_0_8px_rgba(0,51,17,0.4)]'
    if (timeSpent <= 60) return 'bg-[#006e21] border-[#008821] shadow-[0_0_12px_rgba(0,110,33,0.5)]'
    if (timeSpent <= 90) return 'bg-[#00a630] border-[#00bb30] shadow-[0_0_15px_rgba(0,166,48,0.6)]'
    return 'bg-accent border-accent shadow-[0_0_20px_rgba(0,255,65,0.7)]'
  }

  return (
    <div className="w-full [--cell-size:16px] [--gap-size:8px] flex items-start gap-2">
      {/* Day labels — fixed outside the scroll area so they stay visible */}
      <div className="shrink-0 flex flex-col">
        {/* Spacer matching the month-label row height */}
        <div className="h-5 mb-1" />
        <div className="flex flex-col text-[10px] font-['Rajdhani'] text-[#666] font-bold uppercase tracking-widest leading-none gap-2 w-[1.8rem] pr-1">
          {dayNames.map(d => (
            <span key={d} className="h-4 flex items-center">{d}</span>
          ))}
        </div>
      </div>

      {/* Scrollable month labels + grid */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto pb-1"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex flex-col" style={{ minWidth: 'max-content' }}>
          {/* Month Labels */}
          <div className="relative h-5 mb-1">
            {monthLabels.map((label, i) => (
              <span
                key={i}
                className="absolute text-[11px] font-['Orbitron'] text-text-primary opacity-70 font-bold uppercase tracking-[0.2em]"
                style={{ left: `calc(${label.weekIndex} * (var(--cell-size) + var(--gap-size)))` }}
              >
                {label.name}
              </span>
            ))}
          </div>

          {/* Activity Grid */}
          <div className="flex gap-2">
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-2 w-4">
                {week.map(day => {
                  const data = activityHistory[day] || { count: 0, timeSpent: 0 }
                  const timeH = Math.floor(data.timeSpent / 60)
                  const timeM = Math.floor(data.timeSpent) % 60
                  const dateObj = new Date(day)
                  const isOutRange = dateObj < gridStartDate || dateObj > gridEndDate

                  return (
                    <div
                      key={day}
                      className={`w-4 h-4 rounded-[2px] ${getLevel(data.timeSpent)} transition-all hover:scale-125 cursor-help border shadow-sm ${isOutRange ? 'opacity-5 pointer-events-none' : ''}`}
                      title={isOutRange ? undefined : `${day}: ${timeH}h ${timeM}m study time`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
