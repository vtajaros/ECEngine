import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, X, Settings2, Shuffle, Bookmark, Volume2, RefreshCw, Timer } from 'lucide-react'

export interface FlashCardSettings {
  shuffleCards: boolean
  swappedTerms: boolean
  bookmarkedOnly: boolean
  ttsEnabled: boolean
  autoplay: boolean
  autoplayDelay: number
}

export const FLASH_SETTINGS_DEFAULTS: FlashCardSettings = {
  shuffleCards: false,
  swappedTerms: false,
  bookmarkedOnly: false,
  ttsEnabled: false,
  autoplay: false,
  autoplayDelay: 2,
}

const TTS_FLASH_KEY = 'ecengine:flash:tts:enabled'

export function loadFlashTTSPreference(): boolean {
  try {
    return localStorage.getItem(TTS_FLASH_KEY) === 'true'
  } catch {
    return false
  }
}

interface StudySet {
  id: string
  count: number
}

interface FlashCardSettingsModalProps {
  isOpen: boolean
  setId: string | null
  settings: FlashCardSettings
  allSets: StudySet[]
  onSettingsChange: (settings: FlashCardSettings) => void
  onStart: () => void
  onClose: () => void
}

export const FlashCardSettingsModal: React.FC<FlashCardSettingsModalProps> = ({
  isOpen,
  setId,
  settings,
  allSets,
  onSettingsChange,
  onStart,
  onClose,
}) => {
  const toggle = (key: keyof FlashCardSettings) => {
    const next = { ...settings, [key]: !settings[key as keyof FlashCardSettings] }
    onSettingsChange(next)
    if (key === 'ttsEnabled') {
      try {
        localStorage.setItem(TTS_FLASH_KEY, String(!settings.ttsEnabled))
      } catch { }
    }
  }

  const renderToggle = (
    key: 'shuffleCards' | 'swappedTerms' | 'bookmarkedOnly' | 'ttsEnabled' | 'autoplay',
    label: string,
    Icon: React.FC<{ className?: string }>
  ) => (
    <button
      onClick={() => toggle(key)}
      className="flex items-center justify-between p-3 bg-surface-2 rounded border border-border-base hover:border-[#333] transition-colors"
    >
      <div className="flex items-center gap-3 text-text-primary font-['Rajdhani'] tracking-wider text-sm">
        <Icon className="w-4 h-4 text-text-muted" />
        {label}
      </div>
      <div className={`w-10 h-5 rounded-full transition-colors relative ${settings[key] ? 'bg-[rgba(0,255,65,0.2)]' : 'bg-border-base'}`}>
        <div className={`absolute top-1 max-w-[calc(100%-8px)] h-3 w-3 rounded-full transition-all ${settings[key] ? 'bg-accent left-6' : 'bg-text-muted left-1'}`} />
      </div>
    </button>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-[#111] border border-[#333] rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-border-base flex justify-between items-center bg-surface-2">
              <div className="flex items-center gap-3">
                <Settings2 className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-bold text-text-primary font-['Orbitron'] uppercase tracking-wider">
                  Flashcard Settings
                </h2>
              </div>
              <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-text-muted">Modifiers</label>
                <div className="flex flex-col gap-2">
                  {renderToggle('shuffleCards', 'Shuffle Cards', ({ className }) => <Shuffle className={className} />)}
                  {renderToggle('swappedTerms', 'Swap Term / Definition', ({ className }) => <RefreshCw className={className} />)}
                  {renderToggle('bookmarkedOnly', 'Bookmarked Only', ({ className }) => <Bookmark className={className} />)}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-text-muted">Autoplay</label>
                <div className="flex flex-col gap-2">
                  {renderToggle('autoplay', 'Auto-Advance Cards', ({ className }) => <Timer className={className} />)}
                  {settings.autoplay && (
                    <div className="flex items-center justify-between p-3 bg-surface-2 rounded border border-border-base">
                      <div className="flex items-center gap-3 text-text-primary font-['Rajdhani'] tracking-wider text-sm">
                        <Timer className="w-4 h-4 text-text-muted" />
                        Delay per card
                      </div>
                      <div className="flex items-center gap-2">
                        {[1.5, 2, 3, 5, 10].map(s => (
                          <button
                            key={s}
                            onClick={() => onSettingsChange({ ...settings, autoplayDelay: s })}
                            className={`px-2 py-1 rounded text-xs font-['IBM_Plex_Mono'] border transition-all ${settings.autoplayDelay === s ? 'bg-[rgba(0,255,65,0.1)] border-accent text-accent' : 'bg-[#111] border-[#333] text-text-muted hover:border-[#555]'}`}
                          >
                            {s}s
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-text-muted">Accessibility</label>
                <div className="flex flex-col gap-2">
                  {renderToggle('ttsEnabled', 'Read Terms Aloud (Text To Speech)', ({ className }) => <Volume2 className={className} />)}
                </div>
                {settings.ttsEnabled && (() => {
                  const isLinux = window.electron?.platform === 'linux'
                  const rawVoice = isLinux
                    ? localStorage.getItem('ecengine:tts:piperModelPath')
                    : localStorage.getItem('ecengine:tts:voice')
                  const voiceName = isLinux && rawVoice ? rawVoice.split('/').pop() : rawVoice
                  return voiceName ? (
                    <p className="text-[10px] text-[#555] font-['IBM_Plex_Mono'] leading-relaxed">
                      Voice: <span className="text-accent">{voiceName}</span>. The front face of each card is read aloud when it appears.
                    </p>
                  ) : (
                    <p className="text-[10px] text-[#FF4444] font-['IBM_Plex_Mono'] leading-relaxed">
                      ⚠ No voice selected. Go to Settings → Accessibility to pick a voice before enabling TTS.
                    </p>
                  )
                })()}
              </div>
            </div>

            <div className="p-6 border-t border-border-base bg-surface-2 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded bg-transparent border border-[#333] text-text-muted hover:text-text-primary hover:border-[#555] transition-colors font-['Rajdhani'] uppercase tracking-wider text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onStart}
                className="flex items-center px-6 py-2 rounded bg-accent text-black font-bold hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all font-['Rajdhani'] uppercase tracking-wider text-sm"
              >
                <Play className="w-4 h-4 mr-2 fill-current" />
                Start Session
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}