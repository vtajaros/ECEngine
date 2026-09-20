// electron/db/importHelpers.test.ts
// Unit tests for upsertImportedTopic.
// Uses better-sqlite3 in-memory mode — never touches ecengine.sqlite.

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { upsertImportedTopic, type ImportedTopicRow } from './importHelpers'

// ─── Minimal schema matching the live tables ──────────────────────────────────
// Includes is_favorite (added in a migration) and the columns written by
// upsertImportedTopic. folder_id FK is omitted here to keep the fixture simple
// (targetFolderId is allowed to be null).

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS topics (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    subject     TEXT    NOT NULL DEFAULT '',
    created_at  INTEGER,
    description TEXT    DEFAULT '',
    folder_name TEXT    DEFAULT 'Uncategorized',
    folder_id   TEXT,
    tags        TEXT    DEFAULT '[]',
    order_index INTEGER,
    is_favorite INTEGER DEFAULT 0
  );
`

function createFreshDB(): Database.Database {
  const db = new Database(':memory:')
  db.exec(SCHEMA)
  return db
}

function getTopic(db: Database.Database, id: string): Record<string, unknown> | undefined {
  return db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

// ─── Minimal valid row used as a base in every test ──────────────────────────

const BASE: ImportedTopicRow = {
  id: 'topic-1',
  name: 'Test Deck',
  subject: 'ELECS',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('upsertImportedTopic', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createFreshDB()
  })

  describe('is_favorite mapping', () => {
    it('writes 1 when is_favorite is the number 1', () => {
      upsertImportedTopic(db, { ...BASE, is_favorite: 1 }, null)
      expect(getTopic(db, BASE.id)?.is_favorite).toBe(1)
    })

    it('writes 1 when is_favorite is boolean true', () => {
      upsertImportedTopic(db, { ...BASE, is_favorite: true }, null)
      expect(getTopic(db, BASE.id)?.is_favorite).toBe(1)
    })

    it('writes 0 when is_favorite is omitted', () => {
      upsertImportedTopic(db, { ...BASE }, null)
      expect(getTopic(db, BASE.id)?.is_favorite).toBe(0)
    })

    it('writes 0 when is_favorite is null', () => {
      upsertImportedTopic(db, { ...BASE, is_favorite: null }, null)
      expect(getTopic(db, BASE.id)?.is_favorite).toBe(0)
    })

    it('writes 0 when is_favorite is the number 0', () => {
      upsertImportedTopic(db, { ...BASE, is_favorite: 0 }, null)
      expect(getTopic(db, BASE.id)?.is_favorite).toBe(0)
    })
  })

  describe('REPLACE behaviour', () => {
    it('updates is_favorite on a second call with the same id', () => {
      upsertImportedTopic(db, { ...BASE, is_favorite: 0 }, null)
      upsertImportedTopic(db, { ...BASE, is_favorite: 1 }, null)
      expect(getTopic(db, BASE.id)?.is_favorite).toBe(1)
    })

    it('still only produces one row after two upserts with the same id', () => {
      upsertImportedTopic(db, { ...BASE }, null)
      upsertImportedTopic(db, { ...BASE }, null)
      const count = (db.prepare('SELECT COUNT(*) as n FROM topics').get() as { n: number }).n
      expect(count).toBe(1)
    })
  })

  describe('column defaults', () => {
    it('defaults description to empty string when omitted', () => {
      upsertImportedTopic(db, { ...BASE }, null)
      expect(getTopic(db, BASE.id)?.description).toBe('')
    })

    it('defaults tags to "[]" when omitted', () => {
      upsertImportedTopic(db, { ...BASE }, null)
      expect(getTopic(db, BASE.id)?.tags).toBe('[]')
    })

    it('defaults folder_name to "Uncategorized" when omitted', () => {
      upsertImportedTopic(db, { ...BASE }, null)
      expect(getTopic(db, BASE.id)?.folder_name).toBe('Uncategorized')
    })

    it('writes targetFolderId as folder_id', () => {
      upsertImportedTopic(db, { ...BASE }, 'folder-abc')
      expect(getTopic(db, BASE.id)?.folder_id).toBe('folder-abc')
    })

    it('accepts null targetFolderId', () => {
      upsertImportedTopic(db, { ...BASE }, null)
      expect(getTopic(db, BASE.id)?.folder_id).toBeNull()
    })
  })
})
