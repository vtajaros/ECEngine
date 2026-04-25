import React from 'react'
import { Activity, Flame, TrendingUp, Calendar, Zap, Award } from 'lucide-react'

export default function Statistics() {
  const cards = [
    { title: 'Study Streak', value: '12', unit: 'Days', icon: Flame, color: '#FFB800' },
    { title: 'Total Reviews', value: '1,420', unit: 'Cards', icon: Zap, color: '#00FF41' },
    { title: 'Retention Rate', value: '94', unit: '%', icon: TrendingUp, color: '#00BFFF' },
    { title: 'Exams Passed', value: '4', unit: '/ 5', icon: Award, color: '#E8E8E8' },
  ]

  return (
    <div className="h-full bg-[#0D0D0D] p-8 lg:p-12 overflow-y-auto w-full relative">
      <header className="mb-10 flex flex-col gap-2">
        <h1 className="font-['Orbitron'] text-4xl font-bold text-[#E8E8E8] tracking-wider flex items-center">
          <Activity className="text-[#00FF41] mr-4" size={36} />
          PERFORMANCE STATS
        </h1>
        <p className="text-[#888888] font-['Rajdhani'] text-lg uppercase tracking-widest mt-2">
          Track your readiness for the ECE Boards
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mb-12">
        {cards.map((card, i) => (
          <div key={i} className="bg-[#111111] border border-[#161616] p-6 rounded-lg flex items-center gap-6 shadow-[0_0_15px_rgba(0,0,0,0.4)] group hover:border-[#333] transition-all">
            <div className={`w-14 h-14 rounded bg-[rgba(255,255,255,0.03)] border flex items-center justify-center`} style={{ borderColor: card.color, color: card.color }}>
              <card.icon size={28} className="drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]" />
            </div>
            <div>
              <p className="text-[#888888] font-['Rajdhani'] uppercase tracking-widest text-xs mb-1">
                {card.title}
              </p>
              <div className="font-bold font-['IBM_Plex_Mono'] text-2xl text-[#E8E8E8] flex items-baseline gap-2 leading-none">
                {card.value} <span className="text-sm font-normal text-[#555]">{card.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl">
        <div className="bg-[#111111] border border-[#161616] rounded-xl p-8 shadow-lg">
          <h2 className="font-['Rajdhani'] font-bold text-xl text-[#E8E8E8] mb-6 uppercase tracking-wider flex items-center border-b border-[#222] pb-4">
            <Calendar className="mr-3 text-[#00FF41]" size={24} />
            Review Heatmap
          </h2>
          <div className="flex items-center justify-center h-48 border border-dashed border-[#222] rounded bg-[#0D0D0D] text-[#888888] font-['IBM_Plex_Mono'] text-sm">
            [ Github-style Activity Graph Placeholder ]
          </div>
        </div>

        <div className="bg-[#111111] border border-[#161616] rounded-xl p-8 shadow-lg">
          <h2 className="font-['Rajdhani'] font-bold text-xl text-[#E8E8E8] mb-6 uppercase tracking-wider flex items-center border-b border-[#222] pb-4">
            <TrendingUp className="mr-3 text-[#00BFFF]" size={24} />
            Accuracy over Time
          </h2>
          <div className="flex items-center justify-center h-48 border border-dashed border-[#222] rounded bg-[#0D0D0D] text-[#888888] font-['IBM_Plex_Mono'] text-sm">
            [ Line Chart Placeholder ]
          </div>
        </div>
      </div>
    </div>
  )
}
