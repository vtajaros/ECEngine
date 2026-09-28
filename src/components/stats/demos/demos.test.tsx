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
import { QuestionLengthAnovaDemo } from './QuestionLengthAnovaDemo'
import { AnswerPositionContingencyDemo } from './AnswerPositionContingencyDemo'
import { ResponseTimeDemo } from './ResponseTimeDemo'
import { QuestionLengthZScoreDemo } from './QuestionLengthZScoreDemo'
import { TosCoverageMatrixDemo } from './TosCoverageMatrixDemo'
import { useDataLabStore } from '../../../store/useDataLabStore'

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
    useDataLabStore.getState().reset()
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

  describe('QuestionLengthAnovaDemo', () => {
    it('renders loading state initially', async () => {
      let resolvePromise: (val: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.spyOn(dbService, 'getQuestionLengthDistribution').mockReturnValue(pendingPromise as any)

      await act(async () => {
        root!.render(<QuestionLengthAnovaDemo />)
      })

      expect(container?.textContent).toContain('Loading question length ANOVA')

      await act(async () => {
        resolvePromise!([])
      })
    })

    it('renders gate placeholder when any subject group has < 5 values', async () => {
      const mockRows = [
        { subject: 'MATH', qlen: 80 },
        { subject: 'MATH', qlen: 90 },
        { subject: 'MATH', qlen: 100 },
        { subject: 'MATH', qlen: 110 },
        // MATH only has 4 items (< 5)
        { subject: 'GEAS', qlen: 50 },
        { subject: 'GEAS', qlen: 60 },
        { subject: 'GEAS', qlen: 70 },
        { subject: 'GEAS', qlen: 80 },
        { subject: 'GEAS', qlen: 90 },
        { subject: 'ELECS', qlen: 50 },
        { subject: 'ELECS', qlen: 60 },
        { subject: 'ELECS', qlen: 70 },
        { subject: 'ELECS', qlen: 80 },
        { subject: 'ELECS', qlen: 90 },
        { subject: 'EST', qlen: 50 },
        { subject: 'EST', qlen: 60 },
        { subject: 'EST', qlen: 70 },
        { subject: 'EST', qlen: 80 },
        { subject: 'EST', qlen: 90 },
      ]
      vi.spyOn(dbService, 'getQuestionLengthDistribution').mockResolvedValue(mockRows)

      await act(async () => {
        root!.render(<QuestionLengthAnovaDemo />)
      })

      expect(container?.textContent).toContain('Insufficient Data (min 5 per subject)')
      expect(container?.textContent).toContain('n(MATH)=4 · n(GEAS)=5 · n(ELECS)=5 · n(EST)=5')
      expect(container?.querySelector('[data-testid="insufficient-data-placeholder"]')).not.toBeNull()
    })

    it('renders tiles, F-statistic, p-value, df, and interpretation when all groups >= 5', async () => {
      const mockRows = [
        ...Array(5).fill({ subject: 'MATH', qlen: 50 }),
        ...Array(5).fill({ subject: 'GEAS', qlen: 60 }),
        ...Array(5).fill({ subject: 'ELECS', qlen: 70 }),
        ...Array(5).fill({ subject: 'EST', qlen: 80 }),
      ]
      vi.spyOn(dbService, 'getQuestionLengthDistribution').mockResolvedValue(mockRows)

      await act(async () => {
        root!.render(<QuestionLengthAnovaDemo />)
      })

      expect(container?.textContent).toContain('Question Length: One-Way ANOVA (MCQ)')
      expect(container?.textContent).toContain('n(MATH)=5 · n(GEAS)=5 · n(ELECS)=5 · n(EST)=5')
      expect(container?.textContent).toContain('F-statistic')
      expect(container?.textContent).toContain('p-value')
      expect(container?.textContent).toContain('df')
      expect(container?.textContent).toContain('3 / 16')
      expect(container?.querySelector('[data-testid="anova-interpretation"]')).not.toBeNull()
    })
  })

  describe('AnswerPositionContingencyDemo', () => {
    it('renders loading state initially', async () => {
      let resolvePromise: (val: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.spyOn(dbService, 'getAnswerPositionBySubject').mockReturnValue(pendingPromise as any)

      await act(async () => {
        root!.render(<AnswerPositionContingencyDemo />)
      })

      expect(container?.textContent).toContain('Loading position contingency test')

      await act(async () => {
        resolvePromise!([])
      })
    })

    it('renders gate placeholder when expected counts < 5 or total N is 0', async () => {
      // 1 card per position per subject -> expected counts = 1 (< 5)
      const mockRows = [
        { subject: 'MATH', position: 0, count: 1 },
        { subject: 'MATH', position: 1, count: 1 },
        { subject: 'MATH', position: 2, count: 1 },
        { subject: 'MATH', position: 3, count: 1 },
        { subject: 'GEAS', position: 0, count: 1 },
        { subject: 'GEAS', position: 1, count: 1 },
        { subject: 'GEAS', position: 2, count: 1 },
        { subject: 'GEAS', position: 3, count: 1 },
        { subject: 'ELECS', position: 0, count: 1 },
        { subject: 'ELECS', position: 1, count: 1 },
        { subject: 'ELECS', position: 2, count: 1 },
        { subject: 'ELECS', position: 3, count: 1 },
        { subject: 'EST', position: 0, count: 1 },
        { subject: 'EST', position: 1, count: 1 },
        { subject: 'EST', position: 2, count: 1 },
        { subject: 'EST', position: 3, count: 1 },
      ]
      vi.spyOn(dbService, 'getAnswerPositionBySubject').mockResolvedValue(mockRows)

      await act(async () => {
        root!.render(<AnswerPositionContingencyDemo />)
      })

      expect(container?.textContent).toContain('Insufficient Data (Expected Counts < 5)')
      expect(container?.querySelector('[data-testid="insufficient-data-placeholder"]')).not.toBeNull()
    })

    it('renders tiles, chi-square, p-value, df, and interpretation when expected counts >= 5', async () => {
      // 5 cards per position per subject -> total 80 cards, expected = 5 in all cells
      const subjects = ['MATH', 'GEAS', 'ELECS', 'EST']
      const mockRows: Array<{ subject: string; position: number | null; count: number }> = []
      for (const sub of subjects) {
        for (let pos = 0; pos <= 3; pos++) {
          mockRows.push({ subject: sub, position: pos, count: 5 })
        }
      }
      mockRows.push({ subject: 'GEAS', position: null, count: 1 }) // 1 anomaly card

      vi.spyOn(dbService, 'getAnswerPositionBySubject').mockResolvedValue(mockRows)

      await act(async () => {
        root!.render(<AnswerPositionContingencyDemo />)
      })

      expect(container?.textContent).toContain('Answer Position vs. Subject (Independence Test)')
      expect(container?.textContent).toContain('n = 80')
      expect(container?.textContent).toContain('χ²')
      expect(container?.textContent).toContain('p-value')
      expect(container?.textContent).toContain('df')
      expect(container?.textContent).toContain('9')
      expect(container?.textContent).toContain('No evidence that answer key position depends on subject')
      expect(container?.textContent).toContain('Data Quality Note: 1 card(s) have unassigned or out-of-range answer keys')
      expect(container?.querySelector('[data-testid="contingency-interpretation"]')).not.toBeNull()
    })
  })

  describe('ResponseTimeDemo', () => {
    it('renders loading state initially', async () => {
      let resolvePromise: (val: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.spyOn(dbService, 'getResponseTimeDistribution').mockReturnValue(pendingPromise as any)

      await act(async () => {
        root!.render(<ResponseTimeDemo />)
      })

      expect(container?.textContent).toContain('Loading response time distribution')

      await act(async () => {
        resolvePromise!({ learn: [], flashcard: [] })
      })
    })

    it('renders combined insufficient-data gate when both modes have < 10 attempts (low production volume)', async () => {
      const mockData = {
        learn: Array(8).fill({ subject: 'MATH', responseMs: 2500 }),
        flashcard: Array(7).fill({ subject: 'GEAS', responseMs: 1800 }),
      }
      vi.spyOn(dbService, 'getResponseTimeDistribution').mockResolvedValue(mockData)

      await act(async () => {
        root!.render(<ResponseTimeDemo />)
      })

      expect(container?.textContent).toContain('Response Time Distribution')
      expect(container?.textContent).toContain('n(learn)=8 · n(flashcard)=7')
      expect(container?.textContent).toContain('Not enough response-time data yet (n = 15)')
      expect(container?.querySelector('[data-testid="insufficient-data-placeholder"]')).not.toBeNull()
    })

    it('renders chart and tiles when at least one mode has sufficient data (>= 10 attempts)', async () => {
      const mockData = {
        learn: Array(12).fill({ subject: 'MATH', responseMs: 3500 }),
        flashcard: Array(4).fill({ subject: 'GEAS', responseMs: 2000 }),
      }
      vi.spyOn(dbService, 'getResponseTimeDistribution').mockResolvedValue(mockData)

      await act(async () => {
        root!.render(<ResponseTimeDemo />)
      })

      expect(container?.textContent).toContain('Response Time Distribution')
      expect(container?.textContent).toContain('n(learn)=12 · n(flashcard)=4')
      expect(container?.textContent).toContain('Learn Mode (MCQ)')
      expect(container?.textContent).toContain('Mean')
      expect(container?.textContent).toContain('Median')
      expect(container?.textContent).toContain('3.5s')
      expect(container?.querySelector('[data-testid="learn-mode-section"]')).not.toBeNull()
      // Flashcard is insufficient (< 10)
      expect(container?.textContent).toContain('Flashcard Mode (SM-2)')
      expect(container?.textContent).toContain('Insufficient Data (n = 4 < 10)')
      expect(container?.querySelector('[data-testid="flashcard-insufficient"]')).not.toBeNull()
    })
  })

  describe('QuestionLengthZScoreDemo', () => {
    it('renders loading state initially', async () => {
      let resolvePromise: (val: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.spyOn(dbService, 'getQuestionLengthDistribution').mockReturnValue(pendingPromise as any)

      await act(async () => {
        root!.render(<QuestionLengthZScoreDemo />)
      })

      expect(container?.textContent).toContain('Loading question length z-scores')

      await act(async () => {
        resolvePromise!([])
      })
    })

    it('renders gate placeholder when total n < 10', async () => {
      const mockRows = Array(8).fill({ subject: 'MATH', qlen: 80 })
      vi.spyOn(dbService, 'getQuestionLengthDistribution').mockResolvedValue(mockRows)

      await act(async () => {
        root!.render(<QuestionLengthZScoreDemo />)
      })

      expect(container?.textContent).toContain('Insufficient Data (n = 8 < 10)')
      expect(container?.querySelector('[data-testid="insufficient-data-placeholder"]')).not.toBeNull()
    })

    it('renders chart, tiles, and outlier classification when total n >= 10', async () => {
      const mockRows = [
        ...Array(15).fill({ subject: 'MATH', qlen: 50 }),
        { subject: 'ELECS', qlen: 500 }, // extreme outlier
      ]
      vi.spyOn(dbService, 'getQuestionLengthDistribution').mockResolvedValue(mockRows)

      await act(async () => {
        root!.render(<QuestionLengthZScoreDemo />)
      })

      expect(container?.textContent).toContain('Outlier Detection via Z-Scores (Question Length)')
      expect(container?.textContent).toContain('n = 16')
      expect(container?.textContent).toContain('Outliers')
      expect(container?.textContent).toContain('Most Extreme')
      expect(container?.textContent).toContain('Extreme Subject')
      expect(container?.textContent).toContain('ELECS')
      expect(container?.querySelector('[data-testid="zscore-interpretation"]')).not.toBeNull()
    })
  })

  describe('TosCoverageMatrixDemo', () => {
    const mockMatrix = {
      totalCards: 100,
      totalClassified: 95,
      totalUnclassified: 5,
      bySubject: {
        MATH: {
          totalCards: 25,
          classifiedCards: 25,
          unclassifiedCards: 0,
          countsByTosId: {
            'MATH-1.0': 15,
            'MATH-1.1': 5,
            'MATH-1.2': 10,
          },
        },
        ELECS: {
          totalCards: 25,
          classifiedCards: 25,
          unclassifiedCards: 0,
          countsByTosId: {},
        },
        GEAS: {
          totalCards: 25,
          classifiedCards: 25,
          unclassifiedCards: 0,
          countsByTosId: {},
        },
        EST: {
          totalCards: 25,
          classifiedCards: 20,
          unclassifiedCards: 5,
          countsByTosId: {},
        },
      },
    }

    it('renders LooksFam subject pills, single-line ribbon, and master-detail panes', async () => {
      vi.spyOn(dbService, 'getTosCoverageMatrix').mockResolvedValue(mockMatrix)
      useDataLabStore.setState({
        tosCoverageMatrix: mockMatrix as any,
        loading: { ...useDataLabStore.getState().loading, tosCoverageMatrix: false },
      })

      await act(async () => {
        root!.render(<TosCoverageMatrixDemo />)
      })

      // Header & Container
      expect(container?.querySelector('[data-testid="tos-coverage-matrix-demo"]')).not.toBeNull()
      expect(container?.textContent).toContain('ToS Classification & Coverage Matrix')

      // Single-line summary ribbon
      expect(container?.textContent).toContain('Total Cards:')
      expect(container?.textContent).toContain('100')
      expect(container?.textContent).toContain('Classified:')
      expect(container?.textContent).toContain('95')
      expect(container?.textContent).toContain('5 cards')

      // LooksFam subject pills
      expect(container?.textContent).toContain('ALL')
      expect(container?.textContent).toContain('MATH')
      expect(container?.textContent).toContain('GEAS')
      expect(container?.textContent).toContain('ELECS')
      expect(container?.textContent).toContain('EST')

      // Master column (Topics) and Detail column
      expect(container?.textContent).toContain('PRC Topics')
      expect(container?.textContent).toContain('1.0 Differential Calculus')
      expect(container?.textContent).toContain('1.1 Functions, Continuity, Limits')
    })
  })
})



