import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { queryAll, execute, getDB } from '../db/database'
import { serializeMcqCard } from './mcq.serializer'
import * as fsp from 'fs/promises'
import * as path from 'path'
import { z } from 'zod'
import crypto from 'crypto'

const TopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  subject: z.string(),
  created_at: z.number().optional(),
  description: z.string().optional(),
  folder_name: z.string().optional(),
  tags: z.string().optional().nullable(),
  folder_id: z.string().optional().nullable(),
  parent_id: z.string().optional().nullable(),
  order_index: z.number().optional().nullable(),
})

const CardSchema = z.object({
  id: z.string(),
  topic_id: z.string(),
  type: z.enum(['flashcard', 'mcq', 'formula', 'concept']),
  data: z.string(),
  // difficulty accepts z.string() in addition to the enum to tolerate backups
  // from schema versions with different/future difficulty values. This means
  // invalid difficulty strings will pass validation here — any downstream
  // code reading `difficulty` must not assume it's one of the three enum values.
  difficulty: z.union([z.enum(['easy', 'medium', 'hard']), z.string()]).optional().nullable(),
  tags: z.string().optional().nullable(),
  is_custom: z.union([z.boolean(), z.number()]).optional().nullable(),
  created_at: z.number().optional(),
  order_index: z.number().optional().nullable(),
})

const ProgressSchema = z.object({
  card_id: z.string(),
  ease_factor: z.number().optional(),
  interval: z.number().optional(),
  repetitions: z.number().optional(),
  next_review: z.string().optional().nullable(),
  last_reviewed: z.string().optional().nullable(),
  correct_count: z.number().optional(),
  total_count: z.number().optional(),
  last_result: z.string().optional().nullable(),
})

const ImportPayloadSchema = z.object({
  topics: z.array(TopicSchema),
  cards: z.array(CardSchema),
  progress: z.array(ProgressSchema).optional(),
})

function resolveOrCreateFolderIdLocal(
  db: any,
  folderName: string,
  scope: string = 'study'
): string | null {
  if (!folderName || folderName === 'Uncategorized') return null
  const existing = db
    .prepare(`SELECT id FROM folders WHERE name = ? COLLATE NOCASE AND scope = ? LIMIT 1`)
    .get(folderName, scope) as { id: string } | undefined
  if (existing) return existing.id
  const newId = crypto.randomUUID()
  db.prepare(`INSERT INTO folders (id, name, scope) VALUES (?, ?, ?)`).run(newId, folderName, scope)
  return newId
}

export function registerExportHandlers(): void {
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

      await fsp.writeFile(result.filePath, payload, 'utf-8')
      return { success: true }
    } catch (error) {
      console.error('[Decks exportToText Error]', error)
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

  ipcMain.handle('data:exportSelectedDecks', async (_, topicIds: string[]) => {
    try {
      if (!Array.isArray(topicIds) || topicIds.length === 0) {
        return { success: false, error: 'No decks selected' }
      }
      const placeholders = topicIds.map(() => '?').join(',')
      const topics = queryAll(`SELECT * FROM topics WHERE id IN (${placeholders})`, topicIds)
      const cards = queryAll(`SELECT * FROM cards WHERE topic_id IN (${placeholders})`, topicIds)
      const progress = queryAll(`SELECT p.* FROM progress p INNER JOIN cards c ON p.card_id = c.id WHERE c.topic_id IN (${placeholders})`, topicIds)
      
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
      const db = getDB()
      db.transaction(() => {
        for (const t of topics) {
          const importFolderId = resolveOrCreateFolderIdLocal(db, t.folder_name ?? 'Uncategorized')
          const folderExists = t.folder_id
            ? db.prepare('SELECT id FROM folders WHERE id = ? LIMIT 1').get(t.folder_id)
            : null
          const targetFolderId = folderExists ? t.folder_id : importFolderId
          db.prepare(
            `INSERT OR REPLACE INTO topics (id, name, subject, created_at, description, folder_name, folder_id, tags, order_index)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            t.id,
            t.name,
            t.subject,
            t.created_at ?? Date.now() / 1000,
            t.description ?? '',
            t.folder_name ?? 'Uncategorized',
            targetFolderId,
            t.tags ?? '[]',
            t.order_index ?? null
          )
        }
        for (const c of cards) {
          execute(
            `INSERT OR REPLACE INTO cards (id, topic_id, type, data, difficulty, tags, is_custom, created_at, order_index)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.topic_id, c.type, c.data, c.difficulty ?? 'medium', c.tags ?? '[]', c.is_custom ? 1 : 0, c.created_at ?? Date.now()/1000, c.order_index ?? null]
          )
        }
        if (progress) {
          for (const p of progress) {
            execute(
              `INSERT OR REPLACE INTO progress (card_id, ease_factor, interval, repetitions, next_review, last_reviewed, correct_count, total_count, last_result)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [p.card_id, p.ease_factor ?? 2.5, p.interval ?? 1, p.repetitions ?? 0, p.next_review, p.last_reviewed, p.correct_count ?? 0, p.total_count ?? 0, p.last_result ?? null]
            )
          }
        }
      })()
      return { success: true, data: 'Decks and progress imported successfully' }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:resetProgress', async () => {
    try {
      const dbPath = app.getPath('userData')
      const src = path.join(dbPath, 'ecengine.sqlite')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const dest = path.join(dbPath, `ecengine_backup_${timestamp}.sqlite`)
      try {
        await fsp.copyFile(src, dest)
      } catch {
        // src does not exist — skip backup silently
      }

      getDB().transaction(() => {
        execute('DELETE FROM progress')
        execute('DELETE FROM study_activity')
        execute('DELETE FROM exam_sessions')
      })()
      return { success: true }
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
      try {
        await fsp.copyFile(src, dest)
      } catch {
        // src does not exist — skip backup silently
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
}
