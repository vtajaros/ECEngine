import React from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Library, Sigma, Download, Zap, BookMarked, BarChart2 } from 'lucide-react'

export default function Dashboard() {
  const quickLinks = [
    { title: 'Study Flashcards', desc: 'Jump back into spaced repetition', path: '/flashcards', icon: BookOpen },
    { title: 'Take a Mock Exam', desc: 'Simulate the ECE board', path: '/exam', icon: Library },
    { title: 'Browse Formulas', desc: 'Quick reference for equations', path: '/formulas', icon: Sigma },
  ]

  const stats = [
    { label: 'Cards Internalized', value: '420', unit: 'cards' },
    { label: 'Exam Average', value: '84', unit: '%' },
    { label: 'Current Streak', value: '12', unit: 'days' },
  ]

  return (
    <div className="h-full bg-[#0D0D0D] p-8 lg:p-12 overflow-y-auto">
      {/* Header */}
      <header className="mb-12">
        <h1 className="font-['Orbitron'] text-4xl lg:text-5xl font-bold text-[#E8E8E8] mb-2 tracking-wider">
          <span className="text-[#00FF41]">ECE</span>ngine
        </h1>
        <p className="text-[#888888] font-['Rajdhani'] text-xl uppercase tracking-widest">
          Electronics Engineering Review Dashboard
        </p>
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
            <div>
              <div className="flex justify-between text-sm mb-2 font-['Rajdhani'] text-[#888888] uppercase tracking-wider">
                <span>Electronics</span>
                <span className="text-[#00FF41]">65%</span>
              </div>
              <div className="w-full bg-[#161616] h-2 rounded-full overflow-hidden border border-[#222]">
                <div className="bg-[#00FF41] h-full shadow-[0_0_8px_rgba(0,255,65,0.8)] w-[65%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2 font-['Rajdhani'] text-[#888888] uppercase tracking-wider">
                <span>Mathematics</span>
                <span className="text-[#FFB800]">38%</span>
              </div>
              <div className="w-full bg-[#161616] h-2 rounded-full overflow-hidden border border-[#222]">
                <div className="bg-[#FFB800] h-full shadow-[0_0_8px_rgba(255,184,0,0.8)] w-[38%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2 font-['Rajdhani'] text-[#888888] uppercase tracking-wider">
                <span>Communications</span>
                <span className="text-[#E8E8E8]">12%</span>
              </div>
              <div className="w-full bg-[#161616] h-2 rounded-full overflow-hidden border border-[#222]">
                <div className="bg-[#E8E8E8] h-full w-[12%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2 font-['Rajdhani'] text-[#888888] uppercase tracking-wider">
                <span>GEAS</span>
                <span className="text-[#FF3333]">5%</span>
              </div>
              <div className="w-full bg-[#161616] h-2 rounded-full overflow-hidden border border-[#222]">
                <div className="bg-[#FF3333] h-full shadow-[0_0_8px_rgba(255,51,51,0.8)] w-[5%]" />
              </div>
            </div>
          </div>
          
          <Link 
             to="/import"
             className="mt-8 relative w-full flex items-center justify-center p-3 text-center border-2 border-dashed border-[#444] rounded text-[#888888] hover:border-[#00FF41] hover:text-[#E8E8E8] transition-colors font-['Rajdhani'] uppercase tracking-wider group"
          >
             <Download size={18} className="mr-2 group-hover:text-[#00FF41]" />
             Import Deck Content
          </Link>
        </div>

      </div>
    </div>
  )
}
