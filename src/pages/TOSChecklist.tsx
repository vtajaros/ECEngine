import React from 'react'
import { ClipboardList } from 'lucide-react'
import { TOSTracker } from '../components/ui/TOSTracker'

export default function TOSChecklist() {
  return (
    <div className="h-full bg-transparent px-6 pb-6 pt-6 lg:px-12 lg:pb-12 lg:pt-6 overflow-y-auto show-scrollbar w-full">
      <div className="max-w-7xl mx-auto flex flex-col h-full">
        <header className="mb-8 flex flex-col items-center justify-center border-b border-[var(--bg-card)] pb-6 pt-4 shrink-0">
          <div className="flex flex-col items-center text-center px-4 gap-3">
            <div className="flex items-center gap-4">
              <ClipboardList className="text-accent shrink-0" size={36} />
              <h1 className="font-['Orbitron'] text-4xl font-bold text-[var(--text-primary)] tracking-wider m-0">
                REVIEW <span className="text-accent">CHECKLIST</span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-[var(--text-secondary)] font-['Rajdhani'] text-base uppercase tracking-widest">
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
