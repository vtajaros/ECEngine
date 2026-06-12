// src/services/db.service.test.ts
// Tests the IPC service layer using a fully mocked window.electron.
// Zero real database calls — safe to run anytime.

import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    getCardsWithProgress: vi.fn(),
  },
  decks: {
    updateDecksFolder: vi.fn(),
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
