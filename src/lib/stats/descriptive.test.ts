import { describe, it, expect } from 'vitest'
import {
  mean,
  median,
  modes,
  variance,
  stdev,
  quantile,
  iqr,
  tukeyOutliers,
  skewness,
  kurtosisExcess,
  zScores,
  covariance,
  pearsonR,
  summarize
} from './descriptive'

describe('descriptive statistics', () => {
  it('computes mean and median correctly', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([1, 2, 3, 4, 5])).toBe(3)
  })

  it('computes Type 7 quantile and IQR correctly', () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75)
    expect(quantile([1, 2, 3, 4], 0.75)).toBe(3.25)
    expect(iqr([1, 2, 3, 4])).toBe(1.5)
  })

  it('computes modes correctly, returning [] if all values are unique', () => {
    expect(modes([1, 2, 2, 3, 3])).toEqual([2, 3])
    expect(modes([1, 2, 3])).toEqual([])
  })

  it('computes sample and population variance and stdev', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9]
    expect(variance(data, { population: true })).toBe(4)
    expect(variance(data)).toBeCloseTo(32 / 7, 10)
    expect(stdev(data, { population: true })).toBe(2)
  })

  it('computes z-scores with population stdev', () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9]
    const z = zScores(data, { population: true })
    // mean=5, sigma=2 => for 9: (9-5)/2 = 2; for 2: (2-5)/2 = -1.5
    expect(z[7]).toBe(2)
    expect(z[0]).toBe(-1.5)
  })

  it('identifies Tukey outliers with 1.5 * IQR', () => {
    const res = tukeyOutliers([1, 2, 3, 4, 5, 100])
    expect(res.lowerFence).toBe(-1.5)
    expect(res.upperFence).toBe(8.5)
    expect(res.outliers).toEqual([100])
  })

  it('computes skewness and kurtosisExcess', () => {
    expect(skewness([1, 2, 3, 4, 5])).toBeCloseTo(0, 10)
    expect(kurtosisExcess([1, 2, 3, 4, 5])).toBeCloseTo(-1.3, 10)

    const skewed = [1, 2, 2, 3, 10]
    expect(skewness(skewed)).toBeGreaterThan(0)
    expect(mean(skewed)).toBeGreaterThan(median(skewed))
  })

  it('demonstrates robustness of IQR vs mean against extreme outliers', () => {
    const base = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    const contaminated = [...base, 500, 1000]

    const meanShift = Math.abs(mean(contaminated) - mean(base))
    const iqrShift = Math.abs(iqr(contaminated) - iqr(base))

    expect(meanShift).toBeGreaterThan(20)
    expect(iqrShift).toBeLessThan(2)
    expect(meanShift).toBeGreaterThan(10 * iqrShift)
  })

  it('satisfies linear variance transformation Var(aX + b) = a^2 Var(X) (review Q9)', () => {
    const xs = [3, 7, 1, 9, 4]
    const transformed = xs.map((x) => -2 * x + 10)
    expect(variance(transformed)).toBeCloseTo(4 * variance(xs), 10)
  })

  it('computes covariance and Pearson R (review Q10)', () => {
    const X = [10, 12, 14, 16]
    const Y = [30, 34, 38, 42]
    expect(covariance(X, Y)).toBeCloseTo(40 / 3, 10)
    expect(covariance(X, Y, { population: true })).toBeCloseTo(10, 10)
    expect(pearsonR(X, Y)).toBeCloseTo(1, 10)

    const Yneg = [42, 38, 34, 30]
    expect(pearsonR(X, Yneg)).toBeCloseTo(-1, 10)
  })

  it('handles empty or small datasets safely without throwing', () => {
    expect(Number.isNaN(mean([]))).toBe(true)
    expect(Number.isNaN(variance([1]))).toBe(true)
    expect(Number.isNaN(covariance([1], [2]))).toBe(true)
    expect(Number.isNaN(pearsonR([1], [2]))).toBe(true)
    expect(Number.isNaN(skewness([1, 2]))).toBe(true)
    expect(Number.isNaN(kurtosisExcess([1, 2, 3]))).toBe(true)

    const summary = summarize([])
    expect(summary.n).toBe(0)
    expect(Number.isNaN(summary.mean)).toBe(true)
  })

  it('summarizes dataset accurately', () => {
    const s = summarize([1, 2, 3, 4, 5])
    expect(s.n).toBe(5)
    expect(s.mean).toBe(3)
    expect(s.median).toBe(3)
    expect(s.min).toBe(1)
    expect(s.max).toBe(5)
    expect(s.q1).toBe(2)
    expect(s.q3).toBe(4)
    expect(s.iqr).toBe(2)
  })
})
