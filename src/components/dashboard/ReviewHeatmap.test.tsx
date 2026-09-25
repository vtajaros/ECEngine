// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ReviewHeatmap from './ReviewHeatmap'

describe('ReviewHeatmap', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'))
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
    vi.useRealTimers()
  })

  it('starts from September when first study data is in September and continues for 6 months', () => {
    const history = {
      '2026-09-10': { count: 10, timeSpent: 30 },
      '2026-09-15': { count: 5, timeSpent: 45 },
    }

    act(() => {
      root!.render(<ReviewHeatmap activityHistory={history} year={2026} />)
    })

    const text = container?.textContent || ''
    // Starts at SEP and continues for 6 months (SEP, OCT, NOV, DEC, JAN, FEB)
    expect(text).toContain('SEP')
    expect(text).toContain('OCT')
    expect(text).toContain('NOV')
    expect(text).toContain('DEC')
    expect(text).toContain('JAN')
    expect(text).toContain('FEB')

    // Preceding months of the year before study started are excluded
    expect(text).not.toContain('MAR')
    expect(text).not.toContain('APR')
    expect(text).not.toContain('MAY')
    expect(text).not.toContain('JUN')
    expect(text).not.toContain('JUL')
    expect(text).not.toContain('AUG')

    const cells = container?.querySelectorAll('[data-date*="2026-09-10"]')
    expect(cells?.length).toBe(1)
  })

  it('starts from March when first study data is in March', () => {
    const history = {
      '2026-03-05': { count: 12, timeSpent: 40 },
      '2026-06-12': { count: 8, timeSpent: 20 },
      '2026-09-01': { count: 15, timeSpent: 60 },
    }

    act(() => {
      root!.render(<ReviewHeatmap activityHistory={history} year={2026} />)
    })

    const text = container?.textContent || ''
    expect(text).toContain('MAR')
    expect(text).toContain('SEP')
    expect(text).not.toContain('JAN')
    expect(text).not.toContain('FEB')
  })

  it('starts from January when first study data is in January', () => {
    const history = {
      '2026-01-02': { count: 5, timeSpent: 15 },
      '2026-09-10': { count: 20, timeSpent: 90 },
    }

    act(() => {
      root!.render(<ReviewHeatmap activityHistory={history} year={2026} />)
    })

    const text = container?.textContent || ''
    expect(text).toContain('JAN')
    expect(text).toContain('SEP')
  })

  it('defaults to current month and continues for 6 months when no study data exists in current year', () => {
    const history = {}

    act(() => {
      root!.render(<ReviewHeatmap activityHistory={history} year={2026} />)
    })

    const text = container?.textContent || ''
    // Defaults to SEP and shows 6 months
    expect(text).toContain('SEP')
    expect(text).toContain('OCT')
    expect(text).toContain('NOV')
    expect(text).toContain('DEC')
    expect(text).toContain('JAN')
    expect(text).toContain('FEB')

    // Preceding months of the year are excluded
    expect(text).not.toContain('MAR')
    expect(text).not.toContain('APR')
    expect(text).not.toContain('MAY')
    expect(text).not.toContain('JUN')
    expect(text).not.toContain('JUL')
    expect(text).not.toContain('AUG')
  })

  it('displays 6 months starting from April when study data begins in April', () => {
    const history = {
      '2026-04-10': { count: 8, timeSpent: 25 },
    }

    act(() => {
      root!.render(<ReviewHeatmap activityHistory={history} year={2026} />)
    })

    const text = container?.textContent || ''
    // April + 6 months -> APR, MAY, JUN, JUL, AUG, SEP
    expect(text).toContain('APR')
    expect(text).toContain('MAY')
    expect(text).toContain('JUN')
    expect(text).toContain('JUL')
    expect(text).toContain('AUG')
    expect(text).toContain('SEP')
    expect(text).not.toContain('JAN')
    expect(text).not.toContain('FEB')
    expect(text).not.toContain('MAR')
    expect(text).not.toContain('OCT')
  })
})
