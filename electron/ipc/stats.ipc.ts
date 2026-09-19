import { ipcMain } from 'electron'
import { queryAll, getDB } from '../db/database'
import { getFlashcardSchedule } from '../db/schedule'

export function registerStatsHandlers(): void {
  ipcMain.handle('data:getAccuracyTrendAll', async (_, lookbackOrStart: number | string = 14) => {
    try {
      const lookbackDays = typeof lookbackOrStart === 'number'
        ? lookbackOrStart
        : Math.max(14, Math.round((Date.now() - new Date(lookbackOrStart).getTime()) / (1000 * 60 * 60 * 24)))

      // Find the latest day with recorded activity
      const latestRow = queryAll(`
        SELECT MAX(day) AS max_day 
        FROM study_activity 
        WHERE total_count > 0
      `)
      let latestDay = latestRow[0]?.max_day

      if (!latestDay) {
        const pLatest = queryAll(`
          SELECT MAX(SUBSTR(last_reviewed, 1, 10)) AS max_day 
          FROM progress 
          WHERE total_count > 0
        `)
        latestDay = pLatest[0]?.max_day
      }

      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      
      // If no new scores added today, anchor to the last data taken
      const anchorDay = latestDay || today

      const anchorDate = new Date(anchorDay + 'T00:00:00')
      anchorDate.setDate(anchorDate.getDate() - lookbackDays)
      const startStr = `${anchorDate.getFullYear()}-${pad(anchorDate.getMonth() + 1)}-${pad(anchorDate.getDate())}`

      const sql = `
         SELECT day,
                correct_count AS correct,
                total_count   AS total
         FROM   study_activity
         WHERE  day >= ? AND day <= ? AND total_count > 0
         ORDER  BY day ASC`
      let rows = queryAll(sql, [startStr, anchorDay])

      if (rows.length === 0) {
        const fallbackSql = `
          SELECT SUBSTR(last_reviewed, 1, 10) AS day,
                 SUM(correct_count) AS correct,
                 SUM(total_count)   AS total
          FROM   progress
          WHERE  last_reviewed >= ? AND last_reviewed <= ? AND total_count > 0
          GROUP  BY SUBSTR(last_reviewed, 1, 10)
          ORDER  BY day ASC`
        const fallbackRows = queryAll(fallbackSql, [startStr, anchorDay + 'T23:59:59.999Z'])
        if (fallbackRows.length > 0) {
          rows = fallbackRows
        }
      }

      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getAccuracyTrendSubject', async (_, fullSubject: string, lookbackOrStart: number | string = 14) => {
    try {
      const lookbackDays = typeof lookbackOrStart === 'number'
        ? lookbackOrStart
        : Math.max(14, Math.round((Date.now() - new Date(lookbackOrStart).getTime()) / (1000 * 60 * 60 * 24)))

      const SUBJECT_ALIASES: Record<string, string[]> = {
        'Mathematics': ['Mathematics', 'MATH'],
        'MATH': ['Mathematics', 'MATH'],
        'General Engineering & Applied Sciences': ['General Engineering & Applied Sciences', 'GEAS'],
        'GEAS': ['General Engineering & Applied Sciences', 'GEAS'],
        'Electronics Engineering': ['Electronics Engineering', 'ELECS'],
        'ELECS': ['Electronics Engineering', 'ELECS'],
        'Electronics Systems & Technologies': ['Electronics Systems & Technologies', 'EST'],
        'EST': ['Electronics Systems & Technologies', 'EST'],
      }
      const aliases = SUBJECT_ALIASES[fullSubject] || [fullSubject]
      const placeholders = aliases.map(() => '?').join(',')

      // Find the latest day with recorded activity for this subject
      const latestRow = queryAll(`
        SELECT MAX(SUBSTR(p.last_reviewed, 1, 10)) AS max_day
        FROM   progress p
        JOIN   cards   c ON p.card_id  = c.id
        JOIN   topics  t ON c.topic_id = t.id
        WHERE  t.subject IN (${placeholders})
          AND  p.total_count > 0
      `, aliases)
      const latestDay = latestRow[0]?.max_day

      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      
      // If no new scores added today for this subject, anchor to the last data taken
      const anchorDay = latestDay || today

      const anchorDate = new Date(anchorDay + 'T00:00:00')
      anchorDate.setDate(anchorDate.getDate() - lookbackDays)
      const startStr = `${anchorDate.getFullYear()}-${pad(anchorDate.getMonth() + 1)}-${pad(anchorDate.getDate())}`

      const sql = `
         SELECT SUBSTR(p.last_reviewed, 1, 10) AS day,
                SUM(p.correct_count)   AS correct,
                SUM(p.total_count)     AS total
         FROM   progress p
         JOIN   cards   c ON p.card_id  = c.id
         JOIN   topics  t ON c.topic_id = t.id
         WHERE  t.subject IN (${placeholders})
           AND  p.last_reviewed >= ?
           AND  p.last_reviewed <= ?
           AND  p.total_count > 0
         GROUP  BY SUBSTR(p.last_reviewed, 1, 10)
         ORDER  BY day ASC`
      const rows = queryAll(sql, [...aliases, startStr, anchorDay + 'T23:59:59.999Z'])
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getDashboardStats', async () => {
    try {
      const studiedRows = queryAll('SELECT COUNT(card_id) as count FROM progress WHERE repetitions > 0')
      const totalStudied = studiedRows[0]?.count || 0

      const dueToday = getFlashcardSchedule(getDB()).due

      const accRows = queryAll('SELECT CAST(SUM(correct_count) AS REAL) / NULLIF(SUM(total_count), 0) as accuracy FROM progress')
      const accuracy = accRows[0]?.accuracy

      const datesRows = queryAll("SELECT day FROM study_activity WHERE time_spent > 0 ORDER BY day DESC")
      const dates = datesRows.map(r => r.day)

      return { success: true, data: { totalStudied, dueToday, accuracy, dates } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getSubjectBreakdown', async () => {
    try {
      const sql = `
        SELECT
          CASE
            WHEN subject IN ('Mathematics', 'MATH') THEN 'MATH'
            WHEN subject IN ('General Engineering & Applied Sciences', 'GEAS') THEN 'GEAS'
            WHEN subject IN ('Electronics Engineering', 'ELECS') THEN 'ELECS'
            WHEN subject IN ('Electronics Systems & Technologies', 'EST') THEN 'EST'
            ELSE subject
          END AS subject,
          COUNT(id) as count 
        FROM topics 
        GROUP BY 1
      `
      const rows = queryAll(sql)
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getSubjectProgress', async () => {
    try {
      const sql = `
        WITH normalized AS (
          SELECT
            CASE
              WHEN t.subject IN ('Mathematics', 'MATH') THEN 'MATH'
              WHEN t.subject IN ('General Engineering & Applied Sciences', 'GEAS') THEN 'GEAS'
              WHEN t.subject IN ('Electronics Engineering', 'ELECS') THEN 'ELECS'
              WHEN t.subject IN ('Electronics Systems & Technologies', 'EST') THEN 'EST'
              ELSE t.subject
            END AS norm_subject,
            p.card_id,
            c.type AS card_type,
            p.last_result,
            p.repetitions
          FROM progress p
          JOIN cards c ON p.card_id = c.id
          JOIN topics t ON c.topic_id = t.id
          WHERE p.total_count > 0 OR p.repetitions > 0
        )
        SELECT
          norm_subject AS subject,
          CAST(
            COUNT(DISTINCT CASE
              WHEN card_type = 'mcq' AND last_result = 'correct' THEN card_id
              WHEN card_type != 'mcq' AND COALESCE(repetitions, 0) >= 2 THEN card_id
            END)
            AS REAL
          ) / NULLIF(COUNT(DISTINCT card_id), 0) AS accuracy
        FROM normalized
        GROUP BY norm_subject
      `
      const rows = queryAll(sql)
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getGlobalStats', async () => {
    try {
      const decks = queryAll('SELECT COUNT(id) as count FROM topics')
      const cards = queryAll('SELECT COUNT(id) as count FROM cards')
      const mastered = queryAll(`
        SELECT COUNT(DISTINCT p.card_id) as count
        FROM progress p
        JOIN cards c ON p.card_id = c.id
        WHERE (c.type = 'mcq' AND p.last_result = 'correct')
           OR (c.type != 'mcq' AND COALESCE(p.repetitions, 0) >= 2)
      `)
      const byType = queryAll(`
        SELECT type, COUNT(id) as count FROM cards GROUP BY type
      `) as { type: string; count: number }[]
      const typeMap: Record<string, number> = {}
      byType.forEach(r => { typeMap[r.type] = r.count })
      const answeredMcqs = queryAll(`
        SELECT COUNT(DISTINCT p.card_id) as count 
        FROM progress p 
        JOIN cards c ON p.card_id = c.id 
        WHERE c.type = 'mcq' AND p.total_count > 0
      `)
      return {
        success: true,
        data: {
          totalDecks: decks[0]?.count || 0,
          totalCards: cards[0]?.count || 0,
          internalized: mastered[0]?.count || 0,
          flashcardCount: (typeMap['flashcard'] || 0) + (typeMap['formula'] || 0) + (typeMap['concept'] || 0),
          mcqCount: typeMap['mcq'] || 0,
          mcqAnswered: answeredMcqs[0]?.count || 0,
        }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
