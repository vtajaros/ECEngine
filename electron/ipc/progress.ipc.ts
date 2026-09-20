import { ipcMain } from 'electron'
import { queryAll, execute, getCardsWithProgress, getDB } from '../db/database'
import { dueOrNewSql, getFlashcardSchedule } from '../db/schedule'
import { logAttempt } from '../db/attemptLog'
import { z } from 'zod'

// ── Zod schemas ───────────────────────────────────────────────────────────────

const RecordCardResultSchema = z.object({
  cardId: z.string().min(1),
  isCorrect: z.boolean(),
  lastReviewed: z.string(),
  mode: z.enum(['learn', 'test']).optional().default('learn'),
  responseMs: z.number().nonnegative().optional().nullable(),
  answeredAt: z.number().optional().nullable(),
})

const SaveProgressSchema = z.object({
  cardId: z.string().min(1),
  easeFactor: z.number(),
  interval: z.number(),
  repetitions: z.number(),
  nextReview: z.string(),
  lastReviewed: z.string(),
  correctIncrement: z.number(),
  lastResult: z.string(),
  quality: z.number().optional().nullable(),
  responseMs: z.number().nonnegative().optional().nullable(),
  answeredAt: z.number().optional().nullable(),
  mode: z.enum(['learn', 'test', 'flashcard']).optional().default('flashcard'),
})

export function registerProgressHandlers(): void {
  /**
   * data:recordCardResult
   * Lightweight MCQ progress write. Only updates correct_count, total_count,
   * and last_result. SM-2 fields (ease_factor, interval, repetitions,
   * next_review) are intentionally left untouched so MCQ cards never appear
   * in getDueCards / getCardsPrioritized scheduling queries.
   *
   * On first encounter (no existing progress row) the SM-2 defaults
   * (ease_factor=2.5, interval=1, repetitions=0) are written so the row is
   * valid \u2014 consistent with how data:saveProgress handles new rows.
   */
  ipcMain.handle('data:recordCardResult', async (_, payload: unknown) => {
    try {
      const { cardId, isCorrect, lastReviewed, mode, responseMs, answeredAt } = RecordCardResultSchema.parse(payload)
      const correctInc = isCorrect ? 1 : 0
      const lastResult = isCorrect ? 'correct' : 'wrong'

      const sql = `
        INSERT INTO progress
          (card_id, ease_factor, interval, repetitions,
           correct_count, total_count, last_result, last_reviewed)
        VALUES (?, 2.5, 1, 0, ?, 1, ?, ?)
        ON CONFLICT(card_id) DO UPDATE SET
          total_count   = total_count + 1,
          correct_count = correct_count + ?,
          last_result   = excluded.last_result,
          last_reviewed = excluded.last_reviewed
      `

      getDB().transaction(() => {
        execute(sql, [cardId, correctInc, lastResult, lastReviewed, correctInc])
        logAttempt(getDB(), { cardId, mode, correct: isCorrect, responseMs, answeredAt })
      })()

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
  ipcMain.handle('data:saveProgress', async (_, payload: unknown) => {
    try {
      const data = SaveProgressSchema.parse(payload)
      const sql = `
        INSERT INTO progress
          (card_id, ease_factor, interval, repetitions, next_review, last_reviewed,
           correct_count, total_count, last_result)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(card_id) DO UPDATE SET
          ease_factor   = excluded.ease_factor,
          interval      = excluded.interval,
          repetitions   = excluded.repetitions,
          next_review   = excluded.next_review,
          last_reviewed = excluded.last_reviewed,
          total_count   = total_count + 1,
          correct_count = correct_count + ?,
          last_result   = excluded.last_result
      `
      // correct = true iff correctIncrement > 0
      // (the renderer always sets correctIncrement to 1 for correct, 0 for wrong)
      const isCorrect = data.correctIncrement > 0

      getDB().transaction(() => {
        execute(sql, [
          data.cardId,
          data.easeFactor,
          data.interval,
          data.repetitions,
          data.nextReview,
          data.lastReviewed,
          data.correctIncrement,
          data.lastResult,
          data.correctIncrement
        ])
        logAttempt(getDB(), {
          cardId: data.cardId,
          mode: data.mode,
          correct: isCorrect,
          quality: data.quality,
          responseMs: data.responseMs,
          answeredAt: data.answeredAt,
        })
      })()

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:recordActivity', async (_, payload: { today: string, correctInc: number, totalInc: number }) => {
    try {
      const sql = `
        INSERT INTO study_activity (day, count, correct_count, total_count) 
        VALUES (?, 1, ?, ?) 
        ON CONFLICT(day) DO UPDATE SET 
          count = count + 1,
          correct_count = correct_count + ?,
          total_count = total_count + ?
      `
      execute(sql, [payload.today, payload.correctInc, payload.totalInc, payload.correctInc, payload.totalInc])
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:updateTimeSpent', async (_, today: string, minutes: number) => {
    try {
      const sql = `
        INSERT INTO study_activity (day, count, time_spent) 
        VALUES (?, 0, ?) 
        ON CONFLICT(day) DO UPDATE SET time_spent = time_spent + excluded.time_spent
      `
      execute(sql, [today, minutes])
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getActivityHistory', async () => {
    try {
      const rows = queryAll('SELECT day, count, time_spent FROM study_activity')
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getCardsPrioritized', async (_, topicId: string) => {
    try {
      const rows = getCardsWithProgress(topicId, { dueOnly: true })
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getDueCards', async (_, topicId: string) => {
    try {
      const rows = getCardsWithProgress(topicId, { dueOnly: true })
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getDueCardCount', async (_, topicId: string) => {
    try {
      const row = queryAll(`
        SELECT COUNT(*) as count
        FROM cards c
        LEFT JOIN progress p ON c.id = p.card_id
        WHERE c.topic_id = ?
          AND ${dueOrNewSql()}
      `, [topicId]) as { count: number }[]
      return { success: true, data: row[0]?.count ?? 0 }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getFlashcardSchedule', async () => {
    try {
      const schedule = getFlashcardSchedule(getDB())
      return { success: true, data: schedule }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  const SaveExamSessionSchema = z.object({
    id: z.string().optional(),
    topicId: z.string().nullable().optional(),
    mode: z.string(),
    startedAt: z.union([z.string(), z.number()]).optional(),
    finishedAt: z.union([z.string(), z.number()]).optional(),
    score: z.number(),
    total: z.number(),
    answers: z.string().optional(),
  })

  ipcMain.handle('data:saveExamSession', async (_, payload: unknown) => {
    try {
      const parsed = SaveExamSessionSchema.parse(payload)
      const id = parsed.id || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const startedAt = parsed.startedAt != null ? String(parsed.startedAt) : new Date().toISOString()
      const finishedAt = parsed.finishedAt != null ? String(parsed.finishedAt) : new Date().toISOString()
      const topicId = parsed.topicId || null
      const answers = parsed.answers || '{}'

      const sql = `
        INSERT INTO exam_sessions (id, topic_id, mode, started_at, finished_at, score, total, answers)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          topic_id = excluded.topic_id,
          mode = excluded.mode,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at,
          score = excluded.score,
          total = excluded.total,
          answers = excluded.answers
      `
      execute(sql, [id, topicId, parsed.mode, startedAt, finishedAt, parsed.score, parsed.total, answers])
      return { success: true, data: { id } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getExamSessions', async (_, limit: number = 100) => {
    try {
      const sql = `
        SELECT e.id, e.topic_id, e.mode, e.started_at, e.finished_at, e.score, e.total, e.answers,
               t.name as topic_name, t.subject as topic_subject, t.description as topic_description
        FROM exam_sessions e
        LEFT JOIN topics t ON e.topic_id = t.id
        ORDER BY COALESCE(e.finished_at, e.started_at) DESC
        LIMIT ?
      `
      const rows = queryAll(sql, [limit])
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:deleteExamSession', async (_, id: string) => {
    try {
      execute('DELETE FROM exam_sessions WHERE id = ?', [id])
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:clearExamSessions', async () => {
    try {
      execute('DELETE FROM exam_sessions')
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}

