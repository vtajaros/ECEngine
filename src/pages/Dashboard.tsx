import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Library, Sigma, Download, Zap, BookMarked, BarChart2, TrendingUp, Calendar, Edit2, Activity, Clock, X, AlertCircle } from 'lucide-react'
import { getSubjectBadgeClasses } from '../lib/subjectColors'
import { dbService, AccuracyGranularity, AccuracySubject } from '../services/db.service'
import { motion, AnimatePresence } from 'framer-motion'

import { ReviewHeatmap, ExamCountdown, AccuracyChart } from '../components/dashboard'
import { SUBJECT_MAP, SUBJECT_LINE_COLOR } from '../lib/dashboardUtils'

// ── Components ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [statsData, setStatsData] = useState({
    totalDecks: 0,
    totalCards: 0,
    totalStudied: 0,
    internalized: 0,
    accuracy: 0,
    streak: 0,
    dueToday: 0
  })

  const [subjectCounts, setSubjectCounts] = useState<any[]>([
    { subject: 'MATH', count: 0 },
    { subject: 'GEAS', count: 0 },
    { subject: 'ELECS', count: 0 },
    { subject: 'EST', count: 0 },
  ])
  const [subjectProgress, setSubjectProgress] = useState<any[]>([])
  const [dueBySubject, setDueBySubject] = useState<{
    subject: string
    due_today: number
    due_d1: number; due_d2: number; due_d3: number
    due_d4: number; due_d5: number
    total_cards: number
  }[]>([])
  const [history, setHistory] = useState<Record<string, { count: number, timeSpent: number }>>({})
  
  const [selectedSubject, setSelectedSubject] = useState<AccuracySubject>('ALL')
  const [granularity, setGranularity]         = useState<AccuracyGranularity>('day')
  const [accuracyTrend, setAccuracyTrend]     = useState<{ date: string; acc: number | null }[]>([])
  const [trendLoading, setTrendLoading]       = useState(false)
  
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null)

  const SUBJECT_COLORS: Record<string, string> = {
    MATH: '#FB923C', GEAS: '#60A5FA', ELECS: '#F87171', EST: '#22C55E'
  }

  const [examDate, setExamDate] = useState(localStorage.getItem('ecengine_exam_date') || '2026-10-16')
  const [preboardDate, setPreboardDate] = useState<string | null>(
    localStorage.getItem('ecengine_preboard_date') || null
  )

  useEffect(() => {
    setTrendLoading(true)
    dbService.getAccuracyTrend(selectedSubject, granularity)
      .then(data => setAccuracyTrend(data))
      .catch(err => console.error('AccuracyTrend fetch failed:', err))
      .finally(() => setTrendLoading(false))
  }, [selectedSubject, granularity])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const dbStats = await dbService.getDashboardStats()
      const rawSubjectCounts = await dbService.getSubjectBreakdown()
      const globalStats = await dbService.getGlobalStats()
      const rawSubjectProgress = await dbService.getSubjectProgress()
      const activityHistory = await dbService.getActivityHistory()
      const rawDueBySubject = await dbService.getDueBySubject()
      
      // Use real history for heatmap
      setHistory(activityHistory)

      setStatsData({
        totalDecks: globalStats.totalDecks,
        totalCards: globalStats.totalCards,
        totalStudied: dbStats.totalStudied,
        internalized: globalStats.internalized,
        accuracy: dbStats.accuracy,
        streak: dbStats.streak,
        dueToday: dbStats.dueToday
      })

      const subjects = ['MATH', 'GEAS', 'ELECS', 'EST']
      const formattedCounts = subjects.map(s => {
        const found = rawSubjectCounts.find((r: any) => (SUBJECT_MAP[r.subject] || r.subject) === s)
        return { subject: s, count: found ? found.count : 0 }
      })
      setSubjectCounts(formattedCounts)

      const formattedProgress = subjects.map(s => {
        const found = rawSubjectProgress.find((r: any) => (SUBJECT_MAP[r.subject] || r.subject) === s)
        return {
          subject: s,
          percent: found && found.accuracy != null ? Math.round(found.accuracy * 100) : 0
        }
      })

      setSubjectProgress(formattedProgress)

      const formattedDue = subjects.map(s => {
        const found = rawDueBySubject.find((r: any) => (SUBJECT_MAP[r.subject] || r.subject) === s)
        return found ?? { subject: s, due_today: 0, due_d1: 0, due_d2: 0, due_d3: 0, due_d4: 0, due_d5: 0, total_cards: 0 }
      })
      setDueBySubject(formattedDue)

    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
  }

  const handleExamDateChange = (date: string) => {
    setExamDate(date)
    localStorage.setItem('ecengine_exam_date', date)
  }

  const handlePreboardDateChange = (date: string | null) => {
    if (date) {
      localStorage.setItem('ecengine_preboard_date', date)
    } else {
      localStorage.removeItem('ecengine_preboard_date')
    }
    setPreboardDate(date)
  }

  const getSubjectClasses = (subject: string) => {
    switch (subject) {
      case 'MATH': return 'text-orange-400 border-orange-500/20 bg-orange-500/10'
      case 'GEAS': return 'text-blue-400 border-blue-500/20 bg-blue-500/10'
      case 'ELECS': return 'text-red-400 border-red-500/20 bg-red-500/10'
      case 'EST': return 'text-green-500 border-green-600/20 bg-green-600/10'
      default: return 'text-zinc-400 border-zinc-500/20 bg-zinc-500/10'
    }
  }

  return (
    <div className="h-full bg-[#0D0D0D] px-8 pb-4 pt-4 lg:px-12 lg:pb-6 lg:pt-4 overflow-hidden flex flex-col gap-4">
      {/* Header */}
      <header className="shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Orbitron'] text-3xl lg:text-4xl font-bold text-[#E8E8E8] mb-1 tracking-wider">
            <span className="text-[#00FF41]">ECE</span>ngine
          </h1>
          <p className="text-[#666] font-['Rajdhani'] text-lg uppercase tracking-widest">
            Review Dashboard
          </p>
        </div>

        {/* Board Exam Countdown */}
        <ExamCountdown 
          examDate={examDate} 
          onExamDateChange={handleExamDateChange} 
          preboardDate={preboardDate}
          onPreboardDateChange={handlePreboardDateChange}
        />
      </header>

      {/* Analytics Row 1 */}
      <div className="shrink-0 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Condensed KPIs */}
        <div className="lg:col-span-1 flex flex-col gap-4 self-stretch">

          {/* Total Decks — donut chart */}
          <div className="bg-[#1A1A1A] p-5 rounded-xl border border-[#222] shadow-lg flex flex-col flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-['Rajdhani'] font-bold text-sm text-[#E8E8E8] uppercase tracking-widest flex items-center gap-2">
                <Library className="text-[#00FF41]" size={13} />
                Total Decks
              </h2>
            </div>

            {/* Donut + legend row */}
            <div className="flex flex-col items-center gap-4 flex-1 justify-center relative" onMouseLeave={() => setHoveredSubject(null)}>
              {/* SVG Donut */}
              {(() => {
                const total = subjectCounts.reduce((s, r) => s + r.count, 0) || 1
                const cx = 60, cy = 60, r = 46, stroke = 12
                const circumference = 2 * Math.PI * r
                let offset = 0
                const slices = subjectCounts.map(item => {
                  const pct = item.count / total
                  const dash = pct * circumference
                  const slice = { subject: item.subject, count: item.count, dash, offset, color: SUBJECT_COLORS[item.subject] ?? '#555' }
                  offset += dash
                  return slice
                })
                return (
                  <div className="relative">
                    <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
                      {/* Track */}
                      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#222" strokeWidth={stroke} />
                      {/* Slices */}
                      {slices.map((s, i) => {
                        const isHovered = hoveredSubject === s.subject
                        const isDimmed = hoveredSubject && hoveredSubject !== s.subject
                        return (
                          <circle
                            key={i}
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={s.color}
                            strokeWidth={isHovered ? stroke + 6 : stroke}
                            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                            strokeDashoffset={-(s.offset - circumference / 4)}
                            style={{ 
                              transition: 'stroke-width 0.2s ease, opacity 0.2s ease, stroke-dasharray 0.6s ease',
                              opacity: isDimmed ? 0.35 : 1,
                              cursor: 'pointer'
                            }}
                            onMouseEnter={() => setHoveredSubject(s.subject)}
                          />
                        )
                      })}
                      {/* Center label */}
                      <text x={cx} y={cy - 6} textAnchor="middle" fill="#E8E8E8"
                        fontSize="18" fontFamily="'IBM Plex Mono', monospace" fontWeight="bold">
                        {total}
                      </text>
                      <text x={cx} y={cy + 12} textAnchor="middle" fill="#555"
                        fontSize="9" fontFamily="'Rajdhani', sans-serif" fontWeight="bold"
                        letterSpacing="1">
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
                          className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white text-xs px-3 py-1 rounded-full whitespace-nowrap pointer-events-none z-10 shadow-xl border border-[#333]"
                        >
                          {(() => {
                            const activeSlice = slices.find(s => s.subject === hoveredSubject)
                            return activeSlice ? `${activeSlice.subject} — ${activeSlice.count} decks` : ''
                          })()}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })()}

              {/* Legend */}
              <div className="grid grid-cols-2 gap-1.5 w-full">
                {subjectCounts.map((item, i) => {
                  const isHovered = hoveredSubject === item.subject
                  const isDimmed = hoveredSubject && hoveredSubject !== item.subject
                  return (
                    <div 
                      key={i} 
                      onMouseEnter={() => setHoveredSubject(item.subject)}
                      className={`px-2 py-1 rounded border text-[9px] font-bold font-['Rajdhani'] uppercase tracking-wider text-center transition-all duration-200 cursor-pointer ${getSubjectClasses(item.subject)}`}
                      style={{
                        opacity: isDimmed ? 0.4 : 1,
                        boxShadow: isHovered ? `0 0 0 2px ${SUBJECT_COLORS[item.subject] ?? '#555'}40` : 'none',
                        borderColor: isHovered ? (SUBJECT_COLORS[item.subject] ?? '#555') : undefined
                      }}
                    >
                      {item.subject}: {item.count}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Cards Studied + Accuracy — merged */}
          <div className="bg-[#1A1A1A] p-5 rounded-xl border border-[#222] shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-['Rajdhani'] font-bold text-sm text-[#E8E8E8] uppercase tracking-widest flex items-center gap-2">
                <BarChart2 className="text-[#00FF41]" size={13} />
                Session Stats
              </h2>
            </div>
            <div className="flex items-start gap-0 divide-x divide-[#2A2A2A]">
              <div className="flex flex-col gap-0.5 flex-1 pr-4">
                <span className="font-['Rajdhani'] text-[#666] uppercase tracking-widest text-[9px] font-bold">Studied</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-['IBM_Plex_Mono'] text-xl font-bold text-[#E8E8E8]">{statsData.totalStudied || 0}</span>
                  <span className="font-['Rajdhani'] text-[#00FF41] font-bold text-[9px]">CARDS</span>
                </div>
              </div>
              <div className="flex flex-col gap-0.5 flex-1 pl-4">
                <span className="font-['Rajdhani'] text-[#666] uppercase tracking-widest text-[9px] font-bold">Avg. Accuracy</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-['IBM_Plex_Mono'] text-xl font-bold text-[#E8E8E8]">{statsData.accuracy || 0}</span>
                  <span className="font-['Rajdhani'] text-[#00FF41] font-bold text-[9px]">%</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ACTIVITY HEATMAP (Swapped to Top) */}
        <div className="lg:col-span-3 p-8 bg-[#161616] rounded-xl border border-[rgba(0,255,65,0.05)] shadow-2xl flex flex-col items-center">
            <div className="flex items-center justify-between mb-8 w-full">
              <h2 className="font-['Rajdhani'] font-bold text-sm text-[#E8E8E8] uppercase tracking-widest flex items-center">
                <Clock className="mr-2 text-[#00FF41]" size={16} />
                Activity Monitoring
              </h2>
              <div className="flex items-center gap-2 text-[10px] font-['Rajdhani'] font-bold text-[#444] uppercase tracking-widest">
                <span>0H</span>
                <div className="w-3 h-3 rounded-sm bg-[#1A1A1A] border border-[#2A2A2A]" />
                <div className="w-3 h-3 rounded-sm bg-[#003311]" />
                <div className="w-3 h-3 rounded-sm bg-[#006e21]" />
                <div className="w-3 h-3 rounded-sm bg-[#00a630]" />
                <div className="w-3 h-3 rounded-sm bg-[#00FF41]" />
                <span>4H+</span>
              </div>
            </div>
            
            <div className="flex-1 w-full flex justify-center py-4">
              <ReviewHeatmap activityHistory={history} />
            </div>

            {/* Streak Footer */}
            <div className="w-full flex items-center justify-center pt-2 pb-1">
              <p className="font-['Rajdhani'] uppercase tracking-widest text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>
                Study Streak:&nbsp;
                <span style={{ color: 'var(--accent-primary)' }}>{statsData.streak || 0} Day{statsData.streak !== 1 ? 's' : ''}</span>
              </p>
            </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ACCURACY TREND */}
        <div className="lg:col-span-3 bg-[#1A1A1A] border border-[#222] rounded-xl p-4 shadow-xl relative overflow-hidden flex flex-col min-h-0">

          {/* Header */}
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="font-['Rajdhani'] font-bold text-sm text-[#E8E8E8] uppercase tracking-widest flex items-center shrink-0">
              <Activity
                className="mr-2 shrink-0 transition-colors duration-300"
                size={16}
                style={{ color: SUBJECT_LINE_COLOR[selectedSubject] }}
              />
              {selectedSubject === 'ALL' ? 'Accuracy Trend' : `${selectedSubject} Accuracy`}
            </h2>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex flex-wrap gap-1 bg-[#111] p-1 rounded-lg border border-[#222]">
                {(['ALL', 'MATH', 'GEAS', 'ELECS', 'EST'] as const).map(subj => (
                  <button
                    key={subj}
                    onClick={() => setSelectedSubject(subj)}
                    className={`px-3 py-1 text-[10px] font-bold font-['Rajdhani'] uppercase tracking-widest rounded transition-all duration-200 ${
                      selectedSubject === subj ? 'text-black' : 'text-[#888] hover:text-[#E8E8E8] hover:bg-[#222]'
                    }`}
                    style={selectedSubject === subj ? { backgroundColor: SUBJECT_LINE_COLOR[subj] } : {}}
                  >
                    {subj}
                  </button>
                ))}
              </div>

              <div className="relative">
                <select
                  value={granularity}
                  onChange={e => setGranularity(e.target.value as AccuracyGranularity)}
                  className="appearance-none bg-[#111] border border-[#2A2A2A] text-[#888] text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest rounded-lg pl-3 pr-7 py-[6px] focus:outline-none focus:border-[#444] hover:text-[#E8E8E8] cursor-pointer transition-colors"
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" width="8" height="5" viewBox="0 0 8 5" fill="none">
                  <path d="M0 0L4 5L8 0" fill="#555" />
                </svg>
              </div>
            </div>
          </div>

          {/* Chart */}
          <AccuracyChart
            data={accuracyTrend.map(d => ({ date: d.date, accuracy: d.acc as any }))}
            subject={selectedSubject}
            isLoading={trendLoading}
          />

          {/* Footer drill-down legend — ALL tab only */}
          <AnimatePresence>
            {selectedSubject === 'ALL' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex gap-4 justify-center items-center pt-4 border-t border-[#1E1E1E] mt-4">
                  {(['MATH', 'GEAS', 'ELECS', 'EST'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSelectedSubject(s)}
                      className="flex items-center gap-1.5 text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-[#555] hover:text-[#E8E8E8] transition-colors"
                    >
                      <span className="inline-block w-4 h-[2px] rounded-full" style={{ backgroundColor: SUBJECT_LINE_COLOR[s] }} />
                      {s}
                    </button>
                  ))}
                  <span className="text-[#333] font-['Rajdhani'] text-[9px] tracking-widest">↑ CLICK TO DRILL IN</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Due Cards Panel */}
        <div className="lg:col-span-2 p-4 bg-[#111111] rounded-xl border border-[#161616] flex flex-col min-h-0 overflow-hidden">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-[#E8E8E8] mb-3 uppercase tracking-widest border-b border-[#1E1E1E] pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle size={15} className="text-[#00FF41]" />
              Due Cards
            </span>
            <span className="text-[#00FF41] font-['IBM_Plex_Mono'] text-xs">
              {dueBySubject.reduce((s, r) => s + r.due_today, 0)} today
            </span>
          </h2>

          {/* Per-subject rows */}
          <div className="flex flex-col gap-2 mb-3">
            {(['MATH', 'GEAS', 'ELECS', 'EST'] as const).map(subj => {
              const row = dueBySubject.find(r => r.subject === subj)
              const dueToday = row?.due_today ?? 0
              const total = row?.total_cards ?? 0
              const pct = total > 0 ? Math.min(100, Math.round((dueToday / total) * 100)) : 0
              const SUBJECT_COLORS: Record<string, string> = {
                MATH: '#F97316', GEAS: '#60A5FA', ELECS: '#F87171', EST: '#00FF41'
              }
              const color = SUBJECT_COLORS[subj]
              return (
                <div key={subj}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-['Rajdhani'] font-bold text-[11px] uppercase tracking-widest text-[#666]">{subj}</span>
                    <span className="font-['IBM_Plex_Mono'] text-[11px]" style={{ color: dueToday > 0 ? color : '#444' }}>
                      {dueToday} / {total}
                    </span>
                  </div>
                  <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden border border-[#222]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                        boxShadow: dueToday > 0 ? `0 0 6px ${color}60` : 'none'
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* 5-day upcoming sparkline */}
          <div className="mt-auto border-t border-[#1E1E1E] pt-3">
            <p className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-[#444] mb-2 font-bold">Upcoming 5 days</p>
            <div className="flex items-end gap-1.5 h-12">
              {[1, 2, 3, 4, 5].map(d => {
                const key = `due_d${d}` as 'due_d1'|'due_d2'|'due_d3'|'due_d4'|'due_d5'
                const count = dueBySubject.reduce((sum, r) => sum + (r[key] ?? 0), 0)
                const maxCount = Math.max(1, ...[1,2,3,4,5].map(x =>
                  dueBySubject.reduce((sum, r) => sum + (r[`due_d${x}` as typeof key] ?? 0), 0)
                ))
                const heightPct = Math.max(8, Math.round((count / maxCount) * 100))
                const today = new Date()
                const futureDate = new Date(today)
                futureDate.setDate(today.getDate() + d)
                const label = futureDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
                return (
                  <div key={d} className="flex-1 flex flex-col items-center gap-1">
                    <span className="font-['IBM_Plex_Mono'] text-[9px] text-[#555]">{count > 0 ? count : ''}</span>
                    <div className="w-full flex items-end" style={{ height: '36px' }}>
                      <div
                        className="w-full rounded-sm transition-all duration-700"
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor: count > 0 ? '#00FF41' : '#1A1A1A',
                          opacity: count > 0 ? 0.7 : 1,
                          border: '1px solid #222'
                        }}
                      />
                    </div>
                    <span className="font-['Rajdhani'] text-[9px] text-[#444] font-bold">{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
