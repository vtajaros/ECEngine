import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSessionStore } from './useSessionStore'
import { dbService } from '../services/db.service'
import { Card } from '../types'

// Mock dbService
vi.mock('../services/db.service', () => ({
  dbService: {
    saveProgress: vi.fn()
  }
}))

// Minimal stub card
const createMockCard = (id: string): Card => ({
  id,
  topicId: 't1',
  type: 'flashcard',
  data: { front: 'Q', back: 'A' },
  difficulty: 'medium',
  tags: [],
  isCustom: false,
  createdAt: new Date().toISOString()
})

describe('useSessionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dbService.saveProgress).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('startSession with empty array → isFinished: true immediately', () => {
    useSessionStore.getState().startSession([])
    
    const state = useSessionStore.getState()
    expect(state.isFinished).toBe(true)
    expect(state.currentDeck).toHaveLength(0)
  })

  it('startSession with cards → currentIndex: 0, isFinished: false, stats all zero', () => {
    useSessionStore.getState().startSession([createMockCard('c1')])
    
    const state = useSessionStore.getState()
    expect(state.currentIndex).toBe(0)
    expect(state.isFinished).toBe(false)
    expect(state.sessionStats).toEqual({ again: 0, hard: 0, good: 0, easy: 0 })
    expect(state.currentDeck).toHaveLength(1)
  })

  it('flipCard toggles isFlipped true then false', () => {
    useSessionStore.getState().startSession([createMockCard('c1')])
    
    expect(useSessionStore.getState().isFlipped).toBe(false)
    
    useSessionStore.getState().flipCard()
    expect(useSessionStore.getState().isFlipped).toBe(true)
    
    useSessionStore.getState().flipCard()
    expect(useSessionStore.getState().isFlipped).toBe(false)
  })

  it('rateCard(4) on a single-card deck → sessionStats.easy === 1, isFinished: true, isSubmitting: false after settling', async () => {
    useSessionStore.getState().startSession([createMockCard('c1')])
    
    await useSessionStore.getState().rateCard(4)
    
    const state = useSessionStore.getState()
    expect(state.sessionStats.easy).toBe(1)
    expect(state.isFinished).toBe(true)
    expect(state.isSubmitting).toBe(false)
    expect(dbService.saveProgress).toHaveBeenCalledWith(
      'c1',
      expect.any(Object),
      true,
      expect.objectContaining({ mode: 'flashcard', quality: 4 })
    )
  })

  it('rateCard(1) → sessionStats.again === 1', async () => {
    useSessionStore.getState().startSession([createMockCard('c1'), createMockCard('c2')])
    
    await useSessionStore.getState().rateCard(1)
    
    const state = useSessionStore.getState()
    expect(state.sessionStats.again).toBe(1)
    expect(state.isFinished).toBe(false)
    expect(dbService.saveProgress).toHaveBeenCalledWith(
      'c1',
      expect.any(Object),
      false,
      expect.objectContaining({ mode: 'flashcard', quality: 1 })
    )
  })

  it('rateCard(3) → sessionStats.good === 1', async () => {
    useSessionStore.getState().startSession([createMockCard('c1'), createMockCard('c2')])
    
    await useSessionStore.getState().rateCard(3)
    
    const state = useSessionStore.getState()
    expect(state.sessionStats.good).toBe(1)
    expect(state.isFinished).toBe(false)
    expect(dbService.saveProgress).toHaveBeenCalledWith(
      'c1',
      expect.any(Object),
      true,
      expect.objectContaining({ mode: 'flashcard', quality: 3 })
    )
  })

  it('Concurrent rateCard — call rateCard(4) twice without awaiting first; second call must be dropped', async () => {
    useSessionStore.getState().startSession([createMockCard('c1'), createMockCard('c2')])
    
    // Call twice concurrently
    const p1 = useSessionStore.getState().rateCard(4)
    const p2 = useSessionStore.getState().rateCard(4)
    
    await Promise.all([p1, p2])
    
    const state = useSessionStore.getState()
    // Only the first call should succeed because of the isSubmitting flag guard
    expect(state.sessionStats.easy).toBe(1)
    expect(state.currentIndex).toBe(1)
    expect(dbService.saveProgress).toHaveBeenCalledTimes(1)
  })

  it('rateCard while isFinished: true → no DB calls, state unchanged', async () => {
    useSessionStore.getState().startSession([]) // isFinished is true
    
    await useSessionStore.getState().rateCard(4)
    
    expect(dbService.saveProgress).not.toHaveBeenCalled()
  })

  it('Two-card deck: after rateCard(4) once → currentIndex: 1, isFinished: false; after second rateCard(4) → isFinished: true', async () => {
    useSessionStore.getState().startSession([createMockCard('c1'), createMockCard('c2')])
    
    // First rate
    await useSessionStore.getState().rateCard(4)
    
    let state = useSessionStore.getState()
    expect(state.currentIndex).toBe(1)
    expect(state.isFinished).toBe(false)
    expect(state.sessionStats.easy).toBe(1)
    
    // Second rate
    await useSessionStore.getState().rateCard(4)
    
    state = useSessionStore.getState()
    expect(state.currentIndex).toBe(2)
    expect(state.isFinished).toBe(true)
    expect(state.sessionStats.easy).toBe(2)
  })

  it('rateCard preserves and uses loaded card SM-2 state instead of resetting to defaults', async () => {
    // Card loaded from DB with prior progress: reps=1, interval=1, easeFactor=2.65
    const cardWithProgress: Card = {
      ...createMockCard('c-reviewed'),
      repetitions: 1,
      interval: 1,
      easeFactor: 2.65,
    }

    useSessionStore.getState().startSession([cardWithProgress])

    // Rate Easy (4)
    await useSessionStore.getState().rateCard(4)

    // With previous reps=1, interval=1, easeFactor=2.65:
    // calculateSM2(4, 1, 1, 2.65) yields repetitions: 2, interval: 6, easeFactor: 2.8
    expect(dbService.saveProgress).toHaveBeenCalledWith(
      'c-reviewed',
      expect.objectContaining({
        repetitions: 2,
        interval: 6,
        easeFactor: 2.8,
      }),
      true,
      expect.objectContaining({ mode: 'flashcard', quality: 4 })
    )

    // Check currentDeck in store was updated with the new state
    const currentDeck = useSessionStore.getState().currentDeck
    expect(currentDeck[0].repetitions).toBe(2)
    expect(currentDeck[0].interval).toBe(6)
    expect(currentDeck[0].easeFactor).toBe(2.8)
    expect(currentDeck[0].nextReview).toBeDefined()
  })

  it('first review on brand-new card uses defaults (0, 1, 2.5) and calculates next state', async () => {
    const brandNewCard: Card = {
      ...createMockCard('c-brand-new'),
      repetitions: 0,
      interval: 1,
      easeFactor: 2.5,
    }

    useSessionStore.getState().startSession([brandNewCard])
    await useSessionStore.getState().rateCard(4) // Easy

    // calculateSM2(4, 0, 1, 2.5) yields repetitions: 1, interval: 1, easeFactor: 2.65
    expect(dbService.saveProgress).toHaveBeenCalledWith(
      'c-brand-new',
      expect.objectContaining({
        repetitions: 1,
        interval: 1,
        easeFactor: 2.65,
      }),
      true,
      expect.objectContaining({ mode: 'flashcard', quality: 4 })
    )
  })

  it('rateCard passes mode flashcard, numeric quality, and responseMs equal to elapsed fake time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10000)
    useSessionStore.getState().startSession([createMockCard('c1')])
    expect(useSessionStore.getState().cardShownAt).toBe(10000)

    vi.advanceTimersByTime(2500)
    await useSessionStore.getState().rateCard(3)

    expect(dbService.saveProgress).toHaveBeenCalledWith(
      'c1',
      expect.any(Object),
      true,
      {
        mode: 'flashcard',
        quality: 3,
        responseMs: 2500,
        answeredAt: 12500,
      }
    )
  })

  it('after a rating, cardShownAt is updated so next card responseMs is measured from advance, not session start', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10000)
    useSessionStore.getState().startSession([createMockCard('c1'), createMockCard('c2')])
    expect(useSessionStore.getState().cardShownAt).toBe(10000)

    // Card 1: 3000ms elapsed
    vi.advanceTimersByTime(3000)
    await useSessionStore.getState().rateCard(4)

    // Advance should have updated cardShownAt to current fake time (13000)
    expect(useSessionStore.getState().cardShownAt).toBe(13000)
    expect(useSessionStore.getState().currentIndex).toBe(1)

    // Card 2: 1500ms elapsed after advance
    vi.advanceTimersByTime(1500)
    await useSessionStore.getState().rateCard(2)

    // Card 2 responseMs should be 1500, NOT 4500 (from session start)
    expect(dbService.saveProgress).toHaveBeenLastCalledWith(
      'c2',
      expect.any(Object),
      false,
      {
        mode: 'flashcard',
        quality: 2,
        responseMs: 1500,
        answeredAt: 14500,
      }
    )
  })

  it('startSession resets cardShownAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(5000)
    useSessionStore.getState().startSession([createMockCard('c1')])
    expect(useSessionStore.getState().cardShownAt).toBe(5000)

    // Advance time and call startSession again with a new session
    vi.advanceTimersByTime(15000)
    useSessionStore.getState().startSession([createMockCard('c2')])
    expect(useSessionStore.getState().cardShownAt).toBe(20000)
  })
})

