import { ipcMain } from 'electron'
import { initDB, queryAll, execute } from '../db/database'

let dbReady: Promise<void> | null = null

export function registerDBHandlers() {
  // Initialize the database eagerly
  dbReady = initDB().catch(err => {
    console.error('[DB Init Error]', err)
  })

  // ---- REMOVE THESE INSECURE HANDLERS EVENTUALLY ----
  ipcMain.handle('db:query', async (_, sql: string, params: unknown[] = []) => {
    try {
      await dbReady
      const rows = queryAll(sql, params)
      return { success: true, data: rows }
    } catch (error) {
      console.error('[DB Query Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('db:run', async (_, sql: string, params: unknown[] = []) => {
    try {
      await dbReady
      const { changes, lastInsertRowid } = execute(sql, params)
      return { success: true, data: { changes, lastInsertRowid } }
    } catch (error) {
      console.error('[DB Run Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // ---- NEW SEMANTIC HANDLERS ----
  ipcMain.handle('decks:getTopics', async () => {
    try {
      await dbReady
      const rows = queryAll('SELECT * FROM topics') // basic generic for now, adapt if needed
      return { success: true, data: rows }
    } catch (error) {
      console.error('[Decks getTopics Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:getCardsByTopic', async (_, topicId: string) => {
    try {
      await dbReady
      const rows = queryAll('SELECT * FROM cards WHERE topic_id = ?', [topicId])
      return { success: true, data: rows }
    } catch (error) {
      console.error('[Decks getCardsByTopic Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:addDeckWithCards', async (_, payload: { 
    topicId: string, 
    name: string, 
    subject: string, 
    description: string, 
    tags: string, 
    folderName: string,
    cards: Array<{id: string, type: string, data: string, is_custom: number}>
  }) => {
    try {
      await dbReady
      execute('BEGIN TRANSACTION')
      execute(
        `INSERT INTO topics (id, name, subject, description, tags, folder_name) VALUES (?, ?, ?, ?, ?, ?)`,
        [payload.topicId, payload.name, payload.subject, payload.description, payload.tags, payload.folderName]
      )
      
      for (const card of payload.cards) {
        execute(
          `INSERT INTO cards (id, topic_id, type, data, is_custom) VALUES (?, ?, ?, ?, ?)`,
          [card.id, payload.topicId, card.type, card.data, card.is_custom]
        )
      }
      
      execute('COMMIT')
      return { success: true }
    } catch (error) {
      console.error('[Decks addDeckWithCards Error]', error)
      try { execute('ROLLBACK') } catch {}
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:deleteTopic', async (_, topicId: string) => {
    try {
      await dbReady
      execute('BEGIN TRANSACTION')
      execute(`DELETE FROM progress WHERE card_id IN (SELECT id FROM cards WHERE topic_id = ?)`, [topicId])
      execute(`DELETE FROM cards WHERE topic_id = ?`, [topicId])
      execute(`DELETE FROM topics WHERE id = ?`, [topicId])
      execute('COMMIT')
      return { success: true }
    } catch (error) {
      console.error('[Decks deleteTopic Error]', error)
      try { execute('ROLLBACK') } catch {}
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:getDueCounts', async () => {
    try {
      await dbReady
      const nowIso = new Date().toISOString()
      const sql = `
        SELECT c.topic_id, COUNT(c.id) as dueCount
        FROM cards c
        LEFT JOIN progress p ON c.id = p.card_id
        WHERE p.card_id IS NULL
           OR p.last_result = 'wrong'
           OR p.next_review <= ?
        GROUP BY c.topic_id
      `
      const rows = queryAll(sql, [nowIso])
      return { success: true, data: rows }
    } catch (error) {
      console.error('[Decks getDueCounts Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:getDueCardsForSession', async (_, topicId: string) => {
    try {
      await dbReady
      const nowIso = new Date().toISOString()
      const sql = `
        SELECT c.*, p.ease_factor, p.interval, p.repetitions, p.next_review, p.last_reviewed, p.last_result
        FROM cards c
        LEFT JOIN progress p ON c.id = p.card_id
        WHERE c.topic_id = ?
          AND (p.card_id IS NULL OR p.last_result = 'wrong' OR p.next_review <= ?)
      `
      const rows = queryAll(sql, [topicId, nowIso])
      return { success: true, data: rows }
    } catch (error) {
      console.error('[Decks getDueCardsForSession Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
