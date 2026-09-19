import type Database from 'better-sqlite3';

export const SM2_CARD_TYPES = ['flashcard'] as const;

export const TODAY_SQL = "date('now', 'localtime')";
export const NEW_SQL = "(p.next_review IS NULL OR p.next_review = '')";
export const dueSql = (today: string = TODAY_SQL) =>
  `(p.next_review IS NOT NULL AND p.next_review <> '' AND p.next_review <= ${today})`;
export const dueOrNewSql = (today: string = TODAY_SQL) =>
  `(${NEW_SQL} OR ${dueSql(today)})`;

export interface ScheduleDay {
  date: string;
  count: number;
}

export interface FlashcardSchedule {
  today: string;
  total: number;
  new: number;
  due: number;
  future: number;
  days: ScheduleDay[];
  later: number;
}

interface AggregateTotalsRow {
  d0: string;
  d1: string;
  d2: string;
  d3: string;
  d4: string;
  d5: string;
  d6: string;
  total: number;
  new_count: number;
  due_count: number;
  future_count: number;
}

interface WindowGroupByRow {
  next_review: string;
  count: number;
}

export function getFlashcardSchedule(
  db: Database.Database,
  opts?: { today?: string }
): FlashcardSchedule {
  const today =
    opts?.today ??
    (db.prepare(`SELECT ${TODAY_SQL} AS today`).get() as { today: string }).today;

  const cardTypesCondition = `c.type IN (${SM2_CARD_TYPES.map((t) => `'${t}'`).join(', ')})`;

  // One aggregate query for totals and 7-day window dates
  const aggregateSql = `
    SELECT
      @today AS d0,
      date(@today, '+1 day') AS d1,
      date(@today, '+2 day') AS d2,
      date(@today, '+3 day') AS d3,
      date(@today, '+4 day') AS d4,
      date(@today, '+5 day') AS d5,
      date(@today, '+6 day') AS d6,
      COUNT(c.id) AS total,
      COALESCE(SUM(CASE WHEN ${NEW_SQL} THEN 1 ELSE 0 END), 0) AS new_count,
      COALESCE(SUM(CASE WHEN ${dueSql('@today')} THEN 1 ELSE 0 END), 0) AS due_count,
      COALESCE(SUM(CASE WHEN p.next_review > @today THEN 1 ELSE 0 END), 0) AS future_count
    FROM cards c
    LEFT JOIN progress p ON c.id = p.card_id
    WHERE ${cardTypesCondition}
  `;

  const totals = db.prepare(aggregateSql).get({ today }) as AggregateTotalsRow;

  // One GROUP BY next_review query for future cards in the window
  const windowSql = `
    SELECT p.next_review AS next_review, COUNT(*) AS count
    FROM cards c
    JOIN progress p ON c.id = p.card_id
    WHERE ${cardTypesCondition}
      AND p.next_review > @today
    GROUP BY p.next_review
  `;

  const windowRows = db.prepare(windowSql).all({ today }) as WindowGroupByRow[];

  const futureCounts = new Map<string, number>();
  let later = 0;

  for (const row of windowRows) {
    futureCounts.set(row.next_review, row.count);
    if (row.next_review > totals.d6) {
      later += row.count;
    }
  }

  const windowDates = [
    totals.d0,
    totals.d1,
    totals.d2,
    totals.d3,
    totals.d4,
    totals.d5,
    totals.d6,
  ];

  const days: ScheduleDay[] = windowDates.map((date, index) => {
    if (index === 0) {
      return { date, count: totals.due_count };
    }
    return { date, count: futureCounts.get(date) ?? 0 };
  });

  return {
    today: totals.d0,
    total: totals.total,
    new: totals.new_count,
    due: totals.due_count,
    future: totals.future_count,
    days,
    later,
  };
}
