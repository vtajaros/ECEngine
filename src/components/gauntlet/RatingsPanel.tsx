import React from 'react'
import { Subject } from '../../types'
import { GAUNTLET_SUBJECTS, TUNING, overallRating, ratingTier, TIER_COLORS } from '../../lib/gauntlet'
import { SUBJECT_LINE_COLOR } from '../../lib/dashboardUtils'
import { useGauntletStore } from '../../store/useGauntletStore'
import { Tooltip } from '../ui/Tooltip'
import { Zap } from 'lucide-react'

const SUBJECT_FULL_NAME: Record<Subject, string> = {
  MATH: 'Mathematics',
  GEAS: 'General Engineering & Applied Sciences',
  ELECS: 'Electronics Engineering',
  EST: 'Electronics Systems & Technologies',
}

export const RatingsPanel: React.FC = () => {
  const hub = useGauntletStore(s => s.hub)
  const ratings = hub?.ratings ?? {
    MATH: { rating: TUNING.startRating, answers: 0 },
    GEAS: { rating: TUNING.startRating, answers: 0 },
    ELECS: { rating: TUNING.startRating, answers: 0 },
    EST: { rating: TUNING.startRating, answers: 0 },
  }
  const peaks = hub?.peaks ?? {}
  const overall = overallRating(ratings)
  const overallTier = ratingTier(overall.rating)
  const overallColor = TIER_COLORS[overallTier.name] ?? '#00FF41'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 shrink-0">
      {/* 4 Subject Cards */}
      {GAUNTLET_SUBJECTS.map(subject => {
        const r = ratings[subject]
        const peak = peaks[subject]
        const isProvisional = r.answers < TUNING.provisionalAnswers
        const color = SUBJECT_LINE_COLOR[subject]

        return (
          <Tooltip key={subject} content={SUBJECT_FULL_NAME[subject]} position="bottom">
            <div
              className="bg-surface rounded-lg p-2.5 border border-border-base flex flex-col justify-between h-[88px] relative overflow-hidden"
              style={{ borderTop: `3px solid ${color}` }}
            >
              {/* Line 1: Subject code + Provisional badge */}
              <div className="flex items-center justify-between gap-1 leading-none">
                <span
                  className="font-['Orbitron'] font-bold text-xs tracking-wider"
                  style={{ color }}
                >
                  {subject}
                </span>
                {isProvisional ? (
                  <span className="px-1 py-0.5 rounded text-[8px] font-['Rajdhani'] font-bold uppercase tracking-wider border border-[#f59e0b] text-[#f59e0b] shrink-0 leading-none">
                    PROVISIONAL
                  </span>
                ) : (
                  <span className="px-1 py-0.5 rounded text-[8px] font-['Rajdhani'] font-bold uppercase tracking-wider border border-accent text-accent shrink-0 leading-none">
                    SETTLED
                  </span>
                )}
              </div>

              {/* Line 2: Large rating */}
              <div className="font-['JetBrains_Mono'] font-bold text-xl text-text-primary tracking-tight leading-none">
                {Math.round(r.rating)}
              </div>

              {/* Line 3: peak N · N ans in one muted line */}
              <div className="text-[10px] font-['JetBrains_Mono'] text-text-muted truncate leading-none">
                peak {Math.round(peak ?? r.rating)} · {r.answers} ans
              </div>
            </div>
          </Tooltip>
        )
      })}

      {/* Overall TOS-weighted Card */}
      <Tooltip content="TOS-Weighted Average (MATH 20%, GEAS 20%, ELECS 30%, EST 30%)" position="bottom">
        <div
          className="bg-surface rounded-lg p-2.5 border border-border-base flex flex-col justify-between h-[88px] relative overflow-hidden"
          style={{ borderTop: `3px solid ${overallColor}` }}
        >
          {/* Line 1: OVERALL + Provisional badge */}
          <div className="flex items-center justify-between gap-1 leading-none">
            <span
              className="font-['Orbitron'] font-bold text-xs tracking-wider flex items-center gap-1"
              style={{ color: overallColor }}
            >
              <Zap size={11} />
              OVERALL
            </span>
            {overall.provisional ? (
              <span className="px-1 py-0.5 rounded text-[8px] font-['Rajdhani'] font-bold uppercase tracking-wider border border-[#f59e0b] text-[#f59e0b] shrink-0 leading-none">
                PROVISIONAL
              </span>
            ) : (
              <span
                className="px-1 py-0.5 rounded text-[8px] font-['Rajdhani'] font-bold uppercase tracking-wider border shrink-0 leading-none"
                style={{ borderColor: overallColor, color: overallColor }}
              >
                {overallTier.name}
              </span>
            )}
          </div>

          {/* Line 2: Large rating */}
          <div
            className="font-['JetBrains_Mono'] font-bold text-xl tracking-tight leading-none"
            style={{ color: overallColor }}
          >
            {Math.round(overall.rating)}
          </div>

          {/* Line 3: Subline TOS 20/20/30/30 */}
          <div className="text-[10px] font-['JetBrains_Mono'] text-text-muted truncate leading-none">
            TOS 20/20/30/30
          </div>
        </div>
      </Tooltip>
    </div>
  )
}
