import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

let db: ReturnType<typeof Database> | null = null

export function getDatabase() {
  if (db) return db

  const DB_PATH = path.join(app.getPath('userData'), 'ecengine.db')

  // Ensure directory exists
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  initSchema(db)

  return db
}

function initSchema(database: ReturnType<typeof Database>) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      subject     TEXT NOT NULL,
      parent_id   TEXT REFERENCES topics(id),
      order_index INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cards (
      id         TEXT PRIMARY KEY,
      topic_id   TEXT REFERENCES topics(id),
      type       TEXT CHECK(type IN ('flashcard','mcq','formula','concept')),
      data       TEXT NOT NULL,
      difficulty TEXT DEFAULT 'medium',
      tags       TEXT DEFAULT '[]',
      is_custom  INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS progress (
      card_id       TEXT PRIMARY KEY,
      ease_factor   REAL    DEFAULT 2.5,
      interval      INTEGER DEFAULT 1,
      repetitions   INTEGER DEFAULT 0,
      next_review   TEXT,
      last_reviewed TEXT
    );

    CREATE TABLE IF NOT EXISTS exam_sessions (
      id          TEXT PRIMARY KEY,
      topic_id    TEXT,
      mode        TEXT DEFAULT 'practice',
      started_at  TEXT,
      finished_at TEXT,
      score       INTEGER DEFAULT 0,
      total       INTEGER DEFAULT 0,
      answers     TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_cards_topic ON cards(topic_id);
    CREATE INDEX IF NOT EXISTS idx_cards_type  ON cards(type);
    CREATE INDEX IF NOT EXISTS idx_progress_next_review ON progress(next_review);
  `)
}

export function query(sql: string, params: unknown[] = []): unknown[] {
  const database = getDatabase()
  const stmt = database.prepare(sql)
  return stmt.all(...params)
}

export function run(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number | bigint } {
  const database = getDatabase()
  const stmt = database.prepare(sql)
  const result = stmt.run(...params)
  return {
    changes: result.changes,
    lastInsertRowid: result.lastInsertRowid
  }
}
