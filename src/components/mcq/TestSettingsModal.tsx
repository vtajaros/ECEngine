import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, X, ClipboardList, Shuffle, Bookmark, Zap, Dices } from 'lucide-react'

export interface TestSettings {
  instantChecking: boolean
  shuffleQuestions: boolean
  shuffleChoices: boolean
  bookmarkedOnly: boolean
  itemCount: 'All' | number
  randomSample: boolean
}

interface StudySet {
  id: string
  count: number
}

interface TestSettingsModalProps {
  isOpen: boolean
  setId: string | null
  settings: TestSettings
  allSets: StudySet[]
  onSettingsChange: (settings: TestSettings) => void
  onStart: () => void
  onClose: () => void
}

export const TestSettingsModal: React.FC<TestSettingsModalProps> = ({
  isOpen,
  setId,
  settings,
  allSets,
  onSettingsChange,
  onStart,
  onClose,
}) => {
  const setInfo = allSets.find(s => s.id === setId)

  const toggle = (key: keyof TestSettings) => {
    onSettingsChange({ ...settings, [key]: !settings[key as keyof TestSettings] })
  }

  const renderToggle = (
    key: 'instantChecking' | 'shuffleQuestions' | 'shuffleChoices' | 'bookmarkedOnly' | 'randomSample',
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
            {/* Header */}
            <div className="p-6 border-b border-border-base flex justify-between items-center bg-surface-2">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-bold text-text-primary font-['Orbitron'] uppercase tracking-wider">
                  Test Settings
                </h2>
              </div>
              <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
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
                    <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-text-muted">Number of Items</label>
                    <div className="grid grid-cols-4 gap-2">
                      {options.map(count => (
                        <button
                          key={count}
                          onClick={() => onSettingsChange({ ...settings, itemCount: count })}
                          className={`py-2 rounded font-['Rajdhani'] uppercase tracking-wider text-sm transition-all border ${
                            settings.itemCount === count
                              ? 'bg-[rgba(0,255,65,0.1)] border-accent text-accent'
                              : 'bg-surface-2 border-[#333] text-text-muted hover:border-[#555]'
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
                        className={`py-2 px-1 rounded font-['Rajdhani'] uppercase tracking-wider text-sm transition-all border outline-none text-center bg-surface-2 ${
                          typeof settings.itemCount === 'number' && !options.includes(settings.itemCount)
                            ? 'bg-[rgba(0,255,65,0.1)] border-accent text-accent'
                            : 'border-[#333] text-text-muted hover:border-[#555] focus:border-[#555] placeholder-[#555]'
                        }`}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* Toggles */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-['Rajdhani'] uppercase tracking-widest text-text-muted">Options</label>
                <div className="flex flex-col gap-2">
                  {renderToggle('instantChecking', 'Instant Checking', ({ className }) => <Zap className={className} />)}
                  {renderToggle('shuffleQuestions', 'Shuffle Questions', ({ className }) => <Shuffle className={className} />)}
                  {renderToggle('shuffleChoices', 'Shuffle Choices', ({ className }) => <Shuffle className={className} />)}
                  {renderToggle('bookmarkedOnly', 'Bookmarked Only', ({ className }) => <Bookmark className={className} />)}
                  {renderToggle('randomSample', 'Random Sample', ({ className }) => <Dices className={className} />)}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border-base bg-surface-2 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded bg-transparent border border-[#333] text-text-muted hover:text-text-primary hover:border-[#555] transition-colors font-['Rajdhani'] uppercase tracking-wider text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onStart}
                className="flex items-center px-6 py-2 rounded bg-[var(--accent-primary)] text-black font-bold hover:bg-[rgba(0,255,65,0.8)] shadow-[0_0_10px_rgba(0,255,65,0.2)] transition-all font-['Rajdhani'] uppercase tracking-wider text-sm"
              >
                <Play className="w-4 h-4 mr-2 fill-current" />
                Start Test
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
