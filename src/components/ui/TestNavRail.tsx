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
      className="w-full overflow-x-auto flex flex-row py-2 mb-4 border-b border-zinc-800 bg-[#0a0a0a] select-none shrink-0 h-auto sm:w-36 sm:shrink-0 sm:flex-col sm:items-stretch sm:border-r sm:border-zinc-800 sm:border-y sm:border-l sm:border-[#222]/30 sm:rounded-xl sm:shadow-xl sm:overflow-hidden sm:h-[calc(100vh-120px)] sm:py-0 sm:mb-0 sm:border-b-0 max-sm:[&::-webkit-scrollbar]:hidden max-sm:[scrollbar-width:none]"
      aria-label="Question Navigator"
    >
      <div className="px-4 py-3 shrink-0 hidden sm:flex sm:flex-col sm:items-center sm:gap-1 border-b border-[#1a1a1a]">
        <span className="font-['Rajdhani'] font-semibold tracking-widest text-zinc-400 text-[10px] uppercase leading-tight">
          Item Navigator
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
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

      {/* ── Question List (Single Column, Scrollable) ─────────────────────── */}
      <div
        ref={railBodyRef}
        className="flex-1 sm:overflow-y-auto px-4 sm:px-5 py-1 sm:py-4 scroll-py-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <div className="flex flex-row sm:flex-col gap-3 sm:gap-1 items-center sm:items-stretch">
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
                  'font-["Rajdhani"] text-sm select-none transition-all duration-150 ease-in-out',
                  'flex items-center justify-start gap-2 shrink-0 w-auto sm:w-full',
                  'py-1.5 px-3 rounded-md',
                  isActive
                    ? 'text-white font-bold bg-white/5 border-l-2 border-[#00FF41] pl-2.5'
                    : answered
                      ? 'text-green-400 font-medium hover:text-green-300 hover:bg-white/5'
                      : 'text-zinc-400 font-medium hover:text-white hover:bg-white/5'
                ].join(' ')}
              >
                <span className="flex items-center gap-1">
                  <span className="hidden sm:inline">Question </span>
                  <span>{i + 1}</span>
                </span>
                {answered && (
                  <Check className="w-3 h-3 text-green-400 shrink-0 ml-1.5" />
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
