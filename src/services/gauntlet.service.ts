import type { Card } from '../types'
import { parseCardRow, CardWithProgressRowSchema } from './db.service'
import { reshapeRunsToEloHistory, SubjectEloPoint } from '../lib/gauntlet'

export type GauntletSubjectCode = 'MATH' | 'GEAS' | 'ELECS' | 'EST'
export type { SubjectEloPoint }

export interface GauntletCard extends Card {
  subjectCode: GauntletSubjectCode
}

export type WeakTopicStat = {
  tosTopicId: string
  subject: GauntletSubjectCode
  totalAnswers: number
  correctAnswers: number
  wrongAnswers: number
  accuracy: number
}

export interface GauntletTosAccuracyItem {
  tosTopicId: string
  subject: GauntletSubjectCode
  totalAnswers: number
  correctAnswers: number
  wrongAnswers: number
  timeoutAnswers: number
  accuracy: number
  isWeak: boolean
}

export interface GauntletSpeedParItem {
  subject: GauntletSubjectCode
  totalAnswers: number
  avgTimeMs: number
  avgParMs: number
  speedRatio: number
  fastWrongCount: number
  wrongCount: number
  fastWrongRate: number
}

export interface GauntletEloTrajectoryPoint {
  date: string
  timestamp: number
  MATH: number | null
  GEAS: number | null
  ELECS: number | null
  EST: number | null
  overall: number | null
}

export interface GauntletCoverageDensityItem {
  subject: GauntletSubjectCode
  libraryCards: number
  arenaCards: number
  penetrationPct: number
}

export interface GauntletTopicCoverageItem {
  tosTopicId: string
  subject: GauntletSubjectCode
  libraryCards: number
  arenaCards: number
  penetrationPct: number
}

export interface GauntletEnduranceStats {
  totalRuns: number
  totalAnswers: number
  avgRunDurationSec: number
  avgRunScore: number
  avgQuestionsPerRun: number
  bestStreakOverall: number
  streakBuckets: Array<{
    bucket: string
    count: number
    pct: number
  }>
  failureModes: Array<{
    mode: string
    count: number
    pct: number
  }>
}

export interface GauntletEdaStats {
  tosAccuracy: GauntletTosAccuracyItem[]
  speedPar: GauntletSpeedParItem[]
  eloTrajectory: GauntletEloTrajectoryPoint[]
  currentRatings: Record<GauntletSubjectCode, { rating: number; peak: number; answers: number }>
  coverageDensity: {
    bySubject: GauntletCoverageDensityItem[]
    byTopic: GauntletTopicCoverageItem[]
    untestedBlindSpots: GauntletTopicCoverageItem[]
  }
  endurance: GauntletEnduranceStats
}

export const gauntletService = {
  async getPoolSizes(opts?: { allowSolutions?: boolean; tosTopicId?: string; tosTopicIds?: string[] } | boolean): Promise<Record<GauntletSubjectCode, number>> {
    const payload = typeof opts === 'boolean'
      ? { allowSolutions: opts }
      : opts
    const res = await window.electron.gauntlet.getPoolSizes(payload)
    if (!res.success) throw new Error(res.error || 'Failed to get pool sizes')
    return res.data
  },

  async getQuestions(
    counts: Array<{ subject: GauntletSubjectCode; count: number }>,
    excludeIds?: string[],
    allowSolutions?: boolean,
    tosTopicId?: string,
    tosTopicIds?: string[],
    scope?: 'gauntlet' | 'all',
  ): Promise<GauntletCard[]> {
    const res = await window.electron.gauntlet.getQuestions({ counts, excludeIds, allowSolutions, tosTopicId, tosTopicIds, scope: scope ?? 'all' })
    if (!res.success) throw new Error(res.error || 'Failed to get questions')
    const rows = res.data || []
    return rows.map((r: any) => ({
      ...parseCardRow(CardWithProgressRowSchema.parse(r)),
      subjectCode: r.subject_code as GauntletSubjectCode,
      deckName: r.deck_name as string | undefined,
      cardNumber: r.card_number as number | undefined,
      totalInDeck: r.total_in_deck as number | undefined,
    }))
  },

  async getRatings(): Promise<Array<{ subject: GauntletSubjectCode; rating: number; answers: number; peak: number | null }>> {
    const res = await window.electron.gauntlet.getRatings()
    if (!res.success) throw new Error(res.error || 'Failed to get ratings')
    return res.data
  },

  async saveRun(run: unknown): Promise<void> {
    const res = await window.electron.gauntlet.saveRun(run)
    if (!res.success) throw new Error(res.error || 'Failed to save run')
  },

  async getRuns(opts?: { limit?: number; offset?: number }): Promise<any[]> {
    const res = await window.electron.gauntlet.getRuns(opts)
    if (!res.success) throw new Error(res.error || 'Failed to get runs')
    return res.data ?? []
  },

  async getEloHistory(opts?: { limit?: number; offset?: number }): Promise<SubjectEloPoint[]> {
    const runs = await this.getRuns(opts)
    return reshapeRunsToEloHistory(runs)
  },

  async getRunAnswers(runId: string): Promise<any[]> {
    const res = await window.electron.gauntlet.getRunAnswers(runId)
    if (!res.success) throw new Error(res.error || 'Failed to get run answers')
    return res.data ?? []
  },

  async getBests(): Promise<Array<{ mode: string; bestScore: number; bestStreak: number; runs: number }>> {
    const res = await window.electron.gauntlet.getBests()
    if (!res.success) throw new Error(res.error || 'Failed to get bests')
    return res.data ?? []
  },

  async getPaceStats(): Promise<Partial<Record<GauntletSubjectCode, { n: number; avgMs: number }>>> {
    const res = await window.electron.gauntlet.getPaceStats()
    if (!res.success) throw new Error(res.error || 'Failed to get pace stats')
    const stats: Partial<Record<GauntletSubjectCode, { n: number; avgMs: number }>> = {}
    for (const item of res.data || []) {
      stats[item.subject as GauntletSubjectCode] = { n: item.n, avgMs: item.avgMs }
    }
    return stats
  },

  async resetRatings(): Promise<void> {
    const res = await window.electron.gauntlet.resetRatings()
    if (!res.success) throw new Error(res.error || 'Failed to reset ratings')
  },

  async rewardReviewElo(subject: string, count = 1): Promise<{ gained: number; newRating: number } | null> {
    try {
      const res = await window.electron.gauntlet.rewardReviewElo(subject, count)
      if (res?.success) return res.data ?? null
      return null
    } catch {
      return null
    }
  },

  async getWeakTosTopics(opts?: {
    subject?: GauntletSubjectCode
    limit?: number
    mode?: 'all' | 'survival' | 'timed'
    sortBy?: 'misses' | 'accuracy'
    scope?: 'gauntlet' | 'all'
  }) {
    const res = await window.electron.gauntlet.getWeakTosTopics(opts)
    if (!res.success) throw new Error(res.error || 'Failed to get weak TOS topics')
    return res.data ?? []
  },

  async flagQuestion(cardId: string, reason?: string): Promise<void> {
    const res = await window.electron.gauntlet.flagQuestion({ cardId, reason })
    if (!res.success) throw new Error(res.error || 'Failed to flag question')
  },

  async unflagQuestion(cardId: string): Promise<void> {
    const res = await window.electron.gauntlet.unflagQuestion({ cardId })
    if (!res.success) throw new Error(res.error || 'Failed to unflag question')
  },

  async getFlaggedQuestions(cardIds?: string[]): Promise<Record<string, { reason: string | null; flaggedAt: number }>> {
    const res = await window.electron.gauntlet.getFlaggedQuestions({ cardIds })
    if (!res.success) throw new Error(res.error || 'Failed to get flagged questions')
    return res.data ?? {}
  },

  async getEdaStats(): Promise<GauntletEdaStats> {
    const res = await window.electron.gauntlet.getEdaStats()
    if (!res.success) throw new Error(res.error || 'Failed to get Gauntlet EDA stats')
    return res.data
  },

  async getExcludedQuestions(options?: {
    type?: 'flagged' | 'problem_solving' | 'all'
    subject?: string
    reason?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<ExcludedGauntletResult> {
    const res = await window.electron.gauntlet.getExcludedQuestions(options)
    if (!res.success) throw new Error(res.error || 'Failed to get excluded Gauntlet questions')
    return res.data
  },

  async reinsertQuestions(cardIds: string[]): Promise<void> {
    const res = await window.electron.gauntlet.reinsertQuestions({ cardIds })
    if (!res.success) throw new Error(res.error || 'Failed to reinsert questions')
  },

  async getTopicAccuracyStats(options?: {
    subject?: GauntletSubjectCode
    scope?: 'gauntlet' | 'all'
    sortBy?: 'code' | 'accuracy_asc' | 'accuracy_desc' | 'misses' | 'attempts'
  }): Promise<TosTopicPerformanceStat[]> {
    const res = await window.electron.gauntlet.getTopicAccuracyStats(options)
    if (!res.success) throw new Error(res.error || 'Failed to get topic accuracy stats')
    return (res.data ?? []) as TosTopicPerformanceStat[]
  },
}

export interface TosTopicPerformanceStat {
  tosTopicId: string
  code: string
  subject: GauntletSubjectCode
  totalCards: number
  studiedCards: number
  totalAnswers: number
  correctAnswers: number
  wrongAnswers: number
  accuracy: number | null
  studyProgress: number
}

export interface ExcludedGauntletCard {
  id: string
  topicId: string
  type: string
  subject: GauntletSubjectCode
  deckName: string
  tosTopicId: string | null
  question: string
  choices: string[]
  answer: number
  explanation?: string
  imagePath?: string | null
  solutionImagePath?: string | null
  difficulty: string
  reason: string
  flaggedAt: number
  exclusionType: 'flagged' | 'problem_solving'
}

export interface ExcludedGauntletResult {
  cards: ExcludedGauntletCard[]
  total: number
  totalExcludedCount: number
  flaggedCount: number
  autoExcludedCount: number
  reasonsBreakdown: Record<string, number>
  subjectsBreakdown: Record<string, number>
}

