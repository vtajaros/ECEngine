import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let db: initSqlJs.Database | null = null;
let dbPath = '';

export async function initDB() {
  if (db) return;

  const SQL = await initSqlJs();
  const userDataPath = app ? app.getPath('userData') : process.cwd();
  dbPath = path.join(userDataPath, 'ecengine.sqlite');

  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
    
    // Apply migrations for new columns silently if they don't exist
    try { db.run("ALTER TABLE topics ADD COLUMN tags TEXT DEFAULT '[]'"); } catch (e) {}
    try { db.run("ALTER TABLE cards ADD COLUMN tags TEXT DEFAULT '[]'"); } catch (e) {}
    try { db.run("ALTER TABLE topics ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now'))"); } catch (e) {}
    try { db.run("ALTER TABLE cards ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now'))"); } catch (e) {}
    try { db.run("ALTER TABLE cards ADD COLUMN is_custom BOOLEAN DEFAULT 0"); } catch (e) {}
    try { db.run("ALTER TABLE topics ADD COLUMN description TEXT DEFAULT ''"); } catch (e) {}
    try { db.run("ALTER TABLE topics ADD COLUMN parent_id TEXT"); } catch (e) {}
    try { db.run("ALTER TABLE topics ADD COLUMN order_index INTEGER DEFAULT 0"); } catch (e) {}
    try { db.run("ALTER TABLE cards ADD COLUMN difficulty TEXT DEFAULT 'medium'"); } catch (e) {}
    try { db.run("ALTER TABLE topics ADD COLUMN folder_name TEXT DEFAULT 'Uncategorized'"); } catch (e) {}
    runTableMigrations();
    saveDB();
  } else {
    db = new SQL.Database();
    initSchema();
    try { db.run("ALTER TABLE cards ADD COLUMN difficulty TEXT DEFAULT 'medium'"); } catch (e) {}
    try { db.run("ALTER TABLE topics ADD COLUMN folder_name TEXT DEFAULT 'Uncategorized'"); } catch (e) {}
    runTableMigrations();
    saveDB();
  }
}

let saveTimeout: NodeJS.Timeout | null = null;

export function saveDB() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    flushDB();
  }, 1000);
}

export function flushDB() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
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
    db.run(schema);
    saveDB();
  } else {
    console.error('schema.sql not found at', resolvedSchemaPath);
  }
}

function runTableMigrations() {
  if (!db) return;

  try {
    db.run(`
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
    try { db.run("ALTER TABLE progress ADD COLUMN correct_count INTEGER DEFAULT 0"); } catch (e) {}
    try { db.run("ALTER TABLE progress ADD COLUMN total_count INTEGER DEFAULT 0"); } catch (e) {}
  } catch (e) {}

  try {
    db.run(`
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
    
    db.run(`
      CREATE TABLE IF NOT EXISTS study_activity (
        day TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        time_spent INTEGER DEFAULT 0 -- in minutes
      )
    `);
  } catch (e) {}
}

export function queryAll(sql: string, params: any[] = []): any[] {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function queryOne(sql: string, params: any[] = []): any | null {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

export function execute(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  const changes = db.getRowsModified();
  const rowidRows = queryAll('SELECT last_insert_rowid() as id');
  const lastInsertRowid = rowidRows.length > 0 ? (rowidRows[0].id as number) : 0;
  saveDB();
  return { changes, lastInsertRowid };
}


