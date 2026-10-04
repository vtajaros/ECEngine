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
  `CREATE TABLE IF NOT EXISTS gauntlet_allowed_cards (
     card_id TEXT PRIMARY KEY,
     allowed_at INTEGER NOT NULL
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
  'CREATE INDEX IF NOT EXISTS idx_gauntlet_allowed_card ON gauntlet_allowed_cards(card_id)',
]

export function ensureGauntletTables(db: Database.Database): void {
  for (const sql of GAUNTLET_DDL) {
    db.prepare(sql).run()
  }
}

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
const ALLOWED_OVERRIDE = `(c.id IN (SELECT card_id FROM gauntlet_allowed_cards))`

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
  const solutionClause = allowSolutions ? '1=1' : `(${NOT_PROBLEM_SOLVING} OR ${ALLOWED_OVERRIDE})`

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

export interface TosTopicPerformanceStat {
  tosTopicId: string
  code: string
  subject: GauntletSubjectCode
  totalCards: number
  studiedCards: number
  totalAnswers: number
  correctAnswers: number
  wrongAnswers: number
  accuracy: number | null
  studyProgress: number
}

/**
 * Return comprehensive performance statistics for all ToS topics in the syllabus.
 * Supports filtering by subject, scope (Gauntlet-only vs All study modes), and sorting.
 */
export function getTosTopicPerformanceStats(
  db: Database.Database,
  subject?: GauntletSubjectCode,
  scope: 'gauntlet' | 'all' = 'gauntlet',
  sortBy: 'code' | 'accuracy_asc' | 'accuracy_desc' | 'misses' | 'attempts' = 'code',
): TosTopicPerformanceStat[] {
  try {
    ensureGauntletTables(db)

    const hasAttemptLog = scope === 'all' && !!db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='attempt_log'"
    ).get()

    let attemptsSql = `
      SELECT a.card_id, a.outcome, CASE WHEN a.outcome = 'correct' THEN 1 ELSE 0 END as is_correct
      FROM gauntlet_answers a
    `
    if (hasAttemptLog) {
      attemptsSql += `
        UNION ALL
        SELECT card_id, CASE WHEN correct = 1 THEN 'correct' ELSE 'wrong' END as outcome, correct as is_correct
        FROM attempt_log
      `
    }

    let sql = `
      WITH card_counts AS (
        SELECT c.tos_topic_id,
               t.subject,
               COUNT(DISTINCT c.id) as total_cards
        FROM cards c
        JOIN topics t ON t.id = c.topic_id
        WHERE c.tos_topic_id IS NOT NULL AND c.tos_topic_id != ''
        GROUP BY c.tos_topic_id
      ),
      answer_counts AS (
        SELECT c.tos_topic_id,
               COUNT(*) as total_answers,
               SUM(CASE WHEN u.outcome = 'correct' THEN 1 ELSE 0 END) as correct_answers,
               SUM(CASE WHEN u.outcome IN ('wrong', 'timeout') THEN 1 ELSE 0 END) as wrong_answers,
               COUNT(DISTINCT u.card_id) as studied_cards
        FROM (${attemptsSql}) u
        JOIN cards c ON c.id = u.card_id
        WHERE c.tos_topic_id IS NOT NULL AND c.tos_topic_id != ''
        GROUP BY c.tos_topic_id
      )
      SELECT cc.tos_topic_id,
             cc.subject,
             cc.total_cards,
             COALESCE(ac.studied_cards, 0) as studied_cards,
             COALESCE(ac.total_answers, 0) as total_answers,
             COALESCE(ac.correct_answers, 0) as correct_answers,
             COALESCE(ac.wrong_answers, 0) as wrong_answers
      FROM card_counts cc
      LEFT JOIN answer_counts ac ON ac.tos_topic_id = cc.tos_topic_id
    `

    const params: unknown[] = []
    if (subject) {
      sql += ` WHERE cc.subject = ?`
      params.push(SUBJECT_DB_NAME[subject])
    }

    const rows = db.prepare(sql).all(...params) as Array<{
      tos_topic_id: string
      subject: string
      total_cards: number
      studied_cards: number
      total_answers: number
      correct_answers: number
      wrong_answers: number
    }>

    const stats: TosTopicPerformanceStat[] = rows.map((r) => {
      let code: GauntletSubjectCode = 'MATH'
      for (const [k, v] of Object.entries(SUBJECT_DB_NAME)) {
        if (v === r.subject) {
          code = k as GauntletSubjectCode
          break
        }
      }
      const parts = r.tos_topic_id.split('-')
      const topicCode = parts.length > 1 ? parts.slice(1).join('-') : r.tos_topic_id
      const totalAnswers = Number(r.total_answers) || 0
      const correctAnswers = Number(r.correct_answers) || 0
      const wrongAnswers = Number(r.wrong_answers) || 0
      const totalCards = Number(r.total_cards) || 0
      const studiedCards = Number(r.studied_cards) || 0

      const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) / 100 : null
      const studyProgress = totalCards > 0 ? Math.round((studiedCards / totalCards) * 1000) / 10 : 0

      return {
        tosTopicId: r.tos_topic_id,
        code: topicCode,
        subject: code,
        totalCards,
        studiedCards,
        totalAnswers,
        correctAnswers,
        wrongAnswers,
        accuracy,
        studyProgress,
      }
    })

    const parseCodeNums = (c: string): number[] => {
      return c.split('.').map(p => Number(p) || 0)
    }

    const compareCodes = (a: string, b: string): number => {
      const aNums = parseCodeNums(a)
      const bNums = parseCodeNums(b)
      const maxLen = Math.max(aNums.length, bNums.length)
      for (let i = 0; i < maxLen; i++) {
        const aVal = aNums[i] ?? 0
        const bVal = bNums[i] ?? 0
        if (aVal !== bVal) return aVal - bVal
      }
      return a.localeCompare(b)
    }

    stats.sort((a, b) => {
      if (sortBy === 'code') {
        if (a.subject !== b.subject) {
          const subOrder: GauntletSubjectCode[] = ['MATH', 'GEAS', 'ELECS', 'EST']
          return subOrder.indexOf(a.subject) - subOrder.indexOf(b.subject)
        }
        return compareCodes(a.code, b.code)
      }
      if (sortBy === 'accuracy_asc') {
        if (a.accuracy === null && b.accuracy === null) return compareCodes(a.code, b.code)
        if (a.accuracy === null) return 1
        if (b.accuracy === null) return -1
        if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy
        return b.wrongAnswers - a.wrongAnswers
      }
      if (sortBy === 'accuracy_desc') {
        if (a.accuracy === null && b.accuracy === null) return compareCodes(a.code, b.code)
        if (a.accuracy === null) return 1
        if (b.accuracy === null) return -1
        if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy
        return b.totalAnswers - a.totalAnswers
      }
      if (sortBy === 'misses') {
        if (a.wrongAnswers !== b.wrongAnswers) return b.wrongAnswers - a.wrongAnswers
        return compareCodes(a.code, b.code)
      }
      if (sortBy === 'attempts') {
        if (a.totalAnswers !== b.totalAnswers) return b.totalAnswers - a.totalAnswers
        return compareCodes(a.code, b.code)
      }
      return compareCodes(a.code, b.code)
    })

    return stats
  } catch (err) {
    console.error('getTosTopicPerformanceStats error:', err)
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
  const solutionClause = allowSolutions ? '1=1' : `(${NOT_PROBLEM_SOLVING} OR ${ALLOWED_OVERRIDE})`
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
  ensureGauntletTables(db)
  db.prepare(`
    INSERT INTO gauntlet_flagged_cards (card_id, reason, flagged_at)
    VALUES (?, ?, ?)
    ON CONFLICT(card_id) DO UPDATE SET reason = excluded.reason, flagged_at = excluded.flagged_at
  `).run(cardId, reason ?? null, Date.now())
  db.prepare('DELETE FROM gauntlet_allowed_cards WHERE card_id = ?').run(cardId)
}

export function unflagQuestion(db: Database.Database, cardId: string): void {
  ensureGauntletTables(db)
  db.prepare('DELETE FROM gauntlet_flagged_cards WHERE card_id = ?').run(cardId)
  db.prepare(`
    INSERT OR REPLACE INTO gauntlet_allowed_cards (card_id, allowed_at)
    VALUES (?, ?)
  `).run(cardId, Date.now())
}

export function reinsertQuestions(db: Database.Database, cardIds: string[]): void {
  ensureGauntletTables(db)
  const now = Date.now()
  const deleteFlag = db.prepare('DELETE FROM gauntlet_flagged_cards WHERE card_id = ?')
  const insertAllow = db.prepare('INSERT OR REPLACE INTO gauntlet_allowed_cards (card_id, allowed_at) VALUES (?, ?)')
  const tx = db.transaction((ids: string[]) => {
    for (const id of ids) {
      deleteFlag.run(id)
      insertAllow.run(id, now)
    }
  })
  tx(cardIds)
}

export interface ExcludedGauntletCard {
  id: string
  topicId: string
  type: string
  subject: GauntletSubjectCode
  deckName: string
  tosTopicId: string | null
  question: string
  choices: string[]
  answer: number
  explanation?: string
  imagePath?: string | null
  solutionImagePath?: string | null
  difficulty: string
  reason: string
  flaggedAt: number
  exclusionType: 'flagged' | 'problem_solving'
}

export interface ExcludedGauntletResult {
  cards: ExcludedGauntletCard[]
  total: number
  totalExcludedCount: number
  flaggedCount: number
  autoExcludedCount: number
  reasonsBreakdown: Record<string, number>
  subjectsBreakdown: Record<string, number>
}

export function getExcludedGauntletQuestions(
  db: Database.Database,
  options?: {
    type?: 'flagged' | 'problem_solving' | 'all'
    subject?: string
    reason?: string
    search?: string
    limit?: number
    offset?: number
  },
): ExcludedGauntletResult {
  ensureGauntletTables(db)
  const mode = options?.type || 'all'
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  const search = options?.search?.trim() || ''
  const subjectFilter = options?.subject && options.subject !== 'ALL' ? options.subject : null
  const reasonFilter = options?.reason && options.reason !== 'ALL' ? options.reason : null

  // 1. Overall counts
  const flaggedCountRow = db.prepare(`
    SELECT COUNT(*) as cnt 
    FROM cards c 
    JOIN gauntlet_flagged_cards f ON f.card_id = c.id
    WHERE c.type = 'mcq'
  `).get() as { cnt: number } | undefined
  const flaggedCount = flaggedCountRow?.cnt ?? 0

  const autoExcludedCountRow = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM cards c
    WHERE c.type = 'mcq'
      AND ${VALID_MCQ}
      AND NOT (${NOT_PROBLEM_SOLVING})
      AND c.id NOT IN (SELECT card_id FROM gauntlet_flagged_cards)
      AND c.id NOT IN (SELECT card_id FROM gauntlet_allowed_cards)
  `).get() as { cnt: number } | undefined
  const autoExcludedCount = autoExcludedCountRow?.cnt ?? 0
  const totalExcludedCount = flaggedCount + autoExcludedCount

  // 2. Breakdown by reason across all excluded MCQs
  const reasonsRows = db.prepare(`
    SELECT 
      COALESCE(f.reason, 'Problem Solving (Calculation Heuristic)') as reason,
      COUNT(*) as cnt
    FROM cards c
    LEFT JOIN gauntlet_flagged_cards f ON f.card_id = c.id
    WHERE c.type = 'mcq'
      AND (
        f.card_id IS NOT NULL
        OR
        (
          c.id NOT IN (SELECT card_id FROM gauntlet_allowed_cards)
          AND NOT (${NOT_PROBLEM_SOLVING})
        )
      )
    GROUP BY 1
    ORDER BY cnt DESC
  `).all() as Array<{ reason: string; cnt: number }>
  const reasonsBreakdown: Record<string, number> = {}
  for (const r of reasonsRows) {
    reasonsBreakdown[r.reason] = r.cnt
  }

  // 3. Breakdown by subject for the active mode
  let subjectWhereClause = ''
  if (mode === 'flagged') {
    subjectWhereClause = `AND f.card_id IS NOT NULL`
  } else if (mode === 'problem_solving') {
    subjectWhereClause = `AND f.card_id IS NULL AND c.id NOT IN (SELECT card_id FROM gauntlet_allowed_cards) AND NOT (${NOT_PROBLEM_SOLVING})`
  } else {
    subjectWhereClause = `AND (
      f.card_id IS NOT NULL
      OR (
        c.id NOT IN (SELECT card_id FROM gauntlet_allowed_cards)
        AND NOT (${NOT_PROBLEM_SOLVING})
      )
    )`
  }

  const subjectsRows = db.prepare(`
    SELECT 
      CASE 
        WHEN t.subject IN ('Mathematics', 'MATH') OR c.tos_topic_id LIKE 'MATH-%' THEN 'MATH'
        WHEN t.subject IN ('General Engineering & Applied Sciences', 'GEAS') OR c.tos_topic_id LIKE 'GEAS-%' THEN 'GEAS'
        WHEN t.subject IN ('Electronics Engineering', 'ELECS') OR c.tos_topic_id LIKE 'ELECS-%' THEN 'ELECS'
        WHEN t.subject IN ('Electronics Systems & Technologies', 'EST') OR c.tos_topic_id LIKE 'EST-%' THEN 'EST'
        ELSE 'OTHER'
      END as subject_code,
      COUNT(*) as cnt
    FROM cards c
    JOIN topics t ON t.id = c.topic_id
    LEFT JOIN gauntlet_flagged_cards f ON f.card_id = c.id
    WHERE c.type = 'mcq'
      ${subjectWhereClause}
    GROUP BY 1
  `).all() as Array<{ subject_code: string; cnt: number }>
  const subjectsBreakdown: Record<string, number> = { MATH: 0, GEAS: 0, ELECS: 0, EST: 0 }
  for (const s of subjectsRows) {
    if (s.subject_code in subjectsBreakdown) {
      subjectsBreakdown[s.subject_code] = s.cnt
    }
  }

  // 4. Construct filtered query for cards list
  const whereClauses: string[] = [`c.type = 'mcq'`]
  const params: unknown[] = []

  if (mode === 'flagged') {
    whereClauses.push(`f.card_id IS NOT NULL`)
    if (reasonFilter) {
      whereClauses.push(`f.reason = ?`)
      params.push(reasonFilter)
    }
  } else if (mode === 'problem_solving') {
    whereClauses.push(`f.card_id IS NULL`)
    whereClauses.push(`c.id NOT IN (SELECT card_id FROM gauntlet_allowed_cards)`)
    whereClauses.push(`NOT (${NOT_PROBLEM_SOLVING})`)
  } else {
    // mode === 'all'
    whereClauses.push(`(
      f.card_id IS NOT NULL
      OR (
        c.id NOT IN (SELECT card_id FROM gauntlet_allowed_cards)
        AND NOT (${NOT_PROBLEM_SOLVING})
      )
    )`)
    if (reasonFilter) {
      if (reasonFilter === 'Problem Solving (Calculation Heuristic)') {
        whereClauses.push(`f.card_id IS NULL`)
      } else {
        whereClauses.push(`f.reason = ?`)
        params.push(reasonFilter)
      }
    }
  }

  if (subjectFilter) {
    whereClauses.push(`
      (
        CASE 
          WHEN t.subject IN ('Mathematics', 'MATH') OR c.tos_topic_id LIKE 'MATH-%' THEN 'MATH'
          WHEN t.subject IN ('General Engineering & Applied Sciences', 'GEAS') OR c.tos_topic_id LIKE 'GEAS-%' THEN 'GEAS'
          WHEN t.subject IN ('Electronics Engineering', 'ELECS') OR c.tos_topic_id LIKE 'ELECS-%' THEN 'ELECS'
          WHEN t.subject IN ('Electronics Systems & Technologies', 'EST') OR c.tos_topic_id LIKE 'EST-%' THEN 'EST'
          ELSE 'OTHER'
        END
      ) = ?
    `)
    params.push(subjectFilter)
  }

  if (search) {
    whereClauses.push(`(c.data LIKE ? OR t.name LIKE ? OR c.tos_topic_id LIKE ?)`)
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  const whereSql = whereClauses.join(' AND ')

  // Total matching filtered
  const totalRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM cards c
    JOIN topics t ON t.id = c.topic_id
    LEFT JOIN gauntlet_flagged_cards f ON f.card_id = c.id
    WHERE ${whereSql}
  `).get(...params) as { total: number } | undefined
  const total = totalRow?.total ?? 0

  // Rows query
  const rows = db.prepare(`
    SELECT 
      c.id, c.topic_id, c.type, c.data, c.difficulty, c.tags, c.tos_topic_id, c.created_at,
      t.name AS deck_name, t.subject AS raw_subject,
      COALESCE(f.reason, 'Problem Solving (Calculation Heuristic)') AS reason,
      COALESCE(f.flagged_at, c.created_at) AS flagged_at,
      CASE WHEN f.card_id IS NOT NULL THEN 'flagged' ELSE 'problem_solving' END AS exclusion_type
    FROM cards c
    JOIN topics t ON t.id = c.topic_id
    LEFT JOIN gauntlet_flagged_cards f ON f.card_id = c.id
    WHERE ${whereSql}
    ORDER BY (f.card_id IS NOT NULL) DESC, COALESCE(f.flagged_at, c.created_at) DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Array<{
    id: string
    topic_id: string
    type: string
    data: string
    difficulty: string
    tags: string
    tos_topic_id: string | null
    created_at: number
    deck_name: string
    raw_subject: string
    reason: string | null
    flagged_at: number
    exclusion_type: 'flagged' | 'problem_solving'
  }>

  const cards: ExcludedGauntletCard[] = rows.map(r => {
    let question = ''
    let choices: string[] = []
    let answer = 0
    let explanation = ''
    let imagePath: string | null = null
    let solutionImagePath: string | null = null

    try {
      const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data
      question = parsed?.question || parsed?.front || ''
      choices = Array.isArray(parsed?.choices) ? parsed.choices : []
      answer = typeof parsed?.answer === 'number' ? parsed.answer : (typeof parsed?.answerIndex === 'number' ? parsed.answerIndex : 0)
      explanation = parsed?.explanation || ''
      imagePath = parsed?.imagePath || null
      solutionImagePath = parsed?.solutionImagePath || null
    } catch {
      question = String(r.data || '')
    }

    let subCode: GauntletSubjectCode = 'MATH'
    if (['Mathematics', 'MATH'].includes(r.raw_subject) || (r.tos_topic_id && r.tos_topic_id.startsWith('MATH-'))) {
      subCode = 'MATH'
    } else if (['General Engineering & Applied Sciences', 'GEAS'].includes(r.raw_subject) || (r.tos_topic_id && r.tos_topic_id.startsWith('GEAS-'))) {
      subCode = 'GEAS'
    } else if (['Electronics Engineering', 'ELECS'].includes(r.raw_subject) || (r.tos_topic_id && r.tos_topic_id.startsWith('ELECS-'))) {
      subCode = 'ELECS'
    } else if (['Electronics Systems & Technologies', 'EST'].includes(r.raw_subject) || (r.tos_topic_id && r.tos_topic_id.startsWith('EST-'))) {
      subCode = 'EST'
    }

    return {
      id: r.id,
      topicId: r.topic_id,
      type: r.type,
      subject: subCode,
      deckName: r.deck_name,
      tosTopicId: r.tos_topic_id,
      question,
      choices,
      answer,
      explanation,
      imagePath,
      solutionImagePath,
      difficulty: r.difficulty || 'MEDIUM',
      reason: r.reason || 'Flagged for Gauntlet',
      flaggedAt: r.flagged_at,
      exclusionType: r.exclusion_type,
    }
  })

  return {
    cards,
    total,
    totalExcludedCount,
    flaggedCount,
    autoExcludedCount,
    reasonsBreakdown,
    subjectsBreakdown,
  }
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
  count = 1,
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
  let rewardPerUnit = 0
  if (currentRating < 800) {
    rewardPerUnit = 0.5 // Insulator
  } else if (currentRating < 1000) {
    rewardPerUnit = 0.2 // Semiconductor
  } else {
    return { gained: 0, newRating: currentRating }
  }

  const dailyRow = db.prepare('SELECT gained FROM gauntlet_daily_review_elo WHERE subject = ? AND date = ?').get(code, localToday) as { gained: number } | undefined
  const dailyGained = dailyRow?.gained ?? 0
  if (dailyGained >= 25.0) {
    return { gained: 0, newRating: currentRating }
  }

  const totalReward = rewardPerUnit * Math.max(1, count)
  const allowable = Math.min(totalReward, 25.0 - dailyGained)
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

export interface GauntletTosAccuracyItem {
  tosTopicId: string
  subject: GauntletSubjectCode
  totalAnswers: number
  correctAnswers: number
  wrongAnswers: number
  timeoutAnswers: number
  accuracy: number
  isWeak: boolean
}

export interface GauntletSpeedParItem {
  subject: GauntletSubjectCode
  totalAnswers: number
  avgTimeMs: number
  avgParMs: number
  speedRatio: number
  fastWrongCount: number
  wrongCount: number
  fastWrongRate: number
}

export interface GauntletEloTrajectoryPoint {
  date: string
  timestamp: number
  MATH: number | null
  GEAS: number | null
  ELECS: number | null
  EST: number | null
  overall: number | null
}

export interface GauntletCoverageDensityItem {
  subject: GauntletSubjectCode
  libraryCards: number
  arenaCards: number
  penetrationPct: number
}

export interface GauntletTopicCoverageItem {
  tosTopicId: string
  subject: GauntletSubjectCode
  libraryCards: number
  arenaCards: number
  penetrationPct: number
}

export interface GauntletEnduranceStats {
  totalRuns: number
  totalAnswers: number
  avgRunDurationSec: number
  avgRunScore: number
  avgQuestionsPerRun: number
  bestStreakOverall: number
  streakBuckets: Array<{
    bucket: string
    count: number
    pct: number
  }>
  failureModes: Array<{
    mode: string
    count: number
    pct: number
  }>
}

export interface GauntletEdaStats {
  tosAccuracy: GauntletTosAccuracyItem[]
  speedPar: GauntletSpeedParItem[]
  eloTrajectory: GauntletEloTrajectoryPoint[]
  currentRatings: Record<GauntletSubjectCode, { rating: number; peak: number; answers: number }>
  coverageDensity: {
    bySubject: GauntletCoverageDensityItem[]
    byTopic: GauntletTopicCoverageItem[]
    untestedBlindSpots: GauntletTopicCoverageItem[]
  }
  endurance: GauntletEnduranceStats
}

export function getGauntletEdaStats(db: Database.Database): GauntletEdaStats {
  const SUBJECTS: GauntletSubjectCode[] = ['MATH', 'GEAS', 'ELECS', 'EST']

  // 1. ToS Accuracy
  const tosAccuracyRows = db.prepare(`
    SELECT c.tos_topic_id,
           a.subject,
           COUNT(*) as total_answers,
           SUM(CASE WHEN a.outcome = 'correct' THEN 1 ELSE 0 END) as correct_answers,
           SUM(CASE WHEN a.outcome = 'wrong' THEN 1 ELSE 0 END) as wrong_answers,
           SUM(CASE WHEN a.outcome = 'timeout' THEN 1 ELSE 0 END) as timeout_answers,
           ROUND(CAST(SUM(CASE WHEN a.outcome = 'correct' THEN 1 ELSE 0 END) AS REAL) / COUNT(*), 4) as accuracy
    FROM gauntlet_answers a
    JOIN cards c ON c.id = a.card_id
    WHERE c.tos_topic_id IS NOT NULL AND c.tos_topic_id != ''
    GROUP BY c.tos_topic_id, a.subject
    ORDER BY total_answers DESC
  `).all() as Array<{
    tos_topic_id: string
    subject: string
    total_answers: number
    correct_answers: number
    wrong_answers: number
    timeout_answers: number
    accuracy: number
  }>

  const tosAccuracy: GauntletTosAccuracyItem[] = tosAccuracyRows.map(r => ({
    tosTopicId: r.tos_topic_id,
    subject: (['MATH', 'GEAS', 'ELECS', 'EST'].includes(r.subject) ? r.subject : 'MATH') as GauntletSubjectCode,
    totalAnswers: r.total_answers,
    correctAnswers: r.correct_answers,
    wrongAnswers: r.wrong_answers,
    timeoutAnswers: r.timeout_answers,
    accuracy: r.accuracy,
    isWeak: r.total_answers >= 3 && r.accuracy < 0.70,
  }))

  // 2. Speed vs Par Efficiency
  const speedParRows = db.prepare(`
    SELECT a.subject,
           COUNT(*) as total_answers,
           ROUND(AVG(a.time_ms), 1) as avg_time_ms,
           ROUND(AVG(a.par_ms), 1) as avg_par_ms,
           ROUND(CAST(SUM(a.time_ms) AS REAL) / NULLIF(SUM(a.par_ms), 0), 3) as speed_ratio,
           SUM(CASE WHEN a.outcome IN ('wrong', 'timeout') AND a.time_ms < a.par_ms * 0.25 THEN 1 ELSE 0 END) as fast_wrong_count,
           SUM(CASE WHEN a.outcome IN ('wrong', 'timeout') THEN 1 ELSE 0 END) as wrong_count
    FROM gauntlet_answers a
    GROUP BY a.subject
  `).all() as Array<{
    subject: string
    total_answers: number
    avg_time_ms: number
    avg_par_ms: number
    speed_ratio: number | null
    fast_wrong_count: number
    wrong_count: number
  }>

  const speedPar: GauntletSpeedParItem[] = SUBJECTS.map(sub => {
    const found = speedParRows.find(r => r.subject === sub)
    if (!found) {
      return {
        subject: sub,
        totalAnswers: 0,
        avgTimeMs: 0,
        avgParMs: 0,
        speedRatio: 1.0,
        fastWrongCount: 0,
        wrongCount: 0,
        fastWrongRate: 0,
      }
    }
    return {
      subject: sub,
      totalAnswers: found.total_answers,
      avgTimeMs: found.avg_time_ms ?? 0,
      avgParMs: found.avg_par_ms ?? 0,
      speedRatio: found.speed_ratio ?? 1.0,
      fastWrongCount: found.fast_wrong_count ?? 0,
      wrongCount: found.wrong_count ?? 0,
      fastWrongRate: found.wrong_count > 0 ? Math.round(((found.fast_wrong_count ?? 0) / found.wrong_count) * 1000) / 1000 : 0,
    }
  })

  // 3. Elo Trajectory & Current Ratings
  const runRows = db.prepare(`
    SELECT started_at, ratings_after
    FROM gauntlet_runs
    WHERE ratings_after IS NOT NULL
    ORDER BY started_at ASC
  `).all() as Array<{ started_at: number; ratings_after: string }>

  const eloTrajectory: GauntletEloTrajectoryPoint[] = []
  for (const r of runRows) {
    const parsed = safeParse(r.ratings_after) as Record<string, { rating?: number } | number> | null
    if (!parsed || typeof parsed !== 'object') continue

    const getSubRating = (code: string): number | null => {
      const val = parsed[code]
      if (val == null) return null
      const num = typeof val === 'number' ? val : val.rating
      return typeof num === 'number' && !isNaN(num) ? Math.round(num * 10) / 10 : null
    }

    const math = getSubRating('MATH')
    const geas = getSubRating('GEAS')
    const elecs = getSubRating('ELECS')
    const est = getSubRating('EST')

    const present = [math, geas, elecs, est].filter((v): v is number => v != null)
    const overall = present.length > 0
      ? Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10
      : null

    const d = new Date(r.started_at)
    eloTrajectory.push({
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      timestamp: r.started_at,
      MATH: math,
      GEAS: geas,
      ELECS: elecs,
      EST: est,
      overall,
    })
  }

  const ratingRows = db.prepare('SELECT subject, rating, peak, answers FROM gauntlet_ratings').all() as Array<{
    subject: string
    rating: number
    peak: number | null
    answers: number
  }>
  const currentRatings: Record<GauntletSubjectCode, { rating: number; peak: number; answers: number }> = {
    MATH: { rating: 500, peak: 500, answers: 0 },
    GEAS: { rating: 500, peak: 500, answers: 0 },
    ELECS: { rating: 500, peak: 500, answers: 0 },
    EST: { rating: 500, peak: 500, answers: 0 },
  }
  for (const row of ratingRows) {
    if (SUBJECTS.includes(row.subject as GauntletSubjectCode)) {
      currentRatings[row.subject as GauntletSubjectCode] = {
        rating: Math.round(row.rating * 10) / 10,
        peak: Math.round((row.peak ?? row.rating) * 10) / 10,
        answers: row.answers,
      }
    }
  }

  // 4. Coverage Density: Arena vs. Playable Gauntlet Pool
  const subjectCoverageRows = db.prepare(`
    SELECT 
      CASE 
        WHEN t.subject IN ('Mathematics', 'MATH') OR c.tos_topic_id LIKE 'MATH-%' THEN 'MATH'
        WHEN t.subject IN ('General Engineering & Applied Sciences', 'GEAS') OR c.tos_topic_id LIKE 'GEAS-%' THEN 'GEAS'
        WHEN t.subject IN ('Electronics Engineering', 'ELECS') OR c.tos_topic_id LIKE 'ELECS-%' THEN 'ELECS'
        WHEN t.subject IN ('Electronics Systems & Technologies', 'EST') OR c.tos_topic_id LIKE 'EST-%' THEN 'EST'
        ELSE 'OTHER'
      END as subject,
      COUNT(DISTINCT c.id) as pool_cards,
      COUNT(DISTINCT a.card_id) as arena_cards
    FROM cards c
    JOIN topics t ON t.id = c.topic_id
    LEFT JOIN gauntlet_answers a ON a.card_id = c.id
    WHERE c.tos_topic_id IS NOT NULL AND c.tos_topic_id != ''
      AND c.type = 'mcq'
      AND (${NOT_PROBLEM_SOLVING} OR ${ALLOWED_OVERRIDE})
      AND ${VALID_MCQ}
      AND ${NOT_FLAGGED}
    GROUP BY 1
  `).all() as Array<{ subject: string; pool_cards: number; arena_cards: number }>

  const bySubject: GauntletCoverageDensityItem[] = SUBJECTS.map(sub => {
    const found = subjectCoverageRows.find(r => r.subject === sub)
    const pool = found?.pool_cards ?? 0
    const arena = found?.arena_cards ?? 0
    return {
      subject: sub,
      libraryCards: pool,
      arenaCards: arena,
      penetrationPct: pool > 0 ? Math.round((arena / pool) * 1000) / 10 : 0,
    }
  })

  const topicCoverageRows = db.prepare(`
    SELECT 
      c.tos_topic_id,
      CASE 
        WHEN t.subject IN ('Mathematics', 'MATH') OR c.tos_topic_id LIKE 'MATH-%' THEN 'MATH'
        WHEN t.subject IN ('General Engineering & Applied Sciences', 'GEAS') OR c.tos_topic_id LIKE 'GEAS-%' THEN 'GEAS'
        WHEN t.subject IN ('Electronics Engineering', 'ELECS') OR c.tos_topic_id LIKE 'ELECS-%' THEN 'ELECS'
        WHEN t.subject IN ('Electronics Systems & Technologies', 'EST') OR c.tos_topic_id LIKE 'EST-%' THEN 'EST'
        ELSE 'OTHER'
      END as subject,
      COUNT(DISTINCT c.id) as pool_cards,
      COUNT(DISTINCT a.card_id) as arena_cards
    FROM cards c
    JOIN topics t ON t.id = c.topic_id
    LEFT JOIN gauntlet_answers a ON a.card_id = c.id
    WHERE c.tos_topic_id IS NOT NULL AND c.tos_topic_id != ''
      AND c.type = 'mcq'
      AND (${NOT_PROBLEM_SOLVING} OR ${ALLOWED_OVERRIDE})
      AND ${VALID_MCQ}
      AND ${NOT_FLAGGED}
    GROUP BY c.tos_topic_id
    HAVING pool_cards > 0
    ORDER BY (COUNT(DISTINCT c.id) - COUNT(DISTINCT a.card_id)) DESC
  `).all() as Array<{ tos_topic_id: string; subject: string; pool_cards: number; arena_cards: number }>

  const byTopic: GauntletTopicCoverageItem[] = topicCoverageRows.map(r => ({
    tosTopicId: r.tos_topic_id,
    subject: (['MATH', 'GEAS', 'ELECS', 'EST'].includes(r.subject) ? r.subject : 'MATH') as GauntletSubjectCode,
    libraryCards: r.pool_cards,
    arenaCards: r.arena_cards,
    penetrationPct: r.pool_cards > 0 ? Math.round((r.arena_cards / r.pool_cards) * 1000) / 10 : 0,
  }))

  const untestedBlindSpots: GauntletTopicCoverageItem[] = byTopic
    .filter(t => t.libraryCards > 0)
    .slice(0, 8)

  // 5. Endurance & Streak Survival Curve
  const enduranceSummary = db.prepare(`
    SELECT 
      COUNT(*) as total_runs,
      ROUND(AVG(duration_ms) / 1000.0, 1) as avg_duration_sec,
      ROUND(AVG(score), 1) as avg_score,
      ROUND(AVG(answered), 1) as avg_answered,
      MAX(best_streak) as best_streak_overall
    FROM gauntlet_runs
  `).get() as {
    total_runs: number
    avg_duration_sec: number | null
    avg_score: number | null
    avg_answered: number | null
    best_streak_overall: number | null
  } | undefined

  const totalRuns = enduranceSummary?.total_runs ?? 0

  const streakBucketOrder = ['0-4', '5-9', '10-14', '15-19', '20-29', '30+']
  const streakRows = db.prepare(`
    SELECT 
      CASE 
        WHEN best_streak BETWEEN 0 AND 4 THEN '0-4'
        WHEN best_streak BETWEEN 5 AND 9 THEN '5-9'
        WHEN best_streak BETWEEN 10 AND 14 THEN '10-14'
        WHEN best_streak BETWEEN 15 AND 19 THEN '15-19'
        WHEN best_streak BETWEEN 20 AND 29 THEN '20-29'
        ELSE '30+'
      END as bucket,
      COUNT(*) as count
    FROM gauntlet_runs
    GROUP BY 1
  `).all() as Array<{ bucket: string; count: number }>

  const streakBuckets = streakBucketOrder.map(b => {
    const found = streakRows.find(r => r.bucket === b)
    const count = found?.count ?? 0
    return {
      bucket: b,
      count,
      pct: totalRuns > 0 ? Math.round((count / totalRuns) * 1000) / 10 : 0,
    }
  })

  const failureRows = db.prepare(`
    SELECT end_reason, COUNT(*) as count
    FROM gauntlet_runs
    GROUP BY end_reason
  `).all() as Array<{ end_reason: string; count: number }>

  const failureModes = failureRows.map(r => ({
    mode: r.end_reason,
    count: r.count,
    pct: totalRuns > 0 ? Math.round((r.count / totalRuns) * 1000) / 10 : 0,
  }))

  const answerCountRow = db.prepare('SELECT COUNT(*) as cnt FROM gauntlet_answers').get() as { cnt: number } | undefined

  return {
    tosAccuracy,
    speedPar,
    eloTrajectory,
    currentRatings,
    coverageDensity: {
      bySubject,
      byTopic,
      untestedBlindSpots,
    },
    endurance: {
      totalRuns,
      totalAnswers: answerCountRow?.cnt ?? 0,
      avgRunDurationSec: enduranceSummary?.avg_duration_sec ?? 0,
      avgRunScore: enduranceSummary?.avg_score ?? 0,
      avgQuestionsPerRun: enduranceSummary?.avg_answered ?? 0,
      bestStreakOverall: enduranceSummary?.best_streak_overall ?? 0,
      streakBuckets,
      failureModes,
    },
  }
}



