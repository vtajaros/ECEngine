// src/store/useGauntletStore.ts
// Gauntlet run engine. Separate from useSessionStore / progress / mastery by design.
import { create } from 'zustand'
import type { MCQData, Subject } from '../types'
import { gauntletService, type GauntletCard } from '../services/gauntlet.service'
import { dbService } from '../services/db.service'
import { shuffle, shuffleChoices, isSafeToShuffleChoices } from '../lib/scrambler'
import {
  GAUNTLET_SUBJECTS,
  TUNING,
  allocateCounts,
  applyAnswerToRating,
  computeAnswerEloDelta,
  computeTimedVirtualRating,
  TIMED_QUESTION_CAP_SEC,
  getSharedTopicPartnerSubject,
  cardRating,
  defaultRating,
  difficultyWeight,
  estimateParMs,
  extractFeatures,
  getSurvivalDifficultyMultiplier,
  isRatedRun,
  isScoreLifeBonus,
  pickNextIndex,
  scoreAnswer,
  updateLifeBonusState,
  updateSkipState,
  type AllocationStrategy,
  type AnswerOutcome,
  type GauntletMode,
  type SubjectRating,
} from '../lib/gauntlet'

export type GauntletPhase = 'home' | 'setup' | 'loading' | 'countdown' | 'playing' | 'summary'
export type EndReason = 'time' | 'lives' | 'queue' | 'quit'

export interface GauntletConfig {
  mode: GauntletMode
  subjects: Subject[]
  rated: boolean
  // timed run
  durationSec: number
  totalItems: number
  allocation: AllocationStrategy | 'custom'
  customCounts: Partial<Record<Subject, number>>
  // survival
  lives: number
  perQuestionSec: number
  allowSolutions?: boolean
  unlimitedItems?: boolean
  tosTopicId?: string | null
  tosTopicIds?: string[]
}

export const DEFAULT_CONFIG: GauntletConfig = {
  mode: 'timed',
  subjects: ['MATH', 'GEAS', 'ELECS', 'EST'],
  rated: true,
  durationSec: 1200,
  totalItems: 100,
  allocation: 'tos',
  customCounts: { MATH: 20, GEAS: 20, ELECS: 30, EST: 30 },
  lives: 3,
  perQuestionSec: 30,
  tosTopicIds: [],
}

export interface QueueItem {
  card: GauntletCard // choices already shuffled (when safe)
  subject: Subject
  parMs: number
  weight: number
  cardRating: number
}

export interface AnswerRecord {
  seq: number
  item: QueueItem
  chosen: number | null
  outcome: AnswerOutcome
  timeMs: number
  points: number
  streakAfter: number
  answeredAt: number
  streakBonus?: number
}

/** Transient result of the last answer, for instant-check effects (does NOT reveal the correct choice). */
export interface Feedback {
  id: number
  outcome: AnswerOutcome
  points: number
  streak: number
  streakMult: number
  fastWrong: boolean
  lifeBonus?: boolean
  streakBonus?: number
}

export interface HubData {
  ratings: Record<Subject, SubjectRating>
  peaks: Partial<Record<Subject, number>>
  poolSizes: Record<Subject, number>
  bests: Array<{ mode: string; bestScore: number; bestStreak: number; runs: number }>
  runs: any[]
  pace: Partial<Record<Subject, { n: number; avgMs: number }>>
}

const MIN_ANSWER_MS = 150 // ignore accidental double-click carry-over into the next question
const SURVIVAL_BATCH = 24
const REFILL_THRESHOLD = 8

const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)))

const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `gr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

const defaultRatings = (): Record<Subject, SubjectRating> =>
  Object.fromEntries(GAUNTLET_SUBJECTS.map(s => [s, defaultRating()])) as Record<Subject, SubjectRating>

function ratingsToMap(rows: Array<{ subject: string; rating: number; answers: number }>): Record<Subject, SubjectRating> {
  const map = defaultRatings()
  for (const r of rows) {
    if ((GAUNTLET_SUBJECTS as string[]).includes(r.subject)) {
      map[r.subject as Subject] = { rating: r.rating, answers: r.answers }
    }
  }
  return map
}

export function normalizeConfig(c: GauntletConfig): GauntletConfig {
  const subjects = GAUNTLET_SUBJECTS.filter(s => c.subjects.includes(s))
  const customCounts: Partial<Record<Subject, number>> = {}
  for (const s of subjects) customCounts[s] = clampInt(c.customCounts?.[s] ?? 0, 0, 500)
  return {
    ...c,
    subjects,
    customCounts,
    durationSec: clampInt(c.durationSec, 60, 7200),
    totalItems: clampInt(c.totalItems, 1, 500),
    lives: c.lives === 0 ? 0 : clampInt(c.lives, 1, 10),
    perQuestionSec: c.perQuestionSec === 0 ? 0 : clampInt(c.perQuestionSec, 5, 300),
    allowSolutions: c.allowSolutions,
    unlimitedItems: c.unlimitedItems,
    tosTopicId: c.tosTopicId ?? null,
    tosTopicIds: Array.isArray(c.tosTopicIds) ? c.tosTopicIds : c.tosTopicId ? [c.tosTopicId] : [],
  }
}

function toQueueItem(source: GauntletCard): QueueItem {
  const mcq = source.data as MCQData
  let data: MCQData = mcq
  if (Array.isArray(mcq.choices) && isSafeToShuffleChoices(mcq.choices)) {
    const sc = shuffleChoices(mcq.choices, mcq.answer, mcq.choicesPlainText)
    data = {
      ...mcq,
      choices: sc.choices,
      answer: sc.answer,
      ...(sc.choicesPlainText ? { choicesPlainText: sc.choicesPlainText } : {}),
    }
  }
  const card: GauntletCard = { ...source, data }
  const parMs = estimateParMs(extractFeatures(data))
  const weight = difficultyWeight(parMs)
  return { card, subject: source.subjectCode, parMs, weight, cardRating: cardRating(weight) }
}

/** Spacing pass: swap adjacent cards that share a tos_topic_id with the next card that doesn't. */
function spaceByTopic(queue: QueueItem[], startFrom = 0): QueueItem[] {
  const q = [...queue]
  const start = Math.max(1, startFrom)
  for (let i = start; i < q.length; i++) {
    const prevTopic = q[i - 1].card.tosTopicId
    const currTopic = q[i].card.tosTopicId
    if (!prevTopic || currTopic !== prevTopic) continue

    let j = i + 1
    while (j < q.length && q[j].card.tosTopicId === prevTopic) {
      j++
    }
    if (j < q.length) {
      ;[q[i], q[j]] = [q[j], q[i]]
    }
  }
  return q
}

/** Survival ramp: pull the remaining card closest to the streak's target weight into position `from`, avoiding recent topics if possible. */
function rampNext(queue: QueueItem[], from: number, streak: number, excludeTopics: string[] = []): QueueItem[] {
  const remaining = queue.slice(from)
  if (remaining.length <= 1) return queue

  const items = remaining.map((q, idx) => ({
    weight: q.weight,
    origIdx: idx,
    excluded:
      excludeTopics.length > 0 &&
      !!q.card.tosTopicId &&
      excludeTopics.includes(q.card.tosTopicId),
  }))

  const nonExcluded = items.filter(it => !it.excluded)
  const pool = nonExcluded.length > 0 ? nonExcluded : items

  const pickedPoolIdx = pickNextIndex(
    pool.map(it => it.weight),
    streak
  )
  const actualRelIdx = pool[pickedPoolIdx]?.origIdx ?? 0

  if (actualRelIdx > 0) {
    const q = [...queue]
    ;[q[from], q[from + actualRelIdx]] = [q[from + actualRelIdx], q[from]]
    return q
  }
  return queue
}

function buildRequests(config: GauntletConfig): Array<{ subject: Subject; count: number }> {
  if (config.mode === 'timed' && !config.unlimitedItems) {
    const counts =
      config.allocation === 'custom'
        ? config.customCounts
        : allocateCounts(config.totalItems, config.subjects, config.allocation)
    return config.subjects.map(subject => ({ subject, count: counts[subject] ?? 0 })).filter(r => r.count > 0)
  }
  const per = Math.ceil(SURVIVAL_BATCH / Math.max(1, config.subjects.length))
  return config.subjects.map(subject => ({ subject, count: per }))
}

const freshRun = () => ({
  config: DEFAULT_CONFIG,
  rated: false,
  queue: [] as QueueItem[],
  index: 0,
  answers: [] as AnswerRecord[],
  score: 0,
  streak: 0,
  bestStreak: 0,
  skipsAvailable: 1,
  skipEarnStreak: 0,
  lifeBonusStreak: 0,
  livesLeft: 0,
  startedAt: 0,
  durationMs: 0,
  endsAt: null as number | null,
  questionShownAt: 0,
  pausedAt: null as number | null,
  ratingsBefore: defaultRatings(),
  ratings: defaultRatings(),
  feedback: null as Feedback | null,
  endReason: null as EndReason | null,
  savedRunId: null as string | null,
  saveError: null as string | null,
  isRefilling: false,
  refillExhausted: false,
})

type RunState = ReturnType<typeof freshRun>

interface GauntletStore extends RunState {
  phase: GauntletPhase
  loadError: string | null
  hub: HubData | null
  setupMode: GauntletMode | null
  setupPrefill: Partial<GauntletConfig> | null
  openSetup: (mode: GauntletMode, prefill?: Partial<GauntletConfig>) => void
  closeSetup: () => void
  loadHub: () => Promise<void>
  startRun: (config: GauntletConfig) => Promise<void>
  beginRun: () => void
  cancelCountdown: () => void
  pauseRun: () => void
  resumeRun: () => void
  answer: (choiceIndex: number) => void
  skip: () => void
  extendLinger: (deltaMs: number) => void
  timeoutCurrent: () => void
  expire: () => void
  quit: () => void
  backToHome: () => Promise<void>
  backToHub: () => Promise<void>
  resetToHome: () => void
}

export function buildRunPayload(s: RunState, reason: EndReason, endedAt: number) {
  const breakdown: Record<string, { answered: number; correct: number; wrong: number; skipped: number; points: number }> = {}
  let correct = 0
  let wrong = 0
  let skipped = 0
  for (const a of s.answers) {
    if (!breakdown[a.item.subject]) breakdown[a.item.subject] = { answered: 0, correct: 0, wrong: 0, skipped: 0, points: 0 }
    const b = breakdown[a.item.subject]
    b.answered++
    b.points += a.points
    if (a.outcome === 'correct') { b.correct++; correct++ }
    else if (a.outcome === 'skipped') { b.skipped++; skipped++ }
    else { b.wrong++; wrong++ } // wrong + timeout
  }
  const activeSubs = GAUNTLET_SUBJECTS.filter(
    sub => s.config.subjects.includes(sub) || (s.ratings[sub]?.rating !== s.ratingsBefore[sub]?.rating)
  )
  const pick = (r: Record<Subject, SubjectRating>) =>
    Object.fromEntries(activeSubs.map(sub => [sub, { rating: r[sub].rating, answers: r[sub].answers }]))
  const rawDuration = endedAt - s.startedAt
  const durationMs = Math.max(
    0,
    Math.round(s.config.mode === 'timed' ? Math.min(rawDuration, s.config.durationSec * 1000) : rawDuration),
  )
  return {
    id: newId(),
    startedAt: s.startedAt,
    endedAt,
    mode: s.config.mode,
    config: s.config,
    rated: s.rated,
    score: s.score,
    answered: s.answers.length,
    correct,
    wrong,
    skipped,
    bestStreak: s.bestStreak,
    durationMs,
    endReason: reason,
    ratingsBefore: s.rated ? pick(s.ratingsBefore) : undefined,
    ratingsAfter: s.rated ? pick(s.ratings) : undefined,
    subjectBreakdown: breakdown,
    answers: s.answers.map(a => ({
      seq: a.seq,
      cardId: a.item.card.id,
      subject: a.item.subject,
      chosen: a.chosen,
      answerIndex: (a.item.card.data as MCQData).answer,
      outcome: a.outcome,
      timeMs: a.timeMs,
      parMs: a.item.parMs,
      points: a.points,
      streakAfter: a.streakAfter,
      choices: (a.item.card.data as MCQData).choices,
      answeredAt: a.answeredAt,
    })),
  }
}

const SUMMARY_STORAGE_KEY = 'ecengine_gauntlet_summary_snapshot'

export function saveSummarySnapshot(state: Partial<GauntletStore>): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify({
        phase: 'summary',
        answers: state.answers,
        config: state.config,
        score: state.score,
        streak: state.streak,
        bestStreak: state.bestStreak,
        durationMs: state.durationMs,
        startedAt: state.startedAt,
        ratingsBefore: state.ratingsBefore,
        ratings: state.ratings,
        endReason: state.endReason,
        rated: state.rated,
        queue: state.queue,
        index: state.index,
        savedRunId: state.savedRunId,
      }))
    }
  } catch {}
}

export function clearSummarySnapshot(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SUMMARY_STORAGE_KEY)
    }
  } catch {}
}

export function loadSummarySnapshot(): Partial<GauntletStore> | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(SUMMARY_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.phase === 'summary' && Array.isArray(parsed.answers)) {
          return parsed
        }
      }
    }
  } catch {}
  return null
}

export const useGauntletStore = create<GauntletStore>((set, get) => {
  const finish = async (reason: EndReason): Promise<void> => {
    const s = get()
    if (s.phase !== 'playing') return
    const endedAt = Date.now()
    const rawDuration = s.startedAt > 0 ? endedAt - s.startedAt : 0
    const durationMs = Math.max(
      0,
      Math.round(s.config.mode === 'timed' ? Math.min(rawDuration, s.config.durationSec * 1000) : rawDuration),
    )
    const summaryUpdate = { phase: 'summary' as const, endReason: reason, pausedAt: null, durationMs }
    set(summaryUpdate)
    saveSummarySnapshot({ ...get(), ...summaryUpdate })
    if (s.answers.length === 0) return
    const payload = buildRunPayload(s, reason, endedAt)
    try {
      await gauntletService.saveRun(payload)
      set({ savedRunId: payload.id })
      saveSummarySnapshot({ ...get(), savedRunId: payload.id })
      // Track Gauntlet session duration as study time for the activity heatmap.
      // durationMs is the actual played time (excludes pauses in survival mode).
      const minutes = payload.durationMs / 60_000
      if (minutes > 0) dbService.updateTimeSpent(minutes).catch(console.error)
    } catch (e) {
      set({ saveError: (e as Error).message })
    }
  }

  const refill = async (): Promise<void> => {
    const s = get()
    const isStreamMode = s.config.mode === 'survival' || (s.config.mode === 'timed' && !!s.config.unlimitedItems)
    if (s.phase !== 'playing' || s.pausedAt !== null || !isStreamMode || s.isRefilling || s.refillExhausted) return
    set({ isRefilling: true })
    let items: QueueItem[] = []
    try {
      const topicIds = s.config.tosTopicIds?.length
        ? s.config.tosTopicIds
        : s.config.tosTopicId
          ? [s.config.tosTopicId]
          : undefined
      const reqArgs: [any, any, any?, any?, any?] = [buildRequests(s.config), s.queue.map(q => q.card.id)]
      if (s.config.allowSolutions || s.config.tosTopicId || topicIds) {
        reqArgs.push(s.config.allowSolutions ?? false)
        reqArgs.push(s.config.tosTopicId ?? undefined)
        reqArgs.push(topicIds)
      }
      const cards = await (gauntletService.getQuestions as any)(...reqArgs)
      items = spaceByTopic(shuffle(cards.map(toQueueItem)))
    } catch {
      items = []
    }
    const cur = get()
    if (cur.phase !== 'playing') {
      set({ isRefilling: false })
      return
    }
    const waiting = cur.index >= cur.queue.length
    let queue = spaceByTopic([...cur.queue, ...items], cur.index)
    if (waiting && items.length > 0) {
      const recentTopics = cur.answers
        .slice(-3)
        .map(a => a.item.card.tosTopicId)
        .filter((id): id is string => Boolean(id))
      queue = rampNext(queue, cur.index, cur.streak, recentTopics)
    }
    set({
      queue,
      isRefilling: false,
      refillExhausted: items.length === 0,
      ...(waiting && items.length > 0 ? { questionShownAt: Date.now() } : {}),
    })
    if (waiting && items.length === 0) void finish('queue')
  }

  const commit = (kind: 'answer' | 'skip' | 'timeout', chosen: number | null): void => {
    const s = get()
    if (s.phase !== 'playing' || s.pausedAt !== null) return
    if (kind === 'skip' && s.skipsAvailable <= 0) return
    const item = s.queue[s.index]
    if (!item) return
    const now = Date.now()
    if (s.endsAt !== null && now > s.endsAt) {
      void finish('time')
      return
    }
    if (kind !== 'timeout' && now - s.questionShownAt < MIN_ANSWER_MS) return

    const correctIndex = (item.card.data as MCQData).answer
    const outcome: AnswerOutcome =
      kind === 'skip' ? 'skipped' : kind === 'timeout' ? 'timeout' : chosen === correctIndex ? 'correct' : 'wrong'
    const timeMs =
      kind === 'timeout'
        ? (s.config.mode === 'timed' ? TIMED_QUESTION_CAP_SEC * 1000 : s.config.perQuestionSec * 1000)
        : Math.max(0, now - s.questionShownAt)

    const nextSkipState = updateSkipState(
      { skipsAvailable: s.skipsAvailable, skipEarnStreak: s.skipEarnStreak },
      kind === 'skip' ? 'use_skip' : outcome === 'correct' ? 'correct' : 'wrong',
    )

    const survival = s.config.mode === 'survival'
    let { scoreMult, eloMult } = survival
      ? getSurvivalDifficultyMultiplier(s.config.perQuestionSec, s.config.lives)
      : { scoreMult: 1, eloMult: 1 }

    const hasTopicFilter = (s.config.tosTopicIds && s.config.tosTopicIds.length > 0) || !!s.config.tosTopicId
    if (hasTopicFilter) {
      eloMult = eloMult * 0.4
    }

    const startRating = s.ratingsBefore[item.subject]?.rating ?? TUNING.startRating
    const currentRating = s.ratings[item.subject]?.rating ?? TUNING.startRating

    // For Time Trial (timed mode):
    // - Positive rating gains: scale against dynamic in-session virtual rating (diminishing returns as you drill)
    // - Negative penalties: anchor against the actual current rank/rating at the start of the session
    const isTimedMode = s.config.mode === 'timed'
    const isInsulator = isTimedMode ? startRating < 850 : currentRating < 850

    const res = scoreAnswer({
      outcome,
      timeMs,
      parMs: item.parMs,
      weight: item.weight,
      streakBefore: s.streak,
      scoreMult,
      isInsulator,
    })
    const ratings = { ...s.ratings }
    if (s.rated) {
      let evalPlayerRating = currentRating
      if (isTimedMode) {
        if (outcome === 'correct') {
          const subjectCorrectInSession = s.answers.filter(
            a => a.item.subject === item.subject && a.outcome === 'correct',
          ).length
          evalPlayerRating = computeTimedVirtualRating(currentRating, subjectCorrectInSession)
        } else {
          evalPlayerRating = startRating
        }
      }

      const dynamicOpponentRating = cardRating(evalPlayerRating, item.weight)
      const partnerSubject = getSharedTopicPartnerSubject(
        item.subject,
        item.card.tosTopicId,
        item.card.tags,
      )

      if (partnerSubject) {
        // Shared topic: Calculate standard card delta once, then apply 50% (+Δ/2 or -Δ/2) to both subjects
        const fullDelta = computeAnswerEloDelta(
          evalPlayerRating,
          dynamicOpponentRating,
          s.ratings[item.subject]?.answers ?? 0,
          outcome,
          res.speedNorm,
          eloMult,
        )
        const halfDelta = fullDelta * 0.5

        // Primary subject receives half delta + incremented answer count
        const primaryCur = s.ratings[item.subject] ?? defaultRating()
        ratings[item.subject] = {
          rating: Math.max(500, Math.round((primaryCur.rating + halfDelta) * 10) / 10),
          answers: primaryCur.answers + 1,
        }

        // Partner subject receives half delta, answer count preserved
        const partnerCur = s.ratings[partnerSubject] ?? defaultRating()
        ratings[partnerSubject] = {
          rating: Math.max(500, Math.round((partnerCur.rating + halfDelta) * 10) / 10),
          answers: partnerCur.answers,
        }
      } else {
        const delta = computeAnswerEloDelta(
          evalPlayerRating,
          dynamicOpponentRating,
          s.ratings[item.subject]?.answers ?? 0,
          outcome,
          res.speedNorm,
          eloMult,
        )
        const cur = s.ratings[item.subject] ?? defaultRating()
        ratings[item.subject] = {
          rating: Math.max(500, Math.round((cur.rating + delta) * 10) / 10),
          answers: cur.answers + 1,
        }
      }
    }

    const record: AnswerRecord = {
      seq: s.answers.length,
      item,
      chosen: kind === 'answer' ? chosen : null,
      outcome,
      timeMs: Math.round(timeMs),
      points: res.points,
      streakAfter: res.streakAfter,
      answeredAt: now,
      streakBonus: res.streakBonus,
    }
    let nextLifeBonusStreak = s.lifeBonusStreak
    let livesLeft = s.livesLeft
    let lifeBonusAwarded = false

    if (survival) {
      if (outcome === 'correct') {
        const streakBonus = updateLifeBonusState({ streak: s.lifeBonusStreak }, 'correct')
        nextLifeBonusStreak = streakBonus.streak
        let bonusLives = streakBonus.awardLife ? streakBonus.awarded : 0

        const prevCorrect = s.answers.filter(a => a.outcome === 'correct').length
        const nextCorrect = prevCorrect + 1
        const scoreBonusAwarded = isScoreLifeBonus(nextCorrect)
        if (scoreBonusAwarded) {
          bonusLives += 1
        }

        if (streakBonus.awardLife || scoreBonusAwarded) {
          lifeBonusAwarded = true
        }

        if (bonusLives > 0) {
          livesLeft = s.config.lives === 0 ? 0 : livesLeft + bonusLives
        }
      } else if (outcome === 'wrong' || outcome === 'timeout') {
        const bonus = updateLifeBonusState({ streak: s.lifeBonusStreak }, outcome)
        nextLifeBonusStreak = bonus.streak
        if (s.config.lives > 0) {
          livesLeft = livesLeft - 1
        }
      }
    }

    const nextIndex = s.index + 1
    const recentTopics = [...s.answers, record]
      .slice(-3)
      .map(a => a.item.card.tosTopicId)
      .filter((id): id is string => Boolean(id))
    const queue = survival ? rampNext(s.queue, nextIndex, res.streakAfter, recentTopics) : s.queue

    set({
      answers: [...s.answers, record],
      score: s.score + res.points,
      streak: res.streakAfter,
      bestStreak: Math.max(s.bestStreak, res.streakAfter),
      skipsAvailable: nextSkipState.skipsAvailable,
      skipEarnStreak: nextSkipState.skipEarnStreak,
      lifeBonusStreak: nextLifeBonusStreak,
      livesLeft,
      ratings,
      queue,
      index: nextIndex,
      questionShownAt: now,
      feedback: {
        id: record.seq + 1,
        outcome,
        points: res.points,
        streak: res.streakAfter,
        streakMult: res.streakMult,
        fastWrong: res.fastWrong,
        lifeBonus: lifeBonusAwarded,
        streakBonus: res.streakBonus,
      },
    })

    if (survival && s.config.lives > 0 && livesLeft <= 0) {
      void finish('lives')
      return
    }
    const isStreamMode = survival || (s.config.mode === 'timed' && !!s.config.unlimitedItems)
    if (nextIndex >= queue.length) {
      if (!isStreamMode || s.refillExhausted) {
        void finish('queue')
      } else {
        void refill() // waits for more questions; refill() ends the run if none are left
      }
      return
    }
    if (isStreamMode && queue.length - nextIndex <= REFILL_THRESHOLD) void refill()
  }

  const initialSnapshot = loadSummarySnapshot()

  return {
    phase: (initialSnapshot?.phase as GauntletPhase) || 'home',
    loadError: null,
    hub: null,
    setupMode: null,
    setupPrefill: null,
    ...freshRun(),
    ...(initialSnapshot ?? {}),

    openSetup: (mode, prefill) => {
      clearSummarySnapshot()
      set({ phase: 'setup', setupMode: mode, setupPrefill: prefill ?? null })
    },
    closeSetup: () => set({ phase: 'home', setupMode: null, setupPrefill: null }),

    loadHub: async () => {
      try {
        const [ratingRows, poolSizes, bests, runs, pace] = await Promise.all([
          gauntletService.getRatings(),
          gauntletService.getPoolSizes(),
          gauntletService.getBests(),
          gauntletService.getRuns({ limit: 10 }),
          gauntletService.getPaceStats(),
        ])
        const peaks: Partial<Record<Subject, number>> = {}
        for (const r of ratingRows) if (r.peak != null) peaks[r.subject as Subject] = r.peak
        set({ hub: { ratings: ratingsToMap(ratingRows), peaks, poolSizes, bests, runs, pace } })
      } catch (e) {
        set({ loadError: (e as Error).message })
      }
    },

    startRun: async input => {
      clearSummarySnapshot()
      const config = normalizeConfig(input)
      if (config.subjects.length === 0) {
        set({ loadError: 'Pick at least one subject.' })
        return
      }
      set({ phase: 'loading', loadError: null })
      try {
        const ratings = ratingsToMap(await gauntletService.getRatings())
        const requests = buildRequests(config)
        if (requests.length === 0) throw new Error('No items requested.')
        const topicIds = config.tosTopicIds?.length
          ? config.tosTopicIds
          : config.tosTopicId
            ? [config.tosTopicId]
            : undefined
        const reqArgs: [any, any, any?, any?, any?] = [requests, []]
        if (config.allowSolutions || config.tosTopicId || topicIds) {
          reqArgs.push(config.allowSolutions ?? false)
          reqArgs.push(config.tosTopicId ?? undefined)
          reqArgs.push(topicIds)
        }
        const cards: GauntletCard[] = await (gauntletService.getQuestions as any)(...reqArgs)
        let queue = spaceByTopic(shuffle(cards.map(toQueueItem)))
        if (queue.length === 0) throw new Error('No questions available for the selected subjects.')
        if (config.mode === 'survival') queue = rampNext(queue, 0, 0)
        set({
          ...freshRun(),
          phase: 'countdown',
          config,
          rated: config.rated && isRatedRun({ subjects: config.subjects }),
          queue,
          index: 0,
          livesLeft: config.lives,
          lifeBonusStreak: 0,
          startedAt: 0,
          endsAt: null,
          questionShownAt: 0,
          ratingsBefore: ratings,
          ratings,
          pausedAt: null,
        })
      } catch (e) {
        set({ phase: get().setupMode ? 'setup' : 'home', loadError: (e as Error).message })
      }
    },

    beginRun: () => {
      const s = get()
      if (s.phase !== 'countdown') return
      const now = Date.now()
      set({
        phase: 'playing',
        startedAt: now,
        endsAt: s.config.mode === 'timed' ? now + s.config.durationSec * 1000 : null,
        questionShownAt: now,
        pausedAt: null,
      })
    },

    cancelCountdown: () => {
      set({ ...freshRun(), phase: 'setup' })
    },

    pauseRun: () => {
      const s = get()
      if (s.phase !== 'playing' || s.pausedAt !== null) return
      set({ pausedAt: Date.now() })
    },

    resumeRun: () => {
      const s = get()
      if (s.phase !== 'playing' || s.pausedAt === null) return
      const delta = Date.now() - s.pausedAt
      set({
        endsAt: s.endsAt !== null ? s.endsAt + delta : null,
        questionShownAt: s.questionShownAt + delta,
        pausedAt: null,
      })
    },

    answer: choiceIndex => commit('answer', choiceIndex),
    skip: () => commit('skip', null),
    extendLinger: deltaMs => {
      const s = get()
      if (s.phase !== 'playing' || s.pausedAt !== null) return
      set({
        endsAt: s.endsAt !== null ? s.endsAt + deltaMs : null,
        questionShownAt: s.questionShownAt + deltaMs,
      })
    },
    timeoutCurrent: () => commit('timeout', null),

    expire: () => {
      const s = get()
      if (s.phase !== 'playing' || s.pausedAt !== null || s.endsAt === null) return
      if (Date.now() < s.endsAt - 50) return
      void finish('time')
    },

    quit: () => {
      const s = get()
      if (s.phase !== 'playing') return
      if (s.answers.length === 0) void get().backToHome()
      else void finish('quit')
    },

    backToHome: async () => {
      clearSummarySnapshot()
      set({ ...freshRun(), phase: 'home', loadError: null, setupMode: null, pausedAt: null })
      await get().loadHub()
    },

    backToHub: async () => {
      await get().backToHome()
    },

    resetToHome: () => {
      clearSummarySnapshot()
      set({ ...freshRun(), phase: 'home', loadError: null, setupMode: null, pausedAt: null })
    },
  }
})

/** Test helper: reset to a clean home state without touching services. */
export function resetGauntletStore(): void {
  clearSummarySnapshot()
  useGauntletStore.setState({
    phase: 'home',
    loadError: null,
    hub: null,
    setupMode: null,
    setupPrefill: null,
    ...freshRun(),
  })
}

export const selectCurrentItem = (s: { queue: QueueItem[]; index: number }): QueueItem | null => s.queue[s.index] ?? null
