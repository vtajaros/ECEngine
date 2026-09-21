import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Library, Sigma, Download, Zap, BookMarked, TrendingUp, Calendar, Edit2, Activity, Clock, X } from 'lucide-react'
import { dbService, AccuracyGranularity, AccuracySubject } from '../services/db.service'
import { motion, AnimatePresence } from 'framer-motion'

import { ReviewHeatmap, ExamCountdown, AccuracyChart, SessionHistory, FlashcardSchedule, SubjectDonutChart } from '../components/dashboard'
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
  const [trendLoading, setTrendLoading]       = useState(true)
  

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

  const loadDashboardData = useCallback(async () => {
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
  }, [])

  const handleExamDateChange = useCallback((date: string) => {
    setExamDate(date)
    window.electron.config.updateSettings({ examDate: date }).catch(err => console.error('Failed to save examDate', err))
  }, [])

  const handlePreboardDateChange = useCallback((date: string | null) => {
    setPreboardDate(date)
    window.electron.config.updateSettings({ preboardDate: date }).catch(err => console.error('Failed to save preboardDate', err))
  }, [])

  const accuracyChartData = useMemo(
    () => accuracyTrend.map(d => ({ date: d.date, accuracy: d.acc as any })),
    [accuracyTrend]
  )

  return (
    <div className="h-full bg-transparent px-8 pb-4 pt-4 lg:px-12 lg:pb-6 lg:pt-4 overflow-y-auto overflow-x-hidden flex flex-col gap-4">
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
        <div className="lg:col-span-1 flex flex-col gap-3">
          {/* Total Decks — donut chart */}
          <div className="bg-surface p-4 rounded-xl border border-border-base shadow-lg flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-['Rajdhani'] font-bold text-xs text-text-primary uppercase tracking-widest flex items-center gap-1.5">
                <Library className="text-accent" size={12} />
                Total Decks
              </h2>
            </div>

            {/* Donut + legend row */}
            <SubjectDonutChart subjectCounts={subjectCounts} />
          </div>

          <FlashcardSchedule />
        </div>

        {/* ACTIVITY HEATMAP (Swapped to Top) */}
        <div className="lg:col-span-3 p-4 sm:p-5 bg-surface-2 rounded-xl border border-[rgba(0,255,65,0.05)] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between mb-2 w-full shrink-0">
              <h2 className="font-['Rajdhani'] font-bold text-xs text-text-primary uppercase tracking-widest flex items-center">
                <Clock className="mr-1.5 text-accent" size={14} />
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
                  <div className="w-2.5 h-2.5 rounded-sm bg-surface border border-border-subtle" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#003311]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#006e21]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#00a630]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-accent" />
                  <span>2H+</span>
                </div>
              </div>
            </div>
            
            {/* Heatmap Area - Centered in remaining space */}
            <div className="flex-1 w-full flex flex-col justify-center items-center py-2 min-h-0">
              <div className="w-full overflow-hidden flex items-center justify-center">
                <ReviewHeatmap activityHistory={history} year={heatmapYear} />
              </div>
            </div>

            {/* Stats Footer */}
            <div className="shrink-0 flex items-center justify-center gap-0 divide-x divide-[#2A2A2A] pt-2 mt-auto">
              <div className="flex flex-col items-center gap-0.5 px-6">
                <span className="font-['Rajdhani'] text-[#666] uppercase tracking-widest text-[8.5px] font-bold">
                  Study Streak
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-['JetBrains_Mono'] text-base font-bold text-text-primary">
                    {statsData.streak || 0}
                  </span>
                  <span className="font-['Rajdhani'] text-accent font-bold text-[8.5px]">
                    {statsData.streak === 1 ? 'DAY' : 'DAYS'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-0.5 px-6">
                <span className="font-['Rajdhani'] text-[#666] uppercase tracking-widest text-[8.5px] font-bold">
                  Avg. Accuracy
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="font-['JetBrains_Mono'] text-base font-bold text-text-primary">
                    {statsData.accuracy || 0}
                  </span>
                  <span className="font-['Rajdhani'] text-accent font-bold text-[8.5px]">
                    %
                  </span>
                </div>
              </div>
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
                      selectedSubject === subj
                        ? (subj === 'ELECS' || subj === 'GEAS' ? 'text-white' : 'text-black')
                        : 'text-text-muted hover:text-text-primary hover:bg-border-base'
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
            data={accuracyChartData}
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
        <div className="lg:col-span-2 p-4 sm:p-5 bg-surface rounded-xl border border-border-base flex flex-col overflow-hidden">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-text-primary mb-3 sm:mb-4 uppercase tracking-widest border-b border-[#1E1E1E] pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <TrendingUp size={15} className="text-accent shrink-0" />
              <span className="whitespace-nowrap">Study Progress</span>
            </span>
            <span className="text-accent font-['JetBrains_Mono'] text-xs whitespace-nowrap">
              {(() => {
                const totalStudiedAll = statsData.totalStudied + statsData.mcqAnswered
                const totalCards = statsData.totalCards || (statsData.flashcardCount + statsData.mcqCount)
                if (totalCards <= 0 || totalStudiedAll <= 0) return '0% covered'
                const pct = (totalStudiedAll / totalCards) * 100
                return pct < 1 ? `${pct.toFixed(1)}% covered` : `${Math.round(pct)}% covered`
              })()}
            </span>
          </h2>

          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-4">
            <div className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0">
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base xl:text-lg font-bold text-text-primary leading-tight whitespace-nowrap">
                {(statsData.totalStudied + statsData.mcqAnswered).toLocaleString()}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">Studied</span>
            </div>
            <div className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0">
              <span className="font-['JetBrains_Mono'] text-sm sm:text-base xl:text-lg font-bold text-accent leading-tight whitespace-nowrap">
                {statsData.internalized.toLocaleString()}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">Mastered</span>
            </div>
            <div className="bg-surface-2 rounded-lg p-2 sm:p-3 border border-border-base flex flex-col items-center justify-center text-center min-w-0">
              <span className="font-['JetBrains_Mono'] text-xs sm:text-sm xl:text-base font-bold text-text-primary leading-tight whitespace-nowrap">
                {(() => {
                  const totalMins = Object.values(history).reduce((s, v) => s + (v.timeSpent || 0), 0)
                  const hrs = Math.floor(totalMins / 60)
                  const mins = Math.floor(totalMins % 60)
                  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
                })()}
              </span>
              <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-[#555] font-bold mt-1 whitespace-nowrap">Study Time</span>
            </div>
          </div>

          {/* Card type breakdown */}
          <div className="mb-4 space-y-2.5">
            {/* MCQ / LooksFam row */}
            <div>
              <div className="flex justify-between items-center mb-1 gap-2">
                <span className="font-['Rajdhani'] font-bold text-[10px] uppercase tracking-widest text-[#666] flex items-center gap-1.5 min-w-0 truncate">
                  <span className="inline-block w-2 h-2 rounded-sm bg-blue-400 opacity-80 shrink-0" />
                  <span className="truncate">LooksFam MCQ Items</span>
                </span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-text-muted shrink-0 whitespace-nowrap">
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
              <div className="flex justify-between items-center mb-1 gap-2">
                <span className="font-['Rajdhani'] font-bold text-[10px] uppercase tracking-widest text-[#666] flex items-center gap-1.5 min-w-0 truncate">
                  <span className="inline-block w-2 h-2 rounded-sm bg-accent opacity-80 shrink-0" />
                  <span className="truncate">Flashcards &amp; Formulas</span>
                </span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-text-muted shrink-0 whitespace-nowrap">
                  {statsData.totalStudied.toLocaleString()} / {statsData.flashcardCount.toLocaleString()} studied
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
              const color = (SUBJECT_LINE_COLOR as Record<string, string>)[item.subject] ?? '#555'
              return (
                <div key={item.subject}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-['Rajdhani'] font-bold text-[11px] uppercase tracking-widest text-[#666]">{item.subject}</span>
                    <span className="font-['JetBrains_Mono'] text-[11px]" style={{ color }}>{item.percent}%</span>
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
              <span className="font-['JetBrains_Mono'] text-[11px] text-accent">
                {(() => {
                  const totalStudiedAll = statsData.totalStudied + statsData.mcqAnswered
                  return totalStudiedAll > 0
                    ? Math.round((statsData.internalized / totalStudiedAll) * 100)
                    : 0
                })()}%
              </span>
            </div>
            <div className="w-full bg-surface-2 h-1 rounded-full overflow-hidden border border-border-base mt-1.5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(() => {
                    const totalStudiedAll = statsData.totalStudied + statsData.mcqAnswered
                    return totalStudiedAll > 0 ? Math.min(100, Math.round((statsData.internalized / totalStudiedAll) * 100)) : 0
                  })()}%`,
                  background: 'linear-gradient(90deg, #00FF41 0%, #00AA30 100%)',
                  boxShadow: '0 0 6px #00FF4140'
                }}
              />
            </div>
            <p className="font-['Rajdhani'] text-[9px] text-text-muted mt-1.5 tracking-wider">
              MCQs answered correctly &amp; flashcards with ≥2 repetitions are considered mastered
            </p>
          </div>
        </div>
      </div>

      {/* Row 3: Learn & Test Session History */}
      <div className="shrink-0">
        <SessionHistory onSessionUpdated={loadDashboardData} />
      </div>

    </div>
  )
}
