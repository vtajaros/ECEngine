// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import SubjectEloChart from './SubjectEloChart'

// Mock recharts ResponsiveContainer and components for jsdom environment
vi.mock('recharts', async () => {
  const actual = await vi.importActual<any>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  }
})

describe('SubjectEloChart', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  beforeEach(() => {
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
    }
  })

  it('renders graceful empty state when data is empty', () => {
    act(() => {
      root!.render(<SubjectEloChart data={[]} isLoading={false} />)
    })

    expect(container?.textContent).toContain('No rated Gauntlet runs yet')
  })

  it('renders loading state when isLoading is true and no data', () => {
    act(() => {
      root!.render(<SubjectEloChart data={[]} isLoading={true} />)
    })

    expect(container?.textContent).toContain('Loading…')
  })

  it('renders chart container when valid run points exist', () => {
    const points = [
      {
        date: 'Sep 24',
        timestamp: 1700000000,
        MATH: 1040,
        GEAS: 990,
        ELECS: 1010,
        EST: 1000,
      },
      {
        date: 'Sep 25',
        timestamp: 1700086400,
        MATH: 1060,
        GEAS: 1010,
        ELECS: 995,
        EST: 1025,
      },
    ]

    act(() => {
      root!.render(<SubjectEloChart data={points} isLoading={false} />)
    })

    expect(container?.textContent).not.toContain('No rated Gauntlet runs yet')
    expect(container?.querySelector('[data-testid="responsive-container"]')).not.toBeNull()
  })

  it('renders empty message for specific subject when no data exists for that subject', () => {
    const points = [
      {
        date: 'Sep 24',
        timestamp: 1700000000,
        MATH: null,
        GEAS: 1000,
        ELECS: null,
        EST: null,
      },
    ]

    act(() => {
      root!.render(<SubjectEloChart data={points} subject="MATH" isLoading={false} />)
    })

    expect(container?.textContent).toContain('No rated MATH runs yet')
  })

  it('renders single subject line when subject prop is specified and data exists', () => {
    const points = [
      {
        date: 'Sep 24',
        timestamp: 1700000000,
        MATH: 1050,
        GEAS: null,
        ELECS: null,
        EST: null,
      },
    ]

    act(() => {
      root!.render(<SubjectEloChart data={points} subject="MATH" isLoading={false} />)
    })

    expect(container?.textContent).not.toContain('No rated MATH runs yet')
    expect(container?.querySelector('[data-testid="responsive-container"]')).not.toBeNull()
  })
})
