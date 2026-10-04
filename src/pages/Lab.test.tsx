// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import Lab from './Lab'
import { gauntletService } from '../services/gauntlet.service'
import { dbService } from '../services/db.service'

vi.mock('../components/stats/demos/gauntlet/GauntletSpeedParDemo', () => ({
  GauntletSpeedParDemo: () => <div data-testid="speed-par-demo">SpeedParDemo</div>
}))
vi.mock('../components/stats/demos/gauntlet/GauntletCoverageDensityDemo', () => ({
  GauntletCoverageDensityDemo: () => <div data-testid="coverage-density-demo">CoverageDensityDemo</div>
}))
vi.mock('../components/stats/demos/gauntlet/GauntletEnduranceStreakDemo', () => ({
  GauntletEnduranceStreakDemo: () => <div data-testid="endurance-streak-demo">EnduranceStreakDemo</div>
}))

describe('Lab page topic drill integration', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount()
      })
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container)
    }
    vi.restoreAllMocks()
  })

  it('renders Gauntlet Analytics tab and delegates drill session to full-page LearnMode', async () => {
    vi.spyOn(gauntletService, 'getTopicAccuracyStats').mockResolvedValue([
      {
        tosTopicId: 'MATH-1.1',
        code: '1.1',
        subject: 'MATH',
        totalCards: 25,
        studiedCards: 5,
        totalAnswers: 8,
        correctAnswers: 6,
        wrongAnswers: 2,
        accuracy: 0.75,
        studyProgress: 20,
      },
    ])

    const mockCard = {
      id: 'c-math-1',
      topic_id: 't-1',
      type: 'mcq' as const,
      data: {
        question: 'What is the derivative of x^2?',
        choices: ['2x', 'x', 'x^2', '1'],
        answer: 0,
      },
      difficulty: 1,
      subjectCode: 'MATH' as const,
    }

    vi.spyOn(gauntletService, 'getQuestions').mockResolvedValue([mockCard as any])

    await act(async () => {
      const router = createMemoryRouter([
        { path: '/', element: <Lab /> },
      ], { initialEntries: ['/?tab=gauntlet'] })
      root!.render(<RouterProvider router={router} />)
      await new Promise((r) => setTimeout(r, 50))
    })

    // Check that EDA demos are mounted initially in Gauntlet tab
    expect(container?.querySelector('[data-testid="speed-par-demo"]')).not.toBeNull()
    expect(container?.querySelector('[data-testid="coverage-density-demo"]')).not.toBeNull()

    // Find "Practice Topic" button
    const practiceBtn = Array.from(container?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent?.includes('Practice Topic')
    )
    expect(practiceBtn).toBeDefined()

    // Click Practice Topic
    await act(async () => {
      practiceBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 50))
    })

    // LearnSettingsModal should be open
    const startBtn = Array.from(container?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent?.includes('Start Session')
    )
    expect(startBtn).toBeDefined()

    // Start session
    await act(async () => {
      startBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 50))
    })

    // Now Lab should have swapped out the analytics view for LearnMode
    // EDA demos should be UNMOUNTED
    expect(container?.querySelector('[data-testid="speed-par-demo"]')).toBeNull()
    expect(container?.querySelector('[data-testid="coverage-density-demo"]')).toBeNull()
    expect(container?.textContent).toContain('What is the derivative of')
    expect(container?.textContent?.toLowerCase()).toContain('exit learn mode')

    // Click Exit Learn Mode
    const exitBtn = Array.from(container?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent?.toLowerCase().includes('exit learn mode')
    )
    expect(exitBtn).toBeDefined()

    await act(async () => {
      exitBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 50))
    })

    // Confirm exit modal if prompt appears
    const confirmLeaveBtn = Array.from(container?.querySelectorAll('button') || []).find(
      (btn) => btn.textContent?.includes('Leave Session') || btn.textContent?.includes('Exit')
    )
    if (confirmLeaveBtn) {
      await act(async () => {
        confirmLeaveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 50))
      })
    }

    // After exiting, the analytics view and demos are remounted cleanly
    expect(container?.querySelector('[data-testid="speed-par-demo"]')).not.toBeNull()
  })
})
