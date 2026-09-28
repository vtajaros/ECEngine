import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import {
  normalizeSubject,
  getContentCoverage,
  getTosCoverageMatrix,
  getCardsByTosTopic,
  getQuestionLengthDistribution,
  getAnswerPositionCounts,
  getAnswerPositionBySubject,
  getResponseTimeDistribution,
  registerAnalyticsHandlers,
} from './analytics.ipc'

// Mock electron ipcMain
const handlers = new Map<string, (...args: any[]) => Promise<any>>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, listener: (...args: any[]) => Promise<any>) => {
      handlers.set(channel, listener)
    }),
  },
}))

let db: Database.Database

vi.mock('../db/database', () => ({
  queryAll: (sql: string, params: any[] = []) => {
    return db.prepare(sql).all(params)
  },
}))

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    name TEXT,
    subject TEXT
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    topic_id TEXT,
    type TEXT,
    data TEXT DEFAULT '{}',
    difficulty TEXT,
    tags TEXT,
    tos_topic_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS attempt_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    day TEXT NOT NULL,
    card_id TEXT NOT NULL,
    topic_id TEXT,
    subject TEXT,
    card_type TEXT,
    mode TEXT NOT NULL,
    correct INTEGER NOT NULL,
    quality INTEGER,
    response_ms INTEGER
  );
`

function seedTestData(database: Database.Database): void {
  // Topics: 2 subjects with multiple topics (full name and short code) + 1 empty subject
  database.prepare('INSERT INTO topics (id, name, subject) VALUES (?, ?, ?)').run(
    't-math-1', 'Calculus I', 'Mathematics'
  )
  database.prepare('INSERT INTO topics (id, name, subject) VALUES (?, ?, ?)').run(
    't-math-2', 'Algebra', 'MATH'
  )
  database.prepare('INSERT INTO topics (id, name, subject) VALUES (?, ?, ?)').run(
    't-geas-1', 'Thermodynamics', 'General Engineering & Applied Sciences'
  )
  database.prepare('INSERT INTO topics (id, name, subject) VALUES (?, ?, ?)').run(
    't-geas-2', 'Physics', 'GEAS'
  )
  database.prepare('INSERT INTO topics (id, name, subject) VALUES (?, ?, ?)').run(
    't-elecs-1', 'Circuits', 'Electronics Engineering'
  )

  const insertCard = database.prepare(
    'INSERT INTO cards (id, topic_id, type, data) VALUES (?, ?, ?, ?)'
  )

  // MATH cards
  insertCard.run('c1', 't-math-1', 'mcq', JSON.stringify({
    question: 'What is 1+1?', // length 12
    choices: ['1', '2', '3', '4'],
    answer: 1,
  }))
  insertCard.run('c2', 't-math-2', 'mcq', JSON.stringify({
    question: 'Solve x+2=4', // length 11
    choices: ['1', '2', '3', '4'],
    answer: 1,
  }))

  // GEAS cards
  insertCard.run('c3', 't-geas-1', 'mcq', JSON.stringify({
    question: 'What is force?', // length 14
    choices: ['A', 'B', 'C', 'D'],
    answer: 0,
  }))
  insertCard.run('c4', 't-geas-1', 'flashcard', JSON.stringify({
    front: 'F=ma',
    back: 'Newton second law',
  }))
  insertCard.run('c5', 't-geas-2', 'mcq', JSON.stringify({
    question: 'Efficiency of Carnot engine?', // length 28
    choices: ['A', 'B', 'C', 'D'],
    answer: 2,
  }))
  insertCard.run('c6', 't-geas-2', 'mcq', JSON.stringify({
    question: 'Entropy of closed system?', // length 25
    choices: ['A', 'B', 'C', 'D'],
    answer: 3,
  }))
  insertCard.run('c7', 't-geas-2', 'mcq', JSON.stringify({
    question: 'Question with answer 4', // length 22
    choices: ['A', 'B', 'C', 'D'],
    answer: 4, // out-of-range answer
  }))
  insertCard.run('c8', 't-geas-2', 'mcq', JSON.stringify({
    question: 'Question with null answer', // length 25
    choices: ['A', 'B', 'C', 'D'],
    answer: null, // null answer
  }))
}

describe('analytics.ipc', () => {
  beforeEach(() => {
    db = new Database(':memory:')
    db.exec(SCHEMA)
    seedTestData(db)
    handlers.clear()
    registerAnalyticsHandlers()
  })

  describe('normalizeSubject', () => {
    it('normalizes full subject names to codes using FULL_TO_CODE_SUBJECT', () => {
      expect(normalizeSubject('Mathematics')).toBe('MATH')
      expect(normalizeSubject('General Engineering & Applied Sciences')).toBe('GEAS')
      expect(normalizeSubject('Electronics Engineering')).toBe('ELECS')
      expect(normalizeSubject('Electronics Systems & Technologies')).toBe('EST')
    })

    it('passes through existing subject codes or custom names', () => {
      expect(normalizeSubject('MATH')).toBe('MATH')
      expect(normalizeSubject('GEAS')).toBe('GEAS')
      expect(normalizeSubject('ELECS')).toBe('ELECS')
      expect(normalizeSubject('EST')).toBe('EST')
      expect(normalizeSubject('CUSTOM')).toBe('CUSTOM')
    })

    it('handles null/undefined safely', () => {
      expect(normalizeSubject(null)).toBe('UNKNOWN')
      expect(normalizeSubject(undefined)).toBe('UNKNOWN')
      expect(normalizeSubject('')).toBe('UNKNOWN')
    })
  })

  describe('getContentCoverage', () => {
    it('returns correct topic and card counts aggregated by normalized subject code', () => {
      const coverage = getContentCoverage((sql, params) => db.prepare(sql).all(params ?? []))

      // MATH has 2 topics (t-math-1, t-math-2) and 2 cards (c1, c2)
      expect(coverage.MATH).toEqual({ topics: 2, cards: 2 })

      // GEAS has 2 topics (t-geas-1, t-geas-2) and 6 cards (c3, c4 flashcard, c5, c6, c7, c8)
      expect(coverage.GEAS).toEqual({ topics: 2, cards: 6 })

      // ELECS has 1 topic with 0 cards (verifying LEFT JOIN)
      expect(coverage.ELECS).toEqual({ topics: 1, cards: 0 })

      // EST has 0 topics and 0 cards
      expect(coverage.EST).toEqual({ topics: 0, cards: 0 })
    })

    it('invokes through IPC handler data:getContentCoverage successfully', async () => {
      const handler = handlers.get('data:getContentCoverage')
      expect(handler).toBeDefined()
      const result = await handler!()
      expect(result.success).toBe(true)
      expect(result.data.MATH).toEqual({ topics: 2, cards: 2 })
      expect(result.data.GEAS).toEqual({ topics: 2, cards: 6 })
      expect(result.data.ELECS).toEqual({ topics: 1, cards: 0 })
      expect(result.data.EST).toEqual({ topics: 0, cards: 0 })
    })
  })

  describe('getQuestionLengthDistribution', () => {
    it('returns raw array of { subject, qlen } for MCQ cards only without question text', () => {
      const dist = getQuestionLengthDistribution((sql, params) => db.prepare(sql).all(params ?? []))

      // 7 MCQ cards (c4 flashcard excluded)
      expect(dist).toHaveLength(7)

      // Verify no question text leak
      for (const item of dist) {
        expect(item).toHaveProperty('subject')
        expect(item).toHaveProperty('qlen')
        expect(item).not.toHaveProperty('question')
        expect(item).not.toHaveProperty('data')
        expect(typeof item.qlen).toBe('number')
      }

      // Check specific expected lengths
      expect(dist).toContainEqual({ subject: 'MATH', qlen: 12 }) // c1
      expect(dist).toContainEqual({ subject: 'MATH', qlen: 11 }) // c2
      expect(dist).toContainEqual({ subject: 'GEAS', qlen: 14 }) // c3
      expect(dist).toContainEqual({ subject: 'GEAS', qlen: 28 }) // c5
      expect(dist).toContainEqual({ subject: 'GEAS', qlen: 25 }) // c6
      expect(dist).toContainEqual({ subject: 'GEAS', qlen: 22 }) // c7
      expect(dist).toContainEqual({ subject: 'GEAS', qlen: 25 }) // c8
    })

    it('invokes through IPC handler data:getQuestionLengthDistribution successfully', async () => {
      const handler = handlers.get('data:getQuestionLengthDistribution')
      expect(handler).toBeDefined()
      const result = await handler!()
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(7)
      expect(result.data[0]).toHaveProperty('subject')
      expect(result.data[0]).toHaveProperty('qlen')
    })
  })

  describe('getAnswerPositionCounts', () => {
    it('returns correct counts for positions 0-3 and groups out-of-range/null answers under position: null', () => {
      const counts = getAnswerPositionCounts((sql, params) => db.prepare(sql).all(params ?? []))

      // Base positions 0-3
      expect(counts.find(c => c.position === 0)).toEqual({ position: 0, count: 1 }) // c3
      expect(counts.find(c => c.position === 1)).toEqual({ position: 1, count: 2 }) // c1, c2
      expect(counts.find(c => c.position === 2)).toEqual({ position: 2, count: 1 }) // c5
      expect(counts.find(c => c.position === 3)).toEqual({ position: 3, count: 1 }) // c6

      // Data-quality signal: c7 (answer=4) and c8 (answer=null) placed under position: null
      const nullBucket = counts.find(c => c.position === null)
      expect(nullBucket).toEqual({ position: null, count: 2 })
    })

    it('invokes through IPC handler data:getAnswerPositionCounts successfully', async () => {
      const handler = handlers.get('data:getAnswerPositionCounts')
      expect(handler).toBeDefined()
      const result = await handler!()
      expect(result.success).toBe(true)
      expect(result.data).toEqual([
        { position: 0, count: 1 },
        { position: 1, count: 2 },
        { position: 2, count: 1 },
        { position: 3, count: 1 },
        { position: null, count: 2 },
      ])
    })
  })

  describe('getAnswerPositionBySubject', () => {
    it('returns per-subject counts for positions 0-3 and groups out-of-range/null answers under position: null', () => {
      const rows = getAnswerPositionBySubject((sql, params) => db.prepare(sql).all(params ?? []))

      // Check MATH subject
      expect(rows.find(r => r.subject === 'MATH' && r.position === 0)).toEqual({ subject: 'MATH', position: 0, count: 0 })
      expect(rows.find(r => r.subject === 'MATH' && r.position === 1)).toEqual({ subject: 'MATH', position: 1, count: 2 })
      expect(rows.find(r => r.subject === 'MATH' && r.position === 2)).toEqual({ subject: 'MATH', position: 2, count: 0 })
      expect(rows.find(r => r.subject === 'MATH' && r.position === 3)).toEqual({ subject: 'MATH', position: 3, count: 0 })

      // Check GEAS subject (has c3 pos 0, c5 pos 2, c6 pos 3, plus c7 pos 4 and c8 pos null)
      expect(rows.find(r => r.subject === 'GEAS' && r.position === 0)).toEqual({ subject: 'GEAS', position: 0, count: 1 })
      expect(rows.find(r => r.subject === 'GEAS' && r.position === 1)).toEqual({ subject: 'GEAS', position: 1, count: 0 })
      expect(rows.find(r => r.subject === 'GEAS' && r.position === 2)).toEqual({ subject: 'GEAS', position: 2, count: 1 })
      expect(rows.find(r => r.subject === 'GEAS' && r.position === 3)).toEqual({ subject: 'GEAS', position: 3, count: 1 })
      expect(rows.find(r => r.subject === 'GEAS' && r.position === null)).toEqual({ subject: 'GEAS', position: null, count: 2 })
    })

    it('surfaces newly inserted anomalous/out-of-range positions under null bucket rather than dropping', () => {
      // Insert an ELECS card with out-of-range answer (99)
      db.prepare('INSERT INTO cards (id, topic_id, type, data) VALUES (?, ?, ?, ?)').run(
        'c-anom-elecs',
        't-elecs-1',
        'mcq',
        JSON.stringify({ question: 'Odd choice card', choices: ['A', 'B'], answer: 99 })
      )

      const rows = getAnswerPositionBySubject((sql, params) => db.prepare(sql).all(params ?? []))
      const elecsNull = rows.find(r => r.subject === 'ELECS' && r.position === null)
      expect(elecsNull).toEqual({ subject: 'ELECS', position: null, count: 1 })
    })

    it('invokes through IPC handler data:getAnswerPositionBySubject successfully', async () => {
      const handler = handlers.get('data:getAnswerPositionBySubject')
      expect(handler).toBeDefined()
      const result = await handler!()
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.find((r: any) => r.subject === 'GEAS' && r.position === null)).toEqual({
        subject: 'GEAS',
        position: null,
        count: 2,
      })
    })
  })

  describe('getResponseTimeDistribution', () => {
    it('returns { learn: [], flashcard: [] } on an empty attempt_log without throwing', () => {
      const result = getResponseTimeDistribution((sql, params) => db.prepare(sql).all(params ?? []))
      expect(result).toEqual({ learn: [], flashcard: [] })
    })

    it('splits rows correctly by mode and normalizes subjects', () => {
      const insertAttempt = db.prepare(`
        INSERT INTO attempt_log (ts, day, card_id, mode, subject, correct, response_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      insertAttempt.run(1000, '2026-09-20', 'c1', 'learn', 'Mathematics', 1, 4200)
      insertAttempt.run(2000, '2026-09-20', 'c2', 'learn', 'MATH', 1, 3100)
      insertAttempt.run(3000, '2026-09-20', 'c3', 'flashcard', 'General Engineering & Applied Sciences', 1, 7500)
      insertAttempt.run(4000, '2026-09-20', 'c4', 'flashcard', 'Electronics Systems & Technologies', 1, 6200)

      const result = getResponseTimeDistribution((sql, params) => db.prepare(sql).all(params ?? []))

      expect(result.learn).toEqual([
        { subject: 'MATH', responseMs: 4200 },
        { subject: 'MATH', responseMs: 3100 },
      ])
      expect(result.flashcard).toEqual([
        { subject: 'GEAS', responseMs: 7500 },
        { subject: 'EST', responseMs: 6200 },
      ])
    })

    it('excludes test-mode rows when response_ms is null and includes them when non-null as anomaly', () => {
      const insertAttempt = db.prepare(`
        INSERT INTO attempt_log (ts, day, card_id, mode, subject, correct, response_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      // Normal test-mode row with response_ms null
      insertAttempt.run(1000, '2026-09-20', 'c1', 'test', 'Mathematics', 1, null)
      // Normal learn-mode row
      insertAttempt.run(2000, '2026-09-20', 'c2', 'learn', 'MATH', 1, 3500)
      // Anomalous test-mode row with non-null response_ms
      insertAttempt.run(3000, '2026-09-20', 'c3', 'test', 'Electronics Engineering', 1, 5500)

      const result = getResponseTimeDistribution((sql, params) => db.prepare(sql).all(params ?? []))

      // Learn has only c2
      expect(result.learn).toEqual([{ subject: 'MATH', responseMs: 3500 }])
      // Flashcard is empty
      expect(result.flashcard).toEqual([])
      // Null test row is excluded; anomalous non-null test row flows through under test
      expect((result as any).test).toEqual([{ subject: 'ELECS', responseMs: 5500 }])
    })

    it('invokes through IPC handler data:getResponseTimeDistribution successfully', async () => {
      const insertAttempt = db.prepare(`
        INSERT INTO attempt_log (ts, day, card_id, mode, subject, correct, response_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      insertAttempt.run(1000, '2026-09-20', 'c1', 'learn', 'Mathematics', 1, 5378)
      insertAttempt.run(2000, '2026-09-20', 'c2', 'flashcard', 'Electronics Systems & Technologies', 1, 7752)

      const handler = handlers.get('data:getResponseTimeDistribution')
      expect(handler).toBeDefined()
      const result = await handler!()
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        learn: [{ subject: 'MATH', responseMs: 5378 }],
        flashcard: [{ subject: 'EST', responseMs: 7752 }],
      })
    })
  })

  describe('getTosCoverageMatrix and getCardsByTosTopic', () => {
    beforeEach(() => {
      // Seed specific cards with tos_topic_id
      const insertCard = db.prepare(`
        INSERT INTO cards (id, topic_id, type, data, difficulty, tos_topic_id, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      insertCard.run(
        'c-tos-1',
        't-math-1',
        'mcq',
        JSON.stringify({ question: 'What is derivative of sin(x)?' }),
        'easy',
        'MATH-1.1',
        JSON.stringify(['calculus', 'derivatives'])
      )
      insertCard.run(
        'c-tos-2',
        't-math-1',
        'mcq',
        JSON.stringify({ question: 'Evaluate integral of x dx.' }),
        'moderate',
        'MATH-2.1',
        JSON.stringify(['integral'])
      )
      insertCard.run(
        'c-tos-3',
        't-math-2',
        'flashcard',
        JSON.stringify({ front: 'Quadratic formula' }),
        'easy',
        null,
        JSON.stringify(['algebra'])
      )
    })

    it('computes correct topic counts and unclassified counts across subjects', () => {
      const matrix = getTosCoverageMatrix((sql, params) =>
        params && params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all()
      )
      expect(matrix.totalCards).toBe(11) // 8 from seedTestData + 3 from beforeEach
      expect(matrix.totalClassified).toBe(2)
      expect(matrix.totalUnclassified).toBe(9)
      expect(matrix.bySubject['MATH'].totalCards).toBe(5)
      expect(matrix.bySubject['MATH'].classifiedCards).toBe(2)
      expect(matrix.bySubject['MATH'].countsByTosId['MATH-1.1']).toBe(1)
      expect(matrix.bySubject['MATH'].countsByTosId['MATH-2.1']).toBe(1)
      expect(matrix.bySubject['MATH'].unclassifiedCards).toBe(3)
    })

    it('fetches cards filtered by tosTopicId', () => {
      const res = getCardsByTosTopic(
        { tosTopicId: 'MATH-1.1' },
        (sql, params) =>
          params && params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all()
      )
      expect(res.total).toBe(1)
      expect(res.cards[0].id).toBe('c-tos-1')
      expect(res.cards[0].preview).toBe('What is derivative of sin(x)?')
      expect(res.cards[0].tosTopicId).toBe('MATH-1.1')
    })

    it('fetches unclassified cards when isUnclassified is true', () => {
      const res = getCardsByTosTopic(
        { isUnclassified: true, subject: 'MATH' },
        (sql, params) =>
          params && params.length ? db.prepare(sql).all(...params) : db.prepare(sql).all()
      )
      expect(res.total).toBeGreaterThanOrEqual(1)
      expect(res.cards.every((c) => c.tosTopicId === null || c.tosTopicId === '')).toBe(true)
    })
  })

  describe('IPC error handling', () => {
    it('catches database errors and returns { success: false, error }', async () => {
      // Drop cards and attempt_log tables to induce error
      db.exec('DROP TABLE cards')
      db.exec('DROP TABLE attempt_log')

      const coverageHandler = handlers.get('data:getContentCoverage')
      const distHandler = handlers.get('data:getQuestionLengthDistribution')
      const posHandler = handlers.get('data:getAnswerPositionCounts')
      const respTimeHandler = handlers.get('data:getResponseTimeDistribution')

      const res1 = await coverageHandler!()
      expect(res1.success).toBe(false)
      expect(res1.error).toBeDefined()

      const res2 = await distHandler!()
      expect(res2.success).toBe(false)
      expect(res2.error).toBeDefined()

      const res3 = await posHandler!()
      expect(res3.success).toBe(false)
      expect(res3.error).toBeDefined()

      const res4 = await respTimeHandler!()
      expect(res4.success).toBe(false)
      expect(res4.error).toBeDefined()
    })
  })
})
