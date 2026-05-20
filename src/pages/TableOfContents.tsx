import React, { useState } from 'react'
import { FolderTree, Search } from 'lucide-react'
import { TOC_DATA } from '../components/toc/data'
import { SubjectCard } from '../components/toc/SubjectCard'

export default function TableOfContents() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="h-full bg-[var(--bg-primary)] px-6 pb-6 pt-6 lg:px-12 lg:pb-12 lg:pt-6 overflow-y-auto w-full">
      <div className="max-w-5xl mx-auto flex flex-col h-full">
        <header className="mb-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-[var(--bg-card)] pb-6 pt-4 shrink-0">
          <div className="flex flex-col gap-2">
            <h1 className="font-['Orbitron'] text-3xl lg:text-4xl font-bold text-[var(--text-primary)] tracking-wider flex items-center">
              <FolderTree className="text-[var(--accent-primary)] mr-4" size={36} />
              REELE <span className="text-[var(--accent-primary)] ml-2">ToS</span>
            </h1>
            <p className="text-[var(--text-secondary)] font-['Rajdhani'] text-lg uppercase tracking-widest">
              PRC ECE TABLE OF SPECIFICATIONS (2022 TOS)
            </p>
          </div>
          
          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-[#666]" />
            </div>
            <input 
              type="text" 
              placeholder="Search topics..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#111] border border-[#333] focus:border-[var(--accent-primary)] rounded-lg pl-10 pr-4 py-3 text-[var(--text-primary)] font-['IBM_Plex_Mono'] text-sm outline-none transition-colors shadow-inner"
            />
          </div>
        </header>

        <div className="flex flex-col gap-6 pb-12 flex-1">
          {TOC_DATA.map(subject => (
            <SubjectCard 
              key={subject.id} 
              subject={subject} 
              searchQuery={searchQuery} 
            />
          ))}
          
          {searchQuery && !TOC_DATA.some(s => {
            const hasTopic = s.topics.some(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.subtopics.some(st => st.name.toLowerCase().includes(searchQuery.toLowerCase())))
            return s.name.toLowerCase().includes(searchQuery.toLowerCase()) || hasTopic
          }) && (
            <div className="text-center py-20 text-[var(--text-secondary)] font-['Rajdhani'] uppercase tracking-widest text-lg">
              No matching topics found for "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
