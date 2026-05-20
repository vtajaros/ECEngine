import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Monitor, Bell, Database, Shield, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { dbService } from '../services/db.service'

export default function Settings() {
  const [resetResetMenuOpen, setResetResetMenuOpen] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [advancedSyncEnabled, setAdvancedSyncEnabled] = useState(false);

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

  const handleResetProgress = () => {
    // Clear localStorage for mastery_ and progress_
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('mastery_') || key.startsWith('progress_') || key === 'setMastery')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    setResetResetMenuOpen(false);
    setToastMessage('Progress successfully reset!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleClearAllDecks = async () => {
    // Delete from SQL DB (FK-safe order via db.service)
    await dbService.clearAllData();

    // Also clear any localStorage remnants
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('deck-') || key.startsWith('custom-deck-') || key.startsWith('progress_') || key.startsWith('mastery_') || key === 'ecengine_decks')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    setShowClearModal(false);
    setToastMessage('All decks and progress cleared successfully!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportDecks = async () => {
    try {
      const dataStr = await dbService.exportDecks();
      const res = await window.electron.file.export(dataStr);
      if (res.success) {
        setToastMessage('Database exported successfully!');
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

  const sections = [
    {
      title: 'Data & Sync',
      icon: <Database size={20} className="text-[#00FF41]" />,
      options: [
        { label: 'Auto-Backup Progress Locally', type: 'toggle', current: true, advanced: true },
        { label: 'Import Decks', type: 'action', buttonText: 'IMPORT JSON', actionId: 'import', advanced: true },
        { label: 'Export Decks', type: 'action', buttonText: 'EXPORT JSON', actionId: 'export', advanced: true },
        { label: 'Reset Mastery Progress', type: 'action', buttonText: 'Reset Progress', actionId: 'reset-progress', advanced: true },
        { label: 'Clear All Decks', type: 'action', buttonText: 'CLEAR ALL DECKS', danger: true, actionId: 'clear-all', advanced: true },
      ]
    }
  ]

  return (
    <div className="h-full bg-[#0D0D0D] px-8 pb-8 pt-6 lg:px-12 lg:pb-12 lg:pt-6 overflow-y-auto w-full relative">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 flex flex-col items-center text-center gap-2">
          <h1 className="font-['Orbitron'] text-4xl font-bold text-[#E8E8E8] tracking-wider flex items-center justify-center">
            <SettingsIcon className="text-[#00FF41] mr-4" size={36} />
            SETTINGS
          </h1>
          <p className="text-[#888888] font-['Rajdhani'] text-lg uppercase tracking-widest mt-2">
            MANAGE YOUR AI INTEGRATION, APPLICATION BEHAVIOR, AND FLASHCARD DATA
          </p>
        </header>

        <div className="space-y-12">
          {/* AI Integration Section */}
          <section>
            <h2 className="font-['Rajdhani'] font-bold text-xl text-[#E8E8E8] mb-6 uppercase tracking-wider flex items-center border-b border-[#161616] pb-4">
              <Shield size={20} className="text-[#00FF41]" />
              <span className="ml-3">AI Integration</span>
            </h2>
            <div className="bg-[#111111] p-6 lg:p-8 rounded-lg border border-[#161616] shadow-lg space-y-4">
              <div className="flex flex-col gap-2">
                <label className="font-['IBM_Plex_Mono'] text-[var(--text-primary)] text-sm">Groq API Key</label>

                {/* Status badge */}
                <div className="flex items-center gap-2 bg-[#161616] border border-[#222] rounded px-4 py-3">
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
                    className="flex-1 bg-[#161616] border border-[#222] focus:border-[var(--accent-primary)] rounded px-4 py-2 text-[var(--text-primary)] outline-none font-['IBM_Plex_Mono'] transition-colors"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={apiKeyInput.trim().length === 0}
                    className="px-6 py-2 border border-[var(--accent-primary)] text-[var(--accent-primary)] rounded hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)] font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save Key
                  </button>
                </div>

                <p className="text-[#555] text-xs font-['Rajdhani'] uppercase tracking-widest mt-2">
                  Required for AI explanations. Get a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline transition-all">console.groq.com/keys</a>.
                </p>
              </div>
            </div>
          </section>

          {sections.map((section, idx) => (
            <section key={idx}>
              <h2 className="font-['Rajdhani'] font-bold text-xl text-[#E8E8E8] mb-6 uppercase tracking-wider flex items-center justify-between border-b border-[#161616] pb-4">
                <div className="flex items-center">
                  {section.icon}
                  <span className="ml-3">{section.title}</span>
                </div>
                {section.title === 'Data & Sync' && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#666] tracking-widest uppercase font-bold">Unlock Advanced</span>
                    <button 
                      onClick={() => setAdvancedSyncEnabled(!advancedSyncEnabled)}
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors ${advancedSyncEnabled ? 'bg-[rgba(255,51,51,0.2)] border border-[#FF3333]' : 'bg-[#161616] border border-[#222]'} focus:outline-none relative shadow-inner flex items-center`}
                    >
                      <span className={`block w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${advancedSyncEnabled ? 'bg-[#FF3333] translate-x-5 shadow-[0_0_8px_rgba(255,51,51,0.8)]' : 'bg-[#555] translate-x-0'}`} />
                    </button>
                  </div>
                )}
              </h2>

              <div className="bg-[#111111] p-6 lg:p-8 rounded-lg border border-[#161616] shadow-lg space-y-8">
                {section.options.map((opt, idy) => {
                  const isAdvanced = (opt as any).advanced;
                  const isDisabled = isAdvanced && section.title === 'Data & Sync' && !advancedSyncEnabled;

                  return (
                    <div key={idy} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${isDisabled ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    <div className="font-['IBM_Plex_Mono'] text-[#E8E8E8] text-sm md:text-base">
                      {opt.label}
                    </div>

                    {opt.type === 'toggle' && (
                      <button className={`w-14 h-7 rounded-full p-1 transition-colors ${opt.current ? 'bg-[rgba(0,255,65,0.2)] border border-[#00FF41]' : 'bg-[#161616] border border-[#222]'} focus:outline-none relative shadow-inner`}>
                        <span className={`block w-5 h-5 rounded-full shadow-md transform transition-transform ${opt.current ? 'bg-[#00FF41] translate-x-7 shadow-[0_0_8px_rgba(0,255,65,0.8)]' : 'bg-[#555] translate-x-0'}`} />
                      </button>
                    )}

                    {opt.type === 'select' && (
                      <select className="bg-[#161616] border border-[#222] rounded px-4 py-2 text-sm text-[#E8E8E8] focus:border-[#00FF41] outline-none font-['Rajdhani'] uppercase tracking-wider">
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
                            handleExportDecks();
                          } else if ((opt as any).actionId === 'import') {
                            handleImportDecks();
                          }
                        }}
                        className={`px-4 py-2 border rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all ${(opt as any).danger
                          ? 'border-[#FF3333] text-[#FF3333] hover:bg-[rgba(255,51,51,0.1)] hover:shadow-[0_0_10px_rgba(255,51,51,0.5)]'
                          : 'border-[#00FF41] text-[#00FF41] hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)]'
                          }`}>
                        {(opt as any).buttonText}
                      </button>
                    )}
                  </div>
                )})}
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
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#161616] border border-[#00FF41] shadow-[0_0_15px_rgba(0,255,65,0.2)] px-6 py-3 rounded-full flex items-center gap-3 z-[100]"
          >
            <CheckCircle className="w-5 h-5 text-[#00FF41]" />
            <span className="text-[#E8E8E8] font-['Rajdhani'] font-bold tracking-widest uppercase text-sm">
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
                <p className="text-[#888] font-['IBM_Plex_Mono'] mb-8 leading-relaxed">
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
                    className="w-full py-4 bg-[#1A1A1A] border border-[#333] hover:border-[#555] text-[#888] hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
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
                <p className="text-[#888] font-['IBM_Plex_Mono'] mb-8 leading-relaxed">
                  This will permanently delete <strong className="text-white">ALL decks, cards, and progress</strong> from the database. This cannot be undone.
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={handleClearAllDecks}
                    disabled={deleteCountdown > 0}
                    className="w-full py-4 bg-[#FF003C] hover:bg-[#D00030] disabled:bg-[#1A1A1A] disabled:text-[#444] disabled:cursor-not-allowed text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,0,60,0.2)] hover:shadow-[0_0_25px_rgba(255,0,60,0.4)]"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setShowClearModal(false)}
                    className="w-full py-4 bg-[#1A1A1A] border border-[#333] hover:border-[#555] text-[#888] hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
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
