import React, { useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { GripVertical, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MCQEdit, FormulaEdit, FlashcardEdit, MCQForm, FlashcardForm, FormulaForm } from './CardForms'

export interface EditCard {
  id: string
  type: 'mcq' | 'flashcard' | 'formula'
  data: MCQEdit | FlashcardEdit | FormulaEdit
  isNew?: boolean
}

interface CardRowProps {
  card: EditCard
  index: number
  onUpdate: (id: string, data: Partial<EditCard>) => void
  onDelete: (id: string) => void
  onError?: (msg: string) => void
}

export const CardRow: React.FC<CardRowProps & { dragHandleProps?: React.HTMLAttributes<HTMLElement> }> = ({ card, index, onUpdate, onDelete, onError, dragHandleProps }) => {
  const [expanded, setExpanded] = useState(card.isNew ?? false)

  const preview = card.type === 'mcq'
    ? (card.data as MCQEdit).question || '(empty question)'
    : card.type === 'formula'
      ? (card.data as FormulaEdit).name || '(empty formula)'
      : (card.data as FlashcardEdit).front || '(empty term)'

  const truncated = preview.length > 72 ? preview.slice(0, 72) + '…' : preview

  return (
    <div
      className={`rounded-lg border transition-colors ${expanded ? 'border-accent/30 bg-[#0f1a0f]' : 'border-border-base bg-[#111] hover:border-[#333]'}`}
    >
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Grip handle — only this triggers drag */}
        <span
          {...dragHandleProps}
          onClick={e => e.stopPropagation()}
          className="text-[#444] hover:text-text-muted cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <span className="text-[#555] font-['IBM_Plex_Mono'] text-xs w-6 flex-shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="flex-1 text-[#ccc] font-['IBM_Plex_Mono'] text-sm truncate">{truncated}</span>
        <span className={`text-[10px] font-['IBM_Plex_Mono'] font-bold px-2 py-0.5 rounded border uppercase flex-shrink-0 ${card.type === 'mcq'
          ? 'text-[#00BFFF] border-[#00BFFF]/30 bg-[#00BFFF]/10'
          : card.type === 'formula'
            ? 'text-[#A855F7] border-[#A855F7]/30 bg-[#A855F7]/10'
            : 'text-accent border-accent/30 bg-accent/10'
          }`}>
          {card.type === 'mcq' ? 'MCQ' : card.type === 'formula' ? 'FM' : 'FC'}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(card.id) }}
          className="p-1.5 text-[#444] hover:text-[#FF4444] hover:bg-[#FF4444]/10 rounded transition-colors flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#555] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#555] flex-shrink-0" />}
      </div>

      {/* Expanded form */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 pt-2 border-t border-surface">
              {card.type === 'mcq' ? (
                <MCQForm
                  data={card.data as MCQEdit}
                  onChange={d => onUpdate(card.id, { data: d })}
                  isNew={card.isNew}
                  cardId={card.id}
                  onError={onError}
                />
              ) : card.type === 'formula' ? (
                <FormulaForm
                  data={card.data as FormulaEdit}
                  onChange={d => onUpdate(card.id, { data: d })}
                  isNew={card.isNew}
                />
              ) : (
                <FlashcardForm
                  data={card.data as FlashcardEdit}
                  onChange={d => onUpdate(card.id, { data: d })}
                  isNew={card.isNew}
                  onError={onError}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const CardEditor: React.FC<CardRowProps> = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.card.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <CardRow
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

