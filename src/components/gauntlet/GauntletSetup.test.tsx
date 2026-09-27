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

    const select = container.querySelector('select') as HTMLSelectElement
    expect(select).not.toBeNull()

    // Select GEAS 4.0 Engineering Management
    await act(async () => {
      select.value = 'GEAS-4.0'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(container.textContent).toContain('Ranked (0.4x Scale)')
    expect(container.textContent).toContain('Topic focused: 0.4x Elo rating adjustment')
    expect(container.textContent).toContain('Clear Filter')
  })

  it('clears topic filter when clicking Clear Filter button', async () => {
    await act(async () => {
      root.render(<GauntletSetup />)
    })

    const select = container.querySelector('select') as HTMLSelectElement
    await act(async () => {
      select.value = 'GEAS-4.0'
      select.dispatchEvent(new Event('change', { bubbles: true }))
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
})
