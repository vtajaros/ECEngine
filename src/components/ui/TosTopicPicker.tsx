import React, { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Check, ChevronDown } from 'lucide-react'
import type { Subject } from '../../types'
import { getTosTopicGroupsBySubject, formatTosBadge, normalizeSubjectCode } from '../../lib/tosClassification'

export interface TosTopicPickerProps {
  value: string | null
  onChange: (newTopicId: string | null) => void
  subject?: Subject | string | null
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
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const normalizedSubject = useMemo(() => normalizeSubjectCode(subject), [subject])
  const activeSubject = normalizedSubject || subject || 'ELECS'
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

  const updateCoords = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    const popoverWidth = Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 16 : 320)

    // Open upward only if space below is tight (< 220px) AND space above has more room
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow

    let left = rect.left
    if (typeof window !== 'undefined') {
      if (left + popoverWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - popoverWidth - 8)
      }
      if (left < 8) left = 8
    }

    const availableSpace = openUp ? spaceAbove - 16 : spaceBelow - 16
    const maxHeight = Math.max(160, Math.min(320, availableSpace))

    setDirection(openUp ? 'up' : 'down')
    setPopoverStyle({
      position: 'fixed',
      left: `${left}px`,
      width: `${popoverWidth}px`,
      maxHeight: `${maxHeight}px`,
      zIndex: 99999,
      ...(openUp
        ? { bottom: `${window.innerHeight - rect.top + 6}px` }
        : { top: `${rect.bottom + 6}px` }),
    })
  }

  // Handle repositioning on resize and scroll
  useEffect(() => {
    if (!isOpen) return
    const handleScrollOrResize = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          setIsOpen(false)
          setSearch('')
          return
        }
      }
      updateCoords()
    }
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('scroll', handleScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
  }, [isOpen])

  // Handle outside clicks to close (checking both trigger/container and portal popover)
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
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
      updateCoords()
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

  const canUseDOM = typeof document !== 'undefined'

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

      {/* Popover rendered via Portal to avoid overflow clipping */}
      {isOpen && canUseDOM && createPortal(
        <div
          ref={popoverRef}
          style={popoverStyle}
          className="bg-[#161616] border border-accent/40 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-2.5 border-b border-border-base/50 bg-[#1c1c1c] flex flex-col gap-1.5 shrink-0">
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
          <div className="px-2 pt-1.5 pb-1 border-b border-border-base/30 shrink-0">
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
          <div className="overflow-y-auto show-scrollbar p-1.5 flex-1 space-y-2">
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
        </div>,
        document.body
      )}
    </div>
  )
}
