import { describe, it, expect, vi, beforeEach } from 'vitest'
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
    expect(dbService.saveProgress).toHaveBeenCalledWith('c1', expect.any(Object), true)
  })

  it('rateCard(1) → sessionStats.again === 1', async () => {
    useSessionStore.getState().startSession([createMockCard('c1'), createMockCard('c2')])
    
    await useSessionStore.getState().rateCard(1)
    
    const state = useSessionStore.getState()
    expect(state.sessionStats.again).toBe(1)
    expect(state.isFinished).toBe(false)
    expect(dbService.saveProgress).toHaveBeenCalledWith('c1', expect.any(Object), false)
  })

  it('rateCard(3) → sessionStats.good === 1', async () => {
    useSessionStore.getState().startSession([createMockCard('c1'), createMockCard('c2')])
    
    await useSessionStore.getState().rateCard(3)
    
    const state = useSessionStore.getState()
    expect(state.sessionStats.good).toBe(1)
    expect(state.isFinished).toBe(false)
    expect(dbService.saveProgress).toHaveBeenCalledWith('c1', expect.any(Object), true)
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
})
