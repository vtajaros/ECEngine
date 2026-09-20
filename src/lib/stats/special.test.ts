import { describe, it, expect } from 'vitest'
import { lnGamma, regGammaP, regBetaI, erf, invertMonotone } from './special'

describe('special functions', () => {
  describe('lnGamma', () => {
    it('computes lnGamma(5) ≈ ln(24) to 8 digits', () => {
      expect(lnGamma(5)).toBeCloseTo(Math.log(24), 8)
    })

    it('computes lnGamma(0.5) ≈ 0.5*ln(pi) to 8 digits', () => {
      expect(lnGamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 8)
    })

    it('returns NaN for non-positive or NaN inputs', () => {
      expect(Number.isNaN(lnGamma(0))).toBe(true)
      expect(Number.isNaN(lnGamma(-1))).toBe(true)
      expect(Number.isNaN(lnGamma(-0.5))).toBe(true)
      expect(Number.isNaN(lnGamma(NaN))).toBe(true)
    })
  })

  describe('regGammaP', () => {
    it('computes regGammaP(1, 2) ≈ 1 - exp(-2) to 10 digits', () => {
      expect(regGammaP(1, 2)).toBeCloseTo(1 - Math.exp(-2), 10)
    })

    it('handles boundary and edge conditions', () => {
      expect(regGammaP(1, 0)).toBe(0)
      expect(regGammaP(2, Infinity)).toBe(1)
      expect(Number.isNaN(regGammaP(-1, 2))).toBe(true)
      expect(Number.isNaN(regGammaP(1, -2))).toBe(true)
    })
  })

  describe('regBetaI', () => {
    it('computes regBetaI(0.3, 1, 1) ≈ 0.3 to 10 digits', () => {
      expect(regBetaI(0.3, 1, 1)).toBeCloseTo(0.3, 10)
    })

    it('computes regBetaI(0.5, 2, 2) ≈ 0.5 to 10 digits', () => {
      expect(regBetaI(0.5, 2, 2)).toBeCloseTo(0.5, 10)
    })

    it('handles boundary and invalid values', () => {
      expect(regBetaI(0, 2, 3)).toBe(0)
      expect(regBetaI(1, 2, 3)).toBe(1)
      expect(Number.isNaN(regBetaI(-0.1, 2, 3))).toBe(true)
      expect(Number.isNaN(regBetaI(1.1, 2, 3))).toBe(true)
      expect(Number.isNaN(regBetaI(0.5, -1, 3))).toBe(true)
      expect(Number.isNaN(regBetaI(0.5, 2, 0))).toBe(true)
    })
  })

  describe('erf', () => {
    it('computes erf(0) = 0 and erf(1) ≈ 0.8427007929 to 8 digits', () => {
      expect(erf(0)).toBe(0)
      expect(erf(1)).toBeCloseTo(0.8427007929, 8)
      expect(erf(-1)).toBeCloseTo(-0.8427007929, 8)
    })

    it('handles infinities and NaN', () => {
      expect(erf(Infinity)).toBe(1)
      expect(erf(-Infinity)).toBe(-1)
      expect(Number.isNaN(erf(NaN))).toBe(true)
    })
  })

  describe('invertMonotone', () => {
    it('inverts a simple monotonic function with automatic bracket expansion', () => {
      // f(x) = 1 / (1 + exp(-x)), standard logistic sigmoid
      const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
      // Invert for p = 0.8 => x = ln(0.8 / 0.2) = ln(4) ≈ 1.3862943611
      const root = invertMonotone(sigmoid, 0.8, -5, -4) // brackets start strictly below root to test expansion
      expect(root).toBeCloseTo(Math.log(4), 10)
    })

    it('returns NaN for invalid target probabilities', () => {
      const fn = (x: number) => x
      expect(Number.isNaN(invertMonotone(fn, 0, 0, 1))).toBe(true)
      expect(Number.isNaN(invertMonotone(fn, 1, 0, 1))).toBe(true)
      expect(Number.isNaN(invertMonotone(fn, -0.2, 0, 1))).toBe(true)
      expect(Number.isNaN(invertMonotone(fn, 1.2, 0, 1))).toBe(true)
      expect(Number.isNaN(invertMonotone(fn, NaN, 0, 1))).toBe(true)
    })
  })
})
