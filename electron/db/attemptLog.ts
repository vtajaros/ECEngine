// electron/db/attemptLog.ts
// Append-only attempt history. No FK to cards — history survives card deletion.

import Database from 'better-sqlite3'

// ── DDL ───────────────────────────────────────────────────────────────────────

export const ATTEMPT_LOG_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS attempt_log (
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
   )`,
  'CREATE INDEX IF NOT EXISTS idx_attempt_ts ON attempt_log(ts)',
  'CREATE INDEX IF NOT EXISTS idx_attempt_day ON attempt_log(day)',
  'CREATE INDEX IF NOT EXISTS idx_attempt_subject_ts ON attempt_log(subject, ts)',
  'CREATE INDEX IF NOT EXISTS idx_attempt_card ON attempt_log(card_id)',
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AttemptInput {
  cardId: string
  mode: 'learn' | 'test' | 'flashcard'
  correct: boolean
  quality?: number | null
  responseMs?: number | null
  answeredAt?: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a local-timezone YYYY-MM-DD string for the given unix-ms timestamp.
 * Uses Date's local-time accessors, not UTC, so the day matches what the user sees.
 */
export function localDay(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Inserts one row into attempt_log.
 *
 * Uses a single INSERT … SELECT that joins cards → topics to denormalize
 * topic_id and subject. If card_id does not exist in cards (mock/generated ids),
 * the SELECT returns no rows and nothing is inserted — returns false.
 *
 * response_ms is stored only when it is a finite integer in [0, 3_600_000];
 * otherwise NULL.
 *
 * The caller owns the transaction.
 */
export function logAttempt(db: Database.Database, a: AttemptInput): boolean {
  const ts = a.answeredAt != null && Number.isFinite(a.answeredAt) ? Math.trunc(a.answeredAt) : Date.now()
  const day = localDay(ts)

  const raw = a.responseMs
  const responseMs =
    raw != null && Number.isFinite(raw) && Number.isInteger(raw) && raw >= 0 && raw <= 3_600_000
      ? raw
      : null

  const stmt = db.prepare(`
    INSERT INTO attempt_log
      (ts, day, card_id, topic_id, subject, card_type, mode, correct, quality, response_ms)
    SELECT ?, ?, c.id, c.topic_id, t.subject, c.type, ?, ?, ?, ?
    FROM cards c
    LEFT JOIN topics t ON t.id = c.topic_id
    WHERE c.id = ?
  `)

  const info = stmt.run(
    ts,
    day,
    a.mode,
    a.correct ? 1 : 0,
    a.quality ?? null,
    responseMs,
    a.cardId,
  )

  return info.changes === 1
}
