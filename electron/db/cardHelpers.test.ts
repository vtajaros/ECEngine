// electron/db/cardHelpers.test.ts
// Unit tests for deleteCardsWithProgress.
// Uses better-sqlite3 in-memory mode — never touches ecengine.sqlite.

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { deleteCardsWithProgress } from './cardHelpers'

// ─── Minimal schema ───────────────────────────────────────────────────────────

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    topic_id TEXT REFERENCES topics(id)
  );

  CREATE TABLE IF NOT EXISTS progress (
    card_id TEXT PRIMARY KEY REFERENCES cards(id)
  );
`

function createFreshDB(): Database.Database {
  const db = new Database(':memory:')
  db.exec(SCHEMA)
  return db
}

function insertTopic(db: Database.Database, id: string): void {
  db.prepare('INSERT INTO topics (id, name) VALUES (?, ?)').run(id, 'Test Topic')
}

function insertCard(db: Database.Database, id: string, topicId: string): void {
  db.prepare('INSERT INTO cards (id, topic_id) VALUES (?, ?)').run(id, topicId)
}

function insertProgress(db: Database.Database, cardId: string): void {
  db.prepare('INSERT INTO progress (card_id) VALUES (?)').run(cardId)
}

function countRows(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('deleteCardsWithProgress', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createFreshDB()
    insertTopic(db, 'topic-1')
  })

  it('confirms the test schema really enforces the FK (control)', () => {
    insertCard(db, 'card-1', 'topic-1'); insertProgress(db, 'card-1')
    expect(() => db.prepare('DELETE FROM cards WHERE id = ?').run('card-1')).toThrow(/FOREIGN KEY/)
  })

  it('is a no-op when cardIds is empty', () => {
    insertCard(db, 'card-1', 'topic-1')
    insertProgress(db, 'card-1')

    deleteCardsWithProgress(db, [])

    expect(countRows(db, 'cards')).toBe(1)
    expect(countRows(db, 'progress')).toBe(1)
  })

  it('deletes progress before the card (avoids FK constraint)', () => {
    insertCard(db, 'card-1', 'topic-1')
    insertProgress(db, 'card-1')

    // Without progress-first deletion this would throw FOREIGN KEY constraint failed
    expect(() => deleteCardsWithProgress(db, ['card-1'])).not.toThrow()

    expect(countRows(db, 'cards')).toBe(0)
    expect(countRows(db, 'progress')).toBe(0)
  })

  it('deletes multiple cards and all their progress rows', () => {
    insertCard(db, 'card-1', 'topic-1')
    insertCard(db, 'card-2', 'topic-1')
    insertCard(db, 'card-3', 'topic-1')
    insertProgress(db, 'card-1')
    insertProgress(db, 'card-3')

    deleteCardsWithProgress(db, ['card-1', 'card-2', 'card-3'])

    expect(countRows(db, 'cards')).toBe(0)
    expect(countRows(db, 'progress')).toBe(0)
  })

  it('only deletes the specified cards, leaving others intact', () => {
    insertCard(db, 'card-1', 'topic-1')
    insertCard(db, 'card-2', 'topic-1')
    insertProgress(db, 'card-1')
    insertProgress(db, 'card-2')

    deleteCardsWithProgress(db, ['card-1'])

    expect(countRows(db, 'cards')).toBe(1)
    expect(countRows(db, 'progress')).toBe(1)

    const remaining = db.prepare('SELECT id FROM cards').get() as { id: string }
    expect(remaining.id).toBe('card-2')
  })

  it('does not throw for a card id that does not exist', () => {
    expect(() => deleteCardsWithProgress(db, ['nonexistent-id'])).not.toThrow()
  })
})
