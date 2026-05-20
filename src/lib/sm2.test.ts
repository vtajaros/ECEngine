import { describe, expect, it } from 'vitest'
import { calculateSM2 } from './sm2'

describe('calculateSM2', () => {
  it('increments repetition state and follows the SM-2 interval ladder for correct answers', () => {
    const firstReview = calculateSM2(5, 0, 0, 2.5)
    expect(firstReview.repetitions).toBe(1)
    expect(firstReview.interval).toBe(1)
    expect(firstReview.easeFactor).toBeCloseTo(2.6)

    const secondReview = calculateSM2(5, 1, 1, 2.5)
    expect(secondReview.repetitions).toBe(2)
    expect(secondReview.interval).toBe(6)
    expect(secondReview.easeFactor).toBeCloseTo(2.6)

    const laterReview = calculateSM2(5, 2, 6, 2.5)
    expect(laterReview.repetitions).toBe(3)
    expect(laterReview.easeFactor).toBeCloseTo(2.6)
    expect(laterReview.interval).toBe(Math.round(6 * 2.6))
  })

  it('resets repetition state and returns a one-day interval for incorrect answers', () => {
    const failedReview = calculateSM2(2, 4, 10, 2.5)

    expect(failedReview.repetitions).toBe(0)
    expect(failedReview.interval).toBe(1)
    expect(failedReview.easeFactor).toBeCloseTo(2.18)
  })

  it('never allows the ease factor to fall below the minimum floor', () => {
    const floored = calculateSM2(0, 3, 15, 1.31)

    expect(floored.easeFactor).toBe(1.3)
    expect(floored.repetitions).toBe(0)
    expect(floored.interval).toBe(1)
  })
})