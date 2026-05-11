import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Save, ChevronDown, ChevronUp, Trash2, GripVertical, Plus,
  CheckCircle2, AlertCircle, RotateCcw, ImageIcon, X
} from 'lucide-react'
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

// ─── Types ───────────────────────────────────────────────────────────────────

type Subject = 'MATH' | 'GEAS' | 'ELECS' | 'EST'
const SUBJECTS: Subject[] = ['MATH', 'GEAS', 'ELECS', 'EST']

const SUBJECT_DB_MAP: Record<string, Subject> = {
  'Mathematics': 'MATH',
  'General Engineering & Applied Sciences': 'GEAS',
  'Electronics Engineering': 'ELECS',
  'Electronics Systems & Technologies': 'EST',
}
const SUBJECT_DISPLAY_MAP: Record<Subject, string> = {
  MATH: 'Mathematics',
  GEAS: 'General Engineering & Applied Sciences',
  ELECS: 'Electronics Engineering',
  EST: 'Electronics Systems & Technologies',
}

interface DeckMeta {
  title: string
  description: string
  subject: Subject
  tags: string
  folderName: string
}

interface EditCard {
  id: string
  type: 'mcq' | 'flashcard'
  data: MCQEdit | FlashcardEdit
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

// ─── Sub-components ───────────────────────────────────────────────────────────

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-[#888] mb-1 block">{children}</span>
)

const inputCls = "w-full bg-[#0D0D0D] border border-[#2a2a2a] rounded px-3 py-2 text-[#E8E8E8] font-['IBM_Plex_Mono'] text-sm outline-none focus:border-[#00FF41] transition-colors placeholder-[#555]"
const textareaCls = `${inputCls} resize-none leading-relaxed`

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
      const result = await (window as any).electron.saveImage(path)
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
          <textarea rows={3} className={textareaCls} value={data.question}
            onChange={e => set({ question: e.target.value })} placeholder="Enter question text..." />
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
              <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest mt-2 font-bold text-center leading-tight">Add<br/>Image</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {data.choices.map((choice, i) => (
          <div key={i}>
            <Label>Choice {labels[i]}</Label>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name={`ans-${data.question.slice(0, 8)}`}
                checked={data.answer === i}
                onChange={() => set({ answer: i })}
                className="accent-[#00FF41] w-4 h-4 flex-shrink-0 cursor-pointer"
              />
              <input type="text" className={inputCls} value={choice}
                onChange={e => setChoice(i, e.target.value)}
                placeholder={`Choice ${labels[i]}...`} />
            </div>
          </div>
        ))}
      </div>

      <div>
        <Label>Explanation (optional)</Label>
        <textarea rows={2} className={textareaCls} value={data.explanation}
          onChange={e => set({ explanation: e.target.value })} placeholder="Explanation for the correct answer..." />
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
      const result = await (window as any).electron.saveImage(path)
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
            <textarea rows={4} className={textareaCls} value={data.front}
              onChange={e => onChange({ ...data, front: e.target.value })} placeholder="Term or question..." />
          </div>
          <div>
            <Label>Back / Definition</Label>
            <textarea rows={4} className={textareaCls} value={data.back}
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
              <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest mt-2 font-bold text-center leading-tight">Add<br/>Image</span>
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
        {/* Grip handle — only this triggers drag */}
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
        <span className="flex-1 text-[#ccc] font-['IBM_Plex_Mono'] text-sm truncate">{truncated}</span>
        <span className={`text-[10px] font-['IBM_Plex_Mono'] font-bold px-2 py-0.5 rounded border uppercase flex-shrink-0 ${
          card.type === 'mcq'
            ? 'text-[#00BFFF] border-[#00BFFF]/30 bg-[#00BFFF]/10'
            : 'text-[#00FF41] border-[#00FF41]/30 bg-[#00FF41]/10'
        }`}>
          {card.type === 'mcq' ? 'MCQ' : 'FC'}
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
            <div className="px-4 pb-5 pt-2 border-t border-[#1a1a1a]">
              {card.type === 'mcq' ? (
                <MCQForm
                  data={card.data as MCQEdit}
                  onChange={d => onUpdate(card.id, { data: d })}
                  isNew={card.isNew}
                  onError={onError}
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
    subject: 'ELECS',
    tags: '',
    folderName: 'Uncategorized'
  })
  const [cards, setCards] = useState<EditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [originalCardIds, setOriginalCardIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [existingFolders, setExistingFolders] = useState<string[]>([])

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
      if (!window.electron?.db) return
      const r = await window.electron.db.query('SELECT DISTINCT folder_name FROM topics ORDER BY folder_name')
      if (r.success && r.data) {
        setExistingFolders(r.data.map((row: any) => row.folder_name).filter(Boolean))
      }
    }
    fetchFolders()
  }, [])

  // ── Load from DB ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!deckId) return
    async function load() {
      try {
        setLoading(true)
        const topicRes = await window.electron.db.query(
          'SELECT id, name, subject, description, tags, folder_name FROM topics WHERE id = ?',
          [deckId]
        )
        if (topicRes.success && topicRes.data?.[0]) {
          const t = topicRes.data[0]
          const subjectCode = SUBJECT_DB_MAP[t.subject] ?? 'ELECS'
          let parsedTags = ''
          try { parsedTags = JSON.parse(t.tags || '[]').join(', ') } catch {}
          setDeckMeta({
            title: t.name || '',
            description: t.description || '',
            subject: subjectCode,
            tags: parsedTags,
            folderName: t.folder_name || 'Uncategorized'
          })
        }

        const cardsRes = await window.electron.db.query(
          'SELECT id, type, data FROM cards WHERE topic_id = ? ORDER BY rowid ASC',
          [deckId]
        )
        if (cardsRes.success && cardsRes.data) {
          const loaded: EditCard[] = cardsRes.data.map((row: any) => {
            let parsed: any = {}
            try { parsed = JSON.parse(row.data) } catch {}
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
              return { id: row.id, type: 'mcq', data: d }
            } else {
              const d: FlashcardEdit = {
                front: parsed.front ?? '',
                back: parsed.back ?? '',
              }
              if (parsed.imagePath) d.imagePath = parsed.imagePath
              return { id: row.id, type: 'flashcard', data: d }
            }
          })
          setCards(loaded)
          // Track the IDs that exist in the DB so we can diff deletions on save
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

  const addCard = (type: 'mcq' | 'flashcard') => {
    const id = `new_${Date.now()}`
    const data: EditCard = type === 'mcq'
      ? { id, type, data: { question: '', choices: ['', '', '', ''], answer: 0, explanation: '' }, isNew: true }
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

    const run = (sql: string, params: unknown[] = []) =>
      window.electron.db.run(sql, params)

    try {
      await run('BEGIN TRANSACTION')

      // 1. Update topic metadata
      const subjectFull = SUBJECT_DISPLAY_MAP[deckMeta.subject]
      const tagsJson = JSON.stringify(
        deckMeta.tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean)
      )
      await run(
        'UPDATE topics SET name = ?, description = ?, subject = ?, tags = ?, folder_name = ? WHERE id = ?',
        [deckMeta.title, deckMeta.description, subjectFull, tagsJson, deckMeta.folderName.trim(), deckId]
      )

      // 2. Partition cards into updates vs inserts
      const currentIds = new Set(cards.filter(c => !c.id.startsWith('new_')).map(c => c.id))

      for (const card of cards) {
        // Prevent double encode if data happens to be a string already
        const dataJson = typeof card.data === 'string' ? card.data : JSON.stringify(card.data)
        if (card.id.startsWith('new_')) {
          // INSERT
          await run(
            'INSERT INTO cards (id, topic_id, type, data, difficulty, tags) VALUES (?, ?, ?, ?, ?, ?)',
            [
              `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              deckId,
              card.type,
              dataJson,
              'medium',
              '[]',
            ]
          )
        } else {
          // UPDATE
          await run(
            'UPDATE cards SET type = ?, data = ? WHERE id = ?',
            [card.type, dataJson, card.id]
          )
        }
      }

      // 3. DELETE cards removed during this session
      for (const originalId of originalCardIds) {
        if (!currentIds.has(originalId)) {
          await run('DELETE FROM cards WHERE id = ?', [originalId])
        }
      }

      await run('COMMIT')

      setToast({ type: 'success', msg: 'Deck saved successfully!' })
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      console.error('[EditDeck] Save failed', err)
      try { await run('ROLLBACK') } catch {}
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
            className={`fixed top-4 right-4 z-[200] flex items-center gap-3 px-5 py-3 rounded-lg border shadow-2xl font-['Rajdhani'] tracking-wider text-sm ${
              toast.type === 'success'
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
          className={`flex items-center gap-2 px-5 py-2 font-['Rajdhani'] font-bold uppercase tracking-widest text-sm rounded transition-all ${
            isSaving
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
        <div className="max-w-4xl mx-auto px-6 lg:px-10 flex flex-col gap-6 py-6 lg:py-10">

        {/* ── Metadata Section ── */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 flex flex-col gap-5">
          <h2 className="font-['Rajdhani'] font-bold uppercase tracking-widest text-[#888] text-xs">Deck Info</h2>

          <div>
            <Label>Title</Label>
            <input
              type="text"
              className={`${inputCls} text-xl`}
              value={deckMeta.title}
              onChange={e => setDeckMeta(m => ({ ...m, title: e.target.value }))}
              placeholder="Deck title..."
            />
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
            <div className="relative group/folder">
              <input
                type="text"
                list="folder-suggestions"
                className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-[#E8E8E8] font-['IBM_Plex_Mono'] text-sm focus:border-[#00FF41] focus:bg-[#111] outline-none transition-colors pr-8"
                value={deckMeta.folderName}
                onChange={e => setDeckMeta(m => ({ ...m, folderName: e.target.value }))}
                placeholder="e.g. Midterms, AC Circuits..."
              />
              {deckMeta.folderName && (
                <button 
                  onClick={() => setDeckMeta(m => ({ ...m, folderName: '' }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#444] hover:text-[#00FF41] transition-colors"
                >
                  <X size={14} />
                </button>
              )}
              <datalist id="folder-suggestions">
                {existingFolders.map(f => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <Label>Subject</Label>
            <div className="flex gap-2 flex-wrap">
              {SUBJECTS.map(s => (
                <button
                  key={s}
                  onClick={() => setDeckMeta(m => ({ ...m, subject: s }))}
                  className={`px-4 py-1.5 rounded border font-['Rajdhani'] font-bold uppercase tracking-widest text-sm transition-all ${
                    deckMeta.subject === s
                      ? 'bg-[#00FF41]/10 border-[#00FF41] text-[#00FF41]'
                      : 'bg-[#161616] border-[#333] text-[#888] hover:border-[#555]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Tags (comma-separated)</Label>
            <input
              type="text"
              className={inputCls}
              value={deckMeta.tags}
              onChange={e => setDeckMeta(m => ({ ...m, tags: e.target.value }))}
              placeholder="e.g. 2022, midterms, AC circuits"
            />
          </div>
        </div>

        {/* ── Question List ── */}
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
        </div>

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
              onClick={() => addCard('mcq')}
              className="flex items-center gap-2 px-4 py-2 rounded border border-[#00FF41]/40 bg-[#00FF41]/5 text-[#00FF41] hover:bg-[#00FF41]/10 font-['Rajdhani'] uppercase tracking-widest text-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add MCQ
            </button>
          </div>
        </div>

        </div>
      </div>
    </div>
  )
}
