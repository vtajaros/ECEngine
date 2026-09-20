/**
 * Analysis of variance (ANOVA), Kruskal-Wallis, and Welch's t-test.
 */

import { mean, variance } from './descriptive'
import { fSf, chi2Sf, tCdf } from './distributions'

export interface OneWayAnovaResult {
  k: number
  N: number
  ssb: number
  ssw: number
  sst: number
  dfB: number
  dfW: number
  msb: number
  msw: number
  F: number
  pValue: number
  etaSquared: number
  groupMeans: number[]
  groupSizes: number[]
  grandMean: number
}

export interface KruskalWallisResult {
  H: number
  df: number
  pValue: number
  epsilonSquared: number
}

export interface WelchTResult {
  t: number
  df: number
  pValue: number
  meanDiff: number
  se: number
}

/**
 * Performs a One-Way Analysis of Variance (ANOVA).
 * Empty groups are ignored. Requires k >= 2 and N > k; otherwise returns NaN fields.
 */
export function oneWayAnova(groups: number[][]): OneWayAnovaResult {
  const validGroups = groups.filter((g) => g && g.length > 0)
  const k = validGroups.length
  const groupSizes = validGroups.map((g) => g.length)
  const N = groupSizes.reduce((sum, len) => sum + len, 0)
  const groupMeans = validGroups.map((g) => mean(g))

  if (k < 2 || N <= k) {
    return {
      k,
      N,
      ssb: NaN,
      ssw: NaN,
      sst: NaN,
      dfB: NaN,
      dfW: NaN,
      msb: NaN,
      msw: NaN,
      F: NaN,
      pValue: NaN,
      etaSquared: NaN,
      groupMeans,
      groupSizes,
      grandMean: NaN
    }
  }

  let totalSum = 0
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < groupSizes[i]; j++) {
      totalSum += validGroups[i][j]
    }
  }
  const grandMean = totalSum / N

  const dfB = k - 1
  const dfW = N - k

  let ssb = 0
  let ssw = 0
  for (let i = 0; i < k; i++) {
    const ni = groupSizes[i]
    const m = groupMeans[i]
    ssb += ni * (m - grandMean) * (m - grandMean)
    for (let j = 0; j < ni; j++) {
      const diff = validGroups[i][j] - m
      ssw += diff * diff
    }
  }
  const sst = ssb + ssw

  const msb = ssb / dfB
  const msw = ssw / dfW

  let F: number
  let pValue: number
  if (msw === 0) {
    if (msb === 0) {
      F = 0
      pValue = 1
    } else {
      F = Infinity
      pValue = 0
    }
  } else {
    F = msb / msw
    pValue = fSf(F, dfB, dfW)
  }

  const etaSquared = sst === 0 ? 0 : ssb / sst

  return {
    k,
    N,
    ssb,
    ssw,
    sst,
    dfB,
    dfW,
    msb,
    msw,
    F,
    pValue,
    etaSquared,
    groupMeans,
    groupSizes,
    grandMean
  }
}

/**
 * Performs Kruskal-Wallis non-parametric one-way ANOVA by ranks.
 * Averages ranks for ties, applies tie correction, and uses chi-square approximation.
 * epsilonSquared = (H - k + 1) / (N - k).
 */
export function kruskalWallis(groups: number[][]): KruskalWallisResult {
  const validGroups = groups.filter((g) => g && g.length > 0)
  const k = validGroups.length
  const groupSizes = validGroups.map((g) => g.length)
  const N = groupSizes.reduce((sum, len) => sum + len, 0)

  if (k < 2 || N <= k) {
    return {
      H: NaN,
      df: NaN,
      pValue: NaN,
      epsilonSquared: NaN
    }
  }

  interface RankedItem {
    val: number
    grp: number
  }

  const items: RankedItem[] = []
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < groupSizes[i]; j++) {
      items.push({ val: validGroups[i][j], grp: i })
    }
  }

  items.sort((a, b) => a.val - b.val)

  const ranks: number[] = new Array(N)
  let tieCorrectionSum = 0
  let i = 0

  while (i < N) {
    let j = i
    while (j < N - 1 && items[j + 1].val === items[i].val) {
      j++
    }
    const tieCount = j - i + 1
    const avgRank = (i + 1 + j + 1) / 2
    for (let m = i; m <= j; m++) {
      ranks[m] = avgRank
    }
    if (tieCount > 1) {
      tieCorrectionSum += tieCount * tieCount * tieCount - tieCount
    }
    i = j + 1
  }

  const R = new Array<number>(k).fill(0)
  for (let m = 0; m < N; m++) {
    R[items[m].grp] += ranks[m]
  }

  let sumRSqOverN = 0
  for (let g = 0; g < k; g++) {
    sumRSqOverN += (R[g] * R[g]) / groupSizes[g]
  }

  const hUncorrected = (12 / (N * (N + 1))) * sumRSqOverN - 3 * (N + 1)
  const tieCorrection = 1 - tieCorrectionSum / (N * N * N - N)

  const H = tieCorrection === 0 ? 0 : hUncorrected / tieCorrection
  const df = k - 1
  const pValue = chi2Sf(H, df)
  const epsilonSquared = (H - k + 1) / (N - k)

  return {
    H,
    df,
    pValue,
    epsilonSquared
  }
}

/**
 * Performs Welch's two-sample t-test (unequal variances assumed).
 * Uses the Welch–Satterthwaite equation to calculate degrees of freedom.
 */
export function welchT(a: number[], b: number[]): WelchTResult {
  const n1 = a.length
  const n2 = b.length
  if (n1 < 2 || n2 < 2) {
    return { t: NaN, df: NaN, pValue: NaN, meanDiff: NaN, se: NaN }
  }

  const m1 = mean(a)
  const m2 = mean(b)
  const s1Sq = variance(a)
  const s2Sq = variance(b)

  const v1 = s1Sq / n1
  const v2 = s2Sq / n2
  const se = Math.sqrt(v1 + v2)
  const meanDiff = m1 - m2

  if (se === 0) {
    if (meanDiff === 0) {
      return { t: 0, df: n1 + n2 - 2, pValue: 1, meanDiff: 0, se: 0 }
    }
    const t = meanDiff > 0 ? Infinity : -Infinity
    return { t, df: NaN, pValue: 0, meanDiff, se: 0 }
  }

  const t = meanDiff / se
  const num = (v1 + v2) * (v1 + v2)
  const den = (v1 * v1) / (n1 - 1) + (v2 * v2) / (n2 - 1)
  const df = num / den
  const pValue = 2 * tCdf(-Math.abs(t), df)

  return { t, df, pValue, meanDiff, se }
}
