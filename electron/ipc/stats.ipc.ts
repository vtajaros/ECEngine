import { ipcMain } from 'electron'
import { queryAll } from '../db/database'

export function registerStatsHandlers(): void {
  ipcMain.handle('data:getAccuracyTrendAll', async (_, startStr: string) => {
    try {
      const sql = `
         SELECT day,
                correct_count AS correct,
                total_count   AS total
         FROM   study_activity
         WHERE  day >= ?
         ORDER  BY day ASC`
      const rows = queryAll(sql, [startStr])
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getAccuracyTrendSubject', async (_, fullSubject: string, startStr: string) => {
    try {
      const sql = `
         SELECT SUBSTR(p.last_reviewed, 1, 10) AS day,
                SUM(p.correct_count)   AS correct,
                SUM(p.total_count)     AS total
         FROM   progress p
         JOIN   cards   c ON p.card_id  = c.id
         JOIN   topics  t ON c.topic_id = t.id
         WHERE  t.subject = ?
           AND  p.last_reviewed >= ?
         GROUP  BY SUBSTR(p.last_reviewed, 1, 10)
         ORDER  BY day ASC`
      const rows = queryAll(sql, [fullSubject, startStr])
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getDashboardStats', async () => {
    try {
      const studiedRows = queryAll('SELECT COUNT(card_id) as count FROM progress WHERE repetitions > 0')
      const totalStudied = studiedRows[0]?.count || 0

      const dueRows = queryAll("SELECT COUNT(id) as count FROM cards c LEFT JOIN progress p ON c.id = p.card_id WHERE p.next_review <= date('now', 'localtime') OR p.next_review IS NULL")
      const dueToday = dueRows[0]?.count || 0

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
        SELECT subject, COUNT(id) as count 
        FROM topics 
        GROUP BY subject
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
        SELECT
          t.subject,
          CAST(COUNT(DISTINCT CASE WHEN p.repetitions > 0 THEN c.id END) AS REAL)
          / NULLIF(COUNT(DISTINCT c.id), 0) as accuracy
        FROM topics t
        JOIN cards c ON t.id = c.topic_id
        LEFT JOIN progress p ON c.id = p.card_id
        GROUP BY t.subject
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
      const internalized = queryAll('SELECT COUNT(card_id) as count FROM progress WHERE repetitions >= 5')
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
          internalized: internalized[0]?.count || 0,
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
