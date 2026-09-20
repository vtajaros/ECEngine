import { describe, it, expect } from 'vitest'
import { chiSquareIndependence, twoProportionZ } from './contingency'

describe('contingency module', () => {
  describe('chiSquareIndependence', () => {
    it('computes 2x2 table [[10, 20], [20, 10]]', () => {
      const table = [
        [10, 20],
        [20, 10]
      ]
      const res = chiSquareIndependence(table)

      expect(res.chi2).toBeCloseTo(6.6667, 3)
      expect(res.df).toBe(1)
      expect(res.pValue).toBeCloseTo(0.0098, 3)
      expect(res.cramersV).toBeCloseTo(0.3333, 3)
      expect(res.total).toBe(60)
      expect(res.expected).toEqual([
        [15, 15],
        [15, 15]
      ])
    })

    it('returns NaN fields for a table with a zero row', () => {
      const table = [
        [0, 0],
        [10, 20]
      ]
      const res = chiSquareIndependence(table)

      expect(Number.isNaN(res.chi2)).toBe(true)
      expect(Number.isNaN(res.df)).toBe(true)
      expect(Number.isNaN(res.pValue)).toBe(true)
      expect(Number.isNaN(res.cramersV)).toBe(true)
    })

    it('returns NaN fields for tables smaller than 2x2', () => {
      const res1x2 = chiSquareIndependence([[10, 20]])
      expect(Number.isNaN(res1x2.chi2)).toBe(true)

      const res2x1 = chiSquareIndependence([[10], [20]])
      expect(Number.isNaN(res2x1.chi2)).toBe(true)
    })
  })

  describe('twoProportionZ', () => {
    it('computes twoProportionZ(45, 100, 30, 100)', () => {
      const res = twoProportionZ(45, 100, 30, 100)

      expect(res.p1).toBe(0.45)
      expect(res.p2).toBe(0.3)
      expect(res.pooled).toBe(0.375)
      expect(res.z).toBeCloseTo(2.1909, 3)
      expect(res.pValue).toBeCloseTo(0.0285, 3)
    })

    it('returns NaN fields for invalid inputs', () => {
      const resNeg = twoProportionZ(-1, 100, 30, 100)
      expect(Number.isNaN(resNeg.z)).toBe(true)
      expect(Number.isNaN(resNeg.pValue)).toBe(true)

      const resXGTN = twoProportionZ(105, 100, 30, 100)
      expect(Number.isNaN(resXGTN.z)).toBe(true)
    })
  })
})
