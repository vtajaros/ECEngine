import { useEffect, useRef, useCallback } from 'react'

/**
 * useTTS — Web Speech API wrapper for Electron renderer.
 *
 * Chromium (Electron's renderer) ships a full speechSynthesis implementation,
 * so this works offline with no IPC, no API key, and zero latency.
 *
 * Guarantees:
 * - Only one utterance plays at a time. A new speak() cancels any in-flight speech.
 * - stop() is called on component unmount to prevent orphaned speech.
 * - LaTeX/HTML markup is stripped before speaking — avoids reading "$V_{gs}$" aloud.
 * - ttsEnabled=false short-circuits immediately; no SpeechSynthesis state is touched.
 */
export function useTTS(ttsEnabled: boolean) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Cancel any in-flight speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!ttsEnabled) return
      if (typeof window === 'undefined' || !window.speechSynthesis) return

      // Strip LaTeX delimiters and HTML tags before speaking
      const clean = text
        .replace(/\$\$[\s\S]*?\$\$/g, '')   // block LaTeX
        .replace(/\$[^$]*?\$/g, '')          // inline LaTeX
        .replace(/<[^>]+>/g, '')             // HTML tags
        .replace(/_{2,}/g, 'blank')          // fill-in-the-blank underscores → spoken "blank"
        // Engineering symbol normalization — must run before whitespace collapse
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
        .replace(/\s+/g, ' ')               // collapse whitespace
        .trim()

      if (!clean) return

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.rate = 0.95
      utterance.pitch = 1
      utterance.volume = 1

      // Apply saved voice preference.
      // getVoices() returns [] on cold start in Chromium — voices load async.
      // If empty, wait for voiceschanged then re-speak.
      const savedVoiceName = localStorage.getItem('ecengine:tts:voice')
      if (savedVoiceName) {
        const voices = window.speechSynthesis.getVoices()
        if (voices.length > 0) {
          const match = voices.find(v => v.name === savedVoiceName)
          if (match) utterance.voice = match
        } else {
          // Voices not loaded yet — defer speak until they are
          window.speechSynthesis.cancel()
          const onVoicesReady = () => {
            window.speechSynthesis.removeEventListener('voiceschanged', onVoicesReady)
            const loadedVoices = window.speechSynthesis.getVoices()
            const match = loadedVoices.find(v => v.name === savedVoiceName)
            const deferred = new SpeechSynthesisUtterance(clean)
            deferred.rate = 0.95
            deferred.pitch = 1
            deferred.volume = 1
            if (match) deferred.voice = match
            window.speechSynthesis.speak(deferred)
          }
          window.speechSynthesis.addEventListener('voiceschanged', onVoicesReady)
          return
        }
      }
      utteranceRef.current = utterance

      window.speechSynthesis.speak(utterance)
    },
    [ttsEnabled]
  )

  const speakWithCallback = useCallback(
    (text: string, onEnd: () => void) => {
      if (!ttsEnabled) {
        onEnd()
        return
      }
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        onEnd()
        return
      }

      // Strip LaTeX delimiters and HTML tags before speaking
      const clean = text
        .replace(/\$\$[\s\S]*?\$\$/g, '')   // block LaTeX
        .replace(/\$[^$]*?\$/g, '')          // inline LaTeX
        .replace(/<[^>]+>/g, '')             // HTML tags
        .replace(/_{2,}/g, 'blank')          // fill-in-the-blank underscores → spoken "blank"
        // Engineering symbol normalization — must run before whitespace collapse
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
        .replace(/\s+/g, ' ')               // collapse whitespace
        .trim()

      if (!clean) {
        onEnd()
        return
      }

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.rate = 0.95
      utterance.pitch = 1
      utterance.volume = 1
      utterance.onend = () => onEnd()
      utterance.onerror = () => onEnd()

      // Apply saved voice preference.
      // getVoices() returns [] on cold start in Chromium — voices load async.
      // If empty, wait for voiceschanged then re-speak.
      const savedVoiceName = localStorage.getItem('ecengine:tts:voice')
      if (savedVoiceName) {
        const voices = window.speechSynthesis.getVoices()
        if (voices.length > 0) {
          const match = voices.find(v => v.name === savedVoiceName)
          if (match) utterance.voice = match
        } else {
          // Voices not loaded yet — defer speak until they are
          window.speechSynthesis.cancel()
          const onVoicesReady = () => {
            window.speechSynthesis.removeEventListener('voiceschanged', onVoicesReady)
            const loadedVoices = window.speechSynthesis.getVoices()
            const match = loadedVoices.find(v => v.name === savedVoiceName)
            const deferred = new SpeechSynthesisUtterance(clean)
            deferred.rate = 0.95
            deferred.pitch = 1
            deferred.volume = 1
            deferred.onend = () => onEnd()
            deferred.onerror = () => onEnd()
            if (match) deferred.voice = match
            window.speechSynthesis.speak(deferred)
          }
          window.speechSynthesis.addEventListener('voiceschanged', onVoicesReady)
          return
        }
      }
      utteranceRef.current = utterance

      window.speechSynthesis.speak(utterance)
    },
    [ttsEnabled]
  )

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

  return { speak, stop, speakWithCallback }
}