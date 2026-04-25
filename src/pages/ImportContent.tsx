import React from 'react'
import { DownloadCloud, FileJson, AlertCircle } from 'lucide-react'

export default function ImportContent() {
  return (
    <div className="h-full bg-[#0D0D0D] p-8 lg:p-12 overflow-y-auto flex flex-col w-full relative">
      <header className="mb-10">
        <h1 className="font-['Orbitron'] text-4xl font-bold text-[#E8E8E8] tracking-wider flex items-center">
          <DownloadCloud className="text-[#00FF41] mr-4" size={36} />
          IMPORT DATA
        </h1>
        <p className="text-[#888888] font-['Rajdhani'] text-lg uppercase tracking-widest mt-2">
          Load new decks, formulas, and mock exams
        </p>
      </header>

      <div className="max-w-3xl border-2 border-dashed border-[#222] rounded-xl p-16 text-center hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.02)] transition-all flex border-spacing-4 flex-col items-center justify-center cursor-pointer group mb-12">
         <div className="mb-6 p-6 rounded-full bg-[#111111] border border-[#161616] group-hover:border-[#00FF41] group-hover:text-[#00FF41] group-hover:shadow-[0_0_20px_rgba(0,255,65,0.2)] transition-all">
           <FileJson className="w-12 h-12 text-[#888888] group-hover:text-[#00FF41]" />
         </div>
         <h2 className="font-['Rajdhani'] text-2xl font-bold text-[#E8E8E8] mb-2 uppercase tracking-wide">
           Drag & Drop JSON File
         </h2>
         <p className="text-[#555] font-['IBM_Plex_Mono'] text-sm mb-8">
           Supports ECEngine .json format only
         </p>
         <button className="px-6 py-3 bg-[#111111] text-[#00FF41] border border-[#00FF41] rounded font-['Rajdhani'] uppercase tracking-widest hover:bg-[rgba(0,255,65,0.1)] transition-colors focus:shadow-[0_0_10px_rgba(0,255,65,0.4)]">
           Browse Files
         </button>
      </div>

      <div className="max-w-2xl bg-[#161616] p-6 rounded border border-[#FFB800] flex items-start gap-4 shadow-lg shadow-[rgba(255,184,0,0.05)]">
         <AlertCircle className="text-[#FFB800] shrink-0 mt-1" size={24} />
         <div>
           <h3 className="font-['Rajdhani'] text-[#FFB800] font-bold text-lg uppercase tracking-wider mb-1">
             Warning
           </h3>
           <p className="text-[#888888] text-sm font-['IBM_Plex_Mono'] leading-relaxed">
             Importing a deck with existing identical IDs will overwrite your current progress for those specific cards. Always back up your progress using the Export feature in Settings before performing large bulk imports.
           </p>
         </div>
      </div>
    </div>
  )
}
