import { describe, it, expect } from 'vitest'
import {
  standardErrorMean,
  standardErrorProportion,
  meanCI,
  proportionCI,
  zTestFromStatistic,
  oneSampleZ,
  oneSampleT,
  chiSquareGof,
  chebyshevMinProbability,
  chebyshevK,
  sampleSizeMultiplier
} from './inference'

describe('statistical inference', () => {
  describe('standard errors', () => {
    it('computes standard error of the mean (Q18, Q19)', () => {
      expect(standardErrorMean(3, 36)).toBe(0.5)
      expect(standardErrorMean(10, 400)).toBe(0.5)
    })

    it('computes standard error of proportion (Q20)', () => {
      expect(standardErrorProportion(0.05, 400)).toBeCloseTo(0.0109, 4)
    })
  })

  describe('confidence intervals', () => {
    it('computes meanCI with sigmaKnown and zOverride (Q22)', () => {
      const resOverride = meanCI({
        mean: 230.4,
        sd: 15,
        n: 100,
        confidence: 0.99,
        sigmaKnown: true,
        zOverride: 2.58
      })
      expect(resOverride.kind).toBe('z')
      expect(resOverride.margin).toBeCloseTo(3.87, 2)

      const resAuto = meanCI({
        mean: 230.4,
        sd: 15,
        n: 100,
        confidence: 0.99,
        sigmaKnown: true
      })
      expect(resAuto.kind).toBe('z')
      expect(resAuto.margin).toBeCloseTo(3.8637, 3)
    })

    it('uses t-distribution when sigmaKnown is false and produces wider margin', () => {
      const resT = meanCI({
        mean: 50,
        sd: 10,
        n: 12,
        confidence: 0.95,
        sigmaKnown: false
      })
      const resZ = meanCI({
        mean: 50,
        sd: 10,
        n: 12,
        confidence: 0.95,
        sigmaKnown: true
      })

      expect(resT.kind).toBe('t')
      expect(resZ.kind).toBe('z')
      expect(resT.margin).toBeGreaterThan(resZ.margin)
    })

    it('computes proportionCI (Q23)', () => {
      const res = proportionCI(18, 360, 0.95)
      expect(res.pHat).toBe(0.05)
      expect(res.margin).toBeCloseTo(0.0225, 3)
    })
  })

  describe('hypothesis tests', () => {
    it('performs z-test from test statistic (Q27)', () => {
      const res1 = zTestFromStatistic(2.1, 'right', 0.05)
      expect(res1.reject).toBe(true)
      expect(res1.critical).toBeCloseTo(1.6449, 3)
      expect(res1.pValue).toBeCloseTo(0.0179, 3)

      const resTwo = zTestFromStatistic(1.96, 'two')
      expect(resTwo.pValue).toBeCloseTo(0.05, 3)

      const resFail = zTestFromStatistic(1.0, 'right')
      expect(resFail.reject).toBe(false)
    })

    it('performs one-sample z-test', () => {
      const res = oneSampleZ({
        sampleMean: 105,
        mu0: 100,
        sigma: 15,
        n: 36,
        tail: 'right'
      })
      // se = 15 / 6 = 2.5, z = 5 / 2.5 = 2.0
      expect(res.z).toBe(2)
      expect(res.reject).toBe(true)
    })

    it('performs one-sample t-test', () => {
      const res = oneSampleT({
        sampleMean: 5.5,
        mu0: 5,
        s: 1,
        n: 16,
        tail: 'right'
      })
      expect(res.t).toBe(2.0)
      expect(res.df).toBe(15)
      expect(res.pValue).toBeCloseTo(0.032, 3)
    })
  })

  describe('chi-square goodness of fit', () => {
    it('computes goodness-of-fit and Cramer W on board exam MCQ distributions', () => {
      const res = chiSquareGof([2588, 2830, 2689, 2507], [0.25, 0.25, 0.25, 0.25])
      expect(res.chi2).toBeCloseTo(21.92, 1)
      expect(res.df).toBe(3)
      expect(res.pValue).toBeLessThan(0.001)
      expect(res.cramersW).toBeCloseTo(0.0454, 3)
    })

    it('returns NaN fields if expected proportions do not sum to 1', () => {
      const res = chiSquareGof([10, 20], [0.4, 0.4])
      expect(Number.isNaN(res.chi2)).toBe(true)
      expect(Number.isNaN(res.df)).toBe(true)
      expect(Number.isNaN(res.pValue)).toBe(true)
      expect(Number.isNaN(res.cramersW)).toBe(true)
    })
  })

  describe("Chebyshev's inequality & sample size rules", () => {
    it("computes Chebyshev's minimum probability and k (Q17)", () => {
      expect(chebyshevMinProbability(3)).toBeCloseTo(0.8889, 4)
      expect(chebyshevK(6, 2)).toBe(3)
      expect(Number.isNaN(chebyshevMinProbability(1))).toBe(true)
      expect(Number.isNaN(chebyshevMinProbability(0.5))).toBe(true)
    })

    it('computes sample size multiplier (Q24)', () => {
      expect(sampleSizeMultiplier(12, 6)).toBe(4)
      expect(sampleSizeMultiplier(10, 5)).toBe(4)
      expect(sampleSizeMultiplier(6, 2)).toBe(9)
    })
  })
})
