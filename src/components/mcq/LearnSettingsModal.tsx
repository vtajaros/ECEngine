import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, X, Settings2, Shuffle, Bookmark, Dices, Volume2 } from 'lucide-react'

export interface LearnSettings {
  type: string
  shuffleQuestions: boolean
  shuffleChoices: boolean
  bookmarkedOnly: boolean
  itemCount: 'All' | number
  randomSample: boolean
  // ── TTS ─────────────────────────────────────────────────────────────────────
  // Persisted to localStorage under the key 'ecengine:tts:enabled' so the
  // preference survives navigation without polluting useSessionStore (which is
  // SM2-only). Default: false — never auto-speak without explicit opt-in.
  ttsEnabled: boolean
}

interface StudySet {
  id: string
  count: number
}

interface LearnSettingsModalProps {
  isOpen: boolean
  setId: string | null
  settings: LearnSettings
  allSets: StudySet[]
  onSettingsChange: (settings: LearnSettings) => void
  onStart: () => void
  onClose: () => void
}

const TTS_STORAGE_KEY = 'ecengine:tts:enabled'

/** Read the persisted TTS preference. Call this when initialising LearnSettings
 *  in LooksFamStudy so the default reflects the user's last choice. */
export function loadTTSPreference(): boolean {
  try {
    return localStorage.getItem(TTS_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const LearnSettingsModal: React.FC<LearnSettingsModalProps> = ({
  isOpen,
  setId,
  settings,
  allSets,
  onSettingsChange,
  onStart,
  onClose,
}) => {
  const setInfo = allSets.find(s => s.id === setId)

  const toggle = (key: keyof LearnSettings) => {
    const next = { ...settings, [key]: !settings[key as keyof LearnSettings] }
    onSettingsChange(next)
    // Persist TTS preference immediately on toggle
    if (key === 'ttsEnabled') {
      try {
        localStorage.setItem(TTS_STORAGE_KEY, String(!settings.ttsEnabled))
      } catch { /* storage unavailable — silent fail */ }
    }
  }

  const renderToggle = (
    key: 'shuffleQuestions' | 'shuffleChoices' | 'bookmarkedOnly' | 'randomSample' | 'ttsEnabled',
    label: string,
    Icon: React.FC<{ className?: string }>
  ) => (
    <button
      onClick={() => toggle(key)}
      className="flex items-center justify-between p-3 bg-[#161616] rounded border border-[#222] hover:border-[#333] transition-colors"
    >
      <div className="flex items-center gap-3 text-[#E8E8E8] font-['Rajdhani'] tracking-wider text-sm">
        <Icon className="w-4 h-4 text-[#888]" />
        {label}
      </div>
      <div className={`w-10 h-5 rounded-full transition-colors relative ${settings[key] ? 'bg-[rgba(0,255,65,0.2)]' : 'bg-[#222]'}`}>
        <div className={`absolute top-1 max-w-[calc(100%-8px)] h-3 w-3 rounded-full transition-all ${settings[key] ? 'bg-[#00FF41] left-6' : 'bg-[#888] left-1'}`} />
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
            {/* Header */}
            <div className="p-6 border-b border-[#222] flex justify-between items-center bg-[#161616]">
              <div className="flex items-center gap-3">
                <Settings2 className="w-5 h-5 text-[#00FF41]" />
                <h2 className="text-xl font-bold text-[#E8E8E8] font-['Orbitron'] uppercase tracking-wider">
                  Learn Settings
                </h2>
              </div>
              <button onClick={onClose} className="text-[#888] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-6">
              {/* Item Count — only shown if set has more than 20 items */}
              {setInfo && setInfo.count > 20 && (() => {
                const options: ('All' | number)[] = ['All', ...[20, 50, 100].filter(c => c < setInfo.count)]
                return (
                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">Number of Items</label>
                    <div className="grid grid-cols-4 gap-2">
                      {options.map(count => (
                        <button
                          key={count}
                          onClick={() => onSettingsChange({ ...settings, itemCount: count })}
                          className={`py-2 rounded font-['Rajdhani'] uppercase tracking-wider text-sm transition-all border ${settings.itemCount === count
                            ? 'bg-[rgba(0,255,65,0.1)] border-[#00FF41] text-[#00FF41]'
                            : 'bg-[#161616] border-[#333] text-[#888] hover:border-[#555]'
                            }`}
                        >
                          {count}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        max={setInfo.count}
                        placeholder="Custom"
                        value={typeof settings.itemCount === 'number' && !options.includes(settings.itemCount) ? settings.itemCount : ''}
                        onChange={e => {
                          if (e.target.value === '') {
                            onSettingsChange({ ...settings, itemCount: 'All' })
                            return
                          }
                          const val = parseInt(e.target.value)
                          if (!isNaN(val)) {
                            onSettingsChange({ ...settings, itemCount: Math.min(Math.max(val, 1), setInfo.count) })
                          }
                        }}
                        className={`py-2 px-1 rounded font-['Rajdhani'] uppercase tracking-wider text-sm transition-all border outline-none text-center bg-[#161616] ${typeof settings.itemCount === 'number' && !options.includes(settings.itemCount)
                          ? 'bg-[rgba(0,255,65,0.1)] border-[#00FF41] text-[#00FF41]'
                          : 'border-[#333] text-[#888] hover:border-[#555] focus:border-[#555] placeholder-[#555]'
                          }`}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* Toggles */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">Modifiers</label>
                <div className="flex flex-col gap-2">
                  {renderToggle('shuffleQuestions', 'Shuffle Questions', ({ className }) => <Shuffle className={className} />)}
                  {renderToggle('shuffleChoices', 'Shuffle Choices', ({ className }) => <Shuffle className={className} />)}
                  {renderToggle('bookmarkedOnly', 'Bookmarked Only', ({ className }) => <Bookmark className={className} />)}
                  {renderToggle('randomSample', 'Random Sample', ({ className }) => <Dices className={className} />)}
                </div>
              </div>

              {/* TTS — separate section to signal it's a session-wide behaviour */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888]">Accessibility</label>
                <div className="flex flex-col gap-2">
                  {renderToggle('ttsEnabled', 'Read Questions Aloud (TTS)', ({ className }) => <Volume2 className={className} />)}
                </div>
                {settings.ttsEnabled && (
                  <p className="text-[10px] text-[#555] font-['IBM_Plex_Mono'] leading-relaxed">
                    Uses your system voice. Questions are read when each card appears. Math notation is skipped.
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#222] bg-[#161616] flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded bg-transparent border border-[#333] text-[#888] hover:text-[#E8E8E8] hover:border-[#555] transition-colors font-['Rajdhani'] uppercase tracking-wider text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onStart}
                className="flex items-center px-6 py-2 rounded bg-[#00FF41] text-black font-bold hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all font-['Rajdhani'] uppercase tracking-wider text-sm"
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