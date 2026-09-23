import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Settings as SettingsIcon, Monitor, Bell, Database, Shield, CheckCircle, AlertTriangle, X, RefreshCw, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { dbService } from '../services/db.service'
import { gauntletService } from '../services/gauntlet.service'
import { useGauntletStore } from '../store/useGauntletStore'
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
  const [resetEloModalOpen, setResetEloModalOpen] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [advancedSyncEnabled, setAdvancedSyncEnabled] = useState(false);
  const [customWrongSound, setCustomWrongSound] = useState(() => getCustomWrongSoundEnabled())
  const [katexScale, setKatexScale] = useState<number>(
    () => parseFloat(localStorage.getItem('ecengine:katex-scale') || '1.1')
  )
  const [katexBold, setKatexBold] = useState<boolean>(
    () => localStorage.getItem('ecengine:katex-bold') === 'true'
  )

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('ecengine:sidebar-collapsed') === 'true'
  )

  const [reduceBgEffects, setReduceBgEffects] = useState(
    () => localStorage.getItem('ecengine:reduce-bg-effects') === 'true'
  )

  const [showExportModal, setShowExportModal] = useState(false);
  const [allTopics, setAllTopics] = useState<{ id: string; name: string; subject: string; types?: string }[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [exportMode, setExportMode] = useState<'all' | 'select'>('all');
  const [exportSubjectFilter, setExportSubjectFilter] = useState<string>('ALL');
  const [exportTypeFilter, setExportTypeFilter] = useState<'ALL' | 'FC' | 'MCQ'>('ALL');

  // TTS voice selection
  const isLinux = window.electron?.platform === 'linux'
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedSystemVoice, setSelectedSystemVoice] = useState<string>(
    () => localStorage.getItem('ecengine:tts:voice') ?? ''
  )
  const voicesLoadedRef = useRef(false)
  const [voicesTimedOut, setVoicesTimedOut] = useState(false)

  // Linux Piper TTS state
  const [piperStatus, setPiperStatus] = useState<{ piperInstalled: boolean; modelConfigured: boolean; defaultModelPath?: string; availableModels?: string[] } | null>(null)
  const [piperModelPath, setPiperModelPath] = useState<string>(
    () => localStorage.getItem('ecengine:tts:piperModelPath') ?? ''
  )
  const [piperModelError, setPiperModelError] = useState<string | null>(null)

  // API Key State — stored main-process-only; renderer only learns if it is configured
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [imagesPath, setImagesPath] = useState('');
  const [dbPath, setDbPath] = useState('');
  // Track last persisted values so onBlur doesn't fire a toast when simply tabbing between fields
  const savedImagesPathRef = useRef('');
  const savedDbPathRef = useRef('');

  // Groq API Usage Limits state
  const [usageLimits, setUsageLimits] = useState<{
    limitRequests: number
    remainingRequests: number
    resetRequests: string
    limitTokens: number
    remainingTokens: number
    resetTokens: string
    lastUpdated: number
  } | null>(null)
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)

  const loadUsageLimits = useCallback(async (isRefresh = false) => {
    if (isRefresh) setLoadingUsage(true)
    try {
      const res = isRefresh
        ? await window.electron.refreshUsageLimits()
        : await window.electron.getUsageLimits()
      if (res?.success && res.usage) {
        setUsageLimits(res.usage)
        setUsageError(null)
      } else if (res?.error) {
        setUsageError(res.error)
      }
    } catch (err: any) {
      setUsageError(err?.message || 'Failed to load usage')
    } finally {
      setLoadingUsage(false)
    }
  }, [])
 
  useEffect(() => {
    const check = async () => {
      const result = await window.electron.config.getApiKeyStatus();
      setApiKeyConfigured(result?.configured ?? false);

      const pathRes = await window.electron.config.getImagesPath();
      if (pathRes?.imagesPath) {
        setImagesPath(pathRes.imagesPath);
        savedImagesPathRef.current = pathRes.imagesPath;
      }

      const dbPathRes = await window.electron.config.getDBPath();
      if (dbPathRes?.dbPath) {
        setDbPath(dbPathRes.dbPath);
        savedDbPathRef.current = dbPathRes.dbPath;
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (apiKeyConfigured) {
      loadUsageLimits()
    } else {
      setUsageLimits(null)
    }
  }, [apiKeyConfigured, loadUsageLimits])

  // Autosave katexScale (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      window.electron.config.updateSettings({ katexScale }).catch(console.error)
    }, 500)
    return () => clearTimeout(timer)
  }, [katexScale])

  // Autosave katexBold
  useEffect(() => {
    window.electron.config.updateSettings({ katexBold }).catch(console.error)
  }, [katexBold])

  // Autosave sidebarCollapsed
  useEffect(() => {
    window.electron.config.updateSettings({ sidebarCollapsed }).catch(console.error)
  }, [sidebarCollapsed])

  // Load available TTS voices — getVoices() is async in Chromium, fires voiceschanged event
  // On Linux, skip Web Speech API entirely — we use Piper TTS instead.
  useEffect(() => {
    if (isLinux) {
      const saved = localStorage.getItem('ecengine:tts:piperModelPath') ?? ''
      window.electron.tts.isAvailable(saved || undefined).then((status) => {
        setPiperStatus(status)
        if (!saved && status.defaultModelPath) {
          localStorage.setItem('ecengine:tts:piperModelPath', status.defaultModelPath)
          setPiperModelPath(status.defaultModelPath)
        } else if (saved) {
          setPiperModelPath(saved)
        }
      })
      return
    }
    const load = () => {
      if (voicesLoadedRef.current) return
      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) return
      voicesLoadedRef.current = true
      // Sort local (non-network) voices first — the only cross-platform quality signal available.
      const englishVoices = voices.filter(v => v.lang.startsWith('en')).sort((a, b) => {
        if (a.localService && !b.localService) return -1
        if (b.localService && !a.localService) return 1
        return a.name.localeCompare(b.name)
      })
      setAvailableVoices(englishVoices)
  
      // Auto-select first available voice if user has no saved preference
      const saved = localStorage.getItem('ecengine:tts:voice')
      if (!saved && englishVoices.length > 0) {
        localStorage.setItem('ecengine:tts:voice', englishVoices[0].name)
        setSelectedSystemVoice(englishVoices[0].name)
      }
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)

    const timeoutId = setTimeout(() => {
      if (!voicesLoadedRef.current) setVoicesTimedOut(true)
    }, 4000)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
      clearTimeout(timeoutId)
    }
  }, [isLinux])

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
      const isConfigured = apiKeyInput.trim().length > 0
      setApiKeyConfigured(isConfigured);
      setApiKeyInput('');
      setToastMessage('API Key saved successfully!');
      if (isConfigured) {
        loadUsageLimits(true);
      }
    } else {
      setToastMessage('Failed to save API Key.');
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSelectImagesPath = async () => {
    const res = await window.electron.config.selectImagesPath();
    if (res && res.success && res.imagesPath) {
      setImagesPath(res.imagesPath);
      setToastMessage('Images path updated successfully!');
    } else if (res && !res.canceled) {
      setToastMessage(res.error || 'Failed to update path.');
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

  const handleResetElo = async () => {
    try {
      await gauntletService.resetRatings();
      await useGauntletStore.getState().loadHub().catch(() => {});
      setResetEloModalOpen(false);
      setToastMessage('Gauntlet ELO ratings reset successfully!');
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

  const [isExportingData, setIsExportingData] = useState(false);

  const handleExportDatabaseAndImages = async () => {
    if (isExportingData) return;
    setIsExportingData(true);
    try {
      const res = await window.electron.data.exportDatabaseAndImages();
      if (res.success) {
        setToastMessage('Database & images exported successfully!');
      } else if (!res.canceled) {
        setToastMessage(`Export failed: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error(err);
      setToastMessage(`Export failed: ${err?.message || String(err)}`);
    } finally {
      setIsExportingData(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const filteredTopics = useMemo(() => {
    const filteredBySubject = exportSubjectFilter === 'ALL'
      ? allTopics
      : allTopics.filter(t => (SUBJECT_MAP[t.subject] ?? t.subject) === exportSubjectFilter);

    return filteredBySubject.filter(t => topicHasType(t, exportTypeFilter));
  }, [allTopics, exportSubjectFilter, exportTypeFilter]);

  const sections = [
    {
      title: 'Appearance',
      icon: <Monitor size={20} className="text-accent" />,
      options: [
        {
          label: 'Minimize Sidebar on Start',
          type: 'custom-toggle',
          actionId: 'sidebar-collapse-toggle'
        },
        {
          label: 'Equation Font Size',
          description: 'Adjust the global font size for LaTeX equations.',
          type: 'custom-slider',
          actionId: 'katex-scale'
        },
        {
          label: 'Bold Equations',
          description: 'Render all LaTeX equations with a bold font weight.',
          type: 'custom-toggle',
          actionId: 'katex-bold-toggle'
        },
        {
          label: 'Reduce Background Effects',
          description: 'Turn off the animated background grid and particles for better performance on lower-end hardware.',
          type: 'custom-toggle',
          actionId: 'reduce-background-effects-toggle'
        }
      ]
    },
    {
      title: 'Advanced Settings',
      icon: <Database size={20} className="text-accent" />,
      options: [
        { label: 'Auto-Backup Progress Locally', type: 'toggle', current: true, advanced: true },
        { label: 'Images Storage Path', type: 'custom-path-picker', advanced: true },
        { label: 'Database File Location', type: 'custom-db-path-picker', advanced: true },
        {
          label: 'Export Database & Images',
          description: 'Export ecengine.sqlite and zipped ece-images.zip to a folder.',
          type: 'action',
          buttonText: isExportingData ? 'EXPORTING...' : 'EXPORT DATA',
          actionId: 'export-db-images',
          advanced: true,
          disabled: isExportingData,
        },
        { label: 'Import Decks', type: 'action', buttonText: 'IMPORT JSON', actionId: 'import', advanced: true },
        { label: 'Export Decks', type: 'action', buttonText: 'EXPORT JSON', actionId: 'export', advanced: true },
        { label: 'Reset Mastery Progress', type: 'action', buttonText: 'Reset Progress', actionId: 'reset-progress', advanced: true },
        {
          label: 'Reset Gauntlet ELO',
          description: 'Reset all subject Elo ratings and rank tiers back to 1000 (provisional).',
          type: 'action',
          buttonText: 'RESET ELO',
          danger: true,
          actionId: 'reset-elo',
          advanced: true,
        },
        { label: 'Clear All Decks', type: 'action', buttonText: 'CLEAR ALL DECKS', danger: true, actionId: 'clear-all', advanced: true },
      ]
    }
  ]

  return (
    <div className="h-full bg-transparent px-8 pb-8 pt-6 lg:px-12 lg:pb-12 lg:pt-6 overflow-y-auto show-scrollbar w-full relative">
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
            <h2 className="font-['Orbitron'] font-bold text-lg text-text-primary mb-6 uppercase tracking-wider flex items-center border-b border-surface-2 pb-4">
              <Shield size={20} className="text-accent" />
              <span className="ml-3">AI Integration</span>
            </h2>
            <div className="bg-[#111111] p-6 lg:p-8 rounded-lg border border-surface-2 shadow-lg space-y-4">
              <div className="flex flex-col gap-2">
                <label className="font-['JetBrains_Mono'] text-text-primary text-sm font-medium">Groq API Key</label>

                {/* Status badge */}
                <div className="flex items-center gap-2 bg-surface-2 border border-border-base rounded px-4 py-3">
                  {apiKeyConfigured ? (
                    <>
                      <CheckCircle size={16} className="text-accent shrink-0" />
                      <span className="font-['JetBrains_Mono'] text-accent text-xs">API key configured ✓</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} className="text-[var(--color-wrong)] shrink-0" />
                      <span className="font-['JetBrains_Mono'] text-[var(--color-wrong)] text-xs">No API key set</span>
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
                    className="flex-1 bg-surface-2 border border-border-base focus:border-accent rounded px-4 py-2 text-text-primary outline-none font-['JetBrains_Mono'] text-xs transition-colors"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={apiKeyInput.trim().length === 0}
                    className="px-6 py-2 border border-accent text-accent rounded hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)] font-['Rajdhani'] uppercase tracking-wider text-xs md:text-sm font-bold transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save Key
                  </button>
                </div>

                <p className="text-[#888] text-xs font-['Rajdhani'] tracking-wide mt-2">
                  Required for AI explanations. Get a free key at <button type="button" onClick={() => window.electron.shell.openExternal('https://console.groq.com/keys')} className="text-accent hover:underline transition-all bg-transparent border-none p-0 inline font-inherit cursor-pointer">console.groq.com/keys</button>.
                </p>
              </div>

              {/* Usage Limits Card (Antigravity-inspired) */}
              {apiKeyConfigured && (
                <div className="border-t border-surface-2 pt-6 mt-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-['Orbitron'] text-sm tracking-wider text-text-primary uppercase font-bold">
                        Usage limits
                      </h3>
                      <span className="bg-[rgba(0,255,65,0.08)] text-accent border border-accent/30 px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] font-bold tracking-wider uppercase">
                        GROQ API
                      </span>
                    </div>
                    <button
                      onClick={() => loadUsageLimits(true)}
                      disabled={loadingUsage}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-['Rajdhani'] uppercase tracking-wider text-text-muted hover:text-accent border border-surface-2 hover:border-accent/40 rounded transition-all disabled:opacity-40"
                      title="Refresh usage limits"
                    >
                      <RefreshCw size={12} className={loadingUsage ? 'animate-spin text-accent' : ''} />
                      <span>{loadingUsage ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </div>

                  <p className="text-[#888] text-xs font-['Rajdhani'] tracking-wide">
                    Your plan's rate limits determine how much you can use Groq over time.
                  </p>

                  {usageLimits ? (
                    <div className="space-y-3 pt-1">
                      {/* Daily / Window Requests */}
                      {(() => {
                        const usedRequests = Math.max(0, usageLimits.limitRequests - usageLimits.remainingRequests)
                        const pctRequests = usageLimits.limitRequests > 0
                          ? Math.min(100, Math.round((usedRequests / usageLimits.limitRequests) * 100))
                          : 0

                        const parseDurationMs = (str: string) => {
                          if (!str) return 0
                          let ms = 0
                          const h = str.match(/(\d+)\s*h/)
                          const m = str.match(/(\d+)\s*m(?!s)/)
                          const s = str.match(/(\d+(?:\.\d+)?)\s*s/)
                          const subMs = str.match(/(\d+)\s*ms/)
                          if (h) ms += parseInt(h[1], 10) * 3600 * 1000
                          if (m) ms += parseInt(m[1], 10) * 60 * 1000
                          if (s && !subMs) ms += parseFloat(s[1]) * 1000
                          if (subMs) ms += parseInt(subMs[1], 10)
                          return ms
                        }

                        const formatReset = (resetStr: string) => {
                          if (!resetStr) return 'Active'
                          const dMs = parseDurationMs(resetStr)
                          if (dMs <= 0) return 'Active'
                          if (dMs < 2000) return 'Resets continuously'
                          const target = new Date(usageLimits.lastUpdated + dMs)
                          const timeStr = target.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                          return `Resets at ${timeStr} (in ${resetStr})`
                        }

                        return (
                          <div className="bg-[#161616] border border-surface-2 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-['JetBrains_Mono'] text-sm text-text-primary font-medium">
                                  Current request usage
                                </span>
                                <div className="relative group cursor-pointer">
                                  <Info size={13} className="text-[#666] hover:text-[#aaa] transition-colors" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none w-max max-w-xs bg-[#222] text-[#ccc] border border-[#444] rounded px-2.5 py-1.5 text-[11px] font-['JetBrains_Mono'] shadow-xl leading-relaxed">
                                    Requests used in the current rolling rate-limit window.
                                    <div className="w-2 h-2 bg-[#222] border-r border-b border-[#444] rotate-45 absolute top-full left-1/2 -translate-x-1/2 -mt-1" />
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="font-['JetBrains_Mono'] text-sm font-bold text-text-primary">
                                  {pctRequests}% used
                                </span>
                                <span className="font-['JetBrains_Mono'] text-xs text-[#777]">
                                  ({usedRequests.toLocaleString()} / {usageLimits.limitRequests.toLocaleString()})
                                </span>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-1.5 bg-[#252525] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  pctRequests > 85
                                    ? 'bg-[var(--color-wrong)] shadow-[0_0_8px_rgba(255,51,51,0.6)]'
                                    : 'bg-accent shadow-[0_0_8px_rgba(0,255,65,0.4)]'
                                }`}
                                style={{ width: `${Math.max(1, pctRequests)}%` }}
                              />
                            </div>

                            {/* Reset Subtext */}
                            <span className="text-[#777] text-xs font-['JetBrains_Mono']">
                              {formatReset(usageLimits.resetRequests)}
                            </span>
                          </div>
                        )
                      })()}

                      {/* Tokens Per Minute Card */}
                      {(() => {
                        const usedTokens = Math.max(0, usageLimits.limitTokens - usageLimits.remainingTokens)
                        const pctTokens = usageLimits.limitTokens > 0
                          ? Math.min(100, Math.round((usedTokens / usageLimits.limitTokens) * 100))
                          : 0

                        return (
                          <div className="bg-[#161616] border border-surface-2 rounded-xl p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-['JetBrains_Mono'] text-sm text-text-primary font-medium">
                                  Token bandwidth (TPM)
                                </span>
                                <div className="relative group cursor-pointer">
                                  <Info size={13} className="text-[#666] hover:text-[#aaa] transition-colors" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none w-max max-w-xs bg-[#222] text-[#ccc] border border-[#444] rounded px-2.5 py-1.5 text-[11px] font-['JetBrains_Mono'] shadow-xl leading-relaxed">
                                    Tokens per minute available across requests.
                                    <div className="w-2 h-2 bg-[#222] border-r border-b border-[#444] rotate-45 absolute top-full left-1/2 -translate-x-1/2 -mt-1" />
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="font-['JetBrains_Mono'] text-sm font-bold text-text-primary">
                                  {pctTokens}% used
                                </span>
                                <span className="font-['JetBrains_Mono'] text-xs text-[#777]">
                                  ({usedTokens.toLocaleString()} / {usageLimits.limitTokens.toLocaleString()})
                                </span>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-1.5 bg-[#252525] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  pctTokens > 85
                                    ? 'bg-[var(--color-wrong)] shadow-[0_0_8px_rgba(255,51,51,0.6)]'
                                    : 'bg-accent shadow-[0_0_8px_rgba(0,255,65,0.4)]'
                                }`}
                                style={{ width: `${Math.max(1, pctTokens)}%` }}
                              />
                            </div>

                            {/* Reset Subtext */}
                            <span className="text-[#777] text-xs font-['JetBrains_Mono']">
                              Resets continuously ({usageLimits.resetTokens || '600ms'})
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                  ) : loadingUsage ? (
                    <div className="bg-[#161616] border border-surface-2 rounded-xl p-5 text-center">
                      <span className="font-['JetBrains_Mono'] text-xs text-[#777] flex items-center justify-center gap-2">
                        <RefreshCw size={13} className="animate-spin text-accent" />
                        Loading Groq rate limits...
                      </span>
                    </div>
                  ) : (
                    <div className="bg-[#161616] border border-surface-2 rounded-xl p-4 text-center">
                      <span className="font-['JetBrains_Mono'] text-xs text-[#666]">
                        {usageError ? `Error: ${usageError}` : 'Click Refresh to check live Groq rate limits.'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Sound & Feedback Section */}
          <section>
            <h2 className="font-['Orbitron'] font-bold text-lg text-text-primary mb-6 uppercase tracking-wider flex items-center border-b border-surface-2 pb-4">
              <Bell size={20} className="text-accent" />
              <span className="ml-3">Sound & Feedback</span>
            </h2>
            <div className="bg-[#111111] p-6 lg:p-8 rounded-lg border border-surface-2 shadow-lg space-y-6">
              {isLinux ? (
                /* ── Linux: Piper TTS configuration ─────────────────────────── */
                <div className="flex flex-col gap-4">
                  <div className="flex flex-row items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-['JetBrains_Mono'] text-text-primary text-sm font-medium">
                        Reading Voice (Piper TTS)
                      </span>
                      <span className="font-['Rajdhani'] text-[#888] text-xs tracking-wide text-left">
                        {piperStatus === null
                          ? 'Checking Piper...'
                          : piperStatus.piperInstalled && piperStatus.modelConfigured
                            ? 'Piper voice ready'
                            : piperStatus.piperInstalled
                              ? 'Piper installed — select a voice model below'
                              : 'Piper not installed'}
                      </span>
                    </div>
                    {piperStatus?.piperInstalled && piperStatus?.modelConfigured && (
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-accent shrink-0" />
                        <span className="font-['JetBrains_Mono'] text-accent text-xs">Ready</span>
                      </div>
                    )}
                    {piperStatus !== null && !piperStatus.piperInstalled && (
                      <button
                        onClick={() => {
                          const modelPath = localStorage.getItem('ecengine:tts:piperModelPath') ?? undefined
                          window.electron.tts.isAvailable(modelPath).then(setPiperStatus)
                        }}
                        className="px-4 py-2 border border-accent text-accent hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)] rounded font-['Rajdhani'] uppercase tracking-wider text-xs md:text-sm font-bold transition-all shrink-0"
                      >
                        Check Again
                      </button>
                    )}
                  </div>

                  {/* Install instructions — only shown when piper is not found */}
                  {piperStatus !== null && !piperStatus.piperInstalled && (
                    <div className="bg-surface-2 border border-border-base rounded-lg p-4 flex flex-col gap-2">
                      <span className="font-['Rajdhani'] text-[#888] text-xs tracking-wide">Install Piper</span>
                      <code className="font-['JetBrains_Mono'] text-accent text-xs bg-[#0D0D0D] border border-surface-2 rounded px-3 py-2 block">
                        yay -S piper-tts-bin
                      </code>
                      <span className="font-['Rajdhani'] text-[#888] text-xs tracking-wide mt-1">
                        On other distros, build or install Piper per{' '}
                        <button
                          type="button"
                          onClick={() => window.electron.shell.openExternal('https://github.com/rhasspy/piper')}
                          className="text-accent hover:underline transition-all bg-transparent border-none p-0 inline font-inherit cursor-pointer"
                        >
                          github.com/rhasspy/piper
                        </button>
                        {' '}— no auto-download is provided.
                      </span>
                    </div>
                  )}

                  {/* Model path picker — shown when piper is installed */}
                  {piperStatus?.piperInstalled && (
                    <div className="flex flex-col gap-4">
                      {piperStatus.availableModels && piperStatus.availableModels.length > 0 && (
                        <div className="flex flex-row items-center justify-between gap-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-['JetBrains_Mono'] text-text-primary text-sm font-medium">
                              Select Installed Voice
                            </span>
                            <span className="font-['Rajdhani'] text-[#888] text-xs tracking-wide text-left">
                              {piperStatus.availableModels.length} Piper model(s) detected in your system
                            </span>
                          </div>
                          <select
                            value={piperModelPath}
                            onChange={async (e) => {
                              const selected = e.target.value
                              setPiperModelPath(selected)
                              if (selected) {
                                const status = await window.electron.tts.isAvailable(selected)
                                localStorage.setItem('ecengine:tts:piperModelPath', selected)
                                setPiperStatus(status)
                                setPiperModelError(null)
                              }
                            }}
                            className="bg-surface-2 border border-border-base focus:border-accent rounded px-4 py-2 text-xs md:text-sm text-text-primary outline-none font-['Rajdhani'] uppercase tracking-wider max-w-[280px]"
                          >
                            {piperStatus.availableModels.map((m) => {
                              const filename = m.split('/').pop() || m
                              const isRyan = filename.toLowerCase().includes('ryan')
                              return (
                                <option key={m} value={m}>
                                  {filename} {isRyan ? '(Default)' : ''}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <span className="font-['Rajdhani'] text-[#888] text-xs tracking-wide">
                          Model File Path (.onnx)
                        </span>
                        <div className="flex items-center gap-4 flex-1 justify-end min-w-0">
                          <input
                            type="text"
                            value={piperModelPath}
                            onChange={(e) => setPiperModelPath(e.target.value)}
                            onBlur={async () => {
                              if (!piperModelPath.trim()) return
                              const modelPath = piperModelPath.trim()
                              const status = await window.electron.tts.isAvailable(modelPath)
                              if (!status.modelConfigured) {
                                setPiperModelError('Model not found — ensure the .onnx and .onnx.json sidecar both exist at this path.')
                              } else {
                                setPiperModelError(null)
                                localStorage.setItem('ecengine:tts:piperModelPath', modelPath)
                                setPiperStatus(status)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            }}
                            placeholder="e.g. ~/.local/share/piper-voices/en_US-ryan-medium.onnx"
                            className="font-['JetBrains_Mono'] text-text-muted text-xs bg-[#0D0D0D] border border-surface-2 focus:border-accent outline-none rounded px-3 py-1.5 w-full max-w-[480px]"
                          />
                          <button
                            onClick={async () => {
                              const res = await window.electron.tts.selectVoiceModel()
                              if (res.success && res.filePath) {
                                const modelPath = res.filePath
                                const status = await window.electron.tts.isAvailable(modelPath)
                                if (!status.modelConfigured) {
                                  setPiperModelPath(modelPath)
                                  setPiperModelError('Model not found — ensure the .onnx.json sidecar exists alongside the selected file.')
                                } else {
                                  setPiperModelPath(modelPath)
                                  setPiperModelError(null)
                                  localStorage.setItem('ecengine:tts:piperModelPath', modelPath)
                                  setPiperStatus(status)
                                }
                              }
                            }}
                            className="px-4 py-2 border border-accent text-accent hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)] rounded font-['Rajdhani'] uppercase tracking-wider text-xs md:text-sm font-bold transition-all shrink-0"
                          >
                            Browse
                          </button>
                        </div>
                        {piperModelError && (
                          <span className="font-['Rajdhani'] text-[var(--color-wrong)] text-xs tracking-wide">
                            {piperModelError}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Non-Linux: Web Speech API voice dropdown ───── */
                <div className="flex flex-row items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-['JetBrains_Mono'] text-text-primary text-sm font-medium">
                      Reading Voice
                    </span>
                    <span className="font-['Rajdhani'] text-[#888] text-xs tracking-wide text-left">
                      {availableVoices.length > 0
                        ? `${availableVoices.length} English voices available`
                        : voicesTimedOut
                          ? 'No system voices detected — TTS unavailable.'
                          : 'Loading voices...'}
                    </span>
                  </div>
                  <select
                    value={selectedSystemVoice}
                    onChange={(e) => {
                      setSelectedSystemVoice(e.target.value)
                      localStorage.setItem('ecengine:tts:voice', e.target.value)
                    }}
                    disabled={availableVoices.length === 0}
                    className="bg-surface-2 border border-border-base focus:border-accent rounded px-4 py-2 text-xs md:text-sm text-text-primary outline-none font-['Rajdhani'] uppercase tracking-wider max-w-[220px] disabled:opacity-40"
                  >
                    <option value="">System Default</option>
                    {availableVoices.map(v => (
                      <option key={v.name} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="border-t border-surface-2 pt-6 flex flex-row items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-['JetBrains_Mono'] text-text-primary text-sm font-medium">
                    Disable Faah Sound Meme
                  </span>
                  <span className="font-['Rajdhani'] text-[#888] text-xs tracking-wide">
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
              <h2 className="font-['Orbitron'] font-bold text-lg text-text-primary mb-6 uppercase tracking-wider flex items-center justify-between border-b border-surface-2 pb-4">
                <div className="flex items-center">
                  {section.icon}
                  <span className="ml-3">{section.title}</span>
                </div>
                {section.title === 'Advanced Settings' && (
                  <div className="flex items-center gap-3">
                    <span className="font-['Orbitron'] text-[10px] text-[#666] tracking-wider uppercase font-bold">Unlock Advanced</span>
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
                  const isDisabled = isAdvanced && section.title === 'Advanced Settings' && !advancedSyncEnabled;

                  return (
                    <div key={idy} className={`flex flex-row items-center justify-between gap-4 transition-all duration-300 ${isDisabled ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                      {opt.type === 'custom-db-path-picker' ? (
                        <div className="font-['JetBrains_Mono'] text-text-primary text-sm font-medium shrink-0 relative group">
                          <span className="cursor-default border-b border-dashed border-[#444]">{opt.label}</span>
                            <div className="absolute bottom-full left-0 mb-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <div className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 shadow-xl w-max max-w-xs">
                                <p className="font-['JetBrains_Mono'] text-[#999] text-[11px] leading-relaxed">SQLite file used to store all decks and progress. Restart required to apply.</p>
                              </div>
                              <div className="w-2 h-2 bg-[#1a1a1a] border-r border-b border-[#333] rotate-45 ml-3 -mt-1" />
                            </div>
                        </div>
                      ) : (
                        <div className="font-['JetBrains_Mono'] text-text-primary text-sm font-medium shrink-0">
                          {opt.label}
                          {(opt as any).description && (
                            <div className="text-[#888] text-xs font-['Rajdhani'] tracking-wide mt-0.5">
                              {(opt as any).description}
                            </div>
                          )}
                        </div>
                      )}

                      {opt.type === 'toggle' && (
                        <button className={`w-14 h-7 rounded-full p-1 transition-colors ${(opt as any).current ? 'bg-[rgba(0,255,65,0.2)] border border-accent' : 'bg-surface-2 border border-border-base'} focus:outline-none relative shadow-inner`}>
                          <span className={`block w-5 h-5 rounded-full shadow-md transform transition-transform ${(opt as any).current ? 'bg-accent translate-x-7 shadow-[0_0_8px_rgba(0,255,65,0.8)]' : 'bg-[#555] translate-x-0'}`} />
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

                      {opt.type === 'custom-toggle' && (opt as any).actionId === 'katex-bold-toggle' && (
                        <button
                          onClick={() => {
                            const next = !katexBold
                            setKatexBold(next)
                            localStorage.setItem('ecengine:katex-bold', String(next))
                            window.dispatchEvent(new Event('ecengine:katex-bold-changed'))
                          }}
                          className={`w-14 h-7 rounded-full p-1 transition-colors ${katexBold ? 'bg-[rgba(0,255,65,0.2)] border border-accent' : 'bg-surface-2 border border-border-base'} focus:outline-none relative shadow-inner`}
                        >
                          <span className={`block w-5 h-5 rounded-full shadow-md transform transition-transform ${katexBold ? 'bg-accent translate-x-7 shadow-[0_0_8px_rgba(0,255,65,0.8)]' : 'bg-[#555] translate-x-0'}`} />
                        </button>
                      )}

                      {opt.type === 'custom-toggle' && (opt as any).actionId === 'reduce-background-effects-toggle' && (
                        <button
                          onClick={() => {
                            const next = !reduceBgEffects
                            setReduceBgEffects(next)
                            localStorage.setItem('ecengine:reduce-bg-effects', String(next))
                            window.dispatchEvent(new Event('ecengine:settings-changed'))
                          }}
                          className={`w-14 h-7 rounded-full p-1 transition-colors ${reduceBgEffects ? 'bg-[rgba(0,255,65,0.2)] border border-accent' : 'bg-surface-2 border border-border-base'} focus:outline-none relative shadow-inner`}
                        >
                          <span className={`block w-5 h-5 rounded-full shadow-md transform transition-transform ${reduceBgEffects ? 'bg-accent translate-x-7 shadow-[0_0_8px_rgba(0,255,65,0.8)]' : 'bg-[#555] translate-x-0'}`} />
                        </button>
                      )}

                      {opt.type === 'custom-slider' && (opt as any).actionId === 'katex-scale' && (
                        <div className="flex items-center gap-4 flex-1 justify-end min-w-0 max-w-[250px]">
                          <input
                            type="range"
                            min="0.8"
                            max="3.0"
                            step="0.1"
                            value={katexScale}
                            onChange={(e) => {
                              const next = parseFloat(e.target.value)
                              setKatexScale(next)
                              localStorage.setItem('ecengine:katex-scale', next.toString())
                              window.dispatchEvent(new Event('ecengine:katex-scale-changed'))
                            }}
                            className="w-full accent-accent"
                          />
                          <span className="font-['JetBrains_Mono'] text-accent text-sm w-12 text-right">
                            {katexScale.toFixed(1)}x
                          </span>
                        </div>
                      )}

                      {opt.type === 'select' && (
                        <select className="bg-surface-2 border border-border-base rounded px-4 py-2 text-sm text-text-primary focus:border-accent outline-none font-['Rajdhani'] uppercase tracking-wider">
                          <option>{(opt as any).current}</option>
                        </select>
                      )}

                      {opt.type === 'custom-path-picker' && (
                        <div className="flex items-center gap-4 flex-1 justify-end min-w-0">
                          <input
                            type="text"
                            value={imagesPath}
                            onChange={(e) => setImagesPath(e.target.value)}
                            onBlur={async () => {
                              if (imagesPath === savedImagesPathRef.current) return;
                              const res = await window.electron.config.setImagesPath(imagesPath);
                              if (res && res.success && res.imagesPath !== undefined) {
                                setImagesPath(res.imagesPath);
                                savedImagesPathRef.current = res.imagesPath;
                                setToastMessage('Images path saved!');
                              } else if (res && res.error) {
                                setToastMessage(`Error saving path: ${res.error}`);
                              }
                              setTimeout(() => setToastMessage(null), 3000);
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            title={imagesPath}
                            className="font-['JetBrains_Mono'] text-[#999] text-xs bg-[#0D0D0D] border border-surface-2 focus:border-accent outline-none rounded px-3 py-1.5 w-full max-w-[480px]"
                          />
                          <button
                            onClick={handleSelectImagesPath}
                            className="px-4 py-2 border border-accent text-accent hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)] rounded font-['Rajdhani'] uppercase tracking-wider text-xs md:text-sm font-bold transition-all shrink-0"
                          >
                            Browse
                          </button>
                        </div>
                      )}

                      {opt.type === 'custom-db-path-picker' && (
                        <div className="flex items-center gap-4 flex-1 justify-end min-w-0">
                          <input
                            type="text"
                            value={dbPath}
                            onChange={(e) => setDbPath(e.target.value)}
                            onBlur={async () => {
                              if (dbPath === savedDbPathRef.current) return;
                              const res = await window.electron.config.setDBPath(dbPath);
                              if (res && res.success) {
                                if (res.dbPath) {
                                  setDbPath(res.dbPath);
                                  savedDbPathRef.current = res.dbPath;
                                }
                                setToastMessage('Database path saved — restart to apply.');
                              } else if (res && res.error) {
                                setToastMessage(`Error saving path: ${res.error}`);
                              }
                              setTimeout(() => setToastMessage(null), 4000);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            title={dbPath}
                            className="font-['JetBrains_Mono'] text-[#999] text-xs bg-[#0D0D0D] border border-surface-2 focus:border-accent outline-none rounded px-3 py-1.5 w-full max-w-[480px]"
                          />
                          <button
                            onClick={async () => {
                              const res = await window.electron.config.selectDBPath();
                              if (res && res.success && res.dbPath) {
                                setDbPath(res.dbPath);
                                setToastMessage('Database path saved — restart to apply.');
                                setTimeout(() => setToastMessage(null), 4000);
                              }
                            }}
                            className="px-4 py-2 border border-accent text-accent hover:bg-[rgba(0,255,65,0.1)] hover:shadow-[0_0_10px_rgba(0,255,65,0.5)] rounded font-['Rajdhani'] uppercase tracking-wider text-xs md:text-sm font-bold transition-all shrink-0"
                          >
                            Browse
                          </button>
                        </div>
                      )}

                      {opt.type === 'action' && (
                        <button
                          disabled={(opt as any).disabled}
                          onClick={() => {
                            if ((opt as any).actionId === 'export-db-images') {
                              handleExportDatabaseAndImages();
                            } else if ((opt as any).actionId === 'reset-progress') {
                              setResetResetMenuOpen(true);
                            } else if ((opt as any).actionId === 'reset-elo') {
                              setResetEloModalOpen(true);
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
                          className={`px-4 py-2 border rounded font-['Rajdhani'] uppercase tracking-wider text-xs md:text-sm font-bold transition-all ${(opt as any).disabled
                            ? 'opacity-50 cursor-not-allowed border-border-base text-text-muted'
                            : (opt as any).danger
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
                <p className="text-text-muted font-['JetBrains_Mono'] mb-8 leading-relaxed">
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

      {/* Reset Gauntlet ELO Modal */}
      <AnimatePresence>
        {resetEloModalOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setResetEloModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#111] border border-[#333] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#FF3333] to-transparent" />
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#FF3333]/10 border border-[#FF3333]/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(255,51,51,0.1)]">
                  <AlertTriangle className="w-8 h-8 text-[#FF3333]" />
                </div>
                <h3 className="text-2xl font-['Orbitron'] font-bold text-white mb-4 tracking-widest uppercase">
                  Reset Gauntlet ELO
                </h3>
                <p className="text-text-muted font-['JetBrains_Mono'] mb-8 leading-relaxed text-sm">
                  Are you sure you want to reset all Gauntlet Elo ratings across all subjects back to 1000 (provisional)? Your past runs and study history will be preserved, but your current subject ratings will be reset.
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={handleResetElo}
                    className="w-full py-4 bg-[#FF3333] hover:bg-[#D92626] text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,51,51,0.2)] hover:shadow-[0_0_25px_rgba(255,51,51,0.4)]"
                  >
                    Confirm Reset
                  </button>
                  <button
                    onClick={() => setResetEloModalOpen(false)}
                    className="w-full py-4 bg-surface border border-[#333] hover:border-[#555] text-text-muted hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <button
                onClick={() => setResetEloModalOpen(false)}
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
                    <p className="text-gray-400 font-['JetBrains_Mono'] text-center px-4">
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
                      <span className="text-gray-400 text-sm font-['JetBrains_Mono']">
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
                              <span className="text-white font-['JetBrains_Mono'] text-sm truncate">{topic.name}</span>
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
                <p className="text-text-muted font-['JetBrains_Mono'] mb-8 leading-relaxed">
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
