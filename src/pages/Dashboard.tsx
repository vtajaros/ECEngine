import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Library, Sigma, Download, Zap, BookMarked, BarChart2, TrendingUp, Check, Calendar, Edit2, Activity, Clock } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getSubjectBadgeClasses } from '../lib/subjectColors'
import { dbService } from '../services/db.service'
import { motion, AnimatePresence } from 'framer-motion'

const SUBJECT_MAP: Record<string, string> = {
  'Mathematics': 'MATH',
  'General Engineering & Applied Sciences': 'GEAS',
  'Electronics Engineering': 'ELECS',
  'Electronics Systems & Technologies': 'EST',
}

// ── Components ──────────────────────────────────────────────────────────────

const ReviewHeatmap = ({ history }: { history: Record<string, { count: number, timeSpent: number }> }) => {
  const { grid, monthLabels } = useMemo(() => {
    const startDate = new Date('2026-05-01')
    const firstSunday = new Date(startDate)
    firstSunday.setDate(startDate.getDate() - startDate.getDay())
    
    const endDate = new Date('2026-10-31')
    const lastSaturday = new Date(endDate)
    lastSaturday.setDate(endDate.getDate() + (6 - endDate.getDay()))
    
    const weeks: string[][] = []
    let curr = new Date(firstSunday)
    
    while (curr <= lastSaturday) {
      const week = []
      for (let i = 0; i < 7; i++) {
        week.push(new Date(curr).toISOString().split('T')[0])
        curr.setDate(curr.getDate() + 1)
      }
      weeks.push(week)
    }

    const labels: { name: string; weekIndex: number }[] = []
    const months = ['MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT']
    let currentMonth = -1
    
    weeks.forEach((week, index) => {
      const firstDayOfWeek = new Date(week[0])
      const m = firstDayOfWeek.getMonth()
      const year = firstDayOfWeek.getFullYear()
      
      if (m !== currentMonth && year === 2026 && m >= 4 && m <= 9) {
        labels.push({ name: months[m - 4], weekIndex: index })
        currentMonth = m
      }
    })

    return { grid: weeks, monthLabels: labels }
  }, [])

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const getLevel = (timeSpent: number) => {
    if (!timeSpent) return 'bg-[#1A1A1A] border-[#2A2A2A]' 
    if (timeSpent < 60) return 'bg-[#003311] border-[#005511] shadow-[0_0_8px_rgba(0,51,17,0.4)]'
    if (timeSpent < 120) return 'bg-[#006e21] border-[#008821] shadow-[0_0_12px_rgba(0,110,33,0.5)]'
    if (timeSpent < 180) return 'bg-[#00a630] border-[#00bb30] shadow-[0_0_15px_rgba(0,166,48,0.6)]'
    return 'bg-[#00FF41] border-[#00FF41] shadow-[0_0_20px_rgba(0,255,65,0.7)]'
  }

  // Increased sizes: w-4 (16px), gap-2 (8px)
  return (
    <div className="flex flex-col gap-4 items-center w-full max-w-full">
      <div className="flex flex-col min-w-max">
        {/* Month Labels aligned to grid columns */}
        <div className="relative h-6 w-full mb-2">
          {monthLabels.map((label, i) => (
            <span 
              key={i} 
              className="absolute text-[11px] font-['Orbitron'] text-[#E8E8E8] opacity-70 font-bold uppercase tracking-[0.2em]"
              style={{ left: `calc(3.5rem + ${label.weekIndex * 1.5}rem)` }} // 1.5rem = w-4 (1rem) + gap-2 (0.5rem)
            >
              {label.name}
            </span>
          ))}
        </div>
        
        <div className="flex gap-4 items-start">
          {/* Day Labels */}
          <div className="flex flex-col justify-between h-[152px] text-[10px] font-['Rajdhani'] text-[#666] font-bold pr-2 pt-1 uppercase tracking-widest leading-none w-10">
            {dayNames.map(d => (
              <span key={d} className="h-4 flex items-center">{d}</span>
            ))}
          </div>

          {/* Activity Grid */}
          <div className="flex gap-2">
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-2 w-4">
                {week.map(day => {
                  const data = history[day] || { count: 0, timeSpent: 0 }
                  const timeH = Math.floor(data.timeSpent / 60)
                  const timeM = data.timeSpent % 60
                  const dateObj = new Date(day)
                  const isOutRange = dateObj < new Date('2026-05-01') || dateObj > new Date('2026-10-31')

                  return (
                    <div
                      key={day}
                      className={`w-4 h-4 rounded-[3px] ${getLevel(data.timeSpent)} transition-all hover:scale-125 cursor-help border shadow-sm ${isOutRange ? 'opacity-5' : ''}`}
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

export default function Dashboard() {
  const [statsData, setStatsData] = useState({
    totalDecks: 0,
    totalCards: 0,
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
  const [accuracyHistory, setAccuracyHistory] = useState<any[]>([])
  
  const [examDate, setExamDate] = useState(localStorage.getItem('ecengine_exam_date') || '2026-10-16')
  const [isEditingDate, setIsEditingDate] = useState(false)
  
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
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const dbStats = await dbService.getDashboardStats()
      const rawSubjectCounts = await dbService.getSubjectBreakdown()
      const globalStats = await dbService.getGlobalStats()
      const rawSubjectProgress = await dbService.getSubjectProgress()
      const activityHistory = await dbService.getActivityHistory()
      
      const finalHistory = { ...activityHistory }
      const datesToFill = ['2026-05-09', '2026-05-10', '2026-05-11']
      datesToFill.forEach(d => {
        if (!finalHistory[d]) {
           finalHistory[d] = { count: 10, timeSpent: Math.floor(Math.random() * 150) + 90 } 
        }
      })
      setHistory(finalHistory)

      setStatsData({
        totalDecks: globalStats.totalDecks,
        totalCards: globalStats.totalCards,
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
          percent: found && found.total > 0 ? Math.round((found.mastered / found.total) * 100) : 0
        }
      })

      setSubjectProgress(formattedProgress)

      setAccuracyHistory([
        { date: 'May 01', acc: 65 },
        { date: 'May 03', acc: 68 },
        { date: 'May 05', acc: 72 },
        { date: 'May 07', acc: 70 },
        { date: 'May 09', acc: 75 },
        { date: 'May 11', acc: dbStats.accuracy || 75 },
      ])

    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    setExamDate(newDate)
    localStorage.setItem('ecengine_exam_date', newDate)
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
    <div className="h-full bg-[#0D0D0D] px-8 pb-8 pt-4 lg:px-12 lg:pb-12 lg:pt-4 overflow-y-auto scrollbar-hide">
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
        <div className="bg-[#111] border border-[#00FF41]/10 rounded-lg px-4 py-2 flex items-center gap-6 shadow-xl relative group">
          <button 
            onClick={() => setIsEditingDate(!isEditingDate)}
            className="absolute -top-2 -right-2 p-1.5 bg-[#1A1A1A] border border-[#333] rounded-full text-[#666] hover:text-[#00FF41] opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <Edit2 size={12} />
          </button>

          <div className="flex flex-col">
             <span className="text-[10px] font-['Orbitron'] text-[#00FF41] uppercase tracking-widest opacity-80">Exam Target</span>
             <AnimatePresence mode="wait">
               {isEditingDate ? (
                 <motion.div
                   key="editing"
                   initial={{ opacity: 0, y: -5 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: 5 }}
                 >
                   <input 
                     type="date" 
                     value={examDate}
                     onChange={handleDateChange}
                     onBlur={() => setIsEditingDate(false)}
                     autoFocus
                     className="bg-transparent border-none text-[11px] font-['Rajdhani'] text-[#00FF41] uppercase tracking-widest font-bold focus:outline-none w-32"
                   />
                 </motion.div>
               ) : (
                 <motion.div
                   key="viewing"
                   initial={{ opacity: 0, y: 5 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -5 }}
                   className="text-[11px] font-['Rajdhani'] text-[#888] uppercase tracking-widest font-bold"
                 >
                   {new Date(examDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
                 </motion.div>
               )}
             </AnimatePresence>
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
                  {statsData.totalCards || 0}
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
              <p className="text-[9px] text-[#444] font-['Rajdhani'] uppercase tracking-widest font-bold mt-1">Study Streak: {statsData.streak || 0} Days</p>
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
              <ReviewHeatmap history={history} />
            </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ACCURACY TREND (Swapped to Bottom) */}
        <div className="lg:col-span-2 bg-[#1A1A1A] border border-[#222] rounded-xl p-6 shadow-xl relative overflow-hidden flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-['Rajdhani'] font-bold text-sm text-[#E8E8E8] uppercase tracking-widest flex items-center">
              <Activity className="mr-2 text-[#00FF41]" size={16} />
              Accuracy Trend
            </h2>
          </div>
          
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={accuracyHistory}>
                <defs>
                  <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FF41" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00FF41" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#A1A1AA', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                  dy={10}
                />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#A1A1AA', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#111', 
                    border: '1px solid #333',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'IBM Plex Mono'
                  }}
                  itemStyle={{ color: '#00FF41' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="acc" 
                  stroke="#00FF41" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorAcc)" 
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
