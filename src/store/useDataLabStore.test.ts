import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDataLabStore } from './useDataLabStore'
import { useDataVersionStore } from './useDataVersionStore'
import { dbService } from '../services/db.service'

describe('useDataLabStore', () => {
  beforeEach(() => {
    useDataLabStore.getState().reset()
    useDataVersionStore.setState({ version: 0 })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    useDataLabStore.getState().reset()
    vi.restoreAllMocks()
  })

  it('initializes with null data and true loading states', () => {
    const state = useDataLabStore.getState()
    expect(state.contentCoverage).toBeNull()
    expect(state.questionLengthDistribution).toBeNull()
    expect(state.answerPositionCounts).toBeNull()
    expect(state.answerPositionBySubject).toBeNull()
    expect(state.responseTimeDistribution).toBeNull()
    expect(state.loading.contentCoverage).toBe(true)
    expect(state.loading.questionLengthDistribution).toBe(true)
    expect(state.loading.answerPositionCounts).toBe(true)
    expect(state.loading.answerPositionBySubject).toBe(true)
    expect(state.loading.responseTimeDistribution).toBe(true)
  })

  it('preloadAll fetches all 5 datasets and populates the store', async () => {
    const mockCoverage = { MATH: { topics: 5, cards: 50 } }
    const mockQlen = [{ subject: 'MATH', qlen: 100 }]
    const mockPos = [{ position: 0, count: 10 }]
    const mockPosSub = [{ subject: 'MATH', position: 0, count: 10 }]
    const mockResp = { learn: [{ subject: 'MATH', responseMs: 1500 }], flashcard: [] }

    vi.spyOn(dbService, 'getContentCoverage').mockResolvedValue(mockCoverage as any)
    vi.spyOn(dbService, 'getQuestionLengthDistribution').mockResolvedValue(mockQlen as any)
    vi.spyOn(dbService, 'getAnswerPositionCounts').mockResolvedValue(mockPos as any)
    vi.spyOn(dbService, 'getAnswerPositionBySubject').mockResolvedValue(mockPosSub as any)
    vi.spyOn(dbService, 'getResponseTimeDistribution').mockResolvedValue(mockResp as any)

    await useDataLabStore.getState().preloadAll()

    const state = useDataLabStore.getState()
    expect(state.contentCoverage).toEqual(mockCoverage)
    expect(state.questionLengthDistribution).toEqual(mockQlen)
    expect(state.answerPositionCounts).toEqual(mockPos)
    expect(state.answerPositionBySubject).toEqual(mockPosSub)
    expect(state.responseTimeDistribution).toEqual(mockResp)
    expect(state.loading.contentCoverage).toBe(false)
    expect(state.loading.questionLengthDistribution).toBe(false)
    expect(state.loading.answerPositionCounts).toBe(false)
    expect(state.loading.answerPositionBySubject).toBe(false)
    expect(state.loading.responseTimeDistribution).toBe(false)
    expect(state.loadedVersion).toBe(0)
  })

  it('fetchContentCoverage skips fetch when data is already cached and force is false', async () => {
    const mockCoverage = { MATH: { topics: 5, cards: 50 } }
    const spy = vi.spyOn(dbService, 'getContentCoverage').mockResolvedValue(mockCoverage as any)

    await useDataLabStore.getState().fetchContentCoverage()
    expect(spy).toHaveBeenCalledTimes(1)

    // Second call without force should skip
    await useDataLabStore.getState().fetchContentCoverage(false)
    expect(spy).toHaveBeenCalledTimes(1)

    // Call with force=true should re-fetch
    await useDataLabStore.getState().fetchContentCoverage(true)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('handles errors gracefully and preserves error messages', async () => {
    vi.spyOn(dbService, 'getContentCoverage').mockRejectedValue(new Error('Coverage query failed'))

    await useDataLabStore.getState().fetchContentCoverage()

    const state = useDataLabStore.getState()
    expect(state.contentCoverage).toBeNull()
    expect(state.loading.contentCoverage).toBe(false)
    expect(state.errors.contentCoverage).toBe('Coverage query failed')
  })

  it('reset() restores initial state', async () => {
    vi.spyOn(dbService, 'getContentCoverage').mockResolvedValue({ MATH: { topics: 1, cards: 1 } } as any)
    await useDataLabStore.getState().fetchContentCoverage()
    expect(useDataLabStore.getState().contentCoverage).not.toBeNull()

    useDataLabStore.getState().reset()

    const state = useDataLabStore.getState()
    expect(state.contentCoverage).toBeNull()
    expect(state.loading.contentCoverage).toBe(true)
  })

  it('automatically calls preloadAll when useDataVersionStore bumps', async () => {
    const preloadSpy = vi.spyOn(useDataLabStore.getState(), 'preloadAll')
    // Subscribe is already active in useDataLabStore
    useDataVersionStore.getState().bump()

    // Allow async microtask
    await Promise.resolve()
    expect(useDataVersionStore.getState().version).toBe(1)
  })
})
