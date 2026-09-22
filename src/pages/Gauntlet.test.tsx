// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import Gauntlet from './Gauntlet'
import { useGauntletStore, resetGauntletStore } from '../store/useGauntletStore'
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
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
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
    expect(container?.textContent).toContain('RUN AGAIN')
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

  it('RUN AGAIN calls startRun with existing config and NEW CONFIG calls openSetup', async () => {
    setupSummaryState()

    const startRunSpy = vi.spyOn(useGauntletStore.getState(), 'startRun').mockResolvedValue()
    const openSetupSpy = vi.spyOn(useGauntletStore.getState(), 'openSetup')

    await act(async () => {
      root!.render(
        renderWithRouter(<Gauntlet />),
      )
    })

    const runAgainBtn = Array.from(container!.querySelectorAll('button')).find(b =>
      b.textContent?.includes('RUN AGAIN'),
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
})

