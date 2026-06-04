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
                .replace(/\s+/g, ' ')               // collapse whitespace
                .trim()

            if (!clean) return

            window.speechSynthesis.cancel()

            const utterance = new SpeechSynthesisUtterance(clean)
            utterance.rate = 0.95
            utterance.pitch = 1
            utterance.volume = 1

            // Apply saved voice preference — getVoices() may return [] on Linux
            const savedVoiceName = localStorage.getItem('ttsVoice')
            if (savedVoiceName) {
                const voices = window.speechSynthesis.getVoices()
                if (voices.length > 0) {
                    const match = voices.find(v => v.name === savedVoiceName)
                    if (match) utterance.voice = match
                    // If no match (voice uninstalled/changed OS), fall back to system default silently
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

    return { speak, stop }
}