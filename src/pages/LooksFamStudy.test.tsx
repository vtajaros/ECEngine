// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

function createStorageMock() {
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

const mockSession = createStorageMock()
const mockLocal = createStorageMock()

Object.defineProperty(window, 'sessionStorage', { value: mockSession, writable: true })
Object.defineProperty(window, 'localStorage', { value: mockLocal, writable: true })
Object.defineProperty(globalThis, 'sessionStorage', { value: mockSession, writable: true })
Object.defineProperty(globalThis, 'localStorage', { value: mockLocal, writable: true })

class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
Object.defineProperty(window, 'IntersectionObserver', { value: MockIntersectionObserver, writable: true })
Object.defineProperty(globalThis, 'IntersectionObserver', { value: MockIntersectionObserver, writable: true })

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import LooksFamStudy from './LooksFamStudy'
import { gauntletService } from '../services/gauntlet.service'

describe('LooksFamStudy folder and subject filtering', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    mockSession.clear()
    mockLocal.clear()

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    // Setup window.electron mocks
    ;(window as any).electron = {
      decks: {
        getTopicsWithCardCounts: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'topic-1',
              name: 'RC Exam Math 1',
              subject: 'Mathematics',
              types: 'mcq',
              card_count: 25,
              folder_id: 'folder-rc-exam',
              folder_name: 'RC Exam',
              created_at: 1000,
              is_favorite: 0,
            },
            {
              id: 'topic-2',
              name: 'RC Exam GEAS 48',
              subject: 'General Engineering & Applied Sciences (GEAS)',
              types: 'mcq',
              card_count: 25,
              folder_id: 'folder-rc-exam',
              folder_name: 'RC Exam',
              created_at: 1001,
              is_favorite: 0,
            },
            {
              id: 'topic-3',
              name: 'Excel Lecture Math',
              subject: 'Mathematics',
              types: 'mcq',
              card_count: 30,
              folder_id: 'folder-excel',
              folder_name: 'Excel',
              created_at: 1002,
              is_favorite: 0,
            },
          ],
        }),
        getFormulaMastery: vi.fn().mockResolvedValue({
          success: true,
          data: [],
        }),
        getBookmarkCountsByTopic: vi.fn().mockResolvedValue({
          success: true,
          data: {},
        }),
        getBookmarkedCards: vi.fn().mockResolvedValue({
          success: true,
          data: [],
        }),
      },
      folders: {
        getAll: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { id: 'folder-rc-exam', name: 'RC Exam', parent_id: null, order_index: 0 },
            { id: 'folder-excel', name: 'Excel', parent_id: null, order_index: 1 },
          ],
        }),
      },
      zoom: {
        step: vi.fn(),
      },
    }

    vi.spyOn(gauntletService, 'getTopicAccuracyStats').mockResolvedValue([])
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
    mockSession.clear()
  })

  it('retains the selected folder filter when switching between subject filters', async () => {
    const router = createMemoryRouter(
      [{ path: '/', element: <LooksFamStudy /> }],
      { initialEntries: ['/'] }
    )

    await act(async () => {
      root!.render(<RouterProvider router={router} />)
      await new Promise((r) => setTimeout(r, 100))
    })

    // Find RC Exam folder in the folder panel and click it
    const rcFolderText = Array.from(container?.querySelectorAll('*') || []).find(
      (el) => el.children.length === 0 && el.textContent?.trim() === 'RC Exam'
    )
    expect(rcFolderText).toBeDefined()

    await act(async () => {
      const clickTarget = rcFolderText?.closest('.cursor-pointer') || rcFolderText
      clickTarget?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 50))
    })

    // Verify sessionStorage has saved the folder
    expect(sessionStorage.getItem('looksfam:activeFolder')).toBe('folder-rc-exam')

    // Find MATH subject pill button and click it
    const mathSubjectBtn = Array.from(container?.querySelectorAll('button') || []).find(
      (b) => b.textContent?.trim() === 'MATH'
    )
    expect(mathSubjectBtn).toBeDefined()

    await act(async () => {
      mathSubjectBtn?.click()
      await new Promise((r) => setTimeout(r, 50))
    })

    // Verify the folder filter is STILL 'folder-rc-exam', NOT reset to 'all'!
    expect(sessionStorage.getItem('looksfam:activeFolder')).toBe('folder-rc-exam')

    // Now switch to GEAS subject pill
    const geasSubjectBtn = Array.from(container?.querySelectorAll('button') || []).find(
      (b) => b.textContent?.trim() === 'GEAS'
    )
    expect(geasSubjectBtn).toBeDefined()

    await act(async () => {
      geasSubjectBtn?.click()
      await new Promise((r) => setTimeout(r, 50))
    })

    // Verify folder filter is still preserved
    expect(sessionStorage.getItem('looksfam:activeFolder')).toBe('folder-rc-exam')

    // When switching view mode to ToS Topics ('syllabus'), activeFolder resets to 'all'
    const tosTopicsBtn = Array.from(container?.querySelectorAll('button') || []).find(
      (b) => b.textContent?.includes('ToS Topics')
    )
    expect(tosTopicsBtn).toBeDefined()

    await act(async () => {
      tosTopicsBtn?.click()
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(sessionStorage.getItem('looksfam:activeFolder')).toBe('all')
  })

  it('remembers subject and folder filter settings when returning from Edit Deck (remount)', async () => {
    // Pre-populate sessionStorage as if user was previously on MATH and folder-rc-exam before navigating to edit-deck
    sessionStorage.setItem('looksfam:activeSubject', 'MATH')
    sessionStorage.setItem('looksfam:activeFolder', 'folder-rc-exam')

    const router = createMemoryRouter(
      [{ path: '/', element: <LooksFamStudy /> }],
      { initialEntries: ['/'] }
    )

    await act(async () => {
      root!.render(<RouterProvider router={router} />)
      await new Promise((r) => setTimeout(r, 100))
    })

    // On mount, activeFolder must STILL be 'folder-rc-exam' and activeSubject 'MATH' (not reset to 'all')
    expect(sessionStorage.getItem('looksfam:activeFolder')).toBe('folder-rc-exam')
    expect(sessionStorage.getItem('looksfam:activeSubject')).toBe('MATH')

    // And the MATH subject pill should be active in the DOM
    const mathBtn = Array.from(container?.querySelectorAll('button') || []).find(
      (b) => b.textContent?.trim() === 'MATH'
    )
    expect(mathBtn).toBeDefined()
  })
})
