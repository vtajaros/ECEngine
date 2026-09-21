import React from 'react'
import { useGauntletStore } from '../../store/useGauntletStore'
import { RatingsPanel } from './RatingsPanel'
import { SetupPanel } from './SetupPanel'
import { RunHistory } from './RunHistory'
import { AlertCircle, Zap } from 'lucide-react'

export const GauntletHub: React.FC = () => {
  const loadError = useGauntletStore(s => s.loadError)

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 flex-1">
      {/* Header — ONE line, ~44px */}
      <header className="shrink-0 h-11 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Zap className="text-accent" size={24} />
          <h1 className="font-['Orbitron'] text-2xl lg:text-3xl font-bold text-text-primary tracking-wider flex items-center gap-1.5">
            <span className="text-accent">GAUNTLET</span> MODE
          </h1>
        </div>
        <p className="hidden lg:block text-[#666] font-['Rajdhani'] text-sm uppercase tracking-widest">
          High-Stakes Speed & Accuracy Arena
        </p>
      </header>

      {/* Error Banner */}
      {loadError && (
        <div className="shrink-0 bg-[#FF3333]/15 border border-[#FF3333] rounded-lg p-2.5 flex items-center gap-2 text-[#FF3333] text-xs font-['Rajdhani'] font-bold uppercase tracking-wider">
          <AlertCircle size={15} className="shrink-0" />
          <div className="flex-1 truncate">{loadError}</div>
        </div>
      )}

      {/* Top: Compact Ratings Row (~88px) */}
      <div className="shrink-0">
        <RatingsPanel />
      </div>

      {/* Main Row: CSS grid grid-cols-12 gap-3 */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
        <div className="xl:col-span-7 min-h-0 flex flex-col">
          <SetupPanel />
        </div>
        <div className="xl:col-span-5 min-h-0 flex flex-col">
          <RunHistory />
        </div>
      </div>
    </div>
  )
}
