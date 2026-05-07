import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Library, Sigma, Download, Zap, BookMarked, BarChart2 } from 'lucide-react'

export default function Dashboard() {
  const [statsData, setStatsData] = useState({
    totalDecks: 0,
    totalCards: 0,
    internalized: 0,
    currentStreak: 0
  })

  const [subjectProgress, setSubjectProgress] = useState<any[]>([])
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

  const loadDashboardData = async () => {
    try {
      // 1. Total Decks
      const decksResult = await window.electron.db.query('SELECT COUNT(id) as count FROM topics')
      const totalDecks = decksResult.data?.[0]?.count || 0

      // 2. Total Cards
      const totalResult = await window.electron.db.query('SELECT COUNT(id) as count FROM cards')
      const total = totalResult.data?.[0]?.count || 0

      // 2. Internalized Cards (Repetitions >= 5)
      const internalizedResult = await window.electron.db.query('SELECT COUNT(card_id) as count FROM progress WHERE repetitions >= 5')
      const internalized = internalizedResult.data?.[0]?.count || 0

      // 3. Current Streak (Simplified for now - could be a separate log table, but assuming we fetch from a setting or calc)
      // For now, let's keep it at 0 or a placeholder unless a streak table exists
      const currentStreak = 0 

      setStatsData({ totalDecks, totalCards: total, internalized, currentStreak })

      // 4. Subject Progress
      // Join topics (subjects), cards, and progress to get mastery per subject
      const progressResult = await window.electron.db.query(`
        SELECT 
          t.subject, 
          COUNT(c.id) as total, 
          SUM(CASE WHEN p.repetitions >= 5 THEN 1 ELSE 0 END) as mastered 
        FROM topics t 
        JOIN cards c ON t.id = c.topic_id 
        LEFT JOIN progress p ON c.id = p.card_id 
        GROUP BY t.subject
      `)

      const formattedProgress = (progressResult.data || []).map((row: any) => ({
        subject: row.subject,
        percent: row.total > 0 ? Math.round((row.mastered / row.total) * 100) : 0
      }))

      setSubjectProgress(formattedProgress)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
  }

  const quickLinks = [
    { title: 'Study Decks', desc: 'Jump back into spaced repetition and mastery', path: '/study', icon: BookOpen },
    { title: 'Take a Mock Exam', desc: 'Simulate the ECE board exam conditions', path: '/study', icon: Library },
    { title: 'Board Topics', desc: 'Table of Specification topics for the ECE board exam', path: '/topics', icon: Sigma },
  ]

  const stats = [
    { label: 'Total Decks', value: statsData.totalDecks.toString(), unit: 'decks' },
    { label: 'Global Mastery', value: statsData.totalCards > 0 ? Math.round((statsData.internalized / statsData.totalCards) * 100).toString() : '0', unit: '%' },
    { label: 'Current Streak', value: statsData.currentStreak.toString(), unit: 'days' },
  ]

  return (
    <div className="h-full bg-[#0D0D0D] px-8 pb-8 pt-6 lg:px-12 lg:pb-12 lg:pt-6 overflow-y-auto">
      {/* Header */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-['Orbitron'] text-4xl lg:text-5xl font-bold text-[#E8E8E8] mb-2 tracking-wider">
            <span className="text-[#00FF41]">ECE</span>ngine
          </h1>
          <p className="text-[#888888] font-['Rajdhani'] text-xl uppercase tracking-widest">
            Electronics Engineering Review Dashboard
          </p>
        </div>

        {/* Board Exam Countdown */}
        <div className="bg-[#111] border border-[#00FF41]/20 rounded-lg px-6 py-4 flex flex-col items-center md:items-end shadow-[0_0_20px_rgba(0,0,0,0.4)]">
          <span className="text-[10px] font-['Orbitron'] text-[#00FF41] uppercase tracking-[0.2em] mb-2 opacity-90">Board Exam Countdown</span>
          <div className="flex gap-5">
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold font-['IBM_Plex_Mono'] text-[#E8E8E8] leading-none">{timeLeft.days}</span>
              <span className="text-[10px] uppercase text-[#AAAAAA] font-['Rajdhani'] font-bold mt-1 tracking-widest">Days</span>
            </div>
            <div className="text-2xl font-bold text-[#00FF41]/20 pt-1">:</div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold font-['IBM_Plex_Mono'] text-[#E8E8E8] leading-none">{timeLeft.hours.toString().padStart(2, '0')}</span>
              <span className="text-[10px] uppercase text-[#AAAAAA] font-['Rajdhani'] font-bold mt-1 tracking-widest">Hrs</span>
            </div>
            <div className="text-2xl font-bold text-[#00FF41]/20 pt-1">:</div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold font-['IBM_Plex_Mono'] text-[#E8E8E8] leading-none">{timeLeft.mins.toString().padStart(2, '0')}</span>
              <span className="text-[10px] uppercase text-[#AAAAAA] font-['Rajdhani'] font-bold mt-1 tracking-widest">Mins</span>
            </div>
            <div className="text-2xl font-bold text-[#00FF41]/20 pt-1">:</div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold font-['IBM_Plex_Mono'] text-[#00FF41] leading-none shadow-[0_0_15px_rgba(0,255,65,0.3)]">{timeLeft.secs.toString().padStart(2, '0')}</span>
              <span className="text-[10px] uppercase text-[#AAAAAA] font-['Rajdhani'] font-bold mt-1 tracking-widest">Secs</span>
            </div>
          </div>
          <span className="text-[11px] font-['Rajdhani'] text-[#888888] mt-2 uppercase tracking-[0.1em] font-medium">Target Exam: October 16, 2026</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Stats Panel */}
        <div className="col-span-1 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="bg-[#111111] p-6 rounded-lg border border-[#161616] flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              <div>
                <p className="text-[#888888] font-['Rajdhani'] uppercase tracking-widest text-sm mb-1">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-['IBM_Plex_Mono'] text-4xl font-semibold text-[#E8E8E8]">{stat.value}</span>
                  <span className="font-['Rajdhani'] text-[#00FF41] font-bold">{stat.unit}</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded bg-[rgba(0,255,65,0.05)] border border-[rgba(0,255,65,0.2)] flex items-center justify-center text-[#00FF41]">
                <Zap size={24} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Quick Actions (2 Cols) */}
        <div className="lg:col-span-2 p-6 bg-[#161616] rounded-xl border border-[rgba(0,255,65,0.2)] shadow-lg shadow-[rgba(0,255,65,0.05)]">
          <h2 className="font-['Rajdhani'] font-bold text-2xl text-[#E8E8E8] mb-6 uppercase tracking-wider flex items-center">
            <BookMarked className="mr-3 text-[#00FF41]" size={24} />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickLinks.map((link, i) => (
              <Link 
                key={i} 
                to={link.path}
                className="group block p-5 rounded-lg border border-[#111111] bg-[#111111] hover:bg-[#161616] hover:border-[#00FF41] transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-[rgba(0,255,65,0.1)] to-transparent transition-opacity" />
                <link.icon className="w-8 h-8 text-[#00FF41] mb-4 drop-shadow-[0_0_5px_rgba(0,255,65,0.5)]" />
                <h3 className="font-['Orbitron'] text-lg font-medium text-[#E8E8E8] mb-2">{link.title}</h3>
                <p className="text-[#888888] text-sm font-['IBM_Plex_Mono'] leading-relaxed">{link.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recently Added / News Panel (1 Col) */}
        <div className="p-6 bg-[#111111] rounded-xl border border-[#161616]">
          <h2 className="font-['Rajdhani'] font-bold text-xl text-[#E8E8E8] mb-6 uppercase tracking-wider border-b border-[#161616] pb-4 flex items-center">
             <BarChart2 className="mr-3 text-[#888888]" size={20} />
             Review Progress
          </h2>
          <div className="space-y-6">
            {subjectProgress.length > 0 ? (
              subjectProgress.slice(0, 4).map((item, idx) => {
                // Color logic based on percentage or index for visual variety
                let color = '#00FF41' // Default Green
                if (item.percent < 30) color = '#FF3333' // Red
                else if (item.percent < 60) color = '#FFB800' // Yellow

                return (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-2 font-['Rajdhani'] text-[#888888] uppercase tracking-wider">
                      <span>{item.subject}</span>
                      <span style={{ color }}>{item.percent}%</span>
                    </div>
                    <div className="w-full bg-[#161616] h-2 rounded-full overflow-hidden border border-[#222]">
                      <div 
                        className="h-full transition-all duration-1000" 
                        style={{ 
                          width: `${item.percent}%`, 
                          backgroundColor: color,
                          boxShadow: `0 0 8px ${color}80` 
                        }} 
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-[#444] font-['IBM_Plex_Mono'] text-xs text-center py-4">
                No decks found.
              </div>
            )}
          </div>
          
          <Link 
             to="/add-decks"
             className="mt-8 relative w-full flex items-center justify-center p-3 text-center border-2 border-dashed border-[#444] rounded text-[#888888] hover:border-[#00FF41] hover:text-[#E8E8E8] transition-colors font-['Rajdhani'] uppercase tracking-wider group"
          >
             <Download size={18} className="mr-2 group-hover:text-[#00FF41]" />
             Add Decks
          </Link>
        </div>

      </div>
    </div>
  )
}
