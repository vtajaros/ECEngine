import { create } from 'zustand'
import { dbService, AccuracyGranularity, AccuracySubject } from '../services/db.service'
import { useDataVersionStore } from './useDataVersionStore'
import { SUBJECT_MAP } from '../lib/dashboardUtils'
import { FlashcardSchedule as FlashcardScheduleData } from '../types'

export interface DashboardStatsData {
  totalDecks: number
  totalCards: number
  flashcardCount: number
  mcqCount: number
  mcqAnswered: number
  totalStudied: number
  internalized: number
  accuracy: number
  streak: number
  dueToday: number
}

export interface SubjectCountItem {
  subject: string
  count: number
}

export interface SubjectProgressItem {
  subject: string
  percent: number
}

export interface DashboardState {
  statsData: DashboardStatsData
  subjectCounts: SubjectCountItem[]
  subjectProgress: SubjectProgressItem[]
  history: Record<string, { count: number; timeSpent: number }>
  trendCache: Record<string, { date: string; acc: number | null }[]>
  flashcardSchedule: FlashcardScheduleData | null

  isLoaded: boolean
  isLoading: boolean
  trendLoading: boolean
  scheduleLoading: boolean
  loadedVersion: number | null
  trendVersion: number | null
  scheduleVersion: number | null

  // Actions
  fetchDashboardData: (force?: boolean) => Promise<void>
  fetchAccuracyTrend: (
    subject: AccuracySubject,
    granularity: AccuracyGranularity,
    force?: boolean,
  ) => Promise<{ date: string; acc: number | null }[]>
  fetchFlashcardSchedule: (force?: boolean) => Promise<void>
  preloadAll: () => Promise<void>
  invalidate: () => void
}

const defaultStatsData: DashboardStatsData = {
  totalDecks: 0,
  totalCards: 0,
  flashcardCount: 0,
  mcqCount: 0,
  mcqAnswered: 0,
  totalStudied: 0,
  internalized: 0,
  accuracy: 0,
  streak: 0,
  dueToday: 0,
}

const defaultSubjectCounts: SubjectCountItem[] = [
  { subject: 'MATH', count: 0 },
  { subject: 'GEAS', count: 0 },
  { subject: 'ELECS', count: 0 },
  { subject: 'EST', count: 0 },
]

export const useDashboardStore = create<DashboardState>((set, get) => ({
  statsData: { ...defaultStatsData },
  subjectCounts: [...defaultSubjectCounts],
  subjectProgress: [],
  history: {},
  trendCache: {},
  flashcardSchedule: null,

  isLoaded: false,
  isLoading: false,
  trendLoading: false,
  scheduleLoading: false,
  loadedVersion: null,
  trendVersion: null,
  scheduleVersion: null,

  fetchDashboardData: async (force = false) => {
    const { isLoaded, loadedVersion } = get()
    const currentVersion = useDataVersionStore.getState().version

    if (isLoaded && loadedVersion === currentVersion && !force) {
      return
    }

    set({ isLoading: !isLoaded })

    try {
      const [dbStats, rawSubjectCounts, globalStats, rawSubjectProgress, activityHistory] =
        await Promise.all([
          dbService.getDashboardStats(),
          dbService.getSubjectBreakdown(),
          dbService.getGlobalStats(),
          dbService.getSubjectProgress(),
          dbService.getActivityHistory(),
        ])

      const subjects = ['MATH', 'GEAS', 'ELECS', 'EST']
      const formattedCounts: SubjectCountItem[] = subjects.map((s) => {
        const found = rawSubjectCounts.find((r: any) => (SUBJECT_MAP[r.subject] || r.subject) === s)
        return { subject: s, count: found ? found.count : 0 }
      })

      const formattedProgress: SubjectProgressItem[] = subjects.map((s) => {
        const found = rawSubjectProgress.find((r: any) => (SUBJECT_MAP[r.subject] || r.subject) === s)
        return {
          subject: s,
          percent: found && found.accuracy != null ? Math.round(found.accuracy * 100) : 0,
        }
      })

      set({
        statsData: {
          totalDecks: globalStats.totalDecks,
          totalCards: globalStats.totalCards,
          flashcardCount: globalStats.flashcardCount ?? 0,
          mcqCount: globalStats.mcqCount ?? 0,
          mcqAnswered: globalStats.mcqAnswered ?? 0,
          totalStudied: dbStats.totalStudied,
          internalized: globalStats.internalized,
          accuracy: dbStats.accuracy,
          streak: dbStats.streak,
          dueToday: dbStats.dueToday,
        },
        subjectCounts: formattedCounts,
        subjectProgress: formattedProgress,
        history: activityHistory,
        isLoaded: true,
        isLoading: false,
        loadedVersion: currentVersion,
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      set({ isLoading: false })
    }
  },

  fetchAccuracyTrend: async (
    subject: AccuracySubject,
    granularity: AccuracyGranularity,
    force = false,
  ) => {
    const key = `${subject}_${granularity}`
    const { trendCache, trendVersion } = get()
    const currentVersion = useDataVersionStore.getState().version

    if (trendCache[key] && trendVersion === currentVersion && !force) {
      return trendCache[key]
    }

    set({ trendLoading: !trendCache[key] })

    try {
      const data = await dbService.getAccuracyTrend(subject, granularity)
      set((state) => ({
        trendCache: { ...state.trendCache, [key]: data },
        trendLoading: false,
        trendVersion: currentVersion,
      }))
      return data
    } catch (error) {
      console.error('AccuracyTrend fetch failed:', error)
      set({ trendLoading: false })
      return trendCache[key] || []
    }
  },

  fetchFlashcardSchedule: async (force = false) => {
    const { flashcardSchedule, scheduleVersion } = get()
    const currentVersion = useDataVersionStore.getState().version

    if (flashcardSchedule !== null && scheduleVersion === currentVersion && !force) {
      return
    }

    set({ scheduleLoading: flashcardSchedule === null })

    try {
      const data = await dbService.getFlashcardSchedule()
      set({ flashcardSchedule: data, scheduleLoading: false, scheduleVersion: currentVersion })
    } catch (error) {
      console.error('Failed to load flashcard schedule:', error)
      set({ scheduleLoading: false })
    }
  },

  preloadAll: async () => {
    const store = get()
    await Promise.allSettled([
      store.fetchDashboardData(),
      store.fetchAccuracyTrend('ALL', 'day'),
      store.fetchFlashcardSchedule(),
    ])
  },

  invalidate: () => {
    set({ loadedVersion: null, trendVersion: null, scheduleVersion: null })
  },
}))
