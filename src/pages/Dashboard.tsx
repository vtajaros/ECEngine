import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Library, Sigma, Download, Zap, BookMarked, BarChart2, TrendingUp, Calendar, Edit2, Activity, Clock, X } from 'lucide-react'
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
    flashcardCount: 0,
    mcqCount: 0,
    mcqAnswered: 0,
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

  const [history, setHistory] = useState<Record<string, { count: number, timeSpent: number }>>({})
  const [heatmapYear, setHeatmapYear] = useState<number>(new Date().getFullYear())
  
  const [selectedSubject, setSelectedSubject] = useState<AccuracySubject>('ALL')
  const [granularity, setGranularity]         = useState<AccuracyGranularity>('day')
  const [accuracyTrend, setAccuracyTrend]     = useState<{ date: string; acc: number | null }[]>([])
  const [trendLoading, setTrendLoading]       = useState(false)
  
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null)

  const SUBJECT_COLORS: Record<string, string> = {
    MATH: '#FB923C', GEAS: '#60A5FA', ELECS: '#F87171', EST: '#22C55E'
  }

  // Derive the list of calendar years that have any tracked activity
  const availableYears = React.useMemo(() => {
    const yearSet = new Set<number>()
    Object.keys(history).forEach(day => {
      const y = parseInt(day.slice(0, 4), 10)
      if (!isNaN(y)) yearSet.add(y)
    })
    // Always include the current year
    yearSet.add(new Date().getFullYear())
    return Array.from(yearSet).sort((a, b) => a - b)
  }, [history])

  const [examDate, setExamDate] = useState('2026-10-16')
  const [preboardDate, setPreboardDate] = useState<string | null>(null)

  useEffect(() => {
    window.electron.config.getSettings().then((settings) => {
      if (settings.examDate) setExamDate(settings.examDate)
      setPreboardDate(settings.preboardDate ?? null)
    }).catch(err => console.error('Failed to load settings', err))
  }, [])

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

      
      // Use real history for heatmap
      setHistory(activityHistory)

      setStatsData({
        totalDecks: globalStats.totalDecks,
        totalCards: globalStats.totalCards,
        flashcardCount: globalStats.flashcardCount ?? 0,
        mcqCount: globalStats.mcqCount ?? 0,
        mcqAnswered: globalStats.mcqAnswered ?? 0,
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



    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
  }

  const handleExamDateChange = (date: string) => {
    setExamDate(date)
    window.electron.config.updateSettings({ examDate: date }).catch(err => console.error('Failed to save examDate', err))
  }

  const handlePreboardDateChange = (date: string | null) => {
    setPreboardDate(date)
    window.electron.config.updateSettings({ preboardDate: date }).catch(err => console.error('Failed to save preboardDate', err))
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
    <div className="h-full bg-engine-black px-8 pb-4 pt-4 lg:px-12 lg:pb-6 lg:pt-4 overflow-y-auto overflow-x-hidden flex flex-col gap-4">
      {/* Header */}
      <header className="shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-['Orbitron'] text-3xl lg:text-4xl font-bold text-text-primary mb-1 tracking-wider">
            <span className="text-accent">ECE</span>ngine
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
          <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg flex flex-col flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
                <Library className="text-accent" size={13} />
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
          <div className="bg-surface p-5 rounded-xl border border-border-base shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center gap-2">
                <BarChart2 className="text-accent" size={13} />
                Session Stats
              </h2>
            </div>
            <div className="flex items-start gap-0 divide-x divide-[#2A2A2A]">
              <div className="flex flex-col gap-0.5 flex-1 pr-4">
                <span className="font-['Rajdhani'] text-[#666] uppercase tracking-widest text-[9px] font-bold">Studied</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-['IBM_Plex_Mono'] text-xl font-bold text-text-primary">{statsData.totalStudied || 0}</span>
                  <span className="font-['Rajdhani'] text-accent font-bold text-[9px]">CARDS</span>
                </div>
              </div>
              <div className="flex flex-col gap-0.5 flex-1 pl-4">
                <span className="font-['Rajdhani'] text-[#666] uppercase tracking-widest text-[9px] font-bold">Avg. Accuracy</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-['IBM_Plex_Mono'] text-xl font-bold text-text-primary">{statsData.accuracy || 0}</span>
                  <span className="font-['Rajdhani'] text-accent font-bold text-[9px]">%</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ACTIVITY HEATMAP (Swapped to Top) */}
        <div className="lg:col-span-3 p-8 bg-surface-2 rounded-xl border border-[rgba(0,255,65,0.05)] shadow-2xl flex flex-col items-center">
            <div className="flex items-center justify-between mb-8 w-full">
              <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center">
                <Clock className="mr-2 text-accent" size={16} />
                Activity Monitoring
              </h2>
              <div className="flex items-center gap-3">
                {/* Year pill tabs — only shown when multiple years of data exist */}
                {availableYears.length > 1 && (
                  <div className="flex items-center gap-1 bg-[#111] border border-border-base rounded-lg p-1">
                    {availableYears.map(y => (
                      <button
                        key={y}
                        onClick={() => setHeatmapYear(y)}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-['Rajdhani'] uppercase tracking-widest transition-all duration-200 ${
                          heatmapYear === y
                            ? 'bg-accent text-black'
                            : 'text-[#555] hover:text-text-primary hover:bg-border-base'
                        }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 text-[10px] font-['Rajdhani'] font-bold text-[#444] uppercase tracking-widest">
                  <span>0H</span>
                  <div className="w-3 h-3 rounded-sm bg-surface border border-border-subtle" />
                  <div className="w-3 h-3 rounded-sm bg-[#003311]" />
                  <div className="w-3 h-3 rounded-sm bg-[#006e21]" />
                  <div className="w-3 h-3 rounded-sm bg-[#00a630]" />
                  <div className="w-3 h-3 rounded-sm bg-accent" />
                  <span>4H+</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 w-full py-4 overflow-hidden">
              <ReviewHeatmap activityHistory={history} year={heatmapYear} />
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
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ACCURACY TREND */}
        <div className="lg:col-span-3 bg-surface border border-border-base rounded-xl p-4 shadow-xl relative overflow-hidden flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary uppercase tracking-widest flex items-center shrink-0">
              <Activity
                className="mr-2 shrink-0 transition-colors duration-300"
                size={16}
                style={{ color: SUBJECT_LINE_COLOR[selectedSubject] }}
              />
              {selectedSubject === 'ALL' ? 'Accuracy Trend' : `${selectedSubject} Accuracy`}
            </h2>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex flex-wrap gap-1 bg-[#111] p-1 rounded-lg border border-border-base">
                {(['ALL', 'MATH', 'GEAS', 'ELECS', 'EST'] as const).map(subj => (
                  <button
                    key={subj}
                    onClick={() => setSelectedSubject(subj)}
                    className={`px-3 py-1 text-[10px] font-bold font-['Rajdhani'] uppercase tracking-widest rounded transition-all duration-200 ${
                      selectedSubject === subj ? 'text-black' : 'text-text-muted hover:text-text-primary hover:bg-border-base'
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
                  className="appearance-none bg-[#111] border border-border-subtle text-text-muted text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest rounded-lg pl-3 pr-7 py-[6px] focus:outline-none focus:border-[#444] hover:text-text-primary cursor-pointer transition-colors"
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
                      className="flex items-center gap-1.5 text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-[#555] hover:text-text-primary transition-colors"
                    >
                      <span className="inline-block w-4 h-[2px] rounded-full" style={{ backgroundColor: SUBJECT_LINE_COLOR[s] }} />
                      {s}
                    </button>
                  ))}
                  <span className="text-text-muted font-['Rajdhani'] text-[9px] tracking-widest">↑ CLICK TO DRILL IN</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Study Progress Panel */}
        <div className="lg:col-span-2 p-5 bg-surface rounded-xl border border-border-base flex flex-col overflow-hidden">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary mb-4 uppercase tracking-widest border-b border-[#1E1E1E] pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp size={15} className="text-accent" />
              Study Progress
            </span>
            <span className="text-accent font-['IBM_Plex_Mono'] text-xs">
              {statsData.flashcardCount > 0
                ? Math.round((statsData.totalStudied / statsData.flashcardCount) * 100)
                : 0}% covered
            </span>
          </h2>

          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-surface-2 rounded-lg p-3 border border-border-base flex flex-col items-center">
              <span className="font-['IBM_Plex_Mono'] text-lg font-bold text-text-primary leading-none">{statsData.totalStudied}</span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1">Studied</span>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 border border-border-base flex flex-col items-center">
              <span className="font-['IBM_Plex_Mono'] text-lg font-bold text-accent leading-none">{statsData.internalized}</span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1">Mastered</span>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 border border-border-base flex flex-col items-center">
              <span className="font-['IBM_Plex_Mono'] text-lg font-bold text-text-primary leading-none">
                {(() => {
                  const totalSecs = Object.values(history).reduce((s, v) => s + v.timeSpent, 0)
                  const hrs = Math.floor(totalSecs / 3600)
                  const mins = Math.floor((totalSecs % 3600) / 60)
                  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
                })()}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1">Study Time</span>
            </div>
          </div>

          {/* Card type breakdown */}
          <div className="mb-4 space-y-2.5">
            {/* MCQ / LooksFam row */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-['Rajdhani'] font-bold text-[10px] uppercase tracking-widest text-[#666] flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-sm bg-blue-400 opacity-80" />
                  LooksFam MCQ Items
                </span>
                <span className="font-['IBM_Plex_Mono'] text-[10px] text-text-muted">
                  {statsData.mcqAnswered.toLocaleString()} / {statsData.mcqCount.toLocaleString()} answered
                </span>
              </div>
              <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden border border-border-base">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${statsData.mcqCount > 0 ? Math.min(100, Math.round((statsData.mcqAnswered / statsData.mcqCount) * 100)) : 0}%`,
                    background: 'linear-gradient(90deg, #60A5FA 0%, #3B82F6 100%)',
                    boxShadow: '0 0 8px #60A5FA40'
                  }}
                />
              </div>
              <p className="font-['Rajdhani'] text-[9px] text-text-muted mt-1 tracking-wider">
                MCQ progress tracks unique items answered
              </p>
            </div>
            {/* Flashcards / Formulas row */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-['Rajdhani'] font-bold text-[10px] uppercase tracking-widest text-[#666] flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-sm bg-accent opacity-80" />
                  Flashcards &amp; Formulas
                </span>
                <span className="font-['IBM_Plex_Mono'] text-[10px] text-text-muted">
                  {statsData.totalStudied} / {statsData.flashcardCount} studied
                </span>
              </div>
              <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden border border-border-base">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${statsData.flashcardCount > 0 ? Math.min(100, Math.round((statsData.totalStudied / statsData.flashcardCount) * 100)) : 0}%`,
                    background: 'linear-gradient(90deg, #00FF41 0%, #00CC33 100%)',
                    boxShadow: '0 0 8px #00FF4140'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Subject mastery bars */}
          <div className="flex flex-col gap-3 flex-1">
            <span className="font-['Rajdhani'] font-bold text-[10px] uppercase tracking-widest text-[#666]">Subject Mastery</span>
            {subjectProgress.map((item: { subject: string; percent: number }) => {
              const SUBJ_COLORS: Record<string, string> = {
                MATH: '#F97316', GEAS: '#60A5FA', ELECS: '#F87171', EST: '#22C55E'
              }
              const color = SUBJ_COLORS[item.subject] ?? '#555'
              return (
                <div key={item.subject}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-['Rajdhani'] font-bold text-[11px] uppercase tracking-widest text-[#666]">{item.subject}</span>
                    <span className="font-['IBM_Plex_Mono'] text-[11px]" style={{ color }}>{item.percent}%</span>
                  </div>
                  <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden border border-border-base">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${item.percent}%`,
                        backgroundColor: color,
                        boxShadow: item.percent > 0 ? `0 0 6px ${color}60` : 'none'
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Internalization footer */}
          <div className="mt-auto border-t border-[#1E1E1E] pt-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-[#666] font-bold">Internalization Rate</span>
              <span className="font-['IBM_Plex_Mono'] text-[11px] text-accent">
                {statsData.totalStudied > 0
                  ? Math.round((statsData.internalized / statsData.totalStudied) * 100)
                  : 0}%
              </span>
            </div>
            <div className="w-full bg-surface-2 h-1 rounded-full overflow-hidden border border-border-base mt-1.5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${statsData.totalStudied > 0 ? Math.min(100, Math.round((statsData.internalized / statsData.totalStudied) * 100)) : 0}%`,
                  background: 'linear-gradient(90deg, #00FF41 0%, #00AA30 100%)',
                  boxShadow: '0 0 6px #00FF4140'
                }}
              />
            </div>
            <p className="font-['Rajdhani'] text-[9px] text-text-muted mt-1.5 tracking-wider">
              Cards reviewed ≥5 times are considered mastered
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
