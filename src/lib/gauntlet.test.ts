import { describe, it, expect } from 'vitest'
import {
  extractFeatures, estimateParMs, difficultyWeight, cardRating,
  speedMultiplier, speedNorm, scoreAnswer,
  expectedScore, kFactor, performanceScore, applyAnswerToRating, overallRating,
  allocateCounts, pickNextIndex, isRatedRun, TUNING,
  ratingTier, paceForSubject, blendedPaceMs, paceSource, capacityItems, itemsPlanWarning, tightTimerWarning,
  updateSkipState,
  updateLifeBonusState,
  isScoreLifeBonus,
  getTimeMultiplier,
  getLivesMultiplier,
  getSurvivalDifficultyMultiplier,
  formatRunDuration,
  getWeakestSubject,
  reshapeRunsToEloHistory,
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
    expect(cardRating(1.3)).toBeCloseTo(620, 5)
    expect(cardRating(1000, 1.3)).toBeCloseTo(1120, 5)
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
  it('awards a bonus score for every 5 streak of correct questions', () => {
    // 4 streak before -> 5 streak after (milestone reached)
    // base points: 100 * 1 (weight) * 1 (speed) * (1 + 0.1 * 4 = 1.4 streakMult) = 140
    // streak bonus: +50
    // total points: 190
    const hit5 = scoreAnswer({ outcome: 'correct', timeMs: 6000, parMs: 6000, weight: 1, streakBefore: 4 })
    expect(hit5.streakAfter).toBe(5)
    expect(hit5.streakBonus).toBe(50)
    expect(hit5.points).toBe(190)

    // 9 streak before -> 10 streak after (milestone reached)
    const hit10 = scoreAnswer({ outcome: 'correct', timeMs: 6000, parMs: 6000, weight: 1, streakBefore: 9 })
    expect(hit10.streakAfter).toBe(10)
    expect(hit10.streakBonus).toBe(50)

    // Non-milestone (e.g. 5 before -> 6 after)
    const noMilestone = scoreAnswer({ outcome: 'correct', timeMs: 6000, parMs: 6000, weight: 1, streakBefore: 5 })
    expect(noMilestone.streakAfter).toBe(6)
    expect(noMilestone.streakBonus).toBe(0)
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

    // Insulator rank: penalties halved
    const insulatorNormal = scoreAnswer({ outcome: 'wrong', timeMs: 6000, parMs: 6000, weight: 1, streakBefore: 0, isInsulator: true })
    const insulatorFast = scoreAnswer({ outcome: 'wrong', timeMs: 500, parMs: 6000, weight: 1, streakBefore: 0, isInsulator: true })
    expect(insulatorNormal.points).toBe(-25)
    expect(insulatorFast.points).toBe(-38)
  })
  it('earned skips award 0 points and preserve streak; timeouts are never fast-wrong', () => {
    const skip = scoreAnswer({ outcome: 'skipped', timeMs: 1000, parMs: 6000, weight: 1, streakBefore: 4 })
    expect(skip.points).toBe(0)
    expect(skip.streakAfter).toBe(4)
    const to = scoreAnswer({ outcome: 'timeout', timeMs: 100, parMs: 6000, weight: 1, streakBefore: 4 })
    expect(to.fastWrong).toBe(false)
    expect(to.points).toBe(-50)
  })
  it('skip-earn streak grants +1 credit every 20 correct in a row', () => {
    let state = { skipsAvailable: 1, skipEarnStreak: 0 }
    for (let i = 0; i < 19; i++) {
      state = updateSkipState(state, 'correct')
    }
    expect(state.skipsAvailable).toBe(1)
    expect(state.skipEarnStreak).toBe(19)

    // 20th consecutive correct grants 1 credit
    state = updateSkipState(state, 'correct')
    expect(state.skipsAvailable).toBe(2)
    expect(state.skipEarnStreak).toBe(20)

    // 40th consecutive correct grants another credit
    for (let i = 0; i < 20; i++) {
      state = updateSkipState(state, 'correct')
    }
    expect(state.skipsAvailable).toBe(3)
    expect(state.skipEarnStreak).toBe(40)
  })
  it('wrong answer or timeout at 19 in a row grants nothing and resets skipEarnStreak to 0', () => {
    let state = { skipsAvailable: 1, skipEarnStreak: 0 }
    for (let i = 0; i < 19; i++) {
      state = updateSkipState(state, 'correct')
    }
    expect(state.skipsAvailable).toBe(1)
    expect(state.skipEarnStreak).toBe(19)

    // Wrong answer resets streak, preserves banked skips
    const afterWrong = updateSkipState(state, 'wrong')
    expect(afterWrong.skipsAvailable).toBe(1)
    expect(afterWrong.skipEarnStreak).toBe(0)

    // Timeout resets streak, preserves banked skips
    const afterTimeout = updateSkipState(state, 'timeout')
    expect(afterTimeout.skipsAvailable).toBe(1)
    expect(afterTimeout.skipEarnStreak).toBe(0)
  })
  it('using a credit resets skip-earn streak and decrements skips without touching score streak or points', () => {
    const state = { skipsAvailable: 2, skipEarnStreak: 15 }
    const afterUse = updateSkipState(state, 'use_skip')
    expect(afterUse.skipsAvailable).toBe(1)
    expect(afterUse.skipEarnStreak).toBe(0)

    // Scoring result preserves score streak and awards 0 points
    const scoreRes = scoreAnswer({ outcome: 'skipped', timeMs: 500, parMs: 5000, weight: 1.1, streakBefore: 7 })
    expect(scoreRes.points).toBe(0)
    expect(scoreRes.streakAfter).toBe(7)
  })
})

describe('life-bonus streak logic (Survival mode)', () => {
  it('signals +1 life every 10 consecutive correct answers', () => {
    let state = { streak: 0 }
    for (let i = 0; i < 9; i++) {
      const res = updateLifeBonusState(state, 'correct')
      expect(res.awardLife).toBe(false)
      expect(res.awarded).toBe(0)
      state = { streak: res.streak }
    }
    expect(state.streak).toBe(9)

    // 10th consecutive correct signals +1 life
    const hit10 = updateLifeBonusState(state, 'correct')
    expect(hit10.streak).toBe(10)
    expect(hit10.awardLife).toBe(true)
    expect(hit10.awarded).toBe(1)
    state = { streak: hit10.streak }

    // 11th to 19th do not award lives
    for (let i = 10; i < 19; i++) {
      const res = updateLifeBonusState(state, 'correct')
      expect(res.awardLife).toBe(false)
      expect(res.awarded).toBe(0)
      state = { streak: res.streak }
    }
    expect(state.streak).toBe(19)

    // 20th consecutive correct awards another life
    const hit20 = updateLifeBonusState(state, 'correct')
    expect(hit20.streak).toBe(20)
    expect(hit20.awardLife).toBe(true)
    expect(hit20.awarded).toBe(1)
  })

  it('wrong answer or timeout at 9 signals nothing and resets streak to 0', () => {
    const stateAt9 = { streak: 9 }

    const afterWrong = updateLifeBonusState(stateAt9, 'wrong')
    expect(afterWrong.streak).toBe(0)
    expect(afterWrong.awardLife).toBe(false)
    expect(afterWrong.awarded).toBe(0)

    const afterTimeout = updateLifeBonusState(stateAt9, 'timeout')
    expect(afterTimeout.streak).toBe(0)
    expect(afterTimeout.awardLife).toBe(false)
    expect(afterTimeout.awarded).toBe(0)
  })

  it('life-bonus streak is completely independent of score streak and skip-earn streak', () => {
    // Simulate 10 correct answers:
    // skip-earn streak hits 10 (does NOT award skip yet, needs 20)
    // life-bonus streak hits 10 (awards life at 10)
    let skipState = { skipsAvailable: 1, skipEarnStreak: 0 }
    let lifeState = { streak: 0 }

    for (let i = 0; i < 10; i++) {
      skipState = updateSkipState(skipState, 'correct')
      const lifeRes = updateLifeBonusState(lifeState, 'correct')
      lifeState = { streak: lifeRes.streak }
      if (i === 9) {
        expect(skipState.skipsAvailable).toBe(1) // not yet 20
        expect(lifeRes.awardLife).toBe(true)     // hits 10 -> awards life
      }
    }

    // 10 more correct (total 20):
    for (let i = 10; i < 20; i++) {
      skipState = updateSkipState(skipState, 'correct')
      const lifeRes = updateLifeBonusState(lifeState, 'correct')
      lifeState = { streak: lifeRes.streak }
      if (i === 19) {
        expect(skipState.skipsAvailable).toBe(2) // hits 20 -> awards skip
        expect(lifeRes.awardLife).toBe(true)     // hits 20 -> awards second life
      }
    }

    expect(lifeState.streak).toBe(20)
    expect(skipState.skipEarnStreak).toBe(20)
  })

  it('isScoreLifeBonus awards a life at every 20 total correct answers', () => {
    expect(isScoreLifeBonus(0)).toBe(false)
    expect(isScoreLifeBonus(10)).toBe(false)
    expect(isScoreLifeBonus(19)).toBe(false)
    expect(isScoreLifeBonus(20)).toBe(true)
    expect(isScoreLifeBonus(21)).toBe(false)
    expect(isScoreLifeBonus(40)).toBe(true)
    expect(isScoreLifeBonus(60)).toBe(true)
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
    const up = applyAnswerToRating({ rating: 500, answers: 0 }, 500, 'correct', 1)
    const down = applyAnswerToRating({ rating: 500, answers: 0 }, 500, 'wrong', 0)
    expect(up.rating).toBeCloseTo(525, 5)
    expect(down.rating).toBe(500) // Hard floor at 500
    expect(up.answers).toBe(1)
  })
  it('softens Elo loss by 50% in Insulator rank (under 800) on wrong answers', () => {
    // Insulator rating 700: K=40*1.25=50, expected=0.5, rawDelta=-25 -> halved to -12.5 -> rating 687.5
    const insulatorDown = applyAnswerToRating({ rating: 700, answers: 0 }, 700, 'wrong', 0)
    expect(insulatorDown.rating).toBe(687.5)

    // Semiconductor rating 900: K=32*1.25=40, expected=0.5, rawDelta=-20 (standard, not halved) -> rating 880
    const semicondDown = applyAnswerToRating({ rating: 900, answers: 0 }, 900, 'wrong', 0)
    expect(semicondDown.rating).toBe(880)
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
    expect(overallRating({}).rating).toBe(500)
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
    expect(ratingTier(500)).toEqual({ name: 'INSULATOR', floor: 500, next: 800 })
    expect(ratingTier(799)).toEqual({ name: 'INSULATOR', floor: 500, next: 800 })
    expect(ratingTier(800)).toEqual({ name: 'SEMICONDUCTOR', floor: 800, next: 1000 })
    expect(ratingTier(999)).toEqual({ name: 'SEMICONDUCTOR', floor: 800, next: 1000 })
    expect(ratingTier(1000)).toEqual({ name: 'CONDUCTOR', floor: 1000, next: 1100 })
    expect(ratingTier(1099)).toEqual({ name: 'CONDUCTOR', floor: 1000, next: 1100 })
    expect(ratingTier(1100)).toEqual({ name: 'COPPER', floor: 1100, next: 1300 })
    expect(ratingTier(1299)).toEqual({ name: 'COPPER', floor: 1100, next: 1300 })
    expect(ratingTier(1300)).toEqual({ name: 'SILVER', floor: 1300, next: 1500 })
    expect(ratingTier(1499)).toEqual({ name: 'SILVER', floor: 1300, next: 1500 })
    expect(ratingTier(1500)).toEqual({ name: 'SUPERCONDUCTOR', floor: 1500, next: null })
    expect(ratingTier(2000)).toEqual({ name: 'SUPERCONDUCTOR', floor: 1500, next: null })
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
    expect(tightTimerWarning({ perQuestionSec: 0, paceMs: 8000 })).toBe(false)
  })

  describe('Survival difficulty multipliers and unlimited accuracy mode', () => {
    it('computes time multipliers correctly', () => {
      expect(getTimeMultiplier(20)).toBe(1.25)
      expect(getTimeMultiplier(30)).toBe(1.0)
      expect(getTimeMultiplier(45)).toBe(0.85)
      expect(getTimeMultiplier(60)).toBe(0.7)
      expect(getTimeMultiplier(120)).toBe(0.5)
      expect(getTimeMultiplier(0)).toBe(0.08)
    })

    it('computes lives multipliers correctly', () => {
      expect(getLivesMultiplier(3)).toBe(1.1)
      expect(getLivesMultiplier(5)).toBe(1.0)
      expect(getLivesMultiplier(10)).toBe(0.75)
    })

    it('combines difficulty multipliers for survival', () => {
      const standard = getSurvivalDifficultyMultiplier(30, 5)
      expect(standard.scoreMult).toBe(1.0)
      expect(standard.eloMult).toBe(1.0)
      expect(standard.isUnlimited).toBe(false)

      const hard = getSurvivalDifficultyMultiplier(20, 3)
      expect(hard.scoreMult).toBe(1.38)
      expect(hard.eloMult).toBe(1.38)

      const unlimited = getSurvivalDifficultyMultiplier(0, 10)
      expect(unlimited.scoreMult).toBe(0.08)
      expect(unlimited.eloMult).toBe(0.08)
      expect(unlimited.isUnlimited).toBe(true)
    })

    it('scales scoreAnswer points with scoreMult', () => {
      const normal = scoreAnswer({ outcome: 'correct', timeMs: 6000, parMs: 6000, weight: 1, streakBefore: 0 })
      const scaled = scoreAnswer({ outcome: 'correct', timeMs: 6000, parMs: 6000, weight: 1, streakBefore: 0, scoreMult: 0.08 })
      expect(normal.points).toBe(100)
      expect(scaled.points).toBe(8)
    })

    it('awards fixed +1 / -1 Elo delta in unlimited accuracy mode', () => {
      const r0 = { rating: 1000, answers: 5 }
      const correctRes = applyAnswerToRating(r0, 1000, 'correct', 0.5, 0.08)
      expect(correctRes.rating).toBe(1001)

      const wrongRes = applyAnswerToRating(r0, 1000, 'wrong', 0, 0.08)
      expect(wrongRes.rating).toBe(999)

      const skippedRes = applyAnswerToRating(r0, 1000, 'skipped', 0, 0.08)
      expect(skippedRes.rating).toBe(1000)
    })
  })

  describe('formatRunDuration', () => {
    it('formats seconds correctly', () => {
      expect(formatRunDuration(0)).toBe('0m 00s')
      expect(formatRunDuration(45000)).toBe('0m 45s')
    })

    it('formats minutes and seconds correctly', () => {
      expect(formatRunDuration(65000)).toBe('1m 05s')
      expect(formatRunDuration(222000)).toBe('3m 42s')
    })

    it('formats hours, minutes, and seconds correctly', () => {
      expect(formatRunDuration(3665000)).toBe('1h 01m 05s')
    })
  })

  describe('getWeakestSubject', () => {
    it('returns null when all subjects are unplayed', () => {
      expect(getWeakestSubject({})).toBeNull()
      expect(
        getWeakestSubject({
          MATH: { rating: 1000, answers: 0 },
          GEAS: { rating: 1000, answers: 0 },
          ELECS: { rating: 1000, answers: 0 },
          EST: { rating: 1000, answers: 0 },
        })
      ).toBeNull()
    })

    it('returns null when all played subjects are tied at the same rating', () => {
      expect(
        getWeakestSubject({
          MATH: { rating: 1100, answers: 10 },
          GEAS: { rating: 1100, answers: 10 },
          ELECS: { rating: 1100, answers: 10 },
          EST: { rating: 1100, answers: 10 },
        })
      ).toBeNull()
    })

    it('returns the subject with the lowest rating when one is lowest', () => {
      const res = getWeakestSubject({
        MATH: { rating: 1050, answers: 10 },
        GEAS: { rating: 920, answers: 10 },
        ELECS: { rating: 1150, answers: 10 },
        EST: { rating: 1000, answers: 10 },
      })
      expect(res).toEqual({ subject: 'GEAS', rating: 920 })
    })

    it('treats unplayed subjects as defaultRating (500)', () => {
      // MATH has risen above 500, others unplayed (500) -> lowest is 500 (first unplayed subject)
      const res2 = getWeakestSubject({
        MATH: { rating: 650, answers: 5 },
      })
      expect(res2?.rating).toBe(500)
      expect(['GEAS', 'ELECS', 'EST']).toContain(res2?.subject)
    })
  })

  describe('reshapeRunsToEloHistory', () => {
    it('returns empty array when runs is empty or non-array', () => {
      expect(reshapeRunsToEloHistory([])).toEqual([])
      expect(reshapeRunsToEloHistory(null as any)).toEqual([])
    })

    it('reverses DESC runs into chronologically ascending points and extracts per-subject ratings', () => {
      const mockRuns = [
        {
          id: 'run-2',
          startedAt: 1700002000,
          ratingsAfter: {
            MATH: { rating: 1060.4, answers: 12 },
            GEAS: { rating: 980.2, answers: 10 },
            ELECS: { rating: 1010.0, answers: 8 },
            EST: { rating: 1040.1, answers: 14 },
          },
        },
        {
          id: 'run-1',
          startedAt: 1700001000,
          ratingsAfter: {
            MATH: { rating: 1020.1, answers: 6 },
            GEAS: { rating: 1000.0, answers: 5 },
            ELECS: { rating: 990.4, answers: 4 },
            EST: { rating: 1015.3, answers: 7 },
          },
        },
      ]

      const points = reshapeRunsToEloHistory(mockRuns)
      expect(points).toHaveLength(2)
      // First point should be run-1 (older)
      expect(points[0].timestamp).toBe(1700001000)
      expect(points[0].MATH).toBe(1020)
      expect(points[0].GEAS).toBe(1000)
      expect(points[0].ELECS).toBe(990)
      expect(points[0].EST).toBe(1015)

      // Second point should be run-2 (newer)
      expect(points[1].timestamp).toBe(1700002000)
      expect(points[1].MATH).toBe(1060)
      expect(points[1].GEAS).toBe(980)
      expect(points[1].ELECS).toBe(1010)
      expect(points[1].EST).toBe(1040)
    })

    it('handles stringified ratings_after from raw SQLite rows and skips unrated runs', () => {
      const rawRows = [
        {
          id: 'unrated-run',
          started_at: 1700000500,
          ratings_after: null,
        },
        {
          id: 'run-3',
          started_at: 1700003000,
          ratings_after: JSON.stringify({
            MATH: { rating: 1080, answers: 15 },
          }),
        },
      ]

      const points = reshapeRunsToEloHistory(rawRows)
      expect(points).toHaveLength(1)
      expect(points[0].timestamp).toBe(1700003000)
      expect(points[0].MATH).toBe(1080)
      expect(points[0].GEAS).toBeNull()
      expect(points[0].ELECS).toBeNull()
      expect(points[0].EST).toBeNull()
    })
  })
})

