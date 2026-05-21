import { webDB, WebTopic, WebCard, WebProgress, WebStudyActivity } from './schema'
import { calculateSM2 } from '../../lib/sm2'
import { Card, Progress } from '../../types'

const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const webDBService = {
  async recordCardResult(cardId: string, correct: boolean): Promise<void> {
    const existing = await webDB.progress.get(cardId)
    const repetitions = existing?.repetitions ?? 0
    const interval = existing?.interval ?? 1
    const easeFactor = existing?.ease_factor ?? 2.5

    const quality = correct ? 4 : 1
    const sm2Result = calculateSM2(quality, repetitions, interval, easeFactor)

    const now = new Date()
    const nextReview = new Date(now.getTime() + sm2Result.interval * 86400000)

    const correctIncrement = correct ? 1 : 0
    const totalCount = (existing?.total_count ?? 0) + 1
    const correctCount = (existing?.correct_count ?? 0) + correctIncrement

    await webDB.progress.put({
      card_id: cardId,
      ease_factor: sm2Result.easeFactor,
      interval: sm2Result.interval,
      repetitions: sm2Result.repetitions,
      next_review: nextReview.toISOString(),
      last_reviewed: now.toISOString(),
      correct_count: correctCount,
      total_count: totalCount
    })

    await this.recordActivity(correct)
  },

  async saveProgress(
    cardId: string,
    progressUpdates: Partial<Progress>,
    isCorrect: boolean
  ): Promise<void> {
    const existing = await webDB.progress.get(cardId)
    const { easeFactor, interval, repetitions, nextReview, lastReviewed } = progressUpdates
    const correctIncrement = isCorrect ? 1 : 0
    const totalCount = (existing?.total_count ?? 0) + 1
    const correctCount = (existing?.correct_count ?? 0) + correctIncrement

    await webDB.progress.put({
      card_id: cardId,
      ease_factor: easeFactor ?? existing?.ease_factor ?? 2.5,
      interval: interval ?? existing?.interval ?? 1,
      repetitions: repetitions ?? existing?.repetitions ?? 0,
      next_review: nextReview ?? existing?.next_review ?? new Date().toISOString(),
      last_reviewed: lastReviewed ?? existing?.last_reviewed ?? new Date().toISOString(),
      correct_count: correctCount,
      total_count: totalCount
    })

    await this.recordActivity(isCorrect)
  },

  async getCards(topicId?: string): Promise<Card[]> {
    const cardsList = topicId
      ? await webDB.cards.where('topic_id').equals(topicId).toArray()
      : await webDB.cards.toArray()

    const nowStr = new Date().toISOString()
    const resultCards: Card[] = []

    for (const card of cardsList) {
      const prog = await webDB.progress.get(card.id)
      if (!prog || !prog.next_review || prog.next_review <= nowStr) {
        resultCards.push({
          id: card.id,
          topicId: card.topic_id,
          type: card.type as any,
          data: JSON.parse(card.data),
          difficulty: card.difficulty as any,
          tags: JSON.parse(card.tags || '[]'),
          isCustom: Boolean(card.is_custom),
          createdAt: card.created_at
        })
      }
    }

    const shuffled = resultCards.sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 100)
  },

  async getProgress(cardId: string): Promise<{ repetitions: number; interval: number; easeFactor: number } | null> {
    const row = await webDB.progress.get(cardId)
    if (!row) return null
    return {
      repetitions: row.repetitions ?? 0,
      interval: row.interval ?? 1,
      easeFactor: row.ease_factor ?? 2.5
    }
  },

  async recordActivity(isCorrect?: boolean): Promise<void> {
    const today = toLocalDateString(new Date())
    await webDB.transaction('rw', [webDB.study_activity], async () => {
      const existing = await webDB.study_activity.where('day').equals(today).first()
      const correctInc = isCorrect ? 1 : 0
      const totalInc = isCorrect !== undefined ? 1 : 0

      if (existing) {
        await webDB.study_activity.update(existing.id!, {
          count: existing.count + 1,
          correct_count: existing.correct_count + correctInc,
          total_count: existing.total_count + totalInc
        })
      } else {
        await webDB.study_activity.add({
          day: today,
          count: 1,
          correct_count: correctInc,
          total_count: totalInc,
          time_spent: 0
        })
      }
    })
  },

  async getActivityHistory(): Promise<Record<string, { count: number; timeSpent: number }>> {
    const rows = await webDB.study_activity.toArray()
    const history: Record<string, { count: number; timeSpent: number }> = {}
    for (const row of rows) {
      history[row.day] = {
        count: row.count,
        timeSpent: row.time_spent || 0
      }
    }
    return history
  },

  async updateTimeSpent(minutes: number): Promise<void> {
    const today = toLocalDateString(new Date())
    await webDB.transaction('rw', [webDB.study_activity], async () => {
      const existing = await webDB.study_activity.where('day').equals(today).first()
      if (existing) {
        await webDB.study_activity.update(existing.id!, {
          time_spent: existing.time_spent + minutes
        })
      } else {
        await webDB.study_activity.add({
          day: today,
          count: 0,
          correct_count: 0,
          total_count: 0,
          time_spent: minutes
        })
      }
    })
  },

  async getDashboardStats(): Promise<{ totalStudied: number; dueToday: number; accuracy: number; streak: number }> {
    const studiedRows = await webDB.progress.filter(p => p.repetitions > 0).toArray()
    const totalStudied = studiedRows.length

    const cards = await webDB.cards.toArray()
    const nowStr = new Date().toISOString()
    let dueToday = 0
    for (const card of cards) {
      const prog = await webDB.progress.get(card.id)
      if (!prog || !prog.next_review || prog.next_review <= nowStr) {
        dueToday++
      }
    }

    const allProgress = await webDB.progress.toArray()
    let sumCorrect = 0
    let sumTotal = 0
    for (const p of allProgress) {
      sumCorrect += p.correct_count || 0
      sumTotal += p.total_count || 0
    }
    const accuracy = sumTotal > 0 ? Math.round((sumCorrect / sumTotal) * 100) : 0

    const activities = await webDB.study_activity.filter(a => a.time_spent > 0).toArray()
    activities.sort((a, b) => b.day.localeCompare(a.day))
    const dates = activities.map(a => a.day)

    let streak = 0
    if (dates.length > 0) {
      const today = toLocalDateString(new Date())
      const yesterdayDate = new Date()
      yesterdayDate.setDate(yesterdayDate.getDate() - 1)
      const yesterday = toLocalDateString(yesterdayDate)

      if (dates[0] !== today && dates[0] !== yesterday) {
        streak = 0
      } else {
        streak = 1
        for (let i = 0; i < dates.length - 1; i++) {
          const d1 = new Date(dates[i])
          const d2 = new Date(dates[i + 1])
          const diff = (d1.getTime() - d2.getTime()) / 86400000
          if (diff === 1) {
            streak++
          } else {
            break
          }
        }
      }
    }

    return { totalStudied, dueToday, accuracy, streak }
  },

  async getSubjectBreakdown(): Promise<any[]> {
    const topics = await webDB.topics.toArray()
    const subjectMap: Record<string, number> = {}
    for (const t of topics) {
      subjectMap[t.subject] = (subjectMap[t.subject] ?? 0) + 1
    }
    return Object.entries(subjectMap).map(([subject, count]) => ({ subject, count }))
  },

  async getSubjectProgress(): Promise<any[]> {
    const topics = await webDB.topics.toArray()
    const topicSubjectMap: Record<string, string> = {}
    for (const t of topics) {
      topicSubjectMap[t.id] = t.subject
    }

    const cards = await webDB.cards.toArray()
    const cardSubjectMap: Record<string, string> = {}
    for (const c of cards) {
      const subj = topicSubjectMap[c.topic_id]
      if (subj) {
        cardSubjectMap[c.id] = subj
      }
    }

    const progressList = await webDB.progress.toArray()
    const subjectCounts: Record<string, { correct: number; total: number }> = {}

    for (const p of progressList) {
      const subj = cardSubjectMap[p.card_id]
      if (subj) {
        if (!subjectCounts[subj]) {
          subjectCounts[subj] = { correct: 0, total: 0 }
        }
        subjectCounts[subj].correct += p.correct_count || 0
        subjectCounts[subj].total += p.total_count || 0
      }
    }

    const allSubjects = new Set(Object.values(topicSubjectMap))
    for (const subj of allSubjects) {
      if (!subjectCounts[subj]) {
        subjectCounts[subj] = { correct: 0, total: 0 }
      }
    }

    return Object.entries(subjectCounts).map(([subject, counts]) => ({
      subject,
      accuracy: counts.total > 0 ? (counts.correct / counts.total) : null
    }))
  },

  async getGlobalStats(): Promise<{ totalDecks: number; totalCards: number; internalized: number }> {
    const totalDecks = await webDB.topics.count()
    const totalCards = await webDB.cards.count()
    const internalized = await webDB.progress.filter(p => p.repetitions >= 5).count()
    return { totalDecks, totalCards, internalized }
  },

  async getCardsPrioritized(topicId: string): Promise<Card[]> {
    const cards = await webDB.cards.where('topic_id').equals(topicId).toArray()
    const nowStr = new Date().toISOString()

    const mapped: { card: Card; isPrioritized: boolean }[] = []
    for (const card of cards) {
      const prog = await webDB.progress.get(card.id)
      const isPrioritized = !prog || !prog.next_review || prog.next_review <= nowStr
      mapped.push({
        card: {
          id: card.id,
          topicId: card.topic_id,
          type: card.type as any,
          data: JSON.parse(card.data),
          difficulty: card.difficulty as any,
          tags: JSON.parse(card.tags || '[]'),
          isCustom: Boolean(card.is_custom),
          createdAt: card.created_at
        },
        isPrioritized
      })
    }

    mapped.sort((a, b) => {
      if (a.isPrioritized && !b.isPrioritized) return -1
      if (!a.isPrioritized && b.isPrioritized) return 1
      return Number(a.card.createdAt) - Number(b.card.createdAt)
    })

    return mapped.map(m => m.card)
  },

  async getAllCardsByTopic(topicId: string): Promise<Card[]> {
    const cards = await webDB.cards.where('topic_id').equals(topicId).toArray()
    const mapped = cards.map(card => ({
      id: card.id,
      topicId: card.topic_id,
      type: card.type as any,
      data: JSON.parse(card.data),
      difficulty: card.difficulty as any,
      tags: JSON.parse(card.tags || '[]'),
      isCustom: Boolean(card.is_custom),
      createdAt: card.created_at
    }))
    return mapped.sort((a, b) => Number(a.createdAt) - Number(b.createdAt))
  },

  async getAccuracyTrend(
    subject: 'ALL' | 'MATH' | 'GEAS' | 'ELECS' | 'EST',
    granularity: 'day' | 'week' | 'month'
  ): Promise<{ date: string; acc: number | null }[]> {
    const SUBJECT_FULL: Record<string, string> = {
      MATH:  'Mathematics',
      GEAS:  'General Engineering & Applied Sciences',
      ELECS: 'Electronics Engineering',
      EST:   'Electronics Systems & Technologies',
    }

    const toLocal = (d: Date): string => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dy = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dy}`
    }

    const lookback: Record<'day' | 'week' | 'month', number> = {
      day:   13,
      week:  55,
      month: 179,
    }

    const getMonday = (dateStr: string): string => {
      const d = new Date(dateStr + 'T00:00:00')
      const mon = new Date(d)
      mon.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      return toLocal(mon)
    }

    const bucketKey = (day: string): string => {
      if (granularity === 'day')  return day
      if (granularity === 'week') return getMonday(day)
      return day.slice(0, 7)
    }

    const bucketLabel = (day: string): string => {
      const d = new Date(day + 'T00:00:00')
      if (granularity === 'day') {
        return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
      }
      if (granularity === 'week') {
        const mon = new Date(getMonday(day) + 'T00:00:00')
        return mon.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
      }
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - lookback[granularity])
    const startStr = toLocal(startDate)

    type RawRow = { day: string; correct: number; total: number }
    let rawRows: RawRow[] = []

    if (subject === 'ALL') {
      const activities = await webDB.study_activity
        .filter(a => a.day >= startStr)
        .toArray()
      rawRows = activities.map(a => ({
        day: a.day,
        correct: a.correct_count || 0,
        total: a.total_count || 0
      }))
    } else {
      const fullSubject = SUBJECT_FULL[subject] ?? subject
      const topics = await webDB.topics.where('subject').equals(fullSubject).toArray()
      const topicIds = new Set(topics.map(t => t.id))

      const cards = await webDB.cards.toArray()
      const subjectCardIds = new Set(
        cards.filter(c => topicIds.has(c.topic_id)).map(c => c.id)
      )

      const progress = await webDB.progress.toArray()
      const byDateMap = new Map<string, { correct: number; total: number }>()

      for (const p of progress) {
        if (subjectCardIds.has(p.card_id) && p.last_reviewed) {
          const day = p.last_reviewed.slice(0, 10)
          if (day >= startStr) {
            const entry = byDateMap.get(day) || { correct: 0, total: 0 }
            entry.correct += p.correct_count || 0
            entry.total += p.total_count || 0
            byDateMap.set(day, entry)
          }
        }
      }

      rawRows = Array.from(byDateMap.entries()).map(([day, val]) => ({
        day,
        correct: val.correct,
        total: val.total
      }))
    }

    const bucketMap = new Map<string, { label: string; correct: number; total: number }>()

    for (const row of rawRows) {
      const key   = bucketKey(row.day)
      const label = bucketLabel(row.day)
      if (!bucketMap.has(key)) {
        bucketMap.set(key, { label, correct: 0, total: 0 })
      }
      const b = bucketMap.get(key)!
      b.correct += row.correct
      b.total   += row.total
    }

    return Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, b]) => ({
        date: b.label,
        acc:  b.total > 0 ? Math.round((b.correct / b.total) * 100) : null,
      }))
  },

  async clearAllData(): Promise<void> {
    await webDB.transaction('rw', [webDB.topics, webDB.cards, webDB.progress, webDB.study_activity, webDB.meta], async () => {
      await webDB.topics.clear()
      await webDB.cards.clear()
      await webDB.progress.clear()
      await webDB.study_activity.clear()
      await webDB.meta.clear()
    })
  },

  async exportDecks(): Promise<string> {
    const topics = await webDB.topics.toArray()
    const cards = await webDB.cards.toArray()
    const progress = await webDB.progress.toArray()
    return JSON.stringify({
      schema_version: 1,
      version: 1,
      topics,
      cards,
      progress
    }, null, 2)
  },

  async importDecks(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const parsed = JSON.parse(jsonData)
      if (!parsed.topics || !parsed.cards) {
        return { success: false, message: 'Invalid backup file format' }
      }

      await webDB.transaction('rw', [webDB.topics, webDB.cards, webDB.progress, webDB.study_activity, webDB.meta], async () => {
        await webDB.topics.clear()
        await webDB.cards.clear()
        await webDB.progress.clear()
        await webDB.study_activity.clear()

        await webDB.topics.bulkPut(parsed.topics)
        await webDB.cards.bulkPut(parsed.cards)

        if (parsed.progress && parsed.progress.length > 0) {
          await webDB.progress.bulkPut(parsed.progress)
        }
      })

      return { success: true, message: 'Decks and progress imported successfully' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to import backup' }
    }
  },

  async isSeeded(): Promise<boolean> {
    const record = await webDB.meta.get('seed_complete')
    return record?.value === 'true'
  },

  async seedFromDefault(data: any): Promise<void> {
    await webDB.transaction('rw', [webDB.topics, webDB.cards, webDB.meta], async () => {
      await webDB.topics.bulkPut(data.topics)
      await webDB.cards.bulkPut(data.cards)
      await webDB.meta.put({ key: 'seed_complete', value: 'true' })
      await webDB.meta.put({ key: 'schema_version', value: String(data.schema_version ?? data.version ?? 1) })
    })
  },

  async importBackup(payload: any): Promise<void> {
    try {
      const exportVersion = Number(payload.schema_version ?? payload.version ?? 1)
      const currentMeta = await webDB.meta.get('schema_version')
      const currentVersion = currentMeta ? Number(currentMeta.value) : 0

      if (currentVersion > 0 && exportVersion < currentVersion) {
        throw new Error(
          `Backup version ${exportVersion} is older than local version ${currentVersion}. Import aborted.`
        )
      }

      await webDB.transaction('rw', [
        webDB.topics, webDB.cards, webDB.progress,
        webDB.study_activity, webDB.meta
      ], async () => {
        await webDB.topics.clear()
        await webDB.cards.clear()
        await webDB.progress.clear()
        await webDB.study_activity.clear()

        if (payload.topics?.length) await webDB.topics.bulkPut(payload.topics)
        if (payload.cards?.length) await webDB.cards.bulkPut(payload.cards)
        if (payload.progress?.length) await webDB.progress.bulkPut(payload.progress)
        if (payload.study_activity?.length) await webDB.study_activity.bulkPut(payload.study_activity)

        await webDB.meta.put({ key: 'schema_version', value: String(exportVersion) })
        await webDB.meta.put({ key: 'seed_complete', value: 'true' })
      })
    } catch (err) {
      console.error('[importBackup] failed:', err)
      throw err
    }
  }
}