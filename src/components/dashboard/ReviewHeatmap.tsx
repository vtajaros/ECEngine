import React, { useMemo, useRef, useEffect } from 'react'
import { Tooltip } from '../ui/Tooltip'

interface ReviewHeatmapProps {
  activityHistory: Record<string, { count: number; timeSpent: number }>
  /** The calendar year to display (e.g. 2026). Starts from the first month with study activity in that year. */
  year?: number
  /** Number of months to show starting from the first active month. Defaults to 6. */
  monthsToShow?: number
}

function ReviewHeatmap({ activityHistory, year, monthsToShow = 6 }: ReviewHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { grid, monthLabels, startDateStr, endDateStr, firstActiveWeekIndex } = useMemo(() => {
    const today = new Date()
    const targetYear = year ?? today.getFullYear()
    const isCurrentYear = targetYear === today.getFullYear()

    // Find the first month in this year with study activity (count > 0 or timeSpent > 0)
    const activeDaysInYear = Object.keys(activityHistory).filter(day => {
      if (!day.startsWith(`${targetYear}-`)) return false
      const data = activityHistory[day]
      return Boolean(data && ((data.count ?? 0) > 0 || (data.timeSpent ?? 0) > 0))
    }).sort()

    let startYear = targetYear
    let startMonth = 0

    if (activeDaysInYear.length > 0) {
      const earliestDay = activeDaysInYear[0]
      const parsedMonth = parseInt(earliestDay.slice(5, 7), 10) - 1
      if (!isNaN(parsedMonth) && parsedMonth >= 0 && parsedMonth <= 11) {
        startMonth = parsedMonth
      }
    } else if (isCurrentYear) {
      // If current year and no activity yet, default to the current month
      startMonth = today.getMonth()
    }

    if (isCurrentYear) {
      // Don't start after current month in current year
      startMonth = Math.min(startMonth, today.getMonth())
    }

    const startDate = new Date(startYear, startMonth, 1)

    // Calculate minimum end date: monthsToShow months starting from startMonth
    const minEndDate = new Date(startYear, startMonth + monthsToShow, 0)
    let endDate = minEndDate

    // If active days extend beyond minEndDate, extend endDate to include that month
    const activeDays = Object.keys(activityHistory).filter(day => {
      const data = activityHistory[day]
      return Boolean(data && ((data.count ?? 0) > 0 || (data.timeSpent ?? 0) > 0))
    }).sort()

    if (activeDays.length > 0) {
      const latestDay = activeDays[activeDays.length - 1]
      const latestYear = parseInt(latestDay.slice(0, 4), 10)
      const latestMonth = parseInt(latestDay.slice(5, 7), 10) - 1
      const latestMonthEnd = new Date(latestYear, latestMonth + 1, 0)
      if (latestMonthEnd > endDate) {
        endDate = latestMonthEnd
      }
    }

    // In the current year, also ensure today's month is included if it's beyond minEndDate
    if (isCurrentYear) {
      const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      if (currentMonthEnd > endDate) {
        endDate = currentMonthEnd
      }
    }

    // Date formatting helper
    const pad = (n: number) => String(n).padStart(2, '0')
    const sDateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`
    const eDateStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`

    // Align to the Sunday before or on startDate
    const firstSunday = new Date(startDate)
    firstSunday.setDate(startDate.getDate() - startDate.getDay())

    // Align to the Saturday on or after endDate
    const lastSaturday = new Date(endDate)
    lastSaturday.setDate(endDate.getDate() + (6 - endDate.getDay()))

    const weeks: string[][] = []
    const curr = new Date(firstSunday)

    while (curr <= lastSaturday) {
      const week: string[] = []
      for (let i = 0; i < 7; i++) {
        const y = curr.getFullYear()
        const m = pad(curr.getMonth() + 1)
        const d = pad(curr.getDate())
        week.push(`${y}-${m}-${d}`)
        curr.setDate(curr.getDate() + 1)
      }
      weeks.push(week)
    }

    // Month labels — one per calendar month in the displayed range
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const labels: { name: string; weekIndex: number }[] = []

    const iterDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    while (iterDate <= endDate) {
      const m = iterDate.getMonth()
      const y = iterDate.getFullYear()
      const targetDayStr = `${y}-${pad(m + 1)}-01`

      const weekIndex = weeks.findIndex(week => week.includes(targetDayStr))
      if (weekIndex !== -1) {
        labels.push({ name: monthNames[m], weekIndex })
      }

      iterDate.setMonth(iterDate.getMonth() + 1)
    }

    // Find first week with any activity in this range
    let firstActiveWeekIndex = -1
    for (let wi = 0; wi < weeks.length; wi++) {
      const hasActivity = weeks[wi].some(day => {
        if (day < sDateStr || day > eDateStr) return false
        const data = activityHistory[day]
        return Boolean(data && ((data.timeSpent ?? 0) > 0 || (data.count ?? 0) > 0))
      })
      if (hasActivity) {
        firstActiveWeekIndex = wi
        break
      }
    }

    return { grid: weeks, monthLabels: labels, startDateStr: sDateStr, endDateStr: eDateStr, firstActiveWeekIndex }
  }, [year, monthsToShow, activityHistory])

  // Auto-scroll so the first active week is visible on the left
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const CELL = 20, GAP = 8
    const targetWeek = firstActiveWeekIndex >= 0 ? Math.max(0, firstActiveWeekIndex - 1) : 0
    const scrollLeft = targetWeek * (CELL + GAP)
    el.scrollLeft = scrollLeft
  }, [firstActiveWeekIndex, year])

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const getLevel = (timeSpent: number, count?: number) => {
    if (!timeSpent && !count) return 'bg-surface border-border-subtle'
    if (timeSpent <= 30) return 'bg-[#003311] border-[#005511] shadow-[0_0_8px_rgba(0,51,17,0.4)]'
    if (timeSpent <= 60) return 'bg-[#006e21] border-[#008821] shadow-[0_0_12px_rgba(0,110,33,0.5)]'
    if (timeSpent <= 90) return 'bg-[#00a630] border-[#00bb30] shadow-[0_0_15px_rgba(0,166,48,0.6)]'
    return 'bg-accent border-accent shadow-[0_0_20px_rgba(0,255,65,0.7)]'
  }

  return (
    <div className="w-auto max-w-full [--cell-size:20px] [--gap-size:8px] flex items-start justify-center gap-2">
      {/* Day labels — fixed outside the scroll area so they stay visible */}
      <div className="shrink-0 flex flex-col">
        {/* Spacer matching the month-label row height */}
        <div className="h-5 mb-1" />
        <div className="flex flex-col text-[10px] font-['Rajdhani'] text-[#666] font-bold uppercase tracking-widest leading-none gap-2 w-[1.8rem] pr-1">
          {dayNames.map(d => (
            <span key={d} className="h-5 flex items-center">{d}</span>
          ))}
        </div>
      </div>

      {/* Scrollable month labels + grid */}
      <div
        ref={scrollRef}
        className="overflow-x-auto min-w-0 pb-1"
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
              <div key={wi} className="flex flex-col gap-2 w-5">
                {week.map(day => {
                  const data = activityHistory[day] || { count: 0, timeSpent: 0 }
                  const timeH = Math.floor(data.timeSpent / 60)
                  const timeM = Math.floor(data.timeSpent) % 60
                  const isOutRange = day < startDateStr || day > endDateStr

                  if (isOutRange) {
                    return (
                      <div
                        key={day}
                        data-date={day}
                        className={`w-5 h-5 rounded-[2.5px] ${getLevel(data.timeSpent, data.count)} opacity-5 pointer-events-none border shadow-sm`}
                      />
                    )
                  }

                  return (
                    <Tooltip
                      key={day}
                      content={`${day}: ${timeH}h ${timeM}m study time`}
                      position="top"
                    >
                      <div
                        data-date={day}
                        className={`w-5 h-5 rounded-[2.5px] ${getLevel(data.timeSpent, data.count)} transition-all hover:scale-125 cursor-help border shadow-sm`}
                      />
                    </Tooltip>
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

export default React.memo(ReviewHeatmap)
