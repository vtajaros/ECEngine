import Database from 'better-sqlite3'
import crypto from 'crypto'

/**
 * Helper to bridge legacy frontend (which sends folderName strings) to new folders table.
 * Resolves an existing folder ID or creates a new folder row if it does not exist.
 */
export function resolveOrCreateFolderId(
  db: Database.Database,
  folderName: string,
  explicitId: string | null | undefined,
  scope: string = 'study'
): string | null {
  if (explicitId) {
    const row = db.prepare(`SELECT id FROM folders WHERE id = ? AND scope = ? LIMIT 1`).get(explicitId, scope) as { id: string } | undefined
    if (row) return row.id
    throw new Error(`Invalid folder ID: ${explicitId} does not exist in scope ${scope}`)
  }
  if (!folderName) return null

  if (folderName === 'Uncategorized') {
    const row = db.prepare(`SELECT id FROM folders WHERE name = 'Uncategorized' AND scope = ? LIMIT 1`).get(scope) as { id: string } | undefined
    return row?.id ?? null
  }

  const row = db.prepare(`SELECT id FROM folders WHERE name = ? COLLATE NOCASE AND scope = ? LIMIT 1`).get(folderName, scope) as { id: string } | undefined
  if (row) return row.id

  const newId = crypto.randomUUID()
  db.prepare(`INSERT INTO folders (id, name, scope) VALUES (?, ?, ?)`).run(newId, folderName, scope)
  return newId
}
