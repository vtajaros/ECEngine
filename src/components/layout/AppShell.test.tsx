// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppShell } from './AppShell'
import { useGauntletStore, resetGauntletStore } from '../../store/useGauntletStore'

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

const mockStorage = createStorageMock()
Object.defineProperty(window, 'localStorage', { value: mockStorage, writable: true })
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true })

// Mock Electron windowControls & zoom
describe('AppShell GauntletBackdrop integration', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  beforeEach(() => {
    mockStorage.clear()
    resetGauntletStore()
    ;(window as any).electron = {
      windowControls: {
        onFullscreenChanged: vi.fn(() => () => {}),
      },
      zoom: {
        get: vi.fn(() => 100),
        getZoomFactor: vi.fn().mockResolvedValue(100),
        step: vi.fn(),
        onChanged: vi.fn(() => () => {}),
      },
    }
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
    container = null
    root = null
    vi.restoreAllMocks()
  })

  function renderApp(initialPath = '/') {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <AppShell />,
          children: [
            { path: '', element: <div data-testid="dashboard-page">Dashboard</div> },
            { path: 'lab', element: <div data-testid="lab-page">Data Analytics</div> },
            { path: 'gauntlet', element: <div data-testid="gauntlet-page">Gauntlet Arena</div> },
          ],
        },
      ],
      { initialEntries: [initialPath] }
    )
    return <RouterProvider router={router} />
  }

  it('mounts single GauntletBackdrop instance on Dashboard with full intensity', async () => {
    await act(async () => {
      root!.render(renderApp('/'))
    })

    const backdrops = container!.querySelectorAll('.gauntlet-animated-grid')
    expect(backdrops.length).toBe(1)

    // Check parent opacity class for full intensity
    const backdropContainer = backdrops[0].closest('[aria-hidden="true"]')
    expect(backdropContainer?.className).toContain('opacity-100')
  })

  it('adjusts backdrop intensity to subtle on dense routes like /lab', async () => {
    await act(async () => {
      root!.render(renderApp('/lab'))
    })

    const backdrops = container!.querySelectorAll('.gauntlet-animated-grid')
    expect(backdrops.length).toBe(1)

    const backdropContainer = backdrops[0].closest('[aria-hidden="true"]')
    expect(backdropContainer?.className).toContain('opacity-35')
  })

  it('dynamically adapts intensity for /gauntlet based on phase', async () => {
    // Phase: home -> full intensity
    useGauntletStore.setState({ phase: 'home' })
    await act(async () => {
      root!.render(renderApp('/gauntlet'))
    })

    let backdrops = container!.querySelectorAll('.gauntlet-animated-grid')
    expect(backdrops.length).toBe(1)
    let backdropContainer = backdrops[0].closest('[aria-hidden="true"]')
    expect(backdropContainer?.className).toContain('opacity-100')

    // Phase: playing -> subtle intensity
    await act(async () => {
      useGauntletStore.setState({ phase: 'playing' })
    })

    backdrops = container!.querySelectorAll('.gauntlet-animated-grid')
    expect(backdrops.length).toBe(1)
    backdropContainer = backdrops[0].closest('[aria-hidden="true"]')
    expect(backdropContainer?.className).toContain('opacity-35')
  })

  it('disables backdrop when ecengine:reduce-bg-effects is true in localStorage', async () => {
    mockStorage.setItem('ecengine:reduce-bg-effects', 'true')

    await act(async () => {
      root!.render(renderApp('/'))
    })

    const backdrops = container!.querySelectorAll('.gauntlet-animated-grid')
    expect(backdrops.length).toBe(0)
  })

  it('reacts live to ecengine:settings-changed event without requiring app restart', async () => {
    await act(async () => {
      root!.render(renderApp('/'))
    })

    expect(container!.querySelectorAll('.gauntlet-animated-grid').length).toBe(1)

    // User toggles Reduce Background Effects in Settings
    mockStorage.setItem('ecengine:reduce-bg-effects', 'true')
    await act(async () => {
      window.dispatchEvent(new Event('ecengine:settings-changed'))
    })

    expect(container!.querySelectorAll('.gauntlet-animated-grid').length).toBe(0)

    // User re-enables Background Effects
    mockStorage.setItem('ecengine:reduce-bg-effects', 'false')
    await act(async () => {
      window.dispatchEvent(new Event('ecengine:settings-changed'))
    })

    expect(container!.querySelectorAll('.gauntlet-animated-grid').length).toBe(1)
  })
})
