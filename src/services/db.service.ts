import { Card, Progress } from '../types'
import { calculateSM2 } from '../lib/sm2'
import { z } from 'zod'

// ── IPC row schemas ───────────────────────────────────────────────────────────

const CardRowSchema = z.object({
  id: z.string(),
  topic_id: z.string(),
  type: z.enum(['flashcard', 'mcq', 'formula', 'concept']),
  data: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().optional(),
  tags: z.string().nullable().optional(),
  is_custom: z.union([z.boolean(), z.number()]).optional(),
  created_at: z.union([z.number(), z.string()]).optional(),
})

const CardWithProgressRowSchema = CardRowSchema.extend({
  ease_factor: z.number().optional(),
  interval: z.number().optional(),
  repetitions: z.number().optional(),
  next_review: z.string().nullable().optional(),
  last_reviewed: z.string().nullable().optional(),
  correct_count: z.number().optional(),
  total_count: z.number().optional(),
  last_result: z.string().nullable().optional(),
})

const CardPrioritizedRowSchema = CardRowSchema.extend({
  next_review: z.string().nullable().optional(),
})

const AccuracyTrendRowSchema = z.object({
  day: z.string(),
  correct: z.number(),
  total: z.number(),
})

const ActivityHistoryRowSchema = z.object({
  day: z.string(),
  count: z.number(),
  time_spent: z.number().nullable().optional(),
})

export type AccuracyGranularity = 'day' | 'week' | 'month'
export type AccuracySubject = 'ALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST'

const toLocalDateString = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}


function parseCardRow(row: z.infer<typeof CardWithProgressRowSchema>, topicId?: string): Card {
  let data: unknown = {}
  let tags: string[] = []

  try {
    data = JSON.parse(row.data)
  } catch {
    console.warn(`[db] Corrupt JSON in card.data for card id="${row.id}" — using empty object`)
  }

  try {
    tags = JSON.parse(row.tags || '[]')
  } catch {
    console.warn(`[db] Corrupt JSON in card.tags for card id="${row.id}" — using empty array`)
  }

  return {
    id: row.id,
    topicId: topicId ?? row.topic_id,
    type: row.type as Card['type'],
    data: data as Card['data'],
    difficulty: row.difficulty as Card['difficulty'],
    tags,
    isCustom: Boolean(row.is_custom),
    createdAt: row.created_at != null ? String(row.created_at) : '',
  }
}

export const dbService = {
  getCards: async (topicId?: string): Promise<Card[]> => {
    const result = await window.electron.data.getCards(topicId)
    
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get cards'}`)
    }

    return z.array(CardWithProgressRowSchema).parse(result.data || []).map(row => parseCardRow(row))
  },

  getProgress: async (cardId: string): Promise<{ repetitions: number; interval: number; easeFactor: number } | null> => {
    const result = await window.electron.data.getProgress(cardId)
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get progress'}`)
    }
    if (!result.data || result.data.length === 0) return null
    const row = result.data[0]
    return {
      repetitions: row.repetitions ?? 0,
      interval: row.interval ?? 1,
      easeFactor: row.ease_factor ?? 2.5,
    }
  },

  saveProgress: async (
    cardId: string,
    progressUpdates: Partial<Progress>,
    isCorrect: boolean
  ) => {
    const { easeFactor, interval, repetitions, nextReview, lastReviewed } = progressUpdates
    const correctIncrement = isCorrect ? 1 : 0
    const lastResult = isCorrect ? 'correct' : 'wrong'

    const result = await window.electron.data.saveProgress({
      cardId,
      easeFactor: easeFactor ?? 2.5,
      interval: interval ?? 1,
      repetitions: repetitions ?? 0,
      nextReview: nextReview || '',
      lastReviewed: lastReviewed || '',
      correctIncrement,
      lastResult
    })

    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to update progress'}`)
    }

    // Also record activity for today
    await dbService.recordActivity(isCorrect)
  },

  recordActivity: async (isCorrect?: boolean) => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const correctInc = isCorrect ? 1 : 0
    const totalInc = isCorrect !== undefined ? 1 : 0
    
    const result = await window.electron.data.recordActivity({ today, correctInc, totalInc })
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to record activity'}`)
    }
  },

  getActivityHistory: async (): Promise<Record<string, { count: number, timeSpent: number }>> => {
    const res = await window.electron.data.getActivityHistory()
    if (!res.success) {
      throw new Error(`Database Operation Failed: ${res.error || 'Failed to get study activity history'}`)
    }
    const history: Record<string, { count: number, timeSpent: number }> = {}
    if (res.data) {
      z.array(ActivityHistoryRowSchema).parse(res.data).forEach((row) => {
        history[row.day] = { 
          count: row.count, 
          timeSpent: row.time_spent || 0 
        }
      })
    }
    return history
  },

  getAccuracyTrend: async (
    subject: AccuracySubject,
    granularity: AccuracyGranularity
  ): Promise<{ date: string; acc: number | null }[]> => {

    const SUBJECT_FULL: Record<string, string> = {
      MATH:  'Mathematics',
      GEAS:  'General Engineering & Applied Sciences',
      ELECS: 'Electronics Engineering',
      EST:   'Electronics Systems & Technologies',
    }



    const lookback: Record<AccuracyGranularity, number> = {
      day:   13,
      week:  55,
      month: 179,
    }

    const getMonday = (dateStr: string): string => {
      const d = new Date(dateStr + 'T00:00:00')
      const mon = new Date(d)
      mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      return toLocalDateString(mon)
    }

    const bucketKey = (day: string): string => {
      if (granularity === 'day')  return day
      if (granularity === 'week') return getMonday(day)
      return day.slice(0, 7)
    }

    const bucketLabel = (day: string): string => {
      const d = new Date(day + 'T00:00:00')
      if (granularity === 'day') {
        return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
      }
      if (granularity === 'week') {
        const mon = new Date(getMonday(day) + 'T00:00:00')
        return mon.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
      }
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - lookback[granularity])
    const startStr = toLocalDateString(startDate)

    type RawRow = { day: string; correct: number; total: number }
    let rawRows: RawRow[] = []

    if (subject === 'ALL') {
      const res = await window.electron.data.getAccuracyTrendAll(startStr)
      if (!res.success) {
        throw new Error(`Database Operation Failed: ${res.error || 'Failed to get accuracy trend'}`)
      }
      if (res.data) {
        rawRows = z.array(AccuracyTrendRowSchema).parse(res.data).map((r) => ({
          day:     String(r.day),
          correct: Number(r.correct) || 0,
          total:   Number(r.total)   || 0,
        }))
      }
    } else {
      const fullSubject = SUBJECT_FULL[subject] ?? subject
      const res = await window.electron.data.getAccuracyTrendSubject(fullSubject, startStr)
      if (!res.success) {
        throw new Error(`Database Operation Failed: ${res.error || 'Failed to get subject accuracy trend'}`)
      }
      if (res.data) {
        rawRows = z.array(AccuracyTrendRowSchema).parse(
          res.data.filter((r: any) => r.day != null)
        ).map((r) => ({
          day:     r.day,
          correct: r.correct,
          total:   r.total,
        }))
      }
    }

    const bucketMap = new Map<string, { label: string; correct: number; total: number }>()

    for (const row of rawRows) {
      const key   = bucketKey(row.day)
      const label = bucketLabel(row.day)
      if (!bucketMap.has(key)) {
        bucketMap.set(key, { label, correct: 0, total: 0 })
      }
      const b = bucketMap.get(key)!
      b.correct += row.correct
      b.total   += row.total
    }

    return Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, b]) => ({
        date: b.label,
        acc:  b.total > 0 ? Math.round((b.correct / b.total) * 100) : null,
      }))
  },

  updateTimeSpent: async (minutes: number) => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const result = await window.electron.data.updateTimeSpent(today, minutes)
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to update time spent'}`)
    }
  },

  getDashboardStats: async () => {
    const result = await window.electron.data.getDashboardStats()
    if (!result.success || !result.data) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get dashboard stats'}`)
    }
    
    const { totalStudied, dueToday, accuracy: accuracyVal, dates } = result.data
    const accuracy = accuracyVal != null ? Math.round(accuracyVal * 100) : 0

    let streak = 0
    if (dates.length > 0) {
      const today = toLocalDateString(new Date())
      const yesterdayDate = new Date()
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      const yesterday = toLocalDateString(yesterdayDate)

      if (dates[0] !== today && dates[0] !== yesterday) {
        streak = 0
      } else {
        streak = 1
        for (let i = 0; i < dates.length - 1; i++) {
          const d1 = new Date(dates[i])
          const d2 = new Date(dates[i + 1])
          const diff = (d1.getTime() - d2.getTime()) / 86400000
          if (diff === 1) {
            streak++
          } else {
            break
          }
        }
      }
    }

    return { totalStudied, dueToday, accuracy, streak }
  },

  getSubjectBreakdown: async () => {
    const result = await window.electron.data.getSubjectBreakdown()
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get subject breakdown'}`)
    }
    return result.data || []
  },

  getSubjectProgress: async () => {
    const result = await window.electron.data.getSubjectProgress()
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get subject progress'}`)
    }
    return result.data || []
  },

  getGlobalStats: async () => {
    const result = await window.electron.data.getGlobalStats()
    if (!result.success || !result.data) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get global stats'}`)
    }
    return result.data
  },

  clearAllData: async (): Promise<void> => {
    const r = await window.electron.data.clearAllData()
    if (!r.success) throw new Error(`Database Operation Failed: ${r.error || 'Failed to clear all data'}`)
  },

  exportDecks: async (): Promise<string> => {
    const r = await window.electron.data.exportDecks()
    if (!r.success || !r.data) throw new Error(`Database Operation Failed: ${r.error || 'Failed to export decks'}`)
    return r.data
  },

  importDecks: async (jsonData: string): Promise<{ success: boolean; message: string }> => {
    try {
      const parsed = JSON.parse(jsonData)
      const r = await window.electron.data.importDecks(parsed)
      if (!r.success) throw new Error(`Database Operation Failed: ${r.error || 'Failed to import decks'}`)
      return { success: true, message: r.data || 'Decks and progress imported successfully' }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to parse backup file'
      return { success: false, message }
    }
  },

  getAllCardsByTopic: async (topicId: string): Promise<Card[]> => {
    const result = await window.electron.data.getAllCardsByTopic(topicId)

    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get cards'}`)
    }

    return z.array(CardRowSchema).parse(result.data || []).map(row => parseCardRow(row, topicId))
  },

  getCardsPrioritized: async (topicId: string): Promise<Card[]> => {
    const result = await window.electron.data.getCardsPrioritized(topicId)
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get prioritized cards'}`)
    }
    return z.array(CardPrioritizedRowSchema).parse(result.data || []).map(row => parseCardRow(row, topicId))
  },

  getDueCards: async (topicId: string): Promise<Card[]> => {
    const result = await window.electron.data.getDueCards(topicId)
    if (!result.success) throw new Error(result.error ?? 'Failed to get due cards')
    return z.array(CardPrioritizedRowSchema).parse(result.data ?? []).map(row => parseCardRow(row, topicId))
  },

  getDueCardCount: async (topicId: string): Promise<number> => {
    const result = await window.electron.data.getDueCardCount(topicId)
    if (!result.success) throw new Error(result.error ?? 'Failed to get due card count')
    return result.data as number
  },

  getDueBySubject: async (): Promise<{
    subject: string
    due_today: number
    due_d1: number; due_d2: number; due_d3: number
    due_d4: number; due_d5: number
    total_cards: number
  }[]> => {
    const result = await window.electron.data.getDueBySubject()
    if (!result.success) throw new Error(result.error ?? 'Failed to get due by subject')
    return result.data
  },

  getCardsWithProgress: async (topicId: string): Promise<Card[]> => {
    const result = await window.electron.data.getCardsWithProgress(topicId)
    if (!result.success) throw new Error(result.error ?? 'Failed to get cards with progress')
    return z.array(CardWithProgressRowSchema).parse(result.data ?? []).map(row => parseCardRow(row, topicId))
  },

  updateDecksFolder: async (fromFolder: string, toFolder: string): Promise<{ success: boolean; error?: string }> => {
    return window.electron.decks.updateDecksFolder(fromFolder, toFolder)
  },

  updateFolderOrder: async (
    folderOrders: Array<{ folderName: string; orderIndex: number }>
  ): Promise<{ success: boolean; error?: string }> => {
    return window.electron.decks.updateFolderOrder(folderOrders)
  },

  decks: {
    getFormulaMastery: async () => {
      return window.electron.decks.getFormulaMastery()
    }
  },
}

