import React, { useState, useEffect, useRef } from 'react'
import { Settings as SettingsIcon, Monitor, Bell, Database, Shield, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { dbService } from '../services/db.service'
import { getCustomWrongSoundEnabled, setCustomWrongSoundEnabled } from '../hooks/useSound'
import { SUBJECT_MAP, getSubjectBadgeClasses } from '../lib/subjectColors'

function topicHasType(topic: { types?: string }, filter: 'ALL' | 'FC' | 'MCQ'): boolean {
  if (filter === 'ALL') return true
  if (!topic.types) return false
  const types = topic.types.split(',')
  if (filter === 'FC') return types.includes('flashcard') || types.includes('formula')
  if (filter === 'MCQ') return types.includes('mcq')
  return true
}

export default function Settings() {

  const [resetResetMenuOpen, setResetResetMenuOpen] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [advancedSyncEnabled, setAdvancedSyncEnabled] = useState(false);
  const [customWrongSound, setCustomWrongSound] = useState(() => getCustomWrongSoundEnabled())
  const [showFormulaBank, setShowFormulaBank] = useState(
    () => localStorage.getItem('ecengine:show-formula-bank') === 'true'
  )

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('ecengine:sidebar-collapsed') === 'true'
  )

  const [showExportModal, setShowExportModal] = useState(false);
  const [allTopics, setAllTopics] = useState<{ id: string; name: string; subject: string; types?: string }[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [exportMode, setExportMode] = useState<'all' | 'select'>('all');
  const [exportSubjectFilter, setExportSubjectFilter] = useState<string>('ALL');
  const [exportTypeFilter, setExportTypeFilter] = useState<'ALL' | 'FC' | 'MCQ'>('ALL');

  // TTS voice selection
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedSystemVoice, setSelectedSystemVoice] = useState<string>(
    () => localStorage.getItem('ecengine:tts:voice') ?? ''
  )
  const voicesLoadedRef = useRef(false)

  // API Key State — stored main-process-only; renderer only learns if it is configured
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);

  useEffect(() => {
    const check = async () => {
      const result = await window.electron.config.getApiKeyStatus();
      setApiKeyConfigured(result?.configured ?? false);
    };
    check();
  }, []);

  // Load available TTS voices — getVoices() is async in Chromium, fires voiceschanged event
  useEffect(() => {
    const load = () => {
      if (voicesLoadedRef.current) return
      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) return
      voicesLoadedRef.current = true
      const englishVoices = voices.filter(v => v.lang.startsWith('en')).sort((a, b) => {
        const aMark = a.name.includes('Microsoft Mark')
        const bMark = b.name.includes('Microsoft Mark')
        if (aMark && !bMark) return -1
        if (bMark && !aMark) return 1
        return a.name.localeCompare(b.name)
      })
      setAvailableVoices(englishVoices)
  
      // Auto-select Microsoft Mark if user has no saved preference
      const saved = localStorage.getItem('ecengine:tts:voice')
      if (!saved) {
        const mark = englishVoices.find(v => v.name.includes('Microsoft Mark'))
        if (mark) {
          localStorage.setItem('ecengine:tts:voice', mark.name)
          setSelectedSystemVoice(mark.name)
        }
      }
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // ── Countdown for delete ──
  useEffect(() => {
    if (showClearModal) {
      setDeleteCountdown(2)
      const timer = setInterval(() => {
        setDeleteCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [showClearModal])

  const handleSaveApiKey = async () => {
    const result = await window.electron.config.setApiKey(apiKeyInput);
    if (result?.success) {
      setApiKeyConfigured(apiKeyInput.trim().length > 0);
      setApiKeyInput('');
      setToastMessage('API Key saved successfully!');
    } else {
      setToastMessage('Failed to save API Key.');
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleResetProgress = async () => {
    try {
      await dbService.resetProgress();
      setResetResetMenuOpen(false);
      setToastMessage('Mastery progress reset successfully!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (error) {
      setToastMessage((error as Error).message);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleClearAllDecks = async () => {
    // Delete from SQL/Web DB (FK-safe order)
    await dbService.clearAllData();

    setShowClearModal(false);
    setToastMessage('All decks and progress cleared successfully!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleConfirmExport = async () => {
    try {
      let dataStr = '';
      if (exportMode === 'all') {
        dataStr = await dbService.exportDecks();
      } else {
        if (selectedTopicIds.size === 0) return;
        dataStr = await dbService.exportSelectedDecks(Array.from(selectedTopicIds));
      }

      const res = await window.electron.file.export(dataStr);
      if (res.success) {
        setToastMessage('Database exported successfully!');
        setShowExportModal(false);
        setExportSubjectFilter('ALL');
        setExportTypeFilter('ALL');
        setTimeout(() => setToastMessage(null), 3000);
      } else if (!res.canceled) {
        setToastMessage(res.error || 'Export failed.');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (e) {
      console.error(e);
      setToastMessage('Export failed.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleImportDecks = async () => {
    try {
      const res = await window.electron.file.import();
      if (res.success && res.data) {
        const result = await dbService.importDecks(res.data);
        setToastMessage(result.message);
        setTimeout(() => setToastMessage(null), 3000);
        if (result.success) {
          setTimeout(() => window.location.reload(), 1500);
        }
      } else if (!res.canceled) {
        setToastMessage(res.error || 'Import failed.');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage('Import failed.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const filteredBySubject = exportSubjectFilter === 'ALL'
    ? allTopics
    : allTopics.filter(t => (SUBJECT_MAP[t.subject] ?? t.subject) === exportSubjectFilter);

  const filteredTopics = filteredBySubject.filter(t => topicHasType(t, exportTypeFilter));

  const sections = [
    {
      title: 'Data & Sync',
      icon: <Database size={20} className="text-accent" />,
      options: [
        {
          label: 'Minimize Sidebar on Start',
          type: 'custom-toggle',
          actionId: 'sidebar-collapse-toggle'
        },
        {
          label: 'Show Formula Bank',
          description: 'Show the Formula Bank page in the sidebar navigation.',
          type: 'custom-toggle',
          advanced: true,
          actionId: 'formula-bank-toggle'
        },
        { label: 'Auto-Backup Progress Locally', type: 'toggle', current: true, advanced: true },
        { label: 'Import Decks', type: 'action', buttonText: 'IMPORT JSON', actionId: 'import', advanced: true },
        { label: 'Export Decks', type: 'action', buttonText: 'EXPORT JSON', actionId: 'export', advanced: true },
        { label: 'Reset Mastery Progress', type: 'action', buttonText: 'Reset Progress', actionId: 'reset-progress', advanced: true },
        { label: 'Clear All Decks', type: 'action', buttonText: 'CLEAR ALL DECKS', danger: true, actionId: 'clear-all', advanced: true },
      ]
    }
  ]

  return (
    <div className="h-full bg-engine-black px-8 pb-8 pt-6 lg:px-12 lg:pb-12 lg:pt-6 overflow-y-auto show-scrollbar w-full relative">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 flex flex-col items-center text-center gap-2">
          <h1 className="font-['Orbitron'] text-4xl font-bold text-text-primary tracking-wider flex items-center justify-center">
            <SettingsIcon className="text-accent mr-4" size={36} />
            SETTINGS
          </h1>
          <p className="text-text-muted font-['Rajdhani'] text-lg uppercase tracking-widest mt-2">
            MANAGE YOUR AI INTEGRATION, APPLICATION BEHAVIOR, AND FLASHCARD DATA
          </p>
        </header>

        <div className="space-y-12">
          {/* AI Integration Section */}
          <section>
            <h2 className="font-['Rajdhani'] font-bold text-xl text-text-primary mb-6 uppercase tracking-wider flex items-center border-b border-surface-2 pb-4">
              <Shield size={20} className="text-accent" />
              <span className="ml-3">AI Integration</span>
            </h2>
            <div className="bg-[#111111] p-6 lg:p-8 rounded-lg border border-surface-2 shadow-lg space-y-4">
              <div className="flex flex-col gap-2">
                <label className="font-['IBM_Plex_Mono'] text-[var(--text-primary)] text-sm">Groq API Key</label>

                {/* Status badge */}
                <div className="flex items-center gap-2 bg-surface-2 border border-border-base rounded px-4 py-3">
                  {apiKeyConfigured ? (
                    <>
                      <CheckCircle size={16} className="text-[var(--accent-primary)] shrink-0" />
                      <span className="font-['IBM_Plex_Mono'] text-[var(--accent-primary)] text-sm">API key configured ✓</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} className="text-[var(--color-wrong)] shrink-0" />
                      <span className="font-['IBM_Plex_Mono'] text-[var(--color-wrong)] text-sm">No API key set</span>
                    </>
                  )}
                </div>

                {/* Input to set a new key — value is never read back from main process */}
                <div className="flex gap-4 mt-2">
                  <input
                    type="password"
                    placeholder={apiKeyConfigured ? 'Enter new key to replace…' : 'Enter your Groq API key…'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="flex-1 bg-surface-2 border border-border-base focus:border-[var(--accent-primary)] rounded px-4 py-2 text-[var(--text-primary)] outline-none font-['IBM_Plex_Mono'] transition-colors"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={apiKeyInput.trim().length === 0}
                    className="px-6 py-2 border border-[var(--accent-primary)] text-[var(--accent-primary)] rounded hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)] font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save Key
                  </button>
                </div>

                <p className="text-[#999] text-xs font-['Rajdhani'] uppercase tracking-widest mt-2">
                  Required for AI explanations. Get a free key at <button type="button" onClick={() => window.electron.shell.openExternal('https://console.groq.com/keys')} className="text-[var(--accent-primary)] hover:underline transition-all bg-transparent border-none p-0 inline font-inherit cursor-pointer">console.groq.com/keys</button>.
                </p>
              </div>
            </div>
          </section>

          {/* Sound & Feedback Section */}
          <section>
            <h2 className="font-['Rajdhani'] font-bold text-xl text-text-primary mb-6 uppercase tracking-wider flex items-center border-b border-surface-2 pb-4">
              <Bell size={20} className="text-accent" />
              <span className="ml-3">Sound & Feedback</span>
            </h2>
            <div className="bg-[#111111] p-6 lg:p-8 rounded-lg border border-surface-2 shadow-lg space-y-6">
              <div className="flex flex-row items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-['IBM_Plex_Mono'] text-text-primary text-sm md:text-base">
                    Reading Voice
                  </span>
                  <span className="font-['Rajdhani'] text-[#999] text-xs uppercase tracking-widest text-left">
                    {availableVoices.length > 0
                      ? `${availableVoices.length} English voices available — Microsoft Mark recommended`
                      : 'Loading voices…'}
                  </span>
                </div>
                <select
                  value={selectedSystemVoice}
                  onChange={(e) => {
                    setSelectedSystemVoice(e.target.value)
                    localStorage.setItem('ecengine:tts:voice', e.target.value)
                  }}
                  disabled={availableVoices.length === 0}
                  className="bg-surface-2 border border-border-base focus:border-accent rounded px-4 py-2 text-sm text-text-primary outline-none font-['Rajdhani'] uppercase tracking-wider max-w-[220px] disabled:opacity-40"
                >
                  <option value="">System Default</option>
                  {availableVoices.map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name}{v.name.includes('Microsoft Mark') ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="border-t border-surface-2 pt-6 flex flex-row items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-['IBM_Plex_Mono'] text-text-primary text-sm md:text-base">
                    Disable Faah Sound Meme
                  </span>
                  <span className="font-['Rajdhani'] text-[#999] text-xs uppercase tracking-widest">
                    {customWrongSound ? 'Using faah sound meme' : 'Using default synthesized sound'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const next = !customWrongSound
                    setCustomWrongSound(next)
                    setCustomWrongSoundEnabled(next)
                  }}
                  className={`w-14 h-7 rounded-full p-1 transition-colors focus:outline-none relative shadow-inner ${!customWrongSound
                    ? 'bg-[rgba(0,255,65,0.2)] border border-accent'
                    : 'bg-surface-2 border border-border-base'
                    }`}
                >
                  <span className={`block w-5 h-5 rounded-full shadow-md transform transition-transform ${!customWrongSound
                    ? 'bg-accent translate-x-7 shadow-[0_0_8px_rgba(0,255,65,0.8)]'
                    : 'bg-[#555] translate-x-0'
                    }`} />
                </button>
              </div>
            </div>
          </section>

          {sections.map((section, idx) => (
            <section key={idx}>
              <h2 className="font-['Rajdhani'] font-bold text-xl text-text-primary mb-6 uppercase tracking-wider flex items-center justify-between border-b border-surface-2 pb-4">
                <div className="flex items-center">
                  {section.icon}
                  <span className="ml-3">{section.title}</span>
                </div>
                {section.title === 'Data & Sync' && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#666] tracking-widest uppercase font-bold">Unlock Advanced</span>
                    <button
                      onClick={() => setAdvancedSyncEnabled(!advancedSyncEnabled)}
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors ${advancedSyncEnabled ? 'bg-[rgba(255,51,51,0.2)] border border-danger' : 'bg-surface-2 border border-border-base'} focus:outline-none relative shadow-inner flex items-center`}
                    >
                      <span className={`block w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${advancedSyncEnabled ? 'bg-danger translate-x-5 shadow-[0_0_8px_rgba(255,51,51,0.8)]' : 'bg-[#555] translate-x-0'}`} />
                    </button>
                  </div>
                )}
              </h2>

              <div className="bg-[#111111] p-6 lg:p-8 rounded-lg border border-surface-2 shadow-lg space-y-8">
                {section.options.map((opt, idy) => {
                  const isAdvanced = (opt as any).advanced;
                  const isDisabled = isAdvanced && section.title === 'Data & Sync' && !advancedSyncEnabled;

                  return (
                    <div key={idy} className={`flex flex-row items-center justify-between gap-4 transition-all duration-300 ${isDisabled ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                      <div className="font-['IBM_Plex_Mono'] text-text-primary text-sm md:text-base">
                        {opt.label}
                      </div>

                      {opt.type === 'toggle' && (
                        <button className={`w-14 h-7 rounded-full p-1 transition-colors ${opt.current ? 'bg-[rgba(0,255,65,0.2)] border border-accent' : 'bg-surface-2 border border-border-base'} focus:outline-none relative shadow-inner`}>
                          <span className={`block w-5 h-5 rounded-full shadow-md transform transition-transform ${opt.current ? 'bg-accent translate-x-7 shadow-[0_0_8px_rgba(0,255,65,0.8)]' : 'bg-[#555] translate-x-0'}`} />
                        </button>
                      )}

                      {opt.type === 'custom-toggle' && (opt as any).actionId === 'sidebar-collapse-toggle' && (
                        <button
                          onClick={() => {
                            const next = !sidebarCollapsed
                            setSidebarCollapsed(next)
                            localStorage.setItem('ecengine:sidebar-collapsed', String(next))
                            window.dispatchEvent(new Event('ecengine:settings-changed'))
                          }}
                          className={`w-14 h-7 rounded-full p-1 transition-colors ${sidebarCollapsed ? 'bg-[rgba(0,255,65,0.2)] border border-accent' : 'bg-surface-2 border border-border-base'} focus:outline-none relative shadow-inner`}
                        >
                          <span className={`block w-5 h-5 rounded-full shadow-md transform transition-transform ${sidebarCollapsed ? 'bg-accent translate-x-7 shadow-[0_0_8px_rgba(0,255,65,0.8)]' : 'bg-[#555] translate-x-0'}`} />
                        </button>
                      )}

                      {opt.type === 'custom-toggle' && (opt as any).actionId === 'formula-bank-toggle' && (
                        <button
                          onClick={() => {
                            const next = !showFormulaBank
                            setShowFormulaBank(next)
                            localStorage.setItem('ecengine:show-formula-bank', String(next))
                            window.dispatchEvent(new Event('ecengine:settings-changed'))
                          }}
                          className={`w-14 h-7 rounded-full p-1 transition-colors ${showFormulaBank ? 'bg-[rgba(0,255,65,0.2)] border border-accent' : 'bg-surface-2 border border-border-base'} focus:outline-none relative shadow-inner`}
                        >
                          <span className={`block w-5 h-5 rounded-full shadow-md transform transition-transform ${showFormulaBank ? 'bg-accent translate-x-7 shadow-[0_0_8px_rgba(0,255,65,0.8)]' : 'bg-[#555] translate-x-0'}`} />
                        </button>
                      )}

                      {opt.type === 'select' && (
                        <select className="bg-surface-2 border border-border-base rounded px-4 py-2 text-sm text-text-primary focus:border-accent outline-none font-['Rajdhani'] uppercase tracking-wider">
                          <option>{opt.current}</option>
                        </select>
                      )}

                      {opt.type === 'action' && (
                        <button
                          onClick={() => {
                            if ((opt as any).actionId === 'reset-progress') {
                              setResetResetMenuOpen(true);
                            } else if ((opt as any).actionId === 'clear-all') {
                              setShowClearModal(true);
                            } else if ((opt as any).actionId === 'export') {
                              const fetchTopics = async () => {
                                const res = await window.electron.decks.getTopicsWithCardCounts();
                                if (res.success && res.data) {
                                  setAllTopics(res.data);
                                }
                              };
                              fetchTopics();
                              setShowExportModal(true);
                            } else if ((opt as any).actionId === 'import') {
                              handleImportDecks();
                            }
                          }}
                          className={`px-4 py-2 border rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all ${(opt as any).danger
                            ? 'border-danger text-danger hover:bg-[rgba(255,51,51,0.1)] hover:shadow-[0_0_10px_rgba(255,51,51,0.5)]'
                            : 'border-accent text-accent hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)]'
                            }`}>
                          {(opt as any).buttonText}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-surface-2 border border-accent shadow-[0_0_15px_rgba(0,255,65,0.2)] px-6 py-3 rounded-full flex items-center gap-3 z-[100]"
          >
            <CheckCircle className="w-5 h-5 text-accent" />
            <span className="text-text-primary font-['Rajdhani'] font-bold tracking-widest uppercase text-sm">
              {toastMessage}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Progress Modal */}
      <AnimatePresence>
        {resetResetMenuOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setResetResetMenuOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#FF8800] to-transparent" />
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#FF8800]/10 border border-[#FF8800]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,136,0,0.1)]">
                  <AlertTriangle className="w-8 h-8 text-[#FF8800]" />
                </div>
                <h3 className="text-2xl font-['Orbitron'] font-bold text-white mb-4 tracking-widest uppercase">
                  Reset Mastery Progress
                </h3>
                <p className="text-text-muted font-['IBM_Plex_Mono'] mb-8 leading-relaxed">
                  Are you sure you want to reset all mastery and progress data across all decks? This will clear your studied status but keep your decks intact.
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={handleResetProgress}
                    className="w-full py-4 bg-[#FF8800] hover:bg-[#CC6600] text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,136,0,0.2)] hover:shadow-[0_0_25px_rgba(255,136,0,0.4)]"
                  >
                    Confirm Reset
                  </button>
                  <button
                    onClick={() => setResetResetMenuOpen(false)}
                    className="w-full py-4 bg-surface border border-[#333] hover:border-[#555] text-text-muted hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <button
                onClick={() => setResetResetMenuOpen(false)}
                className="absolute top-4 right-4 text-[#444] hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Decks Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowExportModal(false);
                setExportSubjectFilter('ALL');
                setExportTypeFilter('ALL');
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#111] border border-[#333] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden max-h-[80vh]"
            >
              <div className="h-1 w-full shrink-0 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent" />
              <div className="p-8 flex flex-col flex-1 overflow-hidden">
                <h3 className="text-2xl font-['Orbitron'] font-bold text-white mb-6 tracking-widest uppercase text-center shrink-0">
                  EXPORT DECKS
                </h3>
                
                <div className="flex bg-[#222] rounded-lg p-1 mb-6 shrink-0">
                  <button
                    onClick={() => setExportMode('all')}
                    className={`flex-1 py-2 text-sm font-['Rajdhani'] font-bold uppercase tracking-widest rounded-md transition-colors ${exportMode === 'all' ? 'bg-[var(--accent-primary)] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                  >
                    EXPORT ALL
                  </button>
                  <button
                    onClick={() => setExportMode('select')}
                    className={`flex-1 py-2 text-sm font-['Rajdhani'] font-bold uppercase tracking-widest rounded-md transition-colors ${exportMode === 'select' ? 'bg-[var(--accent-primary)] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
                  >
                    SELECT DECKS
                  </button>
                </div>

                {exportMode === 'all' ? (
                  <div className="flex-1 flex items-center justify-center min-h-[150px]">
                    <p className="text-gray-400 font-['IBM_Plex_Mono'] text-center px-4">
                      This will export all decks, flashcards, and your entire study progress into a single JSON file.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex gap-2 mb-2 shrink-0 flex-wrap">
                      {['ALL', 'MATH', 'GEAS', 'ELECS', 'EST'].map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setExportSubjectFilter(filter)}
                          className={`font-['Rajdhani'] text-[11px] uppercase tracking-widest px-3 py-1 rounded-full transition-colors ${
                            exportSubjectFilter === filter
                              ? 'bg-[var(--accent-primary)] text-black'
                              : 'border border-[#333] text-gray-400 hover:border-accent hover:text-accent'
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 mb-4 shrink-0 flex-wrap">
                      {['ALL', 'FC', 'MCQ'].map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setExportTypeFilter(filter as 'ALL' | 'FC' | 'MCQ')}
                          className={`font-['Rajdhani'] text-[11px] uppercase tracking-widest px-3 py-1 rounded-full transition-colors ${
                            exportTypeFilter === filter
                              ? 'bg-[var(--accent-primary)] text-black'
                              : 'border border-[#333] text-gray-400 hover:border-accent hover:text-accent'
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-between items-center mb-4 shrink-0">
                      <span className="text-gray-400 text-sm font-['IBM_Plex_Mono']">
                        {selectedTopicIds.size} deck{selectedTopicIds.size !== 1 ? 's' : ''} selected
                      </span>
                      <button
                        onClick={() => {
                          const allFilteredSelected = filteredTopics.length > 0 && filteredTopics.every(t => selectedTopicIds.has(t.id));
                          if (allFilteredSelected) {
                            const next = new Set(selectedTopicIds);
                            filteredTopics.forEach(t => next.delete(t.id));
                            setSelectedTopicIds(next);
                          } else {
                            const next = new Set(selectedTopicIds);
                            filteredTopics.forEach(t => next.add(t.id));
                            setSelectedTopicIds(next);
                          }
                        }}
                        className="text-[var(--accent-primary)] text-sm font-['Rajdhani'] uppercase tracking-widest hover:underline"
                      >
                        {(filteredTopics.length > 0 && filteredTopics.every(t => selectedTopicIds.has(t.id))) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto show-scrollbar border border-[#333] rounded-lg p-2 space-y-1">
                      {filteredTopics.map(topic => {
                        const shortCode = SUBJECT_MAP[topic.subject] ?? topic.subject;
                        return (
                          <label key={topic.id} className="flex items-center gap-3 p-3 hover:bg-[#222] rounded-lg cursor-pointer transition-colors group">
                            <input
                              type="checkbox"
                              checked={selectedTopicIds.has(topic.id)}
                              onChange={(e) => {
                                const next = new Set(selectedTopicIds);
                                if (e.target.checked) next.add(topic.id);
                                else next.delete(topic.id);
                                setSelectedTopicIds(next);
                              }}
                              className="w-4 h-4 rounded border-gray-600 bg-black text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] focus:ring-offset-black"
                            />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-white font-['IBM_Plex_Mono'] text-sm truncate">{topic.name}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-['Rajdhani'] font-bold uppercase tracking-widest border ${getSubjectBadgeClasses(shortCode)}`}>
                                {shortCode}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-8 shrink-0">
                  <button
                    onClick={() => {
                      setShowExportModal(false);
                      setExportSubjectFilter('ALL');
                      setExportTypeFilter('ALL');
                    }}
                    className="flex-1 py-3 bg-surface border border-[#333] hover:border-[#555] text-text-muted hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmExport}
                    disabled={exportMode === 'select' && selectedTopicIds.size === 0}
                    className="flex-1 py-3 bg-[rgba(0,255,65,0.1)] border border-accent text-accent hover:bg-[rgba(0,255,65,0.2)] hover:shadow-[0_0_15px_rgba(0,255,65,0.4)] disabled:opacity-50 disabled:cursor-not-allowed rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
                  >
                    Export
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportSubjectFilter('ALL');
                  setExportTypeFilter('ALL');
                }}
                className="absolute top-4 right-4 text-[#444] hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear All Decks Modal */}
      <AnimatePresence>
        {showClearModal && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#FF003C] to-transparent" />
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#FF003C]/10 border border-[#FF003C]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,0,60,0.1)]">
                  <AlertTriangle className="w-8 h-8 text-[#FF003C]" />
                </div>
                <h3 className="text-2xl font-['Orbitron'] font-bold text-white mb-4 tracking-widest uppercase">
                  Clear All Decks
                </h3>
                <p className="text-text-muted font-['IBM_Plex_Mono'] mb-8 leading-relaxed">
                  This will permanently delete <strong className="text-white">ALL decks, cards, and progress</strong> from the database. This cannot be undone.
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={handleClearAllDecks}
                    disabled={deleteCountdown > 0}
                    className="w-full py-4 bg-[#FF003C] hover:bg-[#D00030] disabled:bg-surface disabled:text-[#444] disabled:cursor-not-allowed text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,0,60,0.2)] hover:shadow-[0_0_25px_rgba(255,0,60,0.4)]"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setShowClearModal(false)}
                    className="w-full py-4 bg-surface border border-[#333] hover:border-[#555] text-text-muted hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowClearModal(false)}
                className="absolute top-4 right-4 text-[#444] hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
