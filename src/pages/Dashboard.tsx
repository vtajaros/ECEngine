import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Library, Sigma, Download, Zap, BookMarked, BarChart2, TrendingUp, Check } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getSubjectBadgeClasses } from '../lib/subjectColors'

const SUBJECT_MAP: Record<string, string> = {
  'Mathematics': 'MATH',
  'General Engineering & Applied Sciences': 'GEAS',
  'Electronics Engineering': 'ELECS',
  'Electronics Systems & Technologies': 'EST',
}

export default function Dashboard() {
  const [statsData, setStatsData] = useState({
    totalDecks: 0,
    totalCards: 0,
    internalized: 0
  })

  const [subjectCounts, setSubjectCounts] = useState<any[]>([
    { subject: 'MATH', count: 0 },
    { subject: 'GEAS', count: 0 },
    { subject: 'ELECS', count: 0 },
    { subject: 'EST', count: 0 },
  ])
  const [subjectProgress, setSubjectProgress] = useState<any[]>([])
  const [timeRange, setTimeRange] = useState('Weekly')
  const [chartData, setChartData] = useState<any[]>([])
  
  const calculateTimeLeft = () => {
    const targetDate = new Date('2026-10-16T00:00:00').getTime()
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

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft())

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    fetchActivityStats()
  }, [timeRange])

  const fetchActivityStats = async () => {
    try {
      // @ts-ignore
      const data = await (window as any).electron?.getActivityStats?.(timeRange)
      if (data && data.length > 0) {
        setChartData(data)
      } else {
        if (timeRange === 'Daily') {
          setChartData([
            { name: '08:00', cards: 10 }, { name: '10:00', cards: 45 },
            { name: '12:00', cards: 30 }, { name: '14:00', cards: 80 },
            { name: '16:00', cards: 65 }, { name: '18:00', cards: 110 },
            { name: '20:00', cards: 90 },
          ])
        } else if (timeRange === 'Monthly') {
          setChartData([
            { name: 'Jan', cards: 450 }, { name: 'Feb', cards: 720 },
            { name: 'Mar', cards: 850 }, { name: 'Apr', cards: 1100 },
          ])
        } else {
          setChartData([
            { name: 'Tue 05', cards: 45 }, { name: 'Wed 06', cards: 120 },
            { name: 'Thu 07', cards: 85 }, { name: 'Fri 08', cards: 210 },
            { name: 'Sat 09', cards: 160 }, { name: 'Sun 10', cards: 250 },
            { name: 'Mon 11', cards: 190 },
          ])
        }
      }
    } catch (error) {
      console.error("Failed to load chart data:", error)
    }
  }

  const loadDashboardData = async () => {
    try {
      const decksResult = await (window as any).electron.db.query('SELECT COUNT(id) as count FROM topics')
      const totalDecks = decksResult.data?.[0]?.count || 0

      const totalResult = await (window as any).electron.db.query('SELECT COUNT(id) as count FROM cards')
      const total = totalResult.data?.[0]?.count || 0

      const internalizedResult = await (window as any).electron.db.query('SELECT COUNT(card_id) as count FROM progress WHERE repetitions >= 5')
      const internalized = internalizedResult.data?.[0]?.count || 0

      setStatsData({ totalDecks, totalCards: total, internalized })

      // Subject counts breakdown
      const subjectCountsResult = await (window as any).electron.db.query('SELECT subject, COUNT(id) as count FROM topics GROUP BY subject')
      const rawCounts = subjectCountsResult.data || []
      const subjects = ['MATH', 'GEAS', 'ELECS', 'EST']
      const formattedCounts = subjects.map(s => {
        const found = rawCounts.find((r: any) => (SUBJECT_MAP[r.subject] || r.subject) === s)
        return { subject: s, count: found ? found.count : 0 }
      })
      setSubjectCounts(formattedCounts)

      const progressResult = await (window as any).electron.db.query(`
        SELECT 
          t.subject, 
          COUNT(c.id) as total, 
          SUM(CASE WHEN p.repetitions >= 5 THEN 1 ELSE 0 END) as mastered 
        FROM topics t 
        JOIN cards c ON t.id = c.topic_id 
        LEFT JOIN progress p ON c.id = p.card_id 
        GROUP BY t.subject
      `)

      const formattedProgress = subjects.map(s => {
        const found = (progressResult.data || []).find((r: any) => (SUBJECT_MAP[r.subject] || r.subject) === s)
        return {
          subject: s,
          percent: found && found.total > 0 ? Math.round((found.mastered / found.total) * 100) : 0
        }
      })

      setSubjectProgress(formattedProgress)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
  }

  const getFlawlessAccuracy = () => {
    const flawless = Number(localStorage.getItem('flawless_rounds') || '0')
    const total = Number(localStorage.getItem('total_rounds') || '0')
    if (total === 0) return 0
    return Math.round((flawless / total) * 100)
  }

  const flawlessAcc = getFlawlessAccuracy()

  const getSubjectClasses = (subject: string) => {
    switch (subject) {
      case 'MATH': return 'text-orange-400 border-orange-500/20 bg-orange-500/10'
      case 'GEAS': return 'text-blue-400 border-blue-500/20 bg-blue-500/10'
      case 'ELECS': return 'text-red-400 border-red-500/20 bg-red-500/10'
      case 'EST': return 'text-green-500 border-green-600/20 bg-green-600/10'
      default: return 'text-zinc-400 border-zinc-500/20 bg-zinc-500/10'
    }
  }

  const quickLinks = [
    { title: 'Study Decks', desc: 'Jump back into spaced repetition and mastery', path: '/study', icon: BookOpen },
    { title: 'Take a Mock Exam', desc: 'Simulate the ECE board exam conditions', path: '/study', icon: Library },
    { title: 'Board Topics', desc: 'Table of Specification topics for the ECE board exam', path: '/topics', icon: Sigma },
  ]

  return (
    <div className="h-full bg-[#0D0D0D] px-8 pb-8 pt-4 lg:px-12 lg:pb-12 lg:pt-4 overflow-y-auto">
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
        <div className="bg-[#111] border border-[#00FF41]/10 rounded-lg px-4 py-2 flex items-center gap-6 shadow-xl">
          <div className="flex flex-col">
             <span className="text-[10px] font-['Orbitron'] text-[#00FF41] uppercase tracking-widest opacity-80">Exam Target</span>
             <span className="text-[11px] font-['Rajdhani'] text-[#888] uppercase tracking-widest font-bold">OCT 16, 2026</span>
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

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* Condensed KPIs */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-[#1A1A1A] p-4 rounded-xl border border-[#222] shadow-lg flex flex-col justify-between min-h-[120px]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#666] font-['Rajdhani'] uppercase tracking-widest text-[10px] font-bold">Total Decks</p>
              <Zap className="text-[#00FF41]/10" size={16} />
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-['IBM_Plex_Mono'] text-2xl font-bold text-[#E8E8E8]">{statsData.totalDecks}</span>
              <span className="font-['Rajdhani'] text-[#00FF41] font-bold text-[10px]">SETS</span>
            </div>
            {/* Standardized 4-Subject Breakdown */}
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
              <p className="text-[#666] font-['Rajdhani'] uppercase tracking-widest text-[10px] mb-1 font-bold">Global Mastery</p>
              <div className="flex items-baseline gap-2">
                <span className="font-['IBM_Plex_Mono'] text-2xl font-bold text-[#E8E8E8]">
                  {statsData.totalCards > 0 ? Math.round((statsData.internalized / statsData.totalCards) * 100) : '0'}
                </span>
                <span className="font-['Rajdhani'] text-[#00FF41] font-bold text-[10px]">%</span>
              </div>
            </div>
            <TrendingUp className="text-[#00FF41]/10" size={20} />
          </div>

          <div className="bg-[#1A1A1A] p-4 rounded-xl border border-[#222] flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[#666] font-['Rajdhani'] uppercase tracking-widest text-[10px] mb-1 font-bold">Flawless Accuracy</p>
              <div className="flex items-baseline gap-2">
                <span className="font-['IBM_Plex_Mono'] text-2xl font-bold text-[#E8E8E8]">{flawlessAcc}</span>
                <span className="font-['Rajdhani'] text-[#00FF41] font-bold text-[10px]">%</span>
              </div>
              <p className="text-[9px] text-[#444] font-['Rajdhani'] uppercase tracking-widest font-bold mt-1">Perfect Rounds</p>
            </div>
            <Check className="text-[#00FF41]/10" size={20} />
          </div>
        </div>

        {/* Study Analytics Chart */}
        <div className="lg:col-span-3 bg-[#1A1A1A] border border-[#222] rounded-xl p-4 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-['Rajdhani'] font-bold text-sm text-[#E8E8E8] uppercase tracking-widest flex items-center">
              <BarChart2 className="mr-2 text-[#00FF41]" size={16} />
              Study Activity
            </h2>
            
            <div className="flex bg-[#111] p-0.5 rounded-md border border-[#222]">
              {['Daily', 'Weekly', 'Monthly'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all rounded ${
                    timeRange === range ? 'bg-[#00FF41] text-[#0D0D0D]' : 'text-[#555] hover:text-[#888]'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCards" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FF41" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00FF41" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#A1A1AA', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
                  dy={10}
                />
                <YAxis hide />
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
                  dataKey="cards" 
                  stroke="#00FF41" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCards)" 
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2 p-5 bg-[#161616] rounded-xl border border-[rgba(0,255,65,0.05)] shadow-lg">
            <h2 className="font-['Rajdhani'] font-bold text-xl text-[#E8E8E8] mb-4 uppercase tracking-wider flex items-center">
              <BookMarked className="mr-2 text-[#00FF41]" size={20} />
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickLinks.map((link, i) => (
                <Link 
                  key={i} 
                  to={link.path}
                  className="group block p-4 rounded-lg border border-[#111111] bg-[#111111] hover:bg-[#161616] hover:border-[#00FF41] transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-[rgba(0,255,65,0.05)] to-transparent transition-opacity" />
                  <link.icon className="w-6 h-6 text-[#00FF41] mb-3 drop-shadow-[0_0_5px_rgba(0,255,65,0.3)]" />
                  <h3 className="font-['Orbitron'] text-base font-medium text-[#E8E8E8] mb-1">{link.title}</h3>
                  <p className="text-[#666] text-xs font-['IBM_Plex_Mono'] leading-relaxed">{link.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Recently Added / News Panel */}
          <div className="p-5 bg-[#111111] rounded-xl border border-[#161616]">
            <h2 className="font-['Rajdhani'] font-bold text-lg text-[#E8E8E8] mb-4 uppercase tracking-wider border-b border-[#161616] pb-3 flex items-center">
               <TrendingUp className="mr-2 text-[#666]" size={18} />
               Review Progress
            </h2>
            <div className="space-y-5">
              {subjectProgress.length > 0 ? (
                subjectProgress.slice(0, 4).map((item, idx) => {
                  let color = '#00FF41'
                  if (item.percent < 30) color = '#FF3333'
                  else if (item.percent < 60) color = '#FFB800'

                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-[11px] mb-1.5 font-['Rajdhani'] text-[#666] uppercase tracking-wider font-bold">
                        <span>{item.subject}</span>
                        <span style={{ color }}>{item.percent}%</span>
                      </div>
                      <div className="w-full bg-[#161616] h-1.5 rounded-full overflow-hidden border border-[#222]">
                        <div 
                          className="h-full transition-all duration-1000" 
                          style={{ 
                            width: `${item.percent}%`, 
                            backgroundColor: color,
                            boxShadow: `0 0 5px ${color}40` 
                          }} 
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-[#444] font-['IBM_Plex_Mono'] text-[10px] text-center py-2">
                  No decks found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
}
