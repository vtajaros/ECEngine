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
  startSession: (cards: Card[]) => void
  flipCard: () => void
  rateCard: (quality: number) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  currentDeck: [],
  currentIndex: 0,
  isFlipped: false,
  sessionStats: { again: 0, hard: 0, good: 0, easy: 0 },
  isFinished: false,

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

  rateCard: (quality) => {
    const state = get()
    if (state.isFinished || state.currentIndex >= state.currentDeck.length) return

    const currentCard = state.currentDeck[state.currentIndex]

    // Default mock values if progress isn't retrieved beforehand
    const previousRepetitions = 0
    const previousInterval = 1
    const previousEaseFactor = 2.5

    const { interval, repetitions, easeFactor } = calculateSM2(
      quality,
      previousRepetitions,
      previousInterval,
      previousEaseFactor
    )

    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + interval)

    dbService.saveProgress(currentCard.id, {
      easeFactor,
      interval,
      repetitions,
      nextReview: nextReview.toISOString(),
      lastReviewed: new Date().toISOString()
    })

    const newStats = { ...state.sessionStats }
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
      isFinished
    })
  }
}))

