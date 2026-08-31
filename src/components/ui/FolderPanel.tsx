import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid, Folder, FolderOpen, Trash2, GripVertical,
  Pencil, Check, X, AlertTriangle, ChevronRight, Plus, FolderPlus,
  AlertCircle,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, DragEndEvent, DragOverEvent,
  DragStartEvent, DragOverlay, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FolderRow } from '../../types/window'
import { Tooltip } from './Tooltip'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FolderPanelProps {
  folderRows?: FolderRow[]
  folders?: string[]
  deckCountByFolder: Record<string, number>
  totalDeckCount: number
  displayedDeckCount?: number
  activeSubject?: string
  searchQuery?: string
  filterType?: string
  filterTags?: string[]
  selected: string | 'all'
  onSelect: (folderIdOrName: string | 'all') => void
  onDeleteFolder?: (folderIdOrName: string) => void
  onReorderFolders?: (newOrder: string[]) => void
  onCreateFolder?: (name: string, parentId?: string | null) => void
  onPromoteFolder?: (folderId: string) => Promise<void>
  onNestFolder?: (folderId: string, parentId: string) => Promise<void>
  onRenameFolder?: (folderId: string, newName: string) => void
}

interface TreeNode extends FolderRow {
  children: TreeNode[]
}

// drop intent type used in position-based logic
type DropIntent = 'before' | 'into' | 'after'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildTree(rows: FolderRow[]): { roots: TreeNode[]; uncategorized: TreeNode | null } {
  const map = new Map<string, TreeNode>()
  rows.forEach(r => map.set(r.id, { ...r, children: [] }))

  const roots: TreeNode[] = []
  let uncategorized: TreeNode | null = null

  rows.forEach(r => {
    const node = map.get(r.id)!
    if (r.name === 'Uncategorized') {
      uncategorized = node
    } else if (r.parent_id && map.has(r.parent_id)) {
      map.get(r.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  roots.sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name))
  roots.forEach(r => r.children.sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name)))

  return { roots, uncategorized }
}

/** Flatten tree depth-first, roots then their children, for SortableContext */
function flattenIds(roots: TreeNode[]): string[] {
  const ids: string[] = []
  for (const root of roots) {
    ids.push(root.id)
    for (const child of root.children) ids.push(child.id)
  }
  return ids
}

function subtreeCount(node: { id: string; name?: string; children?: any[] } | null | undefined, countMap: Record<string, number>): number {
  if (!node) return 0
  const own = countMap[node.id] ?? (node.name ? countMap[node.name] : 0) ?? 0
  const children = Array.isArray(node.children) ? node.children : []
  return own + children.reduce((s, c) => s + subtreeCount(c, countMap), 0)
}

function findTreeNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children && node.children.length > 0) {
      const found = findTreeNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

// Module-level countMap to avoid prop drilling into FolderRowItem
let countMap: Record<string, number> = {}

const TOP_LEVEL_DROP_ID = '__TOP_LEVEL_DROP__'

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper — computes drop intent from live event geometry.
// Used by BOTH onDragOver (for highlight state) and handleDragEnd (for action).
// Never reading from React state avoids the race where onDragEnd fires before
// the async state updates from the last onDragOver have committed.
// ─────────────────────────────────────────────────────────────────────────────

function computeDropInfo(
  active: { id: unknown; rect: { current: { translated: DOMRect | null | undefined } } },
  over: { id: unknown; rect: DOMRect } | null | undefined,
  folderRows: FolderRow[]
): { targetId: string | null; intent: DropIntent | null; isTopLevel: boolean } {
  if (!over) return { targetId: null, intent: null, isTopLevel: false }

  const overId = over.id as string

  if (overId === TOP_LEVEL_DROP_ID) {
    return { targetId: null, intent: null, isTopLevel: true }
  }

  // Only root-level folders are valid positional drop targets
  const overNode = folderRows.find(r => r.id === overId)
  if (!overNode || overNode.parent_id !== null) {
    return { targetId: null, intent: null, isTopLevel: false }
  }

  const overRect = over.rect
  const activeRect = active.rect.current.translated
  let intent: DropIntent = 'into'
  if (overRect && activeRect) {
    // The visual center of the dragged row (ignoring its children) is ~16px down from the top.
    // Using full activeRect.height would skew the center for expanded folders.
    const activeVisualCenterY = activeRect.top + 16
    const relativeY = (activeVisualCenterY - overRect.top) / overRect.height
    intent = relativeY < 0.15 ? 'before' : relativeY > 0.85 ? 'after' : 'into'
  }

  return { targetId: overId, intent, isTopLevel: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline rename input — same visual style as CreateFolderInput
// ─────────────────────────────────────────────────────────────────────────────

const RenameFolderInput: React.FC<{
  initialName: string
  depth: number
  onConfirm: (name: string) => void
  onCancel: () => void
}> = ({ initialName, depth, onConfirm, onCancel }) => {
  const [name, setName] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 30)
    return () => clearTimeout(t)
  }, [])

  const confirm = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== initialName) onConfirm(trimmed)
    else onCancel()
  }

  const indent = depth * 14

  return (
    <div
      className="flex items-center gap-1.5 py-1.5 rounded-md border border-accent/40 bg-[#111] my-0.5"
      style={{ paddingLeft: `${10 + indent}px`, paddingRight: '8px' }}
    >
      <Folder size={13} className="shrink-0 text-accent" />
      <input
        ref={inputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') confirm()
          if (e.key === 'Escape') onCancel()
        }}
        className="flex-1 bg-transparent text-sm font-medium font-['Rajdhani'] tracking-wide text-white outline-none min-w-0"
      />
      <button onClick={confirm} className="text-accent hover:opacity-70 transition-opacity p-0.5 shrink-0">
        <Check size={12} />
      </button>
      <button onClick={onCancel} className="text-gray-400 hover:text-red-400 transition-colors p-0.5 shrink-0">
        <X size={12} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FolderRowItem
// ─────────────────────────────────────────────────────────────────────────────

const FolderRowItem: React.FC<{
  node: TreeNode
  isEditing: boolean
  isCollapsed?: boolean
  selected: string | 'all'
  depth: number
  isExpanded: boolean
  activeDragId: string | null
  activeDragDepth: number | null
  dropTargetId: string | null
  dropIntent: DropIntent | null
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
  onRequestDelete: (id: string, name: string) => void
  onRequestCreate: (parentId: string) => void
  onRenameFolder?: (folderId: string, newName: string) => void
}> = ({
  node, isEditing, isCollapsed, selected, depth,
  isExpanded, activeDragId, activeDragDepth, dropTargetId, dropIntent,
  onSelect, onToggleExpand, onRequestDelete, onRequestCreate, onRenameFolder,
}) => {
  const isUncategorized = node.name === 'Uncategorized'
  const isSelected = selected === node.id
  const deckCount = depth === 0 ? subtreeCount(node, countMap) : (countMap[node.id] ?? countMap[node.name] ?? 0)
  const [isRenaming, setIsRenaming] = useState(false)

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: node.id, disabled: isUncategorized })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const indent = depth * 14
  const hasChildren = node.children.length > 0
  const FolderIcon = isSelected || isExpanded ? FolderOpen : Folder

  // Visual feedback: is this row the current drop target?
  const isDropTarget = dropTargetId === node.id && activeDragId !== node.id && depth === 0

  // Rename input in edit mode — replaces the row
  if (isEditing && isRenaming && !isUncategorized) {
    return (
      <div ref={setNodeRef} style={style}>
        <RenameFolderInput
          initialName={node.name}
          depth={depth}
          onConfirm={(newName) => {
            onRenameFolder?.(node.id, newName)
            setIsRenaming(false)
          }}
          onCancel={() => setIsRenaming(false)}
        />
        {/* Children still shown below rename input in edit mode */}
        {node.children.map(child => (
          <FolderRowItem
            key={child.id}
            node={child}
            isEditing={isEditing}
            selected={selected}
            depth={depth + 1}
            isExpanded={false}
            activeDragId={activeDragId}
            activeDragDepth={activeDragDepth}
            dropTargetId={dropTargetId}
            dropIntent={dropIntent}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onRequestDelete={onRequestDelete}
            onRequestCreate={onRequestCreate}
            onRenameFolder={onRenameFolder}
          />
        ))}
      </div>
    )
  }

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style}>
        <div
          className={`relative flex items-center gap-2 w-full py-1.5 rounded-md border hover:bg-slate-800/50 ${
            isDropTarget && dropIntent === 'into'
              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
              : isDropTarget && dropIntent === 'before'
              ? 'border-transparent border-t-[2px] border-t-[var(--accent-primary)]'
              : isDropTarget && dropIntent === 'after'
              ? 'border-transparent border-b-[2px] border-b-[var(--accent-primary)]'
              : 'border-transparent'
          }`}
          style={{ paddingLeft: `${10 + indent}px`, paddingRight: '8px' }}
        >
          {/* Grip handle — all non-uncategorized rows, any depth */}
          {!isUncategorized ? (
            <div
              {...attributes}
              {...listeners}
              className="p-1 shrink-0 cursor-grab active:cursor-grabbing text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="w-5 shrink-0" />
          )}

          <Folder size={13} className="shrink-0 text-[var(--text-secondary)]" />

          <span className="flex-1 min-w-0 text-[12px] font-bold font-['Rajdhani'] uppercase tracking-wider text-[var(--text-secondary)] truncate">
            {node.name}
          </span>

          {/* Nest-into indicator label */}
          {isDropTarget && dropIntent === 'into' && (
            <span className="text-[9px] font-['Rajdhani'] uppercase tracking-wider text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
              Nest inside
            </span>
          )}

          {/* Add subfolder — only root level */}
          {!isUncategorized && depth === 0 && (
            <Tooltip content="Add subfolder" position="top">
              <button
                onClick={(e) => { e.stopPropagation(); onRequestCreate(node.id) }}
                className="p-0.5 shrink-0 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
              >
                <FolderPlus className="w-3 h-3" />
              </button>
            </Tooltip>
          )}

          {/* Rename button — any non-uncategorized row */}
          {!isUncategorized && (
            <Tooltip content="Rename folder" position="top">
              <button
                onClick={(e) => { e.stopPropagation(); setIsRenaming(true) }}
                className="p-0.5 shrink-0 text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </Tooltip>
          )}

          {/* Delete button */}
          {!isUncategorized && (
            <Tooltip content="Delete folder" position="top">
              <button
                onClick={(e) => { e.stopPropagation(); onRequestDelete(node.id, node.name) }}
                className="p-0.5 shrink-0 text-[var(--text-secondary)] hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Children in edit mode — always shown expanded */}
        {node.children.map(child => (
          <FolderRowItem
            key={child.id}
            node={child}
            isEditing={isEditing}
            selected={selected}
            depth={depth + 1}
            isExpanded={false}
            activeDragId={activeDragId}
            activeDragDepth={activeDragDepth}
            dropTargetId={dropTargetId}
            dropIntent={dropIntent}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onRequestDelete={onRequestDelete}
            onRequestCreate={onRequestCreate}
            onRenameFolder={onRenameFolder}
          />
        ))}
      </div>
    )
  }

  // ── Normal (view) mode ──────────────────────────────────────────────────────

  // Build border/bg highlight for drop target
  let dropHighlightStyle: React.CSSProperties = {}
  let dropHighlightClass = ''
  if (isDropTarget) {
    if (dropIntent === 'before') {
      dropHighlightClass = 'border-t-[2px] border-t-[var(--accent-primary)]'
    } else if (dropIntent === 'after') {
      dropHighlightClass = 'border-b-[2px] border-b-[var(--accent-primary)]'
    } else if (dropIntent === 'into') {
      dropHighlightStyle = { background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)', outline: '1px solid var(--accent-primary)', outlineOffset: '-1px', borderRadius: '6px' }
    }
  }

  if (isCollapsed) {
    if (depth > 0) return null
    return (
      <div ref={setNodeRef} style={style}>
        <Tooltip content={`${node.name} (${deckCount})`} position="left" className="w-full">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={`relative min-w-0 flex items-center justify-center w-full h-9 rounded-md cursor-pointer group transition-all duration-200 ${isSelected
                ? 'bg-gradient-to-r from-transparent to-[#00FF41]/10 text-white'
                : 'bg-transparent text-gray-400 hover:bg-border-base hover:text-white'
              }`}
            onClick={() => onSelect(node.id)}
          >
            {isSelected && (
              <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent shadow-[0_0_10px_#00FF41]" />
            )}
            <FolderIcon
              size={16}
              className={`shrink-0 ${isSelected ? 'text-accent' : 'text-gray-400 group-hover:text-white transition-colors'}`}
            />
          </motion.div>
        </Tooltip>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style}>
      <motion.div
        whileHover={{ scale: 1.005 }}
        className={`relative min-w-0 flex items-center w-full gap-1.5 py-2 rounded-md cursor-pointer group transition-all duration-200 ${isSelected
            ? 'bg-gradient-to-r from-transparent to-[#00FF41]/10 text-white'
            : 'bg-transparent text-gray-400 hover:bg-border-base hover:text-white'
          } ${dropHighlightClass}`}
        style={{ paddingLeft: `${10 + indent}px`, paddingRight: '8px', ...dropHighlightStyle }}
        onClick={() => {
          onSelect(node.id)
          if (hasChildren && !isExpanded) onToggleExpand(node.id)
        }}
      >
        {isSelected && (
          <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent shadow-[0_0_10px_#00FF41]" />
        )}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id) }}
            className="shrink-0 p-0.5 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight
              size={11}
              className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}

        <FolderIcon
          size={14}
          className={`shrink-0 ${isSelected ? 'text-accent' : 'text-gray-400 group-hover:text-white transition-colors'}`}
        />

        <Tooltip content={node.name} position="bottom" className="flex-1 min-w-0">
          <span
            className={`text-sm truncate w-full flex-1 font-['Rajdhani'] font-medium tracking-wide ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-white'
              }`}
          >
            {node.name}
          </span>
        </Tooltip>

        <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[#111] text-gray-400 font-['IBM_Plex_Mono'] border border-[#333]">
          {deckCount}
        </span>

        {/* Nest-into indicator label */}
        {isDropTarget && dropIntent === 'into' && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-['Rajdhani'] uppercase tracking-wider text-accent bg-accent/10 border border-accent/30 px-1.5 py-0.5 rounded whitespace-nowrap">
            Nest inside
          </span>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {node.children.map(child => (
              <FolderRowItem
                key={child.id}
                node={child}
                isEditing={false}
                isCollapsed={isCollapsed}
                selected={selected}
                depth={depth + 1}
                isExpanded={false}
                activeDragId={activeDragId}
                activeDragDepth={activeDragDepth}
                dropTargetId={dropTargetId}
                dropIntent={dropIntent}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
                onRequestDelete={onRequestDelete}
                onRequestCreate={onRequestCreate}
                onRenameFolder={onRenameFolder}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy flat-string mode
// ─────────────────────────────────────────────────────────────────────────────

const LegacySortableItem: React.FC<{
  folder: string
  isEditing: boolean
  isSelected: boolean
  deckCount: number
  isCollapsed?: boolean
  onSelect: (f: string | 'all') => void
  onRequestDelete: (f: string) => void
}> = ({ folder, isEditing, isSelected, deckCount, isCollapsed, onSelect, onRequestDelete }) => {
  const isUncategorized = folder === 'Uncategorized'
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folder,
    disabled: isUncategorized,
  })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  if (isCollapsed) {
    return (
      <div ref={setNodeRef} style={style}>
        <Tooltip content={`${folder} (${deckCount})`} position="left" className="w-full">
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => onSelect(folder)}
            className={`relative min-w-0 flex items-center justify-center w-full h-9 rounded-md transition-all duration-200 group ${isSelected
                ? 'bg-gradient-to-r from-transparent to-[#00FF41]/10 text-white'
                : 'bg-transparent text-gray-400 hover:bg-border-base hover:text-white'
              }`}
          >
            {isSelected && (
              <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent shadow-[0_0_10px_#00FF41]" />
            )}
            <Folder size={16} className={`shrink-0 ${isSelected ? 'text-accent' : 'text-gray-400 group-hover:text-white transition-colors'}`} />
          </motion.button>
        </Tooltip>
      </div>
    )
  }

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style}>
        <div className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm border border-transparent hover:bg-slate-800/50">
          {isUncategorized ? <div className="w-5" /> : (
            <div {...attributes} {...listeners} className="p-1 shrink-0 cursor-grab active:cursor-grabbing text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors">
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <span className="flex-1 text-[13px] font-bold font-['Rajdhani'] uppercase tracking-wider text-[var(--text-secondary)] truncate">{folder}</span>
          {!isUncategorized && (
            <button onClick={(e) => { e.stopPropagation(); onRequestDelete(folder) }} className="p-0.5 shrink-0 text-[var(--text-primary)] hover:text-red-400 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Tooltip content={folder} position="bottom" className="w-full">
        <motion.button
          whileHover={{ scale: 1.01 }}
          onClick={() => onSelect(folder)}
          className={`min-w-0 flex items-center justify-between w-full gap-2 px-3 py-2 rounded-md transition-all duration-200 group relative whitespace-nowrap ${isSelected
              ? 'bg-gradient-to-r from-transparent to-[#00FF41]/10 text-white'
              : 'bg-transparent text-gray-400 hover:bg-border-base hover:text-white'
            }`}
        >
          {isSelected && (
            <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent shadow-[0_0_10px_#00FF41]" />
          )}
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <Folder size={14} className={`shrink-0 ${isSelected ? 'text-accent' : 'text-gray-400 group-hover:text-white transition-colors'}`} />
            <span className={`text-sm truncate font-['Rajdhani'] font-medium tracking-wide ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
              {folder}
            </span>
          </div>
          <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[#111] text-gray-400 font-['IBM_Plex_Mono'] border border-[#333]">
            {deckCount}
          </span>
        </motion.button>
      </Tooltip>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create folder inline input
// ─────────────────────────────────────────────────────────────────────────────

const CreateFolderInput: React.FC<{
  parentId: string | null
  onConfirm: (name: string, parentId: string | null) => void
  onCancel: () => void
}> = ({ parentId, onConfirm, onCancel }) => {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [])

  const confirm = () => {
    const trimmed = name.trim()
    if (trimmed) onConfirm(trimmed, parentId)
    else onCancel()
  }

  return (
    <div
      className="flex items-center gap-1.5 py-1.5 rounded-md border border-accent/40 bg-[#111] my-0.5"
      style={{ paddingLeft: parentId ? '24px' : '10px', paddingRight: '8px' }}
    >
      <Folder size={13} className="shrink-0 text-accent" />
      <input
        ref={inputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') confirm()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Folder name…"
        className="flex-1 bg-transparent text-sm font-medium font-['Rajdhani'] tracking-wide text-white outline-none placeholder:text-gray-500 placeholder:normal-case placeholder:tracking-normal placeholder:font-normal min-w-0"
      />
      <button onClick={confirm} className="text-accent hover:opacity-70 transition-opacity p-0.5 shrink-0">
        <Check size={12} />
      </button>
      <button onClick={onCancel} className="text-gray-400 hover:text-red-400 transition-colors p-0.5 shrink-0">
        <X size={12} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TopLevelDropZone
// ─────────────────────────────────────────────────────────────────────────────

const TopLevelDropZone: React.FC<{ isOver: boolean }> = ({ isOver }) => {
  const { setNodeRef } = useDroppable({ id: TOP_LEVEL_DROP_ID })
  return (
    <div
      ref={setNodeRef}
      className={`mx-1 my-1 h-6 rounded border-dashed border transition-colors flex items-center justify-center text-[9px] font-['Rajdhani'] uppercase tracking-wider ${isOver
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
          : 'border-[var(--bg-elevated)] text-[var(--text-secondary)]/40'
        }`}
    >
      Drop to top level
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FolderPanelFooter (Dolphin-inspired Status Bar)
// ─────────────────────────────────────────────────────────────────────────────

interface FolderPanelFooterProps {
  totalDeckCount: number
  displayedCount: number
  selected: string | 'all'
  folderDisplayName: string
  folderDeckCount?: number
  activeSubject?: string
  searchQuery?: string
  filterType?: string
  filterTags?: string[]
  isCollapsed: boolean
}

const FolderPanelFooter: React.FC<FolderPanelFooterProps> = ({
  totalDeckCount,
  displayedCount,
  selected,
  folderDisplayName,
  folderDeckCount,
  activeSubject,
  searchQuery,
  filterType,
  filterTags,
  isCollapsed,
}) => {
  const filterParts: string[] = []

  if (activeSubject && activeSubject !== 'ALL') {
    filterParts.push(activeSubject)
  }
  if (selected !== 'all') {
    filterParts.push(folderDisplayName)
  }
  if (searchQuery && searchQuery.trim()) {
    filterParts.push(`"${searchQuery.trim()}"`)
  }
  if (filterType && filterType !== 'all' && filterType !== 'flashcard' && filterType !== 'formula') {
    filterParts.push(filterType.toUpperCase())
  }
  if (filterTags && filterTags.length > 0) {
    filterParts.push(filterTags.join(', '))
  }

  const hasFilters = filterParts.length > 0
  const filterSummaryText = hasFilters ? filterParts.join(' • ') : 'All Decks'

  const tooltipBreakdownNode = (
    <div className="flex flex-col gap-2 text-left min-w-[200px] max-w-[280px] p-1 select-none">
      <div className="flex items-center justify-between border-b border-[#00FF41]/30 pb-1.5">
        <span className="text-[#00FF41] text-[11px] font-['Rajdhani'] font-bold tracking-widest uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse shrink-0" />
          {displayedCount} {displayedCount === 1 ? 'Deck' : 'Decks'} Displayed
        </span>
        <span className="text-gray-400 text-[10px] font-['IBM_Plex_Mono']">
          {totalDeckCount} Total
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-[11px] font-['Rajdhani']">
        <div className="flex items-center justify-between text-gray-300">
          <span className="text-gray-400 font-medium">Subject:</span>
          <span className={activeSubject && activeSubject !== 'ALL' ? 'text-[#00FF41] font-bold' : 'text-gray-400'}>
            {activeSubject || 'ALL'}
          </span>
        </div>

        <div className="flex items-center justify-between text-gray-300">
          <span className="text-gray-400 font-medium">Folder:</span>
          <span className={selected !== 'all' ? 'text-[#00FF41] font-bold truncate max-w-[140px]' : 'text-gray-400'}>
            {folderDisplayName} {folderDeckCount !== undefined ? `(${folderDeckCount})` : ''}
          </span>
        </div>

        {searchQuery && searchQuery.trim() && (
          <div className="flex items-center justify-between text-gray-300">
            <span className="text-gray-400 font-medium">Search:</span>
            <span className="text-[#00FF41] font-bold truncate max-w-[140px]">"{searchQuery.trim()}"</span>
          </div>
        )}

        {filterType && filterType !== 'all' && (
          <div className="flex items-center justify-between text-gray-300">
            <span className="text-gray-400 font-medium">Type:</span>
            <span className="text-[#00FF41] font-bold uppercase">{filterType}</span>
          </div>
        )}

        {filterTags && filterTags.length > 0 && (
          <div className="flex items-center justify-between text-gray-300">
            <span className="text-gray-400 font-medium">Tags:</span>
            <span className="text-[#00FF41] font-bold truncate max-w-[140px]">{filterTags.join(', ')}</span>
          </div>
        )}
      </div>

      <div className="pt-1.5 border-t border-[#333] text-[9px] font-['IBM_Plex_Mono'] text-gray-400 leading-tight">
        {hasFilters
          ? `${displayedCount} of ${totalDeckCount} decks match active filters`
          : `Showing all ${totalDeckCount} decks without filter restrictions`}
      </div>
    </div>
  )

  if (isCollapsed) {
    return (
      <div className="mt-auto shrink-0 border-t border-border-base bg-[#0A0A0A] p-2 flex justify-center items-center select-none">
        <Tooltip content={tooltipBreakdownNode} position="left">
          <div className="flex flex-col items-center justify-center w-8 h-8 rounded bg-[#111] border border-border-base text-accent font-['IBM_Plex_Mono'] font-bold text-[10px] cursor-help hover:border-accent hover:bg-accent/10 transition-all shadow-sm">
            {displayedCount}
          </div>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="mt-auto shrink-0 border-t border-border-base bg-[#0A0A0A] px-3 py-2.5 flex flex-col gap-1 select-none">
      <Tooltip content={tooltipBreakdownNode} position="left" className="w-full">
        <div className="flex flex-col gap-0.5 w-full cursor-help group p-1 -m-1 rounded hover:bg-border-base/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="font-['Rajdhani'] font-bold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_#00FF41] shrink-0" />
              <span className="truncate">{displayedCount} {displayedCount === 1 ? 'Deck' : 'Decks'}</span>
            </span>
            {displayedCount !== totalDeckCount && (
              <span className="text-[10px] font-['IBM_Plex_Mono'] text-gray-400 shrink-0">
                ({totalDeckCount} Total)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] font-['Rajdhani'] text-gray-400 truncate">
            {hasFilters ? (
              <>
                <span className="text-gray-500 shrink-0 font-medium">Filter:</span>
                <span className="text-accent font-semibold truncate group-hover:underline">
                  {filterSummaryText}
                </span>
              </>
            ) : (
              <span className="text-gray-500">All decks shown</span>
            )}
          </div>
        </div>
      </Tooltip>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main FolderPanel
// ─────────────────────────────────────────────────────────────────────────────

const FolderPanel: React.FC<FolderPanelProps> = ({
  folderRows,
  folders: legacyFolders,
  deckCountByFolder,
  totalDeckCount,
  displayedDeckCount,
  activeSubject,
  searchQuery,
  filterType,
  filterTags,
  selected,
  onSelect,
  onDeleteFolder,
  onReorderFolders,
  onCreateFolder,
  onPromoteFolder,
  onNestFolder,
  onRenameFolder,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() =>
    localStorage.getItem('ecengine:folder-sidebar-collapsed') === 'true'
  )

  const toggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem('ecengine:folder-sidebar-collapsed', String(next))
  }

  const toggleEdit = () => {
    if (!isEditing && isCollapsed) {
      setIsCollapsed(false)
      localStorage.setItem('ecengine:folder-sidebar-collapsed', 'false')
    }
    setIsEditing(e => !e)
    setCreatingUnder(undefined)
  }

  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [creatingUnder, setCreatingUnder] = useState<string | null | undefined>(undefined)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragDepth, setActiveDragDepth] = useState<number | null>(null)
  // Position-based drop state
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null)
  const [overTopLevel, setOverTopLevel] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleError = (err: any) => {
    setErrorMsg(err.message)
    setTimeout(() => setErrorMsg(null), 4000)
  }

  countMap = deckCountByFolder

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── Tree mode ──────────────────────────────────────────────────────────────

  if (folderRows && folderRows.length >= 0) {
    const { roots, uncategorized } = buildTree(folderRows)
    const rootIds = roots.map(r => r.id)
    // Flat list of all non-uncategorized ids for SortableContext (depth-first)
    const allSortableIds = flattenIds(roots)

    const activeDragNode = activeDragId ? folderRows.find(r => r.id === activeDragId) : null

    const handleDragStart = (e: DragStartEvent) => {
      const id = e.active.id as string
      setActiveDragId(id)
      setDropTargetId(null)
      setDropIntent(null)
      setOverTopLevel(false)
      const node = folderRows.find(r => r.id === id)
      setActiveDragDepth(node?.parent_id ? 1 : 0)
    }

    const handleDragOver = (e: DragOverEvent) => {
      // computeDropInfo for the visual highlight state only.
      // handleDragEnd recomputes fresh — never reads this state for its action.
      const { targetId, intent, isTopLevel } = computeDropInfo(
        e.active as any, e.over as any, folderRows
      )
      console.log('[DEBUG] DRAG_OVER -> over?.id:', e.over?.id, '| compute:', { targetId, intent, isTopLevel }, '| overNode.parent_id:', folderRows.find(r => r.id === e.over?.id)?.parent_id)
      setOverTopLevel(isTopLevel)
      setDropTargetId(targetId)
      setDropIntent(intent)
    }

    const handleDragEnd = (e: DragEndEvent) => {
      const { active, over } = e
      const activeId = active.id as string

      console.log('[DEBUG] DRAG_END -> over?.id:', over?.id, '| activeId:', activeId)

      // ── Clear all visual highlight state first ────────────────────────────
      setActiveDragId(null)
      setActiveDragDepth(null)
      setDropTargetId(null)
      setDropIntent(null)
      setOverTopLevel(false)

      if (!over) {
        console.log('[DEBUG] DRAG_END -> BAIL: !over')
        return
      }
      const overId = over.id as string

      // Dropped on TOP_LEVEL_DROP_ID → promote to root
      if (overId === TOP_LEVEL_DROP_ID) {
        console.log('[DEBUG] DRAG_END -> PROMOTING to root')
        onPromoteFolder?.(activeId).catch(handleError)
        return
      }

      // ── Recompute intent FRESH from the event — never from React state ────
      // State written by onDragOver may not have committed by the time
      // onDragEnd fires (async batching), so reading dropTargetId/dropIntent
      // state here would often return stale null values and silently bail.
      const { targetId, intent } = computeDropInfo(
        active as any, over as any, folderRows
      )
      console.log('[DEBUG] DRAG_END -> computeDropInfo:', { targetId, intent }, '| overNode.parent_id:', folderRows.find(r => r.id === overId)?.parent_id)
      
      if (!targetId) {
        console.log('[DEBUG] DRAG_END -> BAIL: !targetId (computeDropInfo returned null)')
        return
      }

      const activeIsSubfolder =
        activeDragDepth === 1 ||
        (folderRows.find(r => r.id === activeId)?.parent_id !== null)

      if (activeIsSubfolder) {
        // Subfolders always reparent to the target root folder
        onNestFolder?.(activeId, targetId).catch(handleError)
        setExpandedIds(prev => new Set([...prev, targetId]))
        return
      }

      // Active is a root folder
      if (intent === 'into') {
        if (targetId !== activeId) {
          onNestFolder?.(activeId, targetId).catch(handleError)
          setExpandedIds(prev => new Set([...prev, targetId]))
        }
      } else {
        // Reorder: before → insert at newIdx, after → insert at newIdx + 1
        const oldIdx = rootIds.indexOf(activeId)
        const newIdx = rootIds.indexOf(targetId)
        if (oldIdx === -1 || newIdx === -1) return
        // arrayMove removes the item from oldIdx then inserts at targetIdx.
        // For 'after': the insertion point is newIdx + 1, but we must account
        // for the removal of the active item shifting indices when oldIdx < newIdx.
        const insertAt = intent === 'after'
          ? (oldIdx < newIdx ? newIdx : newIdx + 1)
          : (oldIdx < newIdx ? Math.max(0, newIdx - 1) : newIdx)
        const reordered = arrayMove(rootIds, oldIdx, insertAt)
        onReorderFolders?.(reordered)
      }
    }

    const selectedTreeNode = findTreeNode(roots, selected)
    const selectedFolderRow = folderRows.find(f => f.id === selected)
    const folderDisplayName = selected === 'all'
      ? 'All Folders'
      : selected === 'Uncategorized' || (uncategorized && selected === uncategorized.id)
        ? 'Uncategorized'
        : selectedTreeNode?.name || selectedFolderRow?.name || selected
    const folderDeckCount = selected === 'all'
      ? totalDeckCount
      : selected === 'Uncategorized' || (uncategorized && selected === uncategorized.id)
        ? (deckCountByFolder[uncategorized?.id || 'Uncategorized'] ?? 0)
        : selectedTreeNode
      ? subtreeCount(selectedTreeNode, deckCountByFolder)
      : (deckCountByFolder[selected] ?? 0)

    const finalDisplayedCount = displayedDeckCount !== undefined
      ? displayedDeckCount
      : (selected === 'all' ? totalDeckCount : folderDeckCount)

    return (
      <div className={`relative flex-shrink-0 ${isEditing ? 'w-[320px]' : isCollapsed ? 'w-[52px]' : 'w-[200px]'} h-full z-40 transition-all duration-200`}>
        <motion.div
          initial={false}
          animate={{ width: isEditing ? 320 : isCollapsed ? 52 : 200 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className={`absolute top-0 right-0 h-full bg-surface overflow-hidden flex flex-col border-l border-border-base ${
            isEditing ? 'z-40 shadow-2xl shadow-black/50 border-l-2 border-l-border-base' : 'z-0'
          }`}
        >
          <div className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-stretch gap-0 w-full py-4 ${isCollapsed ? 'px-1' : 'px-2'}`}>

          {/* Header */}
          {isCollapsed ? (
            <div className="flex justify-center items-center mb-3">
              <Tooltip content="Expand Folders" position="bottom">
                <button
                  onClick={toggleCollapse}
                  className="text-gray-400 hover:text-accent hover:bg-border-base transition-colors p-1.5 rounded"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                </button>
              </Tooltip>
            </div>
          ) : (
            <div className="flex justify-between items-center mb-3 px-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Tooltip content="Collapse Folders" position="bottom">
                  <button
                    onClick={toggleCollapse}
                    className="text-gray-400 hover:text-accent hover:bg-border-base transition-colors p-1 rounded"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="15" y1="3" x2="15" y2="21" />
                    </svg>
                  </button>
                </Tooltip>
                <h2 className="text-gray-400 text-xs uppercase tracking-[0.15em] font-bold font-['Rajdhani']">FOLDERS</h2>
              </div>
              <div className="flex items-center gap-0.5">
                {!isEditing && (
                  <Tooltip content="New folder" position="bottom">
                    <button
                      onClick={() => setCreatingUnder(null)}
                      className="text-gray-400 hover:text-accent hover:bg-border-base transition-colors p-1 rounded"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                )}
                <Tooltip content={isEditing ? 'Done' : 'Edit folders'} position="bottom">
                  <button
                    onClick={toggleEdit}
                    className="text-gray-400 hover:text-accent hover:bg-border-base transition-colors p-1 rounded"
                  >
                    {isEditing
                      ? <Check className="w-3.5 h-3.5 text-white" />
                      : <Pencil className="w-3.5 h-3.5 text-white" />
                    }
                  </button>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Error Banner */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-2 px-1"
              >
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] px-2 py-1.5 rounded-md flex items-start gap-1.5">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  <span className="leading-tight">{errorMsg}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* All row */}
          <Tooltip content={`All (${totalDeckCount})`} position="left" className="w-full">
            <motion.button
              whileHover={{ scale: 1.01 }}
              onClick={() => onSelect('all')}
              className={`min-w-0 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-3'} w-full h-9 rounded-md transition-all duration-200 group relative whitespace-nowrap ${selected === 'all'
                  ? 'bg-gradient-to-r from-transparent to-[#00FF41]/10 text-white'
                  : 'bg-transparent text-gray-400 hover:bg-border-base hover:text-white'
                }`}
            >
              {selected === 'all' && (
                <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent shadow-[0_0_10px_#00FF41]" />
              )}
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2 flex-1 min-w-0'}`}>
                <LayoutGrid size={14} className={`shrink-0 ${selected === 'all' ? 'text-accent' : 'text-gray-400 group-hover:text-white transition-colors'}`} />
                {!isCollapsed && (
                  <span className={`text-sm truncate font-['Rajdhani'] font-medium tracking-wide ${selected === 'all' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>All</span>
                )}
              </div>
              {!isCollapsed && (
                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[#111] text-gray-400 font-['IBM_Plex_Mono'] border border-[#333]">{totalDeckCount}</span>
              )}
            </motion.button>
          </Tooltip>

          {/* Root-level create input */}
          {!isCollapsed && creatingUnder === null && (
            <CreateFolderInput
              parentId={null}
              onConfirm={(name, parentId) => { onCreateFolder?.(name, parentId); setCreatingUnder(undefined) }}
              onCancel={() => setCreatingUnder(undefined)}
            />
          )}

          {/* DndContext wraps entire tree */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {/* Flat SortableContext: all root + subfolder ids so dnd-kit knows about them */}
            <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-0.5 mt-0.5">

                {/* Top-level drop zone — only visible while dragging */}
                {activeDragId && (
                  <TopLevelDropZone isOver={overTopLevel} />
                )}

                {roots.map(node => (
                  <React.Fragment key={node.id}>
                    <FolderRowItem
                      node={node}
                      isEditing={isEditing}
                      isCollapsed={isCollapsed}
                      selected={selected}
                      depth={0}
                      isExpanded={expandedIds.has(node.id)}
                      activeDragId={activeDragId}
                      activeDragDepth={activeDragDepth}
                      dropTargetId={dropTargetId}
                      dropIntent={dropIntent}
                      onSelect={onSelect}
                      onToggleExpand={toggleExpand}
                      onRequestDelete={(id, name) => setFolderToDelete({ id, name })}
                      onRequestCreate={(parentId) => setCreatingUnder(parentId)}
                      onRenameFolder={onRenameFolder}
                    />
                    {/* Subfolder create input — indented under its parent */}
                    {!isCollapsed && creatingUnder === node.id && (
                      <CreateFolderInput
                        parentId={node.id}
                        onConfirm={(name, parentId) => { onCreateFolder?.(name, parentId); setCreatingUnder(undefined) }}
                        onCancel={() => setCreatingUnder(undefined)}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </SortableContext>

            {/* DragOverlay for visual preview during drag */}
            <DragOverlay>
              {activeDragNode && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface/90 border border-accent/60 shadow-xl text-white text-sm font-['Rajdhani'] font-medium uppercase tracking-wider backdrop-blur-sm pointer-events-none opacity-90">
                  <Folder size={12} className="text-accent" />
                  {activeDragNode.name}
                </div>
              )}
            </DragOverlay>
          </DndContext>

          {/* Uncategorized — always pinned last, never in DndContext */}
          {uncategorized && !isEditing && (
            isCollapsed ? (
              <Tooltip content={`Uncategorized (${deckCountByFolder[uncategorized.id] ?? deckCountByFolder['Uncategorized'] ?? 0})`} position="left" className="w-full">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => onSelect(uncategorized!.id)}
                  className={`relative min-w-0 flex items-center justify-center w-full h-9 rounded-md transition-all duration-200 group mt-0.5 ${selected === uncategorized.id
                      ? 'bg-gradient-to-r from-transparent to-[#00FF41]/10 text-white'
                      : 'bg-transparent text-gray-400 hover:bg-border-base hover:text-white'
                    }`}
                >
                  {selected === uncategorized.id && (
                    <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent shadow-[0_0_10px_#00FF41]" />
                  )}
                  <Folder size={16} className={`shrink-0 ${selected === uncategorized.id ? 'text-accent' : 'text-gray-400 group-hover:text-white transition-colors'}`} />
                </motion.button>
              </Tooltip>
            ) : (
              <motion.button
                whileHover={{ scale: 1.01 }}
                onClick={() => onSelect(uncategorized!.id)}
                className={`min-w-0 flex items-center justify-between w-full gap-2 px-3 py-2 rounded-md transition-all duration-200 group mt-0.5 relative whitespace-nowrap ${selected === uncategorized.id
                    ? 'bg-gradient-to-r from-transparent to-[#00FF41]/10 text-white'
                    : 'bg-transparent text-gray-400 hover:bg-border-base hover:text-white'
                  }`}
              >
                {selected === uncategorized.id && (
                  <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent shadow-[0_0_10px_#00FF41]" />
                )}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Folder size={14} className={`shrink-0 ${selected === uncategorized.id ? 'text-accent' : 'text-gray-400 group-hover:text-white transition-colors'}`} />
                  <span className={`text-sm truncate font-['Rajdhani'] font-medium tracking-wide ${selected === uncategorized.id ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                    Uncategorized
                  </span>
                </div>
                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[#111] text-gray-400 font-['IBM_Plex_Mono'] border border-[#333]">
                  {deckCountByFolder[uncategorized.id] ?? deckCountByFolder['Uncategorized'] ?? 0}
                </span>
              </motion.button>
            )
          )}

          </div>

          {/* Footer Status Bar */}
          <FolderPanelFooter
            totalDeckCount={totalDeckCount}
            displayedCount={finalDisplayedCount}
            selected={selected}
            folderDisplayName={folderDisplayName}
            folderDeckCount={folderDeckCount}
            activeSubject={activeSubject}
            searchQuery={searchQuery}
            filterType={filterType}
            filterTags={filterTags}
            isCollapsed={isCollapsed}
          />

          <DeleteConfirmModal
            target={folderToDelete}
            onConfirm={() => { if (folderToDelete) { onDeleteFolder?.(folderToDelete.id); setFolderToDelete(null) } }}
            onCancel={() => setFolderToDelete(null)}
          />
        </motion.div>
      </div>
    )
  }

  // ── Legacy flat-string mode ────────────────────────────────────────────────

  const legacy = legacyFolders ?? []
  const sortable = legacy.filter(f => f !== 'Uncategorized')

  const handleLegacyDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = sortable.indexOf(active.id as string)
    const newIdx = sortable.indexOf(over.id as string)
    const reordered = arrayMove(sortable, oldIdx, newIdx)
    onReorderFolders?.([...reordered, 'Uncategorized'])
  }

  const folderDisplayName = selected === 'all' ? 'All Folders' : selected
  const folderDeckCount = selected === 'all' ? totalDeckCount : (deckCountByFolder[selected] ?? 0)
  const finalDisplayedCount = displayedDeckCount !== undefined
    ? displayedDeckCount
    : (selected === 'all' ? totalDeckCount : folderDeckCount)

  return (
    <div className={`relative flex-shrink-0 ${isEditing ? 'w-[320px]' : isCollapsed ? 'w-[52px]' : 'w-[200px]'} h-full z-40 transition-all duration-200`}>
      <motion.div
        initial={false}
        animate={{ width: isEditing ? 320 : isCollapsed ? 52 : 200 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={`absolute top-0 right-0 h-full bg-surface overflow-hidden flex flex-col border-l border-border-base ${
          isEditing ? 'z-40 shadow-2xl shadow-black/50 border-l-2 border-l-border-base' : 'z-0'
        }`}
      >
        <div className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-stretch gap-0 w-full py-4 ${isCollapsed ? 'px-1' : 'px-2'}`}>
        {isCollapsed ? (
          <div className="flex justify-center items-center mb-3">
            <Tooltip content="Expand Folders" position="bottom">
              <button
                onClick={toggleCollapse}
                className="text-gray-400 hover:text-accent hover:bg-border-base transition-colors p-1.5 rounded"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="flex justify-between items-center mb-4 px-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Tooltip content="Collapse Folders" position="bottom">
                <button
                  onClick={toggleCollapse}
                  className="text-gray-400 hover:text-accent hover:bg-border-base transition-colors p-1 rounded"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                </button>
              </Tooltip>
              <h2 className="text-gray-400 text-xs uppercase tracking-[0.15em] font-bold font-['Rajdhani']">FOLDERS</h2>
            </div>
            <div className="flex items-center gap-0.5">
              <Tooltip content={isEditing ? 'Done' : 'Edit folders'} position="bottom">
                <button
                  onClick={toggleEdit}
                  className="text-gray-400 hover:text-accent hover:bg-border-base transition-colors p-1 rounded"
                >
                  {isEditing ? <Check className="w-3.5 h-3.5 text-white" /> : <Pencil className="w-3.5 h-3.5 text-white" />}
                </button>
              </Tooltip>
            </div>
          </div>
        )}

        <motion.div className="flex flex-col gap-1">
          <Tooltip content={`All (${totalDeckCount})`} position="left" className="w-full">
            <motion.button
              whileHover={{ scale: 1.01 }}
              onClick={() => onSelect('all')}
              className={`min-w-0 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-3'} w-full h-9 rounded-md transition-all duration-200 group relative whitespace-nowrap ${selected === 'all'
                  ? 'bg-gradient-to-r from-transparent to-[#00FF41]/10 text-white'
                  : 'bg-transparent text-gray-400 hover:bg-border-base hover:text-white'
                }`}
            >
              {selected === 'all' && (
                <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent shadow-[0_0_10px_#00FF41]" />
              )}
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2 flex-1 min-w-0'}`}>
                <LayoutGrid size={14} className={`shrink-0 ${selected === 'all' ? 'text-accent' : 'text-gray-400 group-hover:text-white transition-colors'}`} />
                {!isCollapsed && (
                  <span className={`text-sm truncate font-['Rajdhani'] font-medium tracking-wide ${selected === 'all' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>All</span>
                )}
              </div>
              {!isCollapsed && (
                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[#111] text-gray-400 font-['IBM_Plex_Mono'] border border-[#333]">{totalDeckCount}</span>
              )}
            </motion.button>
          </Tooltip>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLegacyDragEnd}>
            <SortableContext items={sortable} strategy={verticalListSortingStrategy}>
              {sortable.map(f => (
                <LegacySortableItem
                  key={f}
                  folder={f}
                  isEditing={isEditing}
                  isCollapsed={isCollapsed}
                  isSelected={selected === f}
                  deckCount={deckCountByFolder[f] ?? 0}
                  onSelect={onSelect}
                  onRequestDelete={(name) => setFolderToDelete({ id: name, name })}
                />
              ))}
            </SortableContext>
          </DndContext>

          {!isEditing && legacy.includes('Uncategorized') && (
            <LegacySortableItem
              folder="Uncategorized"
              isEditing={false}
              isCollapsed={isCollapsed}
              isSelected={selected === 'Uncategorized'}
              deckCount={deckCountByFolder['Uncategorized'] ?? 0}
              onSelect={onSelect}
              onRequestDelete={(name) => setFolderToDelete({ id: name, name })}
            />
          )}
        </motion.div>
        </div>

        {/* Footer Status Bar */}
        <FolderPanelFooter
          totalDeckCount={totalDeckCount}
          displayedCount={finalDisplayedCount}
          selected={selected}
          folderDisplayName={folderDisplayName}
          folderDeckCount={folderDeckCount}
          activeSubject={activeSubject}
          searchQuery={searchQuery}
          filterType={filterType}
          filterTags={filterTags}
          isCollapsed={isCollapsed}
        />

        <DeleteConfirmModal
          target={folderToDelete}
          onConfirm={() => { if (folderToDelete) { onDeleteFolder?.(folderToDelete.id); setFolderToDelete(null) } }}
          onCancel={() => setFolderToDelete(null)}
        />
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete confirm modal
// ─────────────────────────────────────────────────────────────────────────────

const DeleteConfirmModal: React.FC<{
  target: { id: string; name: string } | null
  onConfirm: () => void
  onCancel: () => void
}> = ({ target, onConfirm, onCancel }) => (
  <AnimatePresence>
    {target && (
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onCancel}
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
            <div className="w-16 h-16 rounded-full bg-[#FF003C]/10 border border-[#FF003C]/30 flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-[#FF003C]" />
            </div>
            <h3 className="text-2xl font-['Orbitron'] font-bold text-white mb-4 tracking-widest uppercase">DELETE FOLDER?</h3>
            <p className="text-text-muted font-['IBM_Plex_Mono'] mb-8 leading-relaxed">
              Delete <strong className="text-white">{target.name}</strong>?{' '}
              Decks inside will be moved to Uncategorized. Subfolders will be promoted to top level.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button onClick={onConfirm} className="w-full py-4 bg-[#FF003C] hover:bg-[#D00030] text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all">
                CONFIRM DELETE
              </button>
              <button onClick={onCancel} className="w-full py-4 bg-surface border border-[#333] hover:border-[#555] text-text-muted hover:text-white rounded font-['Rajdhani'] font-bold uppercase tracking-widest transition-all">
                CANCEL
              </button>
            </div>
          </div>
          <button onClick={onCancel} className="absolute top-4 right-4 text-[#444] hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
)

export default FolderPanel