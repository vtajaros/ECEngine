// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { gauntletService } from '../services/gauntlet.service'
import PrintView from './PrintView'

vi.mock('../services/db.service', () => ({
  dbService: {
    getTopics: vi.fn().mockResolvedValue([
      { id: 'topic-1', name: 'Test Topic', subject: 'MATH', cardCount: 1 }
    ]),
    getAllCardsByTopic: vi.fn().mockResolvedValue([
      {
        id: 'card-1',
        topic_id: 'topic-1',
        type: 'mcq',
        data: { question: 'Sample question?', choices: ['A', 'B', 'C', 'D'], answer: 0 }
      }
    ])
  }
}))

describe('PrintView Find Shortcut', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    ;(window as any).electron = {
      print: {
        toPdf: vi.fn().mockResolvedValue({ success: true }),
        sendReady: vi.fn()
      },
      file: {
        export: vi.fn().mockResolvedValue({ success: true })
      },
      decks: {
        getTopics: vi.fn().mockResolvedValue({ success: true, data: [] })
      }
    }
  })

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount()
      })
    }
    if (container) {
      container.remove()
    }
    container = null
    root = null
    vi.clearAllMocks()
  })

  const renderComponent = async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/print',
          element: <PrintView />,
        },
      ],
      {
        initialEntries: ['/print?topicId=topic-1'],
      }
    )

    await act(async () => {
      root?.render(<RouterProvider router={router} />)
    })
  }

  it('opens find bar on Ctrl+f', async () => {
    await renderComponent()

    expect(container?.querySelector('input[placeholder*="Find in document"]')).toBeNull()

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))
    })

    expect(container?.querySelector('input[placeholder*="Find in document"]')).not.toBeNull()
  })

  it('opens find bar on Ctrl+F (Caps Lock enabled)', async () => {
    await renderComponent()

    expect(container?.querySelector('input[placeholder*="Find in document"]')).toBeNull()

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, bubbles: true }))
    })

    expect(container?.querySelector('input[placeholder*="Find in document"]')).not.toBeNull()
  })

  it('signals sendReady to Electron once cards and view finish loading', async () => {
    await renderComponent()

    expect((window as any).electron.print.sendReady).toHaveBeenCalled()
  })

  it('batches and displays topic description alongside cards', async () => {
    ;(window as any).electron.decks.getTopics.mockResolvedValueOnce({
      success: true,
      data: [{ id: 'topic-1', description: 'Coordinated batch description' }]
    })

    await renderComponent()

    expect(container?.textContent).toContain('Coordinated batch description')
    expect(container?.textContent).toContain('Sample question?')
  })

  it('loads and renders cards for ToS topics using gauntletService', async () => {
    vi.spyOn(gauntletService, 'getQuestions').mockResolvedValueOnce([
      {
        id: 'tos-card-1',
        topicId: 'tos_ELECS-1.1',
        type: 'mcq',
        difficulty: 'medium',
        tags: [],
        isCustom: false,
        data: {
          question: "What is Ohm's Law for resistive circuits?",
          choices: ['V = IR', 'P = IV', 'I = VR', 'R = VI'],
          answer: 0,
        },
      } as any,
    ])

    const router = createMemoryRouter(
      [
        {
          path: '/print',
          element: <PrintView />,
        },
      ],
      {
        initialEntries: ['/print?topicId=tos_ELECS-1.1&title=1.1%20Resistive%20Network'],
      }
    )

    await act(async () => {
      root?.render(<RouterProvider router={router} />)
    })

    expect(gauntletService.getQuestions).toHaveBeenCalledWith(
      [{ subject: 'ELECS', count: 5000 }],
      [],
      true,
      'ELECS-1.1'
    )
    expect(container?.textContent).toContain("What is Ohm's Law for resistive circuits?")
  })

  it('renders short choices in 2-column grid and long choices in 1-column stacked layout', async () => {
    vi.spyOn(gauntletService, 'getQuestions').mockResolvedValueOnce([
      {
        id: 'tos-card-short',
        topicId: 'tos_ELECS-1.1',
        type: 'mcq',
        difficulty: 'medium',
        tags: [],
        isCustom: false,
        data: {
          question: 'Short choices question',
          choices: ['10 V', '20 V', '30 V', '40 V'],
          answer: 0,
        },
      } as any,
      {
        id: 'tos-card-long',
        topicId: 'tos_ELECS-1.1',
        type: 'mcq',
        difficulty: 'hard',
        tags: [],
        isCustom: false,
        data: {
          question: 'Long choices question',
          choices: [
            'Short choice A',
            'This is an exceptionally long multiple choice option that exceeds 45 characters',
            'Choice C',
            'Choice D',
          ],
          answer: 1,
        },
      } as any,
    ])

    const router = createMemoryRouter(
      [
        {
          path: '/print',
          element: <PrintView />,
        },
      ],
      {
        initialEntries: ['/print?topicId=tos_ELECS-1.1&title=1.1%20Resistive%20Network&layout=table'],
      }
    )

    await act(async () => {
      root?.render(<RouterProvider router={router} />)
    })

    // Find the choice grid containers inside table rows (skipping header row 0)
    const rows = container?.querySelectorAll('tr') || []
    expect(rows.length).toBeGreaterThanOrEqual(3)

    const shortChoicesGrid = rows[1]?.querySelector('div[style*="display: grid"]') as HTMLElement
    const longChoicesGrid = rows[2]?.querySelector('div[style*="display: grid"]') as HTMLElement

    expect(shortChoicesGrid).not.toBeNull()
    expect(longChoicesGrid).not.toBeNull()

    // Short choices should have 1fr 1fr (2 columns)
    expect(shortChoicesGrid.style.gridTemplateColumns).toBe('1fr 1fr')

    // Long choices should stack in 1 column (1fr)
    expect(longChoicesGrid.style.gridTemplateColumns).toBe('1fr')
  })
})

