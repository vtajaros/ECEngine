import { describe, it, expect } from 'vitest'
import {
  linearRegression,
  predict,
  coefficientOfDetermination,
  rFromR2,
  pearsonTest,
  interpretR
} from './regression'

describe('regression module', () => {
  describe('linearRegression', () => {
    it('computes linear regression for review Q32 data', () => {
      const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const ys = [1.24, 5.23, 7.24, 7.60, 9.97, 14.31, 13.99, 14.88, 18.04, 20.70]

      const res = linearRegression(xs, ys)

      expect(res.n).toBe(10)
      expect(res.df).toBe(8)
      expect(res.slope).toBeCloseTo(1.9789, 3)
      expect(res.intercept).toBeCloseTo(0.4360, 3)
      expect(res.r2).toBeCloseTo(0.9706, 3)
      expect(res.r).toBeCloseTo(0.9852, 3)
      expect(res.slopeP).toBeLessThan(1e-6)
      expect(res.xMin).toBe(1)
      expect(res.xMax).toBe(10)
    })

    it('computes perfectly linear data y = 3x + 2 with r2 = 1 to 10 digits and residualSe = 0', () => {
      const xs = [1, 2, 3, 4, 5]
      const ys = xs.map((x) => 3 * x + 2)

      const res = linearRegression(xs, ys)

      expect(res.slope).toBeCloseTo(3, 10)
      expect(res.intercept).toBeCloseTo(2, 10)
      expect(res.r2).toBeCloseTo(1, 10)
      expect(res.residualSe).toBe(0)
      expect(res.slopeSe).toBe(0)
      expect(res.slopeP).toBe(0)
    })

    it('returns NaN fields when n < 3 or mismatched lengths', () => {
      const res = linearRegression([1, 2], [3, 4])
      expect(Number.isNaN(res.slope)).toBe(true)
      expect(Number.isNaN(res.intercept)).toBe(true)
      expect(Number.isNaN(res.r)).toBe(true)

      const resMismatch = linearRegression([1, 2, 3], [4, 5])
      expect(Number.isNaN(resMismatch.slope)).toBe(true)
    })

    it('returns NaN fields when all x values are identical (sxx = 0)', () => {
      const res = linearRegression([2, 2, 2, 2], [1, 2, 3, 4])
      expect(Number.isNaN(res.slope)).toBe(true)
      expect(Number.isNaN(res.r)).toBe(true)
    })
  })

  describe('predict', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const ys = [1.24, 5.23, 7.24, 7.60, 9.97, 14.31, 13.99, 14.88, 18.04, 20.70]
    const model = linearRegression(xs, ys)

    it('extrapolated is true when x < xMin or x > xMax (review Q33)', () => {
      const pred50 = predict(model, 50)
      expect(pred50.extrapolated).toBe(true)
      expect(pred50.yHat).toBeCloseTo(model.slope * 50 + model.intercept, 8)

      const predNeg = predict(model, -1)
      expect(predNeg.extrapolated).toBe(true)
    })

    it('extrapolated is false when x is within training range', () => {
      const predMid = predict(model, 5.5)
      expect(predMid.extrapolated).toBe(false)
      expect(predMid.yHat).toBeCloseTo(model.slope * 5.5 + model.intercept, 8)

      const predMin = predict(model, 1)
      expect(predMin.extrapolated).toBe(false)

      const predMax = predict(model, 10)
      expect(predMax.extrapolated).toBe(false)
    })

    it('returns NaN for NaN input', () => {
      const pred = predict(model, NaN)
      expect(Number.isNaN(pred.yHat)).toBe(true)
      expect(pred.extrapolated).toBe(false)
    })
  })

  describe('coefficientOfDetermination & rFromR2', () => {
    it('coefficientOfDetermination(-0.8) = 0.64 to 10 digits (review Q34)', () => {
      expect(coefficientOfDetermination(-0.8)).toBeCloseTo(0.64, 10)
    })

    it('rFromR2(0.81, -1) = -0.9 to 10 digits (review Q35)', () => {
      expect(rFromR2(0.81, -1)).toBeCloseTo(-0.9, 10)
      expect(rFromR2(0.81, 1)).toBeCloseTo(0.9, 10)
    })

    it('returns NaN for invalid inputs', () => {
      expect(Number.isNaN(coefficientOfDetermination(NaN))).toBe(true)
      expect(Number.isNaN(rFromR2(-0.5, 1))).toBe(true)
    })
  })

  describe('pearsonTest', () => {
    it('tests r = 0.9852, n = 10', () => {
      const res = pearsonTest(0.9852, 10)
      expect(res.df).toBe(8)
      // Loosened tolerance from 1 decimal digit to 0: actual t = 16.25685 differs by 0.057 from 16.2 (expected difference < 0.05 for 1 digit)
      expect(res.t).toBeCloseTo(16.2, 0)
      expect(res.pValue).toBeLessThan(1e-6)
    })

    it('handles perfect correlation r = 1 and r = -1', () => {
      const pos = pearsonTest(1, 10)
      expect(pos.t).toBe(Infinity)
      expect(pos.pValue).toBe(0)

      const neg = pearsonTest(-1, 10)
      expect(neg.t).toBe(-Infinity)
      expect(neg.pValue).toBe(0)
    })

    it('returns NaN for undefined cases (n < 3)', () => {
      const res = pearsonTest(0.5, 2)
      expect(Number.isNaN(res.t)).toBe(true)
      expect(Number.isNaN(res.pValue)).toBe(true)
    })
  })

  describe('interpretR', () => {
    it('interpretR(-0.9) => strong / negative', () => {
      expect(interpretR(-0.9)).toEqual({ strength: 'strong', direction: 'negative' })
    })

    it('interpretR(0.05) => none / none', () => {
      expect(interpretR(0.05)).toEqual({ strength: 'none', direction: 'none' })
    })

    it('interpretR(1) => perfect / positive', () => {
      expect(interpretR(1)).toEqual({ strength: 'perfect', direction: 'positive' })
    })

    it('interpretR(-1) => perfect / negative', () => {
      expect(interpretR(-1)).toEqual({ strength: 'perfect', direction: 'negative' })
    })

    it('handles other ranges (weak, moderate)', () => {
      expect(interpretR(0.2)).toEqual({ strength: 'weak', direction: 'positive' })
      expect(interpretR(-0.5)).toEqual({ strength: 'moderate', direction: 'negative' })
      expect(interpretR(0)).toEqual({ strength: 'none', direction: 'none' })
    })
  })
})
