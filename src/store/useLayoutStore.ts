import { create } from 'zustand'

interface LayoutState {
  forceCollapsed: boolean
  setForceCollapsed: (force: boolean) => void
}

export const useLayoutStore = create<LayoutState>(set => ({
  forceCollapsed: false,
  setForceCollapsed: forceCollapsed => set({ forceCollapsed }),
}))
