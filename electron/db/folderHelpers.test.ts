// electron/db/folderHelpers.test.ts
// Unit tests for renameFolder and its interaction with resolveOrCreateFolderId.
// Uses better-sqlite3 in-memory mode — never touches ecengine.sqlite.

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { renameFolder, resolveOrCreateFolderId } from './folderHelpers'

// ─── Minimal schema ───────────────────────────────────────────────────────────

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS folders (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'study'
  );

  CREATE TABLE IF NOT EXISTS topics (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    subject     TEXT NOT NULL DEFAULT '',
    folder_id   TEXT REFERENCES folders(id),
    folder_name TEXT DEFAULT 'Uncategorized'
  );
`

function createFreshDB(): Database.Database {
  const db = new Database(':memory:')
  db.exec(SCHEMA)
  return db
}

function insertFolder(db: Database.Database, id: string, name: string, scope = 'study'): void {
  db.prepare('INSERT INTO folders (id, name, scope) VALUES (?, ?, ?)').run(id, name, scope)
}

function insertTopic(db: Database.Database, id: string, folderId: string, folderName: string): void {
  db.prepare('INSERT INTO topics (id, folder_id, folder_name) VALUES (?, ?, ?)').run(id, folderId, folderName)
}

function getFolderName(db: Database.Database, folderId: string): string | undefined {
  return (db.prepare('SELECT name FROM folders WHERE id = ?').get(folderId) as { name: string } | undefined)?.name
}

function getTopicFolderName(db: Database.Database, topicId: string): string | undefined {
  return (db.prepare('SELECT folder_name FROM topics WHERE id = ?').get(topicId) as { folder_name: string } | undefined)?.folder_name
}

function countRows(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('renameFolder', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createFreshDB()
  })

  it('updates the folder name in the folders table', () => {
    insertFolder(db, 'f-1', 'Old Name')
    renameFolder(db, 'f-1', 'New Name')
    expect(getFolderName(db, 'f-1')).toBe('New Name')
  })

  it('updates folder_name on all topics that belong to the renamed folder', () => {
    insertFolder(db, 'f-1', 'Old Name')
    insertTopic(db, 't-1', 'f-1', 'Old Name')
    insertTopic(db, 't-2', 'f-1', 'Old Name')

    renameFolder(db, 'f-1', 'New Name')

    expect(getTopicFolderName(db, 't-1')).toBe('New Name')
    expect(getTopicFolderName(db, 't-2')).toBe('New Name')
  })

  it('leaves topics in a different folder untouched', () => {
    insertFolder(db, 'f-1', 'Folder One')
    insertFolder(db, 'f-2', 'Folder Two')
    insertTopic(db, 't-1', 'f-1', 'Folder One')
    insertTopic(db, 't-2', 'f-2', 'Folder Two')

    renameFolder(db, 'f-1', 'Folder One Renamed')

    expect(getTopicFolderName(db, 't-2')).toBe('Folder Two')
    expect(getFolderName(db, 'f-2')).toBe('Folder Two')
  })

  it('trims leading and trailing whitespace from the new name', () => {
    insertFolder(db, 'f-1', 'Old Name')
    insertTopic(db, 't-1', 'f-1', 'Old Name')

    renameFolder(db, 'f-1', '  Trimmed Name  ')

    expect(getFolderName(db, 'f-1')).toBe('Trimmed Name')
    expect(getTopicFolderName(db, 't-1')).toBe('Trimmed Name')
  })

  it('is a no-op on topics when the folder has no topics', () => {
    insertFolder(db, 'f-1', 'Empty Folder')

    expect(() => renameFolder(db, 'f-1', 'Still Empty')).not.toThrow()
    expect(getFolderName(db, 'f-1')).toBe('Still Empty')
    expect(countRows(db, 'topics')).toBe(0)
  })

  describe('interaction with resolveOrCreateFolderId', () => {
    it('resolveOrCreateFolderId returns the same folder id after rename (no duplicate created)', () => {
      insertFolder(db, 'f-1', 'Physics')
      insertTopic(db, 't-1', 'f-1', 'Physics')

      renameFolder(db, 'f-1', 'Physics Updated')

      // Resolving by the new name should find the existing folder, not create a new one.
      const resolvedId = resolveOrCreateFolderId(db, 'Physics Updated', null, 'study')
      expect(resolvedId).toBe('f-1')
      expect(countRows(db, 'folders')).toBe(1)
    })

    it('resolving the OLD name after rename creates a new folder (old name is gone)', () => {
      insertFolder(db, 'f-1', 'Physics')
      renameFolder(db, 'f-1', 'Physics Updated')

      // Old name no longer exists — resolve should INSERT a new row.
      const resolvedId = resolveOrCreateFolderId(db, 'Physics', null, 'study')
      expect(resolvedId).not.toBe('f-1')
      expect(countRows(db, 'folders')).toBe(2)
    })
  })
})
