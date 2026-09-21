// electron/db/gauntlet.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import {
  GAUNTLET_DDL,
  getPoolSizes,
  sampleQuestions,
  saveRun,
  getRatings,
  getRuns,
  getRunAnswers,
  getBests,
  getPaceStats,
  clearGauntletData,
  GauntletRunInput,
} from './gauntlet'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    name TEXT,
    subject TEXT
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    topic_id TEXT REFERENCES topics(id),
    type TEXT,
    data TEXT,
    difficulty TEXT,
    tags TEXT,
    is_custom INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT 0
  );
`

function createFreshDB(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  for (const sql of GAUNTLET_DDL) {
    db.exec(sql)
  }
  return db
}

function insertTopic(db: Database.Database, id: string, subject: string, name = 'Test Topic') {
  db.prepare('INSERT INTO topics (id, name, subject) VALUES (?, ?, ?)').run(id, name, subject)
}

function insertCard(
  db: Database.Database,
  id: string,
  topicId: string,
  type = 'mcq',
  dataObj: Record<string, unknown> = { question: 'Q', choices: ['A', 'B'], answerIndex: 0 },
) {
  db.prepare(`
    INSERT INTO cards (id, topic_id, type, data, difficulty, tags, is_custom, created_at)
    VALUES (?, ?, ?, ?, 'medium', '[]', 0, 1000)
  `).run(id, topicId, type, JSON.stringify(dataObj))
}

describe('Gauntlet DB persistence', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createFreshDB()
    insertTopic(db, 'top-math', 'Mathematics')
    insertTopic(db, 'top-geas', 'General Engineering & Applied Sciences')
    insertTopic(db, 'top-elecs', 'Electronics Engineering')
    insertTopic(db, 'top-est', 'Electronics Systems & Technologies')
  })

  // (1) getPoolSizes counts only valid non-problem-solving MCQs
  it('counts only valid non-problem-solving MCQs in getPoolSizes', () => {
    // 1 valid card per subject
    insertCard(db, 'c-math', 'top-math')
    insertCard(db, 'c-geas', 'top-geas')
    insertCard(db, 'c-elecs', 'top-elecs')
    insertCard(db, 'c-est', 'top-est')

    // 4 excluded cards under ELECS:
    // 1. problem solving with solutionImagePath
    insertCard(db, 'c-sol-img', 'top-elecs', 'mcq', {
      question: 'Q',
      choices: ['A', 'B', 'C', 'D'],
      answerIndex: 0,
      solutionImagePath: 'sol.png',
    })
    // 2. single choice
    insertCard(db, 'c-one-choice', 'top-elecs', 'mcq', {
      question: 'Q',
      choices: ['A'],
      answerIndex: 0,
    })
    // 3. no choices
    insertCard(db, 'c-no-choices', 'top-elecs', 'mcq', {
      question: 'Q',
      choices: [],
      answerIndex: 0,
    })
    // 4. non-mcq card
    insertCard(db, 'c-flashcard', 'top-elecs', 'flashcard', {
      front: 'F',
      back: 'B',
    })

    const pool = getPoolSizes(db)
    expect(pool).toEqual({
      MATH: 1,
      GEAS: 1,
      ELECS: 1,
      EST: 1,
    })
  })

  // (2) sampleQuestions respects count, subject, and excludeIds
  it('sampleQuestions respects count, subject, and excludeIds', () => {
    insertCard(db, 'c-el-1', 'top-elecs')
    insertCard(db, 'c-el-2', 'top-elecs')
    insertCard(db, 'c-el-3', 'top-elecs')
    insertCard(db, 'c-math-1', 'top-math')

    const elecs2 = sampleQuestions(db, 'ELECS', 2)
    expect(elecs2.length).toBe(2)
    expect(elecs2.every(c => c.subject_code === 'ELECS')).toBe(true)

    const math1 = sampleQuestions(db, 'MATH', 1)
    expect(math1.length).toBe(1)
    expect(math1[0].id).toBe('c-math-1')
    expect(math1[0].subject_code).toBe('MATH')

    const excluded = sampleQuestions(db, 'ELECS', 10, ['c-el-1', 'c-el-2'])
    expect(excluded.length).toBe(1)
    expect(excluded[0].id).toBe('c-el-3')

    const zero = sampleQuestions(db, 'ELECS', 0)
    expect(zero).toEqual([])
  })

  // (3) after saveRun containing an answer for card A, sampleQuestions(…, count=1) prefers unseen card
  it('prefers unseen cards over cards answered in previous Gauntlet runs', () => {
    insertCard(db, 'card-A', 'top-elecs')
    insertCard(db, 'card-B', 'top-elecs')

    const run: GauntletRunInput = {
      id: 'run-1',
      startedAt: 1000,
      endedAt: 2000,
      mode: 'survival',
      config: {},
      rated: false,
      score: 100,
      answered: 1,
      correct: 1,
      wrong: 0,
      skipped: 0,
      bestStreak: 1,
      durationMs: 1000,
      endReason: 'quit',
      answers: [
        {
          seq: 1,
          cardId: 'card-A',
          subject: 'ELECS',
          chosen: 0,
          answerIndex: 0,
          outcome: 'correct',
          timeMs: 1000,
          parMs: 2000,
          points: 100,
          streakAfter: 1,
          choices: ['A', 'B'],
          answeredAt: 1500,
        },
      ],
    }
    saveRun(db, run)

    const sample = sampleQuestions(db, 'ELECS', 1)
    expect(sample.length).toBe(1)
    expect(sample[0].id).toBe('card-B')

    const sampleTwo = sampleQuestions(db, 'ELECS', 2)
    expect(sampleTwo.length).toBe(2)
    expect(sampleTwo[0].id).toBe('card-B')
    expect(sampleTwo[1].id).toBe('card-A')
  })

  // (4) saveRun stores run + answers and upserts ratings only when rated: true, with peak = max over updates
  it('upserts ratings only when rated: true, updating peak correctly', () => {
    const baseRun: Omit<GauntletRunInput, 'id' | 'rated' | 'ratingsAfter'> = {
      startedAt: 1000,
      endedAt: 2000,
      mode: 'survival',
      config: {},
      score: 100,
      answered: 1,
      correct: 1,
      wrong: 0,
      skipped: 0,
      bestStreak: 1,
      durationMs: 1000,
      endReason: 'lives',
      answers: [],
    }

    // Unrated run -> no ratings written
    saveRun(db, {
      ...baseRun,
      id: 'run-unrated',
      rated: false,
      ratingsAfter: { ELECS: { rating: 1200, answers: 5 } },
    })
    expect(getRatings(db)).toEqual([])

    // First rated run -> rating 1200, peak 1200
    saveRun(db, {
      ...baseRun,
      id: 'run-rated-1',
      rated: true,
      ratingsAfter: { ELECS: { rating: 1200, answers: 5 } },
    })
    let ratings = getRatings(db)
    expect(ratings.length).toBe(1)
    expect(ratings[0]).toMatchObject({
      subject: 'ELECS',
      rating: 1200,
      answers: 5,
      peak: 1200,
    })

    // Second rated run with lower rating -> rating 1150, peak remains 1200
    saveRun(db, {
      ...baseRun,
      id: 'run-rated-2',
      rated: true,
      ratingsAfter: { ELECS: { rating: 1150, answers: 10 } },
    })
    ratings = getRatings(db)
    expect(ratings.length).toBe(1)
    expect(ratings[0]).toMatchObject({
      subject: 'ELECS',
      rating: 1150,
      answers: 10,
      peak: 1200,
    })

    // Third rated run with higher rating -> rating 1300, peak becomes 1300
    saveRun(db, {
      ...baseRun,
      id: 'run-rated-3',
      rated: true,
      ratingsAfter: { ELECS: { rating: 1300, answers: 15 } },
    })
    ratings = getRatings(db)
    expect(ratings.length).toBe(1)
    expect(ratings[0]).toMatchObject({
      subject: 'ELECS',
      rating: 1300,
      answers: 15,
      peak: 1300,
    })
  })

  // (5) getRuns/getRunAnswers round-trip (parsed JSON fields)
  it('round-trips runs and answers with correctly parsed JSON fields', () => {
    const run: GauntletRunInput = {
      id: 'run-rt-1',
      startedAt: 1000,
      endedAt: 2500,
      mode: 'timed',
      config: { durationSeconds: 60, subjects: ['MATH'] },
      rated: true,
      score: 500,
      answered: 1,
      correct: 1,
      wrong: 0,
      skipped: 0,
      bestStreak: 1,
      durationMs: 1500,
      endReason: 'time',
      ratingsBefore: { MATH: { rating: 1000, answers: 0 } },
      ratingsAfter: { MATH: { rating: 1050, answers: 1 } },
      subjectBreakdown: { MATH: { correct: 1, total: 1 } },
      answers: [
        {
          seq: 1,
          cardId: 'c-math-1',
          subject: 'MATH',
          chosen: 2,
          answerIndex: 2,
          outcome: 'correct',
          timeMs: 1200,
          parMs: 2500,
          points: 500,
          streakAfter: 1,
          choices: ['Opt1', 'Opt2', 'Opt3'],
          answeredAt: 2200,
        },
      ],
    }

    saveRun(db, run)

    const runs = getRuns(db)
    expect(runs.length).toBe(1)
    const savedRun = runs[0]
    expect(savedRun.id).toBe('run-rt-1')
    expect(savedRun.config).toEqual({ durationSeconds: 60, subjects: ['MATH'] })
    expect(savedRun.rated).toBe(true)
    expect(savedRun.score).toBe(500)
    expect(savedRun.ratingsBefore).toEqual({ MATH: { rating: 1000, answers: 0 } })
    expect(savedRun.ratingsAfter).toEqual({ MATH: { rating: 1050, answers: 1 } })
    expect(savedRun.subjectBreakdown).toEqual({ MATH: { correct: 1, total: 1 } })

    const answers = getRunAnswers(db, 'run-rt-1')
    expect(answers.length).toBe(1)
    const savedAns = answers[0]
    expect(savedAns.cardId).toBe('c-math-1')
    expect(savedAns.chosen).toBe(2)
    expect(savedAns.answerIndex).toBe(2)
    expect(savedAns.outcome).toBe('correct')
    expect(savedAns.choices).toEqual(['Opt1', 'Opt2', 'Opt3'])
  })

  // (6) getBests aggregates by mode
  it('aggregates best scores and streaks by mode', () => {
    const baseRun = {
      startedAt: 1000,
      endedAt: 2000,
      config: {},
      rated: false,
      answered: 5,
      correct: 4,
      wrong: 1,
      skipped: 0,
      durationMs: 1000,
      endReason: 'lives' as const,
      answers: [],
    }

    saveRun(db, { ...baseRun, id: 's1', mode: 'survival', score: 100, bestStreak: 4 })
    saveRun(db, { ...baseRun, id: 's2', mode: 'survival', score: 250, bestStreak: 10 })
    saveRun(db, { ...baseRun, id: 't1', mode: 'timed', score: 400, bestStreak: 8 })

    const bests = getBests(db)
    expect(bests.length).toBe(2)

    const survivalBest = bests.find(b => b.mode === 'survival')
    expect(survivalBest).toEqual({
      mode: 'survival',
      bestScore: 250,
      bestStreak: 10,
      runs: 2,
    })

    const timedBest = bests.find(b => b.mode === 'timed')
    expect(timedBest).toEqual({
      mode: 'timed',
      bestScore: 400,
      bestStreak: 8,
      runs: 1,
    })
  })

  // (7) clearGauntletData empties all three tables
  it('empties gauntlet_runs, gauntlet_answers, and gauntlet_ratings on clearGauntletData', () => {
    saveRun(db, {
      id: 'run-to-clear',
      startedAt: 1000,
      endedAt: 2000,
      mode: 'survival',
      config: {},
      rated: true,
      score: 100,
      answered: 1,
      correct: 1,
      wrong: 0,
      skipped: 0,
      bestStreak: 1,
      durationMs: 1000,
      endReason: 'quit',
      ratingsAfter: { ELECS: { rating: 1250, answers: 1 } },
      answers: [
        {
          seq: 1,
          cardId: 'card-1',
          subject: 'ELECS',
          chosen: 0,
          answerIndex: 0,
          outcome: 'correct',
          timeMs: 1000,
          parMs: 2000,
          points: 100,
          streakAfter: 1,
          choices: ['A', 'B'],
          answeredAt: 1500,
        },
      ],
    })

    expect(getRuns(db).length).toBe(1)
    expect(getRunAnswers(db, 'run-to-clear').length).toBe(1)
    expect(getRatings(db).length).toBe(1)

    clearGauntletData(db)

    expect(getRuns(db)).toEqual([])
    expect(getRunAnswers(db, 'run-to-clear')).toEqual([])
    expect(getRatings(db)).toEqual([])
  })

  it('computes pace stats with exclusions and LIMIT 800 window', () => {
    // Helper to insert a gauntlet answer
    const insertAnswer = (subject: string, outcome: string, timeMs: number) => {
      db.prepare(`
        INSERT INTO gauntlet_answers (run_id, seq, card_id, subject, answer_index, outcome, time_ms, par_ms, points, streak_after, answered_at)
        VALUES ('run-1', 0, 'c-1', ?, 0, ?, ?, 5000, 100, 1, 1000)
      `).run(subject, outcome, timeMs)
    }

    // MATH: 2 valid (3000ms, 5000ms -> avg 4000ms), 1 too fast (<1200ms), 1 skipped, 1 timeout
    insertAnswer('MATH', 'correct', 3000)
    insertAnswer('MATH', 'wrong', 5000)
    insertAnswer('MATH', 'correct', 1199) // excluded: time_ms < 1200
    insertAnswer('MATH', 'skipped', 6000) // excluded: outcome not in ('correct', 'wrong')
    insertAnswer('MATH', 'timeout', 15000) // excluded: outcome not in ('correct', 'wrong')

    // GEAS: 1 valid (6000ms)
    insertAnswer('GEAS', 'correct', 6000)

    let stats = getPaceStats(db)
    const mathStat = stats.find(s => s.subject === 'MATH')
    const geasStat = stats.find(s => s.subject === 'GEAS')
    expect(mathStat).toEqual({ subject: 'MATH', n: 2, avgMs: 4000 })
    expect(geasStat).toEqual({ subject: 'GEAS', n: 1, avgMs: 6000 })

    // Test LIMIT 800 window:
    // Insert 800 new answers for ELECS. Since ORDER BY id DESC LIMIT 800 is used in the inner query,
    // all older answers (MATH and GEAS) should now fall outside the 800 window!
    const insertMany = db.transaction(() => {
      for (let i = 0; i < 800; i++) {
        insertAnswer('ELECS', 'correct', 2000)
      }
    })
    insertMany()

    stats = getPaceStats(db)
    expect(stats.length).toBe(1)
    expect(stats[0]).toEqual({ subject: 'ELECS', n: 800, avgMs: 2000 })
  })
})
