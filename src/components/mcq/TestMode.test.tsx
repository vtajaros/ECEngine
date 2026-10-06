// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TestMode } from './TestMode'
import type { Card } from '../../types'

vi.mock('react-router-dom', () => ({
  useBlocker: () => ({
    state: 'unblocked',
    proceed: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 100,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: `key_${i}`,
        start: i * 100,
        size: 100,
      })),
    measureElement: () => {},
    scrollToIndex: vi.fn(),
  }),
}))

vi.mock('../../services/db.service', () => ({
  dbService: {
    recordCardResultsBatch: vi.fn().mockResolvedValue({ success: true }),
  },
}))

vi.mock('../../hooks/useSound', () => ({
  useSound: () => ({
    play: vi.fn(),
  }),
  useSoundVolume: () => ({
    volume: 1,
    isMuted: false,
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
  }),
}))

const mockCards: Card[] = [
  {
    id: 'card-1',
    topicId: 't1',
    type: 'mcq',
    difficulty: 'easy',
    tags: [],
    isCustom: false,
    createdAt: new Date().toISOString(),
    data: {
      question: 'Question 1',
      choices: ['Choice 1A', 'Choice 1B', 'Choice 1C', 'Choice 1D'],
      answer: 0,
      explanation: 'Explanation 1',
    },
  },
  {
    id: 'card-2',
    topicId: 't1',
    type: 'mcq',
    difficulty: 'medium',
    tags: [],
    isCustom: false,
    createdAt: new Date().toISOString(),
    data: {
      question: 'Question 2',
      choices: ['Choice 2A', 'Choice 2B', 'Choice 2C', 'Choice 2D'],
      answer: 1,
      explanation: 'Explanation 2',
    },
  },
]

describe('TestMode auto-submit', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    if (root && container) {
      act(() => {
        root!.unmount()
      })
      container.remove()
    }
    vi.useRealTimers()
  })

  it('auto-submits after answering the last question when instant checking is enabled', async () => {
    const onComplete = vi.fn()
    const onExit = vi.fn()

    act(() => {
      root!.render(
        <TestMode
          cards={mockCards}
          title="Unit Test Exam"
          settings={{
            instantChecking: true,
            shuffleQuestions: false,
            shuffleChoices: false,
            bookmarkedOnly: false,
          }}
          onComplete={onComplete}
          onExit={onExit}
        />
      )
    })

    // Find and answer question 1 (Choice 1A)
    const choice1A = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Choice 1A')
    )
    expect(choice1A).toBeTruthy()

    act(() => {
      choice1A!.click()
    })

    // Advance timer slightly — should NOT have submitted yet since question 2 is unanswered
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(container?.textContent).toContain('TEST:Unit Test Exam')

    // Find and answer question 2 (the last question, Choice 2B)
    const choice2B = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Choice 2B')
    )
    expect(choice2B).toBeTruthy()

    act(() => {
      choice2B!.click()
    })

    // Timer is set for 700ms; before 700ms it has not submitted yet
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(onComplete).not.toHaveBeenCalled()

    // Advance past 700ms
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // Now auto-submit should have executed!
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        score: 2,
        total: 2,
        correctIds: ['card-1', 'card-2'],
      })
    )

    // Summary view should now be displayed
    expect(container?.textContent).toContain('Test Completed')
    expect(container?.textContent).toContain('100%')
  })

  it('does NOT auto-submit when instant checking is disabled', () => {
    const onComplete = vi.fn()
    const onExit = vi.fn()

    act(() => {
      root!.render(
        <TestMode
          cards={mockCards}
          title="Unit Test Exam"
          settings={{
            instantChecking: false,
            shuffleQuestions: false,
            shuffleChoices: false,
            bookmarkedOnly: false,
          }}
          onComplete={onComplete}
          onExit={onExit}
        />
      )
    })

    // Answer both questions
    const choice1A = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Choice 1A')
    )
    const choice2B = Array.from(container?.querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Choice 2B')
    )

    act(() => {
      choice1A!.click()
      choice2B!.click()
    })

    // Advance timers significantly
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // Should NOT have auto-submitted
    expect(onComplete).not.toHaveBeenCalled()
    expect(container?.textContent).toContain('Submit Test')
  })
})
