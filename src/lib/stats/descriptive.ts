/**
 * Descriptive statistics and exploratory data analysis functions.
 */

/** Computes the arithmetic mean of a dataset. */
export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN
  let sum = 0
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i]
  }
  return sum / xs.length
}

/** Computes the median (50th percentile) of a dataset. */
export function median(xs: number[]): number {
  if (xs.length === 0) return NaN
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[mid]
  }
  return (sorted[mid - 1] + sorted[mid]) / 2
}

/** Computes the modes of a dataset (all values tied for max frequency; [] if all unique). */
export function modes(xs: number[]): number[] {
  if (xs.length === 0) return []
  const freq = new Map<number, number>()
  let maxCount = 0

  for (const x of xs) {
    const c = (freq.get(x) ?? 0) + 1
    freq.set(x, c)
    if (c > maxCount) {
      maxCount = c
    }
  }

  // If all elements are unique (max frequency is 1), there is no mode
  if (maxCount <= 1) return []

  const result: number[] = []
  for (const [val, count] of freq.entries()) {
    if (count === maxCount) {
      result.push(val)
    }
  }

  return result.sort((a, b) => a - b)
}

/** Computes variance: sample variance (n - 1) by default, or population variance (n) if specified. */
export function variance(xs: number[], opts?: { population?: boolean }): number {
  const n = xs.length
  const isPop = opts?.population ?? false
  if (isPop) {
    if (n < 1) return NaN
  } else {
    if (n < 2) return NaN
  }

  const m = mean(xs)
  let sumSq = 0
  for (let i = 0; i < n; i++) {
    const diff = xs[i] - m
    sumSq += diff * diff
  }

  return sumSq / (isPop ? n : n - 1)
}

/** Computes standard deviation: sample stdev by default, or population stdev if specified. */
export function stdev(xs: number[], opts?: { population?: boolean }): number {
  const v = variance(xs, opts)
  return Math.sqrt(v)
}

/** Computes the q-th quantile (0 <= q <= 1) using Type 7 linear interpolation (pos = (n - 1) * q). */
export function quantile(xs: number[], q: number): number {
  if (xs.length === 0 || isNaN(q) || q < 0 || q > 1) return NaN
  if (xs.length === 1) return xs[0]

  const sorted = [...xs].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base

  if (base >= sorted.length - 1) {
    return sorted[sorted.length - 1]
  }

  return sorted[base] + rest * (sorted[base + 1] - sorted[base])
}

/** Computes the interquartile range (IQR = Q3 - Q1). */
export function iqr(xs: number[]): number {
  if (xs.length === 0) return NaN
  return quantile(xs, 0.75) - quantile(xs, 0.25)
}

/** Identifies Tukey outliers beyond 1.5 * IQR from the quartiles. */
export function tukeyOutliers(xs: number[]): { lowerFence: number; upperFence: number; outliers: number[] } {
  if (xs.length === 0) {
    return { lowerFence: NaN, upperFence: NaN, outliers: [] }
  }

  const q1 = quantile(xs, 0.25)
  const q3 = quantile(xs, 0.75)
  const iqrVal = q3 - q1
  const lowerFence = q1 - 1.5 * iqrVal
  const upperFence = q3 + 1.5 * iqrVal
  const outliers = xs.filter((x) => x < lowerFence || x > upperFence)

  return { lowerFence, upperFence, outliers }
}

/** Computes population Fisher-Pearson skewness g1 = m3 / m2^1.5. */
export function skewness(xs: number[]): number {
  const n = xs.length
  if (n < 3) return NaN

  const m = mean(xs)
  let m2 = 0
  let m3 = 0

  for (let i = 0; i < n; i++) {
    const d = xs[i] - m
    const d2 = d * d
    m2 += d2
    m3 += d2 * d
  }

  m2 /= n
  m3 /= n

  if (m2 === 0) return 0
  return m3 / Math.pow(m2, 1.5)
}

/** Computes population excess kurtosis g2 = m4 / m2^2 - 3. */
export function kurtosisExcess(xs: number[]): number {
  const n = xs.length
  if (n < 4) return NaN

  const m = mean(xs)
  let m2 = 0
  let m4 = 0

  for (let i = 0; i < n; i++) {
    const d = xs[i] - m
    const d2 = d * d
    m2 += d2
    m4 += d2 * d2
  }

  m2 /= n
  m4 /= n

  if (m2 === 0) return NaN
  return m4 / (m2 * m2) - 3
}

/** Computes standard z-scores for each data point. */
export function zScores(xs: number[], opts?: { population?: boolean }): number[] {
  if (xs.length === 0) return []
  const m = mean(xs)
  const s = stdev(xs, opts)
  if (isNaN(s) || s === 0) {
    return xs.map(() => NaN)
  }
  return xs.map((x) => (x - m) / s)
}

/** Computes covariance between xs and ys (sample default, or population if specified). */
export function covariance(xs: number[], ys: number[], opts?: { population?: boolean }): number {
  const n = xs.length
  if (n !== ys.length) return NaN
  const isPop = opts?.population ?? false
  if (isPop) {
    if (n < 1) return NaN
  } else {
    if (n < 2) return NaN
  }

  const mx = mean(xs)
  const my = mean(ys)
  let sumProd = 0

  for (let i = 0; i < n; i++) {
    sumProd += (xs[i] - mx) * (ys[i] - my)
  }

  return sumProd / (isPop ? n : n - 1)
}

/** Computes Pearson correlation coefficient r between xs and ys. */
export function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n !== ys.length || n < 2) return NaN

  const mx = mean(xs)
  const my = mean(ys)
  let sumProd = 0
  let sumSqX = 0
  let sumSqY = 0

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sumProd += dx * dy
    sumSqX += dx * dx
    sumSqY += dy * dy
  }

  const denom = Math.sqrt(sumSqX * sumSqY)
  if (denom === 0) return NaN
  return sumProd / denom
}

/** Summarizes full descriptive statistics of a dataset. */
export function summarize(xs: number[]): {
  n: number
  mean: number
  median: number
  sd: number
  min: number
  max: number
  q1: number
  q3: number
  iqr: number
  skewness: number
  kurtosisExcess: number
} {
  const n = xs.length
  if (n === 0) {
    return {
      n: 0,
      mean: NaN,
      median: NaN,
      sd: NaN,
      min: NaN,
      max: NaN,
      q1: NaN,
      q3: NaN,
      iqr: NaN,
      skewness: NaN,
      kurtosisExcess: NaN
    }
  }

  let min = xs[0]
  let max = xs[0]
  for (let i = 1; i < n; i++) {
    if (xs[i] < min) min = xs[i]
    if (xs[i] > max) max = xs[i]
  }

  const q1Val = quantile(xs, 0.25)
  const q3Val = quantile(xs, 0.75)

  return {
    n,
    mean: mean(xs),
    median: median(xs),
    sd: stdev(xs),
    min,
    max,
    q1: q1Val,
    q3: q3Val,
    iqr: q3Val - q1Val,
    skewness: skewness(xs),
    kurtosisExcess: kurtosisExcess(xs)
  }
}
