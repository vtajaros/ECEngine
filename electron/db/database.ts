import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

// ---------------------------------------------------------------------------
// Migration definitions
// ---------------------------------------------------------------------------

/**
 * MIGRATION CONTRACT:
 * - Each migration runs exactly once, tracked via PRAGMA user_version.
 * - Migrations are additive only (ADD COLUMN, CREATE TABLE, CREATE INDEX).
 * - For destructive changes: create a new migration that copies data,
 *   drops the old structure, and renames — never alter existing migrations.
 * - Never remove or renumber a migration that has shipped.
 * - Current schema version is readable via: db.pragma('user_version')
 */
const MIGRATIONS: Array<{ version: number; sql: string | string[] }> = [
  {
    // Columns added when the app grew beyond its initial schema.
    // These are all safe to re-attempt: duplicate column errors are caught below.
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
    // Progress tracking: per-card correct/total counts and last result.
    version: 2,
    sql: [
      "ALTER TABLE progress ADD COLUMN correct_count INTEGER DEFAULT 0",
      "ALTER TABLE progress ADD COLUMN total_count INTEGER DEFAULT 0",
      "ALTER TABLE progress ADD COLUMN last_result TEXT",
    ],
  },
  {
    // Study activity accuracy columns (added after initial study_activity table).
    version: 3,
    sql: [
      "ALTER TABLE study_activity ADD COLUMN correct_count INTEGER DEFAULT 0",
      "ALTER TABLE study_activity ADD COLUMN total_count INTEGER DEFAULT 0",
    ],
  },
  // Add future migrations here as { version: N, sql: [...] }
]

/**
 * Bootstrap tables that must always exist before migrations run.
 * Uses IF NOT EXISTS so it is unconditionally safe to call on every startup.
 * This covers tables that were originally created inline in runTableMigrations()
 * and are therefore not guaranteed to be in schema.sql for existing users.
 */
function ensureBootstrapTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress (
      card_id TEXT PRIMARY KEY,
      ease_factor REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 1,
      repetitions INTEGER DEFAULT 0,
      next_review TEXT,
      last_reviewed TEXT,
      correct_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS exam_sessions (
      id TEXT PRIMARY KEY,
      topic_id TEXT,
      mode TEXT,
      started_at TEXT,
      finished_at TEXT,
      score INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      answers TEXT DEFAULT '{}'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS study_activity (
      day TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0,
      time_spent INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0
    )
  `);

  // Performance indexes — IF NOT EXISTS is idempotent
  db.exec("CREATE INDEX IF NOT EXISTS idx_next_review ON progress(next_review)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_last_reviewed ON progress(last_reviewed)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_cards_topic_id ON cards(topic_id)");
}

/**
 * Versioned migration runner. Reads PRAGMA user_version to determine
 * which migrations have already been applied and only runs pending ones.
 * On completion of each migration, user_version is bumped so the migration
 * never runs again — even across restarts.
 */
function runMigrations(db: Database.Database) {
  const currentVersion = (db.pragma('user_version', { simple: true }) as number) ?? 0;

  const pending = MIGRATIONS.filter(m => m.version > currentVersion);
  if (pending.length === 0) return;

  for (const migration of pending) {
    const sqls = Array.isArray(migration.sql) ? migration.sql : [migration.sql];
    for (const sql of sqls) {
      try {
        db.exec(sql);
      } catch (e: any) {
        // ADD COLUMN throws "duplicate column name" when the column already exists.
        // This is expected for users upgrading from the old try/catch migration system
        // where columns may already have been applied on a previous launch.
        if (e?.message?.includes('duplicate column name')) continue;
        // Any other error is unexpected — log it but don't crash the app.
        console.warn(`[Migration v${migration.version}] Failed: ${sql}\n${e?.message}`);
      }
    }
    db.pragma(`user_version = ${migration.version}`);
    console.log(`[DB] Migration applied: v${migration.version}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initDB() {
  if (db) return;

  const userDataPath = app ? app.getPath('userData') : process.cwd();
  const dbPath = path.join(userDataPath, 'ecengine.sqlite');
  const dbExists = fs.existsSync(dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  if (!dbExists) {
    // Fresh install — load the full baseline schema first.
    initSchema();
  }

  // Ensure all expected tables exist (safe for both fresh and existing DBs).
  ensureBootstrapTables(db);

  // Apply any pending versioned migrations.
  runMigrations(db);
}

export function saveDB() {
  // No-op for better-sqlite3 — writes go directly to disk.
}

export function flushDB() {
  // No-op for better-sqlite3 — writes go directly to disk.
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function initSchema() {
  if (!db) return;
  const schemaPath = path.join(__dirname, 'schema.sql');
  // Handle paths depending on whether we're running from the packaged app or a script.
  const resolvedSchemaPath = fs.existsSync(schemaPath)
    ? schemaPath
    : path.join(process.cwd(), 'electron/db/schema.sql');

  if (fs.existsSync(resolvedSchemaPath)) {
    const schema = fs.readFileSync(resolvedSchemaPath, 'utf8');
    db.exec(schema);
  } else {
    console.error('schema.sql not found at', resolvedSchemaPath);
  }
}

export function getDB(): Database.Database {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export function queryAll(sql: string, params: any[] = []): any[] {
  if (!db) throw new Error('DB not initialized');
  return db.prepare(sql).all(params);
}

export function queryOne(sql: string, params: any[] = []): any | null {
  if (!db) throw new Error('DB not initialized');
  const result = db.prepare(sql).get(params);
  return result !== undefined ? result : null;
}

export function execute(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
  if (!db) throw new Error('DB not initialized');
  const result = db.prepare(sql).run(params);
  return {
    changes: result.changes,
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}
