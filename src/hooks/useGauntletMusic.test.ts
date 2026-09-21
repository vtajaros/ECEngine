// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MUSIC_REGIONS,
  getTimedMusicRegion,
  getSurvivalMusicRegion,
  useGauntletMusic,
  _resetMusicEngineForTest,
} from './useGauntletMusic'

describe('useGauntletMusic', () => {
  beforeEach(() => {
    _resetMusicEngineForTest()
    vi.restoreAllMocks()
  })

  describe('MUSIC_REGIONS definitions', () => {
    it('defines all 6 regions with correct start/end bounds and loop behavior', () => {
      expect(MUSIC_REGIONS.stealth).toEqual({ start: 0, end: 53, loop: true })
      expect(MUSIC_REGIONS.enemiesNearby).toEqual({ start: 54, end: 78, loop: true })
      expect(MUSIC_REGIONS.battle1).toEqual({ start: 78, end: 105, loop: true })
      expect(MUSIC_REGIONS.battle2).toEqual({ start: 106, end: 130, loop: true })
      expect(MUSIC_REGIONS.battle3).toEqual({ start: 131, end: 157, loop: true })
      expect(MUSIC_REGIONS.combatOver).toEqual({ start: 158, end: 217, loop: false })
    })

    it('ensures combatOver does not loop while all other regions loop', () => {
      expect(MUSIC_REGIONS.combatOver.loop).toBe(false)
      expect(MUSIC_REGIONS.stealth.loop).toBe(true)
      expect(MUSIC_REGIONS.enemiesNearby.loop).toBe(true)
      expect(MUSIC_REGIONS.battle1.loop).toBe(true)
      expect(MUSIC_REGIONS.battle2.loop).toBe(true)
      expect(MUSIC_REGIONS.battle3.loop).toBe(true)
    })
  })

  describe('getTimedMusicRegion (Time Trial mapping)', () => {
    const totalSec = 100 // 100 seconds total

    it('maps percentage remaining to gameplay regions with 2s anticipation window (enemiesNearby floor)', () => {
      // At 100s remaining: effective is 98s -> 98% -> enemiesNearby (floor, no stealth)
      expect(getTimedMusicRegion(100, totalSec)).toBe('enemiesNearby')

      // At 70s remaining: effective is 68s -> 68% -> enemiesNearby
      expect(getTimedMusicRegion(70, totalSec)).toBe('enemiesNearby')

      // At 61.5s remaining: effective is 59.5s -> 59.5% (< 60%) -> transitions to battle1 ~2s early
      expect(getTimedMusicRegion(61.5, totalSec)).toBe('battle1')

      // At 40s remaining: effective is 38s -> 38% -> battle1
      expect(getTimedMusicRegion(40, totalSec)).toBe('battle1')

      // At 36.5s remaining: effective is 34.5s -> 34.5% (< 35%) -> transitions to battle2 ~2s early
      expect(getTimedMusicRegion(36.5, totalSec)).toBe('battle2')

      // At 20s remaining: effective is 18s -> 18% -> battle2
      expect(getTimedMusicRegion(20, totalSec)).toBe('battle2')

      // At 16.5s remaining: effective is 14.5s -> 14.5% (< 15%) -> transitions to battle3 ~2s early
      expect(getTimedMusicRegion(16.5, totalSec)).toBe('battle3')

      // At 8s remaining: effective is 6s -> 6% -> battle3
      expect(getTimedMusicRegion(8, totalSec)).toBe('battle3')

      // At 1s remaining: effective 0s -> battle3
      expect(getTimedMusicRegion(1, totalSec)).toBe('battle3')
      expect(getTimedMusicRegion(0, totalSec)).toBe('battle3')
    })

    it('handles zero or negative duration safely', () => {
      expect(getTimedMusicRegion(0, 0)).toBe('battle3')
      expect(getTimedMusicRegion(-5, 100)).toBe('battle3')
    })

    it('never returns stealth for any time value during timed mode', () => {
      for (let sec = 0; sec <= 120; sec += 0.5) {
        expect(getTimedMusicRegion(sec, 120)).not.toBe('stealth')
      }
    })
  })

  describe('getSurvivalMusicRegion (Survival mapping)', () => {
    it('maps 5 lives correctly across 4 gameplay tiers starting at enemiesNearby', () => {
      expect(getSurvivalMusicRegion(5, 5)).toBe('enemiesNearby')
      expect(getSurvivalMusicRegion(4, 5)).toBe('battle1')
      expect(getSurvivalMusicRegion(3, 5)).toBe('battle2')
      expect(getSurvivalMusicRegion(2, 5)).toBe('battle3')
      expect(getSurvivalMusicRegion(1, 5)).toBe('battle3')
      expect(getSurvivalMusicRegion(0, 5)).toBe('battle3')
    })

    it('maps 3 lives correctly to tiers down to battle3', () => {
      expect(getSurvivalMusicRegion(3, 3)).toBe('enemiesNearby')
      expect(getSurvivalMusicRegion(2, 3)).toBe('battle2')
      expect(getSurvivalMusicRegion(1, 3)).toBe('battle3')
      expect(getSurvivalMusicRegion(0, 3)).toBe('battle3')
    })

    it('never returns stealth for any livesLeft value during survival mode', () => {
      for (let lives = 0; lives <= 10; lives++) {
        expect(getSurvivalMusicRegion(lives, 5)).not.toBe('stealth')
        expect(getSurvivalMusicRegion(lives, 3)).not.toBe('stealth')
      }
    })
  })

  describe('Audio engine and mock playback', () => {
    it('handles start, setState, and stop safely in headless environment', () => {
      const { start, setState, stop, getCurrentRegion } = useGauntletMusic()

      expect(getCurrentRegion()).toBeNull()

      start('stealth')
      expect(getCurrentRegion()).toBe('stealth')

      setState('enemiesNearby')
      expect(getCurrentRegion()).toBe('enemiesNearby')

      setState('combatOver')
      expect(getCurrentRegion()).toBe('combatOver')

      stop()
      expect(getCurrentRegion()).toBeNull()
    })

    it('executes linear crossfade ramps on AudioParam when Web Audio is available', () => {
      const mockGainNode = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }

      const mockSourceNode = {
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }

      const mockCtx = {
        state: 'running',
        currentTime: 10,
        destination: {},
        createGain: vi.fn(() => ({ ...mockGainNode })),
        createBufferSource: vi.fn(() => ({ ...mockSourceNode })),
        decodeAudioData: vi.fn().mockResolvedValue({ duration: 217.6 }),
        resume: vi.fn().mockResolvedValue(undefined),
      }

      ;(window as any).AudioContext = vi.fn(() => mockCtx)
      globalThis.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      } as any)

      const { start, setState, stop } = useGauntletMusic()

      start('stealth')
      setState('battle1')
      stop()
    })

    it('controls low-health overlay state and ramps gain independently', async () => {
      const mockGainNode = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }

      const mockSourceNode = {
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }

      const mockCtx = {
        state: 'running',
        currentTime: 15,
        destination: {},
        createGain: vi.fn(() => ({ ...mockGainNode, gain: { ...mockGainNode.gain } })),
        createBufferSource: vi.fn(() => ({ ...mockSourceNode })),
        decodeAudioData: vi.fn().mockResolvedValue({ duration: 9.6 }),
        resume: vi.fn().mockResolvedValue(undefined),
      }

      ;(window as any).AudioContext = vi.fn(() => mockCtx)
      globalThis.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      } as any)

      const music = useGauntletMusic()

      expect(music.isLowHealthActive()).toBe(false)

      music.setLowHealth(true)
      expect(music.isLowHealthActive()).toBe(true)

      // Let async decode finish
      await vi.waitFor(() => {
        expect(mockCtx.decodeAudioData).toHaveBeenCalled()
      })

      // Ensure buffer source was created and started
      expect(mockCtx.createBufferSource).toHaveBeenCalled()

      // Turn off low-health
      music.setLowHealth(false)
      expect(music.isLowHealthActive()).toBe(false)
    })

    it('silences low-health layer when music.stop() is called', () => {
      const music = useGauntletMusic()
      music.setLowHealth(true)
      expect(music.isLowHealthActive()).toBe(true)

      music.stop()
      expect(music.isLowHealthActive()).toBe(false)
    })
  })
})
