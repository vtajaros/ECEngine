// @vitest-environment jsdom
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React from 'react'
import { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { dbService } from '../../../services/db.service'
import { ContentCoverageDemo } from './ContentCoverageDemo'
import { QuestionLengthDemo } from './QuestionLengthDemo'
import { AnswerPositionDemo } from './AnswerPositionDemo'
import { QuestionLengthAnovaDemo } from './QuestionLengthAnovaDemo'
import { AnswerPositionContingencyDemo } from './AnswerPositionContingencyDemo'
import { ResponseTimeDemo } from './ResponseTimeDemo'
import { QuestionLengthZScoreDemo } from './QuestionLengthZScoreDemo'
import { TosCoverageMatrixDemo } from './TosCoverageMatrixDemo'
import { GauntletSpeedParDemo } from './gauntlet/GauntletSpeedParDemo'
import { GauntletEloTrajectoryDemo } from './gauntlet/GauntletEloTrajectoryDemo'
import { GauntletCoverageDensityDemo } from './gauntlet/GauntletCoverageDensityDemo'
import { GauntletEnduranceStreakDemo } from './gauntlet/GauntletEnduranceStreakDemo'
import { GauntletExcludedQuestionsDemo } from './gauntlet/GauntletExcludedQuestionsDemo'
import { GauntletTopicAccuracyDemo } from './gauntlet/GauntletTopicAccuracyDemo'
import { TosCardSearchDemo } from './TosCardSearchDemo'
import { TosCardInspectorModal } from './TosCardInspectorModal'
import { useDataLabStore } from '../../../store/useDataLabStore'
import { gauntletService } from '../../../services/gauntlet.service'


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

// Mock localStorage for jsdom environment
const mockStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: mockStorage, writable: true })
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true })

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
    useDataLabStore.getState().reset()
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
      expect(container?.textContent).toContain('ToS Matrix')

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

    it('switches to Gauntlet Excluded view when clicking the Gauntlet Excluded subtab', async () => {
      vi.spyOn(gauntletService, 'getExcludedQuestions').mockResolvedValue({
        cards: [],
        total: 0,
        totalExcludedCount: 3,
        flaggedCount: 3,
        autoExcludedCount: 0,
        reasonsBreakdown: {},
        subjectsBreakdown: {},
      })
      useDataLabStore.setState({
        tosCoverageMatrix: mockMatrix as any,
        loading: { ...useDataLabStore.getState().loading, tosCoverageMatrix: false },
      })

      await act(async () => {
        root!.render(<TosCoverageMatrixDemo />)
        await new Promise((r) => setTimeout(r, 0))
      })

      const excludedTabBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes('Excluded')
      )
      expect(excludedTabBtn).toBeDefined()

      await act(async () => {
        excludedTabBtn?.click()
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(container?.querySelector('[data-testid="gauntlet-excluded-questions-demo"]')).not.toBeNull()
      expect(container?.textContent).toContain('Gauntlet Excluded Questions')
    })

    it('switches to Card Search view when clicking Card Search subtab', async () => {
      vi.spyOn(dbService, 'getCardsByTosTopic').mockResolvedValue({
        cards: [
          {
            id: 'card-1',
            topicId: 't-1',
            deckName: 'Diff Cal',
            subject: 'MATH',
            type: 'mcq',
            difficulty: 'easy',
            tosTopicId: 'MATH-1.1',
            orderIndex: 0,
            cardNumber: 1,
            preview: 'What is limit of sin(x)/x as x approaches 0?',
            tags: ['calculus', 'limits'],
            choices: ['0', '1', 'infinity', 'undefined'],
            answer: 1,
            explanation: 'Standard limit theorem.',
          },
        ],
        total: 1,
      })

      useDataLabStore.setState({
        tosCoverageMatrix: mockMatrix as any,
        loading: { ...useDataLabStore.getState().loading, tosCoverageMatrix: false },
      })

      await act(async () => {
        root!.render(<TosCoverageMatrixDemo />)
        await new Promise((r) => setTimeout(r, 0))
      })

      const cardSearchTabBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes('Card Search')
      )
      expect(cardSearchTabBtn).toBeDefined()

      await act(async () => {
        cardSearchTabBtn?.click()
        await new Promise((r) => setTimeout(r, 350))
      })

      expect(container?.querySelector('[data-testid="tos-card-search-demo"]')).not.toBeNull()
      expect(container?.textContent).toContain('Diff Cal')
      expect(container?.textContent).toContain('limit of sin(x)/x')
    })

    it('renders topic cards with choices and correct answer highlighted when inspector is opened', async () => {
      vi.spyOn(dbService, 'getCardsByTosTopic').mockResolvedValue({
        cards: [
          {
            id: 'c-inspector-1',
            topicId: 't-math-1',
            deckName: 'Pre-Board Exam Math 2',
            subject: 'MATH',
            type: 'mcq',
            cardNumber: 11,
            preview: 'A digital control signal traces a position profile s(t) = xe^x. What is third derivative?',
            choices: ['(x + 3)e^x', '(x + 2)e^x', '3xe^x', 'e^x'],
            answer: 0,
            explanation: 'Repeated product rule differentiation.',
          },
        ],
        total: 1,
      })

      await act(async () => {
        root!.render(
          <TosCardInspectorModal
            isOpen={true}
            onClose={() => {}}
            subject="MATH"
            tosTopicId="MATH-1.3"
            topicTitle="MATH-1.3 1.3 Higher-Order Derivatives"
          />
        )
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(container?.textContent).toContain('Pre-Board Exam Math 2')
      expect(container?.textContent).toContain('A digital control signal traces')
      expect(container?.textContent).toContain('[A]')
      expect(container?.textContent).toContain('(x + 3)e^x')
      expect(container?.textContent).toContain('Correct')

      const correctBadges = Array.from(container?.querySelectorAll('*') || []).filter(
        (el) => el.textContent?.trim() === 'Correct'
      )
      expect(correctBadges.length).toBe(1)
    })
  })

  describe('TosCardSearchDemo', () => {
    it('renders search input, filters, cards, and handles jump to topic', async () => {
      const mockJump = vi.fn()
      vi.spyOn(dbService, 'getCardsByTosTopic').mockResolvedValue({
        cards: [
          {
            id: 'c-search-1',
            topicId: 't-1',
            deckName: 'Circuits 101',
            subject: 'ELECS',
            type: 'mcq',
            difficulty: 'moderate',
            tosTopicId: 'ELECS-1.1',
            orderIndex: 0,
            cardNumber: 1,
            preview: 'Find the Thevenin equivalent resistance across terminals A and B.',
            tags: ['circuits', 'thevenin'],
            choices: ['5 ohms', '10 ohms', '15 ohms', '20 ohms'],
            answer: 1, // 10 ohms
            explanation: 'Deactivate independent sources and look into terminals.',
          },
        ],
        total: 1,
      })

      await act(async () => {
        root!.render(
          <TosCardSearchDemo
            initialQuery="Thevenin"
            initialSubject="ELECS"
            onJumpToTopic={mockJump}
          />
        )
        await new Promise((r) => setTimeout(r, 350))
      })

      expect(container?.querySelector('[data-testid="tos-card-search-demo"]')).not.toBeNull()
      expect(container?.textContent).toContain('Circuits 101')
      expect(container?.textContent).toContain('Thevenin equivalent resistance')
      expect(container?.textContent).toContain('10 ohms')
      expect(container?.textContent).toContain('Correct')

      // Click Jump button
      const jumpBtn = Array.from(container?.querySelectorAll('button') || []).find((b) =>
        b.textContent?.includes('Jump')
      )
      expect(jumpBtn).toBeDefined()
      await act(async () => {
        jumpBtn?.click()
      })
      expect(mockJump).toHaveBeenCalledWith('ELECS-1.1', 'ELECS')
    })

    it('renders flashcard flip side/definition and formula equation', async () => {
      vi.spyOn(dbService, 'getCardsByTosTopic').mockResolvedValue({
        cards: [
          {
            id: 'c-fc-1',
            topicId: 't-est',
            deckName: 'EST Coaching 4',
            subject: 'EST',
            type: 'flashcard',
            difficulty: 'easy',
            tosTopicId: 'EST-2.6',
            orderIndex: 0,
            cardNumber: 1,
            preview: 'For radio signals, the skip distance is determined by the:',
            tags: ['propagation', 'antennas'],
            back: 'Height of the ionosphere and the angle of radiation',
          },
          {
            id: 'c-fm-1',
            topicId: 't-math',
            deckName: 'Formulas',
            subject: 'MATH',
            type: 'formula',
            difficulty: 'moderate',
            tosTopicId: 'MATH-1.1',
            orderIndex: 1,
            cardNumber: 2,
            preview: 'Euler Formula',
            tags: ['calculus'],
            latex: 'e^{ix} = \\cos(x) + i\\sin(x)',
            description: 'Fundamental relationship between complex exponentials and trigonometric functions.',
          },
        ],
        total: 2,
      })

      await act(async () => {
        root!.render(
          <TosCardSearchDemo
            initialQuery="angle of radiation"
            initialSubject="ALL"
          />
        )
        await new Promise((r) => setTimeout(r, 350))
      })

      expect(container?.textContent).toContain('EST Coaching 4')
      expect(container?.textContent).toContain('skip distance is determined by the')
      expect(container?.textContent).toContain('Answer • Definition (Flip Side)')
      expect(container?.textContent).toContain('Height of the ionosphere and the angle of radiation')

      // Formula card check
      expect(container?.textContent).toContain('Euler Formula')
      expect(container?.textContent).toContain('Formula • Equation & Variables')
      expect(container?.textContent).toContain('Fundamental relationship')
    })

    it('only marks exactly one choice as correct when choices are numbers that match index values', async () => {
      vi.spyOn(dbService, 'getCardsByTosTopic').mockResolvedValue({
        cards: [
          {
            id: 'c-math-num-choices',
            topicId: 't-math-refresher',
            deckName: 'Math Refresher 2',
            subject: 'MATH',
            type: 'mcq',
            difficulty: 'moderate',
            tosTopicId: 'MATH-2.2',
            orderIndex: 0,
            cardNumber: 14,
            preview: 'When decomposing the rational integrand...',
            choices: ['1', '2', '3', '4'],
            answer: 2, // Choice index 2 is '3' (Option [C])
            explanation: 'Partial fractions rule',
          },
        ],
        total: 1,
      })

      await act(async () => {
        root!.render(
          <TosCardSearchDemo
            initialQuery="decomposing"
            initialSubject="MATH"
          />
        )
        await new Promise((r) => setTimeout(r, 350))
      })

      // Find all elements or text containing 'Correct'
      const correctBadges = Array.from(container?.querySelectorAll('*') || []).filter(
        (el) => el.textContent?.trim() === 'Correct'
      )
      // Exactly 1 choice must be marked Correct, NOT 2!
      expect(correctBadges.length).toBe(1)

      // The container should have [C] styled as correct and not [B]
      const choiceContainers = container?.querySelectorAll('.grid.grid-cols-1 > div')
      expect(choiceContainers?.length).toBe(4)
      if (choiceContainers) {
        expect(choiceContainers[1].textContent).not.toContain('Correct') // Option B ('2') must NOT be correct
        expect(choiceContainers[2].textContent).toContain('Correct') // Option C ('3') MUST be correct
      }
    })
  })

  describe('Gauntlet EDA Components', () => {
    const mockGauntletData: any = {
      tosAccuracy: [
        {
          tosTopicId: 'ELECS-1.1',
          subject: 'ELECS',
          totalAnswers: 10,
          correctAnswers: 5,
          wrongAnswers: 5,
          timeoutAnswers: 0,
          accuracy: 0.5,
          isWeak: true,
        },
        {
          tosTopicId: 'MATH-1.1',
          subject: 'MATH',
          totalAnswers: 15,
          correctAnswers: 12,
          wrongAnswers: 3,
          timeoutAnswers: 0,
          accuracy: 0.8,
          isWeak: false,
        },
      ],
      speedPar: [
        {
          subject: 'ELECS',
          totalAnswers: 50,
          avgTimeMs: 12000,
          avgParMs: 8000,
          speedRatio: 1.5,
          fastWrongCount: 4,
          wrongCount: 15,
          fastWrongRate: 0.267,
        },
        {
          subject: 'MATH',
          totalAnswers: 30,
          avgTimeMs: 7000,
          avgParMs: 9000,
          speedRatio: 0.778,
          fastWrongCount: 1,
          wrongCount: 6,
          fastWrongRate: 0.167,
        },
      ],
      eloTrajectory: [
        {
          date: 'Oct 1',
          timestamp: 1000,
          MATH: 500,
          GEAS: 500,
          ELECS: 500,
          EST: 500,
          overall: 500,
        },
        {
          date: 'Oct 2',
          timestamp: 2000,
          MATH: 520,
          GEAS: 510,
          ELECS: 540,
          EST: 490,
          overall: 515,
        },
      ],
      currentRatings: {
        MATH: { rating: 520, peak: 525, answers: 20 },
        GEAS: { rating: 510, peak: 510, answers: 15 },
        ELECS: { rating: 540, peak: 550, answers: 40 },
        EST: { rating: 490, peak: 505, answers: 25 },
      },
      coverageDensity: {
        bySubject: [
          { subject: 'ELECS', libraryCards: 2000, arenaCards: 800, penetrationPct: 40.0 },
          { subject: 'MATH', libraryCards: 1500, arenaCards: 300, penetrationPct: 20.0 },
        ],
        byTopic: [
          { tosTopicId: 'EST-4.6', subject: 'EST', libraryCards: 350, arenaCards: 20, penetrationPct: 5.7 },
        ],
        untestedBlindSpots: [
          { tosTopicId: 'EST-4.6', subject: 'EST', libraryCards: 350, arenaCards: 20, penetrationPct: 5.7 },
        ],
      },
      endurance: {
        totalRuns: 25,
        totalAnswers: 250,
        avgRunDurationSec: 120,
        avgRunScore: 350,
        avgQuestionsPerRun: 10,
        bestStreakOverall: 14,
        streakBuckets: [
          { bucket: '0-4', count: 15, pct: 60.0 },
          { bucket: '5-9', count: 8, pct: 32.0 },
          { bucket: '10-14', count: 2, pct: 8.0 },
          { bucket: '15-19', count: 0, pct: 0 },
          { bucket: '20-29', count: 0, pct: 0 },
          { bucket: '30+', count: 0, pct: 0 },
        ],
        failureModes: [
          { mode: 'lives', count: 20, pct: 80.0 },
          { mode: 'time', count: 5, pct: 20.0 },
        ],
      },
    }

    it('renders GauntletSpeedParDemo with actual vs par pacing', async () => {
      vi.spyOn(gauntletService, 'getEdaStats').mockResolvedValue(mockGauntletData)
      useDataLabStore.setState({
        gauntletEda: mockGauntletData,
        loading: { ...useDataLabStore.getState().loading, gauntletEda: false },
      })

      await act(async () => {
        root!.render(<GauntletSpeedParDemo />)
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(container?.querySelector('[data-testid="gauntlet-speed-par-demo"]')).not.toBeNull()
      expect(container?.textContent).toContain('Response Speed vs. Par Time')
      expect(container?.textContent).toContain('Pace Factor')
      expect(container?.textContent).toContain('Impulsive Errors')
    })

    it('renders GauntletEloTrajectoryDemo with ratings overview', async () => {
      vi.spyOn(gauntletService, 'getEdaStats').mockResolvedValue(mockGauntletData)
      useDataLabStore.setState({
        gauntletEda: mockGauntletData,
        loading: { ...useDataLabStore.getState().loading, gauntletEda: false },
      })

      await act(async () => {
        root!.render(<GauntletEloTrajectoryDemo />)
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(container?.querySelector('[data-testid="gauntlet-elo-trajectory-demo"]')).not.toBeNull()
      expect(container?.textContent).toContain('Elo Rating Growth & Trajectory')
      expect(container?.textContent).toContain('ELECS')
      expect(container?.textContent).toContain('540')
      expect(container?.textContent).toContain('Peak: 550')
    })

    it('renders GauntletCoverageDensityDemo with subject progress and blind spots', async () => {
      vi.spyOn(gauntletService, 'getEdaStats').mockResolvedValue(mockGauntletData)
      useDataLabStore.setState({
        gauntletEda: mockGauntletData,
        loading: { ...useDataLabStore.getState().loading, gauntletEda: false },
      })

      await act(async () => {
        root!.render(<GauntletCoverageDensityDemo />)
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(container?.querySelector('[data-testid="gauntlet-coverage-density-demo"]')).not.toBeNull()
      expect(container?.textContent).toContain('Topic Coverage Density: Gauntlet vs. Pool')
      expect(container?.textContent).toContain('Highest Untested Blind Spots')
      expect(container?.textContent).toContain('EST-4.6')
    })

    it('renders GauntletEnduranceStreakDemo with streak buckets and survival metrics', async () => {
      vi.spyOn(gauntletService, 'getEdaStats').mockResolvedValue(mockGauntletData)
      useDataLabStore.setState({
        gauntletEda: mockGauntletData,
        loading: { ...useDataLabStore.getState().loading, gauntletEda: false },
      })

      await act(async () => {
        root!.render(<GauntletEnduranceStreakDemo />)
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(container?.querySelector('[data-testid="gauntlet-endurance-streak-demo"]')).not.toBeNull()
      expect(container?.textContent).toContain('Endurance & Streak Survival Curve')
      expect(container?.textContent).toContain('Avg Run Survival')
      expect(container?.textContent).toContain('Average Run Score')
      expect(container?.textContent).toContain('Primary Exit Mode')
      expect(container?.textContent).toContain('lives')
    })

    it('renders GauntletExcludedQuestionsDemo with flagged questions and reinsert action', async () => {
      const mockExcludedData = {
        cards: [
          {
            id: 'c-flag-1',
            topicId: 't-1',
            type: 'mcq',
            subject: 'ELECS' as const,
            deckName: 'Circuits 101',
            tosTopicId: 'ELECS-1.1',
            question: "What is Ohm's Law formula?",
            choices: ['V = I * R', 'V = I / R', 'V = I + R', 'V = I - R'],
            answer: 0,
            difficulty: 'EASY',
            reason: 'Hard problem solving question',
            flaggedAt: 1790000000000,
            exclusionType: 'flagged' as const,
          },
        ],
        total: 1,
        totalExcludedCount: 6,
        flaggedCount: 1,
        autoExcludedCount: 5,
        reasonsBreakdown: { 'Hard problem solving question': 1 },
        subjectsBreakdown: { MATH: 0, GEAS: 0, ELECS: 1, EST: 0 },
      }

      vi.spyOn(gauntletService, 'getExcludedQuestions').mockResolvedValue(mockExcludedData)
      vi.spyOn(gauntletService, 'unflagQuestion').mockResolvedValue(undefined)

      await act(async () => {
        root!.render(<GauntletExcludedQuestionsDemo />)
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(container?.querySelector('[data-testid="gauntlet-excluded-questions-demo"]')).not.toBeNull()
      expect(container?.textContent).toContain('Gauntlet Excluded Questions')
      expect(container?.textContent).toContain("What is Ohm's Law formula?")
      expect(container?.textContent).toContain('Hard problem solving question')
      expect(container?.textContent).toContain('Reinsert into Pool')

      // Click Reinsert button
      const reinsertBtn = container?.querySelector('button:has(svg)') as HTMLButtonElement | null
      const buttons = Array.from(container?.querySelectorAll('button') || [])
      const poolBtn = buttons.find((b) => b.textContent?.includes('Reinsert into Pool'))
      expect(poolBtn).toBeDefined()

      await act(async () => {
        poolBtn?.click()
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(gauntletService.unflagQuestion).toHaveBeenCalledWith('c-flag-1')
    })

    it('renders GauntletTopicAccuracyDemo with hierarchical parents and subtopics', async () => {
      vi.spyOn(gauntletService, 'getTopicAccuracyStats').mockResolvedValue([
        {
          tosTopicId: 'MATH-1.1',
          code: '1.1',
          subject: 'MATH',
          totalCards: 10,
          studiedCards: 5,
          totalAnswers: 8,
          correctAnswers: 6,
          wrongAnswers: 2,
          accuracy: 0.75,
          studyProgress: 50,
        },
      ])

      await act(async () => {
        root!.render(<GauntletTopicAccuracyDemo />)
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(container?.textContent).toContain('Topic Accuracy & Mastery')
      expect(container?.textContent).toContain('Differential Calculus')
      expect(container?.textContent).toContain('Functions, Continuity, Limits')
      expect(container?.textContent).toContain('PRC Topics')
      expect(container?.textContent).toContain('Card Penetration')
    })

    it('allows selecting a different parent topic and filtering by subject in GauntletTopicAccuracyDemo', async () => {
      vi.spyOn(gauntletService, 'getTopicAccuracyStats').mockResolvedValue([])

      await act(async () => {
        root!.render(<GauntletTopicAccuracyDemo />)
        await new Promise((r) => setTimeout(r, 50))
      })

      // Click on another topic (e.g. Integral Calculus) in the master list
      const integralTopic = Array.from(container?.querySelectorAll('div') || []).find(
        (el) => el.textContent?.includes('2.0 Integral Calculus')
      )
      expect(integralTopic).toBeDefined()

      await act(async () => {
        integralTopic?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(container?.textContent).toContain('Integral Calculus')

      // Switch subject tab to ELECS
      const elecsBtn = Array.from(container?.querySelectorAll('button') || []).find(
        (btn) => btn.textContent?.includes('ELECS')
      )
      expect(elecsBtn).toBeDefined()

      await act(async () => {
        elecsBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(container?.textContent).toContain('DC Electrical Circuits')
    })

    it('opens LearnSettingsModal and starts drill when clicking Practice Topic', async () => {
      vi.spyOn(gauntletService, 'getTopicAccuracyStats').mockResolvedValue([
        {
          tosTopicId: 'MATH-1.1',
          code: '1.1',
          subject: 'MATH',
          totalCards: 25,
          studiedCards: 5,
          totalAnswers: 8,
          correctAnswers: 6,
          wrongAnswers: 2,
          accuracy: 0.75,
          studyProgress: 20,
        },
      ])

      const mockCard = {
        id: 'c-math-1',
        topic_id: 't-1',
        type: 'mcq' as const,
        data: {
          question: 'What is the limit of sin(x)/x as x approaches 0?',
          choices: ['0', '1', 'Infinity', 'Undefined'],
          answer: 1,
        },
        difficulty: 1,
        subjectCode: 'MATH' as const,
      }
      const getQuestionsSpy = vi.spyOn(gauntletService, 'getQuestions').mockResolvedValue([mockCard as any])

      await act(async () => {
        const router = createMemoryRouter([
          { path: '/', element: <GauntletTopicAccuracyDemo /> },
        ])
        root!.render(<RouterProvider router={router} />)
        await new Promise((r) => setTimeout(r, 50))
      })

      // Find "Practice Topic" button
      const practiceBtn = Array.from(container?.querySelectorAll('button') || []).find(
        (btn) => btn.textContent?.includes('Practice Topic')
      )
      expect(practiceBtn).toBeDefined()
      expect(practiceBtn?.hasAttribute('disabled')).toBe(false)

      // Click Practice Topic to open LearnSettingsModal
      await act(async () => {
        practiceBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 50))
      })

      // Learn Settings Modal should be open
      expect(container?.textContent).toContain('Learn Settings')
      expect(container?.textContent).toContain('Accessibility')

      // Click Start Session button in the modal
      const startBtn = Array.from(container?.querySelectorAll('button') || []).find(
        (btn) => btn.textContent?.includes('Start Session')
      )
      expect(startBtn).toBeDefined()

      await act(async () => {
        startBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 50))
      })

      // Should have invoked gauntletService.getQuestions with the parent topic ID
      expect(getQuestionsSpy).toHaveBeenCalledWith(
        [{ subject: 'MATH', count: 25 }],
        [],
        true, // scope === 'all' is true since default is 'all'
        'MATH-1.0'
      )
    })

    it('opens LearnSettingsModal for an individual subtopic drill', async () => {
      vi.spyOn(gauntletService, 'getTopicAccuracyStats').mockResolvedValue([
        {
          tosTopicId: 'MATH-1.1',
          code: '1.1',
          subject: 'MATH',
          totalCards: 12,
          studiedCards: 3,
          totalAnswers: 5,
          correctAnswers: 4,
          wrongAnswers: 1,
          accuracy: 0.8,
          studyProgress: 25,
        },
      ])

      const mockCard = {
        id: 'c-math-sub-1',
        topic_id: 't-1',
        type: 'mcq' as const,
        data: {
          question: 'Test subtopic question',
          choices: ['A', 'B'],
          answer: 0,
        },
        difficulty: 1,
        subjectCode: 'MATH' as const,
      }
      const getQuestionsSpy = vi.spyOn(gauntletService, 'getQuestions').mockResolvedValue([mockCard as any])

      await act(async () => {
        const router = createMemoryRouter([
          { path: '/', element: <GauntletTopicAccuracyDemo /> },
        ])
        root!.render(<RouterProvider router={router} />)
        await new Promise((r) => setTimeout(r, 50))
      })

      // Find subtopic drill button with aria-label="Drill MATH-1.1"
      const subDrillBtn = container?.querySelector('button[aria-label="Drill MATH-1.1"]')
      expect(subDrillBtn).toBeDefined()
      expect(subDrillBtn?.hasAttribute('disabled')).toBe(false)

      await act(async () => {
        subDrillBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(container?.textContent).toContain('Learn Settings')

      // Click Start Session
      const startBtn = Array.from(container?.querySelectorAll('button') || []).find(
        (btn) => btn.textContent?.includes('Start Session')
      )
      expect(startBtn).toBeDefined()

      await act(async () => {
        startBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 50))
      })

      expect(getQuestionsSpy).toHaveBeenCalledWith(
        [{ subject: 'MATH', count: 12 }],
        [],
        true, // scope === 'all' is true since default is 'all'
        'MATH-1.1'
      )
    })
  })
})




