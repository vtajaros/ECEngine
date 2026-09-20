// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React from 'react'
import { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dbService } from '../../../services/db.service'
import { ContentCoverageDemo } from './ContentCoverageDemo'
import { QuestionLengthDemo } from './QuestionLengthDemo'
import { AnswerPositionDemo } from './AnswerPositionDemo'

// Mock Recharts ResponsiveContainer so children render synchronously in jsdom
vi.mock('recharts', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div className="recharts-responsive-container" style={{ width: 500, height: 300 }}>
        {children}
      </div>
    ),
  }
})

describe('Data Lab Demo Components', () => {
  let container: HTMLDivElement | null = null
  let root: Root | null = null

  beforeEach(() => {
    // Mock global window.electron if not present
    if (typeof window !== 'undefined' && !window.electron) {
      ;(window as any).electron = {
        data: {},
        decks: {},
        config: { getSettings: vi.fn().mockResolvedValue({}) },
      }
    }
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
      container = null
      root = null
    }
    vi.restoreAllMocks()
  })

  describe('ContentCoverageDemo', () => {
    it('renders loading state initially', async () => {
      let resolvePromise: (val: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.spyOn(dbService, 'getContentCoverage').mockReturnValue(pendingPromise as any)

      await act(async () => {
        root!.render(<ContentCoverageDemo />)
      })

      expect(container?.textContent).toContain('Loading content coverage')

      // Clean up hanging promise
      await act(async () => {
        resolvePromise!({
          MATH: { topics: 0, cards: 0 },
          GEAS: { topics: 0, cards: 0 },
          ELECS: { topics: 0, cards: 0 },
          EST: { topics: 0, cards: 0 },
        })
      })
    })

    it('renders chart and interpretation when data is loaded', async () => {
      const mockCoverage = {
        MATH: { topics: 10, cards: 100 },
        GEAS: { topics: 12, cards: 150 },
        ELECS: { topics: 8, cards: 80 },
        EST: { topics: 15, cards: 170 },
      }
      vi.spyOn(dbService, 'getContentCoverage').mockResolvedValue(mockCoverage)

      await act(async () => {
        root!.render(<ContentCoverageDemo />)
      })

      expect(container?.textContent).toContain('Content Coverage vs. PRC ToS Target')
      expect(container?.textContent).toContain('500 cards · 45 topics')
      // MATH is 100/500 = 20.0% (vs 20% weight), GEAS is 150/500 = 30.0% (vs 20% weight)
      expect(container?.textContent).toContain('MATH')
      expect(container?.textContent).toContain('20.0%')
      expect(container?.textContent).toContain('+0.0% vs 20% ToS weight')
      expect(container?.textContent).toContain('GEAS')
      expect(container?.textContent).toContain('30.0%')
      expect(container?.textContent).toContain('+10.0% vs 20% ToS weight')
      expect(container?.textContent).toContain('ELECS')
      expect(container?.textContent).toContain('16.0%')
      expect(container?.textContent).toContain('-14.0% vs 30% ToS weight')
      expect(container?.textContent).toContain('EST')
      expect(container?.textContent).toContain('34.0%')
      expect(container?.textContent).toContain('+4.0% vs 30% ToS weight')
      expect(container?.querySelector('[data-testid="coverage-interpretation"]')).not.toBeNull()
    })

    it('renders empty state when all counts are zero', async () => {
      const mockZeroCoverage = {
        MATH: { topics: 0, cards: 0 },
        GEAS: { topics: 0, cards: 0 },
        ELECS: { topics: 0, cards: 0 },
        EST: { topics: 0, cards: 0 },
      }
      vi.spyOn(dbService, 'getContentCoverage').mockResolvedValue(mockZeroCoverage)

      await act(async () => {
        root!.render(<ContentCoverageDemo />)
      })

      expect(container?.textContent).toContain('No cards found in library')
      expect(container?.textContent).not.toContain('NaN')
    })
  })

  describe('QuestionLengthDemo', () => {
    it('renders loading state initially', async () => {
      let resolvePromise: (val: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.spyOn(dbService, 'getQuestionLengthDistribution').mockReturnValue(pendingPromise as any)

      await act(async () => {
        root!.render(<QuestionLengthDemo />)
      })

      expect(container?.textContent).toContain('Loading question length distribution')

      await act(async () => {
        resolvePromise!([])
      })
    })

    it('renders gate placeholder when total n < 10', async () => {
      const mockRows = [
        { subject: 'MATH', qlen: 80 },
        { subject: 'MATH', qlen: 90 },
        { subject: 'GEAS', qlen: 110 },
      ]
      vi.spyOn(dbService, 'getQuestionLengthDistribution').mockResolvedValue(mockRows)

      await act(async () => {
        root!.render(<QuestionLengthDemo />)
      })

      expect(container?.textContent).toContain('Insufficient Data (n = 3 < 10)')
      expect(container?.textContent).toContain('At least 10 multiple-choice questions are needed')
    })

    it('renders chart, n, and live skew interpretation when n >= 10', async () => {
      // 12 items with positive right skew (a few very large items)
      const mockRows = [
        { subject: 'MATH', qlen: 50 },
        { subject: 'MATH', qlen: 60 },
        { subject: 'MATH', qlen: 70 },
        { subject: 'GEAS', qlen: 80 },
        { subject: 'GEAS', qlen: 90 },
        { subject: 'GEAS', qlen: 100 },
        { subject: 'ELECS', qlen: 90 },
        { subject: 'ELECS', qlen: 100 },
        { subject: 'ELECS', qlen: 110 },
        { subject: 'EST', qlen: 100 },
        { subject: 'EST', qlen: 120 },
        { subject: 'EST', qlen: 500 }, // pulls mean above median
      ]
      vi.spyOn(dbService, 'getQuestionLengthDistribution').mockResolvedValue(mockRows)

      await act(async () => {
        root!.render(<QuestionLengthDemo />)
      })

      expect(container?.textContent).toContain('Mean Question Length by Subject (MCQ)')
      expect(container?.textContent).toContain('Total n')
      expect(container?.textContent).toContain('12')
      expect(container?.textContent).toContain('Mean')
      expect(container?.textContent).toContain('Median')
      expect(container?.textContent).toContain('mean > median indicates right-skew')
      expect(container?.querySelector('[data-testid="question-length-interpretation"]')).not.toBeNull()
    })
  })

  describe('AnswerPositionDemo', () => {
    it('renders loading state initially', async () => {
      let resolvePromise: (val: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.spyOn(dbService, 'getAnswerPositionCounts').mockReturnValue(pendingPromise as any)

      await act(async () => {
        root!.render(<AnswerPositionDemo />)
      })

      expect(container?.textContent).toContain('Loading answer position balance')

      await act(async () => {
        resolvePromise!([])
      })
    })

    it('renders empty state when total tested count is 0', async () => {
      vi.spyOn(dbService, 'getAnswerPositionCounts').mockResolvedValue([])

      await act(async () => {
        root!.render(<AnswerPositionDemo />)
      })

      expect(container?.textContent).toContain('No MCQ answer position data available')
    })

    it('renders chart, chi-square, Cramér’s W effect size, and anomaly note when non-zero', async () => {
      const mockPositions = [
        { position: 0, count: 25 },
        { position: 1, count: 25 },
        { position: 2, count: 25 },
        { position: 3, count: 25 },
        { position: null, count: 3 }, // Anomaly bucket
      ]
      vi.spyOn(dbService, 'getAnswerPositionCounts').mockResolvedValue(mockPositions)

      await act(async () => {
        root!.render(<AnswerPositionDemo />)
      })

      expect(container?.textContent).toContain('Answer Key Position Balance (MCQ)')
      expect(container?.textContent).toContain('n = 100')
      // Both p-value and Cramér's W must appear together
      expect(container?.textContent).toContain('Cramér\'s W')
      expect(container?.textContent).toContain('p = 1.000')
      // Data quality note for anomaly bucket
      expect(container?.textContent).toContain('Data Quality Note: 3 card(s) have unassigned or out-of-range answer keys')
      expect(container?.querySelector('[data-testid="answer-position-interpretation"]')).not.toBeNull()
    })
  })
})
