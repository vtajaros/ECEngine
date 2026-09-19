/**
 * tosItems.ts
 * Exam-item counts per TOS topic, transcribed from the PRC 2022 Table of
 * Specifications (EE2022-10_TOS.pdf) and verified against its totals.
 *
 * Difficulty tiers follow the PRC's own grouping:
 *   easy      = Knowledge + Comprehension
 *   moderate  = Application
 *   difficult = Analysis + Synthesis + Evaluation
 *
 * Keyed by topic id from ./data (e.g. "MATH-1.0"). Weights are intentionally omitted.
 */

export type TosSubjectCode = 'MATH' | 'ELECS' | 'GEAS' | 'EST'

export interface TosTopicItems {
  /** Total exam items for this topic */
  items: number
  easy: number
  moderate: number
  difficult: number
  /** Topic also appears (with its own item count) under another subject */
  sharedWith?: TosSubjectCode
}

export const TOS_ITEMS: Record<string, TosTopicItems> = {
  'MATH-1.0': { items: 15, easy: 4, moderate: 8, difficult: 3 },
  'MATH-2.0': { items: 15, easy: 6, moderate: 6, difficult: 3 },
  'MATH-3.0': { items: 15, easy: 3, moderate: 10, difficult: 2 },
  'MATH-4.0': { items: 15, easy: 0, moderate: 10, difficult: 5 },
  'MATH-5.0': { items: 15, easy: 5, moderate: 6, difficult: 4 },
  'MATH-6.0': { items: 9, easy: 4, moderate: 0, difficult: 5, sharedWith: 'ELECS' },
  'MATH-7.0': { items: 8, easy: 5, moderate: 0, difficult: 3, sharedWith: 'EST' },
  'MATH-8.0': { items: 8, easy: 3, moderate: 0, difficult: 5, sharedWith: 'ELECS' },
  'GEAS-1.0': { items: 10, easy: 10, moderate: 0, difficult: 0 },
  'GEAS-2.0': { items: 15, easy: 15, moderate: 0, difficult: 0 },
  'GEAS-3.0': { items: 6, easy: 6, moderate: 0, difficult: 0 },
  'GEAS-4.0': { items: 9, easy: 9, moderate: 0, difficult: 0 },
  'GEAS-5.0': { items: 10, easy: 0, moderate: 5, difficult: 5 },
  'GEAS-6.0': { items: 10, easy: 0, moderate: 6, difficult: 4 },
  'GEAS-7.0': { items: 8, easy: 8, moderate: 0, difficult: 0 },
  'GEAS-8.0': { items: 10, easy: 10, moderate: 0, difficult: 0 },
  'GEAS-9.0': { items: 10, easy: 0, moderate: 6, difficult: 4 },
  'GEAS-10.0': { items: 10, easy: 0, moderate: 4, difficult: 6 },
  'GEAS-11.0': { items: 2, easy: 2, moderate: 0, difficult: 0 },
  'ELECS-1.0': { items: 12, easy: 2, moderate: 4, difficult: 6 },
  'ELECS-2.0': { items: 12, easy: 0, moderate: 5, difficult: 7 },
  'ELECS-3.0': { items: 8, easy: 4, moderate: 4, difficult: 0, sharedWith: 'MATH' },
  'ELECS-4.0': { items: 14, easy: 9, moderate: 3, difficult: 2 },
  'ELECS-5.0': { items: 14, easy: 6, moderate: 5, difficult: 3 },
  'ELECS-6.0': { items: 8, easy: 4, moderate: 2, difficult: 2, sharedWith: 'EST' },
  'ELECS-7.0': { items: 12, easy: 1, moderate: 6, difficult: 5 },
  'ELECS-8.0': { items: 12, easy: 4, moderate: 6, difficult: 2 },
  'ELECS-9.0': { items: 8, easy: 0, moderate: 5, difficult: 3, sharedWith: 'MATH' },
  'EST-1.0': { items: 10, easy: 4, moderate: 4, difficult: 2 },
  'EST-2.0': { items: 25, easy: 6, moderate: 12, difficult: 7 },
  'EST-3.0': { items: 15, easy: 4, moderate: 7, difficult: 4 },
  'EST-4.0': { items: 23, easy: 5, moderate: 11, difficult: 7 },
  'EST-5.0': { items: 7, easy: 3, moderate: 1, difficult: 3 },
  'EST-6.0': { items: 20, easy: 8, moderate: 5, difficult: 7 },
}

export interface TosTotals {
  items: number
  easy: number
  moderate: number
  difficult: number
}

/** Sum of topic counts for one subject (shared topics count toward each subject they are listed under). */
export function getSubjectTotals(subjectCode: TosSubjectCode): TosTotals {
  const totals: TosTotals = { items: 0, easy: 0, moderate: 0, difficult: 0 }
  for (const [id, t] of Object.entries(TOS_ITEMS)) {
    if (!id.startsWith(`${subjectCode}-`)) continue
    totals.items += t.items
    totals.easy += t.easy
    totals.moderate += t.moderate
    totals.difficult += t.difficult
  }
  return totals
}
