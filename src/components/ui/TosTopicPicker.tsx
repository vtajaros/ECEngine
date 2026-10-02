import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Search, X, Check, ChevronDown } from 'lucide-react'
import type { Subject } from '../../types'
import { getTosTopicGroupsBySubject, formatTosBadge } from '../../lib/tosClassification'

export interface TosTopicPickerProps {
  value: string | null
  onChange: (newTopicId: string | null) => void
  subject?: Subject | null
  placeholder?: string
  fullWidth?: boolean
  className?: string
  disabled?: boolean
  clearLabel?: string
}

export const TosTopicPicker: React.FC<TosTopicPickerProps> = ({
  value,
  onChange,
  subject,
  placeholder = '(Default from Deck / None)',
  fullWidth = false,
  className = '',
  disabled = false,
  clearLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<'up' | 'down'>('down')
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const activeSubject = subject || 'ELECS'
  const groups = useMemo(() => getTosTopicGroupsBySubject(activeSubject), [activeSubject])

  // Resolve current selection label
  const selectedSubtopic = useMemo(() => {
    if (!value) return null
    for (const g of groups) {
      for (const st of g.subtopics) {
        if (st.id === value || st.code === value) return st
      }
    }
    return null
  }, [groups, value])

  const displayLabel = useMemo(() => {
    if (selectedSubtopic) {
      return `${selectedSubtopic.code} ${selectedSubtopic.title}`
    }
    if (value) {
      return formatTosBadge(value) || value
    }
    return placeholder
  }, [selectedSubtopic, value, placeholder])

  // Filter groups & subtopics: parent topics are strictly group headers (never selectable)
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups
    const q = search.toLowerCase().trim()
    return groups
      .map(g => ({
        ...g,
        subtopics: g.subtopics.filter(
          st =>
            st.code.toLowerCase().includes(q) ||
            st.name.toLowerCase().includes(q) ||
            st.title.toLowerCase().includes(q) ||
            st.id.toLowerCase().includes(q) ||
            g.parent.name.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.subtopics.length > 0)
  }, [groups, search])

  // Handle outside clicks to close
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside, true)
    return () => document.removeEventListener('mousedown', handleClickOutside, true)
  }, [isOpen])

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    if (isOpen) {
      setIsOpen(false)
      setSearch('')
    } else {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        setDirection(spaceBelow < 330 ? 'up' : 'down')
      }
      setIsOpen(true)
      setSearch('')
    }
  }

  const handleSelect = (topicId: string | null, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(topicId)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${fullWidth ? 'w-full' : ''} ${className}`}
      onClick={e => e.stopPropagation()}
    >
      {/* Trigger Button styled sleekly */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`bg-[#121212] border hover:border-accent/60 rounded px-2.5 py-1.5 text-xs font-['JetBrains_Mono'] text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
          fullWidth ? 'w-full' : 'max-w-[320px]'
        } ${
          isOpen
            ? 'border-accent shadow-[0_0_10px_rgba(0,255,65,0.2)]'
            : value
            ? 'border-border-base text-text-primary'
            : 'border-border-base text-text-muted'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-text-muted transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-accent' : ''
          }`}
        />
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          className={`absolute left-0 ${
            direction === 'up' ? 'bottom-full mb-1.5 origin-bottom-left' : 'top-full mt-1.5 origin-top-left'
          } w-72 sm:w-80 max-h-76 bg-[#161616] border border-accent/40 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.95)] z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header */}
          <div className="p-2.5 border-b border-border-base/50 bg-[#1c1c1c] flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold font-['Orbitron'] text-text-muted tracking-wider uppercase">
                {activeSubject} Subtopics
              </span>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setIsOpen(false)
                  setSearch('')
                }}
                className="text-text-muted hover:text-white p-0.5 rounded transition-colors"
              >
                <X size={12} />
              </button>
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Filter (e.g. 1.3 or theorem)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#111] border border-border-base focus:border-accent rounded-md pl-7 pr-2 py-1 text-[11px] text-text-primary font-['JetBrains_Mono'] outline-none"
              />
            </div>
          </div>

          {/* Clear / Untag Option */}
          <div className="px-2 pt-1.5 pb-1 border-b border-border-base/30">
            <button
              type="button"
              onClick={e => handleSelect(null, e)}
              className={`w-full px-2 py-1 rounded text-left text-[11px] font-['JetBrains_Mono'] flex items-center justify-between transition-colors ${
                !value
                  ? 'bg-red-500/15 text-red-300 border border-red-500/40 font-bold'
                  : 'text-text-muted hover:text-red-400 hover:bg-red-500/10'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {clearLabel || (placeholder.includes('Default') ? 'Default from Deck / None' : 'Clear / Untag')}
              </span>
              {!value && <Check size={12} className="text-red-400" />}
            </button>
          </div>

          {/* Subtopics List Grouped by Parent Topic Header */}
          <div className="overflow-y-auto show-scrollbar p-1.5 flex-1 max-h-52 space-y-2">
            {filteredGroups.length === 0 ? (
              <div className="p-3 text-center text-[11px] font-['JetBrains_Mono'] text-text-muted">
                No subtopics match &ldquo;{search}&rdquo;
              </div>
            ) : (
              filteredGroups.map(group => (
                <div key={group.parent.id} className="space-y-0.5">
                  {/* Parent Topic Header: STRICTLY NON-SELECTABLE */}
                  <div className="px-2 py-1 text-[9px] font-['Orbitron'] font-bold text-text-muted/70 tracking-wider truncate uppercase">
                    {group.parent.name}
                  </div>
                  {/* Selectable Leaf Subtopics Only */}
                  {group.subtopics.map(st => {
                    const isSelected = value === st.id
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={e => handleSelect(st.id, e)}
                        className={`w-full px-2 py-1 rounded text-left text-[11px] font-['JetBrains_Mono'] flex items-center justify-between gap-1.5 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-accent/15 text-accent font-bold border border-accent/40'
                            : 'text-text-primary hover:bg-[#252525]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-bold text-accent shrink-0">{st.code}</span>
                          <span className="truncate text-text-primary">{st.title}</span>
                        </div>
                        {isSelected && <Check size={12} className="text-accent shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
