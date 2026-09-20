import Database from 'better-sqlite3'

export interface ImportedTopicRow {
  id: string
  name: string
  subject: string
  created_at?: number | null
  description?: string | null
  folder_name?: string | null
  tags?: string | null
  order_index?: number | null
  is_favorite?: number | boolean | null
}

/**
 * Upserts a topic row during a JSON import.
 * Uses INSERT OR REPLACE so a second import with the same id refreshes all
 * columns (including is_favorite) rather than silently skipping the row.
 * The caller owns the transaction.
 *
 * @param targetFolderId  Resolved folder id (may be null for Uncategorized).
 */
export function upsertImportedTopic(
  db: Database.Database,
  t: ImportedTopicRow,
  targetFolderId: string | null
): void {
  db.prepare(
    `INSERT OR REPLACE INTO topics (id, name, subject, created_at, description, folder_name, folder_id, tags, order_index, is_favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    t.id,
    t.name,
    t.subject,
    t.created_at ?? Date.now() / 1000,
    t.description ?? '',
    t.folder_name ?? 'Uncategorized',
    targetFolderId,
    t.tags ?? '[]',
    t.order_index ?? null,
    t.is_favorite ? 1 : 0
  )
}
