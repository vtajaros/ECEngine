// src/lib/sm2.test.ts
import { describe, it, expect } from 'vitest'
import { calculateSM2 } from './sm2'

describe('calculateSM2', () => {

  // ── Ease factor floor ──────────────────────────────────────────────
  it('never lets easeFactor drop below 1.3', () => {
    // Repeated failures should clamp, not go negative
    let ef = 2.5
    for (let i = 0; i < 10; i++) {
      const result = calculateSM2(0, i, 1, ef)
      ef = result.easeFactor
    }
    expect(ef).toBeGreaterThanOrEqual(1.3)
  })

  // ── Failed card resets ─────────────────────────────────────────────
  it('resets repetitions to 0 on quality < 3', () => {
    const result = calculateSM2(2, 5, 20, 2.5)
    expect(result.repetitions).toBe(0)
    expect(result.interval).toBe(1)
  })

  it('resets repetitions to 0 on quality = 0', () => {
    const result = calculateSM2(0, 3, 10, 2.5)
    expect(result.repetitions).toBe(0)
    expect(result.interval).toBe(1)
  })

  // ── First-time correct card intervals ──────────────────────────────
  it('gives interval of 1 day on first correct answer (rep 0)', () => {
    const result = calculateSM2(4, 0, 1, 2.5)
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
  })

  it('gives interval of 6 days on second correct answer (rep 1)', () => {
    const result = calculateSM2(4, 1, 1, 2.5)
    expect(result.interval).toBe(6)
    expect(result.repetitions).toBe(2)
  })

  // ── Subsequent interval scaling ────────────────────────────────────
  it('scales interval by easeFactor on rep >= 2', () => {
    const ef = 2.5
    const prevInterval = 6
    const result = calculateSM2(4, 2, prevInterval, ef)
    expect(result.interval).toBe(Math.round(prevInterval * ef))
    expect(result.repetitions).toBe(3)
  })

  // ── Ease factor adjustments ────────────────────────────────────────
  it('increases easeFactor on quality 5 (perfect answer)', () => {
    const result = calculateSM2(5, 2, 6, 2.5)
    expect(result.easeFactor).toBeGreaterThan(2.5)
  })

  it('decreases easeFactor on quality 3 (barely correct)', () => {
    const result = calculateSM2(3, 2, 6, 2.5)
    expect(result.easeFactor).toBeLessThan(2.5)
  })

  // ── Boundary: quality = 3 is still a pass ─────────────────────────
  it('treats quality 3 as a pass — does not reset repetitions', () => {
    const result = calculateSM2(3, 4, 15, 2.5)
    expect(result.repetitions).toBe(5)
  })

  // ── Boundary: quality = 2 is still a fail ─────────────────────────
  it('treats quality 2 as a fail — resets repetitions', () => {
    const result = calculateSM2(2, 4, 15, 2.5)
    expect(result.repetitions).toBe(0)
  })

})