import { create } from 'zustand'

export const STORAGE_REVIEWED = 'tos_checklist_reviewed_v1'
export const STORAGE_REFRESHER = 'tos_checklist_refresher_v1'
export const STORAGE_SELF_REVIEW = 'tos_checklist_selfReview_v1'

export function loadState(key: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const data = JSON.parse(raw)
    return typeof data === 'object' && data !== null
      ? (data as Record<string, boolean>)
      : {}
  } catch {
    return {}
  }
}

export function saveState(key: string, state: Record<string, boolean>): void {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

export interface ChecklistStore {
  reviewed: Record<string, boolean>
  refresher: Record<string, boolean>
  selfReview: Record<string, boolean>
  toggleReview: (key: string) => void
  toggleRefresher: (key: string) => void
  toggleSelfReview: (key: string) => void
  resetAll: () => void
}

export const useChecklistStore = create<ChecklistStore>((set) => ({
  reviewed: loadState(STORAGE_REVIEWED),
  refresher: loadState(STORAGE_REFRESHER),
  selfReview: loadState(STORAGE_SELF_REVIEW),

  toggleReview: (key: string) =>
    set((state) => {
      const next = { ...state.reviewed, [key]: !state.reviewed[key] }
      saveState(STORAGE_REVIEWED, next)
      return { reviewed: next }
    }),

  toggleRefresher: (key: string) =>
    set((state) => {
      const next = { ...state.refresher, [key]: !state.refresher[key] }
      saveState(STORAGE_REFRESHER, next)
      return { refresher: next }
    }),

  toggleSelfReview: (key: string) =>
    set((state) => {
      const next = { ...state.selfReview, [key]: !state.selfReview[key] }
      saveState(STORAGE_SELF_REVIEW, next)
      return { selfReview: next }
    }),

  resetAll: () => {
    saveState(STORAGE_REVIEWED, {})
    saveState(STORAGE_REFRESHER, {})
    saveState(STORAGE_SELF_REVIEW, {})
    set({
      reviewed: {},
      refresher: {},
      selfReview: {},
    })
  },
}))
