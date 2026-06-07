import { useEffect, useRef, useCallback } from 'react'

/**
 * useTTS — Web Speech API wrapper for Electron renderer.
 *
 * Guarantees:
 * - Only one utterance plays at a time. A new speak() cancels any in-flight speech.
 * - stop() is called on component unmount to prevent orphaned speech.
 * - LaTeX/HTML markup is stripped before speaking.
 * - ttsEnabled=false short-circuits immediately.
 * - voiceschanged listeners are always cleaned up (no leak on unmount or stop).
 */

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

// ── Helper: resolve voice from saved preference ────────────────────────────────
function resolveVoice(savedVoiceName: string | null): SpeechSynthesisVoice | null {
  if (!savedVoiceName) return null
  const voices = window.speechSynthesis.getVoices()
  return voices.find(v => v.name === savedVoiceName) ?? null
}

export function useTTS(ttsEnabled: boolean) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  // Fix 6: track pending voiceschanged listeners so they can be torn down
  const pendingVoicesListenerRef = useRef<(() => void) | null>(null)

  // Cancel in-flight speech and any pending voiceschanged listener on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (pendingVoicesListenerRef.current) {
          window.speechSynthesis.removeEventListener('voiceschanged', pendingVoicesListenerRef.current)
          pendingVoicesListenerRef.current = null
        }
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!ttsEnabled) return
      if (typeof window === 'undefined' || !window.speechSynthesis) return

      const clean = cleanTextForSpeech(text)
      if (!clean) return

      // Cancel any pending deferred listener before starting fresh
      if (pendingVoicesListenerRef.current) {
        window.speechSynthesis.removeEventListener('voiceschanged', pendingVoicesListenerRef.current)
        pendingVoicesListenerRef.current = null
      }

      window.speechSynthesis.cancel()

      const savedVoiceName = localStorage.getItem('ecengine:tts:voice')
      const voices = window.speechSynthesis.getVoices()

      if (savedVoiceName && voices.length === 0) {
        // Voices not loaded yet — defer until ready
        const onVoicesReady = () => {
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesReady)
          pendingVoicesListenerRef.current = null
          const utterance = new SpeechSynthesisUtterance(clean)
          utterance.rate = 0.95
          utterance.pitch = 1
          utterance.volume = 1
          utterance.voice = resolveVoice(savedVoiceName)
          window.speechSynthesis.speak(utterance)
        }
        pendingVoicesListenerRef.current = onVoicesReady
        window.speechSynthesis.addEventListener('voiceschanged', onVoicesReady)
        return
      }

      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.rate = 0.95
      utterance.pitch = 1
      utterance.volume = 1
      utterance.voice = resolveVoice(savedVoiceName)
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [ttsEnabled]
  )

  const speakWithCallback = useCallback(
    (text: string, onEnd: () => void) => {
      if (!ttsEnabled) { onEnd(); return }
      if (typeof window === 'undefined' || !window.speechSynthesis) { onEnd(); return }

      const clean = cleanTextForSpeech(text)
      if (!clean) { onEnd(); return }

      // Cancel any pending deferred listener before starting fresh
      if (pendingVoicesListenerRef.current) {
        window.speechSynthesis.removeEventListener('voiceschanged', pendingVoicesListenerRef.current)
        pendingVoicesListenerRef.current = null
      }

      window.speechSynthesis.cancel()

      const savedVoiceName = localStorage.getItem('ecengine:tts:voice')
      const voices = window.speechSynthesis.getVoices()

      if (savedVoiceName && voices.length === 0) {
        // Voices not loaded yet — defer until ready
        const onVoicesReady = () => {
          window.speechSynthesis.removeEventListener('voiceschanged', onVoicesReady)
          pendingVoicesListenerRef.current = null
          const utterance = new SpeechSynthesisUtterance(clean)
          utterance.rate = 0.95
          utterance.pitch = 1
          utterance.volume = 1
          utterance.onend = () => onEnd()
          utterance.onerror = () => onEnd()
          utterance.voice = resolveVoice(savedVoiceName)
          window.speechSynthesis.speak(utterance)
        }
        pendingVoicesListenerRef.current = onVoicesReady
        window.speechSynthesis.addEventListener('voiceschanged', onVoicesReady)
        return
      }

      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.rate = 0.95
      utterance.pitch = 1
      utterance.volume = 1
      utterance.onend = () => onEnd()
      utterance.onerror = () => onEnd()
      utterance.voice = resolveVoice(savedVoiceName)
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [ttsEnabled]
  )

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Fix 6: tear down any pending deferred listener on explicit stop
      if (pendingVoicesListenerRef.current) {
        window.speechSynthesis.removeEventListener('voiceschanged', pendingVoicesListenerRef.current)
        pendingVoicesListenerRef.current = null
      }
      window.speechSynthesis.cancel()
    }
  }, [])

  return { speak, stop, speakWithCallback }
}