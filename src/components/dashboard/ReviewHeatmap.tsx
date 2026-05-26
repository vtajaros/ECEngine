import React, { useMemo } from 'react'

interface ReviewHeatmapProps {
  // activityHistory is a Record<dateString, { count: number; timeSpent: number }>
  // where dateString is 'YYYY-MM-DD' in local time
  activityHistory: Record<string, { count: number; timeSpent: number }>
  // number of months to display, default 6
  monthsToShow?: number
}

export default function ReviewHeatmap({ activityHistory, monthsToShow = 6 }: ReviewHeatmapProps) {
  // NOTE: date math uses local timezone — off-by-one risk near midnight
  const { grid, monthLabels, gridStartDate, gridEndDate } = useMemo(() => {
    const target = new Date()
    const endMonth = target.getMonth()
    const endYear = target.getFullYear()
    
    // End date: last day of the current month
    const endDate = new Date(endYear, endMonth + 1, 0)
    // Start date: first day of (monthsToShow - 1) months before
    const startDate = new Date(endYear, endMonth - (monthsToShow - 1), 1)
    
    const firstSunday = new Date(startDate)
    firstSunday.setDate(startDate.getDate() - startDate.getDay())
    
    const lastSaturday = new Date(endDate)
    lastSaturday.setDate(endDate.getDate() + (6 - endDate.getDay()))
    
    const weeks: string[][] = []
    let curr = new Date(firstSunday)
    
    while (curr <= lastSaturday) {
      const week = []
      for (let i = 0; i < 7; i++) {
        // Use local date parts to avoid UTC timezone shift at midnight
        const y = curr.getFullYear()
        const m = String(curr.getMonth() + 1).padStart(2, '0')
        const d = String(curr.getDate()).padStart(2, '0')
        week.push(`${y}-${m}-${d}`)
        curr.setDate(curr.getDate() + 1)
      }
      weeks.push(week)
    }

    const labels: { name: string; weekIndex: number }[] = []
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    
    let lastLabeledMonth = -1
    weeks.forEach((week, index) => {
      // Use Monday (index 1) as anchor — avoids partial-week skip when month
      // starts on Tue–Sat, which would push Sunday-anchored label to next column.
      const anchor = new Date(week[1] ?? week[0])
      const m = anchor.getMonth()

      // Only label if this is a new month and the anchor falls within our active window
      if (m !== lastLabeledMonth && anchor >= startDate && anchor <= endDate) {
        labels.push({ name: monthNames[m], weekIndex: index })
        lastLabeledMonth = m
      }
    })

    return { grid: weeks, monthLabels: labels, gridStartDate: startDate, gridEndDate: endDate }
  }, [monthsToShow])

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const getLevel = (timeSpent: number) => {
    if (!timeSpent) return 'bg-[#1A1A1A] border-[#2A2A2A]' 
    if (timeSpent < 60) return 'bg-[#003311] border-[#005511] shadow-[0_0_8px_rgba(0,51,17,0.4)]'
    if (timeSpent < 120) return 'bg-[#006e21] border-[#008821] shadow-[0_0_12px_rgba(0,110,33,0.5)]'
    if (timeSpent < 180) return 'bg-[#00a630] border-[#00bb30] shadow-[0_0_15px_rgba(0,166,48,0.6)]'
    return 'bg-[#00FF41] border-[#00FF41] shadow-[0_0_20px_rgba(0,255,65,0.7)]'
  }

  return (
    <div className="w-full max-w-full [--cell-size:16px] [--gap-size:8px]">
      <div className="flex justify-center pb-2">
        <div className="flex flex-col" style={{ minWidth: 'max-content' }}>
          {/* Month Labels */}
          <div className="relative h-5 mb-1">
            {monthLabels.map((label, i) => (
              <span
                key={i}
                className="absolute text-[11px] font-['Orbitron'] text-[#E8E8E8] opacity-70 font-bold uppercase tracking-[0.2em]"
                style={{ left: `calc(2.2rem + ${label.weekIndex} * (var(--cell-size) + var(--gap-size)))` }}
              >
                {label.name}
              </span>
            ))}
          </div>

          <div className="flex items-start gap-2">
            {/* Day Labels */}
            <div
              className="flex flex-col text-[10px] font-['Rajdhani'] text-[#666] font-bold uppercase tracking-widest leading-none gap-2 w-[1.8rem] pr-1"
            >
              {dayNames.map(d => (
                <span key={d} className="h-4 flex items-center">{d}</span>
              ))}
            </div>

            {/* Activity Grid */}
            <div className="flex gap-2">
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-2 w-4">
                  {week.map(day => {
                    const data = activityHistory[day] || { count: 0, timeSpent: 0 }
                    const timeH = Math.floor(data.timeSpent / 60)
                    const timeM = data.timeSpent % 60
                    const dateObj = new Date(day)
                    const isOutRange = dateObj < gridStartDate || dateObj > gridEndDate

                    return (
                      <div
                        key={day}
                        className={`w-4 h-4 rounded-[2px] ${getLevel(data.timeSpent)} transition-all hover:scale-125 cursor-help border shadow-sm ${isOutRange ? 'opacity-5' : ''}`}
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
    </div>
  )
}
