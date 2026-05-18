import { Card, Progress } from '../types'

const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

declare global {
  interface Window {
    electron: {
      db: {
        query: (sql: string, params?: unknown[]) => Promise<{ success: boolean; data?: any; error?: string }>
        run: (sql: string, params?: unknown[]) => Promise<{ success: boolean; data?: any; error?: string }>
      }
      file: {
        import: (filePath?: string) => Promise<{ success: boolean; data?: string; canceled?: boolean; error?: string }>
        export: (data: unknown, savePath?: string) => Promise<{ success: boolean; canceled?: boolean; error?: string }>
      }
      saveImage: (srcPath: string) => Promise<{ success: boolean; filename?: string; error?: string }>
      explainQuestion: (payload: {
        question: string
        choices: string[]
        correctAnswerIndex: number
      }) => Promise<{ text?: string; error?: string }>
      config: {
        setApiKey: (key: string) => Promise<{ success: boolean; error?: string }>
        getApiKeyStatus: () => Promise<{ configured: boolean }>
      }
      windowControls: {
        minimize: () => void
        maximize: () => void
        close: () => void
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

  getProgress: async (cardId: string): Promise<{ repetitions: number; interval: number; easeFactor: number } | null> => {
    const result = await window.electron.db.query(
      `SELECT repetitions, interval, ease_factor FROM progress WHERE card_id = ?`,
      [cardId]
    )
    if (!result.success || !result.data || result.data.length === 0) return null
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

    // Atomic UPSERT:
    // - INSERT initialises all fields including correct/total counts.
    // - ON CONFLICT increments total_count by 1 and correct_count conditionally.
    const sql = `
      INSERT INTO progress
        (card_id, ease_factor, interval, repetitions, next_review, last_reviewed,
         correct_count, total_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(card_id) DO UPDATE SET
        ease_factor   = excluded.ease_factor,
        interval      = excluded.interval,
        repetitions   = excluded.repetitions,
        next_review   = excluded.next_review,
        last_reviewed = excluded.last_reviewed,
        total_count   = total_count + 1,
        correct_count = correct_count + ?
    `

    const params: unknown[] = [
      cardId,
      easeFactor   ?? 2.5,
      interval     ?? 1,
      repetitions  ?? 0,
      nextReview,
      lastReviewed,
      correctIncrement, // used in INSERT initial value
      correctIncrement, // used in ON CONFLICT increment
    ]

    const result = await window.electron.db.run(sql, params)

    if (!result.success) {
      console.error('Failed to update progress', result.error)
    }

    // Also record activity for today
    await dbService.recordActivity(isCorrect)
  },

  recordActivity: async (isCorrect?: boolean) => {
    const today = toLocalDateString(new Date())
    const correctInc = isCorrect ? 1 : 0
    const totalInc = isCorrect !== undefined ? 1 : 0
    const sql = `
      INSERT INTO study_activity (day, count, correct_count, total_count) 
      VALUES (?, 1, ?, ?) 
      ON CONFLICT(day) DO UPDATE SET 
        count = count + 1,
        correct_count = correct_count + ?,
        total_count = total_count + ?
    `
    await window.electron.db.run(sql, [today, correctInc, totalInc, correctInc, totalInc])
  },

  getActivityHistory: async (): Promise<Record<string, { count: number, timeSpent: number }>> => {
    const res = await window.electron.db.query('SELECT day, count, time_spent FROM study_activity')
    const history: Record<string, { count: number, timeSpent: number }> = {}
    if (res.success && res.data) {
      res.data.forEach((row: any) => {
        history[row.day] = { 
          count: row.count, 
          timeSpent: row.time_spent || 0 
        }
      })
    }
    return history
  },

  getAccuracyHistory: async () => {
    // Generate an array of the last 14 days up to today
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 13);
    const startStr = toLocalDateString(startDate);

    const res = await window.electron.db.query('SELECT day, correct_count, total_count FROM study_activity WHERE day >= ? ORDER BY day ASC', [startStr]);
    const history: Array<{ date: string, acc: number | null }> = [];
    
    const dataMap: Record<string, { correct: number, total: number }> = {};
    if (res.success && res.data) {
      res.data.forEach((r: any) => { dataMap[r.day] = { correct: r.correct_count || 0, total: r.total_count || 0 } });
    }

    for (let i = 0; i < 14; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dStr = toLocalDateString(d);
      const dLabel = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      
      const metrics = dataMap[dStr];
      if (metrics && metrics.total > 0) {
        history.push({ date: dLabel, acc: Math.round((metrics.correct / metrics.total) * 100) });
      } else {
        history.push({ date: dLabel, acc: null });
      }
    }
    return history;
  },

  updateTimeSpent: async (minutes: number) => {
    const today = toLocalDateString(new Date())
    const sql = `
      INSERT INTO study_activity (day, count, time_spent) 
      VALUES (?, 0, ?) 
      ON CONFLICT(day) DO UPDATE SET time_spent = time_spent + excluded.time_spent
    `
    await window.electron.db.run(sql, [today, minutes])
  },

  getDashboardStats: async () => {
    // 1. Total cards studied (at least one repetition)
    const studiedResult = await window.electron.db.query('SELECT COUNT(card_id) as count FROM progress WHERE repetitions > 0')
    const totalStudied = studiedResult.data?.[0]?.count || 0

    // 2. Cards due today
    const dueResult = await window.electron.db.query("SELECT COUNT(id) as count FROM cards c LEFT JOIN progress p ON c.id = p.card_id WHERE p.next_review <= datetime('now') OR p.next_review IS NULL")
    const dueToday = dueResult.data?.[0]?.count || 0

    // 3. Accuracy Rate
    const accResult = await window.electron.db.query('SELECT SUM(correct_count) as correct, SUM(total_count) as total FROM progress')
    const accData = accResult.data?.[0]
    const accuracy = accData?.total > 0 ? Math.round((accData.correct / accData.total) * 100) : 0

    // 4. Streak — read from study_activity for consistency with the activity grid
    const datesResult = await window.electron.db.query("SELECT day FROM study_activity WHERE time_spent > 0 ORDER BY day DESC")
    const dates = (datesResult.data || []).map((r: { day: string }) => r.day)

    let streak = 0
    if (dates.length > 0) {
      const today = toLocalDateString(new Date())
      const yesterdayDate = new Date()
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      const yesterday = toLocalDateString(yesterdayDate)

      // If the most recent activity day isn't today or yesterday, streak is broken
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
    const sql = `
      SELECT subject, COUNT(id) as count 
      FROM topics 
      GROUP BY subject
    `
    const result = await window.electron.db.query(sql)
    return result.data || []
  },

  getSubjectProgress: async () => {
    const sql = `
      SELECT 
        t.subject, 
        COUNT(c.id) as total, 
        SUM(CASE WHEN p.repetitions >= 5 THEN 1 ELSE 0 END) as mastered 
      FROM topics t 
      JOIN cards c ON t.id = c.topic_id 
      LEFT JOIN progress p ON c.id = p.card_id 
      GROUP BY t.subject
    `
    const result = await window.electron.db.query(sql)
    return result.data || []
  },

  getGlobalStats: async () => {
    const decks = await window.electron.db.query('SELECT COUNT(id) as count FROM topics')
    const cards = await window.electron.db.query('SELECT COUNT(id) as count FROM cards')
    const internalized = await window.electron.db.query('SELECT COUNT(card_id) as count FROM progress WHERE repetitions >= 5')
    
    return {
      totalDecks: decks.data?.[0]?.count || 0,
      totalCards: cards.data?.[0]?.count || 0,
      internalized: internalized.data?.[0]?.count || 0
    }
  },

  clearAllData: async (): Promise<void> => {
    // Delete in FK-safe order: progress → cards → topics
    await window.electron.db.run('DELETE FROM progress')
    await window.electron.db.run('DELETE FROM study_activity')
    await window.electron.db.run('DELETE FROM exam_sessions')
    await window.electron.db.run('DELETE FROM cards')
    await window.electron.db.run('DELETE FROM topics')
  },

  exportDecks: async (): Promise<string> => {
    const topicsRes = await window.electron.db.query('SELECT * FROM topics')
    const cardsRes = await window.electron.db.query('SELECT * FROM cards')
    const progressRes = await window.electron.db.query('SELECT * FROM progress')
    
    const exportData = {
      version: 1,
      topics: topicsRes.data || [],
      cards: cardsRes.data || [],
      progress: progressRes.data || []
    }
    return JSON.stringify(exportData, null, 2)
  },

  importDecks: async (jsonData: string): Promise<{ success: boolean; message: string }> => {
    try {
      const parsed = JSON.parse(jsonData)
      if (!parsed.topics || !parsed.cards) {
        return { success: false, message: 'Invalid backup file format' }
      }

      for (const t of parsed.topics) {
        await window.electron.db.run(
          `INSERT OR REPLACE INTO topics (id, name, subject, created_at, description, folder_name, tags) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.name, t.subject, t.created_at || Date.now()/1000, t.description || '', t.folder_name || 'Uncategorized', t.tags || '[]']
        )
      }

      for (const c of parsed.cards) {
        await window.electron.db.run(
          `INSERT OR REPLACE INTO cards (id, topic_id, type, data, difficulty, tags, is_custom, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.topic_id, c.type, c.data, c.difficulty || 'medium', c.tags || '[]', c.is_custom ? 1 : 0, c.created_at || Date.now()/1000]
        )
      }

      if (parsed.progress) {
        for (const p of parsed.progress) {
          await window.electron.db.run(
            `INSERT OR REPLACE INTO progress (card_id, ease_factor, interval, repetitions, next_review, last_reviewed, correct_count, total_count) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.card_id, p.ease_factor || 2.5, p.interval || 1, p.repetitions || 0, p.next_review, p.last_reviewed, p.correct_count || 0, p.total_count || 0]
          )
        }
      }

      return { success: true, message: 'Decks and progress imported successfully' }
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to parse backup file' }
    }
  }
}



