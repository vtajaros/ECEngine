/**
 * Contingency tables, Chi-square test of independence, and two-proportion z-test.
 */

import { chi2Sf, normalSf } from './distributions'

export interface ChiSquareIndependenceResult {
  chi2: number
  df: number
  pValue: number
  cramersV: number
  expected: number[][]
  total: number
}

export interface TwoProportionZResult {
  p1: number
  p2: number
  pooled: number
  se: number
  z: number
  pValue: number
}

/**
 * Performs Pearson's Chi-square test of independence on a two-way contingency table.
 * Computes Cramér's V = sqrt(chi2 / (N * (min(r, c) - 1))).
 * Returns NaN fields if any row/column total is 0 or table is smaller than 2x2.
 */
export function chiSquareIndependence(table: number[][]): ChiSquareIndependenceResult {
  const r = table.length
  if (r < 2) {
    return { chi2: NaN, df: NaN, pValue: NaN, cramersV: NaN, expected: [], total: NaN }
  }
  const c = table[0]?.length ?? 0
  if (c < 2) {
    return { chi2: NaN, df: NaN, pValue: NaN, cramersV: NaN, expected: [], total: NaN }
  }

  for (let i = 1; i < r; i++) {
    if (!table[i] || table[i].length !== c) {
      return { chi2: NaN, df: NaN, pValue: NaN, cramersV: NaN, expected: [], total: NaN }
    }
  }

  const rowTotals = new Array<number>(r).fill(0)
  const colTotals = new Array<number>(c).fill(0)
  let total = 0

  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const val = table[i][j]
      if (isNaN(val) || val < 0) {
        return { chi2: NaN, df: NaN, pValue: NaN, cramersV: NaN, expected: [], total: NaN }
      }
      rowTotals[i] += val
      colTotals[j] += val
      total += val
    }
  }

  for (let i = 0; i < r; i++) {
    if (rowTotals[i] === 0) {
      return { chi2: NaN, df: NaN, pValue: NaN, cramersV: NaN, expected: [], total }
    }
  }
  for (let j = 0; j < c; j++) {
    if (colTotals[j] === 0) {
      return { chi2: NaN, df: NaN, pValue: NaN, cramersV: NaN, expected: [], total }
    }
  }
  if (total === 0) {
    return { chi2: NaN, df: NaN, pValue: NaN, cramersV: NaN, expected: [], total: 0 }
  }

  const df = (r - 1) * (c - 1)
  const expected: number[][] = []
  let chi2 = 0

  for (let i = 0; i < r; i++) {
    const row: number[] = []
    for (let j = 0; j < c; j++) {
      const exp = (rowTotals[i] * colTotals[j]) / total
      row.push(exp)
      const diff = table[i][j] - exp
      chi2 += (diff * diff) / exp
    }
    expected.push(row)
  }

  const pValue = chi2Sf(chi2, df)
  const k = Math.min(r, c)
  const cramersV = Math.sqrt(chi2 / (total * (k - 1)))

  return {
    chi2,
    df,
    pValue,
    cramersV,
    expected,
    total
  }
}

/**
 * Performs a two-sample z-test for comparing two independent proportions with pooled standard error.
 * Two-sided test: H0: p1 = p2 vs H1: p1 != p2.
 */
export function twoProportionZ(
  x1: number,
  n1: number,
  x2: number,
  n2: number
): TwoProportionZResult {
  if (
    isNaN(x1) ||
    isNaN(n1) ||
    isNaN(x2) ||
    isNaN(n2) ||
    n1 <= 0 ||
    n2 <= 0 ||
    x1 < 0 ||
    x1 > n1 ||
    x2 < 0 ||
    x2 > n2
  ) {
    return { p1: NaN, p2: NaN, pooled: NaN, se: NaN, z: NaN, pValue: NaN }
  }

  const p1 = x1 / n1
  const p2 = x2 / n2
  const pooled = (x1 + x2) / (n1 + n2)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))

  if (se === 0) {
    if (p1 === p2) {
      return { p1, p2, pooled, se: 0, z: 0, pValue: 1 }
    }
    const z = p1 > p2 ? Infinity : -Infinity
    return { p1, p2, pooled, se: 0, z, pValue: 0 }
  }

  const z = (p1 - p2) / se
  const pValue = 2 * normalSf(Math.abs(z))

  return {
    p1,
    p2,
    pooled,
    se,
    z,
    pValue
  }
}
