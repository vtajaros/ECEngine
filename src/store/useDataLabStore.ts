import { create } from 'zustand'
import { dbService } from '../services/db.service'
import { gauntletService, GauntletEdaStats } from '../services/gauntlet.service'
import { useDataVersionStore } from './useDataVersionStore'


export type ContentCoverageData = Record<string, { topics: number; cards: number }>
export type QuestionLengthItem = { subject: string; qlen: number }
export type AnswerPositionCountItem = { position: number | null; count: number }
export type AnswerPositionBySubjectItem = { subject: string; position: number | null; count: number }
export interface ResponseTimeDistributionData {
  learn: Array<{ subject: string; responseMs: number }>
  flashcard: Array<{ subject: string; responseMs: number }>
  [key: string]: Array<{ subject: string; responseMs: number }>
}

export interface TosCoverageMatrixState {
  totalCards: number
  totalClassified: number
  totalUnclassified: number
  bySubject: Record<
    string,
    {
      totalCards: number
      classifiedCards: number
      unclassifiedCards: number
      countsByTosId: Record<string, number>
    }
  >
}

export interface DataLabState {
  // Cached datasets
  contentCoverage: ContentCoverageData | null
  tosCoverageMatrix: TosCoverageMatrixState | null
  questionLengthDistribution: QuestionLengthItem[] | null
  answerPositionCounts: AnswerPositionCountItem[] | null
  answerPositionBySubject: AnswerPositionBySubjectItem[] | null
  responseTimeDistribution: ResponseTimeDistributionData | null
  gauntletEda: GauntletEdaStats | null

  // Loading flags (true if initial load pending and no data cached)
  loading: {
    contentCoverage: boolean
    tosCoverageMatrix: boolean
    questionLengthDistribution: boolean
    answerPositionCounts: boolean
    answerPositionBySubject: boolean
    responseTimeDistribution: boolean
    gauntletEda: boolean
  }

  // Error messages
  errors: {
    contentCoverage: string | null
    tosCoverageMatrix: string | null
    questionLengthDistribution: string | null
    answerPositionCounts: string | null
    answerPositionBySubject: string | null
    responseTimeDistribution: string | null
    gauntletEda: string | null
  }

  loadedVersion: number | null

  // Actions
  fetchContentCoverage: (force?: boolean) => Promise<void>
  fetchTosCoverageMatrix: (force?: boolean) => Promise<void>
  fetchQuestionLengthDistribution: (force?: boolean) => Promise<void>
  fetchAnswerPositionCounts: (force?: boolean) => Promise<void>
  fetchAnswerPositionBySubject: (force?: boolean) => Promise<void>
  fetchResponseTimeDistribution: (force?: boolean) => Promise<void>
  fetchGauntletEda: (force?: boolean) => Promise<void>
  preloadAll: () => Promise<void>
  reset: () => void
}

const initialLoading = {
  contentCoverage: true,
  tosCoverageMatrix: true,
  questionLengthDistribution: true,
  answerPositionCounts: true,
  answerPositionBySubject: true,
  responseTimeDistribution: true,
  gauntletEda: true,
}

const initialErrors = {
  contentCoverage: null,
  tosCoverageMatrix: null,
  questionLengthDistribution: null,
  answerPositionCounts: null,
  answerPositionBySubject: null,
  responseTimeDistribution: null,
  gauntletEda: null,
}

export const useDataLabStore = create<DataLabState>((set, get) => ({
  contentCoverage: null,
  tosCoverageMatrix: null,
  questionLengthDistribution: null,
  answerPositionCounts: null,
  answerPositionBySubject: null,
  responseTimeDistribution: null,
  gauntletEda: null,

  loading: { ...initialLoading },
  errors: { ...initialErrors },
  loadedVersion: null,

  fetchContentCoverage: async (force = false) => {
    const { contentCoverage } = get()
    if (contentCoverage !== null && !force) return

    set((state) => ({
      loading: { ...state.loading, contentCoverage: state.contentCoverage === null },
      errors: { ...state.errors, contentCoverage: null },
    }))

    try {
      const res = await dbService.getContentCoverage()
      set((state) => ({
        contentCoverage: res,
        loading: { ...state.loading, contentCoverage: false },
        errors: { ...state.errors, contentCoverage: null },
      }))
    } catch (err: any) {
      set((state) => ({
        loading: { ...state.loading, contentCoverage: false },
        errors: { ...state.errors, contentCoverage: err?.message || 'Failed to load content coverage' },
      }))
    }
  },

  fetchTosCoverageMatrix: async (force = false) => {
    const { tosCoverageMatrix } = get()
    if (tosCoverageMatrix !== null && !force) return

    set((state) => ({
      loading: { ...state.loading, tosCoverageMatrix: state.tosCoverageMatrix === null },
      errors: { ...state.errors, tosCoverageMatrix: null },
    }))

    try {
      const res = await dbService.getTosCoverageMatrix()
      set((state) => ({
        tosCoverageMatrix: res,
        loading: { ...state.loading, tosCoverageMatrix: false },
        errors: { ...state.errors, tosCoverageMatrix: null },
      }))
    } catch (err: any) {
      set((state) => ({
        loading: { ...state.loading, tosCoverageMatrix: false },
        errors: { ...state.errors, tosCoverageMatrix: err?.message || 'Failed to load ToS coverage matrix' },
      }))
    }
  },

  fetchQuestionLengthDistribution: async (force = false) => {
    const { questionLengthDistribution } = get()
    if (questionLengthDistribution !== null && !force) return

    set((state) => ({
      loading: { ...state.loading, questionLengthDistribution: state.questionLengthDistribution === null },
      errors: { ...state.errors, questionLengthDistribution: null },
    }))

    try {
      const res = await dbService.getQuestionLengthDistribution()
      set((state) => ({
        questionLengthDistribution: res,
        loading: { ...state.loading, questionLengthDistribution: false },
        errors: { ...state.errors, questionLengthDistribution: null },
      }))
    } catch (err: any) {
      set((state) => ({
        loading: { ...state.loading, questionLengthDistribution: false },
        errors: { ...state.errors, questionLengthDistribution: err?.message || 'Failed to load question length distribution' },
      }))
    }
  },

  fetchAnswerPositionCounts: async (force = false) => {
    const { answerPositionCounts } = get()
    if (answerPositionCounts !== null && !force) return

    set((state) => ({
      loading: { ...state.loading, answerPositionCounts: state.answerPositionCounts === null },
      errors: { ...state.errors, answerPositionCounts: null },
    }))

    try {
      const res = await dbService.getAnswerPositionCounts()
      set((state) => ({
        answerPositionCounts: res,
        loading: { ...state.loading, answerPositionCounts: false },
        errors: { ...state.errors, answerPositionCounts: null },
      }))
    } catch (err: any) {
      set((state) => ({
        loading: { ...state.loading, answerPositionCounts: false },
        errors: { ...state.errors, answerPositionCounts: err?.message || 'Failed to load answer position counts' },
      }))
    }
  },

  fetchAnswerPositionBySubject: async (force = false) => {
    const { answerPositionBySubject } = get()
    if (answerPositionBySubject !== null && !force) return

    set((state) => ({
      loading: { ...state.loading, answerPositionBySubject: state.answerPositionBySubject === null },
      errors: { ...state.errors, answerPositionBySubject: null },
    }))

    try {
      const res = await dbService.getAnswerPositionBySubject()
      set((state) => ({
        answerPositionBySubject: res,
        loading: { ...state.loading, answerPositionBySubject: false },
        errors: { ...state.errors, answerPositionBySubject: null },
      }))
    } catch (err: any) {
      set((state) => ({
        loading: { ...state.loading, answerPositionBySubject: false },
        errors: { ...state.errors, answerPositionBySubject: err?.message || 'Failed to load answer position breakdown' },
      }))
    }
  },

  fetchResponseTimeDistribution: async (force = false) => {
    const { responseTimeDistribution } = get()
    if (responseTimeDistribution !== null && !force) return

    set((state) => ({
      loading: { ...state.loading, responseTimeDistribution: state.responseTimeDistribution === null },
      errors: { ...state.errors, responseTimeDistribution: null },
    }))

    try {
      const res = await dbService.getResponseTimeDistribution()
      set((state) => ({
        responseTimeDistribution: res,
        loading: { ...state.loading, responseTimeDistribution: false },
        errors: { ...state.errors, responseTimeDistribution: null },
      }))
    } catch (err: any) {
      set((state) => ({
        loading: { ...state.loading, responseTimeDistribution: false },
        errors: { ...state.errors, responseTimeDistribution: err?.message || 'Failed to load response time distribution' },
      }))
    }
  },

  fetchGauntletEda: async (force = false) => {
    const { gauntletEda } = get()
    if (gauntletEda !== null && !force) return

    set((state) => ({
      loading: { ...state.loading, gauntletEda: state.gauntletEda === null },
      errors: { ...state.errors, gauntletEda: null },
    }))

    try {
      const res = await gauntletService.getEdaStats()
      set((state) => ({
        gauntletEda: res,
        loading: { ...state.loading, gauntletEda: false },
        errors: { ...state.errors, gauntletEda: null },
      }))
    } catch (err: any) {
      set((state) => ({
        loading: { ...state.loading, gauntletEda: false },
        errors: { ...state.errors, gauntletEda: err?.message || 'Failed to load Gauntlet EDA stats' },
      }))
    }
  },

  preloadAll: async () => {
    if (isPreloading) return
    isPreloading = true
    try {
      const currentVersion = useDataVersionStore.getState().version
      await Promise.allSettled([
        get().fetchContentCoverage(true),
        get().fetchTosCoverageMatrix(true),
        get().fetchQuestionLengthDistribution(true),
        get().fetchAnswerPositionCounts(true),
        get().fetchAnswerPositionBySubject(true),
        get().fetchResponseTimeDistribution(true),
        get().fetchGauntletEda(true),
      ])
      set({ loadedVersion: currentVersion })
    } finally {
      isPreloading = false
    }
  },

  reset: () => {
    set({
      contentCoverage: null,
      tosCoverageMatrix: null,
      questionLengthDistribution: null,
      answerPositionCounts: null,
      answerPositionBySubject: null,
      responseTimeDistribution: null,
      gauntletEda: null,
      loading: { ...initialLoading },
      errors: { ...initialErrors },
      loadedVersion: null,
    })
  },
}))

let isPreloading = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Auto-refresh cache whenever database writes occur (debounced to avoid thrashing during rapid writes)
useDataVersionStore.subscribe((state, prevState) => {
  if (state.version !== prevState?.version) {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      useDataLabStore.getState().preloadAll()
    }, 300)
  }
})
