import React, { useState } from 'react'
import { Settings as SettingsIcon, Monitor, Bell, Database, Shield, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Settings() {
  const [resetResetMenuOpen, setResetResetMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // API Key State — Groq (OpenAI-compatible, ultra-fast inference)
  const envKey = import.meta.env.VITE_GROQ_API_KEY;
  const [localApiKey, setLocalApiKey] = useState(localStorage.getItem('ecengine_groq_key') || '');

  const handleSaveApiKey = () => {
    localStorage.setItem('ecengine_groq_key', localApiKey);
    setToastMessage('Groq API Key saved successfully!');
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

  const sections = [
    {
      title: 'Appearance',
      icon: <Monitor size={20} className="text-[#00FF41]" />,
      options: [
        { label: 'Dark Theme (Neon)', type: 'select', current: 'Default' },
        { label: 'UI Scaling', type: 'select', current: '100%' },
        { label: 'Reduced Motion', type: 'toggle', current: false },
      ]
    },
    {
      title: 'Notifications & Alerts',
      icon: <Bell size={20} className="text-[#00FF41]" />,
      options: [
        { label: 'Daily Study Reminders', type: 'toggle', current: true },
        { label: 'Exam Countdown Timer Warning', type: 'toggle', current: true },
      ]
    },
    {
      title: 'Data & Sync',
      icon: <Database size={20} className="text-[#00FF41]" />,
      options: [
        { label: 'Auto-Backup Progress Locally', type: 'toggle', current: true },
        { label: 'Export Progress to File', type: 'action', buttonText: 'Export JSON', actionId: 'export' },
        { label: 'Reset Mastery Progress', type: 'action', buttonText: 'Reset Progress', actionId: 'reset-progress' },
        { label: 'Clear All Data (Danger Zone)', type: 'action', buttonText: 'Reset DB', danger: true, actionId: 'clear-all' },
      ]
    }
  ]

  return (
    <div className="h-full bg-[#0D0D0D] px-8 pb-8 pt-6 lg:px-12 lg:pb-12 lg:pt-6 overflow-y-auto w-full relative">
      <header className="mb-12 flex flex-col gap-2">
        <h1 className="font-['Orbitron'] text-4xl font-bold text-[#E8E8E8] tracking-wider flex items-center">
          <SettingsIcon className="text-[#00FF41] mr-4" size={36} />
          PREFERENCES
        </h1>
        <p className="text-[#888888] font-['Rajdhani'] text-lg uppercase tracking-widest mt-2">
          Configure application behavior and engine data
        </p>
      </header>

      <div className="max-w-4xl space-y-12">
        {/* AI Integration Section */}
        <section>
          <h2 className="font-['Rajdhani'] font-bold text-xl text-[#E8E8E8] mb-6 uppercase tracking-wider flex items-center border-b border-[#161616] pb-4">
            <Shield size={20} className="text-[#00FF41]" />
            <span className="ml-3">AI Integration</span>
          </h2>
          <div className="bg-[#111111] p-6 lg:p-8 rounded-lg border border-[#161616] shadow-lg space-y-4">
            <div className="flex flex-col gap-2">
              <label className="font-['IBM_Plex_Mono'] text-[#E8E8E8] text-sm">Groq API Key</label>
              {envKey ? (
                <div className="flex items-center justify-between bg-[#161616] border border-[#222] rounded px-4 py-3">
                  <span className="text-[#888] font-['IBM_Plex_Mono'] text-sm">Using Developer Key (read-only)</span>
                  <Shield size={16} className="text-[#00FF41]" />
                </div>
              ) : (
                <div className="flex gap-4">
                  <input
                    type="password"
                    placeholder="Enter your Groq API key..."
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    className="flex-1 bg-[#161616] border border-[#222] focus:border-[#00FF41] rounded px-4 py-2 text-[#E8E8E8] outline-none font-['IBM_Plex_Mono'] transition-colors"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className="px-6 py-2 border border-[#00FF41] text-[#00FF41] rounded hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)] font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all whitespace-nowrap"
                  >
                    Save Key
                  </button>
                </div>
              )}
              <p className="text-[#555] text-xs font-['Rajdhani'] uppercase tracking-widest mt-2">
                Required for AI explanations. Get a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-[#00FF41] hover:underline transition-all">console.groq.com/keys</a>.
              </p>
            </div>
          </div>
        </section>

        {sections.map((section, idx) => (
          <section key={idx}>
            <h2 className="font-['Rajdhani'] font-bold text-xl text-[#E8E8E8] mb-6 uppercase tracking-wider flex items-center border-b border-[#161616] pb-4">
              {section.icon}
              <span className="ml-3">{section.title}</span>
            </h2>

            <div className="bg-[#111111] p-6 lg:p-8 rounded-lg border border-[#161616] shadow-lg space-y-8">
              {section.options.map((opt, idy) => (
                <div key={idy} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                        }
                      }}
                      className={`px-4 py-2 border rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all ${
                      (opt as any).danger 
                        ? 'border-[#FF3333] text-[#FF3333] hover:bg-[rgba(255,51,51,0.1)] hover:shadow-[0_0_10px_rgba(255,51,51,0.5)]' 
                        : 'border-[#00FF41] text-[#00FF41] hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)]'
                    }`}>
                      {(opt as any).buttonText}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
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

      {/* Confirmation Modal */}
      <AnimatePresence>
        {resetResetMenuOpen && (
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
              className="bg-[#111] border border-[#00FF41] rounded-lg shadow-[0_0_30px_rgba(0,255,65,0.15)] w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-[#222] bg-[#161616]">
                <h2 className="text-xl font-bold text-[#E8E8E8] font-['Orbitron'] uppercase tracking-wider">
                  Reset Mastery Progress
                </h2>
              </div>
              <div className="p-6">
                <p className="text-[#888] font-['Outfit'] mb-4">
                  Are you sure you want to reset all mastery and progress data across all decks? 
                  This will clear your studied status but keep your decks intact.
                </p>
              </div>
              <div className="p-6 border-t border-[#222] bg-[#161616] flex justify-end gap-3">
                <button 
                  onClick={() => setResetResetMenuOpen(false)}
                  className="px-5 py-2 rounded bg-transparent border border-[#333] text-[#888] hover:text-[#E8E8E8] hover:border-[#555] transition-colors font-['Rajdhani'] uppercase tracking-wider text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleResetProgress}
                  className="px-6 py-2 rounded font-bold transition-all font-['Rajdhani'] uppercase tracking-wider text-sm bg-transparent border border-[#00FF41] text-[#00FF41] hover:bg-[rgba(0,255,65,0.1)] shadow-[0_0_15px_rgba(0,255,65,0.3)]"
                >
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
