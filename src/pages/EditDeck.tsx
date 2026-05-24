import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Save, ChevronDown, ChevronUp, Trash2, GripVertical, Plus,
  CheckCircle2, AlertCircle, RotateCcw, ImageIcon, X, Sigma,
  Calculator, FlaskConical, Zap, Cpu, FileText
} from 'lucide-react'
import { renderMath, isRawLatex, isPureMath } from '../lib/latex'
import { getSubjectFilterClasses } from '../lib/subjectColors'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import 'mathlive'
import type { MathfieldElement } from 'mathlive'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement>, MathfieldElement
      > & { [key: string]: any }
    }
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

// Module-level web detection (needed by sub-components MCQForm/FlashcardForm)


type Subject = 'Mathematics' | 'General Engineering & Applied Sciences' | 'Electronics Engineering' | 'Electronics Systems & Technologies'

const SUBJECTS: { value: Subject; short: string; icon: any }[] = [
  { value: 'Mathematics', short: 'MATH', icon: Calculator },
  { value: 'General Engineering & Applied Sciences', short: 'GEAS', icon: FlaskConical },
  { value: 'Electronics Engineering', short: 'ELECS', icon: Zap },
  { value: 'Electronics Systems & Technologies', short: 'EST', icon: Cpu },
]

interface DeckMeta {
  title: string
  description: string
  subject: Subject
  tags: string
  folderName: string
}

interface EditCard {
  id: string
  type: 'mcq' | 'flashcard' | 'formula'
  data: MCQEdit | FlashcardEdit | FormulaEdit
  isNew?: boolean
}

interface MCQEdit {
  question: string
  choices: [string, string, string, string]
  answer: number
  explanation: string
  imagePath?: string
}

interface FlashcardEdit {
  front: string
  back: string
  imagePath?: string
}

interface FormulaEdit {
  name: string
  latex: string
  description: string
  variables: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-[#888] mb-1 block">{children}</span>
)

const inputCls = "w-full bg-[#0D0D0D] border border-[#2a2a2a] rounded px-3 py-2 text-[#E8E8E8] font-['IBM_Plex_Mono'] text-sm outline-none focus:border-[#00FF41] transition-colors placeholder-[#555]"
const textareaCls = `${inputCls} resize-none leading-relaxed`

// ── MathInputField: text area with ∑ toggle for MathLive equation entry ──────
interface MathInputFieldProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  rows?: number
  multiline?: boolean
  defaultMathMode?: boolean
}

const MathInputField: React.FC<MathInputFieldProps> = ({
  value, onChange, placeholder, rows = 3, multiline = true, defaultMathMode = false
}) => {
  const [mathMode, setMathMode] = useState(defaultMathMode)
  const mathfieldRef = React.useRef<any>(null)

  useEffect(() => {
    const el = mathfieldRef.current
    if (!el || !mathMode) return

    const syncValue = () => {
      if (typeof el.setValue === 'function') {
        if (el.value !== value) el.value = value
      } else {
        el.setAttribute('value', value)
        el.value = value
      }
    }

    syncValue()

    if (typeof customElements !== 'undefined' && customElements.whenDefined) {
      customElements.whenDefined('math-field').then(() => {
        if (mathfieldRef.current === el) {
          syncValue()
        }
      })
    }
  }, [mathMode, value])

  useEffect(() => {
    const el = mathfieldRef.current
    if (!el || !mathMode) return
    const handler = () => onChange(el.value)
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [mathMode, onChange])

  return (
    <div className="relative flex flex-col gap-2 w-full flex-1">
      <button
        type="button"
        onClick={() => setMathMode(m => !m)}
        title={mathMode ? 'Switch to text mode' : 'Switch to equation mode'}
        className="absolute top-2 right-2 z-10 flex items-center justify-center min-w-[28px] h-[24px] px-2 rounded-full bg-[#1C1C1C] border border-[rgba(0,255,65,0.3)] text-[#00FF41] hover:bg-[rgba(0,255,65,0.1)] font-bold text-xs transition-colors shadow-sm"
      >
        {mathMode ? 'Aa' : <Sigma size={12} />}
      </button>

      {!mathMode ? (
        multiline ? (
          <textarea
            rows={rows}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${textareaCls} pr-10`}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${inputCls} pr-10`}
          />
        )
      ) : (
        <>
          <math-field
            ref={mathfieldRef}
            virtual-keyboard-mode="onfocus"
            style={{
              width: '100%',
              minHeight: multiline ? '100px' : '48px',
              background: '#111111',
              border: '1px solid rgba(0,255,65,0.3)',
              borderRadius: '6px',
              padding: '12px',
              paddingRight: '40px',
              color: '#E8E8E8',
              fontSize: '1rem',
              fontFamily: 'IBM Plex Mono, monospace',
              '--keyboard-zindex': '99999',
            } as React.CSSProperties & Record<string, string>}
          />
          {value.trim().length > 0 && (
            <div className="bg-[#1C1C1C] border border-[rgba(0,255,65,0.1)] rounded-lg p-3">
              <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-[#888] mb-1">Preview</div>
              {(() => {
                try {
                  return <div className="text-[#E8E8E8]" dangerouslySetInnerHTML={{ __html: renderMath(value) }} />
                } catch {
                  return <code className="text-[#E8E8E8] break-all">{value}</code>
                }
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── FormulaForm: maps name→front, latex→back ──────────────────────────────────
const FormulaForm: React.FC<{ data: FormulaEdit; onChange: (d: FormulaEdit) => void; isNew?: boolean }> = ({ data, onChange }) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full">
        <Label>Front / Term (formula name)</Label>
        <MathInputField
          value={data.name || ''}
          onChange={val => onChange({ ...data, name: val })}
          placeholder="Formula name, e.g. Inverse Sine..."
          rows={3}
          multiline={true}
          defaultMathMode={isRawLatex(data.name || '') || (data.name || '').includes('\\')}
        />
      </div>
      <div className="relative w-full">
        <Label>Back / LaTeX (equation)</Label>
        <MathInputField
          value={data.latex || ''}
          onChange={val => onChange({ ...data, latex: val })}
          placeholder="LaTeX equation, e.g. \\sin^{-1}u..."
          rows={5}
          multiline={true}
          defaultMathMode={true}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Description (optional)</Label>
          <textarea rows={2} className={textareaCls} value={data.description || ''}
            onChange={e => onChange({ ...data, description: e.target.value })}
            placeholder="Brief description..." />
        </div>
        <div>
          <Label>Variables (optional)</Label>
          <textarea rows={2} className={textareaCls} value={data.variables || ''}
            onChange={e => onChange({ ...data, variables: e.target.value })}
            placeholder="e.g. u = angle in radians" />
        </div>
      </div>
    </div>
  )
}

interface CardRowProps {
  card: EditCard
  index: number
  onUpdate: (id: string, data: Partial<EditCard>) => void
  onDelete: (id: string) => void
  onError?: (msg: string) => void
}

const MCQForm: React.FC<{ data: MCQEdit; onChange: (d: MCQEdit) => void; isNew?: boolean; onError?: (msg: string) => void }> = ({ data, onChange, isNew, onError }) => {
  const set = (patch: Partial<MCQEdit>) => onChange({ ...data, ...patch })
  const setChoice = (i: number, val: string) => {
    const choices = [...data.choices] as MCQEdit['choices']
    choices[i] = val
    set({ choices })
  }
  const labels = ['A', 'B', 'C', 'D']

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 10MB limit guardrail
    if (file.size > 10 * 1024 * 1024) {
      if (onError) onError('Image exceeds 10MB limit.')
      e.target.value = ''
      return
    }

    const path = (file as any).path
    if (!path) return
    try {
      const result = await window.electron.saveImage(path)
      if (result.success && result.filename) {
        set({ imagePath: result.filename })
      } else {
        if (onError) onError(result.error || 'Failed to save image')
      }
    } catch (err: any) {
      console.error(err)
      if (onError) onError('Error saving image: ' + err.message)
    }
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <Label>Question</Label>
          <MathInputField
            value={data.question}
            onChange={val => set({ question: val })}
            placeholder="Enter question text..."
            rows={6}
            multiline={true}
            defaultMathMode={isPureMath(data.question)}
          />
        </div>
        <div className="shrink-0 flex flex-col items-center justify-start mt-5">
          {data.imagePath ? (
            <div className="relative group">
              <img src={`ece-app://${data.imagePath}`} alt="Question image" className="w-24 h-24 object-cover rounded border border-[#333]" />
              <button
                onClick={() => set({ imagePath: undefined })}
                className="absolute -top-2 -right-2 bg-[#FF4B4B] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-[#333] hover:border-[#00FF41] hover:text-[#00FF41] text-[#888] rounded transition-colors bg-[#0a0a0a]">
              <ImageIcon size={24} />
              <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest mt-2 font-bold text-center leading-tight">Add<br />Image</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {data.choices.map((choice, i) => (
          <div key={i}>
            <Label>Choice {labels[i]}</Label>
            <div className="flex items-start gap-2">
              <input
                type="radio"
                name={`ans-${data.question.slice(0, 8)}`}
                checked={data.answer === i}
                onChange={() => set({ answer: i })}
                className="accent-[#00FF41] w-4 h-4 mt-3 flex-shrink-0 cursor-pointer"
              />
              <MathInputField
                value={choice}
                onChange={val => setChoice(i, val)}
                placeholder={`Choice ${labels[i]}...`}
                multiline={false}
                defaultMathMode={isPureMath(choice)}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <Label>Explanation (optional)</Label>
        <MathInputField
          value={data.explanation}
          onChange={val => set({ explanation: val })}
          placeholder="Explanation for the correct answer..."
          rows={2}
          multiline={true}
          defaultMathMode={isPureMath(data.explanation || '')}
        />
      </div>
    </div>
  )
}

const FlashcardForm: React.FC<{ data: FlashcardEdit; onChange: (d: FlashcardEdit) => void; isNew?: boolean; onError?: (msg: string) => void }> = ({ data, onChange, isNew, onError }) => {
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 10MB limit guardrail
    if (file.size > 10 * 1024 * 1024) {
      if (onError) onError('Image exceeds 10MB limit.')
      e.target.value = ''
      return
    }

    const path = (file as any).path
    if (!path) return
    try {
      const result = await window.electron.saveImage(path)
      if (result.success && result.filename) {
        onChange({ ...data, imagePath: result.filename })
      } else {
        if (onError) onError(result.error || 'Failed to save image')
      }
    } catch (err: any) {
      console.error(err)
      if (onError) onError('Error saving image: ' + err.message)
    }
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div>
            <Label>Front / Term</Label>
            <textarea rows={8} className={textareaCls} value={data.front}
              onChange={e => onChange({ ...data, front: e.target.value })} placeholder="Term or question..." />
          </div>
          <div>
            <Label>Back / Definition</Label>
            <textarea rows={8} className={textareaCls} value={data.back}
              onChange={e => onChange({ ...data, back: e.target.value })} placeholder="Definition or answer..." />
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-center justify-start mt-5">
          {data.imagePath ? (
            <div className="relative group">
              <img src={`ece-app://${data.imagePath}`} alt="Flashcard image" className="w-24 h-24 object-cover rounded border border-[#333]" />
              <button
                onClick={() => onChange({ ...data, imagePath: undefined })}
                className="absolute -top-2 -right-2 bg-[#FF4B4B] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-[#333] hover:border-[#00FF41] hover:text-[#00FF41] text-[#888] rounded transition-colors bg-[#0a0a0a]">
              <ImageIcon size={24} />
              <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest mt-2 font-bold text-center leading-tight">Add<br />Image</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          )}
        </div>
      </div>
    </div>
  )
}

const CardRow: React.FC<CardRowProps & { dragHandleProps?: React.HTMLAttributes<HTMLElement> }> = ({ card, index, onUpdate, onDelete, onError, dragHandleProps }) => {
  const [expanded, setExpanded] = useState(card.isNew ?? false)

  const preview = card.type === 'mcq'
    ? (card.data as MCQEdit).question || '(empty question)'
    : card.type === 'formula'
      ? (card.data as FormulaEdit).name || '(empty formula)'
      : (card.data as FlashcardEdit).front || '(empty term)'

  const truncated = preview.length > 72 ? preview.slice(0, 72) + '…' : preview

  return (
    <div
      className={`rounded-lg border transition-colors ${expanded ? 'border-[#00FF41]/30 bg-[#0f1a0f]' : 'border-[#222] bg-[#111] hover:border-[#333]'}`}
    >
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <span
          {...dragHandleProps}
          onClick={e => e.stopPropagation()}
          className="text-[#444] hover:text-[#888] cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <span className="text-[#555] font-['IBM_Plex_Mono'] text-xs w-6 flex-shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="flex-1 text-[#ccc] font-['IBM_Plex_Mono'] text-sm truncate">
          {card.type === 'formula' || isRawLatex(truncated) || truncated.includes('$') || truncated.includes('\\') ? (
            <span dangerouslySetInnerHTML={{ __html: renderMath(isRawLatex(truncated) && !truncated.includes('$') ? `$${truncated}$` : truncated) }} />
          ) : (
            truncated
          )}
        </span>
        <span className={`text-[10px] font-['IBM_Plex_Mono'] font-bold px-2 py-0.5 rounded border uppercase flex-shrink-0 ${card.type === 'mcq'
            ? 'text-[#00BFFF] border-[#00BFFF]/30 bg-[#00BFFF]/10'
            : card.type === 'formula'
              ? 'text-[#A855F7] border-[#A855F7]/30 bg-[#A855F7]/10'
              : 'text-[#00FF41] border-[#00FF41]/30 bg-[#00FF41]/10'
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

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-8 pt-4 border-t border-[#1a1a1a] min-h-[220px]">
              {card.type === 'mcq' ? (
                <MCQForm
                  data={card.data as MCQEdit}
                  onChange={d => onUpdate(card.id, { data: d })}
                  isNew={card.isNew}
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

// ── Sortable wrapper — provides the useSortable handle ─────────────────────────
const SortableQuestionRow: React.FC<CardRowProps> = (props) => {
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EditDeck() {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const [deckMeta, setDeckMeta] = useState<DeckMeta>({
    title: '',
    description: '',
    subject: 'Electronics Engineering',
    tags: '',
    folderName: ''
  })
  const [cards, setCards] = useState<EditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [originalCardIds, setOriginalCardIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const handleExportToText = async () => {
    if (!deckId || isExporting) return

    setIsExporting(true)
    try {
      const res = await window.electron.decks.exportToText(deckId, deckMeta.title)
      if (res.success) {
        setToast({ type: 'success', msg: 'Deck exported to text successfully!' })
        setTimeout(() => setToast(null), 3000)
      } else {
        if (res.error !== 'Export canceled') {
          setToast({ type: 'error', msg: `Export failed: ${res.error}` })
          setTimeout(() => setToast(null), 4000)
        }
      }
    } catch (err) {
      console.error('[Export to Text Error]', err)
      setToast({ type: 'error', msg: 'An unexpected error occurred during export.' })
      setTimeout(() => setToast(null), 4000)
    } finally {
      setIsExporting(false)
    }
  }
  const [existingFolders, setExistingFolders] = useState<string[]>([])
  const [showFolderDropdown, setShowFolderDropdown] = useState(false)
  const folderDropdownRef = React.useRef<HTMLDivElement>(null)
  const [customTagInput, setCustomTagInput] = useState('')

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setShowFolderDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [historyStack, setHistoryStack] = useState<EditCard[][]>([])
  const cardsRef = React.useRef(cards)
  useEffect(() => { cardsRef.current = cards }, [cards])

  const saveSnapshot = useCallback((currentCards: EditCard[]) => {
    setHistoryStack(prev => {
      const newStack = [...prev, currentCards]
      if (newStack.length > 15) return newStack.slice(newStack.length - 15)
      return newStack
    })
  }, [])

  const undo = useCallback(() => {
    if (historyStack.length === 0) return
    const newStack = [...historyStack]
    const lastSnapshot = newStack.pop()!
    setHistoryStack(newStack)
    setCards(lastSnapshot)
    setToast({ type: 'success', msg: 'Action Undone' })
    setTimeout(() => setToast(null), 2000)
  }, [historyStack])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const activeTag = document.activeElement?.tagName?.toLowerCase()
        if (activeTag === 'input' || activeTag === 'textarea') return
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo])

  // Fetch folders for autocomplete
  useEffect(() => {
    async function fetchFolders() {
      let folderNames: string[] = []
      if (!window.electron?.decks) return
      const r = await window.electron.decks.getTopics()
      folderNames = [...new Set(
        (r.data || []).map((row: any) => row.folder_name).filter(Boolean)
      )].sort() as string[]
      setExistingFolders(folderNames)
    }
    fetchFolders()
  }, [])

  // ── Load from DB ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId) return
    async function load() {
      try {
        setLoading(true)
        // ── Electron: load via IPC ──
        const topicsRes = await window.electron.decks.getTopics()
          const topicRow = (topicsRes.data || []).find((t: any) => t.id === deckId)
          if (topicRow) {
            const t = topicRow
            let parsedTags = ''
            try { parsedTags = JSON.parse(t.tags || '[]').join(', ') } catch { }
            setDeckMeta({
              title: t.name || '',
              description: t.description || '',
              subject: t.subject as Subject || 'Electronics Engineering',
              tags: parsedTags,
              folderName: (!t.folder_name || t.folder_name === 'Uncategorized') ? '' : t.folder_name
            })
          }

          const cardsRes = await window.electron.data.getAllCardsByTopic(deckId!)
          if (cardsRes.success && cardsRes.data) {
            const loaded: EditCard[] = cardsRes.data.map((row: any) => {
              let parsed: any = {}
              try { parsed = JSON.parse(row.data) } catch { }
              if (row.type === 'mcq') {
                const d: MCQEdit = {
                  question: parsed.question ?? '',
                  choices: [
                    parsed.choices?.[0] ?? '',
                    parsed.choices?.[1] ?? '',
                    parsed.choices?.[2] ?? '',
                    parsed.choices?.[3] ?? '',
                  ],
                  answer: parsed.answer ?? 0,
                  explanation: parsed.explanation ?? '',
                }
                if (parsed.imagePath) d.imagePath = parsed.imagePath
                return { id: row.id, type: 'mcq', data: d } as EditCard
              } else if (row.type === 'formula') {
                // Normalise field names: support canonical camelCase AND any
                // snake_case aliases that may appear in exported/imported data.
                const rawName =
                  parsed.name ??
                  parsed.front_formula ??
                  parsed.frontFormula ??
                  parsed.term ??
                  ''
                const rawLatex =
                  parsed.latex ??
                  parsed.latex_content ??
                  parsed.latexContent ??
                  parsed.back_equation ??
                  parsed.backEquation ??
                  parsed.equation ??
                  ''
                const rawDescription =
                  parsed.description ??
                  parsed.desc ??
                  ''
                const varsRaw =
                  parsed.variables ??
                  parsed.vars ??
                  ''
                const varsStr = typeof varsRaw === 'object' && varsRaw !== null
                  ? Object.entries(varsRaw).map(([k, v]) => `${k}: ${v}`).join('\n')
                  : String(varsRaw ?? '')
                const d: FormulaEdit = {
                  name: String(rawName),
                  latex: String(rawLatex),
                  description: String(rawDescription),
                  variables: varsStr,
                }
                return { id: row.id, type: 'formula', data: d } as EditCard
              } else {
                const d: FlashcardEdit = {
                  front: parsed.front ?? '',
                  back: parsed.back ?? '',
                }
                if (parsed.imagePath) d.imagePath = parsed.imagePath
                return { id: row.id, type: 'flashcard', data: d } as EditCard
              }
            })
            setCards(loaded)
            setOriginalCardIds(new Set(loaded.map(c => c.id)))
        }
      } catch (err) {
        console.error('[EditDeck] Load error', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [deckId])

  // ── Card mutations ────────────────────────────────────────────────────────
  const updateCard = useCallback((id: string, patch: Partial<EditCard>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [])

  const deleteCard = useCallback((id: string) => {
    saveSnapshot(cardsRef.current)
    setCards(prev => prev.filter(c => c.id !== id))
  }, [saveSnapshot])

  const addCard = (type: 'mcq' | 'flashcard' | 'formula') => {
    const id = `new_${Date.now()}`
    const data: EditCard = type === 'mcq'
      ? { id, type, data: { question: '', choices: ['', '', '', ''], answer: 0, explanation: '' }, isNew: true }
      : type === 'formula'
        ? { id, type, data: { name: '', latex: '', description: '', variables: '' }, isNew: true }
        : { id, type, data: { front: '', back: '' }, isNew: true }
    setCards(prev => [...prev, data])
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      saveSnapshot(cardsRef.current)
      setCards(prev => {
        const oldIndex = prev.findIndex(c => c.id === active.id)
        const newIndex = prev.findIndex(c => c.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  // ── Save: full transactional diff write ──────────────────────────────────
  const handleSave = async () => {
    if (!deckId || isSaving) return
    setIsSaving(true)

    try {
      const tagsArr = deckMeta.tags.split(',').map(t => t.trim()).filter(Boolean)
        const currentIds = new Set(cards.filter(c => !c.id.startsWith('new_')).map(c => c.id))
        const deletedCardIds = [...originalCardIds].filter(id => !currentIds.has(id))
      const res = await window.electron.decks.updateDeckWithCards({
        deckId,
        title: deckMeta.title.trim(),
        subject: deckMeta.subject,
        description: deckMeta.description.trim(),
        tags: JSON.stringify(tagsArr),
        folderName: deckMeta.folderName.trim(),
        cards: cards.map(card => ({
          id: card.id,
          type: card.type,
          data: typeof card.data === 'string' ? card.data : JSON.stringify(card.data)
        })),
        deletedCardIds
      })
      if (!res.success) throw new Error(res.error)
      setToast({ type: 'success', msg: 'Deck saved successfully!' })
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      console.error('[EditDeck] Save failed', err)
      // no ROLLBACK needed — handled server-side
      setToast({ type: 'error', msg: 'Save failed. Changes were rolled back.' })
      setTimeout(() => setToast(null), 4000)
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full bg-[#0D0D0D] flex items-center justify-center">
        <div className="text-[#00FF41] font-['IBM_Plex_Mono'] text-sm tracking-widest animate-pulse">LOADING DECK...</div>
      </div>
    )
  }

  return (
    <div className="h-full bg-[#0D0D0D] flex flex-col overflow-hidden">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[200] flex items-center gap-3 px-5 py-3 rounded-lg border shadow-2xl font-['Rajdhani'] tracking-wider text-sm ${toast.type === 'success'
                ? 'bg-[#0a1a0a] border-[#00FF41]/40 text-[#00FF41]'
                : 'bg-[#1a0a0a] border-[#FF4444]/40 text-[#FF4444]'
              }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Bar ── */}
      <div className="flex-shrink-0 h-16 bg-[#111] border-b border-[#1e1e1e] flex items-center px-6 gap-4">
        <button
          onClick={() => navigate('/study')}
          className="flex items-center gap-2 text-[#888] hover:text-[#E8E8E8] transition-colors font-['Rajdhani'] uppercase tracking-widest text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex-1 text-center">
          <h1 className="font-['Orbitron'] font-bold text-lg tracking-[0.2em] text-[#E8E8E8] uppercase">
            Edit <span className="text-[#00FF41]">Deck</span>
          </h1>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-2 font-['Rajdhani'] font-bold uppercase tracking-widest text-sm rounded transition-all ${isSaving
              ? 'bg-[#00FF41]/40 text-black/60 cursor-not-allowed'
              : 'bg-[#00FF41] text-black hover:bg-[rgba(0,255,65,0.85)] shadow-[0_0_12px_rgba(0,255,65,0.25)]'
            }`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto w-full">
        <div className="w-full px-6 lg:px-10 xl:grid xl:grid-cols-3 xl:gap-6 flex flex-col gap-6 py-6 lg:py-8 items-center xl:items-start">

          {/* ── Metadata Section — Pane 1 (sticky left 1/3) */}
          <div className="w-full max-w-4xl xl:max-w-none xl:col-span-1 xl:sticky xl:top-6 bg-[#111] border border-zinc-800 rounded-xl p-6 flex flex-col gap-5">
            <h2 className="font-['Rajdhani'] font-bold uppercase tracking-widest text-[#888] text-xs">Deck Info</h2>

            <div>
              <div className="relative">
                <input
                  type="text"
                  className="w-full bg-transparent text-[#E8E8E8] text-[1.15rem] font-['Orbitron'] border-b-2 border-[#333] focus:border-[#00FF41] pb-3 focus:outline-none placeholder:text-[#555] transition-colors tracking-wide pr-16"
                  value={deckMeta.title}
                  onChange={e => setDeckMeta(m => ({ ...m, title: e.target.value }))}
                  placeholder="Deck title..."
                  maxLength={80}
                />
                <span className="absolute right-0 bottom-4 text-xs font-['IBM_Plex_Mono'] text-[#666]">
                  {deckMeta.title.length} / 80
                </span>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <input
                type="text"
                className={inputCls}
                value={deckMeta.description}
                onChange={e => setDeckMeta(m => ({ ...m, description: e.target.value }))}
                placeholder="Short description..."
              />
            </div>

            <div>
              <Label>Folder / Category</Label>
              <div className="relative" ref={folderDropdownRef}>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-[#E8E8E8] font-['IBM_Plex_Mono'] text-sm focus:border-[#00FF41] focus:bg-[#111] outline-none transition-colors pr-16 placeholder-[#555]"
                    value={deckMeta.folderName}
                    onChange={e => {
                      setDeckMeta(m => ({ ...m, folderName: e.target.value }))
                      setShowFolderDropdown(true)
                    }}
                    onFocus={() => setShowFolderDropdown(true)}
                    placeholder="e.g. Select or type folder name..."
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    {deckMeta.folderName && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeckMeta(m => ({ ...m, folderName: '' }))
                          setShowFolderDropdown(true)
                        }}
                        className="p-1 text-[#444] hover:text-[#00FF41] transition-colors"
                        title="Clear folder"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowFolderDropdown(prev => !prev)}
                      className="p-1 text-[#666] hover:text-[#00FF41] transition-colors"
                      title="Toggle folder list"
                    >
                      <ChevronDown size={14} className={`transform transition-transform ${showFolderDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showFolderDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#161616] border border-[#333] rounded-lg shadow-2xl max-h-48 overflow-y-auto custom-scrollbar"
                    >
                      {existingFolders.length === 0 ? (
                        <div className="p-3 text-xs text-[#666] font-['IBM_Plex_Mono'] text-center">
                          No folders created yet. Type above to create one.
                        </div>
                      ) : (
                        <div className="flex flex-col py-1">
                          {existingFolders
                            .filter(f => f.toLowerCase().includes(deckMeta.folderName.toLowerCase()))
                            .map(f => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => {
                                  setDeckMeta(m => ({ ...m, folderName: f }))
                                  setShowFolderDropdown(false)
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-['IBM_Plex_Mono'] text-[#ccc] hover:bg-[#222] hover:text-[#00FF41] transition-colors flex items-center justify-between"
                              >
                                <span>{f}</span>
                                {deckMeta.folderName.toLowerCase() === f.toLowerCase() && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41]" />
                                )}
                              </button>
                            ))}
                          {existingFolders.filter(f => f.toLowerCase().includes(deckMeta.folderName.toLowerCase())).length === 0 && (
                            <div className="p-3 text-xs text-[#666] font-['IBM_Plex_Mono'] text-center">
                              Press save to create folder "{deckMeta.folderName}"
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div>
              <Label>Subject</Label>
              <div className="flex gap-2 flex-wrap">
                {SUBJECTS.map(s => {
                  const Icon = s.icon
                  const isSelected = deckMeta.subject === s.value
                  const colorClasses = getSubjectFilterClasses(s.short, isSelected)

                  return (
                    <button
                      key={s.value}
                      onClick={() => setDeckMeta(m => ({ ...m, subject: s.value }))}
                      className={`px-4 py-2 rounded-md font-['Rajdhani'] uppercase tracking-widest font-bold text-[11px] flex items-center gap-2 transition-all duration-200 ${colorClasses} ${!isSelected ? 'bg-[#111] hover:bg-[#1A1A1A] border-[#222] text-[#888]' : ''
                        }`}
                    >
                      <Icon size={14} className={isSelected ? 'text-inherit' : 'text-[#888]'} />
                      {s.short}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-[#00FF41] font-['Rajdhani'] font-bold uppercase tracking-widest mb-3 block">
                Source Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {['Excel', 'Edge', 'TOP', 'Indiabix', 'Pinoybix', 'EST Superbook', 'Cuervo'].map(tag => {
                  const currentTags = deckMeta.tags.split(',').map(t => t.trim()).filter(Boolean)
                  const isSelected = currentTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const arr = deckMeta.tags.split(',').map(t => t.trim()).filter(Boolean)
                        const next = isSelected ? arr.filter(t => t !== tag) : [...arr, tag]
                        setDeckMeta(m => ({ ...m, tags: next.join(', ') }))
                      }}
                      className={`px-4 py-2 rounded-full font-['Rajdhani'] uppercase tracking-wider text-xs font-bold transition-all border ${isSelected
                          ? 'bg-[#00FF41]/10 border-[#00FF41] text-[#00FF41]'
                          : 'bg-[#161616] border-[#333] text-[#888] hover:border-[#555] hover:text-[#E8E8E8]'
                        }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2 w-full">
                <input
                  type="text"
                  placeholder="Add custom tag..."
                  value={customTagInput}
                  onChange={e => setCustomTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (customTagInput.trim()) {
                        const currentTags = deckMeta.tags.split(',').map(t => t.trim()).filter(Boolean);
                        if (!currentTags.includes(customTagInput.trim())) {
                          setDeckMeta(m => ({ ...m, tags: [...currentTags, customTagInput.trim()].join(', ') }));
                        }
                        setCustomTagInput('');
                      }
                    }
                  }}
                  className="flex-1 bg-[#111] border border-[#333] rounded px-3 py-2 text-sm text-[#E8E8E8] placeholder-[#555] focus:border-[#00FF41] focus:outline-none font-['Rajdhani'] uppercase tracking-wider transition-colors h-[38px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customTagInput.trim()) {
                      const currentTags = deckMeta.tags.split(',').map(t => t.trim()).filter(Boolean);
                      if (!currentTags.includes(customTagInput.trim())) {
                        setDeckMeta(m => ({ ...m, tags: [...currentTags, customTagInput.trim()].join(', ') }));
                      }
                      setCustomTagInput('');
                    }
                  }}
                  className="w-[38px] h-[38px] bg-[#111] border border-[#333] text-[#888] flex items-center justify-center rounded hover:text-[#00FF41] hover:border-[#00FF41] transition-colors shrink-0"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-5 mt-2">
              <button
                type="button"
                onClick={handleExportToText}
                disabled={isExporting}
                className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg border font-['Rajdhani'] font-bold uppercase tracking-widest text-xs transition-all duration-200 ${isExporting
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-[#111] hover:bg-[#00FF41]/5 border-zinc-800 hover:border-[#00FF41]/40 text-[#888] hover:text-[#00FF41] shadow-md hover:shadow-[0_0_15px_rgba(0,255,65,0.1)]'
                  }`}
              >
                <FileText className="w-4 h-4" />
                {isExporting ? 'Exporting...' : 'Export to Text'}
              </button>
            </div>
          </div>

          {/* ── Cards Pane — Pane 2 (right 2/3) */}
          <div className="w-full max-w-4xl xl:max-w-none xl:col-span-2 flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-['Rajdhani'] font-bold uppercase tracking-widest text-[#888] text-xs">
                  Questions
                </h2>
                <span className="text-[#555] font-['IBM_Plex_Mono'] text-xs">
                  {cards.length} {cards.length === 1 ? 'item' : 'items'} total
                </span>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  <AnimatePresence mode="popLayout">
                    {cards.map((card, i) => (
                      <SortableQuestionRow
                        key={card.id}
                        card={card}
                        index={i}
                        onUpdate={updateCard}
                        onDelete={deleteCard}
                        onError={(msg) => {
                          setToast({ type: 'error', msg })
                          setTimeout(() => setToast(null), 3000)
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </SortableContext>
              </DndContext>

              {cards.length === 0 && (
                <div className="text-center py-16 text-[#444] font-['IBM_Plex_Mono'] text-sm">
                  No questions yet. Add one below.
                </div>
              )}
            </div>{/* end question list */}

            {/* ── Bottom Bar ── */}
            <div className="flex items-center justify-between bg-[#111] border border-[#1e1e1e] rounded-xl px-6 py-4 gap-4">
              <span className="text-[#555] font-['IBM_Plex_Mono'] text-xs">
                {cards.length} question{cards.length !== 1 ? 's' : ''} total
              </span>
              <div className="flex items-center gap-3">
                {historyStack.length > 0 && (
                  <button
                    onClick={undo}
                    className="flex items-center justify-center p-2 rounded border border-[#666] text-[#666] hover:text-[#00FF41] hover:border-[#00FF41] transition-colors"
                    title="Undo (Ctrl+Z)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => addCard('flashcard')}
                  className="flex items-center gap-2 px-4 py-2 rounded border border-[#333] bg-[#161616] text-[#888] hover:text-[#00FF41] hover:border-[#00FF41]/50 font-['Rajdhani'] uppercase tracking-widest text-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Flashcard
                </button>
                <button
                  onClick={() => addCard('formula')}
                  className="flex items-center gap-2 px-4 py-2 rounded border border-[#A855F7]/40 bg-[#A855F7]/5 text-[#A855F7] hover:bg-[#A855F7]/10 font-['Rajdhani'] uppercase tracking-widest text-sm transition-all"
                >
                  <Sigma className="w-4 h-4" />
                  Add Formula
                </button>
                <button
                  onClick={() => addCard('mcq')}
                  className="flex items-center gap-2 px-4 py-2 rounded border border-[#00FF41]/40 bg-[#00FF41]/5 text-[#00FF41] hover:bg-[#00FF41]/10 font-['Rajdhani'] uppercase tracking-widest text-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add MCQ
                </button>
              </div>
            </div>

          </div>{/* end Pane 2 */}

        </div>
      </div>
    </div>
  )
}
