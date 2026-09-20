/**
 * Statistical inference, hypothesis testing, and confidence intervals.
 */

import { normalCdf, normalSf, normalQuantile, tCdf, tQuantile, chi2Sf } from './distributions'

/** Computes the standard error of the mean: SE = sd / sqrt(n). */
export function standardErrorMean(sd: number, n: number): number {
  if (isNaN(sd) || isNaN(n) || sd < 0 || n <= 0) return NaN
  return sd / Math.sqrt(n)
}

/** Computes the standard error of a proportion: SE = sqrt(p * (1 - p) / n). */
export function standardErrorProportion(p: number, n: number): number {
  if (isNaN(p) || isNaN(n) || p < 0 || p > 1 || n <= 0) return NaN
  return Math.sqrt((p * (1 - p)) / n)
}

export interface MeanCIResult {
  margin: number
  lower: number
  upper: number
  critical: number
  kind: 'z' | 't'
  se: number
}

/**
 * Computes the confidence interval for a population mean.
 * Uses z-distribution ONLY if sigmaKnown is true; otherwise uses t-distribution with df = n - 1.
 */
export function meanCI(params: {
  mean: number
  sd: number
  n: number
  confidence: number
  sigmaKnown?: boolean
  zOverride?: number
}): MeanCIResult {
  const { mean, sd, n, confidence, sigmaKnown = false, zOverride } = params
  const kind: 'z' | 't' = sigmaKnown ? 'z' : 't'

  if (
    isNaN(mean) ||
    isNaN(sd) ||
    isNaN(n) ||
    isNaN(confidence) ||
    sd < 0 ||
    n <= 0 ||
    confidence <= 0 ||
    confidence >= 1 ||
    (!sigmaKnown && n < 2)
  ) {
    return { margin: NaN, lower: NaN, upper: NaN, critical: NaN, kind, se: NaN }
  }

  const se = standardErrorMean(sd, n)
  const alpha = 1 - confidence
  let critical: number

  if (zOverride !== undefined) {
    critical = zOverride
  } else if (sigmaKnown) {
    critical = normalQuantile(1 - alpha / 2)
  } else {
    critical = tQuantile(1 - alpha / 2, n - 1)
  }

  const margin = critical * se
  const lower = mean - margin
  const upper = mean + margin

  return { margin, lower, upper, critical, kind, se }
}

export interface ProportionCIResult {
  pHat: number
  se: number
  margin: number
  lower: number
  upper: number
  critical: number
}

/**
 * Computes the large-sample Wald confidence interval for a population proportion.
 */
export function proportionCI(
  successes: number,
  n: number,
  confidence: number,
  zOverride?: number
): ProportionCIResult {
  if (
    isNaN(successes) ||
    isNaN(n) ||
    isNaN(confidence) ||
    successes < 0 ||
    successes > n ||
    n <= 0 ||
    confidence <= 0 ||
    confidence >= 1
  ) {
    return { pHat: NaN, se: NaN, margin: NaN, lower: NaN, upper: NaN, critical: NaN }
  }

  const pHat = successes / n
  const se = standardErrorProportion(pHat, n)
  const alpha = 1 - confidence
  const critical = zOverride !== undefined ? zOverride : normalQuantile(1 - alpha / 2)
  const margin = critical * se
  const lower = Math.max(0, pHat - margin)
  const upper = Math.min(1, pHat + margin)

  return { pHat, se, margin, lower, upper, critical }
}

export interface HypothesisTestResult {
  z?: number
  t?: number
  df?: number
  pValue: number
  critical: number
  reject: boolean
}

/**
 * Performs a hypothesis test from a computed z-statistic.
 */
export function zTestFromStatistic(
  z: number,
  tail: 'left' | 'right' | 'two',
  alpha = 0.05
): { z: number; pValue: number; critical: number; reject: boolean } {
  if (isNaN(z) || isNaN(alpha) || alpha <= 0 || alpha >= 1) {
    return { z: NaN, pValue: NaN, critical: NaN, reject: false }
  }

  let pValue: number
  let critical: number
  let reject: boolean

  if (tail === 'left') {
    pValue = normalCdf(z)
    critical = normalQuantile(alpha)
    reject = z < critical
  } else if (tail === 'right') {
    pValue = normalSf(z)
    critical = normalQuantile(1 - alpha)
    reject = z > critical
  } else {
    pValue = 2 * normalSf(Math.abs(z))
    critical = normalQuantile(1 - alpha / 2)
    reject = Math.abs(z) > critical
  }

  return { z, pValue, critical, reject }
}

/**
 * Performs a one-sample z-test for the mean with known population standard deviation.
 */
export function oneSampleZ(params: {
  sampleMean: number
  mu0: number
  sigma: number
  n: number
  tail: 'left' | 'right' | 'two'
  alpha?: number
}): { z: number; pValue: number; critical: number; reject: boolean } {
  const { sampleMean, mu0, sigma, n, tail, alpha = 0.05 } = params
  if (isNaN(sampleMean) || isNaN(mu0) || isNaN(sigma) || isNaN(n) || sigma <= 0 || n <= 0) {
    return { z: NaN, pValue: NaN, critical: NaN, reject: false }
  }

  const se = sigma / Math.sqrt(n)
  const z = (sampleMean - mu0) / se
  return zTestFromStatistic(z, tail, alpha)
}

/**
 * Performs a one-sample t-test for the mean with unknown population standard deviation.
 */
export function oneSampleT(params: {
  sampleMean: number
  mu0: number
  s: number
  n: number
  tail: 'left' | 'right' | 'two'
  alpha?: number
}): { t: number; df: number; pValue: number; critical: number; reject: boolean } {
  const { sampleMean, mu0, s, n, tail, alpha = 0.05 } = params
  if (isNaN(sampleMean) || isNaN(mu0) || isNaN(s) || isNaN(n) || s <= 0 || n < 2 || alpha <= 0 || alpha >= 1) {
    return { t: NaN, df: NaN, pValue: NaN, critical: NaN, reject: false }
  }

  const df = n - 1
  const se = s / Math.sqrt(n)
  const t = (sampleMean - mu0) / se

  let pValue: number
  let critical: number
  let reject: boolean

  if (tail === 'left') {
    pValue = tCdf(t, df)
    critical = -tQuantile(1 - alpha, df)
    reject = t < critical
  } else if (tail === 'right') {
    pValue = 1 - tCdf(t, df)
    critical = tQuantile(1 - alpha, df)
    reject = t > critical
  } else {
    pValue = 2 * (1 - tCdf(Math.abs(t), df))
    critical = tQuantile(1 - alpha / 2, df)
    reject = Math.abs(t) > critical
  }

  return { t, df, pValue, critical, reject }
}

export interface ChiSquareGofResult {
  chi2: number
  df: number
  pValue: number
  cramersW: number
  expected: number[]
}

/**
 * Computes the Chi-square goodness-of-fit test. Proportions must sum to 1 within 1e-9.
 */
export function chiSquareGof(observed: number[], expectedProportions: number[]): ChiSquareGofResult {
  if (
    observed.length !== expectedProportions.length ||
    observed.length < 2 ||
    observed.some((o) => o < 0 || isNaN(o)) ||
    expectedProportions.some((p) => p <= 0 || isNaN(p))
  ) {
    return { chi2: NaN, df: NaN, pValue: NaN, cramersW: NaN, expected: [] }
  }

  const propSum = expectedProportions.reduce((acc, val) => acc + val, 0)
  if (Math.abs(propSum - 1) > 1e-9) {
    return { chi2: NaN, df: NaN, pValue: NaN, cramersW: NaN, expected: [] }
  }

  const total = observed.reduce((acc, val) => acc + val, 0)
  if (total === 0) {
    return { chi2: NaN, df: NaN, pValue: NaN, cramersW: NaN, expected: [] }
  }

  const expected = expectedProportions.map((p) => p * total)
  let chi2 = 0
  for (let i = 0; i < observed.length; i++) {
    const diff = observed[i] - expected[i]
    chi2 += (diff * diff) / expected[i]
  }

  const df = observed.length - 1
  const pValue = chi2Sf(chi2, df)
  const cramersW = Math.sqrt(chi2 / total)

  return { chi2, df, pValue, cramersW, expected }
}

/** Computes Chebyshev's minimum probability P(|X - mu| < k * sigma) >= 1 - 1/k^2 for k > 1. */
export function chebyshevMinProbability(k: number): number {
  if (isNaN(k) || k <= 1) return NaN
  return 1 - 1 / (k * k)
}

/** Computes the number of standard deviations k for a given distance: k = distance / sigma. */
export function chebyshevK(distance: number, sigma: number): number {
  if (isNaN(distance) || isNaN(sigma) || distance <= 0 || sigma <= 0) return NaN
  return distance / sigma
}

/** Computes the sample size multiplier required when margin of error changes: (oldMargin / newMargin)^2. */
export function sampleSizeMultiplier(oldMargin: number, newMargin: number): number {
  if (isNaN(oldMargin) || isNaN(newMargin) || oldMargin <= 0 || newMargin <= 0) return NaN
  const ratio = oldMargin / newMargin
  return ratio * ratio
}
