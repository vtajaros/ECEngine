import React, { useState, useEffect } from 'react'
import { X, Plus, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TOS_SUBJECT_COLORS } from '../../lib/tosData'
import { PREDEFINED_TAGS } from '../../lib/constants'

type Subject = 'Mathematics' | 'General Engineering & Applied Sciences' | 'Electronics Engineering' | 'Electronics Systems & Technologies'

const SUBJECTS: { value: Subject; short: string }[] = [
  { value: 'Mathematics', short: 'MATH' },
  { value: 'General Engineering & Applied Sciences', short: 'GEAS' },
  { value: 'Electronics Engineering', short: 'ELECS' },
  { value: 'Electronics Systems & Technologies', short: 'EST' },
]



export type DeckMetadata = {
  title: string
  description: string
  subject: Subject
  customTagInput: string
  folderName: string
  folderId: string | null
  existingFolders: { id: string, name: string }[]
  showFolderDropdown: boolean
  deckTags: string[]
}

interface DeckMetadataFormProps {
  metadata: DeckMetadata
  setMetadata: React.Dispatch<React.SetStateAction<DeckMetadata>>
  scope: 'study' | 'formula'
}

export default function DeckMetadataForm({ metadata, setMetadata, scope }: DeckMetadataFormProps) {
  const folderDropdownRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setMetadata(prev => ({ ...prev, showFolderDropdown: false }))
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setMetadata])

  // Fetch existing folders for autocomplete whenever the dropdown is opened.
  // Triggering on showFolderDropdown (not just mount) ensures folders created
  // in the sidebar after this page first loaded are always visible here.
  useEffect(() => {
    if (!metadata.showFolderDropdown) return
    async function fetchFolders() {
      try {
        const res = await window.electron.folders.getAll({ scope })
        const folders = res.success && res.data
          ? res.data.map((f: any) => ({ id: f.id, name: f.name })).sort((a: any, b: any) => a.name.localeCompare(b.name))
          : []
        setMetadata(prev => ({ ...prev, existingFolders: folders }))
      } catch {
        setMetadata(prev => ({ ...prev, existingFolders: [] }))
      }
    }
    fetchFolders()
  }, [metadata.showFolderDropdown, setMetadata, scope])

  return (
    <section className="w-full max-w-4xl xl:max-w-none xl:col-span-1 xl:sticky xl:top-20 flex flex-col gap-6 bg-[#111] border border-zinc-800 p-6 rounded-xl">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <input
            value={metadata.title}
            onChange={e => setMetadata(prev => ({ ...prev, title: e.target.value }))}
            maxLength={80}
            placeholder='Enter deck title...'
            className="w-full bg-transparent text-text-primary text-[1.15rem] font-['Orbitron'] border-b-2 border-[#333] focus:border-accent pb-3 focus:outline-none placeholder:text-[#555] transition-colors tracking-wide pr-16"
          />
          <span className="absolute right-0 bottom-4 text-xs font-['IBM_Plex_Mono'] text-[#666]">
            {metadata.title.length} / 80
          </span>
        </div>
        <input
          value={metadata.description}
          onChange={e => setMetadata(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Add a description... (optional)"
          className="w-full bg-transparent text-[#aaa] text-sm font-['IBM_Plex_Mono'] pb-2 focus:outline-none placeholder:text-[#555] transition-colors"
        />
        <div className="mt-2 pt-2 border-t border-border-base">
          <label className="text-[10px] text-[#555] font-['Rajdhani'] font-bold uppercase tracking-widest mb-1 block">
            Folder / Category
          </label>
          <div className="relative" ref={folderDropdownRef}>
            <div className="relative flex items-center">
              <input
                type="text"
                value={metadata.folderName}
                onChange={e => setMetadata(prev => ({ ...prev, folderName: e.target.value, folderId: null, showFolderDropdown: true }))}
                onFocus={() => setMetadata(prev => ({ ...prev, showFolderDropdown: true }))}
                placeholder="e.g. Select or type folder name..."
                className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-text-primary text-sm font-['IBM_Plex_Mono'] focus:border-accent focus:bg-[#111] outline-none transition-colors pr-16 placeholder-[#555]"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {metadata.folderName && (
                  <button
                    type="button"
                    onClick={() => setMetadata(prev => ({ ...prev, folderName: '', folderId: null, showFolderDropdown: true }))}
                    className="p-1 text-[#444] hover:text-accent transition-colors"
                    title="Clear folder"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMetadata(prev => ({ ...prev, showFolderDropdown: !prev.showFolderDropdown }))}
                  className="p-1 text-[#666] hover:text-accent transition-colors"
                  title="Toggle folder list"
                >
                  <ChevronDown size={14} className={`transform transition-transform ${metadata.showFolderDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {metadata.showFolderDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface-2 border border-[#333] rounded-lg shadow-2xl max-h-48 overflow-y-auto custom-scrollbar"
                >
                  {metadata.existingFolders.length === 0 ? (
                    <div className="p-3 text-xs text-[#666] font-['IBM_Plex_Mono'] text-center">
                      No folders created yet. Type above to create one.
                    </div>
                  ) : (
                    <div className="flex flex-col py-1">
                      {metadata.existingFolders
                        .filter(f => f.name.toLowerCase().includes(metadata.folderName.toLowerCase()))
                        .map(f => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setMetadata(prev => ({ ...prev, folderName: f.name, folderId: f.id, showFolderDropdown: false }))}
                            className="w-full text-left px-3 py-2 text-xs font-['IBM_Plex_Mono'] text-[#ccc] hover:bg-border-base hover:text-accent transition-colors flex items-center justify-between"
                          >
                            <span>{f.name}</span>
                            {metadata.folderName.toLowerCase() === f.name.toLowerCase() && (
                              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                            )}
                          </button>
                        ))}
                      {metadata.existingFolders.filter(f => f.name.toLowerCase().includes(metadata.folderName.toLowerCase())).length === 0 && (
                        <div
                          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-surface transition-colors"
                          onClick={() => setMetadata(prev => ({ ...prev, showFolderDropdown: false }))}
                        >
                          <span className="font-['IBM_Plex_Mono'] text-xs text-accent">
                            Create "{metadata.folderName}"
                          </span>
                          <button
                            className="flex items-center justify-center w-5 h-5 rounded bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors"
                            title="Confirm new folder name"
                          >
                            <Plus size={12} className="text-accent" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div>
        <label className="text-[11px] text-accent font-['Rajdhani'] font-bold uppercase tracking-widest mb-3 block">
          Subject
        </label>
        <div className="flex gap-2 flex-wrap">
          {SUBJECTS.map(s => {
            const isSelected = metadata.subject === s.value
            const colors = TOS_SUBJECT_COLORS[s.short]

            return (
              <button
                key={s.value}
                onClick={() => setMetadata(prev => ({ ...prev, subject: s.value }))}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all font-['Rajdhani'] font-bold text-sm uppercase tracking-widest"
                style={
                  isSelected
                    ? {
                      background: `rgba(${colors.accentRgb},0.15)`,
                      borderColor: `rgba(${colors.accentRgb},0.5)`,
                      color: colors.accent,
                      boxShadow: `0 0 16px rgba(${colors.accentRgb},0.1)`,
                    }
                    : {
                      background: '#0c0c0c',
                      borderColor: '#2a2a2a',
                      color: '#555',
                    }
                }
              >
                <span>{s.short}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-[11px] text-accent font-['Rajdhani'] font-bold uppercase tracking-widest mb-3 block">
          Source Tags
        </label>
        <div className="flex flex-wrap gap-3">
          {PREDEFINED_TAGS.map(tag => {
            const isSelected = metadata.deckTags.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => setMetadata(prev => {
                  const next = prev.deckTags.includes(tag) ? prev.deckTags.filter(t => t !== tag) : [...prev.deckTags, tag]
                  return { ...prev, deckTags: next }
                })}
                className={`px-4 py-2 rounded-full font-['Rajdhani'] uppercase tracking-wider text-xs font-bold transition-all border ${isSelected
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-surface-2 border-[#333] text-text-muted hover:border-[#555] hover:text-text-primary'
                  }`}
              >
                {tag}
              </button>
            )
          })}
          {metadata.deckTags.filter(t => !PREDEFINED_TAGS.includes(t)).map(tag => (
            <div key={tag} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent/10 border border-accent text-accent font-['Rajdhani'] uppercase tracking-wider text-xs font-bold">
              {tag}
              <button onClick={() => setMetadata(prev => ({ ...prev, deckTags: prev.deckTags.filter(t => t !== tag) }))} className="text-accent hover:text-white transition-colors cursor-pointer rounded-full p-0.5 -mr-2">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-3 w-full max-w-sm">
          <input
            type="text"
            placeholder="Add custom tag..."
            value={metadata.customTagInput}
            onChange={e => setMetadata(prev => ({ ...prev, customTagInput: e.target.value }))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (metadata.customTagInput.trim()) {
                  setMetadata(prev => ({ ...prev, deckTags: [...prev.deckTags, prev.customTagInput.trim()], customTagInput: '' }));
                }
              }
            }}
            className="flex-1 bg-[#111] border border-[#333] rounded px-3 py-2 text-sm text-text-primary placeholder-[#555] focus:border-accent focus:outline-none font-['Rajdhani'] uppercase tracking-wider transition-colors h-[38px]"
          />
          <button
            onClick={() => {
              if (metadata.customTagInput.trim()) {
                setMetadata(prev => ({ ...prev, deckTags: [...prev.deckTags, prev.customTagInput.trim()], customTagInput: '' }));
              }
            }}
            className="w-[38px] h-[38px] bg-[#111] border border-[#333] text-text-muted flex items-center justify-center rounded hover:text-accent hover:border-accent transition-colors shrink-0"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </section>
  )
}
