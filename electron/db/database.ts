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
    saveDB();
  } else {
    db = new SQL.Database();
    initSchema();
  }
}

let saveTimeout: NodeJS.Timeout | null = null;

export function saveDB() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    saveTimeout = null;
  }, 1000);
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

export function execute(sql: string, params: any[] = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  saveDB();
}


