// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FlashcardReviewSummary, CardGradeInfo } from './FlashcardReviewSummary'
import type { Card } from '../../types'

const mockCards: Card[] = [
  {
    id: 'card-1',
    topicId: 'topic-1',
    type: 'flashcard',
    data: { front: 'Ohm’s Law', back: 'V = IR', explanation: 'Relates voltage, current, resistance' },
    difficulty: 'easy',
    tags: [],
    isCustom: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'card-2',
    topicId: 'topic-1',
    type: 'flashcard',
    data: { front: 'Kirchhoff’s Current Law', back: 'Sum of currents entering a node is zero' },
    difficulty: 'medium',
    tags: [],
    isCustom: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'card-3',
    topicId: 'topic-1',
    type: 'flashcard',
    data: { front: 'Kirchhoff’s Voltage Law', back: 'Sum of voltages in a loop is zero' },
    difficulty: 'hard',
    tags: [],
    isCustom: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'card-4',
    topicId: 'topic-1',
    type: 'flashcard',
    data: { front: 'Thevenin’s Theorem', back: 'Equivalent voltage and resistance' },
    difficulty: 'medium',
    tags: [],
    isCustom: false,
    createdAt: new Date().toISOString(),
  },
]

const mockGrades: Record<string, CardGradeInfo> = {
  'card-1': { rating: 4, interval: 4, repetitions: 1, easeFactor: 2.65, nextReview: '2026-10-10' }, // Easy
  'card-2': { rating: 3, interval: 1, repetitions: 1, easeFactor: 2.5, nextReview: '2026-10-07' },  // Good
  'card-3': { rating: 2, interval: 1, repetitions: 0, easeFactor: 2.36, nextReview: '2026-10-06' },  // Hard
  'card-4': { rating: 1, interval: 1, repetitions: 0, easeFactor: 2.3, nextReview: '2026-10-06' },   // Again
}

describe('FlashcardReviewSummary', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  beforeEach(() => {
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
  })

  it('renders summary header, deck title, and grade counts', () => {
    act(() => {
      root!.render(
        <FlashcardReviewSummary
          deckTitle="Circuit Theorems"
          deckSubject="ELECS"
          deckId="topic-1"
          cards={mockCards}
          cardGrades={mockGrades}
          bookmarks={new Set()}
          onToggleBookmark={vi.fn()}
          onStudyAgain={vi.fn()}
          onDone={vi.fn()}
        />
      )
    })

    const text = container?.textContent || ''
    expect(text).toContain('Circuit Theorems')
    expect(text).toContain('Session Review Summary')
    expect(text).toContain('Deck Session Complete!')
    expect(text).toContain('50% Retention')
    expect(text).toContain('Again (1)')
    expect(text).toContain('Hard (2)')
    expect(text).toContain('Good (3)')
    expect(text).toContain('Easy (4)')
  })

  it('filters cards by search input', () => {
    act(() => {
      root!.render(
        <FlashcardReviewSummary
          deckTitle="Circuit Theorems"
          deckSubject="ELECS"
          deckId="topic-1"
          cards={mockCards}
          cardGrades={mockGrades}
          bookmarks={new Set()}
          onToggleBookmark={vi.fn()}
          onStudyAgain={vi.fn()}
          onDone={vi.fn()}
        />
      )
    })

    const searchInput = container?.querySelector('input[placeholder*="Filter by term or definition"]') as HTMLInputElement
    expect(searchInput).toBeTruthy()

    act(() => {
      searchInput.value = 'Kirchhoff'
      searchInput.dispatchEvent(new Event('input', { bubbles: true }))
      // Also trigger change
      searchInput.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // React state update via onChange
    act(() => {
      // Find React fiber or dispatch simulated input event
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      nativeInputValueSetter?.call(searchInput, 'Kirchhoff')
      searchInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const text = container?.textContent || ''
    expect(text).toContain('Kirchhoff’s Current Law')
    expect(text).toContain('Kirchhoff’s Voltage Law')
  })

  it('calls onDrillWeakCards with Again and Hard cards', () => {
    const onDrillWeakCards = vi.fn()
    act(() => {
      root!.render(
        <FlashcardReviewSummary
          deckTitle="Circuit Theorems"
          deckSubject="ELECS"
          deckId="topic-1"
          cards={mockCards}
          cardGrades={mockGrades}
          bookmarks={new Set()}
          onToggleBookmark={vi.fn()}
          onStudyAgain={vi.fn()}
          onDrillWeakCards={onDrillWeakCards}
          onDone={vi.fn()}
        />
      )
    })

    const buttons = Array.from(container?.querySelectorAll('button') || [])
    const drillButton = buttons.find((b) => b.textContent?.includes('Drill Missed & Hard'))
    expect(drillButton).toBeTruthy()

    act(() => {
      drillButton!.click()
    })

    expect(onDrillWeakCards).toHaveBeenCalledWith(['card-3', 'card-4'])
  })

  it('calls onStudyAgain when clicking Study All Again', () => {
    const onStudyAgain = vi.fn()
    act(() => {
      root!.render(
        <FlashcardReviewSummary
          deckTitle="Circuit Theorems"
          deckSubject="ELECS"
          deckId="topic-1"
          cards={mockCards}
          cardGrades={mockGrades}
          bookmarks={new Set()}
          onToggleBookmark={vi.fn()}
          onStudyAgain={onStudyAgain}
          onDone={vi.fn()}
        />
      )
    })

    const buttons = Array.from(container?.querySelectorAll('button') || [])
    const studyAgainButton = buttons.find((b) => b.textContent?.includes('Study All Again'))
    expect(studyAgainButton).toBeTruthy()

    act(() => {
      studyAgainButton!.click()
    })

    expect(onStudyAgain).toHaveBeenCalledTimes(1)
  })

  it('calls onDone when clicking Done or Back to Decks', () => {
    const onDone = vi.fn()
    act(() => {
      root!.render(
        <FlashcardReviewSummary
          deckTitle="Circuit Theorems"
          deckSubject="ELECS"
          deckId="topic-1"
          cards={mockCards}
          cardGrades={mockGrades}
          bookmarks={new Set()}
          onToggleBookmark={vi.fn()}
          onStudyAgain={vi.fn()}
          onDone={onDone}
        />
      )
    })

    const buttons = Array.from(container?.querySelectorAll('button') || [])
    const doneButton = buttons.find((b) => b.textContent?.trim() === 'Done')
    expect(doneButton).toBeTruthy()

    act(() => {
      doneButton!.click()
    })
    expect(onDone).toHaveBeenCalledTimes(1)

    const backButton = buttons.find((b) => b.textContent?.includes('Back to Decks'))
    expect(backButton).toBeTruthy()

    act(() => {
      backButton!.click()
    })
    expect(onDone).toHaveBeenCalledTimes(2)
  })

  it('toggles bookmark when bookmark button is clicked', () => {
    const onToggleBookmark = vi.fn()
    act(() => {
      root!.render(
        <FlashcardReviewSummary
          deckTitle="Circuit Theorems"
          deckSubject="ELECS"
          deckId="topic-1"
          cards={mockCards}
          cardGrades={mockGrades}
          bookmarks={new Set(['fc_bookmark_card-1'])}
          onToggleBookmark={onToggleBookmark}
          onStudyAgain={vi.fn()}
          onDone={vi.fn()}
        />
      )
    })

    const bmButton = container?.querySelector('button[aria-label="Remove Bookmark"]') as HTMLButtonElement
    expect(bmButton).toBeTruthy()

    act(() => {
      bmButton.click()
    })
    expect(onToggleBookmark).toHaveBeenCalled()
  })

  it('expands explanation on clicking View Explanation', () => {
    act(() => {
      root!.render(
        <FlashcardReviewSummary
          deckTitle="Circuit Theorems"
          deckSubject="ELECS"
          deckId="topic-1"
          cards={mockCards}
          cardGrades={mockGrades}
          bookmarks={new Set()}
          onToggleBookmark={vi.fn()}
          onStudyAgain={vi.fn()}
          onDone={vi.fn()}
        />
      )
    })

    const buttons = Array.from(container?.querySelectorAll('button') || [])
    const viewExpBtn = buttons.find((b) => b.textContent?.includes('View Explanation'))
    expect(viewExpBtn).toBeTruthy()

    act(() => {
      viewExpBtn!.click()
    })

    const text = container?.textContent || ''
    expect(text).toContain('Relates voltage, current, resistance')
  })
})
