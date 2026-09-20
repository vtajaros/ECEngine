/**
 * Linear regression, prediction, and correlation analysis.
 */

import { mean } from './descriptive'
import { tCdf } from './distributions'

export interface LinearRegressionResult {
  n: number
  slope: number
  intercept: number
  r: number
  r2: number
  sxx: number
  sxy: number
  syy: number
  residualSe: number
  slopeSe: number
  slopeT: number
  slopeP: number
  xMin: number
  xMax: number
  df: number
}

export interface PredictionResult {
  yHat: number
  extrapolated: boolean
}

export interface CorrelationInterpretation {
  strength: 'none' | 'weak' | 'moderate' | 'strong' | 'perfect'
  direction: 'positive' | 'negative' | 'none'
}

export interface PearsonTestResult {
  t: number
  df: number
  pValue: number
}

/**
 * Computes simple ordinary least-squares linear regression: y = slope * x + intercept.
 */
export function linearRegression(xs: number[], ys: number[]): LinearRegressionResult {
  const n = xs.length
  if (n !== ys.length || n < 3) {
    let xMin = NaN
    let xMax = NaN
    if (n > 0) {
      xMin = xs[0]
      xMax = xs[0]
      for (let i = 1; i < n; i++) {
        if (xs[i] < xMin) xMin = xs[i]
        if (xs[i] > xMax) xMax = xs[i]
      }
    }
    return {
      n,
      slope: NaN,
      intercept: NaN,
      r: NaN,
      r2: NaN,
      sxx: NaN,
      sxy: NaN,
      syy: NaN,
      residualSe: NaN,
      slopeSe: NaN,
      slopeT: NaN,
      slopeP: NaN,
      xMin,
      xMax,
      df: n >= 2 ? n - 2 : NaN
    }
  }

  let xMin = xs[0]
  let xMax = xs[0]
  for (let i = 1; i < n; i++) {
    if (xs[i] < xMin) xMin = xs[i]
    if (xs[i] > xMax) xMax = xs[i]
  }

  const mx = mean(xs)
  const my = mean(ys)
  let sxx = 0
  let syy = 0
  let sxy = 0

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }

  if (sxx === 0) {
    return {
      n,
      slope: NaN,
      intercept: NaN,
      r: NaN,
      r2: NaN,
      sxx: 0,
      sxy,
      syy,
      residualSe: NaN,
      slopeSe: NaN,
      slopeT: NaN,
      slopeP: NaN,
      xMin,
      xMax,
      df: n - 2
    }
  }

  const slope = sxy / sxx
  const intercept = my - slope * mx
  const denom = Math.sqrt(sxx * syy)
  const r = denom === 0 ? 0 : sxy / denom
  const r2 = r * r

  let sse = 0
  for (let i = 0; i < n; i++) {
    const yHat = slope * xs[i] + intercept
    const res = ys[i] - yHat
    sse += res * res
  }
  if (sse < 1e-24) sse = 0

  const df = n - 2
  const residualSe = Math.sqrt(sse / df)
  const slopeSe = residualSe === 0 ? 0 : residualSe / Math.sqrt(sxx)

  let slopeT: number
  let slopeP: number

  if (slopeSe === 0) {
    if (slope === 0) {
      slopeT = 0
      slopeP = 1
    } else {
      slopeT = slope > 0 ? Infinity : -Infinity
      slopeP = 0
    }
  } else {
    slopeT = slope / slopeSe
    slopeP = 2 * tCdf(-Math.abs(slopeT), df)
  }

  return {
    n,
    slope,
    intercept,
    r,
    r2,
    sxx,
    sxy,
    syy,
    residualSe,
    slopeSe,
    slopeT,
    slopeP,
    xMin,
    xMax,
    df
  }
}

/**
 * Predicts yHat for a given x using a trained linear regression model.
 * Flags extrapolated as true if x < xMin or x > xMax of the training data.
 */
export function predict(
  model: Pick<LinearRegressionResult, 'slope' | 'intercept' | 'xMin' | 'xMax'>,
  x: number
): PredictionResult {
  if (isNaN(x) || isNaN(model.slope) || isNaN(model.intercept)) {
    return { yHat: NaN, extrapolated: false }
  }
  const yHat = model.slope * x + model.intercept
  const extrapolated = !isNaN(model.xMin) && !isNaN(model.xMax) && (x < model.xMin || x > model.xMax)
  return { yHat, extrapolated }
}

/**
 * Computes coefficient of determination R^2 from Pearson correlation r.
 */
export function coefficientOfDetermination(r: number): number {
  if (isNaN(r)) return NaN
  return r * r
}

/**
 * Recovers Pearson correlation r from R^2 with a given slope sign (+1 or -1).
 */
export function rFromR2(r2: number, slopeSign: 1 | -1): number {
  if (isNaN(r2) || r2 < 0) return NaN
  return slopeSign * Math.sqrt(r2)
}

/**
 * Hypothesis test for Pearson correlation r: H0: rho = 0 vs H1: rho != 0.
 * Test statistic: t = r * sqrt((n - 2) / (1 - r^2)) with df = n - 2.
 */
export function pearsonTest(r: number, n: number): PearsonTestResult {
  if (isNaN(r) || isNaN(n) || n < 3 || Math.abs(r) > 1) {
    return { t: NaN, df: n >= 2 ? n - 2 : NaN, pValue: NaN }
  }

  const df = n - 2
  if (Math.abs(r) === 1) {
    return {
      t: r > 0 ? Infinity : -Infinity,
      df,
      pValue: 0
    }
  }

  const denom = Math.max(0, 1 - r * r)
  const t = r * Math.sqrt(df / denom)
  const pValue = 2 * tCdf(-Math.abs(t), df)

  return { t, df, pValue }
}

/**
 * Interprets correlation coefficient r:
 * strength: |r| < 0.1 none, < 0.3 weak, < 0.7 moderate, < 1 strong, == 1 perfect.
 * direction: 'positive' | 'negative' | 'none'.
 */
export function interpretR(r: number): CorrelationInterpretation {
  if (isNaN(r) || Math.abs(r) > 1) {
    return { strength: 'none', direction: 'none' }
  }

  const absR = Math.abs(r)
  let strength: CorrelationInterpretation['strength']

  if (absR >= 1 - 1e-12) {
    strength = 'perfect'
  } else if (absR >= 0.7) {
    strength = 'strong'
  } else if (absR >= 0.3) {
    strength = 'moderate'
  } else if (absR >= 0.1) {
    strength = 'weak'
  } else {
    strength = 'none'
  }

  const direction: CorrelationInterpretation['direction'] =
    strength === 'none' || r === 0 ? 'none' : r > 0 ? 'positive' : 'negative'

  return { strength, direction }
}
