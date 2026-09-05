// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Polyfill in-memory Storage
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

const mockSession = createStorageMock()
const mockLocal = createStorageMock()

Object.defineProperty(window, 'sessionStorage', {
  value: mockSession,
  writable: true,
})
Object.defineProperty(window, 'localStorage', {
  value: mockLocal,
  writable: true,
})
Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSession,
  writable: true,
})
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocal,
  writable: true,
})

import {
  getSoundVolume,
  setSoundVolume,
  getSoundsMuted,
  setSoundsMuted,
} from './useSound'

describe('useSound & Volume Management', () => {
  beforeEach(() => {
    mockSession.clear()
    mockLocal.clear()
    // Reset to defaults
    setSoundVolume(1.0)
    setSoundsMuted(false)
  })

  it('defaults to volume 1.0 and unmuted on a fresh session', () => {
    mockSession.clear()
    expect(getSoundVolume()).toBe(1.0)
    expect(getSoundsMuted()).toBe(false)
  })

  it('persists volume in sessionStorage', () => {
    setSoundVolume(0.65)
    expect(getSoundVolume()).toBe(0.65)
    expect(mockSession.getItem('ecengine_sound_volume')).toBe('0.65')
  })

  it('clamps volume between 0 and 1', () => {
    setSoundVolume(1.5)
    expect(getSoundVolume()).toBe(1.0)

    setSoundVolume(-0.2)
    expect(getSoundVolume()).toBe(0)
  })

  it('persists mute state in sessionStorage', () => {
    setSoundsMuted(true)
    expect(getSoundsMuted()).toBe(true)
    expect(mockSession.getItem('ecengine_sounds_muted')).toBe('true')

    setSoundsMuted(false)
    expect(getSoundsMuted()).toBe(false)
    expect(mockSession.getItem('ecengine_sounds_muted')).toBe('false')
  })

  it('dispatches ecengine:sound:change event on volume change and mute change', () => {
    const listener = vi.fn()
    window.addEventListener('ecengine:sound:change', listener)

    setSoundVolume(0.4)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].detail).toEqual({
      volume: 0.4,
      muted: false,
    })

    setSoundsMuted(true)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener.mock.calls[1][0].detail).toEqual({
      volume: 0.4,
      muted: true,
    })

    window.removeEventListener('ecengine:sound:change', listener)
  })
})
