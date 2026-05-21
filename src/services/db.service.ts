import { Card, Progress } from '../types'
import { calculateSM2 } from '../lib/sm2'

export type AccuracyGranularity = 'day' | 'week' | 'month'
export type AccuracySubject = 'ALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST'

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
      decks: {
        getTopics: () => Promise<{ success: boolean; data?: any; error?: string }>
        getCardsByTopic: (topicId: string) => Promise<{ success: boolean; data?: any; error?: string }>
        getDueCounts: () => Promise<{ success: boolean; data?: any; error?: string }>
        getDueCardsForSession: (topicId: string) => Promise<{ success: boolean; data?: any; error?: string }>
        addDeckWithCards: (payload: any) => Promise<{ success: boolean; error?: string }>
        deleteTopic: (topicId: string) => Promise<{ success: boolean; error?: string }>
        exportToText: (topicId: number | string, topicName: string) => Promise<{ success: boolean; error?: string }>
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
      print: {
        open: (topicId: string, title: string) => Promise<{ success: boolean; error?: string }>
        toPDF: (suggestedName: string) => Promise<{ success: boolean; canceled?: boolean; error?: string }>
      }
    }
  }
}

export const dbService = {
  recordCardResult: async (cardId: string, correct: boolean): Promise<void> => {
    const existing = await dbService.getProgress(cardId)
    const repetitions = existing?.repetitions ?? 0
    const interval = existing?.interval ?? 1
    const easeFactor = existing?.easeFactor ?? 2.5

    const quality = correct ? 4 : 1
    const sm2Result = calculateSM2(quality, repetitions, interval, easeFactor)

    const now = new Date()
    const nextReview = new Date(now.getTime() + sm2Result.interval * 86400000)

    await dbService.saveProgress(
      cardId,
      {
        ...sm2Result,
        nextReview: nextReview.toISOString(),
        lastReviewed: now.toISOString(),
      },
      correct
    )
  },

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
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get cards'}`)
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
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to update progress'}`)
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
    const result = await window.electron.db.run(sql, [today, correctInc, totalInc, correctInc, totalInc])
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to record activity'}`)
    }
  },

  getActivityHistory: async (): Promise<Record<string, { count: number, timeSpent: number }>> => {
    const res = await window.electron.db.query('SELECT day, count, time_spent FROM study_activity')
    if (!res.success) {
      throw new Error(`Database Operation Failed: ${res.error || 'Failed to get study activity history'}`)
    }
    const history: Record<string, { count: number, timeSpent: number }> = {}
    if (res.data) {
      res.data.forEach((row: any) => {
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

    const toLocal = (d: Date): string => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dy = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dy}`
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
      return toLocal(mon)
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
    const startStr = toLocal(startDate)

    type RawRow = { day: string; correct: number; total: number }
    let rawRows: RawRow[] = []

    if (subject === 'ALL') {
      const res = await window.electron.db.query(
        `SELECT day,
                correct_count AS correct,
                total_count   AS total
         FROM   study_activity
         WHERE  day >= ?
         ORDER  BY day ASC`,
        [startStr]
      )
      if (!res.success) {
        throw new Error(`Database Operation Failed: ${res.error || 'Failed to get accuracy trend'}`)
      }
      if (res.data) {
        rawRows = res.data.map((r: any) => ({
          day:     String(r.day),
          correct: Number(r.correct) || 0,
          total:   Number(r.total)   || 0,
        }))
      }
    } else {
      const fullSubject = SUBJECT_FULL[subject] ?? subject
      const res = await window.electron.db.query(
        `SELECT DATE(p.last_reviewed)  AS day,
                SUM(p.correct_count)   AS correct,
                SUM(p.total_count)     AS total
         FROM   progress p
         JOIN   cards   c ON p.card_id  = c.id
         JOIN   topics  t ON c.topic_id = t.id
         WHERE  t.subject = ?
           AND  DATE(p.last_reviewed) >= ?
         GROUP  BY DATE(p.last_reviewed)
         ORDER  BY day ASC`,
        [fullSubject, startStr]
      )
      if (!res.success) {
        throw new Error(`Database Operation Failed: ${res.error || 'Failed to get subject accuracy trend'}`)
      }
      if (res.data) {
        rawRows = res.data
          .filter((r: any) => r.day != null)
          .map((r: any) => ({
            day:     String(r.day),
            correct: Number(r.correct) || 0,
            total:   Number(r.total)   || 0,
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
    const today = toLocalDateString(new Date())
    const sql = `
      INSERT INTO study_activity (day, count, time_spent) 
      VALUES (?, 0, ?) 
      ON CONFLICT(day) DO UPDATE SET time_spent = time_spent + excluded.time_spent
    `
    const result = await window.electron.db.run(sql, [today, minutes])
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to update time spent'}`)
    }
  },

  getDashboardStats: async () => {
    // 1. Total cards studied (at least one repetition)
    const studiedResult = await window.electron.db.query('SELECT COUNT(card_id) as count FROM progress WHERE repetitions > 0')
    if (!studiedResult.success) {
      throw new Error(`Database Operation Failed: ${studiedResult.error || 'Failed to get studied count'}`)
    }
    const totalStudied = studiedResult.data?.[0]?.count || 0

    // 2. Cards due today
    const dueResult = await window.electron.db.query("SELECT COUNT(id) as count FROM cards c LEFT JOIN progress p ON c.id = p.card_id WHERE p.next_review <= datetime('now') OR p.next_review IS NULL")
    if (!dueResult.success) {
      throw new Error(`Database Operation Failed: ${dueResult.error || 'Failed to get due counts'}`)
    }
    const dueToday = dueResult.data?.[0]?.count || 0

    // 3. Accuracy Rate
    const accResult = await window.electron.db.query('SELECT CAST(SUM(correct_count) AS REAL) / NULLIF(SUM(total_count), 0) as accuracy FROM progress')
    if (!accResult.success) {
      throw new Error(`Database Operation Failed: ${accResult.error || 'Failed to get accuracy rate'}`)
    }
    const accuracyVal = accResult.data?.[0]?.accuracy
    const accuracy = accuracyVal != null ? Math.round(accuracyVal * 100) : 0

    // 4. Streak — read from study_activity for consistency with the activity grid
    const datesResult = await window.electron.db.query("SELECT day FROM study_activity WHERE time_spent > 0 ORDER BY day DESC")
    if (!datesResult.success) {
      throw new Error(`Database Operation Failed: ${datesResult.error || 'Failed to get study dates'}`)
    }
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
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get subject breakdown'}`)
    }
    return result.data || []
  },

  getSubjectProgress: async () => {
    const sql = `
      SELECT 
        t.subject, 
        CAST(SUM(p.correct_count) AS REAL) / NULLIF(SUM(p.total_count), 0) as accuracy 
      FROM topics t 
      JOIN cards c ON t.id = c.topic_id 
      LEFT JOIN progress p ON c.id = p.card_id 
      GROUP BY t.subject
    `
    const result = await window.electron.db.query(sql)
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get subject progress'}`)
    }
    return result.data || []
  },

  getGlobalStats: async () => {
    const decks = await window.electron.db.query('SELECT COUNT(id) as count FROM topics')
    if (!decks.success) {
      throw new Error(`Database Operation Failed: ${decks.error || 'Failed to get decks count'}`)
    }
    const cards = await window.electron.db.query('SELECT COUNT(id) as count FROM cards')
    if (!cards.success) {
      throw new Error(`Database Operation Failed: ${cards.error || 'Failed to get cards count'}`)
    }
    const internalized = await window.electron.db.query('SELECT COUNT(card_id) as count FROM progress WHERE repetitions >= 5')
    if (!internalized.success) {
      throw new Error(`Database Operation Failed: ${internalized.error || 'Failed to get internalized count'}`)
    }
    
    return {
      totalDecks: decks.data?.[0]?.count || 0,
      totalCards: cards.data?.[0]?.count || 0,
      internalized: internalized.data?.[0]?.count || 0
    }
  },

  clearAllData: async (): Promise<void> => {
    // Delete in FK-safe order: progress → cards → topics
    const r1 = await window.electron.db.run('DELETE FROM progress')
    if (!r1.success) throw new Error(`Database Operation Failed: ${r1.error || 'Failed to delete progress'}`)
    const r2 = await window.electron.db.run('DELETE FROM study_activity')
    if (!r2.success) throw new Error(`Database Operation Failed: ${r2.error || 'Failed to delete study activity'}`)
    const r3 = await window.electron.db.run('DELETE FROM exam_sessions')
    if (!r3.success) throw new Error(`Database Operation Failed: ${r3.error || 'Failed to delete exam sessions'}`)
    const r4 = await window.electron.db.run('DELETE FROM cards')
    if (!r4.success) throw new Error(`Database Operation Failed: ${r4.error || 'Failed to delete cards'}`)
    const r5 = await window.electron.db.run('DELETE FROM topics')
    if (!r5.success) throw new Error(`Database Operation Failed: ${r5.error || 'Failed to delete topics'}`)
  },

  exportDecks: async (): Promise<string> => {
    const topicsRes = await window.electron.db.query('SELECT * FROM topics')
    if (!topicsRes.success) throw new Error(`Database Operation Failed: ${topicsRes.error || 'Failed to export topics'}`)
    const cardsRes = await window.electron.db.query('SELECT * FROM cards')
    if (!cardsRes.success) throw new Error(`Database Operation Failed: ${cardsRes.error || 'Failed to export cards'}`)
    const progressRes = await window.electron.db.query('SELECT * FROM progress')
    if (!progressRes.success) throw new Error(`Database Operation Failed: ${progressRes.error || 'Failed to export progress'}`)
    
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
        const r = await window.electron.db.run(
          `INSERT OR REPLACE INTO topics (id, name, subject, created_at, description, folder_name, tags) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.name, t.subject, t.created_at || Date.now()/1000, t.description || '', t.folder_name || 'Uncategorized', t.tags || '[]']
        )
        if (!r.success) throw new Error(`Database Operation Failed: ${r.error || 'Failed to import topic'}`)
      }

      for (const c of parsed.cards) {
        const r = await window.electron.db.run(
          `INSERT OR REPLACE INTO cards (id, topic_id, type, data, difficulty, tags, is_custom, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.topic_id, c.type, c.data, c.difficulty || 'medium', c.tags || '[]', c.is_custom ? 1 : 0, c.created_at || Date.now()/1000]
        )
        if (!r.success) throw new Error(`Database Operation Failed: ${r.error || 'Failed to import card'}`)
      }

      if (parsed.progress) {
        for (const p of parsed.progress) {
          const r = await window.electron.db.run(
            `INSERT OR REPLACE INTO progress (card_id, ease_factor, interval, repetitions, next_review, last_reviewed, correct_count, total_count) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.card_id, p.ease_factor || 2.5, p.interval || 1, p.repetitions || 0, p.next_review, p.last_reviewed, p.correct_count || 0, p.total_count || 0]
          )
          if (!r.success) throw new Error(`Database Operation Failed: ${r.error || 'Failed to import progress'}`)
        }
      }

      return { success: true, message: 'Decks and progress imported successfully' }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to parse backup file'
      return { success: false, message }
    }
  },

  getAllCardsByTopic: async (topicId: string): Promise<Card[]> => {
    const sql = `
      SELECT id, type, data, tags, difficulty, is_custom, created_at
      FROM cards
      WHERE topic_id = ?
      ORDER BY created_at ASC
    `
    const result = await window.electron.db.query(sql, [topicId])

    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get cards'}`)
    }

    return (result.data || []).map((row: { id: string; type: string; data: string; tags: string; difficulty: string; is_custom: number; created_at: string }) => ({
      id: row.id,
      topicId,
      type: row.type as Card['type'],
      data: JSON.parse(row.data),
      difficulty: row.difficulty as Card['difficulty'],
      tags: JSON.parse(row.tags || '[]'),
      isCustom: Boolean(row.is_custom),
      createdAt: row.created_at,
    }))
  },

  getCardsPrioritized: async (topicId: string): Promise<Card[]> => {
    const sql = `
      SELECT c.id, c.type, c.data, c.tags, c.difficulty, c.is_custom, c.created_at,
             p.next_review
      FROM cards c
      LEFT JOIN progress p ON c.id = p.card_id
      WHERE c.topic_id = ?
      ORDER BY
        CASE
          WHEN p.next_review IS NULL THEN 0
          WHEN p.next_review <= datetime('now') THEN 0
          ELSE 1
        END ASC,
        c.created_at ASC
    `
    const result = await window.electron.db.query(sql, [topicId])
    if (!result.success) {
      throw new Error(`Database Operation Failed: ${result.error || 'Failed to get prioritized cards'}`)
    }
    return (result.data || []).map((row: any) => ({
      id: row.id,
      topicId: topicId,
      type: row.type,
      data: JSON.parse(row.data),
      difficulty: row.difficulty,
      tags: JSON.parse(row.tags || '[]'),
      isCustom: Boolean(row.is_custom),
      createdAt: row.created_at,
    }))
  },
}



