// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
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
})
