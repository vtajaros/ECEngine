import React from 'react'
import { FolderTree, BookOpen } from 'lucide-react'

export default function TableOfContents() {
  const syllabus = [
    { title: 'Mathematics', topics: ['Algebra', 'Calculus', 'Differential Equations', 'Probability', 'Vector Analysis'] },
    { title: 'Electronics', topics: ['Solid State Devices', 'Circuit Analysis', 'Digital Electronics', 'Microprocessors', 'Industrial Electronics'] },
    { title: 'Communications', topics: ['Modulation', 'Wave Propagation', 'Antennas', 'Microwave Systems', 'Satellite Comms'] },
    { title: 'GEAS', topics: ['Physics', 'Chemistry', 'Thermodynamics', 'Engineering Mechanics', 'Materials Science', 'Economics'] },
  ]

  return (
    <div className="h-full bg-[#0D0D0D] p-8 lg:p-12 overflow-y-auto">
      <header className="mb-10 flex flex-col gap-2">
        <h1 className="font-['Orbitron'] text-4xl font-bold text-[#E8E8E8] tracking-wider flex items-center">
          <FolderTree className="text-[#00FF41] mr-4" size={36} />
          TOPICS & SYLLABUS
        </h1>
        <p className="text-[#888888] font-['Rajdhani'] text-lg uppercase tracking-widest">
          Explore all available modules
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-7xl">
        {syllabus.map((subject, i) => (
          <div key={i} className="bg-[#111111] border border-[#161616] rounded-xl overflow-hidden shadow-lg p-8 hover:border-[#00FF41] transition-colors duration-300">
             <h2 className="font-['Rajdhani'] font-bold text-2xl text-[#E8E8E8] mb-6 uppercase tracking-wider flex items-center border-b border-[#222] pb-4">
               <BookOpen className="text-[#00FF41] mr-3" size={24} />
               {subject.title}
             </h2>
             <ul className="space-y-3">
               {subject.topics.map((topic, j) => (
                 <li key={j} className="flex items-center group cursor-pointer border border-transparent hover:border-[#222] p-3 rounded transition-all">
                   <div className="w-2 h-2 rounded-full bg-[#333] group-hover:bg-[#00FF41] group-hover:shadow-[0_0_8px_rgba(0,255,65,0.8)] mr-4 transition-all" />
                   <span className="font-['IBM_Plex_Mono'] text-[#A0A0A0] group-hover:text-[#E8E8E8] text-sm md:text-base">
                     {topic}
                   </span>
                   <button className="opacity-0 group-hover:opacity-100 ml-auto text-xs font-['Rajdhani'] uppercase bg-[#161616] text-[#00FF41] px-3 py-1 rounded border border-[#333] hover:bg-[rgba(0,255,65,0.1)] transition-colors tracking-widest leading-none">
                     Study
                   </button>
                 </li>
               ))}
             </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
