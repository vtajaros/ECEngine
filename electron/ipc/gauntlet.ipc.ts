// electron/ipc/gauntlet.ipc.ts
import { ipcMain } from 'electron'
import { z } from 'zod'
import { getDB } from '../db/database'
import * as G from '../db/gauntlet'

const SubjectSchema = z.enum(['MATH', 'GEAS', 'ELECS', 'EST'])
const RatingEntry = z.object({ rating: z.number(), answers: z.number().int().nonnegative() })
const RatingsMapSchema = z.object({
  MATH: RatingEntry.optional(), GEAS: RatingEntry.optional(),
  ELECS: RatingEntry.optional(), EST: RatingEntry.optional(),
})

const GetQuestionsSchema = z.object({
  counts: z.array(z.object({ subject: SubjectSchema, count: z.number().int().min(0).max(500) })).min(1),
  excludeIds: z.array(z.string()).max(5000).optional().default([]),
  allowSolutions: z.boolean().optional().default(false),
  tosTopicId: z.string().optional(),
  tosTopicIds: z.array(z.string()).optional(),
})

const AnswerSchema = z.object({
  seq: z.number().int().nonnegative(),
  cardId: z.string().min(1),
  subject: SubjectSchema,
  chosen: z.number().int().nullable(),
  answerIndex: z.number().int(),
  outcome: z.enum(['correct', 'wrong', 'skipped', 'timeout']),
  timeMs: z.number().int().nonnegative(),
  parMs: z.number().int().nonnegative(),
  points: z.number().int(),
  streakAfter: z.number().int().nonnegative(),
  choices: z.array(z.string()),
  answeredAt: z.number(),
})

const SaveRunSchema = z.object({
  id: z.string().min(1),
  startedAt: z.number(),
  endedAt: z.number(),
  mode: z.enum(['survival', 'timed']),
  config: z.unknown(),
  rated: z.boolean(),
  score: z.number().int(),
  answered: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  wrong: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  bestStreak: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  endReason: z.enum(['time', 'lives', 'queue', 'quit']),
  ratingsBefore: RatingsMapSchema.optional(),
  ratingsAfter: RatingsMapSchema.optional(),
  subjectBreakdown: z.unknown().optional(),
  answers: z.array(AnswerSchema).max(5000),
})

const GetRunsSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
}).default({ limit: 50, offset: 0 })

const FlagQuestionSchema = z.object({
  cardId: z.string().min(1),
  reason: z.string().max(500).optional(),
})

const UnflagQuestionSchema = z.object({
  cardId: z.string().min(1),
})

const GetFlaggedQuestionsSchema = z.object({
  cardIds: z.array(z.string().min(1)).optional(),
}).optional()

const GetExcludedQuestionsSchema = z.object({
  type: z.enum(['flagged', 'problem_solving', 'all']).optional(),
  subject: z.string().optional(),
  reason: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
}).optional()

const ReinsertQuestionsSchema = z.object({
  cardIds: z.array(z.string().min(1)),
})

const GetTopicAccuracyStatsSchema = z.object({
  subject: SubjectSchema.optional(),
  scope: z.enum(['gauntlet', 'all']).optional().default('gauntlet'),
  sortBy: z.enum(['code', 'accuracy_asc', 'accuracy_desc', 'misses', 'attempts']).optional().default('code'),
}).optional()

const fail = (e: unknown) => ({ success: false, error: (e as Error).message })

export function registerGauntletHandlers(): void {
  ipcMain.handle('gauntlet:getPoolSizes', async (_, payload?: { allowSolutions?: boolean; tosTopicId?: string; tosTopicIds?: string[] }) => {
    try {
      return {
        success: true,
        data: G.getPoolSizes(getDB(), {
          allowSolutions: payload?.allowSolutions ?? false,
          tosTopicId: payload?.tosTopicId,
          tosTopicIds: payload?.tosTopicIds,
        }),
      }
    } catch (e) { return fail(e) }
  })

  ipcMain.handle('gauntlet:getQuestions', async (_, payload: unknown) => {
    try {
      const { counts, excludeIds, allowSolutions, tosTopicId, tosTopicIds } = GetQuestionsSchema.parse(payload)
      const db = getDB()
      const rows = counts.flatMap(({ subject, count }) =>
        G.sampleQuestions(db, subject, count, excludeIds, { allowSolutions, tosTopicId, tosTopicIds }),
      )
      return { success: true, data: rows }
    } catch (e) { return fail(e) }
  })

  ipcMain.handle('gauntlet:getRatings', async () => {
    try { return { success: true, data: G.getRatings(getDB()) } } catch (e) { return fail(e) }
  })

  ipcMain.handle('gauntlet:saveRun', async (_, payload: unknown) => {
    try {
      G.saveRun(getDB(), SaveRunSchema.parse(payload))
      return { success: true }
    } catch (e) { return fail(e) }
  })

  ipcMain.handle('gauntlet:getRuns', async (_, payload: unknown) => {
    try {
      const { limit, offset } = GetRunsSchema.parse(payload)
      return { success: true, data: G.getRuns(getDB(), limit, offset) }
    } catch (e) { return fail(e) }
  })

  ipcMain.handle('gauntlet:getRunAnswers', async (_, runId: unknown) => {
    try { return { success: true, data: G.getRunAnswers(getDB(), z.string().min(1).parse(runId)) } } catch (e) { return fail(e) }
  })

  ipcMain.handle('gauntlet:getBests', async () => {
    try { return { success: true, data: G.getBests(getDB()) } } catch (e) { return fail(e) }
  })

  ipcMain.handle(
    'gauntlet:getWeakTosTopics',
    async (
      _,
      payload: {
        subject?: G.GauntletSubjectCode
        limit?: number
        mode?: 'all' | 'survival' | 'timed'
        sortBy?: 'misses' | 'accuracy'
      } = {},
    ) => {
      try {
        return {
          success: true,
          data: G.getWeakTosTopics(
            getDB(),
            payload?.subject,
            payload?.limit,
            payload?.mode,
            payload?.sortBy,
          ),
        }
      } catch (e) {
        return fail(e)
      }
    },
  )

  ipcMain.handle('gauntlet:rewardReviewElo', async (_, subject: unknown) => {
    try {
      const code = z.string().min(1).parse(subject)
      return { success: true, data: G.rewardReviewElo(getDB(), code) }
    } catch (e) { return fail(e) }
  })

  ipcMain.handle('gauntlet:getPaceStats', async () => {
    try { return { success: true, data: G.getPaceStats(getDB()) } } catch (e) { return fail(e) }
  })

  ipcMain.handle('gauntlet:resetRatings', async () => {
    try {
      G.resetRatings(getDB())
      return { success: true }
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle('gauntlet:flagQuestion', async (_, payload: unknown) => {
    try {
      const { cardId, reason } = FlagQuestionSchema.parse(payload)
      G.flagQuestion(getDB(), cardId, reason)
      return { success: true }
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle('gauntlet:unflagQuestion', async (_, payload: unknown) => {
    try {
      const { cardId } = UnflagQuestionSchema.parse(payload)
      G.unflagQuestion(getDB(), cardId)
      return { success: true }
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle('gauntlet:getFlaggedQuestions', async (_, payload: unknown) => {
    try {
      const parsed = GetFlaggedQuestionsSchema.parse(payload)
      return { success: true, data: G.getFlaggedQuestions(getDB(), parsed?.cardIds) }
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle('gauntlet:getEdaStats', async () => {
    try {
      return { success: true, data: G.getGauntletEdaStats(getDB()) }
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle('gauntlet:getExcludedQuestions', async (_, payload: unknown) => {
    try {
      const parsed = GetExcludedQuestionsSchema.parse(payload)
      return { success: true, data: G.getExcludedGauntletQuestions(getDB(), parsed) }
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle('gauntlet:reinsertQuestions', async (_, payload: unknown) => {
    try {
      const { cardIds } = ReinsertQuestionsSchema.parse(payload)
      G.reinsertQuestions(getDB(), cardIds)
      return { success: true }
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle('gauntlet:getTopicAccuracyStats', async (_, payload: unknown) => {
    try {
      const parsed = GetTopicAccuracyStatsSchema.parse(payload)
      return {
        success: true,
        data: G.getTosTopicPerformanceStats(
          getDB(),
          parsed?.subject,
          parsed?.scope ?? 'gauntlet',
          parsed?.sortBy ?? 'code',
        ),
      }
    } catch (e) {
      return fail(e)
    }
  })
}

