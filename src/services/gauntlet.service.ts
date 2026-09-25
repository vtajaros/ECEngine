import type { Card } from '../types'
import { parseCardRow, CardWithProgressRowSchema } from './db.service'
import { reshapeRunsToEloHistory, SubjectEloPoint } from '../lib/gauntlet'

export type GauntletSubjectCode = 'MATH' | 'GEAS' | 'ELECS' | 'EST'
export type { SubjectEloPoint }

export interface GauntletCard extends Card {
  subjectCode: GauntletSubjectCode
}

export const gauntletService = {
  async getPoolSizes(): Promise<Record<GauntletSubjectCode, number>> {
    const res = await window.electron.gauntlet.getPoolSizes()
    if (!res.success) throw new Error(res.error || 'Failed to get pool sizes')
    return res.data
  },

  async getQuestions(
    counts: Array<{ subject: GauntletSubjectCode; count: number }>,
    excludeIds?: string[],
  ): Promise<GauntletCard[]> {
    const res = await window.electron.gauntlet.getQuestions({ counts, excludeIds })
    if (!res.success) throw new Error(res.error || 'Failed to get questions')
    const rows = res.data || []
    return rows.map((r: any) => ({
      ...parseCardRow(CardWithProgressRowSchema.parse(r)),
      subjectCode: r.subject_code as GauntletSubjectCode,
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

  async getWeakTosTopics(opts?: { subject?: GauntletSubjectCode; limit?: number }) {
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
}
