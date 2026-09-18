import { useEffect, useRef, useCallback } from 'react'
import { getSoundVolume, getSoundsMuted } from './useSound'

/**
 * useTTS — Cross-platform TTS hook for Electron renderer.
 *
 * On Linux: bypasses Web Speech API entirely and shells out to `piper`
 * via a piper→aplay pipeline in the main process (electron/ipc/tts.ipc.ts).
 * The configured .onnx model path is read from localStorage here in the
 * renderer and passed as an argument — main process does not read localStorage.
 *
 * On Windows/macOS: uses the existing Web Speech API path unchanged.
 *
 * Guarantees:
 * - Only one utterance plays at a time. A new speak() cancels any in-flight speech.
 * - stop() is called on component unmount to prevent orphaned speech.
 * - LaTeX/HTML markup is stripped before speaking.
 * - ttsEnabled=false short-circuits immediately.
 * - No model path set → short-circuits immediately (no hanging spawn).
 * - voiceschanged listeners are always cleaned up (no leak on unmount or stop).
 * - Volume slider and mute states are fully integrated and synced in real-time.
 */

const isLinux = typeof window !== 'undefined' && window.electron?.platform === 'linux'

// ── Shared text cleaning pipeline (Fix 4) ─────────────────────────────────────
// Single source of truth for LaTeX stripping + symbol normalization.
// Both speak() and speakWithCallback() call this instead of duplicating inline.
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/\$[^$]*?\$/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/_{2,}/g, 'blank')
    .replace(/>=/g, ' greater than or equal to ')
    .replace(/<=/g, ' less than or equal to ')
    .replace(/!=/g, ' not equal to ')
    .replace(/==/g, ' equal to ')
    .replace(/=>/g, ' implies ')
    .replace(/>>>/g, ' much much greater than ')
    .replace(/<</g, ' much less than ')
    .replace(/>>/g, ' much greater than ')
    .replace(/>/g, ' greater than ')
    .replace(/</g, ' less than ')
    .replace(/±/g, ' plus or minus ')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/≈/g, ' approximately equal to ')
    .replace(/≠/g, ' not equal to ')
    .replace(/≤/g, ' less than or equal to ')
    .replace(/≥/g, ' greater than or equal to ')
    .replace(/∞/g, ' infinity ')
    .replace(/√/g, ' square root of ')
    .replace(/π/g, ' pi ')
    .replace(/Ω/g, ' ohms ')
    .replace(/μ/g, ' micro ')
    .replace(/θ/g, ' theta ')
    .replace(/φ/g, ' phi ')
    .replace(/α/g, ' alpha ')
    .replace(/β/g, ' beta ')
    .replace(/γ/g, ' gamma ')
    .replace(/δ/g, ' delta ')
    .replace(/λ/g, ' lambda ')
    .replace(/ω/g, ' omega ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Helper: Web Audio Context for TTS ─────────────────────────────────────────
let ttsAudioCtx: AudioContext | null = null
function getTTSAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ttsAudioCtx) {
    try {
      ttsAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      return null
    }
  }
  if (ttsAudioCtx.state === 'suspended') {
    ttsAudioCtx.resume()
  }
  return ttsAudioCtx
}

// ── Helper: resolve voice from saved preference (non-Linux only) ───────────────
function getExactVoice(name: string): SpeechSynthesisVoice | null {
  return window.speechSynthesis.getVoices().find(v => v.name === name) ?? null
}

function getBestVoice(savedName: string | null): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (savedName) {
    const exact = voices.find(v => v.name === savedName)
    if (exact) return exact
  }
  // No cross-platform way to rank voice "quality" via Web Speech API.
  // Prefer a local (non-network) English voice if one exists, else first voice available.
  const localEnglish = voices.find(v => v.localService && v.lang.startsWith('en'))
  return localEnglish ?? voices[0] ?? null
}

export function useTTS(ttsEnabled: boolean) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const currentGainRef = useRef<GainNode | null>(null)
  // Track active speech ID so in-flight async operations (synthesize/decode/voiceschanged) can be cancelled immediately
  const activeSpeechIdRef = useRef(0)
  // Fix 6: track pending voiceschanged listeners so they can be torn down
  const pendingVoicesListenerRef = useRef<(() => void) | null>(null)
  // Linux: track pending tts:ended unsubscribe function
  const pendingTtsEndedUnsubRef = useRef<(() => void) | null>(null)

  // ── Linux: helper to tear down any pending onEnded listener ──────────────
  const cleanupLinuxListener = useCallback(() => {
    if (pendingTtsEndedUnsubRef.current) {
      pendingTtsEndedUnsubRef.current()
      pendingTtsEndedUnsubRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    // Invalidate any in-flight synthesis or speech requests immediately
    activeSpeechIdRef.current++

    // Stop Web Audio playback node immediately
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop()
      } catch {}
      currentSourceRef.current = null
      currentGainRef.current = null
    }
    // Linux: kill piper/aplay child processes
    if (isLinux) {
      cleanupLinuxListener()
      window.electron.tts.stop()
    }
    // Non-Linux (and always safe to call): cancel Web Speech API
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Fix 6: tear down any pending deferred listener on explicit stop
      if (pendingVoicesListenerRef.current) {
        window.speechSynthesis.removeEventListener('voiceschanged', pendingVoicesListenerRef.current)
        pendingVoicesListenerRef.current = null
      }
      window.speechSynthesis.cancel()
    }
  }, [cleanupLinuxListener])

  // Real-time volume slider synchronization
  useEffect(() => {
    const handleSoundChange = (e: any) => {
      const { volume, muted } = e.detail || {}
      const isMuted = typeof muted === 'boolean' ? muted : getSoundsMuted()
      const effectiveVol = isMuted ? 0 : (typeof volume === 'number' ? volume : getSoundVolume())

      // Instantly adjust live Web Audio gain with zero delay
      if (currentGainRef.current && ttsAudioCtx) {
        try {
          currentGainRef.current.gain.setValueAtTime(effectiveVol, ttsAudioCtx.currentTime)
        } catch {}
      }

      if (isLinux && window.electron?.tts?.setVolume) {
        window.electron.tts.setVolume(effectiveVol)
      }
      if (effectiveVol <= 0) {
        stop()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('ecengine:sound:change', handleSoundChange)
      return () => {
        window.removeEventListener('ecengine:sound:change', handleSoundChange)
      }
    }
  }, [stop])

  // Cancel in-flight speech and any pending listeners on unmount
  useEffect(() => {
    return () => {
      activeSpeechIdRef.current++
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop()
        } catch {}
        currentSourceRef.current = null
        currentGainRef.current = null
      }
      if (isLinux) {
        cleanupLinuxListener()
        window.electron.tts.stop()
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (pendingVoicesListenerRef.current) {
          window.speechSynthesis.removeEventListener('voiceschanged', pendingVoicesListenerRef.current)
          pendingVoicesListenerRef.current = null
        }
        window.speechSynthesis.cancel()
      }
    }
  }, [cleanupLinuxListener])

  const speak = useCallback(
    (text: string) => {
      stop()
      if (!ttsEnabled || getSoundsMuted()) return

      const vol = getSoundsMuted() ? 0 : getSoundVolume()
      if (vol <= 0) return

      const clean = cleanTextForSpeech(text)
      if (!clean) return

      const speechId = ++activeSpeechIdRef.current

      // ── Linux path: Web Audio API playback from Piper synthesis ───────────
      if (isLinux) {
        cleanupLinuxListener()
        const modelPath = localStorage.getItem('ecengine:tts:piperModelPath') || undefined

        if (window.electron.tts.synthesize) {
          window.electron.tts.synthesize(clean, modelPath).then(async (res) => {
            if (speechId !== activeSpeechIdRef.current) return
            if (!res.success || !res.audioData) {
              if (speechId !== activeSpeechIdRef.current) return
              window.electron.tts.speak(clean, modelPath, vol)
              return
            }
            const ctx = getTTSAudioContext()
            if (!ctx || speechId !== activeSpeechIdRef.current) return

            try {
              const raw = res.audioData
              const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
              const decoded = await ctx.decodeAudioData(arrayBuffer)
              if (speechId !== activeSpeechIdRef.current) return

              const source = ctx.createBufferSource()
              const gain = ctx.createGain()
              const currentVol = getSoundsMuted() ? 0 : getSoundVolume()
              gain.gain.setValueAtTime(currentVol, ctx.currentTime)
              source.buffer = decoded
              source.connect(gain)
              gain.connect(ctx.destination)
              currentSourceRef.current = source
              currentGainRef.current = gain
              source.onended = () => {
                if (currentSourceRef.current === source) {
                  currentSourceRef.current = null
                  currentGainRef.current = null
                }
              }
              source.start(0)
            } catch {
              // Fallback
              if (speechId !== activeSpeechIdRef.current) return
              window.electron.tts.speak(clean, modelPath, vol)
            }
          }).catch(() => {
            if (speechId !== activeSpeechIdRef.current) return
            window.electron.tts.speak(clean, modelPath, vol)
          })
          return
        }

        if (speechId !== activeSpeechIdRef.current) return
        window.electron.tts.speak(clean, modelPath, vol)
        return
      }

      // ── Non-Linux path: Web Speech API (unchanged) ───────────────────────
      if (typeof window === 'undefined' || !window.speechSynthesis) return

      // Cancel any pending deferred listener before starting fresh
      if (pendingVoicesListenerRef.current) {
        window.speechSynthesis.removeEventListener('voiceschanged', pendingVoicesListenerRef.current)
        pendingVoicesListenerRef.current = null
      }

      window.speechSynthesis.cancel()

      const savedVoiceName = localStorage.getItem('ecengine:tts:voice')

      if ((savedVoiceName && !getExactVoice(savedVoiceName)) || window.speechSynthesis.getVoices().length === 0) {
        // Voices not loaded yet, or specific voice not available yet — defer until ready
        let fired = false
        const onVoicesReady = () => {
          if (fired) return
          fired = true
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesReady)
          pendingVoicesListenerRef.current = null
          if (speechId !== activeSpeechIdRef.current) return
          const utterance = new SpeechSynthesisUtterance(clean)
          utterance.rate = 0.95
          utterance.pitch = 1
          utterance.volume = vol
          utterance.voice = getBestVoice(savedVoiceName)
          window.speechSynthesis.speak(utterance)
        }
        pendingVoicesListenerRef.current = onVoicesReady
        window.speechSynthesis.addEventListener('voiceschanged', onVoicesReady)
        setTimeout(() => { if (!fired) onVoicesReady() }, 500)
        return
      }

      if (speechId !== activeSpeechIdRef.current) return
      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.rate = 0.95
      utterance.pitch = 1
      utterance.volume = vol
      utterance.voice = getBestVoice(savedVoiceName)
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [ttsEnabled, cleanupLinuxListener, stop]
  )

  const speakWithCallback = useCallback(
    (text: string, onEnd: () => void) => {
      stop()
      if (!ttsEnabled || getSoundsMuted()) { onEnd(); return }

      const vol = getSoundsMuted() ? 0 : getSoundVolume()
      if (vol <= 0) { onEnd(); return }

      const clean = cleanTextForSpeech(text)
      if (!clean) { onEnd(); return }

      const speechId = ++activeSpeechIdRef.current

      // ── Linux path: Web Audio API playback from Piper synthesis ───────────
      if (isLinux) {
        cleanupLinuxListener()
        const modelPath = localStorage.getItem('ecengine:tts:piperModelPath') || undefined

        if (window.electron.tts.synthesize) {
          window.electron.tts.synthesize(clean, modelPath).then(async (res) => {
            if (speechId !== activeSpeechIdRef.current) return
            if (!res.success || !res.audioData) {
              if (speechId !== activeSpeechIdRef.current) return
              const unsub = window.electron.tts.onEnded(() => {
                unsub()
                if (speechId !== activeSpeechIdRef.current) return
                onEnd()
              })
              pendingTtsEndedUnsubRef.current = unsub
              window.electron.tts.speak(clean, modelPath, vol)
              return
            }
            const ctx = getTTSAudioContext()
            if (!ctx || speechId !== activeSpeechIdRef.current) return

            try {
              const raw = res.audioData
              const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
              const decoded = await ctx.decodeAudioData(arrayBuffer)
              if (speechId !== activeSpeechIdRef.current) return

              const source = ctx.createBufferSource()
              const gain = ctx.createGain()
              const currentVol = getSoundsMuted() ? 0 : getSoundVolume()
              gain.gain.setValueAtTime(currentVol, ctx.currentTime)
              source.buffer = decoded
              source.connect(gain)
              gain.connect(ctx.destination)
              currentSourceRef.current = source
              currentGainRef.current = gain
              source.onended = () => {
                if (currentSourceRef.current === source) {
                  currentSourceRef.current = null
                  currentGainRef.current = null
                }
                if (speechId === activeSpeechIdRef.current) {
                  onEnd()
                }
              }
              source.start(0)
            } catch {
              if (speechId !== activeSpeechIdRef.current) return
              const unsub = window.electron.tts.onEnded(() => {
                unsub()
                if (speechId !== activeSpeechIdRef.current) return
                onEnd()
              })
              pendingTtsEndedUnsubRef.current = unsub
              window.electron.tts.speak(clean, modelPath, vol)
            }
          }).catch(() => {
            if (speechId !== activeSpeechIdRef.current) return
            const unsub = window.electron.tts.onEnded(() => {
              unsub()
              if (speechId !== activeSpeechIdRef.current) return
              onEnd()
            })
            pendingTtsEndedUnsubRef.current = unsub
            window.electron.tts.speak(clean, modelPath, vol)
          })
          return
        }

        if (speechId !== activeSpeechIdRef.current) return
        const unsub = window.electron.tts.onEnded(() => {
          unsub()
          if (pendingTtsEndedUnsubRef.current === unsub) {
            pendingTtsEndedUnsubRef.current = null
          }
          if (speechId !== activeSpeechIdRef.current) return
          onEnd()
        })
        pendingTtsEndedUnsubRef.current = unsub
        window.electron.tts.speak(clean, modelPath, vol)
        return
      }

      // ── Non-Linux path: Web Speech API ───────────────────────────────────
      if (typeof window === 'undefined' || !window.speechSynthesis) { onEnd(); return }

      // Cancel any pending deferred listener before starting fresh
      if (pendingVoicesListenerRef.current) {
        window.speechSynthesis.removeEventListener('voiceschanged', pendingVoicesListenerRef.current)
        pendingVoicesListenerRef.current = null
      }

      window.speechSynthesis.cancel()

      const savedVoiceName = localStorage.getItem('ecengine:tts:voice')

      if ((savedVoiceName && !getExactVoice(savedVoiceName)) || window.speechSynthesis.getVoices().length === 0) {
        // Voices not loaded yet, or specific voice not available yet — defer until ready
        let fired = false
        const onVoicesReady = () => {
          if (fired) return
          fired = true
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesReady)
          pendingVoicesListenerRef.current = null
          if (speechId !== activeSpeechIdRef.current) return
          const utterance = new SpeechSynthesisUtterance(clean)
          utterance.rate = 0.95
          utterance.pitch = 1
          utterance.volume = vol
          utterance.onend = () => {
            if (speechId === activeSpeechIdRef.current) onEnd()
          }
          utterance.onerror = () => {
            if (speechId === activeSpeechIdRef.current) onEnd()
          }
          utterance.voice = getBestVoice(savedVoiceName)
          window.speechSynthesis.speak(utterance)
        }
        pendingVoicesListenerRef.current = onVoicesReady
        window.speechSynthesis.addEventListener('voiceschanged', onVoicesReady)
        setTimeout(() => { if (!fired) onVoicesReady() }, 500)
        return
      }

      if (speechId !== activeSpeechIdRef.current) return
      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.rate = 0.95
      utterance.pitch = 1
      utterance.volume = vol
      utterance.onend = () => {
        if (speechId === activeSpeechIdRef.current) onEnd()
      }
      utterance.onerror = () => {
        if (speechId === activeSpeechIdRef.current) onEnd()
      }
      utterance.voice = getBestVoice(savedVoiceName)
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [ttsEnabled, cleanupLinuxListener, stop]
  )

  return { speak, stop, speakWithCallback }
}