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

const fail = (e: unknown) => ({ success: false, error: (e as Error).message })

export function registerGauntletHandlers(): void {
  ipcMain.handle('gauntlet:getPoolSizes', async () => {
    try { return { success: true, data: G.getPoolSizes(getDB()) } } catch (e) { return fail(e) }
  })

  ipcMain.handle('gauntlet:getQuestions', async (_, payload: unknown) => {
    try {
      const { counts, excludeIds } = GetQuestionsSchema.parse(payload)
      const db = getDB()
      const rows = counts.flatMap(({ subject, count }) => G.sampleQuestions(db, subject, count, excludeIds))
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
}
