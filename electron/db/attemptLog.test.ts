// electron/db/attemptLog.test.ts
// Unit tests for logAttempt and localDay.
// Uses an in-memory SQLite DB — never touches ecengine.sqlite.

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { ATTEMPT_LOG_DDL, logAttempt, localDay } from './attemptLog'
import { deleteCardsWithProgress } from './cardHelpers'

// ─── Minimal schema ───────────────────────────────────────────────────────────

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    name TEXT,
    subject TEXT
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    topic_id TEXT REFERENCES topics(id),
    type TEXT DEFAULT 'mcq'
  );

  CREATE TABLE IF NOT EXISTS progress (
    card_id TEXT PRIMARY KEY REFERENCES cards(id)
  );
`

function createFreshDB(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  for (const sql of ATTEMPT_LOG_DDL) {
    db.exec(sql)
  }
  return db
}

function insertTopic(db: Database.Database, id: string, subject = 'Electronics Engineering'): void {
  db.prepare('INSERT OR IGNORE INTO topics (id, name, subject) VALUES (?, ?, ?)').run(id, 'Test Topic', subject)
}

function insertCard(db: Database.Database, id: string, topicId: string): void {
  db.prepare('INSERT INTO cards (id, topic_id, type) VALUES (?, ?, ?)').run(id, topicId, 'mcq')
}

function countAttempts(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) as n FROM attempt_log').get() as { n: number }).n
}

function getAttempt(db: Database.Database, cardId: string): any {
  return db.prepare('SELECT * FROM attempt_log WHERE card_id = ?').get(cardId)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('logAttempt', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createFreshDB()
    insertTopic(db, 'topic-1', 'Electronics Engineering')
    insertCard(db, 'card-1', 'topic-1')
  })

  it('inserts one row with topic_id and subject copied from the card topic; returns true', () => {
    const result = logAttempt(db, { cardId: 'card-1', mode: 'learn', correct: true })
    expect(result).toBe(true)
    expect(countAttempts(db)).toBe(1)

    const row = getAttempt(db, 'card-1')
    expect(row).toBeTruthy()
    expect(row.topic_id).toBe('topic-1')
    expect(row.subject).toBe('Electronics Engineering')
    expect(row.card_type).toBe('mcq')
    expect(row.mode).toBe('learn')
    expect(row.correct).toBe(1)
  })

  it('returns false and inserts 0 rows when card_id does not exist', () => {
    const result = logAttempt(db, { cardId: 'nonexistent-card', mode: 'test', correct: false })
    expect(result).toBe(false)
    expect(countAttempts(db)).toBe(0)
  })

  it('leaves attempt_log rows intact after the card is deleted', () => {
    db.prepare('INSERT INTO progress (card_id) VALUES (?)').run('card-1')
    logAttempt(db, { cardId: 'card-1', mode: 'learn', correct: true })
    expect(countAttempts(db)).toBe(1)

    // deleteCardsWithProgress removes progress then card; attempt_log has no FK so it stays
    deleteCardsWithProgress(db, ['card-1'])

    expect(countAttempts(db)).toBe(1)
    const row = getAttempt(db, 'card-1')
    expect(row.card_id).toBe('card-1')
  })

  describe('response_ms clamping', () => {
    it('stores a valid response_ms', () => {
      logAttempt(db, { cardId: 'card-1', mode: 'learn', correct: true, responseMs: 1500 })
      expect(getAttempt(db, 'card-1').response_ms).toBe(1500)
    })

    it('stores NULL for NaN', () => {
      logAttempt(db, { cardId: 'card-1', mode: 'learn', correct: true, responseMs: NaN })
      expect(getAttempt(db, 'card-1').response_ms).toBeNull()
    })

    it('stores NULL for a negative value', () => {
      logAttempt(db, { cardId: 'card-1', mode: 'learn', correct: true, responseMs: -1 })
      expect(getAttempt(db, 'card-1').response_ms).toBeNull()
    })

    it('stores NULL for a value > 3_600_000', () => {
      logAttempt(db, { cardId: 'card-1', mode: 'learn', correct: true, responseMs: 3_600_001 })
      expect(getAttempt(db, 'card-1').response_ms).toBeNull()
    })

    it('stores NULL when responseMs is undefined', () => {
      logAttempt(db, { cardId: 'card-1', mode: 'learn', correct: true })
      expect(getAttempt(db, 'card-1').response_ms).toBeNull()
    })

    it('stores NULL for a non-integer finite value', () => {
      logAttempt(db, { cardId: 'card-1', mode: 'learn', correct: true, responseMs: 1500.7 })
      expect(getAttempt(db, 'card-1').response_ms).toBeNull()
    })
  })

  describe('correct and quality storage', () => {
    it('stores correct=true as 1', () => {
      logAttempt(db, { cardId: 'card-1', mode: 'learn', correct: true })
      expect(getAttempt(db, 'card-1').correct).toBe(1)
    })

    it('stores correct=false as 0', () => {
      logAttempt(db, { cardId: 'card-1', mode: 'learn', correct: false })
      expect(getAttempt(db, 'card-1').correct).toBe(0)
    })

    it('stores quality when provided', () => {
      logAttempt(db, { cardId: 'card-1', mode: 'flashcard', correct: true, quality: 4 })
      expect(getAttempt(db, 'card-1').quality).toBe(4)
    })

    it('stores NULL quality when not provided', () => {
      logAttempt(db, { cardId: 'card-1', mode: 'learn', correct: true })
      expect(getAttempt(db, 'card-1').quality).toBeNull()
    })
  })
})

describe('localDay', () => {
  it('returns local YYYY-MM-DD — 2026-09-19 at 23:30 local time', () => {
    // new Date(2026, 8, 19, 23, 30) is September 19 2026 in local timezone
    const ms = new Date(2026, 8, 19, 23, 30).getTime()
    expect(localDay(ms)).toBe('2026-09-19')
  })

  it('00:10 on the next local day gives 2026-09-20', () => {
    const ms = new Date(2026, 8, 20, 0, 10).getTime()
    expect(localDay(ms)).toBe('2026-09-20')
  })
})
