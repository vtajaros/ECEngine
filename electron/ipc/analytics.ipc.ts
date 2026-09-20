import { ipcMain } from 'electron'
import { queryAll } from '../db/database'
import { FULL_TO_CODE_SUBJECT } from '../../src/lib/subjectClassifier'

/**
 * Normalizes a raw subject string into standard subject codes (MATH, GEAS, ELECS, EST).
 * Uses FULL_TO_CODE_SUBJECT as the single source of truth; passes through existing codes.
 */
export function normalizeSubject(raw: string | null | undefined): string {
  if (!raw) return 'UNKNOWN'
  if (raw in FULL_TO_CODE_SUBJECT) {
    return FULL_TO_CODE_SUBJECT[raw as keyof typeof FULL_TO_CODE_SUBJECT]
  }
  return raw
}

/**
 * Queries topic and card counts grouped by raw subject, then normalizes subject
 * in TypeScript using FULL_TO_CODE_SUBJECT.
 */
export function getContentCoverage(
  queryFn: (sql: string, params?: any[]) => any[] = queryAll
): Record<string, { topics: number; cards: number }> {
  const sql = `
    SELECT t.subject,
           COUNT(DISTINCT t.id) AS topicCount,
           COUNT(c.id) AS cardCount
    FROM topics t
    LEFT JOIN cards c ON c.topic_id = t.id
    GROUP BY t.subject
  `
  const rows = queryFn(sql)
  const coverage: Record<string, { topics: number; cards: number }> = {
    MATH: { topics: 0, cards: 0 },
    GEAS: { topics: 0, cards: 0 },
    ELECS: { topics: 0, cards: 0 },
    EST: { topics: 0, cards: 0 },
  }

  for (const row of rows) {
    const code = normalizeSubject(row.subject)
    if (!coverage[code]) {
      coverage[code] = { topics: 0, cards: 0 }
    }
    coverage[code].topics += Number(row.topicCount) || 0
    coverage[code].cards += Number(row.cardCount) || 0
  }

  return coverage
}

/**
 * Returns raw numeric question lengths for all MCQ cards along with their normalized subject.
 * Question text is never included in the response to uphold IPC data isolation.
 */
export function getQuestionLengthDistribution(
  queryFn: (sql: string, params?: any[]) => any[] = queryAll
): Array<{ subject: string; qlen: number }> {
  const sql = `
    SELECT c.id, t.subject,
           length(json_extract(c.data, '$.question')) AS qlen
    FROM cards c JOIN topics t ON c.topic_id = t.id
    WHERE c.type = 'mcq'
  `
  const rows = queryFn(sql)
  return rows.map((row) => ({
    subject: normalizeSubject(row.subject),
    qlen: Number(row.qlen) || 0,
  }))
}

/**
 * Returns frequency counts of MCQ answer positions (0-3).
 * Answers outside 0-3 or null are aggregated into a `position: null` bucket
 * as a data-quality signal.
 */
export function getAnswerPositionCounts(
  queryFn: (sql: string, params?: any[]) => any[] = queryAll
): Array<{ position: number | null; count: number }> {
  const sql = `
    SELECT json_extract(data, '$.answer') AS pos, COUNT(*) AS n
    FROM cards WHERE type = 'mcq'
    GROUP BY pos
  `
  const rows = queryFn(sql)
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  let invalidCount = 0

  for (const row of rows) {
    const n = Number(row.n) || 0
    const rawPos = row.pos
    const numPos =
      rawPos !== null && rawPos !== undefined && rawPos !== '' ? Number(rawPos) : NaN

    if (Number.isInteger(numPos) && numPos >= 0 && numPos <= 3) {
      counts[numPos] += n
    } else {
      // Data-quality signal: cards with answer outside 0-3, non-numeric answers,
      // or null/missing answers are bucketed under position: null rather than
      // being silently dropped.
      invalidCount += n
    }
  }

  const result: Array<{ position: number | null; count: number }> = [
    { position: 0, count: counts[0] },
    { position: 1, count: counts[1] },
    { position: 2, count: counts[2] },
    { position: 3, count: counts[3] },
  ]

  if (invalidCount > 0) {
    result.push({ position: null, count: invalidCount })
  }

  return result
}

/**
 * Returns response-time distributions split by mode ('learn' and 'flashcard').
 * Rows with null response_ms (e.g. normal test mode) are excluded. If an anomalous
 * test mode row with non-null response_ms exists, it flows through under 'test'.
 */
export function getResponseTimeDistribution(
  queryFn: (sql: string, params?: any[]) => any[] = queryAll
): {
  learn: Array<{ subject: string; responseMs: number }>
  flashcard: Array<{ subject: string; responseMs: number }>
  [key: string]: Array<{ subject: string; responseMs: number }>
} {
  const sql = `
    SELECT mode, subject, response_ms
    FROM attempt_log
    WHERE response_ms IS NOT NULL
  `
  const rows = queryFn(sql)
  const result: {
    learn: Array<{ subject: string; responseMs: number }>
    flashcard: Array<{ subject: string; responseMs: number }>
    [key: string]: Array<{ subject: string; responseMs: number }>
  } = {
    learn: [],
    flashcard: [],
  }

  for (const row of rows) {
    const mode = row.mode
    if (!result[mode]) {
      // Data anomaly: if any mode outside learn/flashcard (e.g. test) has a non-null
      // response_ms, allow it to surface under its own key rather than silently dropping it.
      result[mode] = []
    }
    result[mode].push({
      subject: normalizeSubject(row.subject),
      responseMs: Number(row.response_ms) || 0,
    })
  }

  return result
}

export function registerAnalyticsHandlers(): void {
  ipcMain.handle('data:getContentCoverage', async () => {
    try {
      const data = getContentCoverage()
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getQuestionLengthDistribution', async () => {
    try {
      const data = getQuestionLengthDistribution()
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getAnswerPositionCounts', async () => {
    try {
      const data = getAnswerPositionCounts()
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getResponseTimeDistribution', async () => {
    try {
      const data = getResponseTimeDistribution()
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}

