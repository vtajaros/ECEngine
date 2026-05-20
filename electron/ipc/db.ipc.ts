import { ipcMain, dialog, BrowserWindow } from 'electron'
import { initDB, queryAll, execute } from '../db/database'
import * as fs from 'fs'

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

  ipcMain.handle('decks:exportToText', async (_, topicId: string | number, topicName: string) => {
    try {
      await dbReady

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
      const LETTER_MAP: Record<number, string> = { 0: 'A', 1: 'B', 2: 'C', 3: 'D' }
      const blocks: string[] = []

      for (const card of mcqCards) {
        try {
          // Guard: skip rows with missing or non-string data column
          if (!card.data || typeof card.data !== 'string' || card.data.trim() === '') continue

          let parsed: any
          try {
            parsed = JSON.parse(card.data)
          } catch {
            console.warn('[exportToText] Skipping card with unparseable JSON.')
            continue
          }

          if (!parsed || typeof parsed !== 'object') continue

          const question = (parsed.question != null ? String(parsed.question) : '').trim()
          if (!question) continue // skip blank-question cards

          // Normalize choices to a safe 4-element string array
          const rawChoices: any[] = Array.isArray(parsed.choices) ? parsed.choices : []
          const choices: string[] = [0, 1, 2, 3].map(i =>
            rawChoices[i] != null ? String(rawChoices[i]) : ''
          )

          // ── 4. Answer key resolution ──────────────────────────────────────
          const ansVal = parsed.answer
          let ansLetter = 'A'

          if (typeof ansVal === 'number' && Number.isFinite(ansVal)) {
            ansLetter = LETTER_MAP[ansVal] ?? 'A'
          } else if (typeof ansVal === 'string') {
            const clean = ansVal.trim().toUpperCase()
            if (clean === 'A' || clean === 'B' || clean === 'C' || clean === 'D') {
              ansLetter = clean
            } else {
              // Fallback: match answer text against the choices array
              const matchedIdx = choices.findIndex(c => c.trim() === ansVal.trim())
              ansLetter = LETTER_MAP[matchedIdx] ?? 'A'
            }
          }

          blocks.push(
            `Q: ${question}\nA: ${choices[0]}\nB: ${choices[1]}\nC: ${choices[2]}\nD: ${choices[3]}\nANS: ${ansLetter}`
          )
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
}
