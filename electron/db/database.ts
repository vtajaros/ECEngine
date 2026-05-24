import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export function initDB() {
  if (db) return;

  const userDataPath = app ? app.getPath('userData') : process.cwd();
  const dbPath = path.join(userDataPath, 'ecengine.sqlite');
  const dbExists = fs.existsSync(dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  if (dbExists) {
    // Apply migrations for new columns silently if they don't exist
    try { db.exec("ALTER TABLE topics ADD COLUMN tags TEXT DEFAULT '[]'"); } catch (e) {}
    try { db.exec("ALTER TABLE cards ADD COLUMN tags TEXT DEFAULT '[]'"); } catch (e) {}
    try { db.exec("ALTER TABLE topics ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now'))"); } catch (e) {}
    try { db.exec("ALTER TABLE cards ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now'))"); } catch (e) {}
    try { db.exec("ALTER TABLE cards ADD COLUMN is_custom BOOLEAN DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE topics ADD COLUMN description TEXT DEFAULT ''"); } catch (e) {}
    try { db.exec("ALTER TABLE topics ADD COLUMN parent_id TEXT"); } catch (e) {}
    try { db.exec("ALTER TABLE topics ADD COLUMN order_index INTEGER DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE cards ADD COLUMN difficulty TEXT DEFAULT 'medium'"); } catch (e) {}
    try { db.exec("ALTER TABLE topics ADD COLUMN folder_name TEXT DEFAULT 'Uncategorized'"); } catch (e) {}
    runTableMigrations();
  } else {
    initSchema();
    try { db.exec("ALTER TABLE cards ADD COLUMN difficulty TEXT DEFAULT 'medium'"); } catch (e) {}
    try { db.exec("ALTER TABLE topics ADD COLUMN folder_name TEXT DEFAULT 'Uncategorized'"); } catch (e) {}
    runTableMigrations();
  }
}

export function saveDB() {
  // No-op for better-sqlite3 as writes are written directly to disk
}

export function flushDB() {
  // No-op for better-sqlite3 as writes are written directly to disk
}

function initSchema() {
  if (!db) return;
  const schemaPath = path.join(__dirname, 'schema.sql');
  // Handle paths depending on running from electron app vs script
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

function runTableMigrations() {
  if (!db) return;

  try {
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
    // Migration for existing progress table
    try { db.exec("ALTER TABLE progress ADD COLUMN correct_count INTEGER DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE progress ADD COLUMN total_count INTEGER DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE progress ADD COLUMN last_result TEXT"); } catch (e) {}
  } catch (e) {}

  try {
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
        time_spent INTEGER DEFAULT 0, -- in minutes
        correct_count INTEGER DEFAULT 0,
        total_count INTEGER DEFAULT 0
      )
    `);
    try { db.exec("ALTER TABLE study_activity ADD COLUMN correct_count INTEGER DEFAULT 0"); } catch (e) {}
    try { db.exec("ALTER TABLE study_activity ADD COLUMN total_count INTEGER DEFAULT 0"); } catch (e) {}
  } catch (e) {}

  // Apply performance optimization indexes
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_next_review ON progress(next_review)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_last_reviewed ON progress(last_reviewed)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_cards_topic_id ON cards(topic_id)");
  } catch (e) {
    console.error("Failed to create performance indexes", e);
  }
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
    lastInsertRowid: Number(result.lastInsertRowid)
  };
}
