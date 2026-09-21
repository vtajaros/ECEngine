import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Subject } from '../types'
import type { GauntletCard } from '../services/gauntlet.service'
import { gauntletService } from '../services/gauntlet.service'
import { useGauntletStore, resetGauntletStore, DEFAULT_CONFIG, type GauntletConfig } from './useGauntletStore'

vi.mock('../services/gauntlet.service', () => ({
  gauntletService: {
    getRatings: vi.fn(),
    getQuestions: vi.fn(),
    saveRun: vi.fn(),
    getPoolSizes: vi.fn(),
    getBests: vi.fn(),
    getRuns: vi.fn(),
    getPaceStats: vi.fn(),
  },
}))

vi.mock('../lib/scrambler', () => ({
  shuffle: <T,>(a: T[]) => [...a],
  shuffleChoices: (choices: string[], answer: number, plain?: boolean[]) => ({ choices, answer, choicesPlainText: plain }),
  isSafeToShuffleChoices: () => true,
}))

const svc = vi.mocked(gauntletService)
const store = () => useGauntletStore.getState()
const flush = () => vi.advanceTimersByTimeAsync(0)

function makeCard(id: string, subject: Subject, answer = 0): GauntletCard {
  return {
    id,
    topicId: 't1',
    type: 'mcq',
    data: { question: 'What is the answer to this question?', choices: ['a', 'b', 'c', 'd'], answer, explanation: '' },
    difficulty: 'medium',
    tags: [],
    isCustom: false,
    createdAt: '',
    subjectCode: subject,
  } as unknown as GauntletCard
}

const cards = (n: number, subject: Subject = 'MATH', prefix = 'c') =>
  Array.from({ length: n }, (_, i) => makeCard(`${prefix}${i}`, subject))

const timedCfg = (over: Partial<GauntletConfig> = {}): GauntletConfig => ({
  ...DEFAULT_CONFIG, mode: 'timed', subjects: ['MATH'], totalItems: 2, allocation: 'even', durationSec: 300, ...over,
})
const survivalCfg = (over: Partial<GauntletConfig> = {}): GauntletConfig => ({
  ...DEFAULT_CONFIG, mode: 'survival', subjects: ['MATH'], lives: 2, perQuestionSec: 30, ...over,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_700_000_000_000)
  vi.clearAllMocks()
  resetGauntletStore()
  svc.getRatings.mockResolvedValue([])
  svc.saveRun.mockResolvedValue(undefined)
  svc.getPoolSizes.mockResolvedValue({ MATH: 10, GEAS: 10, ELECS: 10, EST: 10 })
  svc.getBests.mockResolvedValue([])
  svc.getRuns.mockResolvedValue([])
  svc.getPaceStats.mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('phases, setup and navigation', () => {
  it('opens and closes setup mode', () => {
    expect(store().phase).toBe('home')
    expect(store().setupMode).toBeNull()

    store().openSetup('survival')
    expect(store().phase).toBe('setup')
    expect(store().setupMode).toBe('survival')

    store().closeSetup()
    expect(store().phase).toBe('home')
    expect(store().setupMode).toBeNull()
  })

  it('resets to home cleanly with resetToHome', () => {
    store().openSetup('timed')
    store().resetToHome()
    expect(store().phase).toBe('home')
    expect(store().setupMode).toBeNull()
  })
})

describe('startRun and countdown', () => {
  it('ends in countdown with no clocks started', async () => {
    svc.getQuestions.mockResolvedValue([...cards(2, 'MATH', 'm'), ...cards(2, 'ELECS', 'e')])
    await store().startRun(timedCfg({ subjects: ['MATH', 'ELECS'], totalItems: 4 }))
    expect(svc.getQuestions).toHaveBeenCalledWith(
      [{ subject: 'MATH', count: 2 }, { subject: 'ELECS', count: 2 }],
      [],
    )
    expect(store().phase).toBe('countdown')
    expect(store().queue).toHaveLength(4)
    expect(store().startedAt).toBe(0)
    expect(store().endsAt).toBeNull()
    expect(store().questionShownAt).toBe(0)
  })

  it('beginRun transitions to playing and starts clocks', async () => {
    svc.getQuestions.mockResolvedValue(cards(2))
    await store().startRun(timedCfg())
    expect(store().phase).toBe('countdown')

    store().beginRun()
    expect(store().phase).toBe('playing')
    expect(store().startedAt).toBe(1_700_000_000_000)
    expect(store().endsAt).toBe(1_700_000_000_000 + 300_000)
    expect(store().questionShownAt).toBe(1_700_000_000_000)
  })

  it('cancelCountdown returns to setup and discards queue', async () => {
    svc.getQuestions.mockResolvedValue(cards(2))
    await store().startRun(timedCfg())
    expect(store().phase).toBe('countdown')

    store().cancelCountdown()
    expect(store().phase).toBe('setup')
    expect(store().queue).toHaveLength(0)
  })

  it('returns with an error when no questions exist', async () => {
    svc.getQuestions.mockResolvedValue([])
    await store().startRun(timedCfg())
    expect(store().phase).toBe('home')
    expect(store().loadError).toMatch(/No questions/)
  })

  it('rejects an empty subject selection', async () => {
    await store().startRun(timedCfg({ subjects: [] }))
    expect(store().loadError).toMatch(/at least one subject/i)
    expect(svc.getQuestions).not.toHaveBeenCalled()
  })
})

describe('pause and resume', () => {
  it('pause blocks answers, skip, timeout, and expire', async () => {
    svc.getQuestions.mockResolvedValue(cards(3))
    await store().startRun(timedCfg({ totalItems: 3 }))
    store().beginRun()

    store().pauseRun()
    expect(store().pausedAt).toBe(1_700_000_000_000)

    vi.advanceTimersByTime(2000)
    store().answer(0)
    store().skip()
    store().timeoutCurrent()
    store().expire()

    expect(store().answers).toHaveLength(0)
    expect(store().phase).toBe('playing')
  })

  it('resume shifts endsAt and questionShownAt by the paused duration', async () => {
    svc.getQuestions.mockResolvedValue(cards(3))
    await store().startRun(timedCfg({ totalItems: 3, durationSec: 300 }))
    store().beginRun()

    const initialEndsAt = store().endsAt!
    const initialQuestionShown = store().questionShownAt

    // Play for 2 seconds
    vi.advanceTimersByTime(2000)
    store().pauseRun()

    // Paused for 5 seconds
    vi.advanceTimersByTime(5000)
    store().resumeRun()

    expect(store().pausedAt).toBeNull()
    expect(store().endsAt).toBe(initialEndsAt + 5000)
    expect(store().questionShownAt).toBe(initialQuestionShown + 5000)
  })
})

describe('answering', () => {
  it('scores a correct answer, advances and sets feedback', async () => {
    svc.getQuestions.mockResolvedValue(cards(3))
    await store().startRun(timedCfg({ totalItems: 3 }))
    store().beginRun()
    vi.advanceTimersByTime(2000)
    store().answer(0)
    expect(store().score).toBeGreaterThan(0)
    expect(store().streak).toBe(1)
    expect(store().index).toBe(1)
    expect(store().feedback?.outcome).toBe('correct')
  })

  it('ignores an answer that arrives inside the input lock window', async () => {
    svc.getQuestions.mockResolvedValue(cards(3))
    await store().startRun(timedCfg({ totalItems: 3 }))
    store().beginRun()
    store().answer(0)
    expect(store().answers).toHaveLength(0)
  })

  it('penalizes a wrong answer and resets the streak', async () => {
    svc.getQuestions.mockResolvedValue(cards(4))
    await store().startRun(timedCfg({ totalItems: 4 }))
    store().beginRun()
    vi.advanceTimersByTime(2000)
    store().answer(0)
    vi.advanceTimersByTime(2000)
    store().answer(1)
    expect(store().streak).toBe(0)
    expect(store().answers[1].points).toBeLessThan(0)
    expect(store().bestStreak).toBe(1)
  })
})

describe('timed run lifecycle', () => {
  it('finishes when the queue is exhausted and saves the run once', async () => {
    svc.getQuestions.mockResolvedValue(cards(2))
    await store().startRun(timedCfg())
    store().beginRun()
    vi.advanceTimersByTime(2000); store().answer(0)
    vi.advanceTimersByTime(2000); store().answer(0)
    await flush()
    expect(store().phase).toBe('summary')
    expect(store().endReason).toBe('queue')
    expect(svc.saveRun).toHaveBeenCalledTimes(1)
    const payload = svc.saveRun.mock.calls[0][0] as any
    expect(payload.mode).toBe('timed')
    expect(payload.answered).toBe(2)
    expect(payload.answers).toHaveLength(2)
    expect(payload.rated).toBe(true)
    expect(payload.ratingsAfter.MATH.answers).toBe(2)
    expect(store().savedRunId).toBe(payload.id)
  })

  it('expires on the clock and ignores unanswered items', async () => {
    svc.getQuestions.mockResolvedValue(cards(5))
    await store().startRun(timedCfg({ totalItems: 5, durationSec: 60 }))
    store().beginRun()
    vi.advanceTimersByTime(2000); store().answer(0)
    vi.advanceTimersByTime(70_000)
    store().expire()
    await flush()
    expect(store().phase).toBe('summary')
    expect(store().endReason).toBe('time')
    expect((svc.saveRun.mock.calls[0][0] as any).answered).toBe(1)
  })

  it('quitting with zero answers returns to the home without saving', async () => {
    svc.getQuestions.mockResolvedValue(cards(3))
    await store().startRun(timedCfg({ totalItems: 3 }))
    store().beginRun()
    store().quit()
    await flush()
    expect(store().phase).toBe('home')
    expect(svc.saveRun).not.toHaveBeenCalled()
  })
})

describe('rating', () => {
  it('updates the subject rating on rated runs', async () => {
    svc.getQuestions.mockResolvedValue(cards(3))
    await store().startRun(timedCfg({ totalItems: 3 }))
    store().beginRun()
    vi.advanceTimersByTime(1500)
    store().answer(0)
    expect(store().ratings.MATH.answers).toBe(1)
    expect(store().ratings.MATH.rating).toBeGreaterThan(1000)
  })

  it('leaves ratings untouched and omits them from the payload on unrated runs', async () => {
    svc.getQuestions.mockResolvedValue(cards(2))
    await store().startRun(timedCfg({ rated: false }))
    store().beginRun()
    vi.advanceTimersByTime(2000); store().answer(0)
    vi.advanceTimersByTime(2000); store().answer(0)
    await flush()
    expect(store().ratings.MATH.rating).toBe(1000)
    const payload = svc.saveRun.mock.calls[0][0] as any
    expect(payload.rated).toBe(false)
    expect(payload.ratingsAfter).toBeUndefined()
  })
})

describe('survival', () => {
  it('ends when lives run out', async () => {
    svc.getQuestions.mockResolvedValue(cards(10))
    await store().startRun(survivalCfg())
    store().beginRun()
    vi.advanceTimersByTime(2000); store().answer(1)
    expect(store().livesLeft).toBe(1)
    expect(store().phase).toBe('playing')
    vi.advanceTimersByTime(2000); store().answer(1)
    await flush()
    expect(store().phase).toBe('summary')
    expect(store().endReason).toBe('lives')
    expect(svc.saveRun).toHaveBeenCalledTimes(1)
  })

  it('a timeout costs a life but a skip does not', async () => {
    svc.getQuestions.mockResolvedValue(cards(10))
    await store().startRun(survivalCfg({ lives: 3 }))
    store().beginRun()
    vi.advanceTimersByTime(2000); store().skip()
    expect(store().livesLeft).toBe(3)
    store().timeoutCurrent()
    expect(store().livesLeft).toBe(2)
    expect(store().answers[1].outcome).toBe('timeout')
    expect(store().streak).toBe(0)
  })

  it('refills near the end of the queue, excluding already-queued cards', async () => {
    svc.getQuestions.mockResolvedValueOnce(cards(3, 'MATH', 'a')).mockResolvedValueOnce(cards(3, 'MATH', 'b'))
    await store().startRun(survivalCfg({ lives: 5 }))
    store().beginRun()
    vi.advanceTimersByTime(2000); store().answer(0)
    await flush()
    expect(svc.getQuestions).toHaveBeenCalledTimes(2)
    const excluded = svc.getQuestions.mock.calls[1][1] as string[]
    expect(excluded.sort()).toEqual(['a0', 'a1', 'a2'])
    expect(store().queue).toHaveLength(6)
  })

  it('ends with reason "queue" when the pool is exhausted', async () => {
    svc.getQuestions.mockResolvedValueOnce(cards(1)).mockResolvedValueOnce([])
    await store().startRun(survivalCfg())
    store().beginRun()
    vi.advanceTimersByTime(2000); store().answer(0)
    await flush()
    expect(store().phase).toBe('summary')
    expect(store().endReason).toBe('queue')
  })
})

describe('credit-gated skips', () => {
  it('initializes with 1 available skip and 0 skip-earn streak', async () => {
    svc.getQuestions.mockResolvedValue(cards(5))
    await store().startRun(timedCfg({ totalItems: 5 }))
    expect(store().skipsAvailable).toBe(1)
    expect(store().skipEarnStreak).toBe(0)
  })

  it('earns a skip credit upon achieving a 20-correct streak', async () => {
    svc.getQuestions.mockResolvedValue(cards(25))
    await store().startRun(timedCfg({ totalItems: 25 }))
    store().beginRun()

    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(2000)
      store().answer(0)
    }

    expect(store().skipEarnStreak).toBe(20)
    expect(store().skipsAvailable).toBe(2) // 1 starting + 1 earned
  })

  it('skip is a no-op when skipsAvailable === 0', async () => {
    svc.getQuestions.mockResolvedValue(cards(5))
    await store().startRun(timedCfg({ totalItems: 5 }))
    store().beginRun()

    // Use initial skip
    vi.advanceTimersByTime(2000)
    store().skip()
    expect(store().skipsAvailable).toBe(0)
    expect(store().answers).toHaveLength(1)
    expect(store().index).toBe(1)

    // Attempt second skip with 0 credits -> no-op
    vi.advanceTimersByTime(2000)
    store().skip()
    expect(store().skipsAvailable).toBe(0)
    expect(store().answers).toHaveLength(1)
    expect(store().index).toBe(1)
  })

  it('using a skip preserves score streak, costs 0 points, and resets skipEarnStreak', async () => {
    svc.getQuestions.mockResolvedValue(cards(10))
    await store().startRun(timedCfg({ totalItems: 10 }))
    store().beginRun()

    // 3 correct answers
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(2000)
      store().answer(0)
    }
    const scoreBefore = store().score
    expect(store().streak).toBe(3)
    expect(store().skipEarnStreak).toBe(3)
    expect(store().skipsAvailable).toBe(1)

    // Use skip
    vi.advanceTimersByTime(2000)
    store().skip()

    expect(store().score).toBe(scoreBefore) // 0 penalty
    expect(store().streak).toBe(3) // streak preserved!
    expect(store().skipsAvailable).toBe(0) // credit consumed
    expect(store().skipEarnStreak).toBe(0) // skip-earn streak reset to 0
    expect(store().answers[3].points).toBe(0)
    expect(store().answers[3].outcome).toBe('skipped')
  })

  it('extendLinger extends endsAt and questionShownAt by deltaMs', async () => {
    svc.getQuestions.mockResolvedValue(cards(5))
    await store().startRun(timedCfg({ totalItems: 5, durationSec: 300 }))
    store().beginRun()

    const endsAtBefore = store().endsAt!
    const shownAtBefore = store().questionShownAt

    store().extendLinger(800)

    expect(store().endsAt).toBe(endsAtBefore + 800)
    expect(store().questionShownAt).toBe(shownAtBefore + 800)
  })
})

describe('life-bonus streak in survival mode', () => {
  it('25-correct streak at 3/3 lives stays capped at 3', async () => {
    svc.getQuestions.mockResolvedValue(cards(40))
    await store().startRun(survivalCfg({ lives: 3 }))
    store().beginRun()

    expect(store().livesLeft).toBe(3)
    expect(store().lifeBonusStreak).toBe(0)

    for (let i = 0; i < 25; i++) {
      vi.advanceTimersByTime(2000)
      store().answer(0)
    }

    expect(store().lifeBonusStreak).toBe(25)
    // Starting lives cap is 3, so livesLeft must not exceed 3
    expect(store().livesLeft).toBe(3)
  })

  it('at 2/3 lives after losing one, a 25-streak brings it back to 3/3', async () => {
    svc.getQuestions.mockResolvedValue(cards(40))
    await store().startRun(survivalCfg({ lives: 3 }))
    store().beginRun()

    // Lose 1 life on wrong answer (answer 1 when correct is 0)
    vi.advanceTimersByTime(2000)
    store().answer(1)
    expect(store().livesLeft).toBe(2)
    expect(store().lifeBonusStreak).toBe(0)

    // Answer 25 correct questions in a row
    for (let i = 0; i < 25; i++) {
      vi.advanceTimersByTime(2000)
      store().answer(0)
    }

    expect(store().lifeBonusStreak).toBe(25)
    expect(store().livesLeft).toBe(3)
  })

  it('wrong answer or timeout resets lifeBonusStreak to 0', async () => {
    svc.getQuestions.mockResolvedValue(cards(40))
    await store().startRun(survivalCfg({ lives: 3 }))
    store().beginRun()

    // 24 correct answers
    for (let i = 0; i < 24; i++) {
      vi.advanceTimersByTime(2000)
      store().answer(0)
    }
    expect(store().lifeBonusStreak).toBe(24)

    // Wrong answer on 25th question
    vi.advanceTimersByTime(2000)
    store().answer(1)
    expect(store().lifeBonusStreak).toBe(0)
    expect(store().livesLeft).toBe(2)

    // Timeout also resets counter
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(2000)
      store().answer(0)
    }
    expect(store().lifeBonusStreak).toBe(5)
    store().timeoutCurrent()
    expect(store().lifeBonusStreak).toBe(0)
    expect(store().livesLeft).toBe(1)
  })

  it('supports 10 lives and unlimited perQuestionSec in survival mode', async () => {
    svc.getQuestions.mockResolvedValue(cards(10))
    await store().startRun(survivalCfg({ lives: 10, perQuestionSec: 0 }))
    store().beginRun()

    expect(store().config.lives).toBe(10)
    expect(store().livesLeft).toBe(10)
    expect(store().config.perQuestionSec).toBe(0)

    const initialRating = store().ratings.MATH.rating
    vi.advanceTimersByTime(2000)
    store().answer(0) // correct

    // Unlimited timer gives +1 rating delta and low score
    expect(store().ratings.MATH.rating).toBe(initialRating + 1)
    expect(store().score).toBeLessThan(15) // small score ~8 points
  })
})

