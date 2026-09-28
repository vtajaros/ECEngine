import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  X,
  Search,
  Check,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react'
import type { Subject } from '../../types'
import {
  ALL_PARENT_TOS_TOPICS,
  ALL_TOS_SUBTOPICS,
  type FlatTosTopic,
} from '../../lib/tosClassification'
import { SUBJECT_LINE_COLOR } from '../../lib/dashboardUtils'

interface GauntletTopicModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTopicIds: string[]
  onApply: (topicIds: string[]) => void
  activeSubjects?: Subject[]
}

const SUBJECT_TABS: Array<'ALL' | Subject> = ['ALL', 'MATH', 'GEAS', 'ELECS', 'EST']

export const GauntletTopicModal: React.FC<GauntletTopicModalProps> = ({
  isOpen,
  onClose,
  selectedTopicIds,
  onApply,
  activeSubjects,
}) => {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedTopicIds)
  const [activeTab, setActiveTab] = useState<'ALL' | Subject>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showGranular, setShowGranular] = useState(false)

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSelected(selectedTopicIds)
      setSearchQuery('')
      if (activeSubjects && activeSubjects.length === 1) {
        setActiveTab(activeSubjects[0])
      } else {
        setActiveTab('ALL')
      }
    }
  }, [isOpen, selectedTopicIds, activeSubjects])

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Source list depending on granular toggle
  const topicsPool = useMemo(() => {
    return showGranular ? ALL_TOS_SUBTOPICS : ALL_PARENT_TOS_TOPICS
  }, [showGranular])

  // Filtered topics by tab and search
  const displayedTopics = useMemo(() => {
    let list = topicsPool
    if (activeTab !== 'ALL') {
      list = list.filter(t => t.subject === activeTab)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q),
      )
    }
    return list
  }, [topicsPool, activeTab, searchQuery])

  const toggleTopic = (id: string) => {
    setLocalSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  const handleSelectAllVisible = () => {
    const visibleIds = displayedTopics.map(t => t.id)
    setLocalSelected(prev => Array.from(new Set([...prev, ...visibleIds])))
  }

  const handleClearVisible = () => {
    const visibleIds = new Set(displayedTopics.map(t => t.id))
    setLocalSelected(prev => prev.filter(id => !visibleIds.has(id)))
  }

  const handleClearAll = () => {
    setLocalSelected([])
  }

  const handleApply = () => {
    onApply(localSelected)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-3xl max-h-[88vh] bg-[#0f0f0f] border border-[#262626] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-[#222] bg-[#141414] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Layers size={18} />
              </div>
              <div>
                <h2 className="font-['Orbitron'] text-sm sm:text-base font-bold text-text-primary tracking-wide">
                  TOPIC FOCUS SELECTION
                </h2>
                <p className="text-[11px] font-['Rajdhani'] font-semibold text-text-muted uppercase tracking-wider">
                  Check topics to include in your session pool
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Controls Bar: Search + Granular Toggle */}
          <div className="p-3.5 border-b border-[#1e1e1e] bg-[#121212] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search topics by name, code, or subject..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg pl-8 pr-7 py-1.5 text-xs font-['Rajdhani'] font-medium text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Granular Subtopics Toggle */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#181818] border border-[#2a2a2a] self-start sm:self-auto shrink-0">
              <SlidersHorizontal size={13} className="text-text-muted" />
              <label className="text-[11px] font-['Rajdhani'] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2 cursor-pointer">
                <span>Granular Subtopics ({ALL_TOS_SUBTOPICS.length})</span>
                <input
                  type="checkbox"
                  checked={showGranular}
                  onChange={e => setShowGranular(e.target.checked)}
                  className="accent-accent cursor-pointer w-3.5 h-3.5"
                />
              </label>
            </div>
          </div>

          {/* Subject Tabs & Bulk Selection Buttons */}
          <div className="px-3.5 py-2 border-b border-[#1a1a1a] bg-[#111111] flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {SUBJECT_TABS.map(tab => {
                const active = activeTab === tab
                const color = tab === 'ALL' ? '#00FF41' : SUBJECT_LINE_COLOR[tab]
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded-lg font-['Orbitron'] font-bold text-xs tracking-wider transition-all cursor-pointer ${
                      active
                        ? 'bg-surface-2 border text-white shadow-sm'
                        : 'text-text-muted hover:text-white border border-transparent'
                    }`}
                    style={
                      active
                        ? { borderColor: color, color }
                        : undefined
                    }
                  >
                    {tab}
                  </button>
                )
              })}
            </div>

            {/* Action buttons: Select All Visible / Clear Visible / Clear All */}
            <div className="flex items-center gap-2 text-xs font-['Rajdhani'] font-semibold">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="px-2 py-0.5 rounded bg-surface border border-border-base text-text-muted hover:text-white hover:border-text-primary transition-colors cursor-pointer"
              >
                Select {activeTab === 'ALL' ? 'All' : activeTab}
              </button>
              <button
                type="button"
                onClick={handleClearVisible}
                className="px-2 py-0.5 rounded bg-surface border border-border-base text-text-muted hover:text-white hover:border-text-primary transition-colors cursor-pointer"
              >
                Deselect {activeTab === 'ALL' ? 'All' : activeTab}
              </button>
              {localSelected.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-accent hover:underline flex items-center gap-1 text-[11px] font-['JetBrains_Mono'] pl-1 cursor-pointer"
                >
                  <RotateCcw size={10} /> Reset All
                </button>
              )}
            </div>
          </div>

          {/* Topics Checklist Body */}
          <div className="p-3.5 sm:p-4 overflow-y-auto space-y-1.5 flex-1 min-h-[250px] max-h-[52vh]">
            {displayedTopics.length === 0 ? (
              <div className="py-12 text-center text-text-muted font-['Rajdhani'] font-semibold text-sm">
                No topics match your current filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {displayedTopics.map((topic: FlatTosTopic) => {
                  const isChecked = localSelected.includes(topic.id)
                  const subColor = SUBJECT_LINE_COLOR[topic.subject]

                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                        isChecked
                          ? 'bg-[#181818] border-accent/50 shadow-[0_0_12px_rgba(0,255,65,0.08)]'
                          : 'bg-[#121212] border-[#222] hover:border-[#333]'
                      }`}
                    >
                      {/* Checkbox indicator */}
                      <div
                        className={`w-4 h-4 rounded mt-0.5 shrink-0 flex items-center justify-center border transition-all ${
                          isChecked
                            ? 'bg-accent border-accent text-black'
                            : 'border-[#444] bg-[#1a1a1a]'
                        }`}
                      >
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>

                      {/* Topic Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="text-[9px] font-['Orbitron'] font-bold px-1.5 py-0.2 rounded"
                            style={{
                              backgroundColor: `${subColor}22`,
                              color: subColor,
                              border: `1px solid ${subColor}44`,
                            }}
                          >
                            {topic.subject}
                          </span>
                          <span className="text-[10px] font-['JetBrains_Mono'] font-bold text-text-muted">
                            {topic.code}
                          </span>
                        </div>
                        <p
                          className={`text-xs font-['Rajdhani'] font-semibold mt-0.5 leading-snug line-clamp-2 ${
                            isChecked ? 'text-text-primary' : 'text-text-muted'
                          }`}
                        >
                          {topic.title}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer: Summary and Apply */}
          <div className="px-5 py-3 border-t border-[#222] bg-[#141414] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-['JetBrains_Mono'] text-text-muted">
                Selected:
              </span>
              {localSelected.length === 0 ? (
                <span className="text-xs font-['JetBrains_Mono'] text-[#00FF41] font-bold">
                  All Topics (Comprehensive Pool)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent font-['Orbitron'] font-bold text-xs">
                  {localSelected.length} {localSelected.length === 1 ? 'Topic' : 'Topics'} Selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-['Orbitron'] font-bold uppercase tracking-wider text-text-muted hover:text-white bg-surface-2 border border-border-base transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-6 py-2 rounded-xl text-xs font-['Orbitron'] font-bold uppercase tracking-wider text-black bg-accent hover:bg-[#00e63a] shadow-[0_0_15px_rgba(0,255,65,0.3)] transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={14} />
                Apply Topics
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
