import { ipcMain } from 'electron'
import { queryAll } from '../db/database'
import { FULL_TO_CODE_SUBJECT, CODE_TO_FULL_SUBJECT, SubjectCode } from '../../src/lib/subjectClassifier'

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

/**
 * Returns frequency counts of MCQ answer positions (0-3) grouped by normalized subject.
 * Answers outside 0-3 or null are aggregated into a `position: null` bucket per subject
 * as a data-quality signal.
 */
export function getAnswerPositionBySubject(
  queryFn: (sql: string, params?: any[]) => any[] = queryAll
): Array<{ subject: string; position: number | null; count: number }> {
  const sql = `
    SELECT t.subject,
           json_extract(c.data, '$.answer') AS pos,
           COUNT(*) AS n
    FROM cards c
    JOIN topics t ON c.topic_id = t.id
    WHERE c.type = 'mcq'
    GROUP BY t.subject, pos
  `
  const rows = queryFn(sql)
  const standardSubjects = ['MATH', 'GEAS', 'ELECS', 'EST']
  const subjectMap: Record<string, { counts: Record<number, number>; invalidCount: number }> = {}

  for (const sub of standardSubjects) {
    subjectMap[sub] = { counts: { 0: 0, 1: 0, 2: 0, 3: 0 }, invalidCount: 0 }
  }

  for (const row of rows) {
    const code = normalizeSubject(row.subject)
    if (!subjectMap[code]) {
      subjectMap[code] = { counts: { 0: 0, 1: 0, 2: 0, 3: 0 }, invalidCount: 0 }
    }
    const n = Number(row.n) || 0
    const rawPos = row.pos
    const numPos =
      rawPos !== null && rawPos !== undefined && rawPos !== '' ? Number(rawPos) : NaN

    if (Number.isInteger(numPos) && numPos >= 0 && numPos <= 3) {
      subjectMap[code].counts[numPos] += n
    } else {
      subjectMap[code].invalidCount += n
    }
  }

  const result: Array<{ subject: string; position: number | null; count: number }> = []

  for (const [subject, data] of Object.entries(subjectMap)) {
    for (let pos = 0; pos <= 3; pos++) {
      result.push({ subject, position: pos, count: data.counts[pos] })
    }
    if (data.invalidCount > 0) {
      result.push({ subject, position: null, count: data.invalidCount })
    }
  }

  return result
}

export interface TosCoverageMatrixData {
  totalCards: number
  totalClassified: number
  totalUnclassified: number
  bySubject: Record<
    string,
    {
      totalCards: number
      classifiedCards: number
      unclassifiedCards: number
      countsByTosId: Record<string, number>
    }
  >
}

export function getTosCoverageMatrix(
  queryFn: (sql: string, params?: any[]) => any[] = queryAll
): TosCoverageMatrixData {
  const sql = `
    SELECT 
      t.subject AS rawSubject,
      c.tos_topic_id AS tosTopicId,
      COUNT(c.id) AS cardCount
    FROM cards c
    JOIN topics t ON c.topic_id = t.id
    GROUP BY rawSubject, tosTopicId
  `
  const rows = queryFn(sql)
  const standardSubjects = ['MATH', 'GEAS', 'ELECS', 'EST']
  const result: TosCoverageMatrixData = {
    totalCards: 0,
    totalClassified: 0,
    totalUnclassified: 0,
    bySubject: {},
  }

  for (const s of standardSubjects) {
    result.bySubject[s] = {
      totalCards: 0,
      classifiedCards: 0,
      unclassifiedCards: 0,
      countsByTosId: {},
    }
  }

  for (const row of rows) {
    const sub = normalizeSubject(row.rawSubject)
    const count = Number(row.cardCount) || 0
    const rawTos = row.tosTopicId ? String(row.tosTopicId).trim() : null

    if (!result.bySubject[sub]) {
      result.bySubject[sub] = {
        totalCards: 0,
        classifiedCards: 0,
        unclassifiedCards: 0,
        countsByTosId: {},
      }
    }

    result.totalCards += count
    result.bySubject[sub].totalCards += count

    if (rawTos) {
      result.totalClassified += count
      result.bySubject[sub].classifiedCards += count
      result.bySubject[sub].countsByTosId[rawTos] =
        (result.bySubject[sub].countsByTosId[rawTos] || 0) + count
    } else {
      result.totalUnclassified += count
      result.bySubject[sub].unclassifiedCards += count
    }
  }

  return result
}

export interface CardByTosTopicItem {
  id: string
  topicId: string
  deckName: string
  subject: string
  type: string
  difficulty: string | null
  tosTopicId: string | null
  preview: string
  tags: string[]
}

export function getCardsByTosTopic(
  payload: {
    tosTopicId?: string | null
    subject?: string
    isUnclassified?: boolean
    search?: string
    limit?: number
    offset?: number
  },
  queryFn: (sql: string, params?: any[]) => any[] = queryAll
): { cards: CardByTosTopicItem[]; total: number } {
  const { tosTopicId, subject, isUnclassified, search, limit = 50, offset = 0 } = payload
  const whereClauses: string[] = ['1=1']
  const params: any[] = []

  if (subject && subject !== 'ALL') {
    const full = CODE_TO_FULL_SUBJECT[subject as SubjectCode]
    const candidates = [subject]
    if (full) {
      candidates.push(full)
      candidates.push(full.replace('&', 'and'))
    }
    const placeholders = candidates.map(() => '?').join(', ')
    whereClauses.push(`(t.subject IN (${placeholders}) OR UPPER(t.subject) LIKE ?)`)
    params.push(...candidates, `%${subject}%`)
  }

  if (isUnclassified) {
    whereClauses.push(`(c.tos_topic_id IS NULL OR c.tos_topic_id = '')`)
  } else if (tosTopicId) {
    if (tosTopicId.endsWith('.0')) {
      const prefix = tosTopicId.slice(0, -1)
      whereClauses.push(`(c.tos_topic_id = ? OR c.tos_topic_id LIKE ?)`)
      params.push(tosTopicId, `${prefix}%`)
    } else {
      whereClauses.push(`c.tos_topic_id = ?`)
      params.push(tosTopicId)
    }
  }

  if (search && search.trim()) {
    whereClauses.push(`(c.data LIKE ? OR t.name LIKE ?)`)
    params.push(`%${search.trim()}%`, `%${search.trim()}%`)
  }

  const whereSql = whereClauses.join(' AND ')

  const countSql = `
    SELECT COUNT(*) AS total
    FROM cards c
    JOIN topics t ON c.topic_id = t.id
    WHERE ${whereSql}
  `
  const countRow = queryFn(countSql, params)[0]
  const total = Number(countRow?.total) || 0

  const dataSql = `
    SELECT 
      c.id,
      c.topic_id,
      c.type,
      c.data,
      c.difficulty,
      c.tags,
      c.tos_topic_id,
      t.name AS topic_name,
      t.subject AS raw_subject
    FROM cards c
    JOIN topics t ON c.topic_id = t.id
    WHERE ${whereSql}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `
  const rows = queryFn(dataSql, [...params, limit, offset])

  const cards: CardByTosTopicItem[] = rows.map((r: any) => {
    let preview = ''
    try {
      const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data
      preview = parsed.question || parsed.front || parsed.formula || parsed.name || parsed.term || ''
    } catch {
      preview = String(r.data || '').slice(0, 100)
    }

    let parsedTags: string[] = []
    try {
      if (r.tags) {
        parsedTags = typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags
        if (!Array.isArray(parsedTags)) parsedTags = [String(r.tags)]
      }
    } catch {
      if (r.tags) parsedTags = [String(r.tags)]
    }

    return {
      id: r.id,
      topicId: r.topic_id,
      deckName: r.topic_name || 'Untitled Deck',
      subject: normalizeSubject(r.raw_subject),
      type: r.type || 'mcq',
      difficulty: r.difficulty || null,
      tosTopicId: r.tos_topic_id || null,
      preview: preview.trim(),
      tags: parsedTags,
    }
  })

  return { cards, total }
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

  ipcMain.handle('data:getTosCoverageMatrix', async () => {
    try {
      const data = getTosCoverageMatrix()
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('data:getCardsByTosTopic', async (_, payload: any) => {
    try {
      const data = getCardsByTosTopic(payload || {})
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

  ipcMain.handle('data:getAnswerPositionBySubject', async () => {
    try {
      const data = getAnswerPositionBySubject()
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

