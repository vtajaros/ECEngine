// electron/db/gauntlet.ts
// Gauntlet persistence. Pure functions taking a db handle (unit-testable with :memory:).
import Database from 'better-sqlite3'

export type GauntletSubjectCode = 'MATH' | 'GEAS' | 'ELECS' | 'EST'

export const SUBJECT_DB_NAME: Record<GauntletSubjectCode, string> = {
  MATH: 'Mathematics',
  GEAS: 'General Engineering & Applied Sciences',
  ELECS: 'Electronics Engineering',
  EST: 'Electronics Systems & Technologies',
}

export const GAUNTLET_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS gauntlet_runs (
     id TEXT PRIMARY KEY,
     started_at INTEGER NOT NULL,
     ended_at INTEGER NOT NULL,
     mode TEXT NOT NULL,
     config TEXT NOT NULL,
     rated INTEGER NOT NULL DEFAULT 0,
     score INTEGER NOT NULL,
     answered INTEGER NOT NULL,
     correct INTEGER NOT NULL,
     wrong INTEGER NOT NULL,
     skipped INTEGER NOT NULL,
     best_streak INTEGER NOT NULL,
     duration_ms INTEGER NOT NULL,
     end_reason TEXT NOT NULL,
     ratings_before TEXT,
     ratings_after TEXT,
     subject_breakdown TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS gauntlet_answers (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     run_id TEXT NOT NULL,
     seq INTEGER NOT NULL,
     card_id TEXT NOT NULL,
     subject TEXT NOT NULL,
     chosen INTEGER,
     answer_index INTEGER NOT NULL,
     outcome TEXT NOT NULL,
     time_ms INTEGER NOT NULL,
     par_ms INTEGER NOT NULL,
     points INTEGER NOT NULL,
     streak_after INTEGER NOT NULL,
     choices TEXT,
     answered_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS gauntlet_ratings (
     subject TEXT PRIMARY KEY,
     rating REAL NOT NULL,
     answers INTEGER NOT NULL DEFAULT 0,
     peak REAL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS gauntlet_flagged_cards (
     card_id TEXT PRIMARY KEY,
     reason TEXT,
     flagged_at INTEGER NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS idx_gauntlet_runs_started ON gauntlet_runs(started_at)',
  'CREATE INDEX IF NOT EXISTS idx_gauntlet_answers_run ON gauntlet_answers(run_id, seq)',
  'CREATE INDEX IF NOT EXISTS idx_gauntlet_answers_card ON gauntlet_answers(card_id)',
  'CREATE INDEX IF NOT EXISTS idx_gauntlet_flagged_card ON gauntlet_flagged_cards(card_id)',
]

// Problem-solving MCQs carry a solution image; Gauntlet v1 excludes them.
const NOT_PROBLEM_SOLVING = `(json_extract(c.data, '$.solutionImagePath') IS NULL OR json_extract(c.data, '$.solutionImagePath') = '')`
const VALID_MCQ = `(json_type(c.data, '$.choices') = 'array' AND json_array_length(c.data, '$.choices') >= 2)`
const NOT_FLAGGED = `(c.id NOT IN (SELECT card_id FROM gauntlet_flagged_cards))`

const safeParse = (s: unknown): unknown => {
  if (typeof s !== 'string') return null
  try { return JSON.parse(s) } catch { return null }
}

export function getPoolSizes(db: Database.Database): Record<GauntletSubjectCode, number> {
  const out: Record<GauntletSubjectCode, number> = { MATH: 0, GEAS: 0, ELECS: 0, EST: 0 }
  const stmt = db.prepare(`
    SELECT COUNT(*) AS n
    FROM cards c JOIN topics t ON t.id = c.topic_id
    WHERE c.type = 'mcq' AND t.subject = ? AND ${NOT_PROBLEM_SOLVING} AND ${VALID_MCQ} AND ${NOT_FLAGGED}
  `)
  ;(Object.keys(SUBJECT_DB_NAME) as GauntletSubjectCode[]).forEach(code => {
    out[code] = (stmt.get(SUBJECT_DB_NAME[code]) as { n: number }).n
  })
  return out
}

/** Random MCQs for one subject: unseen-in-Gauntlet first, then previously seen, always random within each group. */
export function sampleQuestions(
  db: Database.Database,
  subject: GauntletSubjectCode,
  count: number,
  excludeIds: string[] = [],
): Array<Record<string, unknown>> {
  if (count <= 0) return []
  const rows = db.prepare(`
    SELECT c.id, c.topic_id, c.type, c.data, c.difficulty, c.tags, c.is_custom, c.created_at, t.subject
    FROM cards c
    JOIN topics t ON t.id = c.topic_id
    LEFT JOIN (SELECT DISTINCT card_id FROM gauntlet_answers) g ON g.card_id = c.id
    WHERE c.type = 'mcq' AND t.subject = ? AND ${NOT_PROBLEM_SOLVING} AND ${VALID_MCQ} AND ${NOT_FLAGGED}
      AND c.id NOT IN (SELECT value FROM json_each(?))
    ORDER BY (g.card_id IS NOT NULL), RANDOM()
    LIMIT ?
  `).all(SUBJECT_DB_NAME[subject], JSON.stringify(excludeIds), count) as Array<Record<string, unknown>>
  return rows.map(r => ({ ...r, subject_code: subject }))
}

export interface RatingsMap {
  MATH?: { rating: number; answers: number }
  GEAS?: { rating: number; answers: number }
  ELECS?: { rating: number; answers: number }
  EST?: { rating: number; answers: number }
}

export interface GauntletAnswerInput {
  seq: number
  cardId: string
  subject: GauntletSubjectCode
  chosen: number | null
  answerIndex: number
  outcome: 'correct' | 'wrong' | 'skipped' | 'timeout'
  timeMs: number
  parMs: number
  points: number
  streakAfter: number
  choices: string[]
  answeredAt: number
}

export interface GauntletRunInput {
  id: string
  startedAt: number
  endedAt: number
  mode: 'survival' | 'timed'
  config: unknown
  rated: boolean
  score: number
  answered: number
  correct: number
  wrong: number
  skipped: number
  bestStreak: number
  durationMs: number
  endReason: 'time' | 'lives' | 'queue' | 'quit'
  ratingsBefore?: RatingsMap
  ratingsAfter?: RatingsMap
  subjectBreakdown?: unknown
  answers: GauntletAnswerInput[]
}

/** Atomically stores a run + its answers and, for rated runs, upserts per-subject ratings. */
export function saveRun(db: Database.Database, run: GauntletRunInput): void {
  const insertRun = db.prepare(`
    INSERT INTO gauntlet_runs
      (id, started_at, ended_at, mode, config, rated, score, answered, correct, wrong, skipped,
       best_streak, duration_ms, end_reason, ratings_before, ratings_after, subject_breakdown)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertAnswer = db.prepare(`
    INSERT INTO gauntlet_answers
      (run_id, seq, card_id, subject, chosen, answer_index, outcome, time_ms, par_ms, points, streak_after, choices, answered_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const upsertRating = db.prepare(`
    INSERT INTO gauntlet_ratings (subject, rating, answers, peak, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(subject) DO UPDATE SET
      rating = excluded.rating,
      answers = excluded.answers,
      peak = MAX(COALESCE(gauntlet_ratings.peak, excluded.rating), excluded.rating),
      updated_at = excluded.updated_at
  `)

  db.transaction(() => {
    insertRun.run(
      run.id, run.startedAt, run.endedAt, run.mode, JSON.stringify(run.config ?? {}), run.rated ? 1 : 0,
      run.score, run.answered, run.correct, run.wrong, run.skipped, run.bestStreak, run.durationMs, run.endReason,
      run.ratingsBefore ? JSON.stringify(run.ratingsBefore) : null,
      run.ratingsAfter ? JSON.stringify(run.ratingsAfter) : null,
      run.subjectBreakdown ? JSON.stringify(run.subjectBreakdown) : null,
    )
    for (const a of run.answers) {
      insertAnswer.run(
        run.id, a.seq, a.cardId, a.subject, a.chosen, a.answerIndex, a.outcome, a.timeMs, a.parMs,
        a.points, a.streakAfter, JSON.stringify(a.choices ?? []), a.answeredAt,
      )
    }
    if (run.rated && run.ratingsAfter) {
      for (const [subject, r] of Object.entries(run.ratingsAfter)) {
        if (r) upsertRating.run(subject, r.rating, r.answers, r.rating, run.endedAt)
      }
    }
  })()
}

export function getRatings(db: Database.Database): Array<{ subject: string; rating: number; answers: number; peak: number | null }> {
  return db.prepare('SELECT subject, rating, answers, peak FROM gauntlet_ratings').all() as any[]
}

export function getRuns(db: Database.Database, limit = 50, offset = 0) {
  const rows = db.prepare('SELECT * FROM gauntlet_runs ORDER BY started_at DESC LIMIT ? OFFSET ?').all(limit, offset) as any[]
  return rows.map(r => ({
    id: r.id as string,
    startedAt: r.started_at as number,
    endedAt: r.ended_at as number,
    mode: r.mode as string,
    config: safeParse(r.config),
    rated: !!r.rated,
    score: r.score as number,
    answered: r.answered as number,
    correct: r.correct as number,
    wrong: r.wrong as number,
    skipped: r.skipped as number,
    bestStreak: r.best_streak as number,
    durationMs: r.duration_ms as number,
    endReason: r.end_reason as string,
    ratingsBefore: safeParse(r.ratings_before),
    ratingsAfter: safeParse(r.ratings_after),
    subjectBreakdown: safeParse(r.subject_breakdown),
  }))
}

export function getRunAnswers(db: Database.Database, runId: string) {
  const rows = db.prepare('SELECT * FROM gauntlet_answers WHERE run_id = ? ORDER BY seq').all(runId) as any[]
  return rows.map(r => ({
    seq: r.seq as number,
    cardId: r.card_id as string,
    subject: r.subject as string,
    chosen: r.chosen as number | null,
    answerIndex: r.answer_index as number,
    outcome: r.outcome as string,
    timeMs: r.time_ms as number,
    parMs: r.par_ms as number,
    points: r.points as number,
    streakAfter: r.streak_after as number,
    choices: (safeParse(r.choices) as string[] | null) ?? [],
    answeredAt: r.answered_at as number,
  }))
}

export function getBests(db: Database.Database) {
  return db.prepare(`
    SELECT mode, MAX(score) AS bestScore, MAX(best_streak) AS bestStreak, COUNT(*) AS runs
    FROM gauntlet_runs GROUP BY mode
  `).all() as Array<{ mode: string; bestScore: number; bestStreak: number; runs: number }>
}

export function getPaceStats(db: Database.Database): Array<{ subject: GauntletSubjectCode; n: number; avgMs: number }> {
  return db.prepare(`
    SELECT subject, COUNT(*) AS n, AVG(time_ms) AS avgMs
    FROM (
      SELECT subject, time_ms FROM gauntlet_answers
      WHERE outcome IN ('correct','wrong') AND time_ms >= 1200
      ORDER BY id DESC LIMIT 800
    )
    GROUP BY subject
  `).all() as Array<{ subject: GauntletSubjectCode; n: number; avgMs: number }>
}

export function clearGauntletData(db: Database.Database): void {
  db.transaction(() => {
    db.prepare('DELETE FROM gauntlet_answers').run()
    db.prepare('DELETE FROM gauntlet_runs').run()
    db.prepare('DELETE FROM gauntlet_ratings').run()
  })()
}

export function resetRatings(db: Database.Database): void {
  db.prepare('DELETE FROM gauntlet_ratings').run()
}

export function flagQuestion(db: Database.Database, cardId: string, reason?: string): void {
  db.prepare(`
    INSERT INTO gauntlet_flagged_cards (card_id, reason, flagged_at)
    VALUES (?, ?, ?)
    ON CONFLICT(card_id) DO UPDATE SET reason = excluded.reason, flagged_at = excluded.flagged_at
  `).run(cardId, reason ?? null, Date.now())
}

export function unflagQuestion(db: Database.Database, cardId: string): void {
  db.prepare('DELETE FROM gauntlet_flagged_cards WHERE card_id = ?').run(cardId)
}

export function getFlaggedQuestions(
  db: Database.Database,
  cardIds?: string[],
): Record<string, { reason: string | null; flaggedAt: number }> {
  let rows: Array<{ card_id: string; reason: string | null; flagged_at: number }> = []
  if (cardIds && cardIds.length > 0) {
    rows = db.prepare(`
      SELECT card_id, reason, flagged_at
      FROM gauntlet_flagged_cards
      WHERE card_id IN (SELECT value FROM json_each(?))
    `).all(JSON.stringify(cardIds)) as any[]
  } else {
    rows = db.prepare('SELECT card_id, reason, flagged_at FROM gauntlet_flagged_cards').all() as any[]
  }
  const result: Record<string, { reason: string | null; flaggedAt: number }> = {}
  for (const r of rows) {
    result[r.card_id] = { reason: r.reason, flaggedAt: r.flagged_at }
  }
  return result
}

