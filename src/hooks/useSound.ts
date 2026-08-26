// src/hooks/useSound.ts
import { useRef, useCallback, useState, useEffect } from 'react'
import wrongSfx from '../assets/sounds/wrong.wav'

export type SoundEvent = 'correct' | 'wrong' | 'roundComplete' | 'finish'

const CUSTOM_WRONG_SOUND_KEY = 'ecengine:wrongSound:enabled'
const SESSION_MUTE_KEY = 'ecengine_sounds_muted'
const SESSION_VOLUME_KEY = 'ecengine_sound_volume'

let memoryVolume = 1
let memoryMuted = false

function dispatchSoundChange() {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('ecengine:sound:change', {
          detail: {
            volume: getSoundVolume(),
            muted: getSoundsMuted(),
          },
        })
      )
    } catch {}
  }
}

export function getSoundVolume(): number {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const val = sessionStorage.getItem(SESSION_VOLUME_KEY)
      if (val !== null) {
        const parsed = parseFloat(val)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed
        }
      }
    }
    return memoryVolume
  } catch {
    return memoryVolume
  }
}

export function setSoundVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume))
  memoryVolume = clamped
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_VOLUME_KEY, String(clamped))
    }
  } catch {}
  dispatchSoundChange()
}

export function getSoundsMuted(): boolean {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const val = sessionStorage.getItem(SESSION_MUTE_KEY)
      if (val !== null) {
        return val === 'true'
      }
    }
    return memoryMuted
  } catch {
    return memoryMuted
  }
}

export function setSoundsMuted(muted: boolean): void {
  memoryMuted = muted
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_MUTE_KEY, String(muted))
    }
  } catch {}
  dispatchSoundChange()
}

export function useSoundVolume() {
  const [volume, setVolState] = useState<number>(() => getSoundVolume())
  const [isMuted, setIsMutedState] = useState<boolean>(() => getSoundsMuted())

  useEffect(() => {
    const handleSync = () => {
      setVolState(getSoundVolume())
      setIsMutedState(getSoundsMuted())
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('ecengine:sound:change', handleSync)
      return () => {
        window.removeEventListener('ecengine:sound:change', handleSync)
      }
    }
  }, [])

  const setVolume = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol))
    setSoundVolume(clamped)
    if (clamped > 0 && getSoundsMuted()) {
      setSoundsMuted(false)
    } else if (clamped === 0 && !getSoundsMuted()) {
      setSoundsMuted(true)
    }
  }, [])

  const toggleMute = useCallback(() => {
    const currentlyMuted = getSoundsMuted()
    if (currentlyMuted) {
      setSoundsMuted(false)
      if (getSoundVolume() === 0) {
        setSoundVolume(1.0)
      }
    } else {
      setSoundsMuted(true)
    }
  }, [])

  const setMuted = useCallback((muted: boolean) => {
    setSoundsMuted(muted)
  }, [])

  return { volume, isMuted, setVolume, toggleMute, setMuted }
}

export function getCustomWrongSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem(CUSTOM_WRONG_SOUND_KEY)
    // Default is true — custom sound on unless explicitly disabled
    return val === null ? true : val === 'true'
  } catch {
    return true
  }
}

export function setCustomWrongSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CUSTOM_WRONG_SOUND_KEY, String(enabled))
  } catch {}
}

function createAudioContext(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)()
  } catch {
    return null
  }
}

// ── Synthesized sounds ────────────────────────────────────────────────────────

function playCorrectSound(ctx: AudioContext, masterVolume: number) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.connect(g); g.connect(ctx.destination)
  o.type = 'sine'
  o.frequency.setValueAtTime(523.25, ctx.currentTime)
  o.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08)
  g.gain.setValueAtTime(0.18 * masterVolume, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
  o.start(ctx.currentTime)
  o.stop(ctx.currentTime + 0.3)
}

function playSynthWrongSound(ctx: AudioContext, masterVolume: number) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.connect(g); g.connect(ctx.destination)
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(220, ctx.currentTime)
  o.frequency.setValueAtTime(180, ctx.currentTime + 0.1)
  g.gain.setValueAtTime(0.12 * masterVolume, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
  o.start(ctx.currentTime)
  o.stop(ctx.currentTime + 0.25)
}

function playRoundCompleteSound(ctx: AudioContext, masterVolume: number) {
  const notes = [523.25, 659.25, 783.99]
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.value = freq
    const t = ctx.currentTime + i * 0.1
    g.gain.setValueAtTime(0.15 * masterVolume, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    o.start(t)
    o.stop(t + 0.35)
  })
}

function playFinishSound(ctx: AudioContext, masterVolume: number) {
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.value = freq
    const t = ctx.currentTime + i * 0.12
    g.gain.setValueAtTime(0.18 * masterVolume, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.start(t)
    o.stop(t + 0.5)
  })
}

// ── File-based wrong sound ────────────────────────────────────────────────────

let cachedWrongBuffer: AudioBuffer | null = null

function playCustomWrongSound(ctx: AudioContext, masterVolume: number) {
  const playBuf = (decoded: AudioBuffer) => {
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = decoded
    gain.gain.value = 0.6 * masterVolume
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(ctx.currentTime)
  }

  if (cachedWrongBuffer) {
    playBuf(cachedWrongBuffer)
    return
  }

  fetch(wrongSfx)
    .then(res => res.arrayBuffer())
    .then(buf => ctx.decodeAudioData(buf))
    .then(decoded => {
      cachedWrongBuffer = decoded
      playBuf(decoded)
    })
    .catch(() => {
      // File failed — fall back to synth silently
      playSynthWrongSound(ctx, masterVolume)
    })
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = createAudioContext()
    }
    if (ctxRef.current?.state === 'suspended') {
      ctxRef.current.resume()
    }
    return ctxRef.current
  }, [])

  const play = useCallback((event: SoundEvent) => {
    if (getSoundsMuted()) return
    const vol = getSoundVolume()
    if (vol <= 0) return

    const ctx = getCtx()
    if (!ctx) return
    try {
      switch (event) {
        case 'correct':
          playCorrectSound(ctx, vol)
          break
        case 'wrong':
          if (getCustomWrongSoundEnabled()) {
            playCustomWrongSound(ctx, vol)
          } else {
            playSynthWrongSound(ctx, vol)
          }
          break
        case 'roundComplete':
          playRoundCompleteSound(ctx, vol)
          break
        case 'finish':
          playFinishSound(ctx, vol)
          break
      }
    } catch {
      // Audio failures are non-fatal
    }
  }, [getCtx])

  return { play }
}


