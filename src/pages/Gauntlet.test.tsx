// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import Gauntlet, { LINGER_CORRECT_MS, LINGER_WRONG_MS, LINGER_SKIP_MS } from './Gauntlet'
import { useGauntletStore, resetGauntletStore } from '../store/useGauntletStore'
import { useLayoutStore } from '../store/useLayoutStore'
import { gauntletService } from '../services/gauntlet.service'
import type { AnswerRecord, QueueItem } from '../store/useGauntletStore'
import type { MCQData, Subject } from '../types'

function renderWithRouter(ui: React.ReactElement) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: ui,
      },
    ],
    {
      initialEntries: ['/'],
    },
  )
  return <RouterProvider router={router} />
}

function createStorageMock(): Storage {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
}

const mockLocal = createStorageMock()
Object.defineProperty(window, 'localStorage', {
  value: mockLocal,
  writable: true,
})
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocal,
  writable: true,
})

// Mock Electron IPC calls and background services
vi.mock('../services/gauntlet.service', () => ({
  gauntletService: {
    getRatings: vi.fn().mockResolvedValue([]),
    getPoolSizes: vi.fn().mockResolvedValue({ MATH: 10, GEAS: 10, ELECS: 10, EST: 10 }),
    getBests: vi.fn().mockResolvedValue([]),
    getRuns: vi.fn().mockResolvedValue([]),
    getPaceStats: vi.fn().mockResolvedValue({}),
    getQuestions: vi.fn().mockResolvedValue([]),
    saveRun: vi.fn().mockResolvedValue({ success: true, id: 'run-123' }),
    getFlaggedQuestions: vi.fn().mockResolvedValue({}),
    flagQuestion: vi.fn().mockResolvedValue(undefined),
    unflagQuestion: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../services/explain.service', () => ({
  getExplanation: vi.fn().mockResolvedValue('Mock AI Explanation'),
}))

const mockPlay = vi.fn()
vi.mock('../hooks/useSound', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useSound')>()
  return {
    ...actual,
    useSound: () => ({
      play: mockPlay,
    }),
  }
})

const mockItem = (id: string, subject: Subject, parMs = 6000): QueueItem => ({
  card: {
    id,
    topicId: 't1',
    type: 'mcq',
    tags: [],
    difficulty: 'medium',
    subjectCode: subject,
    isCustom: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    deckName: 'Algebra Fundamentals',
    cardNumber: 3,
    totalInDeck: 20,
    data: {
      question: `Question for ${id}`,
      choices: ['Choice Alpha', 'Choice Beta', 'Choice Gamma', 'Choice Delta'],
      answer: 1, // Beta is correct
      explanation: `Explanation for ${id}`,
      solutionImagePath: `solutions/${id}.png`,
    } as MCQData,
  },
  subject,
  parMs,
  weight: 1,
  cardRating: 1000,
})

const mockAnswers: AnswerRecord[] = [
  {
    seq: 0,
    item: mockItem('c1', 'MATH', 6000),
    chosen: 1,
    outcome: 'correct',
    timeMs: 4000,
    points: 100,
    streakAfter: 1,
    answeredAt: Date.now(),
  },
  {
    seq: 1,
    item: mockItem('c2', 'MATH', 6000),
    chosen: 0,
    outcome: 'wrong',
    timeMs: 12000, // > 1.5 * 6000 -> SLOW
    points: -50,
    streakAfter: 0,
    answeredAt: Date.now(),
  },
  {
    seq: 2,
    item: mockItem('c3', 'GEAS', 6000),
    chosen: 2,
    outcome: 'wrong',
    timeMs: 1000, // < 0.25 * 6000 -> TOO FAST
    points: -75,
    streakAfter: 0,
    answeredAt: Date.now(),
  },
  {
    seq: 3,
    item: mockItem('c4', 'ELECS', 6000),
    chosen: null,
    outcome: 'skipped',
    timeMs: 1500,
    points: 0,
    streakAfter: 0,
    answeredAt: Date.now(),
  },
]

describe('Gauntlet Summary Review List', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  beforeEach(() => {
    mockPlay.mockClear()
    localStorage.clear()
    resetGauntletStore()
    useLayoutStore.setState({ forceCollapsed: false })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    vi.useRealTimers()
    if (root && container) {
      act(() => {
        root!.unmount()
      })
      container.remove()
      container = null
      root = null
    }
    vi.restoreAllMocks()
  })

  const setupSummaryState = () => {
    useGauntletStore.setState({
      phase: 'summary',
      endReason: 'queue',
      score: 1200,
      streak: 0,
      bestStreak: 3,
      answers: mockAnswers,
      config: {
        mode: 'timed',
        subjects: ['MATH', 'GEAS', 'ELECS', 'EST'],
        rated: false,
        durationSec: 1200,
        totalItems: 4,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })
  }

  it('renders summary review list with all answers and tags (SLOW / TOO FAST)', async () => {
    setupSummaryState()

    await act(async () => {
      root!.render(
        renderWithRouter(<Gauntlet />),
      )
    })

    expect(container?.textContent).toContain('Gauntlet Run Summary')
    expect(container?.textContent).toContain('Answer Review (4/4)')
    expect(container?.textContent).toContain('SLOW')
    expect(container?.textContent).toContain('TOO FAST')
    expect(container?.textContent).toContain('RUN IT BACK')
    expect(container?.textContent).toContain('NEW CONFIG')
    expect(container?.textContent).toContain('BACK TO HOME')
  })

  it('filters answers by outcome tab', async () => {
    setupSummaryState()

    await act(async () => {
      root!.render(
        renderWithRouter(<Gauntlet />),
      )
    })

    // Click "Wrong (2)" button
    const wrongTab = Array.from(container!.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Wrong (2)'),
    )
    expect(wrongTab).toBeTruthy()

    await act(async () => {
      wrongTab!.click()
    })

    expect(container?.textContent).toContain('Answer Review (2/4)')
    expect(container?.textContent).toContain('#2')
    expect(container?.textContent).toContain('#3')
    expect(container?.textContent).not.toContain('#1') // correct one hidden
  })

  it('filters answers by subject chip', async () => {
    setupSummaryState()

    await act(async () => {
      root!.render(
        renderWithRouter(<Gauntlet />),
      )
    })

    // Click "GEAS" chip
    const geasChip = Array.from(container!.querySelectorAll('button')).find(
      b => b.textContent === 'GEAS',
    )
    expect(geasChip).toBeTruthy()

    await act(async () => {
      geasChip!.click()
    })

    expect(container?.textContent).toContain('Answer Review (1/4)')
    expect(container?.textContent).toContain('#3')
  })

  it('expands row to reveal choices, solution, explanation, and bookmark button', async () => {
    setupSummaryState()

    await act(async () => {
      root!.render(
        renderWithRouter(<Gauntlet />),
      )
    })

    // Find and click the first row (#1)
    const row = container!.querySelector('[data-testid="review-row-summary-0"]') as HTMLElement
    expect(row).toBeTruthy()

    await act(async () => {
      row.click()
    })

    expect(container?.textContent).toContain('Algebra Fundamentals')
    expect(container?.textContent).toContain('Card #3 of 20')
    expect(container?.textContent).toContain('Choice Alpha')
    expect(container?.textContent).toContain('Choice Beta')
    expect(container?.textContent).toContain('Explanation for c1')
    expect(container?.textContent).toContain('Solution Diagram')
    expect(container?.textContent).toContain('AI Explain')
    expect(container?.textContent).toContain('Get Context')
  })

  it('copies context template to clipboard and shows toast on Get Context click', async () => {
    setupSummaryState()

    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    await act(async () => {
      root!.render(
        renderWithRouter(<Gauntlet />),
      )
    })

    // Expand row 1
    const row = container!.querySelector('[data-testid="review-row-summary-0"]') as HTMLElement
    await act(async () => {
      row.click()
    })

    // Click Get Context button
    const getContextBtn = Array.from(container!.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Get Context'),
    )
    expect(getContextBtn).toBeTruthy()

    await act(async () => {
      getContextBtn!.click()
    })

    // Verify writeText was called with expected prompt template
    expect(writeTextMock).toHaveBeenCalledTimes(1)
    const textArg = writeTextMock.mock.calls[0][0] as string
    expect(textArg).toContain('QUESTION:\nQuestion for c1')
    expect(textArg).toContain('CHOICES:\nA. Choice Alpha\nB. Choice Beta\nC. Choice Gamma\nD. Choice Delta')
    expect(textArg).toContain('CORRECT ANSWER: B. Choice Beta')
    expect(textArg).toContain('Why the correct answer is right')

    // Verify Toast is shown
    expect(container?.textContent).toContain('Context copied to clipboard — paste into Gemini, ChatGPT, or Claude')
  })

  it('RUN IT BACK calls startRun with existing config and NEW CONFIG calls openSetup', async () => {
    setupSummaryState()

    const startRunSpy = vi.spyOn(useGauntletStore.getState(), 'startRun').mockResolvedValue()
    const openSetupSpy = vi.spyOn(useGauntletStore.getState(), 'openSetup')

    await act(async () => {
      root!.render(
        renderWithRouter(<Gauntlet />),
      )
    })

    const runAgainBtn = Array.from(container!.querySelectorAll('button')).find(b =>
      b.textContent?.includes('RUN IT BACK'),
    )
    const newConfigBtn = Array.from(container!.querySelectorAll('button')).find(b =>
      b.textContent?.includes('NEW CONFIG'),
    )

    await act(async () => {
      runAgainBtn!.click()
    })
    expect(startRunSpy).toHaveBeenCalledWith(expect.objectContaining({ mode: 'timed' }))

    await act(async () => {
      newConfigBtn!.click()
    })
    expect(openSetupSpy).toHaveBeenCalledWith('timed')
  })

  it('toggles AI Explain panel inline for expanded row', async () => {
    setupSummaryState()

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    // Expand row 1
    const row = container!.querySelector('[data-testid="review-row-summary-0"]') as HTMLElement
    await act(async () => {
      row.click()
    })

    // Find AI Explain button
    const aiBtn = Array.from(container!.querySelectorAll('button')).find(b =>
      b.textContent?.includes('AI Explain'),
    )
    expect(aiBtn).toBeTruthy()

    await act(async () => {
      aiBtn!.click()
    })

    // ExplanationPanel is rendered (it calls getExplanation or renders panel header)
    expect(container?.textContent).toContain('AI Explanation')

    // Click again to close
    await act(async () => {
      aiBtn!.click()
    })
    expect(container?.textContent).not.toContain('AI Explanation')
  })

  it('opens and closes image zoom modal when clicking diagram', async () => {
    setupSummaryState()

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    // Expand row 1
    const row = container!.querySelector('[data-testid="review-row-summary-0"]') as HTMLElement
    await act(async () => {
      row.click()
    })

    // Find solution diagram image
    const img = container!.querySelector('img[alt="Solution diagram"]') as HTMLImageElement
    expect(img).toBeTruthy()

    await act(async () => {
      img.click()
    })

    // Modal is open (zoom modal image with alt "Enlarged diagram")
    const enlargedImg = container!.querySelector('img[alt="Enlarged diagram"]') as HTMLImageElement
    expect(enlargedImg).toBeTruthy()
    expect(enlargedImg.src).toContain('solutions/c1.png')

    // Click backdrop/close button
    const closeBtn = Array.from(container!.querySelectorAll('button')).find(b =>
      b.className.includes('rounded-full'),
    )
    await act(async () => {
      closeBtn!.click()
    })

    expect(container!.querySelector('img[alt="Enlarged diagram"]')).toBeNull()
  })

  it('plays "correct" sound on correct answer', async () => {
    useGauntletStore.setState({
      phase: 'playing',
      index: 0,
      queue: [mockItem('q1', 'MATH', 6000)],
      config: {
        mode: 'timed',
        subjects: ['MATH'],
        rated: false,
        durationSec: 60,
        totalItems: 1,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    const choiceButtons = Array.from(container!.querySelectorAll('button')).filter(b =>
      b.textContent?.includes('Choice'),
    )
    expect(choiceButtons.length).toBe(4)

    // Choice B (index 1) is the correct answer
    await act(async () => {
      choiceButtons[1].click()
    })

    expect(mockPlay).toHaveBeenCalledWith('correct')
    expect(mockPlay).not.toHaveBeenCalledWith('wrong')
  })

  it('plays "wrong" sound on wrong answer', async () => {
    useGauntletStore.setState({
      phase: 'playing',
      index: 0,
      queue: [mockItem('q1', 'MATH', 6000)],
      config: {
        mode: 'timed',
        subjects: ['MATH'],
        rated: false,
        durationSec: 60,
        totalItems: 1,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    const choiceButtons = Array.from(container!.querySelectorAll('button')).filter(b =>
      b.textContent?.includes('Choice'),
    )

    // Choice A (index 0) is wrong
    await act(async () => {
      choiceButtons[0].click()
    })

    expect(mockPlay).toHaveBeenCalledWith('wrong')
    expect(mockPlay).not.toHaveBeenCalledWith('correct')
  })

  it('does not play sound when skipping an item', async () => {
    useGauntletStore.setState({
      phase: 'playing',
      index: 0,
      skipsAvailable: 1,
      queue: [mockItem('q1', 'MATH', 6000)],
      config: {
        mode: 'timed',
        subjects: ['MATH'],
        rated: false,
        durationSec: 60,
        totalItems: 1,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    const skipBtn = Array.from(container!.querySelectorAll('button')).find(b =>
      b.textContent?.includes('SKIP'),
    )
    expect(skipBtn).toBeTruthy()

    await act(async () => {
      skipBtn!.click()
    })

    expect(mockPlay).not.toHaveBeenCalled()
  })

  it('renders "Game Over" in red text when endReason is lives', async () => {
    useGauntletStore.setState({
      phase: 'summary',
      endReason: 'lives',
      score: 500,
      streak: 0,
      bestStreak: 2,
      answers: mockAnswers,
      config: {
        mode: 'survival',
        subjects: ['MATH', 'GEAS'],
        rated: false,
        durationSec: 1200,
        totalItems: 4,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    const heading = container!.querySelector('h2')
    expect(heading?.textContent).toBe('Game Over')
    expect(heading?.className).toContain('text-[#FF3333]')
    expect(mockPlay).toHaveBeenCalledWith('gameOver')
  })

  it('does not replay gameOver sound or re-show rank up modal when returning to summary', async () => {
    useGauntletStore.setState({
      phase: 'summary',
      endReason: 'lives',
      rated: true,
      ratingsBefore: {
        MATH: { rating: 840, answers: 10 },
        GEAS: { rating: 1000, answers: 0 },
        ELECS: { rating: 1000, answers: 0 },
        EST: { rating: 1000, answers: 0 },
      },
      ratings: {
        MATH: { rating: 860, answers: 11 },
        GEAS: { rating: 1000, answers: 0 },
        ELECS: { rating: 1000, answers: 0 },
        EST: { rating: 1000, answers: 0 },
      },
      score: 100,
      streak: 0,
      bestStreak: 2,
      durationMs: 45000,
      answers: [
        {
          seq: 1,
          item: mockItem('q1', 'MATH', 5000),
          chosen: 0,
          outcome: 'wrong',
          timeMs: 5000,
          points: 0,
          streakAfter: 0,
          answeredAt: Date.now(),
        },
      ],
      config: {
        mode: 'survival',
        subjects: ['MATH'],
        rated: true,
        durationSec: 1200,
        totalItems: 4,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })

    // First mount: should play gameOver sound and trigger rank-up modal
    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    expect(mockPlay).toHaveBeenCalledWith('gameOver')
    expect(container!.textContent).toContain('Promotion Achieved')
    mockPlay.mockClear()

    // Simulate navigating away (unmount)
    await act(async () => {
      root!.unmount()
    })

    // Re-create root and mount again (simulating returning to Gauntlet review summary)
    root = createRoot(container!)
    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    // Should NOT replay gameOver sound
    expect(mockPlay).not.toHaveBeenCalledWith('gameOver')

    // Should NOT show rank-up modal again
    expect(container!.textContent).not.toContain('Promotion Achieved')

    // Still renders Review Summary
    expect(container!.textContent).toContain('Answer Review')
  })

  it('plays plusOne sound when life bonus feedback is triggered', async () => {
    useGauntletStore.setState({
      phase: 'playing',
      index: 0,
      livesLeft: 3,
      queue: [mockItem('q1', 'MATH', 6000)],
      feedback: {
        id: 99,
        outcome: 'correct',
        points: 100,
        streak: 10,
        streakMult: 1.5,
        fastWrong: false,
        lifeBonus: true,
      },
      config: {
        mode: 'survival',
        subjects: ['MATH'],
        rated: false,
        durationSec: 60,
        totalItems: 1,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    expect(mockPlay).toHaveBeenCalledWith('plusOne')
  })

  it('renders time spent and survival header in summary for survival mode', async () => {
    useGauntletStore.setState({
      phase: 'summary',
      endReason: 'lives',
      score: 1200,
      streak: 0,
      bestStreak: 5,
      durationMs: 145000, // 2m 25s
      answers: mockAnswers,
      config: {
        mode: 'survival',
        subjects: ['MATH', 'GEAS'],
        rated: false,
        durationSec: 1200,
        totalItems: 4,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    expect(container!.textContent).toContain('Survival Session Summary')
    expect(container!.textContent).toContain('Time Spent')
    expect(container!.textContent).toContain('2m 25s')
  })

  it('renders Quit button and VolumeControl in HUD during playing phase', async () => {
    useGauntletStore.setState({
      phase: 'playing',
      index: 0,
      skipsAvailable: 1,
      queue: [mockItem('q1', 'MATH', 6000)],
      config: {
        mode: 'timed',
        subjects: ['MATH'],
        rated: false,
        durationSec: 60,
        totalItems: 1,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    const quitBtn = Array.from(container!.querySelectorAll('button')).find(b =>
      b.textContent?.trim() === 'Quit',
    )
    expect(quitBtn).toBeTruthy()
    // Confirm Quit is outside the question card (inside the HUD header)
    const hudHeader = container!.querySelector('.bg-surface.rounded-xl')
    expect(hudHeader?.contains(quitBtn!)).toBe(true)
  })

  it('activates low-health music overlay at 1 life in survival mode and deactivates when not 1 life', async () => {
    const { useGauntletMusic: getMusic } = await import('../hooks/useGauntletMusic')
    const music = getMusic()

    // 1 life in survival -> low health overlay active
    await act(async () => {
      useGauntletStore.setState({
        phase: 'playing',
        index: 0,
        livesLeft: 1,
        queue: [mockItem('q1', 'MATH', 6000)],
        config: {
          mode: 'survival',
          subjects: ['MATH'],
          rated: false,
          durationSec: 60,
          totalItems: 1,
          allocation: 'tos',
          customCounts: {},
          lives: 3,
          perQuestionSec: 30,
        },
      })
      root!.render(renderWithRouter(<Gauntlet />))
    })

    expect(music.isLowHealthActive()).toBe(true)

    // Regain life / 2 lives -> low health overlay deactivates
    await act(async () => {
      useGauntletStore.setState({
        livesLeft: 2,
      })
    })

    expect(music.isLowHealthActive()).toBe(false)
  })

  it('renders LEARN MISSED button when there are missed questions in summary', async () => {
    setupSummaryState()

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    const learnMissedBtn = container!.querySelector('[data-testid="learn-missed-button"]')
    expect(learnMissedBtn).toBeTruthy()
    expect(learnMissedBtn?.textContent).toContain('LEARN MISSED (3)')

    const headerBtn = container!.querySelector('[data-testid="learn-missed-header-button"]')
    expect(headerBtn).toBeTruthy()
    expect(headerBtn?.textContent).toContain('Learn 3 Missed')
  })

  it('does not render LEARN MISSED button when all questions are correct', async () => {
    useGauntletStore.setState({
      phase: 'summary',
      endReason: 'queue',
      score: 400,
      streak: 4,
      bestStreak: 4,
      answers: [
        {
          seq: 0,
          item: mockItem('c1', 'MATH', 6000),
          chosen: 1,
          outcome: 'correct',
          timeMs: 4000,
          points: 100,
          streakAfter: 1,
          answeredAt: Date.now(),
        },
      ],
      config: {
        mode: 'timed',
        subjects: ['MATH'],
        rated: false,
        durationSec: 1200,
        totalItems: 1,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    const learnMissedBtn = container!.querySelector('[data-testid="learn-missed-button"]')
    expect(learnMissedBtn).toBeNull()
  })

  it('starts LearnMode when clicking LEARN MISSED and returns to summary on exit', async () => {
    setupSummaryState()

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    const learnMissedBtn = container!.querySelector('[data-testid="learn-missed-button"]') as HTMLButtonElement
    expect(learnMissedBtn).toBeTruthy()

    await act(async () => {
      learnMissedBtn.click()
    })

    // Confirm LearnMode is mounted
    expect(container!.textContent).toContain('Exit Learn Mode')
    expect(container!.textContent).toContain('to retry')

    // Click Exit Learn Mode
    const exitBtn = Array.from(container!.querySelectorAll('button')).find(
      b => b.textContent?.includes('Exit Learn Mode'),
    )
    expect(exitBtn).toBeTruthy()

    await act(async () => {
      exitBtn!.click()
    })

    // Confirm Leave modal is shown, then confirm leave
    const confirmLeaveBtn = Array.from(container!.querySelectorAll('button')).find(
      b => b.textContent?.includes('Leave') || b.textContent?.includes('Yes'),
    )
    expect(confirmLeaveBtn).toBeTruthy()

    await act(async () => {
      confirmLeaveBtn!.click()
    })

    // Back in Summary
    expect(container!.textContent).toContain('Gauntlet Run Summary')
    expect(container!.querySelector('[data-testid="learn-missed-button"]')).toBeTruthy()
  })

  it('renders LEARN ALL button below LEARN MISSED and starts LearnMode for all session items', async () => {
    setupSummaryState()

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    const learnAllBtn = container!.querySelector('[data-testid="learn-all-button"]') as HTMLButtonElement
    expect(learnAllBtn).toBeTruthy()
    expect(learnAllBtn.textContent).toContain('LEARN ALL (4)')

    await act(async () => {
      learnAllBtn.click()
    })

    // Confirm LearnMode is mounted
    expect(container!.textContent).toContain('Exit Learn Mode')
    expect(container!.textContent).toContain('to retry')
  })

  it('renders Flag Question button and opens modal to flag question', async () => {
    setupSummaryState()

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    // Expand row 1
    const row = container!.querySelector('[data-testid="review-row-summary-0"]') as HTMLElement
    await act(async () => {
      row.click()
    })

    // Flag button should be visible in expanded row
    const flagBtn = container!.querySelector('[data-testid="flag-btn-0"]') as HTMLButtonElement
    expect(flagBtn).toBeTruthy()
    expect(flagBtn.textContent).toContain('Flag Question')

    // Click Flag Question to open modal
    await act(async () => {
      flagBtn.click()
    })

    const modal = container!.querySelector('[data-testid="flag-modal"]')
    expect(modal).toBeTruthy()
    expect(modal!.textContent).toContain('Flag Question')
    expect(modal!.textContent).toContain('Select a reason:')

    // Select reason 'Missing image or diagram'
    const reasonBtn = container!.querySelector('[data-testid="flag-reason-missing-image-or-diagram"]') as HTMLButtonElement
    expect(reasonBtn).toBeTruthy()

    await act(async () => {
      reasonBtn.click()
    })

    expect(gauntletService.flagQuestion).toHaveBeenCalledWith('c1', 'Missing image or diagram')

    // Modal should close and badge should appear
    expect(container!.querySelector('[data-testid="flag-modal"]')).toBeNull()
    const badge = container!.querySelector('[data-testid="flag-badge-0"]')
    expect(badge).toBeTruthy()
    expect(badge!.textContent).toContain('FLAGGED')
  })

  it('unflags a flagged question from the modal', async () => {
    ;(gauntletService.getFlaggedQuestions as any).mockResolvedValueOnce({
      c1: { reason: 'Missing image or diagram', flaggedAt: Date.now() },
    })
    setupSummaryState()

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    // Row 0 has FLAGGED badge
    const badge = container!.querySelector('[data-testid="flag-badge-0"]')
    expect(badge).toBeTruthy()

    // Expand row 0
    const row = container!.querySelector('[data-testid="review-row-summary-0"]') as HTMLElement
    await act(async () => {
      row.click()
    })

    const flagBtn = container!.querySelector('[data-testid="flag-btn-0"]') as HTMLButtonElement
    expect(flagBtn.textContent).toContain('Flagged (Missing image or diagram)')

    // Click to open modal
    await act(async () => {
      flagBtn.click()
    })

    const unflagBtn = container!.querySelector('[data-testid="unflag-confirm-btn"]') as HTMLButtonElement
    expect(unflagBtn).toBeTruthy()

    await act(async () => {
      unflagBtn.click()
    })

    expect(gauntletService.unflagQuestion).toHaveBeenCalledWith('c1')
    expect(container!.querySelector('[data-testid="flag-badge-0"]')).toBeNull()
  })

  it('excludes flagged cards from missedCards and learn missed items session', async () => {
    ;(gauntletService.getFlaggedQuestions as any).mockResolvedValueOnce({
      c2: { reason: 'Hard problem solving question', flaggedAt: Date.now() },
    })
    setupSummaryState()

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    // Standard missed items = c2, c3, c4 (3 items). With c2 flagged, count is 2.
    const learnMissedBtn = container!.querySelector('[data-testid="learn-missed-button"]') as HTMLButtonElement
    expect(learnMissedBtn).toBeTruthy()
    expect(learnMissedBtn.textContent).toContain('LEARN MISSED (2)')
  })

  it('manages forceCollapsed: true during playing, false when isLearningMissed is true', async () => {
    useGauntletStore.setState({
      phase: 'playing',
      queue: [mockItem('c1', 'MATH')],
      index: 0,
      answers: mockAnswers,
      config: {
        mode: 'timed',
        subjects: ['MATH'],
        rated: false,
        durationSec: 1200,
        totalItems: 1,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    expect(useLayoutStore.getState().forceCollapsed).toBe(true)

    // Switch to summary with missed questions
    await act(async () => {
      setupSummaryState()
    })
    expect(useLayoutStore.getState().forceCollapsed).toBe(false)

    // Click Learn Missed
    const learnMissedBtn = container!.querySelector('[data-testid="learn-missed-button"]') as HTMLButtonElement
    expect(learnMissedBtn).toBeTruthy()
    await act(async () => {
      learnMissedBtn.click()
    })

    // forceCollapsed remains false when isLearningMissed is true
    expect(useLayoutStore.getState().forceCollapsed).toBe(false)
  })

  it('sets forceCollapsed to true during countdown phase and resets on unmount', async () => {
    useGauntletStore.setState({
      phase: 'countdown',
    })

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    expect(useLayoutStore.getState().forceCollapsed).toBe(true)

    act(() => {
      root!.unmount()
      root = null
    })

    expect(useLayoutStore.getState().forceCollapsed).toBe(false)
  })

  it('defines updated linger constants (1800ms for correct, wrong, skip)', () => {
    expect(LINGER_CORRECT_MS).toBe(1800)
    expect(LINGER_WRONG_MS).toBe(1800)
    expect(LINGER_SKIP_MS).toBe(1800)
  })

  it('holds displayed countdown steady for full linger duration in survival mode', async () => {
    vi.useFakeTimers()
    const now0 = 1000000
    vi.setSystemTime(now0)

    useGauntletStore.setState({
      phase: 'playing',
      index: 0,
      queue: Array.from({ length: 15 }, (_, i) => mockItem(`q${i + 1}`, 'MATH', 6000)),
      questionShownAt: now0,
      startedAt: now0,
      endsAt: null,
      livesLeft: 3,
      config: {
        mode: 'survival',
        subjects: ['MATH'],
        rated: false,
        durationSec: 1200,
        totalItems: 15,
        allocation: 'tos',
        customCounts: {},
        lives: 3,
        perQuestionSec: 30,
      },
    })

    await act(async () => {
      root!.render(renderWithRouter(<Gauntlet />))
    })

    const timerSpan = container!.querySelector('.lucide-timer')?.nextElementSibling as HTMLElement
    expect(timerSpan?.textContent).toBe('30s')

    // Advance 5 seconds
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(timerSpan?.textContent).toBe('25s')

    // Answer choice B (correct: 1800ms linger)
    const choiceButtons = Array.from(container!.querySelectorAll('button')).filter(b =>
      b.textContent?.includes('Choice'),
    )
    await act(async () => {
      choiceButtons[1].click()
    })

    // Countdown before advancing during linger
    const timerDuringLinger = timerSpan?.textContent

    // Advance 500ms into linger window
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    // Countdown must hold steady during linger
    expect(timerSpan?.textContent).toBe(timerDuringLinger)

    // Advance another 500ms (1000ms total into linger)
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(timerSpan?.textContent).toBe(timerDuringLinger)

    // Complete linger (remaining 800ms -> 1800ms total)
    await act(async () => {
      vi.advanceTimersByTime(800)
    })

    // Now question 2 has loaded (index 1)
    expect(useGauntletStore.getState().index).toBe(1)
    expect(timerSpan?.textContent).toBe('30s')

    // Advance 3 seconds on new question
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(timerSpan?.textContent).toBe('27s')
  })
})


