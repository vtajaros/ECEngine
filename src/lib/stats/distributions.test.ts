import { describe, it, expect } from 'vitest'
import {
  normalPdf,
  normalCdf,
  normalSf,
  normalQuantile,
  tCdf,
  tQuantile,
  chi2Cdf,
  chi2Sf,
  chi2Quantile,
  fCdf,
  fSf,
  fQuantile,
  binomialPmf,
  binomialCdf,
  poissonPmf,
  poissonCdf,
  hypergeometricPmf,
  lnChoose
} from './distributions'

describe('distributions', () => {
  describe('normal distribution', () => {
    it('computes normalCdf accurately', () => {
      expect(normalCdf(0)).toBe(0.5)
      expect(normalCdf(1)).toBeCloseTo(0.8413447, 6)
      expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6)
      expect(normalCdf(-1.96)).toBeCloseTo(0.0249979, 6)
      expect(normalSf(1.96)).toBeCloseTo(0.0249979, 6)
    })

    it('computes normalQuantile accurately', () => {
      expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 4)
      expect(normalQuantile(0.995)).toBeCloseTo(2.575829, 4)
      expect(normalQuantile(0.95)).toBeCloseTo(1.644854, 4)
      expect(normalQuantile(0.5)).toBe(0)
    })

    it('round-trips normalQuantile(normalCdf(x)) to 8 digits', () => {
      for (const x of [-4, -1, 0.3, 2.5]) {
        expect(normalQuantile(normalCdf(x))).toBeCloseTo(x, 8)
      }
    })

    it('returns ±Infinity for extreme probabilities 0 and 1', () => {
      expect(normalQuantile(0)).toBe(-Infinity)
      expect(normalQuantile(1)).toBe(Infinity)
    })

    it('returns NaN on invalid inputs', () => {
      expect(Number.isNaN(normalPdf(0, 0, -1))).toBe(true)
      expect(Number.isNaN(normalCdf(0, 0, 0))).toBe(true)
      expect(Number.isNaN(normalQuantile(-0.01))).toBe(true)
      expect(Number.isNaN(normalQuantile(1.01))).toBe(true)
      expect(Number.isNaN(normalQuantile(0.5, 0, -1))).toBe(true)
    })
  })

  describe("Student's t distribution", () => {
    it('computes tQuantile accurately across degrees of freedom', () => {
      expect(tQuantile(0.975, 1)).toBeCloseTo(12.7062, 3)
      expect(tQuantile(0.975, 10)).toBeCloseTo(2.228139, 4)
      expect(tQuantile(0.975, 30)).toBeCloseTo(2.042272, 4)
      expect(tQuantile(0.975, 120)).toBeCloseTo(1.97993, 4)
    })

    it('satisfies CDF properties and round-tripping', () => {
      expect(tCdf(tQuantile(0.9, 7), 7)).toBeCloseTo(0.9, 8)
      expect(tCdf(0, 1)).toBe(0.5)
      expect(tCdf(0, 10)).toBe(0.5)
      expect(tCdf(0, 100)).toBe(0.5)
    })

    it('returns NaN for invalid df or p', () => {
      expect(Number.isNaN(tCdf(1, 0))).toBe(true)
      expect(Number.isNaN(tCdf(1, -5))).toBe(true)
      expect(Number.isNaN(tQuantile(0, 5))).toBe(true)
      expect(Number.isNaN(tQuantile(1, 5))).toBe(true)
      expect(Number.isNaN(tQuantile(0.5, -2))).toBe(true)
    })
  })

  describe('chi-square distribution', () => {
    it('computes chi2Quantile accurately across degrees of freedom', () => {
      expect(chi2Quantile(0.95, 1)).toBeCloseTo(3.841459, 4)
      expect(chi2Quantile(0.95, 2)).toBeCloseTo(5.991465, 4)
      expect(chi2Quantile(0.95, 3)).toBeCloseTo(7.814728, 4)
      expect(chi2Quantile(0.99, 4)).toBeCloseTo(13.2767, 3)
    })

    it('computes survival function chi2Sf', () => {
      expect(chi2Sf(3.841459, 1)).toBeCloseTo(0.05, 5)
    })

    it('returns NaN for invalid inputs', () => {
      expect(Number.isNaN(chi2Cdf(1, 0))).toBe(true)
      expect(Number.isNaN(chi2Quantile(-0.1, 2))).toBe(true)
      expect(Number.isNaN(chi2Quantile(1, 2))).toBe(true)
      expect(Number.isNaN(chi2Quantile(0.5, -1))).toBe(true)
    })
  })

  describe('F-distribution', () => {
    it('computes fQuantile accurately', () => {
      expect(fQuantile(0.95, 1, 10)).toBeCloseTo(4.964603, 4)
      expect(fQuantile(0.95, 3, 20)).toBeCloseTo(3.098391, 4)
      expect(fQuantile(0.95, 2, 27)).toBeCloseTo(3.354131, 4)
    })

    it('computes survival function fSf', () => {
      expect(fSf(4.964603, 1, 10)).toBeCloseTo(0.05, 5)
    })

    it('returns NaN for invalid inputs', () => {
      expect(Number.isNaN(fCdf(1, -1, 10))).toBe(true)
      expect(Number.isNaN(fCdf(1, 1, 0))).toBe(true)
      expect(Number.isNaN(fQuantile(0, 1, 10))).toBe(true)
      expect(Number.isNaN(fQuantile(1, 1, 10))).toBe(true)
      expect(Number.isNaN(fQuantile(0.5, -1, 10))).toBe(true)
    })
  })

  describe('discrete distributions & combinatorics', () => {
    it('computes binomial PMF and CDF', () => {
      expect(binomialPmf(2, 5, 0.5)).toBe(0.3125)
      expect(binomialCdf(2, 5, 0.5)).toBe(0.5)

      // Out of support inputs return 0
      expect(binomialPmf(-1, 5, 0.5)).toBe(0)
      expect(binomialPmf(6, 5, 0.5)).toBe(0)

      // Binomial PMF sum to 1
      let sumB = 0
      for (let k = 0; k <= 12; k++) {
        sumB += binomialPmf(k, 12, 0.3)
      }
      expect(sumB).toBeCloseTo(1, 10)
    })

    it('computes Poisson PMF and CDF', () => {
      expect(poissonPmf(3, 2)).toBeCloseTo(0.180447, 6)
      expect(poissonCdf(2, 2)).toBeCloseTo(0.6766764, 6)
      expect(poissonPmf(-1, 2)).toBe(0)
    })

    it('computes hypergeometric PMF', () => {
      // 20 chips, 4 defective, draw 5, get 2 defectives
      expect(hypergeometricPmf(2, 20, 4, 5)).toBeCloseTo(0.2167183, 6)

      let sumH = 0
      for (let k = 0; k <= 4; k++) {
        sumH += hypergeometricPmf(k, 20, 4, 5)
      }
      expect(sumH).toBeCloseTo(1, 10)
    })

    it('computes lnChoose', () => {
      expect(lnChoose(5, 2)).toBeCloseTo(Math.log(10), 10)
      expect(lnChoose(5, 0)).toBe(0)
      expect(lnChoose(5, 5)).toBe(0)
    })

    it('returns NaN for invalid discrete parameters', () => {
      expect(Number.isNaN(binomialPmf(1.5, 5, 0.5))).toBe(true)
      expect(Number.isNaN(binomialPmf(2, -5, 0.5))).toBe(true)
      expect(Number.isNaN(binomialPmf(2, 5, 1.5))).toBe(true)
      expect(Number.isNaN(binomialCdf(1.2, 5, 0.5))).toBe(true)
      expect(Number.isNaN(poissonPmf(1.5, 2))).toBe(true)
      expect(Number.isNaN(poissonPmf(1, -2))).toBe(true)
      expect(Number.isNaN(poissonCdf(1.5, 2))).toBe(true)
      expect(Number.isNaN(poissonCdf(1, -2))).toBe(true)
      expect(Number.isNaN(hypergeometricPmf(1.5, 20, 4, 5))).toBe(true)
      expect(Number.isNaN(hypergeometricPmf(2, -20, 4, 5))).toBe(true)
      expect(Number.isNaN(hypergeometricPmf(2, 20, 25, 5))).toBe(true)
      expect(Number.isNaN(lnChoose(5.5, 2))).toBe(true)
      expect(Number.isNaN(lnChoose(-5, 2))).toBe(true)
    })
  })
})
