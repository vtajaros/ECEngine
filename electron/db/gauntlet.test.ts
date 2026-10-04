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
  resetRatings,
  GauntletRunInput,
  flagQuestion,
  unflagQuestion,
  getFlaggedQuestions,
  getWeakTosTopics,
  getGauntletEdaStats,
  getExcludedGauntletQuestions,
  reinsertQuestions,
  getTosTopicPerformanceStats,
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
    tos_topic_id TEXT,
    is_custom INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS progress (
    card_id TEXT PRIMARY KEY,
    ease_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    next_review TEXT,
    last_reviewed TEXT,
    correct_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    last_result TEXT
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
  tosTopicId: string | null = null,
) {
  db.prepare(`
    INSERT INTO cards (id, topic_id, type, data, difficulty, tags, tos_topic_id, is_custom, created_at)
    VALUES (?, ?, ?, ?, 'medium', '[]', ?, 0, 1000)
  `).run(id, topicId, type, JSON.stringify(dataObj), tosTopicId)
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
      question: 'Calculate the voltage drop across R1',
      choices: ['10 V', '20 V', '30 V', '40 V'],
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
    expect(math1[0].deck_name).toBe('Test Topic')
    expect(math1[0].card_number).toBe(1)
    expect(math1[0].total_in_deck).toBe(1)

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

  it('resetRatings deletes gauntlet_ratings but preserves runs and answers', () => {
    saveRun(db, {
      id: 'run-preserve',
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
      endReason: 'time',
      ratingsAfter: { MATH: { rating: 1050, answers: 1 } },
      answers: [
        {
          seq: 0,
          cardId: 'c-math',
          subject: 'MATH',
          chosen: 0,
          answerIndex: 0,
          outcome: 'correct',
          timeMs: 2000,
          parMs: 5000,
          points: 100,
          streakAfter: 1,
          choices: ['A', 'B'],
          answeredAt: 1500,
        },
      ],
    })

    expect(getRatings(db).length).toBe(1)
    expect(getRuns(db).length).toBe(1)
    expect(getRunAnswers(db, 'run-preserve').length).toBe(1)

    resetRatings(db)

    // Ratings cleared
    expect(getRatings(db)).toEqual([])
    // Runs and answers remain intact
    expect(getRuns(db).length).toBe(1)
    expect(getRunAnswers(db, 'run-preserve').length).toBe(1)
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

  // (10) Question Flagging & Exclusion from Gauntlet Pool
  describe('Question Flagging & Exclusion', () => {
    it('excludes flagged cards from getPoolSizes and sampleQuestions', () => {
      insertCard(db, 'math-1', 'top-math', 'mcq', { question: 'Q1', choices: ['A', 'B'], answerIndex: 0 })
      insertCard(db, 'math-2', 'top-math', 'mcq', { question: 'Q2', choices: ['A', 'B'], answerIndex: 0 })

      // Initially 2 cards in pool
      expect(getPoolSizes(db).MATH).toBe(2)
      let sampled = sampleQuestions(db, 'MATH', 10)
      expect(sampled.length).toBe(2)

      // Flag math-1
      flagQuestion(db, 'math-1', 'Error in question or choices')

      // Pool size should drop to 1
      expect(getPoolSizes(db).MATH).toBe(1)

      // sampleQuestions should only return math-2
      sampled = sampleQuestions(db, 'MATH', 10)
      expect(sampled.length).toBe(1)
      expect(sampled[0].id).toBe('math-2')

      // Unflag math-1
      unflagQuestion(db, 'math-1')

      // Pool size restored to 2
      expect(getPoolSizes(db).MATH).toBe(2)
      sampled = sampleQuestions(db, 'MATH', 10)
      expect(sampled.length).toBe(2)
    })

    it('retrieves flagged questions with reasons', () => {
      flagQuestion(db, 'card-err', 'Error in question')
      flagQuestion(db, 'card-no-img', 'Missing image')

      const all = getFlaggedQuestions(db)
      expect(all['card-err']).toBeDefined()
      expect(all['card-err'].reason).toBe('Error in question')
      expect(all['card-no-img']).toBeDefined()
      expect(all['card-no-img'].reason).toBe('Missing image')

      const filtered = getFlaggedQuestions(db, ['card-err'])
      expect(Object.keys(filtered)).toEqual(['card-err'])
    })
  })

  // (11) Weak TOS Topic Detection & Adaptive Question Sampling
  describe('Weak TOS Topic Detection & Adaptive Question Sampling', () => {
    it('detects weak TOS topics based on Gauntlet answers', () => {
      insertCard(db, 'c1', 'top-elecs', 'mcq', { question: 'Q1', choices: ['A', 'B'], answerIndex: 0 }, 'ELECS-1.0')
      insertCard(db, 'c2', 'top-elecs', 'mcq', { question: 'Q2', choices: ['A', 'B'], answerIndex: 0 }, 'ELECS-1.0')
      insertCard(db, 'c3', 'top-elecs', 'mcq', { question: 'Q3', choices: ['A', 'B'], answerIndex: 0 }, 'ELECS-2.0')

      // Record answers: 1 correct, 3 wrong for c1/c2 (ELECS-1.0) => 25% accuracy
      saveRun(db, {
        id: 'run-weak',
        startedAt: 1000,
        endedAt: 2000,
        mode: 'survival',
        config: {},
        rated: false,
        score: 50,
        answered: 4,
        correct: 1,
        wrong: 3,
        skipped: 0,
        bestStreak: 1,
        durationMs: 1000,
        endReason: 'lives',
        answers: [
          { seq: 0, cardId: 'c1', subject: 'ELECS', chosen: 0, answerIndex: 0, outcome: 'correct', timeMs: 1000, parMs: 5000, points: 100, streakAfter: 1, choices: ['A', 'B'], answeredAt: 1100 },
          { seq: 1, cardId: 'c1', subject: 'ELECS', chosen: 1, answerIndex: 0, outcome: 'wrong', timeMs: 1000, parMs: 5000, points: 0, streakAfter: 0, choices: ['A', 'B'], answeredAt: 1200 },
          { seq: 2, cardId: 'c2', subject: 'ELECS', chosen: 1, answerIndex: 0, outcome: 'wrong', timeMs: 1000, parMs: 5000, points: 0, streakAfter: 0, choices: ['A', 'B'], answeredAt: 1300 },
          { seq: 3, cardId: 'c2', subject: 'ELECS', chosen: 1, answerIndex: 0, outcome: 'wrong', timeMs: 1000, parMs: 5000, points: 0, streakAfter: 0, choices: ['A', 'B'], answeredAt: 1400 },
        ],
      })

      const weak = getWeakTosTopics(db, 'ELECS')
      expect(weak.length).toBe(1)
      expect(weak[0].tosTopicId).toBe('ELECS-1.0')
      expect(weak[0].accuracy).toBe(0.25)
      expect(weak[0].totalAnswers).toBe(4)
      expect(weak[0].wrongAnswers).toBe(3)
    })

    it('prioritizes questions in struggling TOS topics in sampleQuestions', () => {
      // 2 cards in ELECS-1.0 (weak) and 2 in ELECS-2.0 (neutral)
      insertCard(db, 'weak-1', 'top-elecs', 'mcq', { question: 'W1', choices: ['A', 'B'], answerIndex: 0 }, 'ELECS-1.0')
      insertCard(db, 'weak-2', 'top-elecs', 'mcq', { question: 'W2', choices: ['A', 'B'], answerIndex: 0 }, 'ELECS-1.0')
      insertCard(db, 'other-1', 'top-elecs', 'mcq', { question: 'O1', choices: ['A', 'B'], answerIndex: 0 }, 'ELECS-2.0')
      insertCard(db, 'other-2', 'top-elecs', 'mcq', { question: 'O2', choices: ['A', 'B'], answerIndex: 0 }, 'ELECS-2.0')

      // Record failures on ELECS-1.0
      saveRun(db, {
        id: 'run-weak-2',
        startedAt: 1000,
        endedAt: 2000,
        mode: 'survival',
        config: {},
        rated: false,
        score: 0,
        answered: 3,
        correct: 0,
        wrong: 3,
        skipped: 0,
        bestStreak: 0,
        durationMs: 1000,
        endReason: 'lives',
        answers: [
          { seq: 0, cardId: 'weak-1', subject: 'ELECS', chosen: 1, answerIndex: 0, outcome: 'wrong', timeMs: 1000, parMs: 5000, points: 0, streakAfter: 0, choices: ['A', 'B'], answeredAt: 1100 },
          { seq: 1, cardId: 'weak-1', subject: 'ELECS', chosen: 1, answerIndex: 0, outcome: 'wrong', timeMs: 1000, parMs: 5000, points: 0, streakAfter: 0, choices: ['A', 'B'], answeredAt: 1200 },
          { seq: 2, cardId: 'weak-2', subject: 'ELECS', chosen: 1, answerIndex: 0, outcome: 'wrong', timeMs: 1000, parMs: 5000, points: 0, streakAfter: 0, choices: ['A', 'B'], answeredAt: 1300 },
        ],
      })

      // Sample 2 questions — both should be from ELECS-1.0 because it's weak
      const sampled = sampleQuestions(db, 'ELECS', 2)
      expect(sampled.length).toBe(2)
      expect(sampled.every(s => s.tos_topic_id === 'ELECS-1.0')).toBe(true)
    })
  })

  describe('Question Solution Inclusion (allowSolutions)', () => {
    it('includes cards with solutionImagePath when allowSolutions is true', () => {
      insertCard(db, 'sol-elecs', 'top-elecs', 'mcq', {
        question: 'What is Ohm\'s Law?',
        choices: ['V=IR', 'P=IV', 'E=mc2', 'F=ma'],
        answerIndex: 0,
        solutionImagePath: 'ohm_explanation.png',
      })

      // Default (allowSolutions=false) excludes it
      const poolDefault = getPoolSizes(db)
      expect(poolDefault.ELECS).toBe(0)

      // allowSolutions=true includes it
      const poolWithSol = getPoolSizes(db, { allowSolutions: true })
      expect(poolWithSol.ELECS).toBe(1)

      // sampleQuestions respects allowSolutions
      const sampledDefault = sampleQuestions(db, 'ELECS', 5, [], { allowSolutions: false })
      expect(sampledDefault.length).toBe(0)

      const sampledWithSol = sampleQuestions(db, 'ELECS', 5, [], { allowSolutions: true })
      expect(sampledWithSol.length).toBe(1)
      expect(sampledWithSol[0].id).toBe('sol-elecs')
    })
  })

  describe('Deck Mastery & Progress Updates in saveRun', () => {
    it('records correct Gauntlet answers into progress table', () => {
      insertCard(db, 'c-mastery-1', 'top-elecs')

      saveRun(db, {
        id: 'run-mastery-1',
        startedAt: 1000,
        endedAt: 2000,
        mode: 'timed',
        config: {},
        rated: false,
        score: 100,
        answered: 1,
        correct: 1,
        wrong: 0,
        skipped: 0,
        bestStreak: 1,
        durationMs: 1000,
        endReason: 'time',
        answers: [
          { seq: 0, cardId: 'c-mastery-1', subject: 'ELECS', chosen: 0, answerIndex: 0, outcome: 'correct', timeMs: 1000, parMs: 5000, points: 100, streakAfter: 1, choices: ['A', 'B'], answeredAt: 1500 },
        ],
      })

      const row = db.prepare('SELECT * FROM progress WHERE card_id = ?').get('c-mastery-1') as any
      expect(row).toBeDefined()
      expect(row.correct_count).toBe(1)
      expect(row.total_count).toBe(1)
      expect(row.last_result).toBe('correct')
    })

    it('does not overwrite last_result=correct when card is answered wrong in Gauntlet', () => {
      insertCard(db, 'c-mastery-2', 'top-elecs')

      // First answer correctly
      saveRun(db, {
        id: 'run-mastery-2a',
        startedAt: 1000,
        endedAt: 2000,
        mode: 'timed',
        config: {},
        rated: false,
        score: 100,
        answered: 1,
        correct: 1,
        wrong: 0,
        skipped: 0,
        bestStreak: 1,
        durationMs: 1000,
        endReason: 'time',
        answers: [
          { seq: 0, cardId: 'c-mastery-2', subject: 'ELECS', chosen: 0, answerIndex: 0, outcome: 'correct', timeMs: 1000, parMs: 5000, points: 100, streakAfter: 1, choices: ['A', 'B'], answeredAt: 1500 },
        ],
      })

      // Later answered wrong in a subsequent fast Gauntlet run
      saveRun(db, {
        id: 'run-mastery-2b',
        startedAt: 3000,
        endedAt: 4000,
        mode: 'survival',
        config: {},
        rated: false,
        score: 0,
        answered: 1,
        correct: 0,
        wrong: 1,
        skipped: 0,
        bestStreak: 0,
        durationMs: 1000,
        endReason: 'lives',
        answers: [
          { seq: 0, cardId: 'c-mastery-2', subject: 'ELECS', chosen: 1, answerIndex: 0, outcome: 'wrong', timeMs: 800, parMs: 5000, points: 0, streakAfter: 0, choices: ['A', 'B'], answeredAt: 3500 },
        ],
      })

      const row = db.prepare('SELECT * FROM progress WHERE card_id = ?').get('c-mastery-2') as any
      expect(row).toBeDefined()
      expect(row.correct_count).toBe(1)
      expect(row.total_count).toBe(2)
      // Must preserve 'correct' so mastery earned is not wiped by a speed error in Gauntlet!
      expect(row.last_result).toBe('correct')
    })
  })

  describe('TOS Topic-Specific Filtering (tosTopicId)', () => {
    it('filters getPoolSizes and sampleQuestions to specified parent topic and subtopics', () => {
      // GEAS-4.0 (parent) and GEAS-4.1 (subtopic)
      insertCard(db, 'geas-4-0', 'top-geas', 'mcq', { question: 'Q1', choices: ['A', 'B'], answerIndex: 0 }, 'GEAS-4.0')
      insertCard(db, 'geas-4-1', 'top-geas', 'mcq', { question: 'Q2', choices: ['A', 'B'], answerIndex: 0 }, 'GEAS-4.1')
      // GEAS-1.0 (unrelated topic)
      insertCard(db, 'geas-1-0', 'top-geas', 'mcq', { question: 'Q3', choices: ['A', 'B'], answerIndex: 0 }, 'GEAS-1.0')

      // Without topic filter: GEAS has 3 cards
      const allPool = getPoolSizes(db)
      expect(allPool.GEAS).toBe(3)

      // With tosTopicId = 'GEAS-4.0': counts only GEAS-4.0 and GEAS-4.1
      const filteredPool = getPoolSizes(db, { tosTopicId: 'GEAS-4.0' })
      expect(filteredPool.GEAS).toBe(2)

      // sampleQuestions with tosTopicId = 'GEAS-4.0' returns only the 2 items
      const sampled = sampleQuestions(db, 'GEAS', 10, [], { tosTopicId: 'GEAS-4.0' })
      expect(sampled.length).toBe(2)
      const ids = sampled.map(s => s.id)
      expect(ids).toContain('geas-4-0')
      expect(ids).toContain('geas-4-1')
      expect(ids).not.toContain('geas-1-0')
    })
  })

  describe('Smart Problem-Solving Exclusion Filter', () => {
    it('allows concept questions with solution images, but excludes calculation problems when allowSolutions is false', () => {
      // Concept MCQ with solution image and non-numeric word choices -> should be allowed
      insertCard(db, 'concept-img', 'top-elecs', 'mcq', {
        question: 'Which device behaves as an open circuit to DC?',
        choices: ['Capacitor', 'Inductor'],
        answerIndex: 0,
        solutionImagePath: 'sol_cap.png',
      }, 'ELECS-1.0')

      // Calculation MCQ with solution image and numeric choices -> excluded when solutions off
      insertCard(db, 'calc-img', 'top-elecs', 'mcq', {
        question: 'Calculate the voltage drop across the resistor',
        choices: ['5 V', '10 V'],
        answerIndex: 0,
        solutionImagePath: 'sol_v.png',
      }, 'ELECS-1.0')

      // Calculation MCQ without image but with Calculate stem and numeric choices -> excluded when solutions off
      insertCard(db, 'calc-no-img', 'top-elecs', 'mcq', {
        question: 'Calculate the total equivalent capacitance',
        choices: ['10 uF', '20 uF'],
        answerIndex: 0,
      }, 'ELECS-1.0')

      // Pure concept MCQ without solution image -> always allowed
      insertCard(db, 'concept-pure', 'top-elecs', 'mcq', {
        question: 'What is Ohm\'s Law relationship?',
        choices: ['V = IR', 'P = IV'],
        answerIndex: 0,
      }, 'ELECS-1.0')

      // When allowSolutions is false (default):
      const poolOff = getPoolSizes(db, { allowSolutions: false })
      expect(poolOff.ELECS).toBe(2) // concept-img and concept-pure

      const sampledOff = sampleQuestions(db, 'ELECS', 10, [], { allowSolutions: false })
      const idsOff = sampledOff.map(s => s.id)
      expect(idsOff).toContain('concept-img')
      expect(idsOff).toContain('concept-pure')
      expect(idsOff).not.toContain('calc-img')
      expect(idsOff).not.toContain('calc-no-img')

      // When allowSolutions is true:
      const poolOn = getPoolSizes(db, { allowSolutions: true })
      expect(poolOn.ELECS).toBe(4)

      const sampledOn = sampleQuestions(db, 'ELECS', 10, [], { allowSolutions: true })
      const idsOn = sampledOn.map(s => s.id)
      expect(idsOn).toContain('calc-img')
      expect(idsOn).toContain('calc-no-img')
    })
  })

  describe('getWeakTosTopics with mode and sortBy', () => {
    it('filters weak topics by run mode (timed vs survival) and sorts by misses or accuracy', () => {
      insertCard(db, 't1', 'top-elecs', 'mcq', { question: 'Q1', choices: ['A', 'B'], answerIndex: 0 }, 'ELECS-4.0')
      insertCard(db, 't2', 'top-elecs', 'mcq', { question: 'Q2', choices: ['A', 'B'], answerIndex: 0 }, 'ELECS-5.0')

      // Timed run with 10 misses on ELECS-4.0 (50% acc)
      saveRun(db, {
        id: 'run-timed',
        startedAt: 1000,
        endedAt: 2000,
        mode: 'timed',
        config: {},
        rated: false,
        score: 0,
        answered: 20,
        correct: 10,
        wrong: 10,
        skipped: 0,
        bestStreak: 1,
        durationMs: 1000,
        endReason: 'time',
        answers: Array.from({ length: 20 }, (_, i) => ({
          seq: i,
          cardId: 't1',
          subject: 'ELECS',
          chosen: i < 10 ? 0 : 1,
          answerIndex: 0,
          outcome: i < 10 ? ('correct' as const) : ('wrong' as const),
          timeMs: 1000,
          parMs: 5000,
          points: 10,
          streakAfter: 1,
          choices: ['A', 'B'],
          answeredAt: 1000 + i * 10,
        })),
      })

      // Survival run with 3 misses on ELECS-5.0 (0% acc)
      saveRun(db, {
        id: 'run-survival',
        startedAt: 3000,
        endedAt: 4000,
        mode: 'survival',
        config: {},
        rated: false,
        score: 0,
        answered: 3,
        correct: 0,
        wrong: 3,
        skipped: 0,
        bestStreak: 0,
        durationMs: 1000,
        endReason: 'lives',
        answers: Array.from({ length: 3 }, (_, i) => ({
          seq: i,
          cardId: 't2',
          subject: 'ELECS',
          chosen: 1,
          answerIndex: 0,
          outcome: 'wrong' as const,
          timeMs: 1000,
          parMs: 5000,
          points: 0,
          streakAfter: 0,
          choices: ['A', 'B'],
          answeredAt: 3000 + i * 10,
        })),
      })

      // Filter by mode 'timed' -> only ELECS-4.0
      const timedWeak = getWeakTosTopics(db, 'ELECS', 5, 'timed')
      expect(timedWeak.length).toBe(1)
      expect(timedWeak[0].tosTopicId).toBe('ELECS-4.0')
      expect(timedWeak[0].wrongAnswers).toBe(10)

      // Filter by mode 'survival' -> only ELECS-5.0
      const survivalWeak = getWeakTosTopics(db, 'ELECS', 5, 'survival')
      expect(survivalWeak.length).toBe(1)
      expect(survivalWeak[0].tosTopicId).toBe('ELECS-5.0')
      expect(survivalWeak[0].wrongAnswers).toBe(3)

      // All modes sorted by misses -> ELECS-4.0 (10 misses) comes before ELECS-5.0 (3 misses)
      const allMisses = getWeakTosTopics(db, 'ELECS', 5, 'all', 'misses')
      expect(allMisses.length).toBe(2)
      expect(allMisses[0].tosTopicId).toBe('ELECS-4.0')
      expect(allMisses[1].tosTopicId).toBe('ELECS-5.0')

      // All modes sorted by accuracy -> ELECS-5.0 (0% acc) comes before ELECS-4.0 (50% acc)
      const allAcc = getWeakTosTopics(db, 'ELECS', 5, 'all', 'accuracy')
      expect(allAcc.length).toBe(2)
      expect(allAcc[0].tosTopicId).toBe('ELECS-5.0')
      expect(allAcc[1].tosTopicId).toBe('ELECS-4.0')
    })

    it('computes complete GauntletEdaStats correctly', () => {
      // Test empty db
      const emptyStats = getGauntletEdaStats(db)
      expect(emptyStats.tosAccuracy).toEqual([])
      expect(emptyStats.speedPar.length).toBe(4)
      expect(emptyStats.eloTrajectory).toEqual([])
      expect(emptyStats.currentRatings.MATH.rating).toBe(500)
      expect(emptyStats.endurance.totalRuns).toBe(0)
      expect(emptyStats.endurance.streakBuckets.length).toBe(6)

      db.prepare("INSERT INTO topics VALUES ('t-elecs', 'Electronics Topic', 'Electronics Engineering')").run()
      const validCardData = JSON.stringify({ choices: ['A', 'B'] })
      db.prepare("INSERT INTO cards VALUES ('c1', 't-elecs', 'mcq', ?, 'EASY', '', 'ELECS-1.1', 0, 0, 0)").run(validCardData)
      db.prepare("INSERT INTO cards VALUES ('c2', 't-elecs', 'mcq', ?, 'EASY', '', 'ELECS-1.1', 0, 0, 0)").run(validCardData)
      db.prepare("INSERT INTO cards VALUES ('c3', 't-elecs', 'mcq', ?, 'EASY', '', 'ELECS-1.2', 0, 0, 0)").run(validCardData)

      saveRun(db, {
        id: 'run-eda-1',
        config: {},
        startedAt: 1000,
        endedAt: 2000,
        mode: 'timed',
        rated: true,
        score: 250,
        answered: 2,
        correct: 1,
        wrong: 1,
        skipped: 0,
        bestStreak: 6,
        durationMs: 45000,
        endReason: 'time',
        ratingsBefore: { ELECS: { rating: 500, answers: 0 } },
        ratingsAfter: { ELECS: { rating: 520, answers: 2 } },
        answers: [
          {
            seq: 0,
            cardId: 'c1',
            subject: 'ELECS',
            chosen: 0,
            answerIndex: 0,
            outcome: 'correct',
            timeMs: 4000,
            parMs: 6000,
            points: 150,
            streakAfter: 1,
            choices: ['A', 'B'],
            answeredAt: 1050,
          },
          {
            seq: 1,
            cardId: 'c2',
            subject: 'ELECS',
            chosen: 1,
            answerIndex: 0,
            outcome: 'wrong',
            timeMs: 1000, // fast wrong (1000 < 6000 * 0.25)
            parMs: 6000,
            points: 0,
            streakAfter: 0,
            choices: ['A', 'B'],
            answeredAt: 1100,
          },
        ],
      })

      const populatedStats = getGauntletEdaStats(db)
      expect(populatedStats.tosAccuracy.length).toBe(1)
      expect(populatedStats.tosAccuracy[0].tosTopicId).toBe('ELECS-1.1')
      expect(populatedStats.tosAccuracy[0].totalAnswers).toBe(2)
      expect(populatedStats.tosAccuracy[0].correctAnswers).toBe(1)
      expect(populatedStats.tosAccuracy[0].wrongAnswers).toBe(1)
      expect(populatedStats.tosAccuracy[0].accuracy).toBe(0.5)

      // Speed vs Par
      const elecsSpeed = populatedStats.speedPar.find(s => s.subject === 'ELECS')
      expect(elecsSpeed).toBeDefined()
      expect(elecsSpeed!.totalAnswers).toBe(2)
      expect(elecsSpeed!.fastWrongCount).toBe(1)
      expect(elecsSpeed!.wrongCount).toBe(1)
      expect(elecsSpeed!.fastWrongRate).toBe(1.0)

      // Elo Trajectory
      expect(populatedStats.eloTrajectory.length).toBe(1)
      expect(populatedStats.eloTrajectory[0].ELECS).toBe(520)
      expect(populatedStats.eloTrajectory[0].overall).toBe(520)

      // Current Ratings
      expect(populatedStats.currentRatings.ELECS.rating).toBe(520)

      // Coverage
      const elecsCoverage = populatedStats.coverageDensity.bySubject.find(c => c.subject === 'ELECS')
      expect(elecsCoverage).toBeDefined()
      expect(elecsCoverage!.libraryCards).toBe(3)
      expect(elecsCoverage!.arenaCards).toBe(2)

      // Endurance
      expect(populatedStats.endurance.totalRuns).toBe(1)
      expect(populatedStats.endurance.totalAnswers).toBe(2)
      expect(populatedStats.endurance.avgRunDurationSec).toBe(45)
      expect(populatedStats.endurance.avgRunScore).toBe(250)
      expect(populatedStats.endurance.bestStreakOverall).toBe(6)
      const bucket5to9 = populatedStats.endurance.streakBuckets.find(b => b.bucket === '5-9')
      expect(bucket5to9?.count).toBe(1)
      const timeFailure = populatedStats.endurance.failureModes.find(m => m.mode === 'time')
      expect(timeFailure?.count).toBe(1)
    })

    it('retrieves excluded questions and reinserts them into the gauntlet fetching pool', () => {
      db.prepare("INSERT INTO topics VALUES ('t-est', 'EST Deck', 'Electronics Systems & Technologies')").run()
      const mcq1 = JSON.stringify({ question: 'What does ASCII mean?', choices: ['A', 'B'], answer: 0 })
      const mcq2 = JSON.stringify({ question: 'Calculate the antenna gain in dB', choices: ['10 dB', '20 dB'], answer: 1 })
      const flashData = JSON.stringify({ front: 'Flashcard Q', back: 'Flashcard A' })
      const formulaData = JSON.stringify({ title: 'Formula Q', formula: 'E = mc^2' })

      db.prepare("INSERT INTO cards VALUES ('c-flag1', 't-est', 'mcq', ?, 'EASY', '', 'EST-1.1', 0, 0, 0)").run(mcq1)
      db.prepare("INSERT INTO cards VALUES ('c-calc2', 't-est', 'mcq', ?, 'HARD', '', 'EST-4.6', 0, 0, 0)").run(mcq2)
      db.prepare("INSERT INTO cards VALUES ('c-flash3', 't-est', 'flashcard', ?, 'EASY', '', 'EST-1.1', 0, 0, 0)").run(flashData)
      db.prepare("INSERT INTO cards VALUES ('c-form4', 't-est', 'formula', ?, 'EASY', '', 'EST-1.1', 0, 0, 0)").run(formulaData)

      // Flag c-flag1
      flagQuestion(db, 'c-flag1', 'Other issue')

      // 1. Check getExcludedGauntletQuestions with default mode ('all')
      const allRes = getExcludedGauntletQuestions(db)
      expect(allRes.totalExcludedCount).toBe(2) // 1 flagged + 1 calc MCQ; flashcard and formula excluded!
      expect(allRes.flaggedCount).toBe(1)
      expect(allRes.autoExcludedCount).toBe(1)
      expect(allRes.cards.length).toBe(2)
      // Flagged cards should appear first
      expect(allRes.cards[0].id).toBe('c-flag1')
      expect(allRes.cards[0].exclusionType).toBe('flagged')
      expect(allRes.cards[1].id).toBe('c-calc2')
      expect(allRes.cards[1].exclusionType).toBe('problem_solving')

      // 2. Check getExcludedGauntletQuestions for flagged cards
      const flaggedRes = getExcludedGauntletQuestions(db, { type: 'flagged' })
      expect(flaggedRes.flaggedCount).toBe(1)
      expect(flaggedRes.cards.length).toBe(1)
      expect(flaggedRes.cards[0].id).toBe('c-flag1')
      expect(flaggedRes.cards[0].reason).toBe('Other issue')
      expect(flaggedRes.cards[0].subject).toBe('EST')
      expect(flaggedRes.cards[0].question).toBe('What does ASCII mean?')

      // c-calc2 is auto-excluded calculation problem
      const autoRes = getExcludedGauntletQuestions(db, { type: 'problem_solving' })
      expect(autoRes.autoExcludedCount).toBe(1)
      expect(autoRes.cards.length).toBe(1)
      expect(autoRes.cards[0].id).toBe('c-calc2')

      // c-flag1 is NOT in pool
      let pool = getPoolSizes(db)
      expect(pool.EST).toBe(0) // c-flag1 is flagged, c-calc2 is auto-excluded calculation

      // 3. Unflag/reinsert c-flag1 back into the fetching pool
      unflagQuestion(db, 'c-flag1')
      pool = getPoolSizes(db)
      expect(pool.EST).toBe(1) // c-flag1 is now back in the fetching pool!

      const flaggedAfter = getExcludedGauntletQuestions(db, { type: 'flagged' })
      expect(flaggedAfter.flaggedCount).toBe(0)

      // 4. Batch reinserting calculation problem c-calc2 overrides calculation heuristic
      reinsertQuestions(db, ['c-calc2'])
      pool = getPoolSizes(db)
      expect(pool.EST).toBe(2) // Both cards are now in the pool!
    })
  })

  describe('getTosTopicPerformanceStats', () => {
    it('returns natural sorted topics, accuracy, and study progress with scope support', () => {
      const db = createFreshDB()

      // Insert topics and cards across multiple ToS codes including 1.2 and 1.10
      db.prepare("INSERT INTO topics (id, name, subject) VALUES ('t1', 'Calculus', 'Mathematics')").run()
      db.prepare("INSERT INTO topics (id, name, subject) VALUES ('t2', 'Electronics', 'Electronics Engineering')").run()

      db.prepare(`
        INSERT INTO cards (id, topic_id, type, data, difficulty, tags, tos_topic_id, created_at)
        VALUES 
          ('c1', 't1', 'mcq', '{"question":"Limit 1","options":["A","B"],"answer":0}', 'medium', '', 'MATH-1.1', 1000),
          ('c2', 't1', 'mcq', '{"question":"Deriv 1","options":["A","B"],"answer":0}', 'medium', '', 'MATH-1.2', 1000),
          ('c3', 't1', 'mcq', '{"question":"Deriv 2","options":["A","B"],"answer":0}', 'medium', '', 'MATH-1.10', 1000),
          ('c4', 't2', 'mcq', '{"question":"Circuit 1","options":["A","B"],"answer":0}', 'medium', '', 'ELECS-1.1', 1000)
      `).run()

      // Insert Gauntlet answers
      db.prepare(`
        INSERT INTO gauntlet_answers (run_id, seq, card_id, subject, chosen, answer_index, outcome, time_ms, par_ms, points, streak_after, answered_at)
        VALUES
          ('r1', 1, 'c1', 'MATH', 0, 0, 'correct', 1000, 1000, 10, 1, 1000),
          ('r1', 2, 'c1', 'MATH', 1, 0, 'wrong', 1200, 1000, 0, 0, 1100),
          ('r1', 3, 'c2', 'MATH', 1, 0, 'wrong', 1200, 1000, 0, 0, 1200)
      `).run()

      // 1. Check default gauntlet scope and numeric syllabus sort
      const stats = getTosTopicPerformanceStats(db)
      expect(stats.length).toBe(4)
      
      // Check numeric sorting of MATH topics: 1.1, 1.2, then 1.10 (not lexicographical 1.10 before 1.2)
      const mathStats = stats.filter(s => s.subject === 'MATH')
      expect(mathStats.map(s => s.code)).toEqual(['1.1', '1.2', '1.10'])

      // Check stats for MATH-1.1
      const s1 = stats.find(s => s.tosTopicId === 'MATH-1.1')!
      expect(s1.totalCards).toBe(1)
      expect(s1.studiedCards).toBe(1)
      expect(s1.totalAnswers).toBe(2)
      expect(s1.correctAnswers).toBe(1)
      expect(s1.wrongAnswers).toBe(1)
      expect(s1.accuracy).toBe(0.5) // 50%
      expect(s1.studyProgress).toBe(100)

      // Check stats for MATH-1.2
      const s2 = stats.find(s => s.tosTopicId === 'MATH-1.2')!
      expect(s2.accuracy).toBe(0) // 0%
      expect(s2.wrongAnswers).toBe(1)

      // Check stats for untested topic MATH-1.10
      const s3 = stats.find(s => s.tosTopicId === 'MATH-1.10')!
      expect(s3.accuracy).toBeNull()
      expect(s3.totalAnswers).toBe(0)

      // 2. Filter by subject
      const elecsOnly = getTosTopicPerformanceStats(db, 'ELECS')
      expect(elecsOnly.length).toBe(1)
      expect(elecsOnly[0].subject).toBe('ELECS')

      // 3. Sort by lowest accuracy
      const sortedByAcc = getTosTopicPerformanceStats(db, undefined, 'gauntlet', 'accuracy_asc')
      // MATH-1.2 (0%) should come before MATH-1.1 (50%)
      expect(sortedByAcc[0].tosTopicId).toBe('MATH-1.2')

      // 4. Test 'all' scope with attempt_log table
      db.prepare(`
        CREATE TABLE IF NOT EXISTS attempt_log (
          id TEXT PRIMARY KEY,
          card_id TEXT,
          mode TEXT,
          correct INTEGER,
          created_at INTEGER
        )
      `).run()

      db.prepare(`
        INSERT INTO attempt_log (id, card_id, mode, correct, created_at)
        VALUES ('a1', 'c2', 'learn', 1, 2000)
      `).run()

      const allScopeStats = getTosTopicPerformanceStats(db, undefined, 'all')
      const s2All = allScopeStats.find(s => s.tosTopicId === 'MATH-1.2')!
      // In 'all' scope, c2 now has 1 gauntlet wrong + 1 learn correct = 2 total answers, 1 correct => 50%
      expect(s2All.totalAnswers).toBe(2)
      expect(s2All.correctAnswers).toBe(1)
      expect(s2All.accuracy).toBe(0.5)
    })
  })

  describe('Global Stats vs Gauntlet Scope for Question Fetching and Weak Topics', () => {
    it('prefers cards unseen across all modes when using default global scope', () => {
      insertCard(db, 'global-c1', 'top-elecs')
      insertCard(db, 'global-c2', 'top-elecs')

      db.prepare(`
        CREATE TABLE IF NOT EXISTS attempt_log (
          id TEXT PRIMARY KEY,
          card_id TEXT,
          mode TEXT,
          correct INTEGER,
          created_at INTEGER
        )
      `).run()

      // Log attempt for global-c1 in Learn Mode (attempt_log)
      db.prepare(`
        INSERT INTO attempt_log (id, card_id, mode, correct, created_at)
        VALUES ('att-1', 'global-c1', 'learn', 1, 3000)
      `).run()

      // Default scope is 'all': global-c2 (unseen in all modes) is preferred over global-c1 (seen in learn mode)
      const sampledAll = sampleQuestions(db, 'ELECS', 1)
      expect(sampledAll.length).toBe(1)
      expect(sampledAll[0].id).toBe('global-c2')

      // Gauntlet scope: global-c1 is unseen in Gauntlet, so both are considered unseen in Gauntlet
      const sampledGauntlet = sampleQuestions(db, 'ELECS', 2, [], { scope: 'gauntlet' })
      expect(sampledGauntlet.length).toBe(2)
      const ids = sampledGauntlet.map(c => c.id)
      expect(ids).toContain('global-c1')
      expect(ids).toContain('global-c2')
    })

    it('identifies weak topics from attempt_log when scope is all', () => {
      insertCard(db, 'weak-t1-c1', 'top-elecs', 'mcq', { question: 'Q1', choices: ['A', 'B'], answerIndex: 0 }, 'ELECS-9.1')
      insertCard(db, 'weak-t1-c2', 'top-elecs', 'mcq', { question: 'Q2', choices: ['A', 'B'], answerIndex: 0 }, 'ELECS-9.1')

      db.prepare(`
        CREATE TABLE IF NOT EXISTS attempt_log (
          id TEXT PRIMARY KEY,
          card_id TEXT,
          mode TEXT,
          correct INTEGER,
          created_at INTEGER
        )
      `).run()

      // Insert 3 attempts for ELECS-9.1 with only 1 correct (33.3% accuracy < 70%)
      db.prepare(`
        INSERT INTO attempt_log (id, card_id, mode, correct, created_at)
        VALUES ('att-w1', 'weak-t1-c1', 'learn', 0, 4000),
               ('att-w2', 'weak-t1-c1', 'learn', 0, 4001),
               ('att-w3', 'weak-t1-c2', 'learn', 1, 4002)
      `).run()

      // With scope 'gauntlet': empty (no gauntlet answers for this topic)
      const weakGauntlet = getWeakTosTopics(db, 'ELECS', 5, undefined, 'accuracy', 'gauntlet')
      expect(weakGauntlet.find(w => w.tosTopicId === 'ELECS-9.1')).toBeUndefined()

      // With scope 'all': recognizes ELECS-9.1 as weak from learn attempts
      const weakAll = getWeakTosTopics(db, 'ELECS', 5, undefined, 'accuracy', 'all')
      const found = weakAll.find(w => w.tosTopicId === 'ELECS-9.1')
      expect(found).toBeDefined()
      expect(found!.totalAnswers).toBe(3)
      expect(found!.accuracy).toBeCloseTo(0.33, 2)
    })
  })
})

