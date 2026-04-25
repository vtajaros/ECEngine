// electron/db/database.ts
// SQLite via sql.js — pure JavaScript, no native compilation needed

import initSqlJs, { Database } from 'sql.js'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

let db: Database | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

// Where the .db file lives on disk
const DB_PATH = path.join(app.getPath('userData'), 'ecengine.db')

// sql.js works entirely in memory — we load from file on start,
// and save back to file after every write operation
export async function getDatabase(): Promise<Database> {
  if (db) return db

  const SQL = await initSqlJs({
    // sql.js needs its WASM binary — electron-vite will bundle this
    locateFile: (file: string) =>
      path.join(__dirname, '../../node_modules/sql.js/dist/', file),
  })

  if (fs.existsSync(DB_PATH)) {
    // Load existing database from disk
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
    console.log('[DB] Loaded existing database from', DB_PATH)
  } else {
    // First run — create fresh database
    db = new SQL.Database()
    console.log('[DB] Created new database')
    initSchema(db)
    persistToDisk(db)
  }

  return db
}

// Call this after any INSERT / UPDATE / DELETE
export function persistToDisk(database: Database) {
  // Debounce saves — don't hammer disk on rapid writes
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const data = database.export()
    const buffer = Buffer.from(data)
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    fs.writeFileSync(DB_PATH, buffer)
    console.log('[DB] Saved to disk')
  }, 500)
}

function initSchema(database: Database) {
  database.run(`
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
      card_id       TEXT,
      ease_factor   REAL    DEFAULT 2.5,
      interval      INTEGER DEFAULT 1,
      repetitions   INTEGER DEFAULT 0,
      next_review   TEXT,
      last_reviewed TEXT,
      PRIMARY KEY (card_id)
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

// ── Query helpers ─────────────────────────────────────────

export function queryAll<T = Record<string, unknown>>(
  database: Database,
  sql: string,
  params: unknown[] = []
): T[] {
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

export function queryOne<T = Record<string, unknown>>(
  database: Database,
  sql: string,
  params: unknown[] = []
): T | null {
  const rows = queryAll<T>(database, sql, params)
  return rows[0] ?? null
}

export function execute(
  database: Database,
  sql: string,
  params: unknown[] = []
): void {
  const stmt = database.prepare(sql)
  stmt.run(params)
  stmt.free()
  persistToDisk(database)
}