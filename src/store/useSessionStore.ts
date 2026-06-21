import { create } from 'zustand'
import { Card } from '../types'
import { calculateSM2 } from '../lib/sm2'
import { dbService } from '../services/db.service'

interface SessionStats {
  again: number
  hard: number
  good: number
  easy: number
}

interface SessionStore {
  currentDeck: Card[]
  currentIndex: number
  isFlipped: boolean
  sessionStats: SessionStats
  isFinished: boolean
  /** True while a DB write is in-flight; blocks concurrent rateCard calls. */
  isSubmitting: boolean
  startSession: (cards: Card[]) => void
  flipCard: () => void
  rateCard: (quality: number) => Promise<void>
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  currentDeck: [],
  currentIndex: 0,
  isFlipped: false,
  sessionStats: { again: 0, hard: 0, good: 0, easy: 0 },
  isFinished: false,
  isSubmitting: false,

  startSession: (cards) => {
    set({
      currentDeck: cards,
      currentIndex: 0,
      isFlipped: false,
      sessionStats: { again: 0, hard: 0, good: 0, easy: 0 },
      isFinished: cards.length === 0,
    })
  },

  flipCard: () => set((state) => ({ isFlipped: !state.isFlipped })),

  rateCard: async (quality) => {
    const state = get()

    // Strict submission lock: reject any concurrent rating while a DB write is in-flight.
    if (state.isSubmitting || state.isFinished || state.currentIndex >= state.currentDeck.length) return

    set({ isSubmitting: true })

    try {
      const currentCard = state.currentDeck[state.currentIndex]

      // Load prior SM2 state from DB; fall back to defaults on first review
      const previousRepetitions = currentCard.repetitions ?? 0
      const previousInterval    = currentCard.interval    ?? 1
      const previousEaseFactor  = currentCard.easeFactor  ?? 2.5

      const { interval, repetitions, easeFactor } = calculateSM2(
        quality,
        previousRepetitions,
        previousInterval,
        previousEaseFactor
      )

      // Build a plain local date string (YYYY-MM-DD) — no UTC shift.
      // toISOString() would convert local time to UTC, causing premature due
      // cards in UTC+ timezones. The DB queries compare against date('now','localtime').
      const nextReviewDate = new Date()
      nextReviewDate.setDate(nextReviewDate.getDate() + interval)
      const pad = (n: number) => String(n).padStart(2, '0')
      const nextReviewStr = `${nextReviewDate.getFullYear()}-${pad(nextReviewDate.getMonth() + 1)}-${pad(nextReviewDate.getDate())}`

      // quality 3 (Good) or 4 (Easy) = correct answer; 1 (Again) or 2 (Hard) = incorrect
      const isCorrect = quality >= 3

      await dbService.saveProgress(currentCard.id, {
        easeFactor,
        interval,
        repetitions,
        nextReview: nextReviewStr,           // e.g. "2026-06-15" — plain local date, no time component
        lastReviewed: new Date().toISOString() // full ISO kept for display/history only
      }, isCorrect)

      // Re-read state after the await — index may not have changed but sessionStats
      // must be computed from the snapshot captured before the await.
      const newStats = { ...get().sessionStats }
      if (quality === 1) newStats.again++
      else if (quality === 2) newStats.hard++
      else if (quality === 3) newStats.good++
      else if (quality === 4) newStats.easy++

      const nextIndex = state.currentIndex + 1
      const isFinished = nextIndex >= state.currentDeck.length

      set({
        sessionStats: newStats,
        currentIndex: nextIndex,
        isFlipped: false,
        isFinished,
      })
    } finally {
      // Always release the lock — even if the DB write throws (ErrorBoundary handles the throw).
      set({ isSubmitting: false })
    }
  }
}))

