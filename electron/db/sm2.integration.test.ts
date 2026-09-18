// electron/db/sm2.integration.test.ts
// Integration test suite verifying end-to-end SM-2 lifecycle:
// Database query -> SM-2 calculation -> SQLite persistence -> State reload -> Due scheduling.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { calculateSM2 } from '../../src/lib/sm2'

describe('SM-2 Database and Scheduling Integration', () => {
  let db: Database.Database

  const BASE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      difficulty TEXT,
      tags TEXT,
      is_custom BOOLEAN DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS progress (
      card_id TEXT PRIMARY KEY,
      ease_factor REAL DEFAULT 2.5,
      interval INTEGER DEFAULT 1,
      repetitions INTEGER DEFAULT 0,
      next_review TEXT,
      last_reviewed TEXT,
      correct_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      last_result TEXT
    );
  `

  function queryCardsWithProgress(topicId: string, options?: { dueOnly?: boolean }) {
    let sql = `
      SELECT c.id, c.topic_id, c.type, c.data, c.tags, c.difficulty, c.is_custom, c.order_index, c.created_at,
             COALESCE(p.ease_factor, 2.5)    AS ease_factor,
             COALESCE(p.repetitions, 0)      AS repetitions,
             COALESCE(p.interval, 1)         AS interval,
             p.next_review                   AS next_review,
             p.last_reviewed                 AS last_reviewed,
             COALESCE(p.correct_count, 0)    AS correct_count,
             COALESCE(p.total_count, 0)      AS total_count,
             p.last_result                   AS last_result
      FROM cards c
      LEFT JOIN progress p ON c.id = p.card_id
      WHERE c.topic_id = ?
    `
    const params: unknown[] = [topicId]

    if (options?.dueOnly) {
      sql += ` AND (p.next_review IS NULL OR p.next_review = '' OR p.next_review <= date('now', 'localtime'))`
      sql += ` ORDER BY
        CASE WHEN p.next_review IS NULL OR p.next_review = '' THEN 0 ELSE 1 END ASC,
        p.next_review ASC,
        c.order_index ASC,
        c.created_at ASC`
    } else {
      sql += ` ORDER BY c.order_index ASC, c.created_at ASC`
    }

    return db.prepare(sql).all(params) as Array<{
      id: string
      topic_id: string
      type: string
      data: string
      ease_factor: number
      repetitions: number
      interval: number
      next_review: string | null
      last_reviewed: string | null
      correct_count: number
      total_count: number
      last_result: string | null
    }>
  }

  function saveProgress(payload: {
    cardId: string
    easeFactor: number
    interval: number
    repetitions: number
    nextReview: string
    lastReviewed: string
    correctIncrement: number
    lastResult: string
  }) {
    const sql = `
      INSERT INTO progress
        (card_id, ease_factor, interval, repetitions, next_review, last_reviewed,
         correct_count, total_count, last_result)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(card_id) DO UPDATE SET
        ease_factor   = excluded.ease_factor,
        interval      = excluded.interval,
        repetitions   = excluded.repetitions,
        next_review   = excluded.next_review,
        last_reviewed = excluded.last_reviewed,
        total_count   = total_count + 1,
        correct_count = correct_count + ?,
        last_result   = excluded.last_result
    `
    db.prepare(sql).run([
      payload.cardId,
      payload.easeFactor,
      payload.interval,
      payload.repetitions,
      payload.nextReview,
      payload.lastReviewed,
      payload.correctIncrement,
      payload.lastResult,
      payload.correctIncrement,
    ])
  }

  beforeEach(() => {
    db = new Database(':memory:')
    db.exec(BASE_SCHEMA)
    db.prepare('INSERT INTO topics (id, name, subject) VALUES (?, ?, ?)').run('topic-test', 'Test Deck', 'ELECS')
  })

  afterEach(() => {
    db.close()
  })

  it('20-Card Acceptance Test: session 1 ratings persist, future cards excluded, state restored', () => {
    // 1. Initial deck: 20 cards, all completely new
    const insertCard = db.prepare('INSERT INTO cards (id, topic_id, type, data, order_index) VALUES (?, ?, ?, ?, ?)')
    for (let i = 1; i <= 20; i++) {
      insertCard.run(`card-${i}`, 'topic-test', 'flashcard', JSON.stringify({ front: `Q${i}`, back: `A${i}` }), i)
    }

    // Initial query before any review: all 20 cards are due (unreviewed)
    const initialDue = queryCardsWithProgress('topic-test', { dueOnly: true })
    expect(initialDue).toHaveLength(20)
    for (const card of initialDue) {
      expect(card.repetitions).toBe(0)
      expect(card.interval).toBe(1)
      expect(card.ease_factor).toBe(2.5)
      expect(card.next_review).toBeNull()
    }

    // 2. Session 1: 5 rated Easy (4), 10 rated Good (3), 5 rated Hard (2)
    const today = db.prepare("SELECT date('now', 'localtime') as d").get() as { d: string }
    const nowISO = new Date().toISOString()

    for (let i = 0; i < 20; i++) {
      const card = initialDue[i]
      let quality: number
      if (i < 5) quality = 4       // 5 Easy
      else if (i < 15) quality = 3 // 10 Good
      else quality = 2             // 5 Hard

      const sm2 = calculateSM2(quality, card.repetitions, card.interval, card.ease_factor)

      // Calculate next review date using local date logic
      const nextDate = db.prepare(`SELECT date('now', 'localtime', '+${sm2.interval} day') as d`).get() as { d: string }

      saveProgress({
        cardId: card.id,
        easeFactor: sm2.easeFactor,
        interval: sm2.interval,
        repetitions: sm2.repetitions,
        nextReview: nextDate.d,
        lastReviewed: nowISO,
        correctIncrement: quality >= 3 ? 1 : 0,
        lastResult: quality >= 3 ? 'correct' : 'wrong',
      })
    }

    // 3. Immediately reopen deck today:
    // Future cards must NOT be returned in the normal due-review set!
    const dueToday = queryCardsWithProgress('topic-test', { dueOnly: true })
    expect(dueToday).toHaveLength(0)

    // 4. Loading all cards with progress shows individual persisted states
    const allCards = queryCardsWithProgress('topic-test', { dueOnly: false })
    expect(allCards).toHaveLength(20)

    // Verify 5 Easy cards: repetitions=1, interval=1, easeFactor=2.65
    for (let i = 0; i < 5; i++) {
      expect(allCards[i].repetitions).toBe(1)
      expect(allCards[i].interval).toBe(1)
      expect(allCards[i].ease_factor).toBe(2.65)
      expect(allCards[i].last_result).toBe('correct')
    }

    // Verify 10 Good cards: repetitions=1, interval=1, easeFactor=2.36
    for (let i = 5; i < 15; i++) {
      expect(allCards[i].repetitions).toBe(1)
      expect(allCards[i].interval).toBe(1)
      expect(allCards[i].ease_factor).toBeCloseTo(2.36, 2)
      expect(allCards[i].last_result).toBe('correct')
    }

    // Verify 5 Hard cards: repetitions=0, interval=1, easeFactor=2.18
    for (let i = 15; i < 20; i++) {
      expect(allCards[i].repetitions).toBe(0)
      expect(allCards[i].interval).toBe(1)
      expect(allCards[i].ease_factor).toBeCloseTo(2.18, 2)
      expect(allCards[i].last_result).toBe('wrong')
    }

    // 5. Add 1 new card to the deck: new card must be eligible even though other 20 are in the future
    insertCard.run('card-21', 'topic-test', 'flashcard', JSON.stringify({ front: 'Q21', back: 'A21' }), 21)
    const dueWithNew = queryCardsWithProgress('topic-test', { dueOnly: true })
    expect(dueWithNew).toHaveLength(1)
    expect(dueWithNew[0].id).toBe('card-21')
    expect(dueWithNew[0].repetitions).toBe(0)
    expect(dueWithNew[0].ease_factor).toBe(2.5)

    // 6. Simulate tomorrow: all 20 cards become due, loaded with their exact persisted SM-2 state
    db.prepare("UPDATE progress SET next_review = date('now', 'localtime')").run()
    const dueTomorrow = queryCardsWithProgress('topic-test', { dueOnly: true })
    // 20 previously reviewed cards + 1 new card = 21 due cards
    expect(dueTomorrow).toHaveLength(21)

    // Find the first Easy card from dueTomorrow
    const easyCard = dueTomorrow.find(c => c.id === 'card-1')!
    expect(easyCard.repetitions).toBe(1)
    expect(easyCard.interval).toBe(1)
    expect(easyCard.ease_factor).toBe(2.65)
  })

  it('Second-Review Acceptance Test: single card preserves state across session boundary', () => {
    // Start: new card (reps=0, interval=1, easeFactor=2.5)
    db.prepare('INSERT INTO cards (id, topic_id, type, data, order_index) VALUES (?, ?, ?, ?, ?)').run(
      'card-single',
      'topic-test',
      'flashcard',
      JSON.stringify({ front: 'Front', back: 'Back' }),
      1
    )

    const session1Cards = queryCardsWithProgress('topic-test', { dueOnly: true })
    expect(session1Cards).toHaveLength(1)
    const card = session1Cards[0]
    expect(card.repetitions).toBe(0)
    expect(card.interval).toBe(1)
    expect(card.ease_factor).toBe(2.5)

    // First review: rate Easy (4)
    const sm2First = calculateSM2(4, card.repetitions, card.interval, card.ease_factor)
    expect(sm2First.repetitions).toBe(1)
    expect(sm2First.interval).toBe(1)
    expect(sm2First.easeFactor).toBe(2.65)

    const tomorrow = db.prepare("SELECT date('now', 'localtime', '+1 day') as d").get() as { d: string }
    saveProgress({
      cardId: card.id,
      easeFactor: sm2First.easeFactor,
      interval: sm2First.interval,
      repetitions: sm2First.repetitions,
      nextReview: tomorrow.d,
      lastReviewed: new Date().toISOString(),
      correctIncrement: 1,
      lastResult: 'correct',
    })

    // Reopen deck today: card is not due today
    const reopenedToday = queryCardsWithProgress('topic-test', { dueOnly: true })
    expect(reopenedToday).toHaveLength(0)

    // Simulate due date arrival (next_review reaches today)
    db.prepare("UPDATE progress SET next_review = date('now', 'localtime') WHERE card_id = 'card-single'").run()

    // Session 2: load due cards
    const session2Cards = queryCardsWithProgress('topic-test', { dueOnly: true })
    expect(session2Cards).toHaveLength(1)
    const loadedCard = session2Cards[0]

    // Verify the card is loaded with the saved state rather than 0 / 1 / 2.5
    expect(loadedCard.repetitions).toBe(1)
    expect(loadedCard.interval).toBe(1)
    expect(loadedCard.ease_factor).toBe(2.65)

    // Second review: rate Easy (4) again
    const sm2Second = calculateSM2(4, loadedCard.repetitions, loadedCard.interval, loadedCard.ease_factor)

    // Second calculation uses persisted values from first review:
    // reps = 1 + 1 = 2
    // interval = reps 1 -> 6
    // easeFactor = 2.65 + 0.15 = 2.80
    expect(sm2Second.repetitions).toBe(2)
    expect(sm2Second.interval).toBe(6)
    expect(sm2Second.easeFactor).toBe(2.8)

    // Persist second review
    const nextWeek = db.prepare(`SELECT date('now', 'localtime', '+${sm2Second.interval} day') as d`).get() as { d: string }
    saveProgress({
      cardId: loadedCard.id,
      easeFactor: sm2Second.easeFactor,
      interval: sm2Second.interval,
      repetitions: sm2Second.repetitions,
      nextReview: nextWeek.d,
      lastReviewed: new Date().toISOString(),
      correctIncrement: 1,
      lastResult: 'correct',
    })

    // Reopen deck: card is not due
    expect(queryCardsWithProgress('topic-test', { dueOnly: true })).toHaveLength(0)

    // Verify persisted state in DB
    const allCards = queryCardsWithProgress('topic-test', { dueOnly: false })
    expect(allCards[0].repetitions).toBe(2)
    expect(allCards[0].interval).toBe(6)
    expect(allCards[0].ease_factor).toBe(2.8)
    expect(allCards[0].total_count).toBe(2)
    expect(allCards[0].correct_count).toBe(2)
  })
})
