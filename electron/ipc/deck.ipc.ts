import { ipcMain } from 'electron'
import { queryAll, execute, getDB, getCardsWithProgress } from '../db/database'
import { resolveOrCreateFolderId } from '../db/folderHelpers'
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


export function registerDeckHandlers(): void {
  ipcMain.handle('decks:getTopics', async () => {
    try {
      const rows = queryAll(
        'SELECT id, name, subject, description, parent_id, order_index, tags, created_at, folder_name, folder_id, is_favorite FROM topics'
      )
      return { success: true, data: rows }
    } catch (error) {
      console.error('[Decks getTopics Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:getCardsByTopic', async (_, topicId: string) => {
    try {
      const rows = queryAll(
        'SELECT id, topic_id, type, data, difficulty, tags, is_custom, order_index, created_at FROM cards WHERE topic_id = ?',
        [topicId]
      )
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
        SELECT id, topic_id, type, data, tags, difficulty, is_custom, order_index, created_at
        FROM cards
        WHERE topic_id = ?
        ORDER BY order_index ASC, created_at ASC
      `, [topicId])
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getCardsWithProgress', async (_, topicId: string) => {
    try {
      const rows = getCardsWithProgress(topicId, { dueOnly: false })
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:getTopicsWithCardCounts', async () => {
    try {
      const rows = queryAll(`
        SELECT t.id, t.name, t.subject, t.description, t.created_at, t.tags, t.folder_name, t.folder_id, t.order_index, t.is_favorite,
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
        SELECT t.id, t.name, t.subject, t.description, t.created_at, t.tags, t.folder_name, t.folder_id, t.order_index, t.is_favorite,
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
      // ── Type-scoped mastery (denominator = ALL cards, not just studied ones) ──
      //
      // The old formula computed:
      //   SUM(correct_count) / SUM(total_count)
      // over only cards that HAD a progress row.  This meant studying 3 cards
      // correctly out of 100 would show 50 % mastery (3/6 attempts) instead of
      // the correct 3 %.
      //
      // Fix: denominator is always COUNT(*) of all qualifying cards in the topic.
      //
      //   • MCQ deck (or mixed MCQ+flashcard)
      //       mastery = SUM(correct_count across mcq cards) / COUNT(all mcq cards)
      //       Rationale: a card never attempted contributes 0 correct out of 1 total.
      //
      //   • Pure flashcard / formula / concept deck  (SM-2 scored)
      //       mastery = COUNT(cards where repetitions >= 2) / COUNT(all cards)
      //       Rationale: repetitions >= 2 means the card has been seen at least
      //       twice AND not reset back to 0 by an "Again" rating — a meaningful
      //       signal that the learner actually knows the card.
      //       Cards never studied have repetitions = NULL → counted as 0.
      //
      // Rule: if a topic has ANY mcq cards, MCQ is the primary type.
      //       Otherwise SM-2 scoring applies.
      //       This prevents SM-2 data from diluting MCQ mastery and vice-versa.
      const rows = queryAll(`
        WITH topic_flags AS (
          SELECT topic_id,
                 MAX(CASE WHEN type = 'mcq'       THEN 1 ELSE 0 END) AS has_mcq,
                 MAX(CASE WHEN type = 'flashcard'  THEN 1 ELSE 0 END) AS has_flashcard,
                 COUNT(*)                                              AS total_cards
          FROM   cards
          GROUP  BY topic_id
        ),
        -- Only the cards that count for each topic's mastery metric
        eligible AS (
          SELECT c.topic_id,
                 tf.has_mcq,
                 tf.has_flashcard,
                 c.id        AS card_id,
                 p.correct_count,
                 p.total_count,
                 p.repetitions
          FROM   cards       c
          JOIN   topic_flags tf ON c.topic_id = tf.topic_id
          LEFT   JOIN progress p ON c.id = p.card_id
          WHERE
            (tf.has_mcq = 1 AND c.type = 'mcq')
            OR
            (tf.has_mcq = 0 AND tf.has_flashcard = 1 AND c.type = 'flashcard')
            OR
            (tf.has_mcq = 0 AND tf.has_flashcard = 0 AND c.type NOT IN ('mcq', 'flashcard'))
        )
        SELECT
          topic_id,
          CASE
            -- MCQ primary: cards the user has ever answered correctly / total MCQ cards
            -- Uses last_result='correct' so a card repeated 5 times still counts as 1,
            -- not 5. Unstudied cards (no progress row) contribute 0.
            WHEN has_mcq = 1 THEN
              CAST(
                SUM(CASE WHEN last_result = 'correct' THEN 1 ELSE 0 END)
                AS REAL
              ) / NULLIF(COUNT(*), 0)

            -- SM-2 primary: "learned" cards (seen ≥2 times and not reset by Again)
            -- divided by ALL cards in the deck (including never-studied ones).
            ELSE
              CAST(
                SUM(CASE WHEN COALESCE(repetitions, 0) >= 2 THEN 1 ELSE 0 END)
                AS REAL
              ) / NULLIF(COUNT(*), 0)
          END AS mastery
        FROM eligible
        GROUP BY topic_id
      `)
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:getBookmarkCountsByTopic', async (_, cardIds: string[]) => {
    try {
      if (!Array.isArray(cardIds) || cardIds.length === 0) {
        return { success: true, data: {} }
      }
      const counts: Record<string, number> = {}
      const CHUNK_SIZE = 500
      for (let i = 0; i < cardIds.length; i += CHUNK_SIZE) {
        const chunk = cardIds.slice(i, i + CHUNK_SIZE)
        const placeholders = chunk.map(() => '?').join(',')
        const rows = queryAll(
          `SELECT topic_id, COUNT(*) as count FROM cards WHERE id IN (${placeholders}) GROUP BY topic_id`,
          chunk
        ) as Array<{ topic_id: string; count: number }>
        for (const row of rows) {
          counts[row.topic_id] = (counts[row.topic_id] || 0) + row.count
        }
      }
      return { success: true, data: counts }
    } catch (error) {
      console.error('[Decks getBookmarkCountsByTopic Error]', error)
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
        'INSERT INTO cards (id, topic_id, type, data, difficulty, tags, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      const updateCard = db.prepare(
        'UPDATE cards SET type = ?, data = ?, order_index = ? WHERE id = ?'
      )
      const deleteCard = db.prepare('DELETE FROM cards WHERE id = ?')

      db.transaction(() => {
        const finalFolderId = resolveOrCreateFolderId(db, payload.folderName, payload.folderId, payload.scope || 'study')
        execute(
          `UPDATE topics SET name = ?, subject = ?, description = ?, tags = ?, folder_name = ?, folder_id = ? WHERE id = ?`,
          [payload.title, payload.subject, payload.description, payload.tags, payload.folderName, finalFolderId, payload.deckId]
        )
        for (let i = 0; i < payload.cards.length; i++) {
          const card = payload.cards[i]
          if (card.isNew) {
            insertCard.run(crypto.randomUUID(), payload.deckId, card.type, card.data, 'medium', '[]', i)
          } else {
            updateCard.run(card.type, card.data, i, card.id)
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
      if (!payload?.folderOrders || !Array.isArray(payload.folderOrders)) {
        return { success: false, error: 'Invalid payload: folderOrders array required' }
      }
      const db = getDB()
      db.transaction(() => {
        for (const { folderName, orderIndex } of payload.folderOrders) {
          const folderId = resolveOrCreateFolderId(db, folderName, null)
          if (folderId) {
            execute(
              `UPDATE folders SET order_index = ? WHERE id = ?`,
              [orderIndex, folderId]
            )
          }
        }
      })()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:toggleFavorite', async (_, topicId: string) => {
    try {
      if (!topicId || typeof topicId !== 'string') {
        return { success: false, error: 'Invalid topicId' }
      }
      const db = getDB()
      const row = db.prepare('SELECT is_favorite FROM topics WHERE id = ?').get(topicId) as { is_favorite: number } | undefined
      if (!row) {
        return { success: false, error: 'Topic not found' }
      }
      const nextVal = row.is_favorite ? 0 : 1
      db.prepare('UPDATE topics SET is_favorite = ? WHERE id = ?').run(nextVal, topicId)
      return { success: true, isFavorite: nextVal === 1 }
    } catch (error) {
      console.error('[Decks toggleFavorite Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:setFavorite', async (_, payload: { topicId: string; isFavorite: boolean }) => {
    try {
      if (!payload?.topicId || typeof payload.topicId !== 'string') {
        return { success: false, error: 'Invalid topicId' }
      }
      const db = getDB()
      const val = payload.isFavorite ? 1 : 0
      db.prepare('UPDATE topics SET is_favorite = ? WHERE id = ?').run(val, payload.topicId)
      return { success: true, isFavorite: payload.isFavorite }
    } catch (error) {
      console.error('[Decks setFavorite Error]', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('decks:deleteTag', async (_, tagToDelete: string) => {
    try {
      if (!tagToDelete || typeof tagToDelete !== 'string') {
        return { success: false, error: 'Invalid tag' }
      }
      const db = getDB()
      const normalizedTarget = tagToDelete.trim().toLowerCase()
      const rows = queryAll('SELECT id, tags FROM topics')
      let affectedTopics = 0

      db.transaction(() => {
        for (const row of rows) {
          if (!row.tags) continue
          let tags: string[] = []
          try {
            const parsed = JSON.parse(row.tags)
            tags = Array.isArray(parsed) ? parsed : []
          } catch {
            continue
          }
          const nextTags = tags.filter(t => typeof t === 'string' && t.trim().toLowerCase() !== normalizedTarget)
          if (nextTags.length !== tags.length) {
            execute('UPDATE topics SET tags = ? WHERE id = ?', [JSON.stringify(nextTags), row.id])
            affectedTopics++
          }
        }

        // Also clean up tags on cards table where applicable
        const cardRows = queryAll("SELECT id, tags FROM cards WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'")
        for (const c of cardRows) {
          try {
            const parsed = JSON.parse(c.tags)
            if (Array.isArray(parsed)) {
              const nextTags = parsed.filter(t => typeof t === 'string' && t.trim().toLowerCase() !== normalizedTarget)
              if (nextTags.length !== parsed.length) {
                execute('UPDATE cards SET tags = ? WHERE id = ?', [JSON.stringify(nextTags), c.id])
              }
            }
          } catch {
            // Ignore parse errors on cards
          }
        }
      })()

      return { success: true, affectedTopics }
    } catch (error) {
      console.error('[Decks deleteTag Error]', error)
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
      
      // Guard: never allow deleting the Uncategorized folder
      const targetFolder = db.prepare(`SELECT name FROM folders WHERE id = ?`).get(folderId) as { name: string } | undefined
      if (targetFolder?.name === 'Uncategorized') {
        return { success: false, error: 'Cannot delete the Uncategorized folder.' }
      }

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
          let uncatRow = db.prepare(`SELECT id FROM folders WHERE name = 'Uncategorized' AND scope = ? LIMIT 1`).get(scope) as { id: string } | undefined
          if (!uncatRow) {
            // Uncategorized was deleted — recreate it so topics always have a valid home
            const newUncatId = `folder_uncat_${scope}_${Date.now()}`
            db.prepare(`INSERT INTO folders (id, name, parent_id, order_index, scope) VALUES (?, 'Uncategorized', NULL, 9999, ?)`).run(newUncatId, scope)
            uncatRow = { id: newUncatId }
          }
          const uncatId = uncatRow.id
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
