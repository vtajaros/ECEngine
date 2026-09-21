import { describe, it, expect } from 'vitest'
import {
  extractFeatures, estimateParMs, difficultyWeight, cardRating,
  speedMultiplier, speedNorm, scoreAnswer,
  expectedScore, kFactor, performanceScore, applyAnswerToRating, overallRating,
  allocateCounts, pickNextIndex, isRatedRun, TUNING,
  ratingTier, paceForSubject, blendedPaceMs, paceSource, capacityItems, itemsPlanWarning, tightTimerWarning,
} from './gauntlet'

describe('par / weight', () => {
  it('extracts numeric-choice and image features', () => {
    expect(extractFeatures({ question: 'abc', choices: ['12', '15', '18', '20'] }).numericChoices).toBe(true)
    expect(extractFeatures({ question: 'abc', choices: ['alpha', 'beta', 'gamma', 'delta'] }).numericChoices).toBe(false)
    expect(extractFeatures({ question: 'q', choices: [], imagePath: 'a.png' }).hasImage).toBe(true)
  })
  it('estimates par and clamps to bounds', () => {
    const base = { stemLen: 100, choicesLen: 80, numericChoices: false, hasImage: false }
    expect(estimateParMs(base)).toBe(6460)
    expect(estimateParMs({ ...base, numericChoices: true })).toBe(14460)
    expect(estimateParMs({ stemLen: 0, choicesLen: 0, numericChoices: false, hasImage: false })).toBe(TUNING.parMinMs)
    expect(estimateParMs({ ...base, stemLen: 5000 })).toBe(TUNING.parMaxMs)
  })
  it('derives a clamped difficulty weight and card rating', () => {
    expect(difficultyWeight(6000)).toBeCloseTo(1, 5)
    expect(difficultyWeight(4000)).toBe(TUNING.weightMin)
    expect(difficultyWeight(45000)).toBe(TUNING.weightMax)
    expect(cardRating(1)).toBe(TUNING.startRating)
    expect(cardRating(1.3)).toBeCloseTo(1120, 5)
  })
})

describe('speed and scoring', () => {
  it('maps time/par to the speed multiplier', () => {
    expect(speedMultiplier(3000, 6000)).toBe(1.5)
    expect(speedMultiplier(6000, 6000)).toBe(1)
    expect(speedMultiplier(9000, 6000)).toBe(0.5)
    expect(speedMultiplier(60000, 6000)).toBe(0.5)
    expect(speedNorm(1.5)).toBe(1)
    expect(speedNorm(0.5)).toBe(0)
  })
  it('scores a correct answer at par with no streak as base points', () => {
    const r = scoreAnswer({ outcome: 'correct', timeMs: 6000, parMs: 6000, weight: 1, streakBefore: 0 })
    expect(r.points).toBe(100)
    expect(r.streakAfter).toBe(1)
  })
  it('rewards speed and caps the streak multiplier', () => {
    expect(scoreAnswer({ outcome: 'correct', timeMs: 3000, parMs: 6000, weight: 1, streakBefore: 0 }).points).toBe(150)
    const capped = scoreAnswer({ outcome: 'correct', timeMs: 6000, parMs: 6000, weight: 1, streakBefore: 50 })
    expect(capped.streakMult).toBe(TUNING.streakCap)
    expect(capped.points).toBe(150)
  })
  it('penalizes wrong answers more on light questions than heavy ones', () => {
    const easy = scoreAnswer({ outcome: 'wrong', timeMs: 6000, parMs: 6000, weight: 0.8, streakBefore: 3 })
    const hard = scoreAnswer({ outcome: 'wrong', timeMs: 6000, parMs: 6000, weight: 1.3, streakBefore: 3 })
    expect(easy.points).toBeLessThan(hard.points)
    expect(easy.streakAfter).toBe(0)
  })
  it('applies the fast-wrong (spam-click) penalty', () => {
    const normal = scoreAnswer({ outcome: 'wrong', timeMs: 6000, parMs: 6000, weight: 1, streakBefore: 0 })
    const fast = scoreAnswer({ outcome: 'wrong', timeMs: 500, parMs: 6000, weight: 1, streakBefore: 0 })
    expect(normal.points).toBe(-50)
    expect(fast.points).toBe(-75)
    expect(fast.fastWrong).toBe(true)
  })
  it('skips cost a flat penalty and reset the streak; timeouts are never fast-wrong', () => {
    const skip = scoreAnswer({ outcome: 'skipped', timeMs: 1000, parMs: 6000, weight: 1, streakBefore: 4 })
    expect(skip.points).toBe(-TUNING.skipPenalty)
    expect(skip.streakAfter).toBe(0)
    const to = scoreAnswer({ outcome: 'timeout', timeMs: 100, parMs: 6000, weight: 1, streakBefore: 4 })
    expect(to.fastWrong).toBe(false)
    expect(to.points).toBe(-50)
  })
})

describe('rating', () => {
  it('expects 0.5 against an equal opponent', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10)
  })
  it('uses a higher K while provisional', () => {
    expect(kFactor(0)).toBe(TUNING.kProvisional)
    expect(kFactor(TUNING.provisionalAnswers)).toBe(TUNING.kSettled)
  })
  it('scores correct answers 0.7..1.0 and everything else 0', () => {
    expect(performanceScore('correct', 0)).toBeCloseTo(0.7, 10)
    expect(performanceScore('correct', 1)).toBeCloseTo(1, 10)
    expect(performanceScore('wrong', 1)).toBe(0)
    expect(performanceScore('skipped', 1)).toBe(0)
    expect(performanceScore('timeout', 1)).toBe(0)
  })
  it('moves rating up on a fast correct and down on a wrong', () => {
    const up = applyAnswerToRating({ rating: 1000, answers: 0 }, 1000, 'correct', 1)
    const down = applyAnswerToRating({ rating: 1000, answers: 0 }, 1000, 'wrong', 0)
    expect(up.rating).toBeCloseTo(1020, 5)
    expect(down.rating).toBeCloseTo(980, 5)
    expect(up.answers).toBe(1)
  })
  it('computes the TOS-weighted overall and flags provisional subjects', () => {
    const settled = { rating: 0, answers: 50 }
    const o = overallRating({
      MATH: { ...settled, rating: 1200 },
      GEAS: { ...settled, rating: 1000 },
      ELECS: { ...settled, rating: 1400 },
      EST: { ...settled, rating: 1000 },
    })
    expect(o.rating).toBeCloseTo(1160, 5)
    expect(o.provisional).toBe(false)
    expect(overallRating({}).provisional).toBe(true)
    expect(overallRating({}).rating).toBe(1000)
  })
})

describe('allocation and ramp', () => {
  it('splits 100 items by TOS weights across all four subjects', () => {
    expect(allocateCounts(100, ['MATH', 'GEAS', 'ELECS', 'EST'], 'tos')).toEqual({ MATH: 20, GEAS: 20, ELECS: 30, EST: 30 })
  })
  it('renormalizes TOS weights over the picked subjects', () => {
    expect(allocateCounts(100, ['MATH', 'ELECS'], 'tos')).toEqual({ MATH: 40, ELECS: 60 })
  })
  it('splits evenly and always sums to total', () => {
    const even = allocateCounts(10, ['MATH', 'GEAS', 'ELECS'], 'even')
    expect(Object.values(even).reduce((a, b) => a + (b ?? 0), 0)).toBe(10)
    const odd = allocateCounts(7, ['MATH', 'GEAS', 'ELECS', 'EST'], 'tos')
    expect(Object.values(odd).reduce((a, b) => a + (b ?? 0), 0)).toBe(7)
  })
  it('handles empty selections', () => {
    expect(allocateCounts(50, [], 'even')).toEqual({})
    expect(allocateCounts(0, ['MATH'], 'even')).toEqual({})
  })
  it('ramps toward heavier cards as the streak grows', () => {
    const w = [0.8, 1.0, 1.3]
    expect(pickNextIndex(w, 0, () => 0)).toBe(0)
    expect(pickNextIndex(w, 30, () => 0)).toBe(2)
    expect(pickNextIndex([], 0)).toBe(-1)
  })
  it('rates only unfiltered, non-empty runs', () => {
    expect(isRatedRun({ subjects: ['MATH'] })).toBe(true)
    expect(isRatedRun({ subjects: ['MATH'], sourceFilter: ['RC Exam'] })).toBe(false)
    expect(isRatedRun({ subjects: [] })).toBe(false)
  })
})

describe('rating tiers', () => {
  it('maps rating to proper tier and boundaries', () => {
    expect(ratingTier(950)).toEqual({ name: 'ROOKIE', floor: 0, next: 1000 })
    expect(ratingTier(1000)).toEqual({ name: 'CONTENDER', floor: 1000, next: 1150 })
    expect(ratingTier(1149)).toEqual({ name: 'CONTENDER', floor: 1000, next: 1150 })
    expect(ratingTier(1150)).toEqual({ name: 'CHALLENGER', floor: 1150, next: 1300 })
    expect(ratingTier(1299)).toEqual({ name: 'CHALLENGER', floor: 1150, next: 1300 })
    expect(ratingTier(1300)).toEqual({ name: 'EXPERT', floor: 1300, next: 1450 })
    expect(ratingTier(1450)).toEqual({ name: 'MASTER', floor: 1450, next: 1600 })
    expect(ratingTier(1600)).toEqual({ name: 'LEGEND', floor: 1600, next: null })
    expect(ratingTier(2000)).toEqual({ name: 'LEGEND', floor: 1600, next: null })
  })
})

describe('pace model and warnings', () => {
  it('falls back to default pace when samples < 30', () => {
    expect(paceForSubject(undefined)).toBe(8000)
    expect(paceForSubject({ n: 29, avgMs: 4000 })).toBe(8000)
    expect(paceForSubject({ n: 30, avgMs: 4000 })).toBe(4000)
    expect(paceForSubject({ n: 50, avgMs: 1000 })).toBe(2500)
    expect(paceForSubject({ n: 50, avgMs: 90000 })).toBe(60000)
  })

  it('computes blended pace weighted by item count', () => {
    const counts = { MATH: 10, ELECS: 10 }
    const stats = {
      MATH: { n: 40, avgMs: 10000 },
      ELECS: { n: 40, avgMs: 6000 },
    }
    expect(blendedPaceMs(counts, stats)).toBe(8000)
    expect(blendedPaceMs({}, stats)).toBe(8000)
  })

  it('identifies paceSource as observed only when all selected subjects have >= 30 samples', () => {
    const stats = {
      MATH: { n: 35, avgMs: 7000 },
      GEAS: { n: 20, avgMs: 8000 },
    }
    expect(paceSource(['MATH'], stats)).toBe('observed')
    expect(paceSource(['MATH', 'GEAS'], stats)).toBe('estimate')
    expect(paceSource([], stats)).toBe('estimate')
  })

  it('computes capacity and detects planning warnings correctly', () => {
    // 1200s @ 8000ms -> capacity 150
    expect(capacityItems(1200, 8000)).toBe(150)
    // 100 items -> normal (null)
    expect(itemsPlanWarning({ durationSec: 1200, totalItems: 100, paceMs: 8000, source: 'observed' })).toBeNull()
    // 300 items -> too-many (> 150 * 1.3 = 195)
    const tooMany = itemsPlanWarning({ durationSec: 1200, totalItems: 300, paceMs: 8000, source: 'estimate' })
    expect(tooMany).toMatchObject({ kind: 'too-many', capacity: 150, suggested: 150, paceSec: 8, source: 'estimate' })
    // 60 items -> too-few (< 150 * 0.6 = 90)
    const tooFew = itemsPlanWarning({ durationSec: 1200, totalItems: 60, paceMs: 8000, source: 'observed' })
    expect(tooFew).toMatchObject({ kind: 'too-few', capacity: 150, suggested: 150, paceSec: 8, source: 'observed', leftMin: 12 })

    // 300s @ 8000ms -> capacity 37, suggested 35 (round(37/5)*5 = 35)
    expect(capacityItems(300, 8000)).toBe(37)
    const shortRun = itemsPlanWarning({ durationSec: 300, totalItems: 10, paceMs: 8000, source: 'observed' })
    expect(shortRun).toMatchObject({ kind: 'too-few', capacity: 37, suggested: 35 })
  })

  it('detects tight timer warning in survival', () => {
    expect(tightTimerWarning({ perQuestionSec: 10, paceMs: 8000 })).toBe(true)
    expect(tightTimerWarning({ perQuestionSec: 15, paceMs: 8000 })).toBe(false)
  })
})
