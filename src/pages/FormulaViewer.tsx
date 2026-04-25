import React from 'react'
import { Search, Sigma, Bookmark, BoxSelect } from 'lucide-react'
import { renderMath } from '../lib/latex'

export default function FormulaViewer() {
  const formulas = [
    { title: 'Ohm\'s Law', equation: 'V = I \\times R', category: 'Circuit Theory' },
    { title: 'Power Law', equation: 'P = I^2 \\times R = \\frac{V^2}{R}', category: 'Circuit Theory' },
    { title: 'Capacitive Reactance', equation: 'X_C = \\frac{1}{2\\pi fC}', category: 'AC Analysis' },
    { title: 'Inductive Reactance', equation: 'X_L = 2\\pi fL', category: 'AC Analysis' },
    { title: 'BJT Current Gain', equation: '\\beta = \\frac{\\alpha}{1-\\alpha}', category: 'Solid State' },
    { title: 'Nyquist Rate', equation: 'f_s \\geq 2B', category: 'Communications' },
  ]

  return (
    <div className="h-full bg-[#0D0D0D] p-8 lg:p-12 overflow-y-auto w-full relative">
      
      {/* Absolute Glow Background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[rgba(0,255,65,0.05)] rounded-full blur-[100px] pointer-events-none" />

      <header className="mb-10 lg:w-2/3">
        <h1 className="font-['Orbitron'] text-4xl font-bold text-[#E8E8E8] tracking-wider flex items-center mb-6">
          <Sigma className="text-[#00FF41] mr-4" size={36} />
          FORMULA DATABANK
        </h1>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888888] w-5 h-5 pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search equations, topics, or symbols..." 
            className="w-full bg-[#111111] border border-[#161616] focus:border-[#00FF41] text-[#E8E8E8] placeholder-[#555] py-4 pl-12 pr-6 rounded font-['IBM_Plex_Mono'] outline-none transition-colors shadow-[0_0_20px_rgba(0,0,0,0.5)] focus:shadow-[0_0_15px_rgba(0,255,65,0.2)]"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-screen-2xl">
        {formulas.map((formula, i) => (
          <div key={i} className="bg-[#161616] p-6 rounded-lg border border-[rgba(0,255,65,0.15)] flex flex-col justify-between hover:shadow-[0_4px_15px_rgba(0,255,65,0.1)] transition-all group">
            <div className="flex items-start justify-between mb-4">
               <div>
                  <span className="px-2 py-0.5 text-xs font-['Rajdhani'] uppercase tracking-widest text-[#00FF41] bg-[rgba(0,255,65,0.1)] rounded mb-3 inline-block">
                    {formula.category}
                  </span>
                  <h3 className="font-['Rajdhani'] text-xl font-bold text-[#E8E8E8] leading-tight">
                    {formula.title}
                  </h3>
               </div>
               <button className="text-[#888888] hover:text-[#FFB800] transition-colors focus:outline-none">
                 <Bookmark size={20} />
               </button>
            </div>

            <div className="flex-1 bg-[#111111] border border-[#222] rounded flex items-center justify-center py-8 px-4 font-bold overflow-x-auto my-4 text-2xl group-hover:border-[#00FF41] transition-colors group-hover:bg-[#0D0D0D]">
               <span 
                 dangerouslySetInnerHTML={{ __html: renderMath(`$${formula.equation}$`) }} 
               />
            </div>

            <button className="text-sm font-['Rajdhani'] uppercase tracking-wider text-[#888888] flex items-center hover:text-[#00FF41] outline-none transition-colors mt-auto">
              <BoxSelect size={16} className="mr-2" />
              View Application
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
