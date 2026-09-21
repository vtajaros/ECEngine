import React from 'react'
import { useGauntletStore } from '../../store/useGauntletStore'
import { History, Flame, Timer } from 'lucide-react'

interface RunHistoryProps {
  hideHeader?: boolean
}

export const RunHistory: React.FC<RunHistoryProps> = ({ hideHeader = false }) => {
  const hub = useGauntletStore(s => s.hub)
  const bests = hub?.bests ?? []
  const runs = hub?.runs ?? []

  const timedBest = bests.find(b => b.mode === 'timed')
  const survivalBest = bests.find(b => b.mode === 'survival')

  const formatDuration = (ms: number) => {
    const sec = Math.floor(ms / 1000)
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}m ${s.toString().padStart(2, '0')}s`
  }

  return (
    <div className="bg-surface rounded-xl p-3 border border-border-base flex flex-col h-full min-h-0 gap-2.5">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between shrink-0">
          <h2 className="font-['Rajdhani'] font-bold text-xs text-text-primary uppercase tracking-widest flex items-center gap-1.5">
            <History className="text-accent" size={14} />
            Records & History
          </h2>
          <span className="text-[10px] font-['Rajdhani'] text-text-muted uppercase tracking-wider">
            Last 10 Runs
          </span>
        </div>
      )}

      {/* Personal Bests (2 compact cards side by side, ~72px) */}
      <div className="grid grid-cols-2 gap-2 shrink-0">
        {/* Timed Best */}
        <div className="bg-surface-2 rounded-lg p-2 border border-border-base flex flex-col justify-between h-[72px]">
          <div className="flex items-center justify-between text-text-muted leading-none">
            <span className="font-['Rajdhani'] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 text-text-primary">
              <Timer size={12} className="text-accent" />
              Timed Best
            </span>
            <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted">{timedBest?.runs ?? 0} runs</span>
          </div>
          <div className="flex items-baseline justify-between leading-none">
            <div>
              <span className="text-[9px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block mb-0.5">
                Top Score
              </span>
              <span className="font-['JetBrains_Mono'] font-bold text-lg text-accent">
                {timedBest?.bestScore != null ? timedBest.bestScore.toLocaleString() : '—'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block mb-0.5">
                Streak
              </span>
              <span className="font-['JetBrains_Mono'] font-bold text-sm text-text-primary">
                {timedBest?.bestStreak != null ? timedBest.bestStreak : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Survival Best */}
        <div className="bg-surface-2 rounded-lg p-2 border border-border-base flex flex-col justify-between h-[72px]">
          <div className="flex items-center justify-between text-text-muted leading-none">
            <span className="font-['Rajdhani'] text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 text-text-primary">
              <Flame size={12} className="text-accent" />
              Survival Best
            </span>
            <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted">{survivalBest?.runs ?? 0} runs</span>
          </div>
          <div className="flex items-baseline justify-between leading-none">
            <div>
              <span className="text-[9px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block mb-0.5">
                Top Score
              </span>
              <span className="font-['JetBrains_Mono'] font-bold text-lg text-accent">
                {survivalBest?.bestScore != null ? survivalBest.bestScore.toLocaleString() : '—'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-['Rajdhani'] uppercase tracking-wider text-text-muted block mb-0.5">
                Streak
              </span>
              <span className="font-['JetBrains_Mono'] font-bold text-sm text-text-primary">
                {survivalBest?.bestStreak != null ? survivalBest.bestStreak : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Runs List (fills remaining height, internal scroll only) */}
      <div className="flex-1 min-h-0 flex flex-col gap-1">
        <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted shrink-0">
          RECENT RUNS
        </span>

        {runs.length === 0 ? (
          <div className="py-6 text-center text-text-muted text-xs font-['Rajdhani'] uppercase tracking-wider">
            No Gauntlet runs recorded yet.
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border-base/50 bg-surface-2/30 rounded-lg border border-border-base">
            {runs.map(r => {
              const dateStr = new Date(r.startedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })
              const timeStr = new Date(r.startedAt).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })
              const accuracyPct = r.answered > 0 ? Math.round((r.correct / r.answered) * 100) : 0

              return (
                <div key={r.id} className="p-2 flex items-center justify-between text-xs hover:bg-surface-2/70 transition-colors">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] font-['Rajdhani'] font-bold uppercase tracking-wider shrink-0 ${
                        r.rated
                          ? 'bg-[#00FF41] text-black font-bold'
                          : 'border border-border-base text-text-muted'
                      }`}
                    >
                      {r.rated ? 'RATED' : 'PRACTICE'}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-['Orbitron'] text-[11px] font-bold text-text-primary uppercase leading-tight">
                          {r.mode}
                        </span>
                        <span className="text-[10px] font-['JetBrains_Mono'] text-text-muted leading-tight">
                          {formatDuration(r.durationMs)}
                        </span>
                      </div>
                      <span className="text-[9px] text-text-muted font-['JetBrains_Mono'] leading-tight">
                        {dateStr} {timeStr}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right shrink-0">
                    <div>
                      <span className="text-[8px] text-text-muted font-['Rajdhani'] uppercase block leading-none">
                        Acc
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[11px] text-text-primary leading-none">
                        {r.correct}/{r.answered} ({accuracyPct}%)
                      </span>
                    </div>

                    <div className="min-w-[50px]">
                      <span className="text-[8px] text-text-muted font-['Rajdhani'] uppercase block leading-none">
                        Score
                      </span>
                      <span className="font-['JetBrains_Mono'] font-bold text-xs text-accent leading-none">
                        {r.score.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
