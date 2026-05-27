import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { initDB, queryAll, execute, getDB } from '../db/database'
import { serializeMcqCard } from './mcq.serializer'
import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'

export function registerDBHandlers() {
  // Initialize the database eagerly
  initDB()

  // ---- NEW SEMANTIC HANDLERS ----
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

  ipcMain.handle('decks:exportToText', async (_, topicId: string | number, topicName: string) => {
    try {
      // ── 1. Sanitize input ─────────────────────────────────────────────────
      // topic_id is a UUID string in the DB schema. parseInt() would silently
      // produce NaN for UUID strings and return 0 rows, so we coerce to string.
      const cleanTopicId = String(topicId ?? '').trim()
      if (!cleanTopicId) {
        return { success: false, error: 'Invalid deck ID provided.' }
      }

      // ── 2. Fetch rows with null-safe fallback ─────────────────────────────
      const rawRows = queryAll(
        'SELECT type, data FROM cards WHERE topic_id = ? ORDER BY rowid ASC',
        [cleanTopicId]
      )
      const rows: any[] = Array.isArray(rawRows) ? rawRows : []

      if (rows.length === 0) {
        return { success: false, error: 'No cards found for this deck. The deck may be empty or the ID is incorrect.' }
      }

      const mcqCards = rows.filter((r: any) => r.type === 'mcq')
      if (mcqCards.length === 0) {
        return { success: false, error: 'No MCQ questions found in this deck to export.' }
      }

      // ── 3. Serialization loop with per-card isolation ─────────────────────
      const blocks: string[] = []

      for (const card of mcqCards) {
        try {
          const serialized = serializeMcqCard(card.data)
          if (serialized !== null) {
            blocks.push(serialized)
          }
        } catch (cardErr) {
          console.warn('[exportToText] Skipping card due to unexpected error:', cardErr)
        }
      }

      if (blocks.length === 0) {
        return { success: false, error: 'No valid MCQ cards could be serialized. Cards may be missing question or choice data.' }
      }

      const payload = blocks.join('\n\n')

      // ── 5. Native save dialog ─────────────────────────────────────────────
      // Strip characters that are illegal in Windows/macOS filenames
      const safeName = String(topicName ?? 'Deck').replace(/[\\/:*?"<>|]/g, '_')
      const win = BrowserWindow.getFocusedWindow()
      const dialogOptions = {
        title: 'Export Deck to Text',
        defaultPath: `${safeName}_TOS_Export.txt`,
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      }
      const result = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions)

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Export canceled' }
      }

      fs.writeFileSync(result.filePath, payload, 'utf-8')
      return { success: true }
    } catch (error) {
      console.error('[Decks exportToText Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // ---- DATA HANDLERS ----
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
      sql += ` ORDER BY RANDOM() LIMIT 100`
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

  ipcMain.handle('data:getActivityHistory', async () => {
    try {
      const rows = queryAll('SELECT day, count, time_spent FROM study_activity')
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

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
         SELECT DATE(p.last_reviewed)  AS day,
                SUM(p.correct_count)   AS correct,
                SUM(p.total_count)     AS total
         FROM   progress p
         JOIN   cards   c ON p.card_id  = c.id
         JOIN   topics  t ON c.topic_id = t.id
         WHERE  t.subject = ?
           AND  DATE(p.last_reviewed) >= ?
         GROUP  BY DATE(p.last_reviewed)
         ORDER  BY day ASC`
      const rows = queryAll(sql, [fullSubject, startStr])
      return { success: true, data: rows }
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

  ipcMain.handle('data:getDashboardStats', async () => {
    try {
      const studiedRows = queryAll('SELECT COUNT(card_id) as count FROM progress WHERE repetitions > 0')
      const totalStudied = studiedRows[0]?.count || 0

      const dueRows = queryAll("SELECT COUNT(id) as count FROM cards c LEFT JOIN progress p ON c.id = p.card_id WHERE p.next_review <= datetime('now') OR p.next_review IS NULL")
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
      return { 
        success: true, 
        data: { 
          totalDecks: decks[0]?.count || 0,
          totalCards: cards[0]?.count || 0,
          internalized: internalized[0]?.count || 0
        }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:clearAllData', async () => {
    try {
      // Back up the DB file before destroying all data — single-file copy, instant, atomic at the OS level.
      const dbPath = app.getPath('userData')
      const src = path.join(dbPath, 'ecengine.sqlite')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const dest = path.join(dbPath, `ecengine_backup_${timestamp}.sqlite`)
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
      }

      getDB().transaction(() => {
        execute('DELETE FROM progress')
        execute('DELETE FROM study_activity')
        execute('DELETE FROM exam_sessions')
        execute('DELETE FROM cards')
        execute('DELETE FROM topics')
      })()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:exportDecks', async () => {
    try {
      const topics = queryAll('SELECT * FROM topics')
      const cards = queryAll('SELECT * FROM cards')
      const progress = queryAll('SELECT * FROM progress')
      const exportData = {
        version: 1,
        topics: topics || [],
        cards: cards || [],
        progress: progress || []
      }
      return { success: true, data: JSON.stringify(exportData, null, 2) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  const TopicSchema = z.object({
    id: z.string(),
    name: z.string(),
    subject: z.string(),
    created_at: z.number().optional(),
    description: z.string().optional(),
    folder_name: z.string().optional(),
    tags: z.string().optional(),
  })

  const CardSchema = z.object({
    id: z.string(),
    topic_id: z.string(),
    type: z.enum(['flashcard', 'mcq', 'formula']),
    data: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    tags: z.string().optional(),
    is_custom: z.boolean().optional(),
    created_at: z.number().optional(),
  })

  const ProgressSchema = z.object({
    card_id: z.string(),
    ease_factor: z.number().optional(),
    interval: z.number().optional(),
    repetitions: z.number().optional(),
    next_review: z.string(),
    last_reviewed: z.string(),
    correct_count: z.number().optional(),
    total_count: z.number().optional(),
  })

  const ImportPayloadSchema = z.object({
    topics: z.array(TopicSchema),
    cards: z.array(CardSchema),
    progress: z.array(ProgressSchema).optional(),
  })

  ipcMain.handle('data:importDecks', async (_, parsed: unknown) => {
    try {
      const result = ImportPayloadSchema.safeParse(parsed)
      if (!result.success) {
        const message = result.error.issues
          .map(i => `${i.path.join('.')}: ${i.message}`)
          .join('; ')
        return { success: false, error: `Invalid backup format — ${message}` }
      }
      const { topics, cards, progress } = result.data
      getDB().transaction(() => {
        for (const t of topics) {
          execute(
            `INSERT OR REPLACE INTO topics (id, name, subject, created_at, description, folder_name, tags)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [t.id, t.name, t.subject, t.created_at ?? Date.now()/1000, t.description ?? '', t.folder_name ?? 'Uncategorized', t.tags ?? '[]']
          )
        }
        for (const c of cards) {
          execute(
            `INSERT OR REPLACE INTO cards (id, topic_id, type, data, difficulty, tags, is_custom, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.topic_id, c.type, c.data, c.difficulty ?? 'medium', c.tags ?? '[]', c.is_custom ? 1 : 0, c.created_at ?? Date.now()/1000]
          )
        }
        if (progress) {
          for (const p of progress) {
            execute(
              `INSERT OR REPLACE INTO progress (card_id, ease_factor, interval, repetitions, next_review, last_reviewed, correct_count, total_count)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [p.card_id, p.ease_factor ?? 2.5, p.interval ?? 1, p.repetitions ?? 0, p.next_review, p.last_reviewed, p.correct_count ?? 0, p.total_count ?? 0]
            )
          }
        }
      })()
      return { success: true, data: 'Decks and progress imported successfully' }
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
            WHEN p.next_review <= datetime('now') THEN 0
            ELSE 1
          END ASC,
          c.created_at ASC
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
