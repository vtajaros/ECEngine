// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GauntletSetup } from './GauntletSetup'
import { useGauntletStore, resetGauntletStore } from '../../store/useGauntletStore'
import { gauntletService } from '../../services/gauntlet.service'

vi.mock('../../services/gauntlet.service', () => ({
  gauntletService: {
    getRatings: vi.fn().mockResolvedValue([]),
    getPoolSizes: vi.fn().mockResolvedValue({ MATH: 50, GEAS: 60, ELECS: 70, EST: 80 }),
    getBests: vi.fn().mockResolvedValue([]),
    getRuns: vi.fn().mockResolvedValue([]),
    getPaceStats: vi.fn().mockResolvedValue({}),
    getQuestions: vi.fn().mockResolvedValue([]),
    saveRun: vi.fn().mockResolvedValue({ success: true }),
  },
}))

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

describe('GauntletSetup Component', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    localStorage.clear()
    resetGauntletStore()
    useGauntletStore.setState({
      setupMode: 'timed',
      phase: 'setup',
      hub: {
        ratings: {
          MATH: { rating: 1200, answers: 20 },
          GEAS: { rating: 1200, answers: 20 },
          ELECS: { rating: 1200, answers: 20 },
          EST: { rating: 1200, answers: 20 },
        },
        peaks: {},
        poolSizes: { MATH: 50, GEAS: 60, ELECS: 70, EST: 80 },
        bests: [],
        runs: [],
        pace: {},
      },
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.clearAllMocks()
  })

  it('renders Time Trial setup with Unlimited Sprint active by default', async () => {
    await act(async () => {
      root.render(<GauntletSetup />)
    })

    expect(container.textContent).toContain('Time Trial Setup')
    expect(container.textContent).toContain('UNLIMITED SPRINT')
    expect(container.textContent).toContain('Continuous Question Flow')
  })

  it('switches to Fixed Target mode when clicking FIXED TARGET button', async () => {
    await act(async () => {
      root.render(<GauntletSetup />)
    })

    const fixedBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('FIXED TARGET'),
    )
    expect(fixedBtn).toBeDefined()

    await act(async () => {
      fixedBtn?.click()
    })

    expect(container.textContent).toContain('Total Questions')
    expect(container.textContent).toContain('Item Allocation')
    expect(container.textContent).toContain('TOS-WEIGHTED')
  })

  it('selects a specific parent topic and updates subjects and topic filter', async () => {
    await act(async () => {
      root.render(<GauntletSetup />)
    })

    const filterBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Filter Topics'),
    )
    expect(filterBtn).toBeDefined()

    await act(async () => {
      filterBtn?.click()
    })

    const topicBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Engineering Management'),
    )
    expect(topicBtn).toBeDefined()

    await act(async () => {
      topicBtn?.click()
    })

    const applyBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Apply Topics'),
    )
    expect(applyBtn).toBeDefined()

    await act(async () => {
      applyBtn?.click()
    })

    expect(container.textContent).toContain('Ranked (0.4x Scale)')
    expect(container.textContent).toContain('Topic focused: 0.4x Elo rating adjustment')
    expect(container.textContent).toContain('Clear Filter')
  })

  it('clears topic filter when clicking Clear Filter button', async () => {
    await act(async () => {
      root.render(<GauntletSetup />)
    })

    const filterBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Filter Topics'),
    )
    await act(async () => {
      filterBtn?.click()
    })

    const topicBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Engineering Management'),
    )
    await act(async () => {
      topicBtn?.click()
    })

    const applyBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('Apply Topics'),
    )
    await act(async () => {
      applyBtn?.click()
    })

    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Clear Filter'),
    )
    expect(clearBtn).toBeDefined()

    await act(async () => {
      clearBtn?.click()
    })

    expect(container.textContent).not.toContain('Ranked (0.4x Scale)')
    expect(container.textContent).toContain('Counts toward subject Elo ratings')
  })

  it('renders current rank pill with rating, tier badge, and XP meter in the header', async () => {
    await act(async () => {
      root.render(<GauntletSetup />)
    })

    // Ratings in hub are 1200 across all subjects -> Overall 1200 is CONDUCTOR tier
    expect(container.textContent).toContain('CONDUCTOR')
    expect(container.textContent).toContain('1200')
    expect(container.textContent).toContain('XP')
    expect(container.textContent).toContain('+300 pts') // 1500 - 1200 = 300 to Copper
  })

  it('defaults topic modal tab to solo subject when filter topics is clicked', async () => {
    // Set config to solo ELECS
    localStorage.setItem(
      'ecengine:gauntlet:config:timed',
      JSON.stringify({ subjects: ['ELECS'] }),
    )

    await act(async () => {
      root.render(<GauntletSetup />)
    })

    const filterBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.includes('Filter Topics'),
    )
    await act(async () => {
      filterBtn?.click()
    })

    // The ELECS tab should be highlighted/selected in the modal
    const elecsTab = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'ELECS',
    )
    expect(elecsTab).toBeDefined()
    expect(elecsTab?.className).toContain('bg-surface-2')
    expect(elecsTab?.style.borderColor).toBeTruthy()
  })
})
