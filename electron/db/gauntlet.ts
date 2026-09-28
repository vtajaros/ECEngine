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
  `CREATE TABLE IF NOT EXISTS gauntlet_daily_review_elo (
     subject TEXT NOT NULL,
     date TEXT NOT NULL,
     gained REAL NOT NULL DEFAULT 0,
     PRIMARY KEY (subject, date)
   )`,
  'CREATE INDEX IF NOT EXISTS idx_gauntlet_runs_started ON gauntlet_runs(started_at)',
  'CREATE INDEX IF NOT EXISTS idx_gauntlet_answers_run ON gauntlet_answers(run_id, seq)',
  'CREATE INDEX IF NOT EXISTS idx_gauntlet_answers_card ON gauntlet_answers(card_id)',
  'CREATE INDEX IF NOT EXISTS idx_gauntlet_flagged_card ON gauntlet_flagged_cards(card_id)',
]

// Exclude calculation/problem-solving questions:
// 1. Cards with a solution image containing numbers/math.
// 2. Questions where choices are predominantly numerical / measurements (e.g. "859 Hz", "38.1 dBW", "1.6 bps", "400 Mbits/s").
// 3. Calculation stems ("Calculate...", "Determine...", "Compute...", "Find the...") with numeric choices.
// Concept questions (definitions, principles, and pure concept diagrams) remain playable.
const NOT_PROBLEM_SOLVING = `(
  NOT (
    (json_extract(c.data, '$.solutionImagePath') IS NOT NULL AND json_extract(c.data, '$.solutionImagePath') != '' AND json_extract(c.data, '$.choices') GLOB '*[0-9]*')
    OR
    (
      (
        json_extract(c.data, '$.choices[0]') GLOB '[0-9]*'
        OR json_extract(c.data, '$.choices[0]') GLOB '[-+.]*'
        OR json_extract(c.data, '$.choices[0]') GLOB '([0-9]*'
        OR json_extract(c.data, '$.choices[0]') GLOB '$*'
      )
      AND (
        json_extract(c.data, '$.choices[1]') GLOB '[0-9]*'
        OR json_extract(c.data, '$.choices[1]') GLOB '[-+.]*'
        OR json_extract(c.data, '$.choices[1]') GLOB '([0-9]*'
        OR json_extract(c.data, '$.choices[1]') GLOB '$*'
      )
    )
    OR
    (
      json_extract(c.data, '$.choices') GLOB '*[0-9]*'
      AND (
        json_extract(c.data, '$.question') LIKE 'Calculate %'
        OR json_extract(c.data, '$.question') LIKE 'Determine %'
        OR json_extract(c.data, '$.question') LIKE 'Compute %'
        OR json_extract(c.data, '$.question') LIKE 'Find the %'
      )
    )
  )
)`
const VALID_MCQ = `(json_type(c.data, '$.choices') = 'array' AND json_array_length(c.data, '$.choices') >= 2)`
const NOT_FLAGGED = `(c.id NOT IN (SELECT card_id FROM gauntlet_flagged_cards))`

const safeParse = (s: unknown): unknown => {
  if (typeof s !== 'string') return null
  try { return JSON.parse(s) } catch { return null }
}

export function getPoolSizes(
  db: Database.Database,
  options?: { allowSolutions?: boolean; tosTopicId?: string; tosTopicIds?: string[] } | boolean,
): Record<GauntletSubjectCode, number> {
  const allowSolutions = typeof options === 'boolean' ? options : options?.allowSolutions ?? false
  const topicIds = typeof options === 'object'
    ? options?.tosTopicIds?.length
      ? options.tosTopicIds
      : options?.tosTopicId
        ? [options.tosTopicId]
        : []
    : []
  const out: Record<GauntletSubjectCode, number> = { MATH: 0, GEAS: 0, ELECS: 0, EST: 0 }
  const solutionClause = allowSolutions ? '1=1' : NOT_PROBLEM_SOLVING

  let topicClause = '1=1'
  const topicParams: string[] = []
  if (topicIds.length > 0) {
    const clauses: string[] = []
    for (const tid of topicIds) {
      if (tid.endsWith('.0')) {
        const prefix = tid.replace(/\.0$/, '')
        clauses.push('(c.tos_topic_id = ? OR c.tos_topic_id LIKE ?)')
        topicParams.push(tid, `${prefix}.%`)
      } else {
        clauses.push('c.tos_topic_id = ?')
        topicParams.push(tid)
      }
    }
    topicClause = `(${clauses.join(' OR ')})`
  }

  const stmt = db.prepare(`
    SELECT COUNT(*) AS n
    FROM cards c JOIN topics t ON t.id = c.topic_id
    WHERE c.type = 'mcq' AND t.subject = ? AND ${solutionClause} AND ${VALID_MCQ} AND ${NOT_FLAGGED} AND ${topicClause}
  `)
  ;(Object.keys(SUBJECT_DB_NAME) as GauntletSubjectCode[]).forEach(code => {
    out[code] = (stmt.get(SUBJECT_DB_NAME[code], ...topicParams) as { n: number }).n
  })
  return out
}

export interface WeakTopicStat {
  tosTopicId: string
  subject: GauntletSubjectCode
  totalAnswers: number
  correctAnswers: number
  wrongAnswers: number
  accuracy: number
}

/**
 * Return user's weakest Table of Specifications (TOS) topics from Gauntlet history.
 * A topic is flagged as weak if the user has answered at least 3 questions in it and accuracy < 70%.
 */
export function getWeakTosTopics(
  db: Database.Database,
  subject?: GauntletSubjectCode,
  limit = 5,
  mode?: 'all' | 'survival' | 'timed',
  sortBy: 'misses' | 'accuracy' = 'accuracy',
): WeakTopicStat[] {
  let sql = `
    SELECT c.tos_topic_id,
           t.subject,
           COUNT(*) as total_answers,
           SUM(CASE WHEN a.outcome = 'correct' THEN 1 ELSE 0 END) as correct_answers,
           SUM(CASE WHEN a.outcome IN ('wrong', 'timeout') THEN 1 ELSE 0 END) as wrong_answers,
           CAST(SUM(CASE WHEN a.outcome = 'correct' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as accuracy
    FROM gauntlet_answers a
    JOIN cards c ON c.id = a.card_id
    JOIN topics t ON t.id = c.topic_id
    LEFT JOIN gauntlet_runs r ON r.id = a.run_id
    WHERE c.tos_topic_id IS NOT NULL AND c.tos_topic_id != ''
  `
  const params: unknown[] = []
  if (subject) {
    sql += ` AND t.subject = ?`
    params.push(SUBJECT_DB_NAME[subject])
  }
  if (mode && mode !== 'all') {
    sql += ` AND r.mode = ?`
    params.push(mode)
  }
  sql += `
    GROUP BY c.tos_topic_id
    HAVING total_answers >= 3 AND accuracy < 0.70
  `
  if (sortBy === 'misses') {
    sql += ` ORDER BY wrong_answers DESC, accuracy ASC`
  } else {
    sql += ` ORDER BY accuracy ASC, wrong_answers DESC`
  }
  sql += `
    LIMIT ?
  `
  params.push(limit)

  try {
    const rows = db.prepare(sql).all(...params) as Array<{
      tos_topic_id: string
      subject: string
      total_answers: number
      correct_answers: number
      wrong_answers: number
      accuracy: number
    }>

    return rows.map(r => {
      let code: GauntletSubjectCode = 'MATH'
      for (const [k, v] of Object.entries(SUBJECT_DB_NAME)) {
        if (v === r.subject) {
          code = k as GauntletSubjectCode
          break
        }
      }
      return {
        tosTopicId: r.tos_topic_id,
        subject: code,
        totalAnswers: r.total_answers,
        correctAnswers: r.correct_answers,
        wrongAnswers: r.wrong_answers,
        accuracy: Math.round(r.accuracy * 100) / 100,
      }
    })
  } catch {
    return []
  }
}

/** Random MCQs for one subject: prioritizing struggling TOS topics, then unseen-in-Gauntlet first, then previously seen, always random within each group. */
export function sampleQuestions(
  db: Database.Database,
  subject: GauntletSubjectCode,
  count: number,
  excludeIds: string[] = [],
  options?: { allowSolutions?: boolean; tosTopicId?: string; tosTopicIds?: string[] } | boolean,
): Array<Record<string, unknown>> {
  if (count <= 0) return []

  const allowSolutions = typeof options === 'boolean' ? options : options?.allowSolutions ?? false
  const filterTopicIds = typeof options === 'object'
    ? options?.tosTopicIds?.length
      ? options.tosTopicIds
      : options?.tosTopicId
        ? [options.tosTopicId]
        : []
    : []
  const solutionClause = allowSolutions ? '1=1' : NOT_PROBLEM_SOLVING
  const weakTopics = getWeakTosTopics(db, subject, 5).map(w => w.tosTopicId)

  let topicClause = '1=1'
  const extraParams: string[] = []
  if (filterTopicIds.length > 0) {
    const clauses: string[] = []
    for (const tid of filterTopicIds) {
      if (tid.endsWith('.0')) {
        const prefix = tid.replace(/\.0$/, '')
        clauses.push('(c.tos_topic_id = ? OR c.tos_topic_id LIKE ?)')
        extraParams.push(tid, `${prefix}.%`)
      } else {
        clauses.push('c.tos_topic_id = ?')
        extraParams.push(tid)
      }
    }
    topicClause = `(${clauses.join(' OR ')})`
  }

  const sampled = db.prepare(`
    SELECT c.id, c.topic_id, c.type, c.data, c.difficulty, c.tags, c.is_custom, c.created_at, c.tos_topic_id, t.subject, t.name AS deck_name
    FROM cards c
    JOIN topics t ON t.id = c.topic_id
    LEFT JOIN (SELECT DISTINCT card_id FROM gauntlet_answers) g ON g.card_id = c.id
    WHERE c.type = 'mcq' AND t.subject = ? AND ${solutionClause} AND ${VALID_MCQ} AND ${NOT_FLAGGED} AND ${topicClause}
      AND c.id NOT IN (SELECT value FROM json_each(?))
    ORDER BY
      CASE WHEN c.tos_topic_id IN (SELECT value FROM json_each(?)) THEN 0 ELSE 1 END,
      (g.card_id IS NOT NULL),
      RANDOM()
    LIMIT ?
  `).all(
    SUBJECT_DB_NAME[subject],
    ...extraParams,
    JSON.stringify(excludeIds),
    JSON.stringify(weakTopics),
    count,
  ) as Array<Record<string, unknown>>

  if (sampled.length === 0) return []

  const topicIds = Array.from(new Set(sampled.map(r => r.topic_id as string).filter(Boolean)))
  const topicCardMap = new Map<string, { index: number; total: number }>()

  if (topicIds.length > 0) {
    const placeholders = topicIds.map(() => '?').join(',')
    let allTopicCards: Array<{ id: string; topic_id: string }> = []
    try {
      allTopicCards = db.prepare(`
        SELECT id, topic_id
        FROM cards
        WHERE topic_id IN (${placeholders})
        ORDER BY order_index ASC, created_at ASC
      `).all(...topicIds) as Array<{ id: string; topic_id: string }>
    } catch {
      allTopicCards = db.prepare(`
        SELECT id, topic_id
        FROM cards
        WHERE topic_id IN (${placeholders})
        ORDER BY created_at ASC
      `).all(...topicIds) as Array<{ id: string; topic_id: string }>
    }

    const byTopic = new Map<string, string[]>()
    for (const tc of allTopicCards) {
      if (!byTopic.has(tc.topic_id)) byTopic.set(tc.topic_id, [])
      byTopic.get(tc.topic_id)!.push(tc.id)
    }

    for (const [_, ids] of byTopic) {
      ids.forEach((id, idx) => {
        topicCardMap.set(id, { index: idx + 1, total: ids.length })
      })
    }
  }

  return sampled.map(r => {
    const pos = topicCardMap.get(r.id as string)
    return {
      ...r,
      subject_code: subject,
      deck_name: (r.deck_name as string) || 'Deck',
      card_number: pos?.index ?? 1,
      total_in_deck: pos?.total ?? 1,
    }
  })
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

  const hasProgress = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='progress'").get()
  const upsertProgressOnCorrect = hasProgress
    ? db.prepare(`
        INSERT INTO progress
          (card_id, ease_factor, interval, repetitions,
           correct_count, total_count, last_result, last_reviewed)
        VALUES (?, 2.5, 1, 0, 1, 1, 'correct', ?)
        ON CONFLICT(card_id) DO UPDATE SET
          total_count   = total_count + 1,
          correct_count = correct_count + 1,
          last_result   = 'correct',
          last_reviewed = excluded.last_reviewed
      `)
    : null

  const touchProgressOnWrong = hasProgress
    ? db.prepare(`
        INSERT INTO progress
          (card_id, ease_factor, interval, repetitions,
           correct_count, total_count, last_result, last_reviewed)
        VALUES (?, 2.5, 1, 0, 0, 1, 'wrong', ?)
        ON CONFLICT(card_id) DO UPDATE SET
          total_count   = total_count + 1,
          last_result   = CASE WHEN progress.last_result = 'correct' THEN 'correct' ELSE 'wrong' END,
          last_reviewed = excluded.last_reviewed
      `)
    : null

  db.transaction(() => {
    insertRun.run(
      run.id, run.startedAt, run.endedAt, run.mode, JSON.stringify(run.config ?? {}), run.rated ? 1 : 0,
      run.score, run.answered, run.correct, run.wrong, run.skipped, run.bestStreak, run.durationMs, run.endReason,
      run.ratingsBefore ? JSON.stringify(run.ratingsBefore) : null,
      run.ratingsAfter ? JSON.stringify(run.ratingsAfter) : null,
      run.subjectBreakdown ? JSON.stringify(run.subjectBreakdown) : null,
    )
    const localToday = new Date().toISOString().slice(0, 10)
    for (const a of run.answers) {
      insertAnswer.run(
        run.id, a.seq, a.cardId, a.subject, a.chosen, a.answerIndex, a.outcome, a.timeMs, a.parMs,
        a.points, a.streakAfter, JSON.stringify(a.choices ?? []), a.answeredAt,
      )
      if (hasProgress) {
        if (a.outcome === 'correct') {
          upsertProgressOnCorrect!.run(a.cardId, localToday)
        } else if (a.outcome === 'wrong' || a.outcome === 'timeout') {
          touchProgressOnWrong!.run(a.cardId, localToday)
        }
      }
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

export function rewardReviewElo(
  db: Database.Database,
  subjectCode: string,
): { gained: number; newRating: number } {
  let code = subjectCode as GauntletSubjectCode
  if (!['MATH', 'GEAS', 'ELECS', 'EST'].includes(code)) {
    const entry = Object.entries(SUBJECT_DB_NAME).find(([_, name]) => name.toLowerCase() === subjectCode.toLowerCase())
    if (entry) code = entry[0] as GauntletSubjectCode
  }
  if (!['MATH', 'GEAS', 'ELECS', 'EST'].includes(code)) {
    return { gained: 0, newRating: 500 }
  }

  const localToday = new Date().toISOString().slice(0, 10)

  // Ensure table exists just in case
  db.exec(`
    CREATE TABLE IF NOT EXISTS gauntlet_daily_review_elo (
      subject TEXT NOT NULL,
      date TEXT NOT NULL,
      gained REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (subject, date)
    )
  `)

  const row = db.prepare('SELECT rating, answers, peak FROM gauntlet_ratings WHERE subject = ?').get(code) as { rating: number; answers: number; peak: number | null } | undefined
  const currentRating = row?.rating ?? 500
  const answers = row?.answers ?? 0
  const currentPeak = row?.peak ?? currentRating

  // Only Insulator (< 800) and Semiconductor (< 1000) receive review bonuses
  let reward = 0
  if (currentRating < 800) {
    reward = 0.5 // Insulator
  } else if (currentRating < 1000) {
    reward = 0.2 // Semiconductor
  } else {
    return { gained: 0, newRating: currentRating }
  }

  const dailyRow = db.prepare('SELECT gained FROM gauntlet_daily_review_elo WHERE subject = ? AND date = ?').get(code, localToday) as { gained: number } | undefined
  const dailyGained = dailyRow?.gained ?? 0
  if (dailyGained >= 25.0) {
    return { gained: 0, newRating: currentRating }
  }

  const allowable = Math.min(reward, 25.0 - dailyGained)
  if (allowable <= 0) {
    return { gained: 0, newRating: currentRating }
  }

  const nextRating = Math.round((currentRating + allowable) * 10) / 10
  const nextPeak = Math.max(currentPeak, nextRating)
  const now = Date.now()

  db.transaction(() => {
    db.prepare(`
      INSERT INTO gauntlet_ratings (subject, rating, answers, peak, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(subject) DO UPDATE SET
        rating = excluded.rating,
        peak = MAX(COALESCE(gauntlet_ratings.peak, excluded.rating), excluded.rating),
        updated_at = excluded.updated_at
    `).run(code, nextRating, answers, nextPeak, now)

    db.prepare(`
      INSERT INTO gauntlet_daily_review_elo (subject, date, gained)
      VALUES (?, ?, ?)
      ON CONFLICT(subject, date) DO UPDATE SET
        gained = gauntlet_daily_review_elo.gained + excluded.gained
    `).run(code, localToday, allowable)
  })()

  return { gained: allowable, newRating: nextRating }
}


