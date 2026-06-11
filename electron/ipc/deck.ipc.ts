import { ipcMain } from 'electron'
import { queryAll, execute, getDB } from '../db/database'

export function registerDeckHandlers(): void {
  ipcMain.handle('decks:getTopics', async () => {
    try {
      const rows = queryAll('SELECT * FROM topics') // basic generic for now, adapt if needed
      return { success: true, data: rows }
    } catch (error) {
      console.error('[Decks getTopics Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:getCardsByTopic', async (_, topicId: string) => {
    try {
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
      getDB().transaction(() => {
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
      })()
      return { success: true }
    } catch (error) {
      console.error('[Decks addDeckWithCards Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:deleteTopic', async (_, topicId: string) => {
    try {
      getDB().transaction(() => {
        execute(`DELETE FROM progress WHERE card_id IN (SELECT id FROM cards WHERE topic_id = ?)`, [topicId])
        execute(`DELETE FROM cards WHERE topic_id = ?`, [topicId])
        execute(`DELETE FROM topics WHERE id = ?`, [topicId])
      })()
      return { success: true }
    } catch (error) {
      console.error('[Decks deleteTopic Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getCards', async (_, topicId?: string) => {
    try {
      let sql = `
        SELECT c.*, p.ease_factor, p.interval, p.repetitions, p.next_review, p.last_reviewed
        FROM cards c
        LEFT JOIN progress p ON c.id = p.card_id
        WHERE 1=1
      `
      const params: unknown[] = []
      if (topicId) {
        sql += ` AND c.topic_id = ?`
        params.push(topicId)
      }
      sql += ` ORDER BY RANDOM()`
      const rows = queryAll(sql, params)
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getProgress', async (_, cardId: string) => {
    try {
      const rows = queryAll(`SELECT repetitions, interval, ease_factor FROM progress WHERE card_id = ?`, [cardId])
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getAllCardsByTopic', async (_, topicId: string) => {
    try {
      const rows = queryAll(`
        SELECT id, topic_id, type, data, tags, difficulty, is_custom, created_at
        FROM cards
        WHERE topic_id = ?
        ORDER BY created_at ASC
      `, [topicId])
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getCardsWithProgress', async (_, topicId: string) => {
    try {
      const rows = queryAll(
        `SELECT c.id, c.topic_id, c.type, c.data, c.tags, c.difficulty, c.is_custom, c.created_at,
                COALESCE(p.ease_factor, 2.5)    AS ease_factor,
                COALESCE(p.repetitions, 0)      AS repetitions,
                COALESCE(p.interval, 1)         AS interval,
                COALESCE(p.correct_count, 0)    AS correct_count,
                COALESCE(p.total_count, 0)      AS total_count,
                p.last_result
         FROM cards c
         LEFT JOIN progress p ON c.id = p.card_id
         WHERE c.topic_id = ?
         ORDER BY c.created_at ASC`,
        [topicId]
      )
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:getTopicsWithCardCounts', async () => {
    try {
      const rows = queryAll(`
        SELECT t.id, t.name, t.subject, t.description, t.created_at, t.tags, t.folder_name, t.order_index,
               COUNT(c.id) as card_count,
               GROUP_CONCAT(DISTINCT c.type) as types
        FROM topics t LEFT JOIN cards c ON c.topic_id = t.id
        GROUP BY t.id ORDER BY t.name
      `)
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:getFormulaTopics', async () => {
    try {
      const rows = queryAll(`
        SELECT t.id, t.name, t.subject, t.description, t.created_at, t.tags, t.folder_name, t.order_index,
               COUNT(c.id) as card_count,
               GROUP_CONCAT(DISTINCT c.type) as types
        FROM topics t
        INNER JOIN cards c ON c.topic_id = t.id
        GROUP BY t.id
        HAVING COUNT(c.id) > 0
           AND SUM(CASE WHEN c.type = 'formula' THEN 1 ELSE 0 END) = COUNT(c.id)
        ORDER BY t.name
      `)
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:getFormulaMastery', async () => {
    try {
      const rows = queryAll(`
        SELECT c.topic_id,
               CAST(SUM(p.correct_count) AS REAL) / NULLIF(SUM(p.total_count), 0) AS mastery
        FROM cards c
        LEFT JOIN progress p ON c.id = p.card_id
        GROUP BY c.topic_id
      `)
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:updateDeckWithCards', async (_, payload: {
    deckId: string,
    title: string,
    subject: string,
    description: string,
    tags: string,
    folderName: string,
    cards: Array<{ id: string, type: string, data: string, isNew: boolean }>,
    deletedCardIds: string[]
  }) => {
    try {
      const db = getDB()
      const insertCard = db.prepare(
        'INSERT INTO cards (id, topic_id, type, data, difficulty, tags) VALUES (?, ?, ?, ?, ?, ?)'
      )
      const updateCard = db.prepare(
        'UPDATE cards SET type = ?, data = ? WHERE id = ?'
      )
      const deleteCard = db.prepare('DELETE FROM cards WHERE id = ?')

      db.transaction(() => {
        execute(
          `UPDATE topics SET name = ?, subject = ?, description = ?, tags = ?, folder_name = ? WHERE id = ?`,
          [payload.title, payload.subject, payload.description, payload.tags, payload.folderName, payload.deckId]
        )
        for (const card of payload.cards) {
          if (card.isNew) {
            insertCard.run(crypto.randomUUID(), payload.deckId, card.type, card.data, 'medium', '[]')
          } else {
            updateCard.run(card.type, card.data, card.id)
          }
        }
        for (const cardId of payload.deletedCardIds) {
          deleteCard.run(cardId)
        }
      })()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:updateDecksFolder', async (_, payload: {
    fromFolder: string,
    toFolder: string
  }) => {
    try {
      execute(
        `UPDATE topics SET folder_name = ? WHERE folder_name = ?`,
        [payload.toFolder, payload.fromFolder]
      )
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:updateFolderOrder', async (_, payload: {
    folderOrders: Array<{ folderName: string, orderIndex: number }>
  }) => {
    try {
      getDB().transaction(() => {
        for (const { folderName, orderIndex } of payload.folderOrders) {
          execute(
            `UPDATE topics SET order_index = ? WHERE folder_name = ?`,
            [orderIndex, folderName]
          )
        }
      })()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
