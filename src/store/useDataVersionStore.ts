import { create } from 'zustand'

interface DataVersionStore {
  version: number
  bump: () => void
}

/**
 * Module-level refresh signal for stats/analytics consumers.
 * Incremented whenever a write to the database succeeds.
 * In-memory only — resets to 0 on every app restart (which is correct,
 * since a restart means fresh reads from the DB anyway).
 */
export const useDataVersionStore = create<DataVersionStore>((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}))
