import React from 'react'
import { ClipboardList } from 'lucide-react'
import { TOSTracker } from '../components/ui/TOSTracker'

export default function TOSChecklist() {
  return (
    <div className="h-full bg-[var(--bg-primary)] px-6 pb-6 pt-6 lg:px-12 lg:pb-12 lg:pt-6 overflow-y-auto w-full">
      <div className="max-w-7xl mx-auto flex flex-col h-full">
        <header className="mb-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-[var(--bg-card)] pb-6 pt-4 shrink-0">
          <div className="flex flex-col gap-2">
            <h1 className="font-['Orbitron'] text-3xl lg:text-4xl font-bold text-[var(--text-primary)] tracking-wider flex items-center">
              <ClipboardList className="text-[#00FF41] mr-4 shrink-0" size={36} />
              REVIEW <span className="text-[#00FF41] ml-2">CHECKLIST</span>
            </h1>
            <p className="text-[var(--text-secondary)] font-['Rajdhani'] text-sm sm:text-base uppercase tracking-widest">
              EELE Board Exam Review Tracker
            </p>
          </div>
        </header>

        <div className="flex-1 pb-12">
          <TOSTracker />
        </div>
      </div>
    </div>
  )
}
