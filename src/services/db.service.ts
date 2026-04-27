import { Card, Progress } from '../types'

declare global {
  interface Window {
    electron: {
      db: {
        query: (sql: string, params?: unknown[]) => Promise<{ success: boolean; data?: any; error?: string }>
        run: (sql: string, params?: unknown[]) => Promise<{ success: boolean; data?: any; error?: string }>
      }
    }
  }
}

export const dbService = {
  getCards: async (topicId?: string): Promise<Card[]> => {
    // Get due cards based on next_review being null or <= now
    let sql = `
      SELECT c.*, p.ease_factor, p.interval, p.repetitions, p.next_review, p.last_reviewed
      FROM cards c
      LEFT JOIN progress p ON c.id = p.card_id
      WHERE (p.next_review IS NULL OR p.next_review <= datetime('now'))
    `
    const params: unknown[] = []

    if (topicId) {
      sql += ` AND c.topic_id = ?`
      params.push(topicId)
    }

    sql += ` ORDER BY RANDOM() LIMIT 100` // Limit for session

    const result = await window.electron.db.query(sql, params)
    
    if (!result.success) {
      console.error('Failed to get cards', result.error)
      return []
    }

    return (result.data || []).map((row: any) => ({
      id: row.id,
      topicId: row.topic_id,
      type: row.type,
      data: JSON.parse(row.data),
      difficulty: row.difficulty,
      tags: JSON.parse(row.tags || '[]'),
      isCustom: Boolean(row.is_custom),
      createdAt: row.created_at
    }))
  },

  saveProgress: async (cardId: string, progressUpdates: Partial<Progress>) => {
    const { easeFactor, interval, repetitions, nextReview, lastReviewed } = progressUpdates
    
    // UPSERT progress
    const sql = `
      INSERT INTO progress (card_id, ease_factor, interval, repetitions, next_review, last_reviewed)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(card_id) DO UPDATE SET
        ease_factor = excluded.ease_factor,
        interval = excluded.interval,
        repetitions = excluded.repetitions,
        next_review = excluded.next_review,
        last_reviewed = excluded.last_reviewed
    `
    
    const params = [
      cardId, 
      easeFactor ?? 2.5, 
      interval ?? 1, 
      repetitions ?? 0, 
      nextReview, 
      lastReviewed
    ]

    const result = await window.electron.db.run(sql, params)
    
    if (!result.success) {
      console.error('Failed to update progress', result.error)
    }
  }
}


