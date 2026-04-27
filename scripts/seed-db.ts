import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { v4 as uuidv4 } from 'uuid'

let userDataPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ECEngine')
if (process.platform === 'darwin') {
  userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'ECEngine')
} else if (process.platform === 'linux') {
  userDataPath = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'ECEngine')
}

const dbPath = path.join(userDataPath, 'ecengine.db')

fs.mkdirSync(userDataPath, { recursive: true })

const db = new Database(dbPath)

try {
  console.log(`Connecting to DB: ${dbPath}`)

  db.exec(`
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
  `) // Ensuring tables are there if we seed before running app.

  const contentPath = path.join(__dirname, '../content/electronics/semiconductor-devices.json')
  const rawData = fs.readFileSync(contentPath, 'utf8')
  const seedData = JSON.parse(rawData)

  console.log(`Loaded JSON: ${seedData.topic} - ${seedData.subject}`)

  // 1. Insert Topic
  const topicId = 'topic-electronics-semiconductor'
  
  db.prepare(`
    INSERT INTO topics (id, name, subject, order_index)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, subject = excluded.subject
  `).run(topicId, seedData.topic, seedData.subject, 1)

  // 2. Prepare statements for Cards
  const insertCard = db.prepare(`
    INSERT INTO cards (id, topic_id, type, data, difficulty, tags)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      data = excluded.data, 
      difficulty = excluded.difficulty, 
      tags = excluded.tags
  `)

  let cardCount = 0

  // 3. Insert Flashcards
  if (seedData.flashcards) {
    for (const fc of seedData.flashcards) {
      insertCard.run(
        fc.id,
        topicId,
        'flashcard',
        JSON.stringify({ front: fc.front, back: fc.back }),
        fc.difficulty || 'medium',
        JSON.stringify(fc.tags || [])
      )
      cardCount++
    }
  }

  // 4. Insert MCQs
  if (seedData.mcqs) {
    for (const mcq of seedData.mcqs) {
      insertCard.run(
        mcq.id,
        topicId,
        'mcq',
        JSON.stringify({ 
          question: mcq.question, 
          choices: mcq.choices, 
          answer: mcq.answer,
          explanation: mcq.explanation
        }),
        mcq.difficulty || 'medium',
        JSON.stringify(mcq.tags || [])
      )
      cardCount++
    }
  }

  // 5. Insert Formulas
  if (seedData.formulas) {
    for (const formula of seedData.formulas) {
      insertCard.run(
        formula.id,
        topicId,
        'formula',
        JSON.stringify({
          name: formula.name,
          latex: formula.latex,
          variables: formula.variables
        }),
        'medium', // Formulas don't typically have explicit diff in this structure, using medium
        JSON.stringify(formula.tags || [])
      )
      cardCount++
    }
  }

  console.log(`[Success] Seeded ${cardCount} cards into the Database under topic "${seedData.topic}".`)

} catch (err) {
  console.error('[Error] Seeding failed', err)
} finally {
  db.close()
}
