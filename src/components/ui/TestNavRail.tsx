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
      className="w-36 shrink-0 flex flex-col items-stretch border-r border-zinc-800 border-y border-l border-border-base/30 rounded-xl shadow-xl overflow-hidden h-[calc(100vh-120px)] py-0 mb-0 bg-[#0a0a0a] select-none"
      aria-label="Question Navigator"
    >
      <div className="px-4 py-3 shrink-0 flex flex-col items-center gap-1 border-b border-surface">
        <span className="font-['Rajdhani'] font-semibold tracking-widest text-zinc-400 text-[10px] uppercase leading-tight">
          Item Navigator
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="font-['JetBrains_Mono'] text-[11px] text-accent font-bold tabular-nums">
            {answeredCount}
          </span>
          <span className="font-['JetBrains_Mono'] text-[11px] text-[#444]">/</span>
          <span className="font-['JetBrains_Mono'] text-[11px] text-zinc-400 tabular-nums">
            {totalItems}
          </span>
          <span className="font-['Rajdhani'] text-[10px] uppercase tracking-widest text-zinc-400 ml-0.5">
            answered
          </span>
        </div>
        <div className="mt-2 w-full h-0.5 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
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
        className="flex-1 overflow-y-auto px-5 py-4 scroll-py-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <div className="flex flex-col gap-1 items-stretch">
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
                  'flex items-center justify-start gap-2 w-full',
                  'py-1.5 px-3 rounded-md',
                  isActive
                    ? 'text-white font-bold bg-white/5 border-l-2 border-accent pl-2.5'
                    : answered
                      ? 'text-green-400 font-medium hover:text-green-300 hover:bg-white/5'
                      : 'text-zinc-400 font-medium hover:text-white hover:bg-white/5'
                ].join(' ')}
              >
                <span className="flex items-center gap-1">
                  <span>Question </span>
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
