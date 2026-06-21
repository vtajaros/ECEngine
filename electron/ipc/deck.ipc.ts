import { ipcMain } from 'electron'
import { queryAll, execute, getDB } from '../db/database'
import crypto from 'crypto'
import { z } from 'zod'

const CardInputSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['flashcard', 'mcq', 'formula', 'concept']),
  data: z.string().min(1),
  is_custom: z.number().int().min(0).max(1).optional(),
  isNew: z.boolean().optional(),
})

const AddDeckPayloadSchema = z.object({
  topicId: z.string().min(1),
  name: z.string().min(1),
  subject: z.string().min(1),
  description: z.string(),
  tags: z.string(),
  folderName: z.string(),
  folderId: z.string().nullable().optional(),
  scope: z.string().optional(),
  cards: z.array(CardInputSchema),
})

const UpdateDeckPayloadSchema = z.object({
  deckId: z.string().min(1),
  title: z.string().min(1),
  subject: z.string().min(1),
  description: z.string(),
  tags: z.string(),
  folderName: z.string(),
  folderId: z.string().nullable().optional(),
  scope: z.string().optional(),
  cards: z.array(CardInputSchema),
  deletedCardIds: z.array(z.string().min(1)),
})

const FolderCreateSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().nullable().optional(),
  scope: z.string().optional(),
})

const FolderDeleteSchema = z.object({
  folderId: z.string().min(1),
  scope: z.string().optional(),
})

const FolderSetParentSchema = z.object({
  folderId: z.string().min(1),
  parentId: z.string().nullable(),
  scope: z.string().optional(),
})

const FolderReorderSchema = z.object({
  orders: z.array(z.object({
    id: z.string().min(1),
    order_index: z.number().int(),
  })),
})

const FolderRenameSchema = z.object({
  folderId: z.string().min(1),
  newName: z.string().min(1),
})


// Helper to bridge legacy frontend (which sends folderName strings) to new folders table
function resolveOrCreateFolderId(db: import('better-sqlite3').Database, folderName: string, explicitId: string | null | undefined, scope: string = 'study'): string | null {
  if (explicitId) {
    const row = db.prepare(`SELECT id FROM folders WHERE id = ? AND scope = ? LIMIT 1`).get(explicitId, scope) as { id: string } | undefined;
    if (row) return row.id;
    throw new Error(`Invalid folder ID: ${explicitId} does not exist in scope ${scope}`);
  }
  if (!folderName) return null;
  
  if (folderName === 'Uncategorized') {
    const row = db.prepare(`SELECT id FROM folders WHERE name = 'Uncategorized' AND scope = ? LIMIT 1`).get(scope) as { id: string } | undefined;
    return row?.id ?? null;
  }
  
  const row = db.prepare(`SELECT id FROM folders WHERE name = ? COLLATE NOCASE AND scope = ? LIMIT 1`).get(folderName, scope) as { id: string } | undefined;
  if (row) return row.id;
  
  const newId = crypto.randomUUID();
  db.prepare(`INSERT INTO folders (id, name, scope) VALUES (?, ?, ?)`).run(newId, folderName, scope);
  return newId;
}

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
    folderId?: string | null,       // ← add
    scope?: string,
    cards: Array<{id: string, type: string, data: string, is_custom: number}>
  }) => {
    try {
      AddDeckPayloadSchema.parse(payload)
      const db = getDB()
      db.transaction(() => {
        const finalFolderId = resolveOrCreateFolderId(db, payload.folderName, payload.folderId, payload.scope || 'study')
        execute(
          `INSERT INTO topics (id, name, subject, description, tags, folder_name, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [payload.topicId, payload.name, payload.subject, payload.description, payload.tags, payload.folderName, finalFolderId]
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
        SELECT t.id, t.name, t.subject, t.description, t.created_at, t.tags, t.folder_name, t.folder_id, t.order_index,
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
        SELECT t.id, t.name, t.subject, t.description, t.created_at, t.tags, t.folder_name, t.folder_id, t.order_index,
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
    folderId?: string | null,
    scope?: string,
    cards: Array<{ id: string, type: string, data: string, isNew: boolean }>,
    deletedCardIds: string[]
  }) => {
    try {
      UpdateDeckPayloadSchema.parse(payload)
      const db = getDB()
      const insertCard = db.prepare(
        'INSERT INTO cards (id, topic_id, type, data, difficulty, tags) VALUES (?, ?, ?, ?, ?, ?)'
      )
      const updateCard = db.prepare(
        'UPDATE cards SET type = ?, data = ? WHERE id = ?'
      )
      const deleteCard = db.prepare('DELETE FROM cards WHERE id = ?')

      db.transaction(() => {
        const finalFolderId = resolveOrCreateFolderId(db, payload.folderName, payload.folderId, payload.scope || 'study')
        execute(
          `UPDATE topics SET name = ?, subject = ?, description = ?, tags = ?, folder_name = ?, folder_id = ? WHERE id = ?`,
          [payload.title, payload.subject, payload.description, payload.tags, payload.folderName, finalFolderId, payload.deckId]
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

  // ── Folder handlers (v4) ──────────────────────────────────────────────────

  ipcMain.handle('folders:getAll', async (_, payload?: { scope: string }) => {
    try {
      const scope = payload?.scope || 'study'
      const rows = queryAll(`SELECT id, name, parent_id, order_index FROM folders WHERE scope = ? ORDER BY order_index ASC, name ASC`, [scope])
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('folders:create', async (_, payload: { name: string; parentId?: string | null; scope?: string }) => {
    try {
      FolderCreateSchema.parse(payload)
      const scope = payload.scope || 'study'
      const id = crypto.randomUUID()
      const maxOrder = (queryAll(
        `SELECT COALESCE(MAX(order_index), -1) AS m FROM folders WHERE parent_id IS ? AND scope = ?`,
        [payload.parentId ?? null, scope]
      )[0]?.m ?? -1) as number
      execute(
        `INSERT INTO folders (id, name, parent_id, order_index, scope) VALUES (?, ?, ?, ?, ?)`,
        [id, payload.name, payload.parentId ?? null, maxOrder + 1, scope]
      )
      return { success: true, data: { id, name: payload.name, parent_id: payload.parentId ?? null, order_index: maxOrder + 1 } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('folders:delete', async (_, payload: { folderId: string; scope?: string } | string) => {
    try {
      // Legacy signature supported string directly, payload object is new
      const folderId = typeof payload === 'string' ? payload : payload.folderId
      const scope = typeof payload === 'string' ? 'study' : (payload.scope || 'study')
      FolderDeleteSchema.parse({ folderId, scope })

      const db = getDB()
      db.transaction(() => {
        // Determine parent (null = top-level)
        const folder = db.prepare(`SELECT parent_id FROM folders WHERE id = ? AND scope = ?`).get(folderId, scope) as { parent_id: string | null } | undefined

        if (!folder) return

        const parentId = folder.parent_id

        if (parentId === null) {
          // Deleting a top-level folder:
          // • Promote child folders to top-level
          execute(`UPDATE folders SET parent_id = NULL WHERE parent_id = ?`, [folderId])
          // • Move decks to Uncategorized — use the real Uncategorized folder id so
          //   subtreeIds() and folder filters can still find them (folder_id = NULL
          //   matches no filter, including Uncategorized's own filter).
          const uncatRow = db.prepare(`SELECT id FROM folders WHERE name = 'Uncategorized' AND scope = ? LIMIT 1`).get(scope) as { id: string } | undefined
          const uncatId = uncatRow?.id ?? null
          execute(`UPDATE topics SET folder_id = ?, folder_name = 'Uncategorized' WHERE folder_id = ?`, [uncatId, folderId])
        } else {
          // Deleting a subfolder:
          // • Move decks up to parent folder
          const parentFolder = db.prepare(`SELECT name FROM folders WHERE id = ?`).get(parentId) as { name: string } | undefined
          execute(
            `UPDATE topics SET folder_id = ?, folder_name = ? WHERE folder_id = ?`,
            [parentId, parentFolder?.name ?? 'Uncategorized', folderId]
          )
          // Subfolders can't exist (max depth = 1), so no child promotion needed
        }

        execute(`DELETE FROM folders WHERE id = ?`, [folderId])
      })()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('folders:setParent', async (_, payload: { folderId: string; parentId: string | null; scope?: string }) => {
    try {
      FolderSetParentSchema.parse(payload)
      const scope = payload.scope || 'study'
      
      // Verify scope of folderId
      const folderRow = queryAll(`SELECT scope FROM folders WHERE id = ?`, [payload.folderId])[0]
      if (folderRow?.scope !== scope) {
        return { success: false, error: 'Target folder does not belong to the correct scope.' }
      }

      if (payload.parentId !== null) {
        // Explicitly verify scope of parentId
        const parent = queryAll(`SELECT parent_id, scope FROM folders WHERE id = ?`, [payload.parentId])[0]
        if (!parent || parent.scope !== scope) {
          return { success: false, error: 'Destination folder does not belong to the correct scope.' }
        }
        
        // 1. Target cannot be a subfolder (max depth = 1)
        if (parent?.parent_id !== null && parent?.parent_id !== undefined) {
          return { success: false, error: 'Max folder depth is 1. Cannot nest deeper.' }
        }
        // 2. Dragged folder cannot have children (max depth = 1)
        const childrenCount = queryAll(`SELECT count(*) as c FROM folders WHERE parent_id = ?`, [payload.folderId])[0].c
        if (childrenCount > 0) {
          return { success: false, error: 'Cannot nest folder — it already contains subfolders. Move or remove them first.' }
        }
      }
      execute(`UPDATE folders SET parent_id = ? WHERE id = ?`, [payload.parentId, payload.folderId])
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('folders:reorder', async (_, payload: { orders: Array<{ id: string; order_index: number }> }) => {
    try {
      FolderReorderSchema.parse(payload)
      getDB().transaction(() => {
        for (const { id, order_index } of payload.orders) {
          execute(`UPDATE folders SET order_index = ? WHERE id = ?`, [order_index, id])
        }
      })()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('folders:rename', async (_, payload: { folderId: string; newName: string }) => {
    try {
      FolderRenameSchema.parse(payload)
      if (!payload.newName?.trim()) {
        return { success: false, error: 'Folder name cannot be empty.' }
      }
      execute(`UPDATE folders SET name = ? WHERE id = ?`, [payload.newName.trim(), payload.folderId])
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
