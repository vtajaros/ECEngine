import React from 'react'
import { Play, Clock, FileText, Settings2 } from 'lucide-react'

export default function ExamMode() {
  return (
    <div className="h-full bg-[#0D0D0D] p-8 lg:p-12 overflow-y-auto">
      <header className="mb-10">
        <h1 className="font-['Orbitron'] text-4xl font-bold text-[#E8E8E8] mb-2 tracking-wider flex items-center">
          <FileText className="text-[#00FF41] mr-4" size={36} />
          MOCK EXAM MODE
        </h1>
        <p className="text-[#888888] font-['Rajdhani'] text-lg uppercase tracking-widest">
          Simulate the actual Board Exam Environment
        </p>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-[#111111] p-8 rounded-xl border border-[#161616] shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[rgba(0,255,65,0.05)] rounded-bl-full group-hover:bg-[rgba(0,255,65,0.1)] transition-colors duration-500 pointer-events-none" />
          
          <h2 className="font-['Rajdhani'] font-bold text-2xl text-[#E8E8E8] mb-8 uppercase tracking-wider flex items-center">
            <Settings2 className="mr-3 text-[#00FF41]" size={24} />
            Exam Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <div className="space-y-4">
              <label className="block text-sm font-['Rajdhani'] uppercase tracking-widest text-[#888888]">
                Subject Area
              </label>
              <select className="w-full bg-[#161616] border border-[#222] text-[#E8E8E8] py-3 px-4 rounded font-['IBM_Plex_Mono'] focus:outline-none focus:border-[#00FF41] transition-colors focus:shadow-[0_0_10px_rgba(0,255,65,0.2)]">
                <option>Pre-Board Examination (Full)</option>
                <option>Electronics Engineering (100 Items)</option>
                <option>Mathematics (100 Items)</option>
                <option>Communications (100 Items)</option>
                <option>GEAS (100 Items)</option>
              </select>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-['Rajdhani'] uppercase tracking-widest text-[#888888]">
                Time Limit
              </label>
              <select className="w-full bg-[#161616] border border-[#222] text-[#E8E8E8] py-3 px-4 rounded font-['IBM_Plex_Mono'] focus:outline-none focus:border-[#00FF41] transition-colors focus:shadow-[0_0_10px_rgba(0,255,65,0.2)]">
                <option>4 Hours (Standard)</option>
                <option>2 Hours (Half)</option>
                <option>1 Hour (Sprint)</option>
                <option>No Limit</option>
              </select>
            </div>
          </div>

          <div className="bg-[#161616] p-6 rounded border border-[#222] mb-10 flex items-start gap-4">
            <Clock className="text-[#FFB800] mt-1 shrink-0" size={24} />
            <div>
              <h3 className="font-['Rajdhani'] text-[#FFB800] text-lg font-bold tracking-wider mb-1">Strict Mode is ON</h3>
              <p className="text-[#888888] font-['IBM_Plex_Mono'] text-sm leading-relaxed">
                You cannot pause or exit the exam once started without forfeiting your score. Make sure you have uninterrupted time before proceeding.
              </p>
            </div>
          </div>

          <button className="w-full py-5 bg-[#00FF41] text-[#0D0D0D] rounded font-['Orbitron'] font-bold text-xl tracking-widest uppercase transition-all hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)] flex items-center justify-center group">
            <Play className="mr-3 fill-[currentColor] group-hover:scale-110 transition-transform" size={24} />
            Begin Mock Exam
          </button>
        </div>
      </div>
    </div>
  )
}
