import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Library, Sigma, Download, Zap, BookMarked, BarChart2, TrendingUp, Check, Calendar, Edit2, Activity, Clock, X, AlertCircle } from 'lucide-react'
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
  const [history, setHistory] = useState<Record<string, { count: number, timeSpent: number }>>({})
  
  const [selectedSubject, setSelectedSubject] = useState<AccuracySubject>('ALL')
  const [granularity, setGranularity]         = useState<AccuracyGranularity>('day')
  const [accuracyTrend, setAccuracyTrend]     = useState<{ date: string; acc: number | null }[]>([])
  const [trendLoading, setTrendLoading]       = useState(false)
  
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
    <div className="h-full bg-[#0D0D0D] px-8 pb-8 pt-4 lg:px-12 lg:pb-12 lg:pt-4 overflow-y-auto no-scrollbar">
      {/* Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* Condensed KPIs */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-[#1A1A1A] p-4 rounded-xl border border-[#222] shadow-lg flex flex-col justify-between min-h-[130px]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#666] font-['Rajdhani'] uppercase tracking-widest text-[10px] font-bold">Total Decks</p>
              <Library className="text-[#00FF41]/10" size={16} />
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-['IBM_Plex_Mono'] text-2xl font-bold text-[#E8E8E8]">{statsData.totalDecks}</span>
              <span className="font-['Rajdhani'] text-[#00FF41] font-bold text-[10px]">DECKS</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-auto">
              {subjectCounts.map((item, i) => (
                <div key={i} className={`px-2 py-1 rounded border text-[9px] font-bold font-['Rajdhani'] uppercase tracking-wider text-center ${getSubjectClasses(item.subject)}`}>
                  {item.subject}: {item.count}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1A1A1A] p-4 rounded-xl border border-[#222] flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[#666] font-['Rajdhani'] uppercase tracking-widest text-[10px] mb-1 font-bold">Cards Studied</p>
              <div className="flex items-baseline gap-2">
                <span className="font-['IBM_Plex_Mono'] text-2xl font-bold text-[#E8E8E8]">
                  {statsData.totalStudied || 0}
                </span>
                <span className="font-['Rajdhani'] text-[#00FF41] font-bold text-[10px]">CARDS</span>
              </div>
            </div>
            <Check className="text-[#00FF41]/10" size={20} />
          </div>

          <div className="bg-[#1A1A1A] p-4 rounded-xl border border-[#222] flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[#666] font-['Rajdhani'] uppercase tracking-widest text-[10px] mb-1 font-bold">Accuracy Rate</p>
              <div className="flex items-baseline gap-2">
                <span className="font-['IBM_Plex_Mono'] text-2xl font-bold text-[#E8E8E8]">{statsData.accuracy || 0}</span>
                <span className="font-['Rajdhani'] text-[#00FF41] font-bold text-[10px]">%</span>
              </div>
            </div>
            <TrendingUp className="text-[#00FF41]/10" size={20} />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ACCURACY TREND */}
        <div className="lg:col-span-2 bg-[#1A1A1A] border border-[#222] rounded-xl p-6 shadow-xl relative overflow-hidden flex flex-col min-h-[300px]">

          {/* Header */}
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
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

        {/* Subject Mastery Panel */}
        <div className="p-6 bg-[#111111] rounded-xl border border-[#161616]">
          <h2 className="font-['Rajdhani'] font-bold text-sm text-[#E8E8E8] mb-6 uppercase tracking-widest border-b border-[#161616] pb-4 flex items-center">
              <TrendingUp className="mr-2 text-[#666]" size={16} />
              Subject Mastery
          </h2>
          <div className="space-y-6">
            {subjectProgress.length > 0 ? (
              subjectProgress.map((item, idx) => {
                let color = '#00FF41'
                if (item.percent < 30) color = '#FF3333'
                else if (item.percent < 60) color = '#FFB800'

                return (
                  <div key={idx}>
                    <div className="flex justify-between text-[11px] mb-2 font-['Rajdhani'] text-[#666] uppercase tracking-wider font-bold">
                      <span>{item.subject}</span>
                      <span style={{ color }}>{item.percent}%</span>
                    </div>
                    <div className="w-full bg-[#161616] h-2 rounded-full overflow-hidden border border-[#222]">
                      <div 
                        className="h-full transition-all duration-1000" 
                        style={{ 
                          width: `${item.percent}%`, 
                          backgroundColor: color,
                          boxShadow: `0 0 8px ${color}40` 
                        }} 
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-[#444] font-['IBM_Plex_Mono'] text-[10px] text-center py-2">
                No data available.
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
