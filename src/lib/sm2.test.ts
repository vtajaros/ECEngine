// src/lib/sm2.test.ts
// All expected values are derived directly from the calculateSM2 formula.
// No magic numbers — each expectation is annotated with the calculation.

import { describe, it, expect } from 'vitest'
import { calculateSM2 } from './sm2'

// ─── Baseline constants ───────────────────────────────────────────────────────
const DEFAULT_EF = 2.5 // standard SM-2 starting ease factor

// ─── Interval progression (happy path) ───────────────────────────────────────

describe('calculateSM2 — interval progression', () => {
  it('rep 0 + passing grade → interval 1', () => {
    const result = calculateSM2(4, 0, 1, DEFAULT_EF)
    // reps===0 branch: interval = 1 regardless of EF
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
  })

  it('rep 1 + passing grade → interval 6', () => {
    const result = calculateSM2(4, 1, 1, DEFAULT_EF)
    // reps===1 branch: interval = 6 regardless of EF
    expect(result.interval).toBe(6)
    expect(result.repetitions).toBe(2)
  })

  it('rep 2 + q=4 (Easy bonus applied) → interval = round(6 * 2.5) = 15, EF = 2.65', () => {
    // q=4: EF delta = 0.1 - 1*(0.08 + 1*0.02) = 0.1 - 0.10 = 0.00
    // interval computed using EF before bonus: round(6 * 2.5) = 15
    // Easy bonus applied after interval: EF = 2.5 + 0.15 = 2.65
    const result = calculateSM2(4, 2, 6, DEFAULT_EF)
    expect(result.interval).toBe(15)
    expect(result.repetitions).toBe(3)
    expect(result.easeFactor).toBeCloseTo(2.65, 5)
  })

  it('rep 2 + q=5 (EF increases) → interval = round(6 * 2.6) = 16', () => {
    // q=5: EF delta = 0.1 - 0*(0.08 + 0*0.02) = 0.1 - 0 = +0.10
    // new EF = 2.5 + 0.10 = 2.6
    // interval = round(6 * 2.6) = 15.6 → 16
    const result = calculateSM2(5, 2, 6, DEFAULT_EF)
    expect(result.interval).toBe(16)
    expect(result.easeFactor).toBeCloseTo(2.6, 5)
  })

  it('rep 2 + q=3 (EF decreases) → interval = round(6 * 2.36) = 14', () => {
    // q=3: EF delta = 0.1 - 2*(0.08 + 2*0.02) = 0.1 - 2*(0.12) = 0.1 - 0.24 = -0.14
    // new EF = 2.5 - 0.14 = 2.36
    // interval = round(6 * 2.36) = round(14.16) = 14
    const result = calculateSM2(3, 2, 6, DEFAULT_EF)
    expect(result.interval).toBe(14)
    expect(result.easeFactor).toBeCloseTo(2.36, 5)
  })

  it('compounds correctly over three passing reps', () => {
    // Simulate rep 0 → 1 → 2 → 3 at q=4 each time
    // r0: reps=0 → interval=1, EF=2.5+0.15=2.65
    // r1: reps=1 → interval=6, EF=2.65+0.15=2.80
    // r2: reps=2 → interval=round(6 * 2.80)=17, EF=2.80+0.15=2.95
    const r0 = calculateSM2(4, 0, 1, DEFAULT_EF)
    const r1 = calculateSM2(4, r0.repetitions, r0.interval, r0.easeFactor)
    const r2 = calculateSM2(4, r1.repetitions, r1.interval, r1.easeFactor)
    expect(r0.interval).toBe(1)
    expect(r1.interval).toBe(6)
    expect(r2.interval).toBe(17)
    expect(r2.repetitions).toBe(3)
  })
})

// ─── Failure / reset behaviour ────────────────────────────────────────────────

describe('calculateSM2 — failure resets (quality < 3)', () => {
  it('q=2 (Hard) preserves repetitions and reduces interval by 20%', () => {
    // Card was at rep 5, interval 30 — Hard reduces interval, does NOT reset
    // interval = max(1, round(30 * 0.8)) = max(1, 24) = 24
    const result = calculateSM2(2, 5, 30, DEFAULT_EF)
    expect(result.repetitions).toBe(5)
    expect(result.interval).toBe(24)
  })

  it('q=1 resets repetitions to 0 and interval to 1', () => {
    const result = calculateSM2(1, 3, 15, DEFAULT_EF)
    expect(result.repetitions).toBe(0)
    expect(result.interval).toBe(1)
  })

  it('q=1 (Again) resets repetitions to 0 and interval to 1', () => {
    // quality=1 is the only full-lapse rating; q=0 is out of range
    const result = calculateSM2(1, 2, 6, DEFAULT_EF)
    expect(result.repetitions).toBe(0)
    expect(result.interval).toBe(1)
  })

  it('q=2 (Hard) decreases easeFactor and reduces interval by 20%', () => {
    // q=2: EF delta = 0.1 - 3*(0.08 + 3*0.02) = 0.1 - 3*(0.14) = 0.1 - 0.42 = -0.32
    // new EF = 2.5 - 0.32 = 2.18
    // Hard — repetitions preserved (3), interval = max(1, round(15 * 0.8)) = 12
    const result = calculateSM2(2, 3, 15, DEFAULT_EF)
    expect(result.easeFactor).toBeCloseTo(2.18, 5)
    expect(result.repetitions).toBe(3)
    expect(result.interval).toBe(12)
  })

  it('q=0 still decreases easeFactor even on failure', () => {
    // q=0: EF delta = 0.1 - 5*(0.08 + 5*0.02) = 0.1 - 5*(0.18) = 0.1 - 0.90 = -0.80
    // new EF = 2.5 - 0.80 = 1.70
    const result = calculateSM2(0, 3, 15, DEFAULT_EF)
    expect(result.easeFactor).toBeCloseTo(1.70, 5)
  })
})

// ─── EaseFactor floor (1.3 clamp) ────────────────────────────────────────────

describe('calculateSM2 — easeFactor floor at 1.3', () => {
  it('does not drop below 1.3 on repeated failures', () => {
    // After many failures, EF should clamp at 1.3, not go negative
    let ef = DEFAULT_EF
    let reps = 0
    let interval = 1
    for (let i = 0; i < 20; i++) {
      const result = calculateSM2(0, reps, interval, ef)
      ef = result.easeFactor
      reps = result.repetitions
      interval = result.interval
    }
    expect(ef).toBeCloseTo(1.3, 5)
    expect(ef).toBeGreaterThanOrEqual(1.3)
  })

  it('clamps at exactly 1.3 when formula would go below', () => {
    // Start with EF at 1.35 — one q=0 hit would push it to 0.55, must clamp
    const result = calculateSM2(0, 1, 6, 1.35)
    expect(result.easeFactor).toBeCloseTo(1.3, 5)
  })

  it('does not clamp when EF stays above 1.3', () => {
    // q=4 at EF=1.5 → formula delta=0, then Easy bonus +0.15 → final EF=1.65
    // 1.65 > 1.3 so no clamp fires
    const result = calculateSM2(4, 2, 6, 1.5)
    expect(result.easeFactor).toBeCloseTo(1.65, 5)
  })
})

// ─── Boundary: q=3 is the passing threshold ──────────────────────────────────

describe('calculateSM2 — q=3 boundary (lowest passing grade)', () => {
  it('q=3 increments repetitions (does not reset)', () => {
    const result = calculateSM2(3, 2, 6, DEFAULT_EF)
    expect(result.repetitions).toBe(3) // 2 + 1
  })

  it('q=2 (Hard) preserves repetitions (one below pass threshold)', () => {
    // Hard is no longer a lapse — repetitions are preserved, interval reduced by 20%
    // interval = max(1, round(6 * 0.8)) = max(1, 5) = 5
    const result = calculateSM2(2, 2, 6, DEFAULT_EF)
    expect(result.repetitions).toBe(2)
    expect(result.interval).toBe(5)
  })
})

// ─── Return shape ─────────────────────────────────────────────────────────────

describe('calculateSM2 — return shape', () => {
  it('always returns interval, repetitions, and easeFactor', () => {
    const result = calculateSM2(4, 0, 1, DEFAULT_EF)
    expect(result).toHaveProperty('interval')
    expect(result).toHaveProperty('repetitions')
    expect(result).toHaveProperty('easeFactor')
  })

  it('interval is always a positive integer', () => {
    const cases: [number, number, number, number][] = [
      [5, 0, 1, 2.5],
      [4, 1, 1, 2.5],
      [3, 2, 6, 2.5],
      [0, 5, 30, 2.5],
    ]
    for (const [q, reps, prev, ef] of cases) {
      const result = calculateSM2(q, reps, prev, ef)
      expect(result.interval).toBeGreaterThan(0)
      expect(Number.isInteger(result.interval)).toBe(true)
    }
  })

  it('repetitions is always a non-negative integer', () => {
    const cases: [number, number, number, number][] = [
      [5, 0, 1, 2.5],
      [0, 5, 30, 2.5],
    ]
    for (const [q, reps, prev, ef] of cases) {
      const result = calculateSM2(q, reps, prev, ef)
      expect(result.repetitions).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(result.repetitions)).toBe(true)
    }
  })
})