import { describe, it, expect } from 'vitest'
import { oneWayAnova, kruskalWallis, welchT } from './anova'

describe('anova module', () => {
  describe('oneWayAnova', () => {
    it('computes one-way ANOVA for three groups [[1,2,3],[2,3,4],[5,6,7]]', () => {
      const groups = [
        [1, 2, 3],
        [2, 3, 4],
        [5, 6, 7]
      ]
      const res = oneWayAnova(groups)

      expect(res.k).toBe(3)
      expect(res.N).toBe(9)
      expect(res.ssb).toBeCloseTo(26, 10)
      expect(res.ssw).toBeCloseTo(6, 10)
      expect(res.sst).toBeCloseTo(32, 10)
      expect(res.dfB).toBe(2)
      expect(res.dfW).toBe(6)
      expect(res.msb).toBeCloseTo(13, 10)
      expect(res.msw).toBeCloseTo(1, 10)
      expect(res.F).toBeCloseTo(13, 10)
      expect(res.pValue).toBeCloseTo(0.0066, 3)
      expect(res.etaSquared).toBeCloseTo(0.8125, 10)
    })

    it('returns F = 0 and pValue = 1 for two identical groups', () => {
      const groups = [
        [1, 2, 3],
        [1, 2, 3]
      ]
      const res = oneWayAnova(groups)

      expect(res.F).toBe(0)
      expect(res.pValue).toBe(1)
    })

    it('returns NaN fields when k = 1 or N <= k', () => {
      const resK1 = oneWayAnova([[1, 2, 3]])
      expect(Number.isNaN(resK1.F)).toBe(true)
      expect(Number.isNaN(resK1.pValue)).toBe(true)

      const resEmpty = oneWayAnova([[], [1, 2, 3]])
      expect(Number.isNaN(resEmpty.F)).toBe(true)
    })
  })

  describe('kruskalWallis', () => {
    it('computes Kruskal-Wallis for [[1,2,3],[2,3,4],[5,6,7]]', () => {
      const groups = [
        [1, 2, 3],
        [2, 3, 4],
        [5, 6, 7]
      ]
      const res = kruskalWallis(groups)

      expect(res.H).toBeCloseTo(6.0565, 3)
      expect(res.df).toBe(2)
      expect(res.pValue).toBeCloseTo(0.0484, 3)
      expect(res.epsilonSquared).toBeCloseTo((6.0565 - 3 + 1) / (9 - 3), 3)
    })

    it('returns NaN fields when k < 2 or N <= k', () => {
      const resK1 = kruskalWallis([[1, 2, 3]])
      expect(Number.isNaN(resK1.H)).toBe(true)
      expect(Number.isNaN(resK1.pValue)).toBe(true)
    })
  })

  describe('welchT', () => {
    it('computes Welch t-test for [1,2,3] and [5,6,7]', () => {
      const a = [1, 2, 3]
      const b = [5, 6, 7]
      const res = welchT(a, b)

      expect(res.t).toBeCloseTo(-4.899, 3)
      expect(res.df).toBeCloseTo(4, 10)
      expect(res.pValue).toBeGreaterThan(0.007)
      expect(res.pValue).toBeLessThan(0.009)
      expect(res.meanDiff).toBe(-4)
    })

    it('returns NaN fields when n < 2', () => {
      const res = welchT([1], [2, 3])
      expect(Number.isNaN(res.t)).toBe(true)
      expect(Number.isNaN(res.df)).toBe(true)
      expect(Number.isNaN(res.pValue)).toBe(true)
    })
  })
})
