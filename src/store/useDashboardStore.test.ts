import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDashboardStore } from './useDashboardStore'
import { useDataVersionStore } from './useDataVersionStore'
import { dbService } from '../services/db.service'

vi.mock('../services/db.service', () => ({
  dbService: {
    getDashboardStats: vi.fn(),
    getSubjectBreakdown: vi.fn(),
    getGlobalStats: vi.fn(),
    getSubjectProgress: vi.fn(),
    getActivityHistory: vi.fn(),
    getAccuracyTrend: vi.fn(),
    getFlashcardSchedule: vi.fn(),
  },
}))

describe('useDashboardStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDataVersionStore.setState({ version: 0 })
    useDashboardStore.setState({
      statsData: {
        totalDecks: 0,
        totalCards: 0,
        flashcardCount: 0,
        mcqCount: 0,
        mcqAnswered: 0,
        totalStudied: 0,
        internalized: 0,
        accuracy: 0,
        streak: 0,
        dueToday: 0,
      },
      subjectCounts: [
        { subject: 'MATH', count: 0 },
        { subject: 'GEAS', count: 0 },
        { subject: 'ELECS', count: 0 },
        { subject: 'EST', count: 0 },
      ],
      subjectProgress: [],
      history: {},
      trendCache: {},
      flashcardSchedule: null,
      isLoaded: false,
      isLoading: false,
      trendLoading: false,
      scheduleLoading: false,
      loadedVersion: null,
    })
  })

  it('fetches dashboard data and populates store', async () => {
    vi.mocked(dbService.getDashboardStats).mockResolvedValue({
      totalStudied: 50,
      accuracy: 85,
      streak: 5,
      dueToday: 12,
    } as any)
    vi.mocked(dbService.getSubjectBreakdown).mockResolvedValue([
      { subject: 'Mathematics', count: 20 },
      { subject: 'General Engineering & Applied Sciences', count: 30 },
      { subject: 'Electronics Engineering', count: 40 },
      { subject: 'Electronics Systems & Technologies', count: 25 },
    ] as any)
    vi.mocked(dbService.getGlobalStats).mockResolvedValue({
      totalDecks: 115,
      totalCards: 500,
      flashcardCount: 200,
      mcqCount: 300,
      mcqAnswered: 150,
      internalized: 80,
    } as any)
    vi.mocked(dbService.getSubjectProgress).mockResolvedValue([
      { subject: 'Mathematics', accuracy: 0.8 },
      { subject: 'General Engineering & Applied Sciences', accuracy: 0.9 },
    ] as any)
    vi.mocked(dbService.getActivityHistory).mockResolvedValue({
      '2026-09-20': { count: 15, timeSpent: 25 },
    } as any)

    await useDashboardStore.getState().fetchDashboardData()

    const state = useDashboardStore.getState()
    expect(state.isLoaded).toBe(true)
    expect(state.statsData.totalDecks).toBe(115)
    expect(state.statsData.totalStudied).toBe(50)
    expect(state.subjectCounts).toEqual([
      { subject: 'MATH', count: 20 },
      { subject: 'GEAS', count: 30 },
      { subject: 'ELECS', count: 40 },
      { subject: 'EST', count: 25 },
    ])
    expect(state.history).toEqual({
      '2026-09-20': { count: 15, timeSpent: 25 },
    })
    expect(state.loadedVersion).toBe(0)
  })

  it('skips refetching if already loaded and version matches', async () => {
    useDashboardStore.setState({ isLoaded: true, loadedVersion: 0 })

    await useDashboardStore.getState().fetchDashboardData()
    expect(dbService.getDashboardStats).not.toHaveBeenCalled()
  })

  it('refetches when forced or version bumps', async () => {
    useDashboardStore.setState({ isLoaded: true, loadedVersion: 0 })
    useDataVersionStore.setState({ version: 1 })

    vi.mocked(dbService.getDashboardStats).mockResolvedValue({ totalStudied: 10 } as any)
    vi.mocked(dbService.getSubjectBreakdown).mockResolvedValue([])
    vi.mocked(dbService.getGlobalStats).mockResolvedValue({ totalDecks: 5, totalCards: 20 } as any)
    vi.mocked(dbService.getSubjectProgress).mockResolvedValue([])
    vi.mocked(dbService.getActivityHistory).mockResolvedValue({})

    await useDashboardStore.getState().fetchDashboardData()
    expect(dbService.getDashboardStats).toHaveBeenCalledTimes(1)
    expect(useDashboardStore.getState().loadedVersion).toBe(1)
  })

  it('caches accuracy trend responses by subject and granularity', async () => {
    vi.mocked(dbService.getAccuracyTrend).mockResolvedValue([
      { date: '2026-09-20', acc: 90 },
    ])

    const res1 = await useDashboardStore.getState().fetchAccuracyTrend('ALL', 'day')
    expect(res1).toEqual([{ date: '2026-09-20', acc: 90 }])
    expect(dbService.getAccuracyTrend).toHaveBeenCalledTimes(1)

    // Second call with same parameters should return cached result
    const res2 = await useDashboardStore.getState().fetchAccuracyTrend('ALL', 'day')
    expect(res2).toEqual([{ date: '2026-09-20', acc: 90 }])
    expect(dbService.getAccuracyTrend).toHaveBeenCalledTimes(1)
  })
})
