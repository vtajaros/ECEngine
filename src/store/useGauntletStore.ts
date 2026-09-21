// src/store/useGauntletStore.ts
// Gauntlet run engine. Separate from useSessionStore / progress / mastery by design.
import { create } from 'zustand'
import type { MCQData, Subject } from '../types'
import { gauntletService, type GauntletCard } from '../services/gauntlet.service'
import { shuffle, shuffleChoices, isSafeToShuffleChoices } from '../lib/scrambler'
import {
  GAUNTLET_SUBJECTS,
  allocateCounts,
  applyAnswerToRating,
  cardRating,
  defaultRating,
  difficultyWeight,
  estimateParMs,
  extractFeatures,
  isRatedRun,
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
}

/** Transient result of the last answer, for instant-check effects (does NOT reveal the correct choice). */
export interface Feedback {
  id: number
  outcome: AnswerOutcome
  points: number
  streak: number
  streakMult: number
  fastWrong: boolean
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
    lives: clampInt(c.lives, 1, 10),
    perQuestionSec: clampInt(c.perQuestionSec, 5, 300),
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

/** Survival ramp: pull the remaining card closest to the streak's target weight into position `from`. */
function rampNext(queue: QueueItem[], from: number, streak: number): QueueItem[] {
  const remaining = queue.slice(from)
  const i = pickNextIndex(remaining.map(q => q.weight), streak)
  if (i > 0) {
    const q = [...queue]
    ;[q[from], q[from + i]] = [q[from + i], q[from]]
    return q
  }
  return queue
}

function buildRequests(config: GauntletConfig): Array<{ subject: Subject; count: number }> {
  if (config.mode === 'timed') {
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
  openSetup: (mode: GauntletMode) => void
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
  const pick = (r: Record<Subject, SubjectRating>) =>
    Object.fromEntries(s.config.subjects.map(sub => [sub, { rating: r[sub].rating, answers: r[sub].answers }]))
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

export const useGauntletStore = create<GauntletStore>((set, get) => {
  const finish = async (reason: EndReason): Promise<void> => {
    const s = get()
    if (s.phase !== 'playing') return
    const endedAt = Date.now()
    set({ phase: 'summary', endReason: reason, pausedAt: null })
    if (s.answers.length === 0) return
    const payload = buildRunPayload(s, reason, endedAt)
    try {
      await gauntletService.saveRun(payload)
      set({ savedRunId: payload.id })
    } catch (e) {
      set({ saveError: (e as Error).message })
    }
  }

  const refill = async (): Promise<void> => {
    const s = get()
    if (s.phase !== 'playing' || s.pausedAt !== null || s.config.mode !== 'survival' || s.isRefilling || s.refillExhausted) return
    set({ isRefilling: true })
    let items: QueueItem[] = []
    try {
      const cards = await gauntletService.getQuestions(
        buildRequests(s.config),
        s.queue.map(q => q.card.id),
      )
      items = shuffle(cards.map(toQueueItem))
    } catch {
      items = []
    }
    const cur = get()
    if (cur.phase !== 'playing') {
      set({ isRefilling: false })
      return
    }
    const waiting = cur.index >= cur.queue.length
    let queue = [...cur.queue, ...items]
    if (waiting && items.length > 0) queue = rampNext(queue, cur.index, cur.streak)
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
    const timeMs = kind === 'timeout' ? s.config.perQuestionSec * 1000 : Math.max(0, now - s.questionShownAt)

    const nextSkipState = updateSkipState(
      { skipsAvailable: s.skipsAvailable, skipEarnStreak: s.skipEarnStreak },
      kind === 'skip' ? 'use_skip' : outcome === 'correct' ? 'correct' : 'wrong',
    )

    const res = scoreAnswer({ outcome, timeMs, parMs: item.parMs, weight: item.weight, streakBefore: s.streak })
    const ratings = { ...s.ratings }
    if (s.rated) {
      ratings[item.subject] = applyAnswerToRating(ratings[item.subject], item.cardRating, outcome, res.speedNorm)
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
    }
    const survival = s.config.mode === 'survival'
    let nextLifeBonusStreak = s.lifeBonusStreak
    let livesLeft = s.livesLeft

    if (survival) {
      if (outcome === 'correct') {
        const bonus = updateLifeBonusState({ streak: s.lifeBonusStreak }, 'correct')
        nextLifeBonusStreak = bonus.streak
        if (bonus.awardLife) {
          livesLeft = Math.min(s.config.lives, livesLeft + bonus.awarded)
        }
      } else if (outcome === 'wrong' || outcome === 'timeout') {
        const bonus = updateLifeBonusState({ streak: s.lifeBonusStreak }, outcome)
        nextLifeBonusStreak = bonus.streak
        livesLeft = livesLeft - 1
      }
    }

    const nextIndex = s.index + 1
    const queue = survival ? rampNext(s.queue, nextIndex, res.streakAfter) : s.queue

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
      },
    })

    if (survival && livesLeft <= 0) {
      void finish('lives')
      return
    }
    if (nextIndex >= queue.length) {
      if (!survival || s.refillExhausted) {
        void finish('queue')
      } else {
        void refill() // waits for more questions; refill() ends the run if none are left
      }
      return
    }
    if (survival && queue.length - nextIndex <= REFILL_THRESHOLD) void refill()
  }

  return {
    phase: 'home',
    loadError: null,
    hub: null,
    setupMode: null,
    ...freshRun(),

    openSetup: mode => set({ phase: 'setup', setupMode: mode }),
    closeSetup: () => set({ phase: 'home', setupMode: null }),

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
        const cards = await gauntletService.getQuestions(requests, [])
        let queue = shuffle(cards.map(toQueueItem))
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
      set({ ...freshRun(), phase: 'home', loadError: null, setupMode: null, pausedAt: null })
      await get().loadHub()
    },

    backToHub: async () => {
      await get().backToHome()
    },

    resetToHome: () => {
      set({ ...freshRun(), phase: 'home', loadError: null, setupMode: null, pausedAt: null })
    },
  }
})

/** Test helper: reset to a clean home state without touching services. */
export function resetGauntletStore(): void {
  useGauntletStore.setState({
    phase: 'home',
    loadError: null,
    hub: null,
    setupMode: null,
    ...freshRun(),
  })
}

export const selectCurrentItem = (s: { queue: QueueItem[]; index: number }): QueueItem | null => s.queue[s.index] ?? null
