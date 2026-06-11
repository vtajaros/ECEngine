import { ipcMain } from 'electron'
import { queryAll, execute } from '../db/database'

export function registerProgressHandlers(): void {
  ipcMain.handle('data:saveProgress', async (_, payload: { cardId: string, easeFactor: number, interval: number, repetitions: number, nextReview: string, lastReviewed: string, correctIncrement: number, lastResult: string }) => {
    try {
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
      execute(sql, [
        payload.cardId,
        payload.easeFactor,
        payload.interval,
        payload.repetitions,
        payload.nextReview,
        payload.lastReviewed,
        payload.correctIncrement,
        payload.lastResult,
        payload.correctIncrement
      ])
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
      const rows = queryAll(`
        SELECT c.id, c.topic_id, c.type, c.data, c.tags, c.difficulty, c.is_custom, c.created_at,
               p.next_review
        FROM cards c
        LEFT JOIN progress p ON c.id = p.card_id
        WHERE c.topic_id = ?
        ORDER BY
          CASE
            WHEN p.next_review IS NULL THEN 0
            WHEN p.next_review <= date('now', 'localtime') THEN 0
            ELSE 1
          END ASC,
          COALESCE(p.next_review, '1970-01-01') ASC
      `, [topicId])
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getDueCards', async (_, topicId: string) => {
    try {
      const rows = queryAll(`
        SELECT c.id, c.topic_id, c.type, c.data, c.tags, c.difficulty, c.is_custom, c.created_at,
               p.next_review
        FROM cards c
        LEFT JOIN progress p ON c.id = p.card_id
        WHERE c.topic_id = ?
          AND (p.next_review IS NULL OR p.next_review <= date('now', 'localtime'))
        ORDER BY COALESCE(p.next_review, '1970-01-01') ASC
      `, [topicId])
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
          AND (p.next_review IS NULL OR p.next_review <= date('now', 'localtime'))
      `, [topicId]) as { count: number }[]
      return { success: true, data: row[0]?.count ?? 0 }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getDueBySubject', async () => {
    try {
      const rows = queryAll(`
        SELECT
          t.subject,
          SUM(CASE WHEN p.next_review IS NULL OR p.next_review <= date('now', 'localtime') THEN 1 ELSE 0 END) AS due_today,
          SUM(CASE WHEN p.next_review = date('now', 'localtime', '+1 day') THEN 1 ELSE 0 END) AS due_d1,
          SUM(CASE WHEN p.next_review = date('now', 'localtime', '+2 days') THEN 1 ELSE 0 END) AS due_d2,
          SUM(CASE WHEN p.next_review = date('now', 'localtime', '+3 days') THEN 1 ELSE 0 END) AS due_d3,
          SUM(CASE WHEN p.next_review = date('now', 'localtime', '+4 days') THEN 1 ELSE 0 END) AS due_d4,
          SUM(CASE WHEN p.next_review = date('now', 'localtime', '+5 days') THEN 1 ELSE 0 END) AS due_d5,
          COUNT(c.id) AS total_cards
        FROM topics t
        JOIN cards c ON c.topic_id = t.id
        LEFT JOIN progress p ON p.card_id = c.id
        GROUP BY t.subject
      `) as {
        subject: string
        due_today: number
        due_d1: number; due_d2: number; due_d3: number
        due_d4: number; due_d5: number
        total_cards: number
      }[]
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
