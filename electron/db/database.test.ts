// electron/db/database.test.ts
// Integration tests for the migration runner.
// Uses better-sqlite3 in-memory mode — never touches ecengine.sqlite.

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'

// ─── Inline the migration definitions ────────────────────────────────────────
// We duplicate just the MIGRATIONS array here so we don't have to boot
// the full Electron environment (which needs app.getPath etc).
// If you add a real migration to database.ts, add it here too.

const MIGRATIONS = [
  {
    version: 1,
    sql: [
      "ALTER TABLE topics ADD COLUMN tags TEXT DEFAULT '[]'",
      "ALTER TABLE cards ADD COLUMN tags TEXT DEFAULT '[]'",
      "ALTER TABLE topics ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now'))",
      "ALTER TABLE cards ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now'))",
      "ALTER TABLE cards ADD COLUMN is_custom BOOLEAN DEFAULT 0",
      "ALTER TABLE topics ADD COLUMN description TEXT DEFAULT ''",
      "ALTER TABLE topics ADD COLUMN parent_id TEXT",
      "ALTER TABLE topics ADD COLUMN order_index INTEGER DEFAULT 0",
      "ALTER TABLE cards ADD COLUMN difficulty TEXT DEFAULT 'medium'",
      "ALTER TABLE topics ADD COLUMN folder_name TEXT DEFAULT 'Uncategorized'",
    ],
  },
  {
    version: 2,
    sql: [
      "ALTER TABLE progress ADD COLUMN correct_count INTEGER DEFAULT 0",
      "ALTER TABLE progress ADD COLUMN total_count INTEGER DEFAULT 0",
      "ALTER TABLE progress ADD COLUMN last_result TEXT",
    ],
  },
  {
    version: 3,
    sql: [
      "ALTER TABLE study_activity ADD COLUMN correct_count INTEGER DEFAULT 0",
      "ALTER TABLE study_activity ADD COLUMN total_count INTEGER DEFAULT 0",
    ],
  },
]

// ─── Minimal baseline schema (what schema.sql creates on fresh install) ───────

const BASELINE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    subject TEXT,
    name TEXT,
    type TEXT DEFAULT 'topic'
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    topic_id TEXT,
    type TEXT,
    data TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS progress (
    card_id TEXT PRIMARY KEY,
    ease_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    next_review TEXT,
    last_reviewed TEXT
  );

  CREATE TABLE IF NOT EXISTS study_activity (
    day TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS exam_sessions (
    id TEXT PRIMARY KEY,
    topic_id TEXT,
    mode TEXT,
    started_at TEXT,
    finished_at TEXT,
    score INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    answers TEXT DEFAULT '{}'
  );
`

// ─── Migration runner (mirrors database.ts logic exactly) ────────────────────

function runMigrations(db: Database.Database) {
  const currentVersion = (db.pragma('user_version', { simple: true }) as number) ?? 0
  const pending = MIGRATIONS.filter(m => m.version > currentVersion)

  for (const migration of pending) {
    const sqls = Array.isArray(migration.sql) ? migration.sql : [migration.sql]
    for (const sql of sqls) {
      try {
        db.exec(sql)
      } catch (e: any) {
        if (e?.message?.includes('duplicate column name')) continue
        console.warn(`[Migration v${migration.version}] Failed: ${sql}\n${e?.message}`)
      }
    }
    db.pragma(`user_version = ${migration.version}`)
  }
}

function getColumns(db: Database.Database, table: string): string[] {
  const rows = db.pragma(`table_info(${table})`) as Array<{ name: string }>
  return rows.map(r => r.name)
}

// ─── Test setup ───────────────────────────────────────────────────────────────

function createFreshDB(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.exec(BASELINE_SCHEMA)
  return db
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Migration Runner', () => {

  describe('version tracking', () => {
    it('starts at user_version 0 before any migrations', () => {
      const db = createFreshDB()
      const version = db.pragma('user_version', { simple: true })
      expect(version).toBe(0)
    })

    it('bumps user_version to the highest migration applied', () => {
      const db = createFreshDB()
      runMigrations(db)
      const version = db.pragma('user_version', { simple: true })
      expect(version).toBe(MIGRATIONS[MIGRATIONS.length - 1].version)
    })

    it('does not re-run migrations on second call', () => {
      const db = createFreshDB()
      runMigrations(db)
      const versionAfterFirst = db.pragma('user_version', { simple: true })

      // Second run — should be a no-op
      runMigrations(db)
      const versionAfterSecond = db.pragma('user_version', { simple: true })

      expect(versionAfterFirst).toBe(versionAfterSecond)
    })
  })

  describe('migration v1 — topics and cards columns', () => {
    it('adds tags column to topics', () => {
      const db = createFreshDB()
      runMigrations(db)
      expect(getColumns(db, 'topics')).toContain('tags')
    })

    it('adds tags column to cards', () => {
      const db = createFreshDB()
      runMigrations(db)
      expect(getColumns(db, 'cards')).toContain('tags')
    })

    it('adds is_custom column to cards', () => {
      const db = createFreshDB()
      runMigrations(db)
      expect(getColumns(db, 'cards')).toContain('is_custom')
    })

    it('adds difficulty column to cards', () => {
      const db = createFreshDB()
      runMigrations(db)
      expect(getColumns(db, 'cards')).toContain('difficulty')
    })

    it('adds folder_name column to topics', () => {
      const db = createFreshDB()
      runMigrations(db)
      expect(getColumns(db, 'topics')).toContain('folder_name')
    })

    it('adds order_index column to topics', () => {
      const db = createFreshDB()
      runMigrations(db)
      expect(getColumns(db, 'topics')).toContain('order_index')
    })
  })

  describe('migration v2 — progress columns', () => {
    it('adds correct_count to progress', () => {
      const db = createFreshDB()
      runMigrations(db)
      expect(getColumns(db, 'progress')).toContain('correct_count')
    })

    it('adds total_count to progress', () => {
      const db = createFreshDB()
      runMigrations(db)
      expect(getColumns(db, 'progress')).toContain('total_count')
    })

    it('adds last_result to progress', () => {
      const db = createFreshDB()
      runMigrations(db)
      expect(getColumns(db, 'progress')).toContain('last_result')
    })
  })

  describe('migration v3 — study_activity columns', () => {
    it('adds correct_count to study_activity', () => {
      const db = createFreshDB()
      runMigrations(db)
      expect(getColumns(db, 'study_activity')).toContain('correct_count')
    })

    it('adds total_count to study_activity', () => {
      const db = createFreshDB()
      runMigrations(db)
      expect(getColumns(db, 'study_activity')).toContain('total_count')
    })
  })

  describe('idempotency — duplicate column guard', () => {
    it('does not crash when columns already exist (legacy upgrade path)', () => {
      const db = createFreshDB()

      // Pre-apply some columns manually to simulate the old migration system
      db.exec("ALTER TABLE topics ADD COLUMN tags TEXT DEFAULT '[]'")
      db.exec("ALTER TABLE cards ADD COLUMN tags TEXT DEFAULT '[]'")

      // Should not throw — duplicate column name is caught and skipped
      expect(() => runMigrations(db)).not.toThrow()
    })

    it('still applies remaining columns even when some already exist', () => {
      const db = createFreshDB()

      // Pre-apply first column only
      db.exec("ALTER TABLE topics ADD COLUMN tags TEXT DEFAULT '[]'")

      runMigrations(db)

      // The rest of v1 should still have been applied
      expect(getColumns(db, 'cards')).toContain('is_custom')
      expect(getColumns(db, 'topics')).toContain('folder_name')
    })
  })

  describe('data integrity across migrations', () => {
    it('existing rows survive migration with correct defaults', () => {
      const db = createFreshDB()

      // Insert a card before migrations run
      db.prepare("INSERT INTO cards (id, topic_id, type, data) VALUES (?, ?, ?, ?)").run(
        'card-before-migration', 'topic-1', 'mcq', '{}'
      )

      runMigrations(db)

      const card = db.prepare('SELECT * FROM cards WHERE id = ?').get('card-before-migration') as any
      expect(card).toBeTruthy()
      expect(card.is_custom).toBe(0)
      expect(card.difficulty).toBe('medium')
    })

    it('existing progress rows survive migration', () => {
      const db = createFreshDB()

      db.prepare("INSERT INTO progress (card_id) VALUES (?)").run('card-1')

      runMigrations(db)

      const row = db.prepare('SELECT * FROM progress WHERE card_id = ?').get('card-1') as any
      expect(row).toBeTruthy()
      expect(row.correct_count).toBe(0)
      expect(row.total_count).toBe(0)
    })
  })

})
