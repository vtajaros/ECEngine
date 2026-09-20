/**
 * Dependency-free numerical special functions.
 */

// Lanczos approximation constants (g = 7, N = 9)
const LANCZOS_G = 7
const LANCZOS_COEFFS = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.138571095836524,
  9.9843695780195716e-6,
  1.5056327351493116e-7
]

const SQRT_2PI = Math.sqrt(2 * Math.PI)
const LOG_SQRT_2PI = Math.log(SQRT_2PI)

/**
 * Computes the natural logarithm of the Gamma function, ln(Gamma(x)), using Lanczos approximation.
 * Returns NaN for non-positive integers and negative inputs.
 */
export function lnGamma(x: number): number {
  if (isNaN(x) || x <= 0) return NaN

  // Reflection formula for x < 0.5
  if (x < 0.5) {
    const sinPix = Math.sin(Math.PI * x)
    if (sinPix === 0) return NaN
    return Math.log(Math.PI / Math.abs(sinPix)) - lnGamma(1 - x)
  }

  const z = x - 1
  let xSum = LANCZOS_COEFFS[0]
  for (let i = 1; i < LANCZOS_COEFFS.length; i++) {
    xSum += LANCZOS_COEFFS[i] / (z + i)
  }

  const t = z + LANCZOS_G + 0.5
  return LOG_SQRT_2PI + (z + 0.5) * Math.log(t) - t + Math.log(xSum)
}

/**
 * Computes the regularized lower incomplete gamma function P(a, x) = gamma(a, x) / Gamma(a).
 * Uses series expansion for x < a + 1 and continued fraction otherwise.
 */
export function regGammaP(a: number, x: number): number {
  if (isNaN(a) || isNaN(x) || a <= 0 || x < 0) return NaN
  if (x === 0) return 0
  if (x === Infinity) return 1

  if (x < a + 1) {
    // Series expansion: P(a, x) = (x^a * e^-x / Gamma(a)) * sum_{n=0}^inf (x^n / (a * (a+1) * ... * (a+n)))
    let term = 1 / a
    let sum = term
    for (let n = 1; n < 300; n++) {
      term *= x / (a + n)
      sum += term
      if (term < sum * 1e-15) break
    }
    const factor = Math.exp(a * Math.log(x) - x - lnGamma(a))
    return Math.min(1, Math.max(0, sum * factor))
  } else {
    // Continued fraction for Q(a, x) = 1 - P(a, x) via modified Lentz's method
    const TINY = 1e-30
    let f = x + 1 - a
    if (Math.abs(f) < TINY) f = TINY
    let c = f
    let d = 0

    for (let m = 1; m <= 300; m++) {
      const am = -m * (m - a)
      const bm = x + 2 * m + 1 - a
      d = bm + am * d
      if (Math.abs(d) < TINY) d = TINY
      c = bm + am / c
      if (Math.abs(c) < TINY) c = TINY
      d = 1 / d
      const delta = c * d
      f *= delta
      if (Math.abs(delta - 1) < 1e-15) break
    }

    const factor = Math.exp(a * Math.log(x) - x - lnGamma(a))
    const q = factor * (1 / f)
    return Math.min(1, Math.max(0, 1 - q))
  }
}

/**
 * Computes the regularized incomplete beta function I_x(a, b).
 * Uses modified Lentz's method for continued fraction evaluation with symmetry reflection.
 */
export function regBetaI(x: number, a: number, b: number): number {
  if (isNaN(x) || isNaN(a) || isNaN(b) || a <= 0 || b <= 0 || x < 0 || x > 1) return NaN
  if (x === 0) return 0
  if (x === 1) return 1

  // Use symmetry transformation if x > (a + 1) / (a + b + 2) for faster convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regBetaI(1 - x, b, a)
  }

  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b)
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - Math.log(a) - lnBeta)

  const TINY = 1e-30
  let f = 1.0
  let c = 1.0
  let d = 0.0

  for (let k = 1; k <= 300; k++) {
    let num: number
    if (k % 2 === 1) {
      const m = (k - 1) / 2
      num = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1))
    } else {
      const m = k / 2
      num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m))
    }

    d = 1.0 + num * d
    if (Math.abs(d) < TINY) d = TINY
    c = 1.0 + num / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1.0 / d
    const delta = c * d
    f *= delta
    if (Math.abs(delta - 1.0) < 1e-15) break
  }

  return Math.min(1, Math.max(0, front / f))
}

/**
 * Computes the error function erf(x) via regularized lower incomplete gamma: erf(x) = sign(x) * regGammaP(0.5, x^2).
 */
export function erf(x: number): number {
  if (isNaN(x)) return NaN
  if (x === 0) return 0
  if (x === Infinity) return 1
  if (x === -Infinity) return -1

  const sign = x < 0 ? -1 : 1
  return sign * regGammaP(0.5, x * x)
}

/**
 * Inverts a strictly monotonically increasing CDF function cdf(x) to find x such that cdf(x) = p.
 * Uses automatic bracket expansion followed by Brent's root-finding method.
 */
export function invertMonotone(
  cdf: (x: number) => number,
  p: number,
  lo: number,
  hi: number,
  tol = 1e-12
): number {
  if (isNaN(p) || p <= 0 || p >= 1) return NaN

  let a = lo
  let b = hi
  let fa = cdf(a) - p
  let fb = cdf(b) - p

  // Expand bracket downwards if cdf(lo) > p
  let expandIter = 0
  while (fa > 0 && expandIter < 80) {
    const span = Math.max(1, Math.abs(b - a))
    b = a
    fb = fa
    a -= 2 * span
    fa = cdf(a) - p
    expandIter++
  }

  // Expand bracket upwards if cdf(hi) < p
  expandIter = 0
  while (fb < 0 && expandIter < 80) {
    const span = Math.max(1, Math.abs(b - a))
    a = b
    fa = fb
    b += 2 * span
    fb = cdf(b) - p
    expandIter++
  }

  if (fa > 0 || fb < 0) return NaN

  // Brent's root-finding algorithm
  let c = a
  let fc = fa
  let d = b - a
  let e = d

  for (let i = 0; i < 150; i++) {
    if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) {
      c = a
      fc = fa
      d = b - a
      e = d
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b
      b = c
      c = a
      fa = fb
      fb = fc
      fc = fa
    }

    const tolAct = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol
    const m = 0.5 * (c - b)

    if (Math.abs(m) <= tolAct || fb === 0 || Math.abs(fb) <= tol) {
      return b
    }

    if (Math.abs(e) >= tolAct && Math.abs(fa) > Math.abs(fb)) {
      let s = fb / fa
      let p1: number
      let q1: number
      if (a === c) {
        p1 = 2 * m * s
        q1 = 1 - s
      } else {
        q1 = fa / fc
        const r = fb / fc
        p1 = s * (2 * m * q1 * (q1 - r) - (b - a) * (r - 1))
        q1 = (q1 - 1) * (r - 1) * (s - 1)
      }
      if (p1 > 0) q1 = -q1
      else p1 = -p1
      if (2 * p1 < Math.min(3 * m * q1 - Math.abs(tolAct * q1), Math.abs(e * q1))) {
        e = d
        d = p1 / q1
      } else {
        d = m
        e = m
      }
    } else {
      d = m
      e = m
    }

    a = b
    fa = fb
    if (Math.abs(d) > tolAct) b += d
    else b += m > 0 ? tolAct : -tolAct
    fb = cdf(b) - p
  }

  return b
}
