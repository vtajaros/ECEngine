// src/services/db.service.test.ts
// Tests the IPC service layer using a fully mocked window.electron.
// Zero real database calls — safe to run anytime.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDataVersionStore } from '../store/useDataVersionStore'

// ─── Mock window.electron before importing the service ────────────────────────
// Must be set up before the module loads since db.service references
// window.electron at call time (not import time), so this is safe.

const mockElectron = {
  data: {
    getCards: vi.fn(),
    getProgress: vi.fn(),
    saveProgress: vi.fn(),
    recordActivity: vi.fn(),
    getActivityHistory: vi.fn(),
    getAccuracyTrendAll: vi.fn(),
    getAccuracyTrendSubject: vi.fn(),
    updateTimeSpent: vi.fn(),
    getDashboardStats: vi.fn(),
    getSubjectBreakdown: vi.fn(),
    getSubjectProgress: vi.fn(),
    getGlobalStats: vi.fn(),
    clearAllData: vi.fn(),
    resetProgress: vi.fn(),
    exportDecks: vi.fn(),
    exportSelectedDecks: vi.fn(),
    importDecks: vi.fn(),
    getAllCardsByTopic: vi.fn(),
    getCardsPrioritized: vi.fn(),
    getDueCards: vi.fn(),
    getCardsWithProgress: vi.fn(),
    saveExamSession: vi.fn(),
    getExamSessions: vi.fn(),
    deleteExamSession: vi.fn(),
    clearExamSessions: vi.fn(),
  },
  decks: {

    updateFolderOrder: vi.fn(),
    getFormulaMastery: vi.fn(),
  },
}

// Inject into global before service import
;(global as any).window = { electron: mockElectron }

import { dbService } from './db.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid card row as it comes from SQLite */
function makeCardRow(overrides: Record<string, any> = {}) {
  return {
    id: 'card-1',
    topic_id: 'topic-1',
    type: 'mcq',
    data: JSON.stringify({ question: 'What is 2+2?', choices: ['3', '4'], answer: 1 }),
    tags: JSON.stringify(['math', 'basic']),
    difficulty: 'medium',
    is_custom: 0,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Reset the version store so tests are independent
  useDataVersionStore.setState({ version: 0 })
})

// ─── getCards ─────────────────────────────────────────────────────────────────

describe('dbService.getCards', () => {
  it('returns parsed cards on success', async () => {
    mockElectron.data.getCards.mockResolvedValue({
      success: true,
      data: [makeCardRow()],
    })

    const cards = await dbService.getCards('topic-1')
    expect(cards).toHaveLength(1)
    expect(cards[0].id).toBe('card-1')
    expect(cards[0].type).toBe('mcq')
    expect(cards[0].tags).toEqual(['math', 'basic'])
  })

  it('parses card.data JSON correctly', async () => {
    mockElectron.data.getCards.mockResolvedValue({
      success: true,
      data: [makeCardRow()],
    })

    const cards = await dbService.getCards()
    expect(cards[0].data).toEqual({ question: 'What is 2+2?', choices: ['3', '4'], answer: 1 })
  })

  it('returns empty array when data is empty', async () => {
    mockElectron.data.getCards.mockResolvedValue({ success: true, data: [] })
    const cards = await dbService.getCards()
    expect(cards).toEqual([])
  })

  it('throws on IPC failure', async () => {
    mockElectron.data.getCards.mockResolvedValue({ success: false, error: 'DB locked' })
    await expect(dbService.getCards()).rejects.toThrow('DB locked')
  })

  it('handles corrupt card.data gracefully — falls back to empty object', async () => {
    mockElectron.data.getCards.mockResolvedValue({
      success: true,
      data: [makeCardRow({ data: 'NOT_VALID_JSON{{{' })],
    })

    const cards = await dbService.getCards()
    expect(cards).toHaveLength(1)
    // Fallback should be an empty object, not throw
    expect(cards[0].data).toEqual({})
  })

  it('handles corrupt card.tags gracefully — falls back to empty array', async () => {
    mockElectron.data.getCards.mockResolvedValue({
      success: true,
      data: [makeCardRow({ tags: 'BROKEN[[[' })],
    })

    const cards = await dbService.getCards()
    expect(cards[0].tags).toEqual([])
  })

  it('handles null tags — falls back to empty array', async () => {
    mockElectron.data.getCards.mockResolvedValue({
      success: true,
      data: [makeCardRow({ tags: null })],
    })

    const cards = await dbService.getCards()
    expect(cards[0].tags).toEqual([])
  })

  it('maps is_custom 0/1 to boolean correctly', async () => {
    mockElectron.data.getCards.mockResolvedValue({
      success: true,
      data: [
        makeCardRow({ is_custom: 0 }),
        makeCardRow({ id: 'card-2', is_custom: 1 }),
      ],
    })

    const cards = await dbService.getCards()
    expect(cards[0].isCustom).toBe(false)
    expect(cards[1].isCustom).toBe(true)
  })
})

// ─── getProgress ──────────────────────────────────────────────────────────────

describe('dbService.getProgress', () => {
  it('returns progress data when found', async () => {
    mockElectron.data.getProgress.mockResolvedValue({
      success: true,
      data: [{ repetitions: 3, interval: 10, ease_factor: 2.3 }],
    })

    const progress = await dbService.getProgress('card-1')
    expect(progress).toEqual({ repetitions: 3, interval: 10, easeFactor: 2.3 })
  })

  it('returns null when no progress exists', async () => {
    mockElectron.data.getProgress.mockResolvedValue({ success: true, data: [] })
    const progress = await dbService.getProgress('card-new')
    expect(progress).toBeNull()
  })

  it('returns null when data is undefined', async () => {
    mockElectron.data.getProgress.mockResolvedValue({ success: true, data: undefined })
    const progress = await dbService.getProgress('card-new')
    expect(progress).toBeNull()
  })

  it('defaults missing fields to safe values', async () => {
    mockElectron.data.getProgress.mockResolvedValue({
      success: true,
      data: [{ repetitions: null, interval: null, ease_factor: null }],
    })

    const progress = await dbService.getProgress('card-1')
    expect(progress!.repetitions).toBe(0)
    expect(progress!.interval).toBe(1)
    expect(progress!.easeFactor).toBe(2.5)
  })

  it('throws on IPC failure', async () => {
    mockElectron.data.getProgress.mockResolvedValue({ success: false, error: 'Read error' })
    await expect(dbService.getProgress('card-1')).rejects.toThrow('Read error')
  })
})

// ─── recordActivity ───────────────────────────────────────────────────────────

describe('dbService.recordActivity', () => {
  it('calls IPC with correct date and increments for correct answer', async () => {
    mockElectron.data.recordActivity.mockResolvedValue({ success: true })

    await dbService.recordActivity(true)

    const call = mockElectron.data.recordActivity.mock.calls[0][0]
    expect(call.correctInc).toBe(1)
    expect(call.totalInc).toBe(1)
    expect(call.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('sends correctInc=0 for wrong answer', async () => {
    mockElectron.data.recordActivity.mockResolvedValue({ success: true })

    await dbService.recordActivity(false)

    const call = mockElectron.data.recordActivity.mock.calls[0][0]
    expect(call.correctInc).toBe(0)
    expect(call.totalInc).toBe(1)
  })

  it('sends totalInc=0 when isCorrect is undefined', async () => {
    mockElectron.data.recordActivity.mockResolvedValue({ success: true })

    await dbService.recordActivity(undefined)

    const call = mockElectron.data.recordActivity.mock.calls[0][0]
    expect(call.totalInc).toBe(0)
  })

  it('throws on IPC failure', async () => {
    mockElectron.data.recordActivity.mockResolvedValue({ success: false, error: 'Write failed' })
    await expect(dbService.recordActivity(true)).rejects.toThrow('Write failed')
  })
})

// ─── updateTimeSpent ──────────────────────────────────────────────────────────

describe('dbService.updateTimeSpent', () => {
  it('calls IPC with today date and correct minutes', async () => {
    mockElectron.data.updateTimeSpent.mockResolvedValue({ success: true })

    await dbService.updateTimeSpent(5)

    expect(mockElectron.data.updateTimeSpent).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      5
    )
  })

  it('throws on failure', async () => {
    mockElectron.data.updateTimeSpent.mockResolvedValue({ success: false, error: 'Disk full' })
    await expect(dbService.updateTimeSpent(1)).rejects.toThrow('Disk full')
  })
})

// ─── getDashboardStats ────────────────────────────────────────────────────────

describe('dbService.getDashboardStats', () => {
  it('computes accuracy as a rounded percentage', async () => {
    mockElectron.data.getDashboardStats.mockResolvedValue({
      success: true,
      data: { totalStudied: 100, dueToday: 5, accuracy: 0.856, dates: [] },
    })

    const stats = await dbService.getDashboardStats()
    expect(stats.accuracy).toBe(86)
  })

  it('returns 0 accuracy when accuracy is null', async () => {
    mockElectron.data.getDashboardStats.mockResolvedValue({
      success: true,
      data: { totalStudied: 0, dueToday: 0, accuracy: null, dates: [] },
    })

    const stats = await dbService.getDashboardStats()
    expect(stats.accuracy).toBe(0)
  })

  it('computes streak of 1 when only today is present', async () => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const todayStr = `${y}-${m}-${d}`

    mockElectron.data.getDashboardStats.mockResolvedValue({
      success: true,
      data: { totalStudied: 1, dueToday: 0, accuracy: 1.0, dates: [todayStr] },
    })

    const stats = await dbService.getDashboardStats()
    expect(stats.streak).toBe(1)
  })

  it('returns streak 0 when dates are empty', async () => {
    mockElectron.data.getDashboardStats.mockResolvedValue({
      success: true,
      data: { totalStudied: 0, dueToday: 0, accuracy: 0, dates: [] },
    })

    const stats = await dbService.getDashboardStats()
    expect(stats.streak).toBe(0)
  })

  it('throws on IPC failure', async () => {
    mockElectron.data.getDashboardStats.mockResolvedValue({ success: false, error: 'Query failed' })
    await expect(dbService.getDashboardStats()).rejects.toThrow('Query failed')
  })
})

// ─── importDecks ──────────────────────────────────────────────────────────────

describe('dbService.importDecks', () => {
  it('parses valid JSON and calls IPC', async () => {
    mockElectron.data.importDecks.mockResolvedValue({ success: true, data: 'Imported OK' })

    const result = await dbService.importDecks(JSON.stringify({ decks: [] }))
    expect(result.success).toBe(true)
    expect(result.message).toBe('Imported OK')
  })

  it('returns failure message for invalid JSON without throwing', async () => {
    const result = await dbService.importDecks('NOT_JSON{{{')
    expect(result.success).toBe(false)
    expect(result.message).toBeTruthy()
  })

  it('returns failure object when IPC returns error', async () => {
    mockElectron.data.importDecks.mockResolvedValue({ success: false, error: 'Schema mismatch' })
    const result = await dbService.importDecks(JSON.stringify({ decks: [] }))
    expect(result.success).toBe(false)
    expect(result.message).toContain('Schema mismatch')
  })
})

// ─── exportDecks ──────────────────────────────────────────────────────────────

describe('dbService.exportDecks', () => {
  it('returns the exported JSON string', async () => {
    mockElectron.data.exportDecks.mockResolvedValue({
      success: true,
      data: '{"decks":[]}',
    })

    const result = await dbService.exportDecks()
    expect(result).toBe('{"decks":[]}')
  })

  it('throws when IPC fails', async () => {
    mockElectron.data.exportDecks.mockResolvedValue({ success: false, error: 'Permission denied' })
    await expect(dbService.exportDecks()).rejects.toThrow('Permission denied')
  })
})

// ─── getAllCardsByTopic ────────────────────────────────────────────────────────

describe('dbService.getAllCardsByTopic', () => {
  it('passes topicId to parseCardRow correctly', async () => {
    mockElectron.data.getAllCardsByTopic.mockResolvedValue({
      success: true,
      data: [makeCardRow({ topic_id: 'other-topic' })],
    })

    const cards = await dbService.getAllCardsByTopic('topic-override')
    // topicId passed as second arg to parseCardRow should win over row.topic_id
    expect(cards[0].topicId).toBe('topic-override')
  })

  it('throws on IPC failure', async () => {
    mockElectron.data.getAllCardsByTopic.mockResolvedValue({ success: false, error: 'Not found' })
    await expect(dbService.getAllCardsByTopic('topic-1')).rejects.toThrow('Not found')
  })
})

// ─── clearAllData ─────────────────────────────────────────────────────────────

describe('dbService.clearAllData', () => {
  it('resolves without error on success', async () => {
    mockElectron.data.clearAllData.mockResolvedValue({ success: true })
    await expect(dbService.clearAllData()).resolves.toBeUndefined()
  })

  it('throws on failure', async () => {
    mockElectron.data.clearAllData.mockResolvedValue({ success: false, error: 'Locked' })
    await expect(dbService.clearAllData()).rejects.toThrow('Locked')
  })
})

// ─── exam sessions ────────────────────────────────────────────────────────────

describe('dbService exam session methods', () => {
  it('saveExamSession calls IPC and returns id', async () => {
    mockElectron.data.saveExamSession = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'sess-123' },
    })

    const res = await dbService.saveExamSession({
      topicId: 'topic-1',
      mode: 'learn',
      score: 18,
      total: 20,
      answers: JSON.stringify({ deckTitle: 'Sample Deck', subject: 'MATH', correctFirstTry: 18 }),
    })

    expect(res.id).toBe('sess-123')
    expect(mockElectron.data.saveExamSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'learn',
        score: 18,
        total: 20,
      })
    )
  })

  it('getExamSessions parses answers JSON and formats records', async () => {
    mockElectron.data.getExamSessions = vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: 'sess-1',
          topic_id: 'topic-1',
          mode: 'learn',
          started_at: '2026-08-22T10:00:00.000Z',
          finished_at: '2026-08-22T10:15:00.000Z',
          score: 15,
          total: 20,
          answers: JSON.stringify({ deckTitle: 'Calculus Deck', deckDescription: 'Differential equations', subject: 'MATH', correctFirstTry: 15 }),
          topic_name: 'Calculus Topic',
          topic_subject: 'MATH',
          topic_description: 'Differential equations',
        },
      ],
    })

    const sessions = await dbService.getExamSessions(50)
    expect(sessions.length).toBe(1)
    expect(sessions[0].score).toBe(15)
    expect(sessions[0].total).toBe(20)
    expect(sessions[0].metadata?.deckTitle).toBe('Calculus Deck')
    expect(sessions[0].topicName).toBe('Calculus Topic')
    expect(sessions[0].topicDescription).toBe('Differential equations')
  })

  it('deleteExamSession calls IPC and resolves', async () => {
    mockElectron.data.deleteExamSession = vi.fn().mockResolvedValue({ success: true })
    await expect(dbService.deleteExamSession('sess-1')).resolves.toBeUndefined()
    expect(mockElectron.data.deleteExamSession).toHaveBeenCalledWith('sess-1')
  })

  it('clearExamSessions calls IPC and resolves', async () => {
    mockElectron.data.clearExamSessions = vi.fn().mockResolvedValue({ success: true })
    await expect(dbService.clearExamSessions()).resolves.toBeUndefined()
  })
})

// ─── SM-2 Progress and Due Cards Loading ───────────────────────────────────────

describe('dbService SM-2 progress and due card mapping', () => {
  const rowWithProgress = {
    ...makeCardRow({ id: 'card-sm2' }),
    ease_factor: 2.65,
    repetitions: 1,
    interval: 1,
    next_review: '2026-09-19',
    last_reviewed: '2026-09-18T10:00:00.000Z',
    correct_count: 5,
    total_count: 6,
    last_result: 'correct',
  }

  const rowWithoutProgress = {
    ...makeCardRow({ id: 'card-new' }),
    ease_factor: undefined,
    repetitions: undefined,
    interval: undefined,
    next_review: null,
    last_reviewed: null,
    correct_count: undefined,
    total_count: undefined,
    last_result: null,
  }

  it('getDueCards preserves complete SM-2 state on loaded cards', async () => {
    mockElectron.data.getDueCards.mockResolvedValue({
      success: true,
      data: [rowWithProgress],
    })

    const cards = await dbService.getDueCards('topic-1')
    expect(cards).toHaveLength(1)
    expect(cards[0].id).toBe('card-sm2')
    expect(cards[0].easeFactor).toBe(2.65)
    expect(cards[0].repetitions).toBe(1)
    expect(cards[0].interval).toBe(1)
    expect(cards[0].nextReview).toBe('2026-09-19')
    expect(cards[0].lastReviewed).toBe('2026-09-18T10:00:00.000Z')
    expect(cards[0].correct_count).toBe(5)
    expect(cards[0].total_count).toBe(6)
    expect(cards[0].last_result).toBe('correct')
  })

  it('getDueCards applies correct defaults for unreviewed cards', async () => {
    mockElectron.data.getDueCards.mockResolvedValue({
      success: true,
      data: [rowWithoutProgress],
    })

    const cards = await dbService.getDueCards('topic-1')
    expect(cards).toHaveLength(1)
    expect(cards[0].id).toBe('card-new')
    expect(cards[0].easeFactor).toBe(2.5)
    expect(cards[0].repetitions).toBe(0)
    expect(cards[0].interval).toBe(1)
    expect(cards[0].nextReview).toBeNull()
    expect(cards[0].lastReviewed).toBeNull()
    expect(cards[0].correct_count).toBe(0)
    expect(cards[0].total_count).toBe(0)
    expect(cards[0].last_result).toBeNull()
  })

  it('getCardsPrioritized preserves complete SM-2 state', async () => {
    mockElectron.data.getCardsPrioritized.mockResolvedValue({
      success: true,
      data: [rowWithProgress],
    })

    const cards = await dbService.getCardsPrioritized('topic-1')
    expect(cards).toHaveLength(1)
    expect(cards[0].easeFactor).toBe(2.65)
    expect(cards[0].repetitions).toBe(1)
    expect(cards[0].interval).toBe(1)
    expect(cards[0].nextReview).toBe('2026-09-19')
  })

  it('getCardsWithProgress preserves complete SM-2 state including nextReview', async () => {
    mockElectron.data.getCardsWithProgress.mockResolvedValue({
      success: true,
      data: [rowWithProgress],
    })

    const cards = await dbService.getCardsWithProgress('topic-1')
    expect(cards).toHaveLength(1)
    expect(cards[0].easeFactor).toBe(2.65)
    expect(cards[0].repetitions).toBe(1)
    expect(cards[0].interval).toBe(1)
    expect(cards[0].nextReview).toBe('2026-09-19')
    expect(cards[0].lastReviewed).toBe('2026-09-18T10:00:00.000Z')
    expect(cards[0].correct_count).toBe(5)
    expect(cards[0].total_count).toBe(6)
  })

  describe('getAccuracyTrend', () => {
    it('calls getAccuracyTrendAll with lookback days for ALL subject', async () => {
      mockElectron.data.getAccuracyTrendAll.mockResolvedValue({
        success: true,
        data: [
          { day: '2026-09-18', correct: 8, total: 10 },
          { day: '2026-09-19', correct: 4, total: 5 },
        ],
      })

      const trend = await dbService.getAccuracyTrend('ALL', 'day')
      expect(mockElectron.data.getAccuracyTrendAll).toHaveBeenCalledWith(13)
      expect(trend).toHaveLength(2)
      expect(trend[0]).toEqual({ date: expect.any(String), acc: 80 })
      expect(trend[1]).toEqual({ date: expect.any(String), acc: 80 })
    })

    it('calls getAccuracyTrendSubject with lookback days and full subject name', async () => {
      mockElectron.data.getAccuracyTrendSubject.mockResolvedValue({
        success: true,
        data: [
          { day: '2026-09-19', correct: 5, total: 5 },
        ],
      })

      const trend = await dbService.getAccuracyTrend('MATH', 'day')
      expect(mockElectron.data.getAccuracyTrendSubject).toHaveBeenCalledWith('Mathematics', 13)
      expect(trend).toHaveLength(1)
      expect(trend[0].acc).toBe(100)
    })
  })
})

// ─── useDataVersionStore bump integration ─────────────────────────────────────

describe('useDataVersionStore version bump on writes', () => {
  it('saveProgress — version increments after a successful call', async () => {
    mockElectron.data.saveProgress.mockResolvedValue({ success: true })
    mockElectron.data.recordActivity.mockResolvedValue({ success: true })

    const versionBefore = useDataVersionStore.getState().version
    await dbService.saveProgress('card-1', { easeFactor: 2.5, interval: 1, repetitions: 0 }, true)
    // saveProgress calls recordActivity which bumps; expect at least 1 bump
    expect(useDataVersionStore.getState().version).toBeGreaterThan(versionBefore)
  })

  it('saveProgress — version does NOT increment when underlying IPC call resolves with success:false', async () => {
    mockElectron.data.saveProgress.mockResolvedValue({ success: false, error: 'Write failed' })

    const versionBefore = useDataVersionStore.getState().version
    await expect(
      dbService.saveProgress('card-1', { easeFactor: 2.5, interval: 1, repetitions: 0 }, true)
    ).rejects.toThrow('Write failed')
    expect(useDataVersionStore.getState().version).toBe(versionBefore)
  })

  it('resetProgress — version increments by 1 after a successful call', async () => {
    mockElectron.data.resetProgress.mockResolvedValue({ success: true })

    const versionBefore = useDataVersionStore.getState().version
    await dbService.resetProgress()
    expect(useDataVersionStore.getState().version).toBe(versionBefore + 1)
  })

  it('resetProgress — version does NOT increment when IPC resolves with success:false', async () => {
    mockElectron.data.resetProgress.mockResolvedValue({ success: false, error: 'Locked' })

    const versionBefore = useDataVersionStore.getState().version
    await expect(dbService.resetProgress()).rejects.toThrow('Locked')
    expect(useDataVersionStore.getState().version).toBe(versionBefore)
  })
})



