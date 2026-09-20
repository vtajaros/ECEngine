/**
 * Dependency-free probability distributions and statistical functions.
 */

import { lnGamma, regGammaP, regBetaI, erf, invertMonotone } from './special'

// Normal distribution constants
const SQRT_2PI = Math.sqrt(2 * Math.PI)
const SQRT_2 = Math.sqrt(2)

// Acklam rational approximation coefficients for inverse normal CDF
const A_COEFFS = [
  -3.969683028665376e1,
  2.209460984245205e2,
  -2.759285104469687e2,
  1.38357751867269e2,
  -3.066479806614716e1,
  2.506628277459239
]
const B_COEFFS = [
  -5.447609879822406e1,
  1.615858368580409e2,
  -1.556989798598866e2,
  6.680131188771972e1,
  -1.328068155288572e1
]
const C_COEFFS = [
  -7.784894002430293e-3,
  -3.223964580411365e-1,
  -2.400758277161838,
  -2.549732539343734,
  4.374664141464968,
  2.938163982698783
]
const D_COEFFS = [
  7.784695709041462e-3,
  3.224671290700398e-1,
  2.445134137142996,
  3.754408661907416
]

function smallChoose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  if (k > n / 2) k = n - k
  let res = 1
  for (let i = 1; i <= k; i++) {
    res = (res * (n - k + i)) / i
  }
  return Math.round(res)
}

/** Computes the probability density function (PDF) of a normal distribution. */
export function normalPdf(x: number, mu = 0, sigma = 1): number {
  if (isNaN(x) || isNaN(mu) || isNaN(sigma) || sigma <= 0) return NaN
  const z = (x - mu) / sigma
  return Math.exp(-0.5 * z * z) / (sigma * SQRT_2PI)
}

/** Computes the cumulative distribution function (CDF) of a normal distribution. */
export function normalCdf(x: number, mu = 0, sigma = 1): number {
  if (isNaN(x) || isNaN(mu) || isNaN(sigma) || sigma <= 0) return NaN
  const z = (x - mu) / sigma
  return 0.5 * (1 + erf(z / SQRT_2))
}

/** Computes the survival function (1 - CDF) of a normal distribution. */
export function normalSf(x: number, mu = 0, sigma = 1): number {
  if (isNaN(x) || isNaN(mu) || isNaN(sigma) || sigma <= 0) return NaN
  const z = (x - mu) / sigma
  return 0.5 * (1 - erf(z / SQRT_2))
}

/** Computes the quantile function (inverse CDF) of a normal distribution using Acklam approximation with Halley polish. */
export function normalQuantile(p: number, mu = 0, sigma = 1): number {
  if (isNaN(p) || isNaN(mu) || isNaN(sigma) || sigma <= 0 || p < 0 || p > 1) return NaN
  if (p === 0) return -Infinity
  if (p === 1) return Infinity
  if (p === 0.5) return mu

  const pLow = 0.02425
  const pHigh = 1 - pLow
  let x: number

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    x =
      (((((C_COEFFS[0] * q + C_COEFFS[1]) * q + C_COEFFS[2]) * q + C_COEFFS[3]) * q + C_COEFFS[4]) * q + C_COEFFS[5]) /
      ((((D_COEFFS[0] * q + D_COEFFS[1]) * q + D_COEFFS[2]) * q + D_COEFFS[3]) * q + 1)
  } else if (p <= pHigh) {
    const q = p - 0.5
    const r = q * q
    x =
      ((((((A_COEFFS[0] * r + A_COEFFS[1]) * r + A_COEFFS[2]) * r + A_COEFFS[3]) * r + A_COEFFS[4]) * r + A_COEFFS[5]) * q) /
      (((((B_COEFFS[0] * r + B_COEFFS[1]) * r + B_COEFFS[2]) * r + B_COEFFS[3]) * r + B_COEFFS[4]) * r + 1)
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    x =
      -(((((C_COEFFS[0] * q + C_COEFFS[1]) * q + C_COEFFS[2]) * q + C_COEFFS[3]) * q + C_COEFFS[4]) * q + C_COEFFS[5]) /
      ((((D_COEFFS[0] * q + D_COEFFS[1]) * q + D_COEFFS[2]) * q + D_COEFFS[3]) * q + 1)
  }

  // One Halley's method polish step: x_{new} = x - u / (1 + 0.5 * x * u) where u = (Phi(x) - p) / phi(x)
  const e = normalCdf(x, 0, 1) - p
  const u = e * SQRT_2PI * Math.exp(0.5 * x * x)
  x = x - u / (1 + 0.5 * x * u)

  return mu + sigma * x
}

/** Computes the cumulative distribution function (CDF) of Student's t-distribution. */
export function tCdf(t: number, df: number): number {
  if (isNaN(t) || isNaN(df) || df <= 0) return NaN
  if (t === 0) return 0.5

  const x = df / (df + t * t)
  const ibeta = regBetaI(x, df / 2, 0.5)
  return t > 0 ? 1 - 0.5 * ibeta : 0.5 * ibeta
}

/** Computes the quantile function (inverse CDF) of Student's t-distribution. */
export function tQuantile(p: number, df: number): number {
  if (isNaN(p) || isNaN(df) || p <= 0 || p >= 1 || df <= 0) return NaN
  if (p === 0.5) return 0
  if (p < 0.5) return -tQuantile(1 - p, df)

  const z = normalQuantile(p)
  const initHi = Math.max(10, z * 2)
  return invertMonotone((t) => tCdf(t, df), p, 0, initHi)
}

/** Computes the cumulative distribution function (CDF) of the chi-square distribution. */
export function chi2Cdf(x: number, df: number): number {
  if (isNaN(x) || isNaN(df) || df <= 0) return NaN
  if (x <= 0) return 0
  return regGammaP(df / 2, x / 2)
}

/** Computes the survival function (1 - CDF) of the chi-square distribution. */
export function chi2Sf(x: number, df: number): number {
  if (isNaN(x) || isNaN(df) || df <= 0) return NaN
  if (x <= 0) return 1
  return Math.max(0, 1 - regGammaP(df / 2, x / 2))
}

/** Computes the quantile function (inverse CDF) of the chi-square distribution. */
export function chi2Quantile(p: number, df: number): number {
  if (isNaN(p) || isNaN(df) || p <= 0 || p >= 1 || df <= 0) return NaN

  // Wilson-Hilferty transformation starting guess
  const z = normalQuantile(p)
  const v = 2 / (9 * df)
  const base = 1 - v + z * Math.sqrt(v)
  const guess = base > 0 ? df * base * base * base : df
  const lo = Math.max(0, guess * 0.5)
  const hi = Math.max(1, guess * 1.5 + 2)

  return invertMonotone((val) => chi2Cdf(val, df), p, lo, hi)
}

/** Computes the cumulative distribution function (CDF) of Snedecor's F-distribution. */
export function fCdf(x: number, d1: number, d2: number): number {
  if (isNaN(x) || isNaN(d1) || isNaN(d2) || d1 <= 0 || d2 <= 0) return NaN
  if (x <= 0) return 0

  const u = (d1 * x) / (d1 * x + d2)
  return regBetaI(u, d1 / 2, d2 / 2)
}

/** Computes the survival function (1 - CDF) of Snedecor's F-distribution. */
export function fSf(x: number, d1: number, d2: number): number {
  if (isNaN(x) || isNaN(d1) || isNaN(d2) || d1 <= 0 || d2 <= 0) return NaN
  if (x <= 0) return 1

  const w = d2 / (d1 * x + d2)
  return regBetaI(w, d2 / 2, d1 / 2)
}

/** Computes the quantile function (inverse CDF) of Snedecor's F-distribution. */
export function fQuantile(p: number, d1: number, d2: number): number {
  if (isNaN(p) || isNaN(d1) || isNaN(d2) || p <= 0 || p >= 1 || d1 <= 0 || d2 <= 0) return NaN
  return invertMonotone((val) => fCdf(val, d1, d2), p, 0.01, 10)
}

/** Computes the natural logarithm of the binomial coefficient ln(n choose k). */
export function lnChoose(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) return NaN
  if (k === 0 || k === n) return 0
  return lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1)
}

/** Computes the probability mass function (PMF) of a binomial distribution. */
export function binomialPmf(k: number, n: number, p: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || p < 0 || p > 1 || isNaN(p)) return NaN
  if (k < 0 || k > n) return 0
  if (p === 0) return k === 0 ? 1 : 0
  if (p === 1) return k === n ? 1 : 0

  if (n <= 30) {
    return smallChoose(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k)
  }

  const logP = lnChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p)
  return Math.exp(logP)
}

/** Computes the cumulative distribution function (CDF) of a binomial distribution. */
export function binomialCdf(k: number, n: number, p: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || p < 0 || p > 1 || isNaN(p)) return NaN
  if (k < 0) return 0
  if (k >= n) return 1
  if (p === 0) return 1
  if (p === 1) return k >= n ? 1 : 0

  if (n <= 30) {
    let sum = 0
    for (let i = 0; i <= k; i++) {
      sum += binomialPmf(i, n, p)
    }
    return Math.min(1, Math.max(0, sum))
  }

  return regBetaI(1 - p, n - k, k + 1)
}

/** Computes the probability mass function (PMF) of a Poisson distribution. */
export function poissonPmf(k: number, lambda: number): number {
  if (!Number.isInteger(k) || isNaN(k) || isNaN(lambda) || lambda < 0) return NaN
  if (k < 0) return 0
  if (lambda === 0) return k === 0 ? 1 : 0

  const logP = k * Math.log(lambda) - lambda - lnGamma(k + 1)
  return Math.exp(logP)
}

/** Computes the cumulative distribution function (CDF) of a Poisson distribution. */
export function poissonCdf(k: number, lambda: number): number {
  if (!Number.isInteger(k) || isNaN(k) || isNaN(lambda) || lambda < 0) return NaN
  if (k < 0) return 0
  if (lambda === 0) return 1

  return 1 - regGammaP(k + 1, lambda)
}

/** Computes the probability mass function (PMF) of a hypergeometric distribution. */
export function hypergeometricPmf(k: number, N: number, K: number, n: number): number {
  if (
    !Number.isInteger(k) ||
    !Number.isInteger(N) ||
    !Number.isInteger(K) ||
    !Number.isInteger(n) ||
    N < 0 ||
    K < 0 ||
    n < 0 ||
    K > N ||
    n > N
  ) {
    return NaN
  }

  if (k < Math.max(0, n - (N - K)) || k > Math.min(n, K)) return 0

  const logP = lnChoose(K, k) + lnChoose(N - K, n - k) - lnChoose(N, n)
  return Math.exp(logP)
}
