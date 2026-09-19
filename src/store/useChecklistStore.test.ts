// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'

const createStorageMock = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
}

const mockLocal = createStorageMock()
Object.defineProperty(window, 'localStorage', {
  value: mockLocal,
  writable: true,
})
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocal,
  writable: true,
})

import {
  useChecklistStore,
  loadState,
  saveState,
  STORAGE_REVIEWED,
  STORAGE_REFRESHER,
  STORAGE_SELF_REVIEW,
} from './useChecklistStore'

describe('useChecklistStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useChecklistStore.getState().resetAll()
  })

  it('loadState returns empty object on missing or corrupt data', () => {
    expect(loadState('non-existent')).toEqual({})

    localStorage.setItem('corrupt-key', 'not-valid-json{')
    expect(loadState('corrupt-key')).toEqual({})

    localStorage.setItem('primitive-key', '123')
    expect(loadState('primitive-key')).toEqual({})
  })

  it('saveState persists data to localStorage', () => {
    saveState('test-key', { 'MATH::1.1': true })
    expect(JSON.parse(localStorage.getItem('test-key') || '{}')).toEqual({
      'MATH::1.1': true,
    })
  })

  it('toggleReview toggles state and persists to localStorage', () => {
    const key = 'MATH::1.1'
    useChecklistStore.getState().toggleReview(key)

    expect(useChecklistStore.getState().reviewed[key]).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_REVIEWED) || '{}')).toEqual({
      [key]: true,
    })

    useChecklistStore.getState().toggleReview(key)
    expect(useChecklistStore.getState().reviewed[key]).toBe(false)
  })

  it('toggleRefresher toggles state and persists to localStorage', () => {
    const key = 'ELECS::2.1'
    useChecklistStore.getState().toggleRefresher(key)

    expect(useChecklistStore.getState().refresher[key]).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_REFRESHER) || '{}')).toEqual({
      [key]: true,
    })
  })

  it('toggleSelfReview toggles state and persists to localStorage', () => {
    const key = 'GEAS::3.1'
    useChecklistStore.getState().toggleSelfReview(key)

    expect(useChecklistStore.getState().selfReview[key]).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_SELF_REVIEW) || '{}')).toEqual({
      [key]: true,
    })
  })

  it('resetAll clears store and localStorage', () => {
    useChecklistStore.getState().toggleReview('MATH::1.1')
    useChecklistStore.getState().toggleRefresher('MATH::1.1')
    useChecklistStore.getState().toggleSelfReview('MATH::1.1')

    useChecklistStore.getState().resetAll()

    const state = useChecklistStore.getState()
    expect(state.reviewed).toEqual({})
    expect(state.refresher).toEqual({})
    expect(state.selfReview).toEqual({})

    expect(localStorage.getItem(STORAGE_REVIEWED)).toBe('{}')
    expect(localStorage.getItem(STORAGE_REFRESHER)).toBe('{}')
    expect(localStorage.getItem(STORAGE_SELF_REVIEW)).toBe('{}')
  })
})
