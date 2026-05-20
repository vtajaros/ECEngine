import React, { memo, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TestNavRailProps {
  /** Total number of questions in the test */
  totalItems: number
  /** Zero-based index of the currently visible/active question */
  currentIndex: number
  /**
   * Set of zero-based indices that have been answered.
   * Accepts either a Set<number> or a Record<number, boolean> for flexibility.
   */
  answeredIndices: Set<number> | Record<number, boolean>
  /** Called when the user clicks a chip to navigate to that question */
  onNavigate: (index: number) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAnswered(
  answeredIndices: Set<number> | Record<number, boolean>,
  index: number
): boolean {
  if (answeredIndices instanceof Set) return answeredIndices.has(index)
  return !!answeredIndices[index]
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TestNavRail = memo(({
  totalItems,
  currentIndex,
  answeredIndices,
  onNavigate,
}: TestNavRailProps) => {
  // Ref map for active chip auto-scroll
  const activeChipRef = useRef<HTMLButtonElement | null>(null)
  const railBodyRef   = useRef<HTMLDivElement>(null)

  // Auto-scroll the rail so the active chip stays visible in the center
  useEffect(() => {
    requestAnimationFrame(() => {
      activeChipRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'center',
      })
    })
  }, [currentIndex])

  // Pre-count answered for the header label
  const answeredCount = Array.from({ length: totalItems }, (_, i) =>
    isAnswered(answeredIndices, i)
  ).filter(Boolean).length

  return (
    <aside
      className="w-48 shrink-0 flex flex-col border-r border-zinc-800 border-y border-l border-[#222]/30 bg-[#0a0a0a] rounded-xl select-none shadow-xl overflow-hidden h-[calc(100vh-120px)]"
      aria-label="Question Navigator"
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-[#1e1e1e] shrink-0">
        <span className="font-['Rajdhani'] font-semibold tracking-wider text-zinc-300 text-[10px] uppercase block leading-tight">
          Question Navigator
        </span>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="font-['IBM_Plex_Mono'] text-[11px] text-[#00FF41] font-bold tabular-nums">
            {answeredCount}
          </span>
          <span className="font-['IBM_Plex_Mono'] text-[11px] text-[#444]">/</span>
          <span className="font-['IBM_Plex_Mono'] text-[11px] text-zinc-400 tabular-nums">
            {totalItems}
          </span>
          <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-zinc-400 ml-0.5">
            answered
          </span>
        </div>

        {/* Mini progress bar */}
        <div className="mt-2 w-full h-0.5 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#00FF41] transition-all duration-500"
            style={{
              width: totalItems > 0
                ? `${Math.round((answeredCount / totalItems) * 100)}%`
                : '0%',
            }}
          />
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="px-5 py-2 flex items-center gap-4 border-b border-[#111] shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-zinc-400" />
          <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-zinc-400">
            Unanswered
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Check className="w-2.5 h-2.5 text-green-400" />
          <span className="font-['Rajdhani'] text-[9px] uppercase tracking-widest text-zinc-400">
            Answered
          </span>
        </div>
      </div>

      {/* ── Question List (Single Column, Scrollable) ─────────────────────── */}
      <div
        ref={railBodyRef}
        className="flex-1 overflow-y-auto px-5 py-4 scroll-py-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <div className="flex flex-col gap-4 pl-2">
          {Array.from({ length: totalItems }, (_, i) => {
            const answered = isAnswered(answeredIndices, i)
            const isActive = i === currentIndex

            return (
              <button
                key={i}
                ref={isActive ? activeChipRef : null}
                onClick={() => onNavigate(i)}
                title={`Question ${i + 1}${answered ? ' (Answered)' : ''}`}
                className={[
                  'font-["Rajdhani"] text-left select-none transition-all duration-150 ease-in-out flex items-center justify-between w-full py-1 pr-2',
                  isActive
                    ? 'text-white font-bold text-lg border-l-2 border-white pl-2 -ml-[10px]'
                    : answered
                      ? 'text-green-400 font-medium hover:text-green-300'
                      : 'text-zinc-300 font-medium hover:text-white'
                ].join(' ')}
              >
                <span>Question {i + 1}</span>
                {answered && (
                  <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
})

TestNavRail.displayName = 'TestNavRail'
