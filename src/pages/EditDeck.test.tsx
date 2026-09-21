// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import EditDeck from './EditDeck'

// Mock tanstack virtualizer
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 100,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: `key_${i}`,
        start: i * 100,
        size: 100,
      })),
    measureElement: () => {},
  }),
}))

describe('EditDeck Import Functionality', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    ;(window as any).electron = {
      decks: {
        getTopics: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'test-deck-1',
              name: 'Test Deck',
              subject: 'Electronics Engineering',
              description: 'Initial description',
              tags: '["ECE"]',
              folder_name: 'TestFolder',
              folder_id: 'f1',
            },
          ],
        }),
        updateDeckWithCards: vi.fn().mockResolvedValue({ success: true }),
        exportToText: vi.fn().mockResolvedValue({ success: true }),
      },
      data: {
        getAllCardsByTopic: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'existing-card-1',
              type: 'mcq',
              data: JSON.stringify({
                question: 'Existing Question 1',
                choices: ['A', 'B', 'C', 'D'],
                answer: 0,
                explanation: 'Existing Expl',
              }),
            },
          ],
        }),
      },
      folders: {
        getAll: vi.fn().mockResolvedValue({ success: true, data: [] }),
      },
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
          path: '/deck/:deckId/edit',
          element: <EditDeck />,
        },
      ],
      {
        initialEntries: ['/deck/test-deck-1/edit'],
      }
    )

    await act(async () => {
      root?.render(<RouterProvider router={router} />)
    })
  }

  it('renders "Import MCQs" and "Import Flashcards" buttons in the Questions header', async () => {
    await renderComponent()

    const importMcqBtn = Array.from(container?.querySelectorAll('button') || []).find(b =>
      b.textContent?.includes('Import MCQs')
    )
    const importFcBtn = Array.from(container?.querySelectorAll('button') || []).find(b =>
      b.textContent?.includes('Import Flashcards')
    )

    expect(importMcqBtn).toBeTruthy()
    expect(importFcBtn).toBeTruthy()
  })

  it('opens MCQ import modal when clicking "Import MCQs"', async () => {
    await renderComponent()

    const importMcqBtn = Array.from(container?.querySelectorAll('button') || []).find(b =>
      b.textContent?.includes('Import MCQs')
    )

    await act(async () => {
      importMcqBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Modal should be open with import UI
    const modalHeading = container?.querySelector('h3, h2, h1')
    expect(container?.textContent).toContain('Import MCQs')
  })

  it('opens Flashcard import modal when clicking "Import Flashcards"', async () => {
    await renderComponent()

    const importFcBtn = Array.from(container?.querySelectorAll('button') || []).find(b =>
      b.textContent?.includes('Import Flashcards')
    )

    await act(async () => {
      importFcBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container?.textContent).toContain('Import Flashcards')
  })

function setElementValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

  it('imports MCQs and appends them to existing cards', async () => {
    await renderComponent()

    // Initially 1 existing card
    expect(container?.textContent).toContain('1 item total')

    // Click Import MCQs
    const importMcqBtn = Array.from(container?.querySelectorAll('button') || []).find(b =>
      b.textContent?.includes('Import MCQs')
    )
    await act(async () => {
      importMcqBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Find textarea in modal
    const textarea = container?.querySelector('textarea')
    expect(textarea).toBeTruthy()

    // Type valid MCQ
    const mcqText = `Q: What is the unit of capacitance?
A: Farad
B: Ohm
C: Henry
D: Volt
ANS: A`

    await act(async () => {
      if (textarea) {
        setElementValue(textarea, mcqText)
      }
    })

    // Advance debounce timer in ImportModal
    await act(async () => {
      await new Promise(r => setTimeout(r, 450))
    })

    // Click "Import 1 Cards"
    const confirmImportBtn = Array.from(container?.querySelectorAll('button') || []).find(b =>
      b.textContent?.includes('Import 1 Cards')
    )
    expect(confirmImportBtn).toBeTruthy()

    await act(async () => {
      confirmImportBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Now cards count should be 2
    expect(container?.textContent).toContain('2 items total')
    expect(container?.textContent).toContain('What is the unit of capacitance?')
  })

  it('imports Flashcards and appends them to existing cards', async () => {
    await renderComponent()

    // Initially 1 existing card
    expect(container?.textContent).toContain('1 item total')

    // Click Import Flashcards
    const importFcBtn = Array.from(container?.querySelectorAll('button') || []).find(b =>
      b.textContent?.includes('Import Flashcards')
    )
    await act(async () => {
      importFcBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Find textarea in modal
    const textarea = container?.querySelector('textarea')
    expect(textarea).toBeTruthy()

    // Type valid Flashcard
    const fcText = `Q: Ohm's Law
A: V = I * R`

    await act(async () => {
      if (textarea) {
        setElementValue(textarea, fcText)
      }
    })

    // Advance debounce timer in ImportFlashcardsModal
    await act(async () => {
      await new Promise(r => setTimeout(r, 450))
    })

    // Click confirm button
    const confirmImportBtn = Array.from(container?.querySelectorAll('button') || []).find(b =>
      b.textContent?.includes('Import 1 Flashcards')
    )
    expect(confirmImportBtn).toBeTruthy()

    await act(async () => {
      confirmImportBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Now cards count should be 2
    expect(container?.textContent).toContain('2 items total')
    expect(container?.textContent).toContain("Ohm's Law")
  })
})

