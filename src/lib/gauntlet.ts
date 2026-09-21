// src/lib/gauntlet.ts
// Pure Gauntlet logic: par-time estimate, scoring, Elo-style rating, item allocation.
// No I/O, no React. Everything here is unit-tested in gauntlet.test.ts.
import type { Subject } from '../types'

export type GauntletMode = 'survival' | 'timed'
export type AnswerOutcome = 'correct' | 'wrong' | 'skipped' | 'timeout'
export type AllocationStrategy = 'even' | 'tos'

export const GAUNTLET_SUBJECTS: Subject[] = ['MATH', 'GEAS', 'ELECS', 'EST']

/** PRC ECE Table of Specifications subject weights. */
export const TOS_WEIGHTS: Record<Subject, number> = {
  MATH: 0.2,
  GEAS: 0.2,
  ELECS: 0.3,
  EST: 0.3,
}

/** All tunable constants live here. Provisional: tune after real runs. */
export const TUNING = {
  // par time (seconds unless suffixed Ms)
  parBaseSec: 3,
  parPerStemChar: 0.025,
  parPerChoiceChar: 0.012,
  parNumericBonusSec: 8,
  parImageBonusSec: 3,
  parMinMs: 4000,
  parMaxMs: 45000,
  parRefMs: 6000,
  weightMin: 0.8,
  weightMax: 1.3,
  // scoring
  basePoints: 100,
  wrongBase: 50,
  skipPenalty: 0,
  skipEarnInterval: 20,
  lifeBonusInterval: 25,
  fastWrongRatio: 0.25,
  fastWrongMult: 1.5,
  streakStep: 0.1,
  streakCap: 1.5,
  speedMin: 0.5,
  speedMax: 1.5,
  // rating
  startRating: 1000,
  cardRatingSpan: 400,
  kProvisional: 40,
  kSettled: 20,
  provisionalAnswers: 30,
  correctScoreFloor: 0.7, // S for a correct answer at the slowest speed; fastest = 1.0
  // pace & planning
  defaultPaceMs: 8000,
  minPaceSamples: 30,
  minSubjectPaceMs: 2500,
  maxSubjectPaceMs: 60000,
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// ── Card features → par time → difficulty weight ─────────────────────────────

export interface CardFeatures {
  stemLen: number
  choicesLen: number
  numericChoices: boolean
  hasImage: boolean
}

const NUMERIC_START = /^\s*[-+]?[\d.,$\\(]/

export function extractFeatures(mcq: { question?: string; choices?: string[]; imagePath?: string }): CardFeatures {
  const choices = Array.isArray(mcq.choices) ? mcq.choices : []
  const numericCount = choices.filter(c => NUMERIC_START.test(String(c))).length
  return {
    stemLen: (mcq.question ?? '').length,
    choicesLen: choices.reduce((n, c) => n + String(c).length, 0),
    numericChoices: choices.length > 0 && numericCount >= Math.max(2, Math.floor(choices.length / 2)),
    hasImage: !!mcq.imagePath,
  }
}

/** Expected time (ms) a competent reviewee needs for this question. */
export function estimateParMs(f: CardFeatures): number {
  const T = TUNING
  const sec =
    T.parBaseSec +
    T.parPerStemChar * f.stemLen +
    T.parPerChoiceChar * f.choicesLen +
    (f.numericChoices ? T.parNumericBonusSec : 0) +
    (f.hasImage ? T.parImageBonusSec : 0)
  return Math.round(clamp(sec * 1000, T.parMinMs, T.parMaxMs))
}

/** Heavier (longer-par) questions are worth more when right and cost less when wrong. */
export function difficultyWeight(parMs: number): number {
  return clamp(parMs / TUNING.parRefMs, TUNING.weightMin, TUNING.weightMax)
}

/** Opponent rating of a card for the Elo update (mild spread around startRating). */
export function cardRating(weight: number): number {
  return TUNING.startRating + (weight - 1) * TUNING.cardRatingSpan
}

// ── Scoring ──────────────────────────────────────────────────────────────────

/** 1.5 when answered in <= half of par, 1.0 at par, 0.5 at >= 1.5x par. */
export function speedMultiplier(timeMs: number, parMs: number): number {
  const r = timeMs / Math.max(1, parMs)
  return clamp(2 - r, TUNING.speedMin, TUNING.speedMax)
}

/** Rescales the speed multiplier to 0..1. */
export function speedNorm(mult: number): number {
  return (mult - TUNING.speedMin) / (TUNING.speedMax - TUNING.speedMin)
}

export interface ScoreInput {
  outcome: AnswerOutcome
  timeMs: number
  parMs: number
  weight: number
  streakBefore: number
}

export interface ScoreResult {
  points: number
  speed: number
  speedNorm: number
  streakMult: number
  streakAfter: number
  fastWrong: boolean
}

export function scoreAnswer(i: ScoreInput): ScoreResult {
  const T = TUNING
  const speed = speedMultiplier(i.timeMs, i.parMs)
  const sn = speedNorm(speed)

  if (i.outcome === 'correct') {
    const streakMult = Math.min(T.streakCap, 1 + T.streakStep * i.streakBefore)
    return {
      points: Math.round(T.basePoints * i.weight * speed * streakMult),
      speed,
      speedNorm: sn,
      streakMult,
      streakAfter: i.streakBefore + 1,
      fastWrong: false,
    }
  }

  if (i.outcome === 'skipped') {
    const streakMult = Math.min(T.streakCap, 1 + T.streakStep * i.streakBefore)
    return { points: 0, speed, speedNorm: sn, streakMult, streakAfter: i.streakBefore, fastWrong: false }
  }

  // wrong or timeout: easy (light) questions cost more, hard (heavy) ones cost less
  const fastWrong = i.outcome === 'wrong' && i.timeMs < i.parMs * T.fastWrongRatio
  const penalty = Math.round((T.wrongBase / i.weight) * (fastWrong ? T.fastWrongMult : 1))
  return { points: -penalty, speed, speedNorm: sn, streakMult: 1, streakAfter: 0, fastWrong }
}

// ── Skip-earn streak logic ──────────────────────────────────────────────────

export interface SkipState {
  skipsAvailable: number
  skipEarnStreak: number
}

/**
 * Pure helper to update skip-earn streak and banked skip credits.
 * - 'correct': increments skipEarnStreak; every 20 consecutive correct awards +1 skip credit.
 * - 'wrong' | 'timeout': resets skipEarnStreak to 0.
 * - 'use_skip': consumes 1 skip credit and resets skipEarnStreak to 0.
 */
export function updateSkipState(
  current: SkipState,
  action: 'correct' | 'wrong' | 'timeout' | 'use_skip',
): SkipState {
  if (action === 'use_skip') {
    return {
      skipsAvailable: Math.max(0, current.skipsAvailable - 1),
      skipEarnStreak: 0,
    }
  }
  if (action === 'correct') {
    const nextStreak = current.skipEarnStreak + 1
    const earned = nextStreak > 0 && nextStreak % TUNING.skipEarnInterval === 0
    return {
      skipsAvailable: current.skipsAvailable + (earned ? 1 : 0),
      skipEarnStreak: nextStreak,
    }
  }
  return {
    skipsAvailable: current.skipsAvailable,
    skipEarnStreak: 0,
  }
}

// ── Life-bonus streak logic (Survival mode) ─────────────────────────────────

export interface LifeBonusState {
  streak: number
}

export interface LifeBonusResult {
  streak: number
  awardLife: boolean
  awarded: number
}

/**
 * Pure helper to update life-bonus streak for survival mode.
 * - 'correct': increments streak; every 25 consecutive correct signals a bonus life (+1).
 * - 'wrong' | 'timeout': resets streak to 0.
 */
export function updateLifeBonusState(
  current: { streak: number },
  action: 'correct' | 'wrong' | 'timeout',
): LifeBonusResult {
  if (action === 'correct') {
    const nextStreak = current.streak + 1
    const awardLife = nextStreak > 0 && nextStreak % TUNING.lifeBonusInterval === 0
    return {
      streak: nextStreak,
      awardLife,
      awarded: awardLife ? 1 : 0,
    }
  }
  return {
    streak: 0,
    awardLife: false,
    awarded: 0,
  }
}

// ── Rating (Elo-style, per subject) ──────────────────────────────────────────

export interface SubjectRating {
  rating: number
  answers: number
}

export function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
}

export function kFactor(answersSoFar: number): number {
  return answersSoFar < TUNING.provisionalAnswers ? TUNING.kProvisional : TUNING.kSettled
}

/** Actual score S: 0 for anything but correct; 0.7..1.0 for correct, faster = higher. */
export function performanceScore(outcome: AnswerOutcome, sn: number): number {
  if (outcome !== 'correct') return 0
  return TUNING.correctScoreFloor + (1 - TUNING.correctScoreFloor) * clamp(sn, 0, 1)
}

export function applyAnswerToRating(
  current: SubjectRating,
  opponentRating: number,
  outcome: AnswerOutcome,
  sn: number,
): SubjectRating {
  const e = expectedScore(current.rating, opponentRating)
  const s = performanceScore(outcome, sn)
  return {
    rating: current.rating + kFactor(current.answers) * (s - e),
    answers: current.answers + 1,
  }
}

export function defaultRating(): SubjectRating {
  return { rating: TUNING.startRating, answers: 0 }
}

/** TOS-weighted average across all four subjects. Unplayed subjects count at the start rating. */
export function overallRating(ratings: Partial<Record<Subject, SubjectRating>>): { rating: number; provisional: boolean } {
  let total = 0
  let provisional = false
  for (const s of GAUNTLET_SUBJECTS) {
    const r = ratings[s] ?? defaultRating()
    total += TOS_WEIGHTS[s] * r.rating
    if (r.answers < TUNING.provisionalAnswers) provisional = true
  }
  return { rating: total, provisional }
}

// ── Item allocation (timed runs) ─────────────────────────────────────────────

/** Splits `total` items across the picked subjects (largest-remainder rounding). */
export function allocateCounts(
  total: number,
  subjects: Subject[],
  strategy: AllocationStrategy,
): Partial<Record<Subject, number>> {
  const picked = GAUNTLET_SUBJECTS.filter(s => subjects.includes(s))
  const out: Partial<Record<Subject, number>> = {}
  if (picked.length === 0 || total <= 0) return out

  const raw = picked.map(s => (strategy === 'tos' ? TOS_WEIGHTS[s] : 1))
  const sum = raw.reduce((a, b) => a + b, 0)
  const exact = raw.map(w => (total * w) / sum)
  const floors = exact.map(Math.floor)
  let remainder = total - floors.reduce((a, b) => a + b, 0)
  const order = exact
    .map((e, i) => ({ i, frac: e - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (remainder <= 0) break
    floors[i]++
    remainder--
  }
  picked.forEach((s, i) => {
    out[s] = floors[i]
  })
  return out
}

// ── Survival ramp ────────────────────────────────────────────────────────────

export function rampTargetWeight(streak: number): number {
  return clamp(0.85 + 0.03 * streak, TUNING.weightMin, TUNING.weightMax)
}

/** Picks the index of the next candidate: near the ramp target, with a little randomness. */
export function pickNextIndex(weights: number[], streak: number, rand: () => number = Math.random): number {
  if (weights.length === 0) return -1
  const target = rampTargetWeight(streak)
  const ranked = weights
    .map((w, i) => ({ i, d: Math.abs(w - target) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
  const pool = ranked.slice(0, Math.min(5, ranked.length))
  const k = Math.min(pool.length - 1, Math.floor(rand() * pool.length))
  return pool[k].i
}

/** A run is rated only when it draws from the whole subject pool (no deck/folder/source filter). */
export function isRatedRun(opts: { sourceFilter?: string[] | null; subjects: Subject[] }): boolean {
  return opts.subjects.length > 0 && (!opts.sourceFilter || opts.sourceFilter.length === 0)
}

// ── Rating Tiers ─────────────────────────────────────────────────────────────

export interface RatingTierInfo {
  name: 'ROOKIE' | 'CONTENDER' | 'CHALLENGER' | 'EXPERT' | 'MASTER' | 'LEGEND'
  floor: number
  next: number | null
}

export function ratingTier(rating: number): RatingTierInfo {
  if (rating < 1000) return { name: 'ROOKIE', floor: 0, next: 1000 }
  if (rating < 1150) return { name: 'CONTENDER', floor: 1000, next: 1150 }
  if (rating < 1300) return { name: 'CHALLENGER', floor: 1150, next: 1300 }
  if (rating < 1450) return { name: 'EXPERT', floor: 1300, next: 1450 }
  if (rating < 1600) return { name: 'MASTER', floor: 1450, next: 1600 }
  return { name: 'LEGEND', floor: 1600, next: null }
}

// ── Pace Model & Session Planning ────────────────────────────────────────────

export function paceForSubject(stat?: { n: number; avgMs: number }): number {
  if (stat && stat.n >= TUNING.minPaceSamples) {
    return clamp(stat.avgMs, TUNING.minSubjectPaceMs, TUNING.maxSubjectPaceMs)
  }
  return TUNING.defaultPaceMs
}

export function blendedPaceMs(
  counts: Partial<Record<Subject, number>>,
  stats: Partial<Record<Subject, { n: number; avgMs: number }>>,
): number {
  let weightedSum = 0
  let totalCount = 0
  for (const s of GAUNTLET_SUBJECTS) {
    const c = counts[s] ?? 0
    if (c > 0) {
      const pace = paceForSubject(stats[s])
      weightedSum += c * pace
      totalCount += c
    }
  }
  return totalCount > 0 ? weightedSum / totalCount : TUNING.defaultPaceMs
}

export function paceSource(
  subjects: Subject[],
  stats: Partial<Record<Subject, { n: number; avgMs: number }>>,
): 'observed' | 'estimate' {
  if (subjects.length === 0) return 'estimate'
  const allObserved = subjects.every(s => (stats[s]?.n ?? 0) >= TUNING.minPaceSamples)
  return allObserved ? 'observed' : 'estimate'
}

export function capacityItems(durationSec: number, paceMs: number): number {
  if (paceMs <= 0) return 0
  return Math.floor((durationSec * 1000) / paceMs)
}

export interface ItemsPlanWarning {
  kind: 'too-many' | 'too-few'
  capacity: number
  suggested: number
  paceSec: number
  source: 'observed' | 'estimate'
  leftMin?: number
}

export function itemsPlanWarning(opts: {
  durationSec: number
  totalItems: number
  paceMs: number
  source: 'observed' | 'estimate'
}): ItemsPlanWarning | null {
  const { durationSec, totalItems, paceMs, source } = opts
  const capacity = capacityItems(durationSec, paceMs)
  const suggested = Math.max(5, Math.round(capacity / 5) * 5)
  const paceSec = Math.round(paceMs / 1000)

  if (totalItems > Math.ceil(capacity * 1.3)) {
    return { kind: 'too-many', capacity, suggested, paceSec, source }
  }

  if (totalItems < Math.floor(capacity * 0.6)) {
    const leftMin = Math.round((durationSec - (totalItems * paceMs) / 1000) / 60)
    return { kind: 'too-few', capacity, suggested, paceSec, source, leftMin }
  }

  return null
}

export function tightTimerWarning(opts: { perQuestionSec: number; paceMs: number }): boolean {
  return opts.perQuestionSec * 1000 < 1.5 * opts.paceMs
}
