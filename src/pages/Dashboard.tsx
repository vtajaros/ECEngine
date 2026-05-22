import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Library, Sigma, Download, Zap, BookMarked, BarChart2, TrendingUp, Check, Calendar, Edit2, Activity, Clock, X, AlertCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { getSubjectBadgeClasses } from '../lib/subjectColors'
import { activeDBService, AccuracyGranularity, AccuracySubject } from '../services/db.service'
import { motion, AnimatePresence } from 'framer-motion'

const SUBJECT_MAP: Record<string, string> = {
  'Mathematics': 'MATH',
  'General Engineering & Applied Sciences': 'GEAS',
  'Electronics Engineering': 'ELECS',
  'Electronics Systems & Technologies': 'EST',
}

const SUBJECT_LINE_COLOR: Record<AccuracySubject, string> = {
  ALL:   '#00FF41',
  MATH:  '#FB923C',
  GEAS:  '#60A5FA',
  ELECS: '#F87171',
  EST:   '#22C55E',
}

// ── Components ──────────────────────────────────────────────────────────────

const ReviewHeatmap = ({ history, examDate }: { history: Record<string, { count: number, timeSpent: number }>, examDate: string }) => {
  const { grid, monthLabels, gridStartDate, gridEndDate } = useMemo(() => {
    const target = new Date(examDate)
    const endMonth = target.getMonth()
    const endYear = target.getFullYear()
    
    // End date: last day of the exam month
    const endDate = new Date(endYear, endMonth + 1, 0)
    // Start date: first day of 5 months before (total 6 months)
    const startDate = new Date(endYear, endMonth - 5, 1)
    
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
  }, [examDate])

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const getLevel = (timeSpent: number) => {
    if (!timeSpent) return 'bg-[#1A1A1A] border-[#2A2A2A]' 
    if (timeSpent < 60) return 'bg-[#003311] border-[#005511] shadow-[0_0_8px_rgba(0,51,17,0.4)]'
    if (timeSpent < 120) return 'bg-[#006e21] border-[#008821] shadow-[0_0_12px_rgba(0,110,33,0.5)]'
    if (timeSpent < 180) return 'bg-[#00a630] border-[#00bb30] shadow-[0_0_15px_rgba(0,166,48,0.6)]'
    return 'bg-[#00FF41] border-[#00FF41] shadow-[0_0_20px_rgba(0,255,65,0.7)]'
  }

  return (
    <div className="w-full max-w-full [--cell-size:10px] [--gap-size:4px] sm:[--cell-size:16px] sm:[--gap-size:8px]">
      <div className="overflow-x-auto pb-2 -mx-1 px-1 sm:flex sm:justify-center">
        <div className="flex flex-col" style={{ minWidth: 'max-content' }}>
          {/* Month Labels */}
          <div className="relative h-5 mb-1">
            {monthLabels.map((label, i) => (
              <span
                key={i}
                className="absolute text-[9px] sm:text-[11px] font-['Orbitron'] text-[#E8E8E8] opacity-70 font-bold uppercase tracking-[0.2em]"
                style={{ left: `calc(2.2rem + ${label.weekIndex} * (var(--cell-size) + var(--gap-size)))` }}
              >
                {label.name}
              </span>
            ))}
          </div>

          <div className="flex items-start gap-[4px] sm:gap-2">
            {/* Day Labels */}
            <div
              className="flex flex-col text-[8px] sm:text-[10px] font-['Rajdhani'] text-[#666] font-bold uppercase tracking-widest leading-none gap-[4px] sm:gap-2 w-[1.8rem] pr-1"
            >
              {dayNames.map(d => (
                <span key={d} className="h-[10px] sm:h-4 flex items-center">{d}</span>
              ))}
            </div>

            {/* Activity Grid */}
            <div className="flex gap-[4px] sm:gap-2">
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[4px] sm:gap-2 w-[10px] sm:w-4">
                  {week.map(day => {
                    const data = history[day] || { count: 0, timeSpent: 0 }
                    const timeH = Math.floor(data.timeSpent / 60)
                    const timeM = data.timeSpent % 60
                    const dateObj = new Date(day)
                    const isOutRange = dateObj < gridStartDate || dateObj > gridEndDate

                    return (
                      <div
                        key={day}
                        className={`w-[10px] h-[10px] sm:w-4 sm:h-4 rounded-[2px] ${getLevel(data.timeSpent)} transition-all hover:scale-125 cursor-help border shadow-sm ${isOutRange ? 'opacity-5' : ''}`}
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
  const [modalOpen, setModalOpen]       = useState(false)
  const [modalDate, setModalDate]       = useState(examDate)
  const [modalError, setModalError]     = useState<string | null>(null)
  
  const calculateTimeLeft = (target: string) => {
    const targetDate = new Date(`${target}T00:00:00`).getTime()
    const now = new Date().getTime()
    const distance = targetDate - now

    if (distance < 0) return { days: 0, hours: 0, mins: 0, secs: 0 }

    return {
      days: Math.floor(distance / (1000 * 60 * 60 * 24)),
      hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      mins: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
      secs: Math.floor((distance % (1000 * 60)) / 1000)
    }
  }

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(examDate))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(examDate))
    }, 1000)
    return () => clearInterval(timer)
  }, [examDate])

  useEffect(() => {
    setTrendLoading(true)
    activeDBService.getAccuracyTrend(selectedSubject, granularity)
      .then(data => setAccuracyTrend(data))
      .catch(err => console.error('AccuracyTrend fetch failed:', err))
      .finally(() => setTrendLoading(false))
  }, [selectedSubject, granularity])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const dbStats = await activeDBService.getDashboardStats()
      const rawSubjectCounts = await activeDBService.getSubjectBreakdown()
      const globalStats = await activeDBService.getGlobalStats()
      const rawSubjectProgress = await activeDBService.getSubjectProgress()
      const activityHistory = await activeDBService.getActivityHistory()
      
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

  const openDateModal = () => {
    setModalDate(examDate)
    setModalError(null)
    setModalOpen(true)
  }

  const closeDateModal = () => {
    setModalOpen(false)
    setModalError(null)
  }

  const handleModalDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setModalDate(val)
    if (!val) {
      setModalError('Please enter a date.')
      return
    }
    const chosen = new Date(val + 'T00:00:00')
    const today  = new Date()
    today.setHours(0, 0, 0, 0)
    if (chosen <= today) {
      setModalError('That date has already passed. Please choose a future date.')
    } else {
      setModalError(null)
    }
  }

  const confirmDateChange = () => {
    if (modalError || !modalDate) return
    const chosen = new Date(modalDate + 'T00:00:00')
    const today  = new Date()
    today.setHours(0, 0, 0, 0)
    if (chosen <= today) {
      setModalError('That date has already passed. Please choose a future date.')
      return
    }
    setExamDate(modalDate)
    localStorage.setItem('ecengine_exam_date', modalDate)
    setModalOpen(false)
    setModalError(null)
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
    <div className="h-full bg-[#0D0D0D] px-3 pb-6 pt-4 sm:px-8 sm:pb-8 lg:px-12 lg:pb-12 lg:pt-4 overflow-y-auto scrollbar-hide">
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
        <div className="bg-[#111] border border-[#00FF41]/10 rounded-lg px-3 py-2 sm:px-4 flex items-center gap-3 sm:gap-6 shadow-xl relative group">
          <button
            onClick={openDateModal}
            className="absolute -top-2 -right-2 p-1.5 bg-[#1A1A1A] border border-[#333] rounded-full text-[#666] hover:text-[#00FF41] opacity-70 hover:opacity-100 transition-all z-10 shadow-lg"
            title="Change exam date"
          >
            <Edit2 size={12} />
          </button>

          <div className="flex flex-col">
            <span className="text-[10px] font-['Orbitron'] text-[#00FF41] uppercase tracking-widest opacity-80">
              Exam Target
            </span>
            <span className="text-[11px] font-['Rajdhani'] text-[#888] uppercase tracking-widest font-bold">
              {new Date(examDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
            </span>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold font-['IBM_Plex_Mono'] text-[#E8E8E8] leading-none">{timeLeft.days}</span>
              <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Days</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold font-['IBM_Plex_Mono'] text-[#E8E8E8] leading-none">{timeLeft.hours.toString().padStart(2, '0')}</span>
              <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Hrs</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold font-['IBM_Plex_Mono'] text-[#E8E8E8] leading-none">{timeLeft.mins.toString().padStart(2, '0')}</span>
              <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Min</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold font-['IBM_Plex_Mono'] text-[#00FF41] leading-none">{timeLeft.secs.toString().padStart(2, '0')}</span>
              <span className="text-[9px] uppercase text-[#666] font-['Rajdhani'] font-bold tracking-widest">Sec</span>
            </div>
          </div>
        </div>
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
        <div className="lg:col-span-3 p-4 sm:p-8 bg-[#161616] rounded-xl border border-[rgba(0,255,65,0.05)] shadow-2xl flex flex-col items-center">
            <div className="flex items-center justify-between mb-4 sm:mb-8 w-full">
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
              <ReviewHeatmap history={history} examDate={examDate} />
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
                    className={`px-2 sm:px-3 py-1 text-[10px] font-bold font-['Rajdhani'] uppercase tracking-widest rounded transition-all duration-200 ${
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
          <div className="flex-1 w-full relative" style={{ minHeight: 200 }}>
            <AnimatePresence mode="wait">
              {trendLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="font-['IBM_Plex_Mono'] text-[10px] text-[#444] uppercase tracking-widest animate-pulse">
                    Loading…
                  </span>
                </motion.div>
              ) : accuracyTrend.length === 0 || accuracyTrend.every(d => d.acc === null) ? (
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
                  key={`${selectedSubject}-${granularity}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="absolute inset-0"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={accuracyTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
                        tick={{ fill: '#555', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                        dy={10}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#555', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                        tickFormatter={(v: number) => `${v}%`}
                        width={38}
                      />
                      <ReferenceLine
                        y={50}
                        stroke="#2A2A2A"
                        strokeDasharray="4 4"
                        label={{ value: '50%', fill: '#3A3A3A', fontSize: 9, fontFamily: 'IBM Plex Mono', position: 'insideTopRight' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0D0D0D',
                          border: '1px solid #2A2A2A',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontFamily: 'IBM Plex Mono',
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
                        dataKey="acc"
                        stroke={SUBJECT_LINE_COLOR[selectedSubject]}
                        strokeWidth={2}
                        filter="url(#lineglow)"
                        dot={(props: any) => {
                          const { cx, cy, payload, index } = props
                          if (payload.acc === null) return <g key={index} />
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
                        connectNulls={false}
                        animationDuration={500}
                        animationEasing="ease-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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

      {/* ── Exam Date Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              key="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={closeDateModal}
            />
            <motion.div
              key="modal-dialog"
              initial={{ opacity: 0, scale: 0.95, y: -12 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{   opacity: 0, scale: 0.95,  y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-w-sm mx-4 bg-[#111] border border-[#2A2A2A] rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#1E1E1E]">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-[#00FF41]" size={16} />
                    <span className="font-['Rajdhani'] font-bold text-sm text-[#E8E8E8] uppercase tracking-widest">
                      Set Exam Target
                    </span>
                  </div>
                  <button
                    onClick={closeDateModal}
                    className="text-[#555] hover:text-[#E8E8E8] transition-colors p-1 rounded-lg hover:bg-[#1A1A1A]"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="px-6 py-6 space-y-5">
                  <div className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-[#555]">
                    Current target:&nbsp;
                    <span className="text-[#00FF41]">
                      {new Date(examDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-[#666]">
                      New Date
                    </label>
                    <input
                      type="date"
                      value={modalDate}
                      onChange={handleModalDateChange}
                      min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                      className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl px-4 py-3 text-[#E8E8E8] font-['IBM_Plex_Mono'] text-sm focus:outline-none focus:border-[#00FF41]/40 transition-colors [color-scheme:dark]"
                    />
                  </div>

                  <AnimatePresence mode="wait">
                    {modalError && (
                      <motion.div
                        key="modal-error"
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0,  height: 'auto' }}
                        exit={{   opacity: 0, y: -4,  height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                          <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={14} />
                          <span className="font-['Rajdhani'] text-red-400 text-xs font-bold leading-relaxed">
                            {modalError}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {modalDate && !modalError && (() => {
                      const d = Math.ceil(
                        (new Date(modalDate + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000
                      )
                      return d > 0 ? (
                        <motion.div
                          key="days-preview"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center justify-center gap-2 py-2"
                        >
                          <span className="font-['IBM_Plex_Mono'] text-2xl font-bold text-[#00FF41]">{d}</span>
                          <span className="font-['Rajdhani'] text-[#555] text-xs uppercase tracking-widest font-bold">
                            days until exam
                          </span>
                        </motion.div>
                      ) : null
                    })()}
                  </AnimatePresence>
                </div>

                <div className="flex gap-3 px-6 pb-6">
                  <button
                    onClick={closeDateModal}
                    className="flex-1 px-4 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-[#888] font-['Rajdhani'] font-bold text-xs uppercase tracking-widest hover:text-[#E8E8E8] hover:bg-[#222] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDateChange}
                    disabled={!!modalError || !modalDate}
                    className="flex-1 px-4 py-2.5 rounded-xl font-['Rajdhani'] font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: (!modalError && modalDate) ? '#00FF41' : '#1A1A1A',
                      color: (!modalError && modalDate) ? '#000' : '#555',
                    }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
