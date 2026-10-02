import React, { useState, useEffect } from 'react'
import { X, Plus, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TOS_SUBJECT_COLORS } from '../../lib/tosData'
import { getAllAvailableTags, saveCustomTag, markTagDeleted } from '../../lib/tags'
import { TagDeleteConfirmModal, AffectedDeck } from './TagDeleteConfirmModal'

type Subject = 'Mathematics' | 'General Engineering & Applied Sciences' | 'Electronics Engineering' | 'Electronics Systems & Technologies'

const SUBJECTS: { value: Subject; short: string }[] = [
  { value: 'Mathematics', short: 'MATH' },
  { value: 'General Engineering & Applied Sciences', short: 'GEAS' },
  { value: 'Electronics Engineering', short: 'ELECS' },
  { value: 'Electronics Systems & Technologies', short: 'EST' },
]



import { EditCard } from './CardEditor'
import { AIDescriptionButton } from './AIDescriptionButton'
import { Tooltip } from '../ui/Tooltip'
import { generateDeckSummary } from '../../services/aiSummary.service'
import { TosTopicPicker } from '../ui/TosTopicPicker'

export type DeckMetadata = {
  title: string
  description: string
  subject: Subject
  customTagInput: string
  folderName: string
  folderId: string | null
  existingFolders: { id: string, name: string, deckCount?: number }[]
  showFolderDropdown: boolean
  deckTags: string[]
  defaultTosTopicId?: string | null
}

interface DeckMetadataFormProps {
  metadata: DeckMetadata
  setMetadata: React.Dispatch<React.SetStateAction<DeckMetadata>>
  scope: 'study' | 'formula'
  cards?: EditCard[]
  onToast?: (type: 'success' | 'error', msg: string) => void
}

export default function DeckMetadataForm({ metadata, setMetadata, scope, cards = [], onToast }: DeckMetadataFormProps) {
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const folderDropdownRef = React.useRef<HTMLDivElement>(null)

  const [existingTopics, setExistingTopics] = useState<any[]>([])
  const [pendingDeleteTag, setPendingDeleteTag] = useState<string | null>(null)
  const [affectedDecks, setAffectedDecks] = useState<AffectedDeck[]>([])
  const [isDeletingTag, setIsDeletingTag] = useState(false)
  const [tagRefreshKey, setTagRefreshKey] = useState(0)

  useEffect(() => {
    async function fetchTopics() {
      try {
        const res = await window.electron?.decks?.getTopics()
        if (res?.success && res.data) {
          setExistingTopics(res.data)
        }
      } catch {}
    }
    fetchTopics()
  }, [])

  const availableTags = React.useMemo(() => {
    return getAllAvailableTags(existingTopics)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingTopics, tagRefreshKey])

  const handleInitiateDeleteTag = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const normalized = tag.trim().toLowerCase()
    const affected: AffectedDeck[] = []
    for (const t of existingTopics) {
      if (!t.tags) continue
      try {
        const parsed = JSON.parse(t.tags)
        if (Array.isArray(parsed) && parsed.some((x: any) => typeof x === 'string' && x.trim().toLowerCase() === normalized)) {
          affected.push({ id: t.id, name: t.name || 'Untitled Deck', subject: t.subject, folderName: t.folder_name })
        }
      } catch {
        const parts = String(t.tags).split(',').map((s: string) => s.trim().toLowerCase())
        if (parts.includes(normalized)) {
          affected.push({ id: t.id, name: t.name || 'Untitled Deck', subject: t.subject, folderName: t.folder_name })
        }
      }
    }
    setAffectedDecks(affected)
    setPendingDeleteTag(tag)
  }

  const handleConfirmDeleteTag = async () => {
    if (!pendingDeleteTag) return
    setIsDeletingTag(true)
    try {
      if (window.electron?.decks?.deleteTag) {
        await window.electron.decks.deleteTag(pendingDeleteTag)
      }
      markTagDeleted(pendingDeleteTag)

      const normalized = pendingDeleteTag.trim().toLowerCase()
      setMetadata(prev => ({
        ...prev,
        deckTags: prev.deckTags.filter(t => t.trim().toLowerCase() !== normalized)
      }))

      setExistingTopics(prev => prev.map(topic => {
        if (!topic.tags) return topic
        try {
          const parsed = JSON.parse(topic.tags)
          if (Array.isArray(parsed)) {
            const updated = parsed.filter((x: any) => typeof x === 'string' && x.trim().toLowerCase() !== normalized)
            return { ...topic, tags: JSON.stringify(updated) }
          }
        } catch {}
        return topic
      }))

      setTagRefreshKey(k => k + 1)
      onToast?.('success', `Tag "${pendingDeleteTag}" deleted.`)
      setPendingDeleteTag(null)
      setAffectedDecks([])
    } catch (err: any) {
      onToast?.('error', err?.message || 'Failed to delete tag')
    } finally {
      setIsDeletingTag(false)
    }
  }

  const handleAddCustomTag = () => {
    const tag = metadata.customTagInput.trim()
    if (!tag) return
    saveCustomTag(tag)
    setMetadata(prev => {
      const exists = prev.deckTags.some(t => t.toLowerCase() === tag.toLowerCase())
      return {
        ...prev,
        deckTags: exists ? prev.deckTags : [...prev.deckTags, tag],
        customTagInput: ''
      }
    })
    setTagRefreshKey(k => k + 1)
  }

  const handleGenerateSummary = async () => {
    if (cards.length === 0) {
      onToast?.('error', 'Please add some cards to generate a summary.')
      return
    }

    setIsGeneratingSummary(true)
    try {
      const summary = await generateDeckSummary({
        title: metadata.title,
        subject: metadata.subject,
        cards,
      })
      setMetadata(prev => ({ ...prev, description: summary }))
      onToast?.('success', 'AI summary generated!')
    } catch (err: any) {
      console.error('[AI Summary Generation Error]', err)
      onToast?.('error', err.message || 'Failed to generate summary.')
    } finally {
      setIsGeneratingSummary(false)
    }
  }

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
          ? res.data
              .map((f: any) => ({
                id: f.id,
                name: f.name,
                deckCount: typeof f.deck_count === 'number' ? f.deck_count : 0,
              }))
              .sort((a: any, b: any) => (b.deckCount - a.deckCount) || a.name.localeCompare(b.name))
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
          <span className="absolute right-0 bottom-4 text-xs font-['JetBrains_Mono'] text-[#666]">
            {metadata.title.length} / 80
          </span>
        </div>
        <div className="relative flex items-center">
          <input
            type="text"
            value={metadata.description}
            onChange={e => setMetadata(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Add a description... (optional)"
            className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 pr-10 text-text-primary text-sm font-['JetBrains_Mono'] focus:border-accent focus:bg-[#111] outline-none transition-colors placeholder-[#555]"
          />
          <div className="absolute right-1.5 flex items-center">
            <AIDescriptionButton
              onClick={handleGenerateSummary}
              isGenerating={isGeneratingSummary}
              disabled={cards.length === 0}
            />
          </div>
        </div>
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
                className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-text-primary text-sm font-['JetBrains_Mono'] focus:border-accent focus:bg-[#111] outline-none transition-colors pr-16 placeholder-[#555]"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {metadata.folderName && (
                  <Tooltip content="Clear folder" position="top">
                    <button
                      type="button"
                      onClick={() => setMetadata(prev => ({ ...prev, folderName: '', folderId: null, showFolderDropdown: true }))}
                      className="p-1 text-[#444] hover:text-accent transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </Tooltip>
                )}
                <Tooltip content="Toggle folder list" position="top">
                  <button
                    type="button"
                    onClick={() => setMetadata(prev => ({ ...prev, showFolderDropdown: !prev.showFolderDropdown }))}
                    className="p-1 text-[#666] hover:text-accent transition-colors"
                  >
                    <ChevronDown size={14} className={`transform transition-transform ${metadata.showFolderDropdown ? 'rotate-180' : ''}`} />
                  </button>
                </Tooltip>
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
                    <div className="p-3 text-xs text-[#666] font-['JetBrains_Mono'] text-center">
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
                            className="w-full text-left px-3 py-2 text-xs font-['JetBrains_Mono'] text-[#ccc] hover:bg-border-base hover:text-accent transition-colors flex items-center justify-between"
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
                          <span className="font-['JetBrains_Mono'] text-xs text-accent">
                            Create "{metadata.folderName}"
                          </span>
                          <Tooltip content="Confirm new folder name" position="top">
                            <button
                              className="flex items-center justify-center w-5 h-5 rounded bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors"
                            >
                              <Plus size={12} className="text-accent" />
                            </button>
                          </Tooltip>
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
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] text-accent font-['Rajdhani'] font-bold uppercase tracking-widest block">
            Default TOS Category
          </label>
          <span className="text-[10px] text-[#666] font-['JetBrains_Mono']">
            Applies to cards in this deck
          </span>
        </div>
        <TosTopicPicker
          value={metadata.defaultTosTopicId || null}
          onChange={topicId => setMetadata(prev => ({ ...prev, defaultTosTopicId: topicId }))}
          subject={metadata.subject}
          placeholder="None / Mixed Topics"
          clearLabel="None / Mixed Topics"
          fullWidth
        />
      </div>

      <div>
        <label className="text-[11px] text-accent font-['Rajdhani'] font-bold uppercase tracking-widest mb-3 block">
          Source Tags
        </label>
        <div className="flex flex-wrap gap-2.5">
          {availableTags.map(tag => {
            const isSelected = metadata.deckTags.some(t => t.toLowerCase() === tag.toLowerCase())
            return (
              <div
                key={tag}
                onClick={() => setMetadata(prev => {
                  const next = isSelected
                    ? prev.deckTags.filter(t => t.toLowerCase() !== tag.toLowerCase())
                    : [...prev.deckTags, tag]
                  return { ...prev, deckTags: next }
                })}
                className={`group flex items-center gap-1.5 pl-3.5 pr-2 py-1.5 rounded-full font-['Rajdhani'] uppercase tracking-wider text-xs font-bold transition-all border cursor-pointer select-none ${isSelected
                  ? 'bg-accent/15 border-accent text-accent shadow-[0_0_12px_rgba(0,255,65,0.15)]'
                  : 'bg-surface-2 border-[#333] text-text-muted hover:border-[#555] hover:text-text-primary'
                  }`}
              >
                <span>{tag}</span>
                <Tooltip content={`Delete tag "${tag}"`} position="top">
                  <button
                    type="button"
                    onClick={(e) => handleInitiateDeleteTag(tag, e)}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/20 transition-all opacity-60 group-hover:opacity-100"
                  >
                    <X size={11} />
                  </button>
                </Tooltip>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 mt-3 w-full max-w-sm">
          <input
            type="text"
            placeholder="Add custom tag..."
            value={metadata.customTagInput}
            onChange={e => setMetadata(prev => ({ ...prev, customTagInput: e.target.value }))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddCustomTag()
              }
            }}
            className="flex-1 bg-[#111] border border-[#333] rounded px-3 py-2 text-sm text-text-primary placeholder-[#555] focus:border-accent focus:outline-none font-['Rajdhani'] uppercase tracking-wider transition-colors h-[38px]"
          />
          <button
            type="button"
            onClick={handleAddCustomTag}
            className="w-[38px] h-[38px] bg-[#111] border border-[#333] text-text-muted flex items-center justify-center rounded hover:text-accent hover:border-accent transition-colors shrink-0"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <TagDeleteConfirmModal
        tag={pendingDeleteTag}
        affectedDecks={affectedDecks}
        isDeleting={isDeletingTag}
        onConfirm={handleConfirmDeleteTag}
        onCancel={() => {
          if (!isDeletingTag) {
            setPendingDeleteTag(null)
            setAffectedDecks([])
          }
        }}
      />
    </section>
  )
}
