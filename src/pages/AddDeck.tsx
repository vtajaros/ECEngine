import { MCQForm, FlashcardForm, FormulaForm, MCQEdit, FlashcardEdit, FormulaEdit, FormattingGuideModal } from '../components/deck/CardForms'
import DeckMetadataForm, { DeckMetadata } from '../components/deck/DeckMetadataForm'
import { Tooltip } from '../components/ui/Tooltip'
import { PREDEFINED_TAGS } from '../lib/constants'
import { AutoTagConfirmModal } from '../components/deck/AutoTagConfirmModal'

import { ImportModal, ImportFlashcardsModal } from '../components/deck/ImportModals'
import { useDataVersionStore } from '../store/useDataVersionStore'
import { CardEditor, EditCard } from '../components/deck/CardEditor'
import { detectSubjectFromCards, hasCardContent, SubjectFullName as Subject } from '../lib/subjectClassifier'
import React, { useState, useEffect, useCallback } from 'react'
import {
  X, Save, ArrowLeft, FileText, Upload, AlertCircle, Check, Trash2, Plus, PlusCircle, Calculator, FlaskConical, Zap, Cpu, Layers, Wand2, GripVertical, ChevronDown, ChevronUp, AlertTriangle, RotateCcw, ImageIcon, Menu, Sigma, Type, Sparkles, Tag
} from 'lucide-react'
import { getSubjectFilterClasses } from '../lib/subjectColors'
import { TOS_SUBJECT_COLORS } from '../lib/tosData'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { parseImportedMCQs, parseImportedFlashcards } from '../lib/parser'
import { detectQuizletFormat, tryConvertQuizlet } from '../lib/quizletParser'
import { renderMath } from '../lib/latex'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'

const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) {
    return pointerCollisions
  }
  const rectCollisions = rectIntersection(args)
  if (rectCollisions.length > 0) {
    return rectCollisions
  }
  return closestCenter(args)
}
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

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                 */
/* ------------------------------------------------------------------ */

let _uid = 0
const uid = () => `row_${Date.now()}_${++_uid}`

// Module-level web detection (needed by sub-components like MCQForm/FlashcardForm)

const SUBJECTS: { value: Subject; short: string; icon: any }[] = [
  { value: 'Mathematics', short: 'MATH', icon: Calculator },
  { value: 'General Engineering & Applied Sciences', short: 'GEAS', icon: FlaskConical },
  { value: 'Electronics Engineering', short: 'ELECS', icon: Zap },
  { value: 'Electronics Systems & Technologies', short: 'EST', icon: Cpu },
]





const stripPlaceholders = (data: unknown): unknown => {
  if (typeof data === 'string') {
    return data.replace(/\\placeholder\{[^}]*\}/g, '').trim()
  }
  if (Array.isArray(data)) {
    return data.map(item => stripPlaceholders(item))
  }
  if (typeof data === 'object' && data !== null) {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(data as object)) {
      result[key] = stripPlaceholders((data as Record<string, unknown>)[key])
    }
    return result
  }
  return data
}

/* ------------------------------------------------------------------ */
/*  Import Modals (From AddDeck)                                      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Card Form Components (From EditDeck)                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

export default function AddDeck() {
  const navigate = useNavigate()

  const [metadata, setMetadata] = useState<DeckMetadata>({
    title: '',
    description: '',
    subject: 'Electronics Engineering',
    customTagInput: '',
    folderName: '',
    folderId: null,
    existingFolders: [],
    showFolderDropdown: false,
    deckTags: [],
  })
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])




  const [searchParams] = useSearchParams()
  const initialType = searchParams.get('type')
  const [deckType, setDeckType] = useState<'mcq' | 'flashcard' | 'formula'>(
    initialType === 'flashcard' ? 'flashcard' : initialType === 'formula' ? 'formula' : 'mcq'
  )
  const [cards, setCards] = useState<EditCard[]>([])

  const [importModalType, setImportModalType] = useState<'none' | 'mcq' | 'flashcard'>('none')
  const [saving, setSaving] = useState(false)
  const [showFormattingGuide, setShowFormattingGuide] = useState(false)

  const [showConfirmTypeModal, setShowConfirmTypeModal] = useState(false)
  const [pendingType, setPendingType] = useState<'mcq' | 'flashcard' | 'formula' | null>(null)

  const [historyStack, setHistoryStack] = useState<EditCard[][]>([])
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
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
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2000)
  }, [historyStack])

  const handleCardError = useCallback((msg: string) => {
    setToast({ type: 'error', msg })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  const [isClassifyingTos, setIsClassifyingTos] = useState(false)
  const [showAutoTagModal, setShowAutoTagModal] = useState(false)

  const onAutoTagClick = () => {
    if (cards.length === 0 || isClassifyingTos) return
    const currentlyTagged = cards.filter(c => !!c.tosTopicId).length
    if (currentlyTagged > 0) {
      setShowAutoTagModal(true)
    } else {
      executeAutoClassifyTos('overwrite')
    }
  }

  const executeAutoClassifyTos = async (mode: 'overwrite' | 'untagged-only') => {
    setShowAutoTagModal(false)
    if (cards.length === 0 || isClassifyingTos) return
    setIsClassifyingTos(true)
    try {
      saveSnapshot(cardsRef.current)
      const targetCards = mode === 'untagged-only'
        ? cards.filter(c => !c.tosTopicId)
        : cards

      if (targetCards.length === 0) {
        setToast({ type: 'success', msg: 'All cards already have a TOS category assigned.' })
        return
      }

      const payload = targetCards.map(c => ({
        id: c.id,
        type: c.type,
        data: typeof c.data === 'string' ? c.data : JSON.stringify(c.data),
        subject: metadata.subject,
        deckName: metadata.title,
        deckDescription: metadata.description,
        defaultTosTopicId: metadata.defaultTosTopicId || null,
      }))
      const res = await window.electron.decks.classifyCardsBatch(payload)
      if (res?.success && res.data) {
        const resultMap = new Map(res.data.map(item => [item.id, item.tosTopicId]))
        let changed = 0
        setCards(prev => prev.map(c => {
          if (mode === 'untagged-only' && c.tosTopicId) {
            return c
          }
          if (resultMap.has(c.id)) {
            const newTos = resultMap.get(c.id) || null
            if (newTos !== c.tosTopicId) {
              changed++
              return { ...c, tosTopicId: newTos }
            }
          }
          return c
        }))
        const taggedCount = res.data.filter(d => d.tosTopicId).length
        setToast({
          type: 'success',
          msg: `Auto-tagged ${taggedCount} cards with TOS topics (${changed} updated)`,
        })
      } else {
        setToast({ type: 'error', msg: res?.error || 'Classification failed' })
      }
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message || 'Classification failed' })
    } finally {
      setIsClassifyingTos(false)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setToast(null), 3000)
    }
  }

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

  useEffect(() => {
    // Only detect if there is at least one card with user content
    const nonEmpty = cards.filter(hasCardContent)
    if (nonEmpty.length === 0) return

    const result = detectSubjectFromCards(cards)
    if (result.confidence > 0.2) {
      setMetadata(prev => ({ ...prev, subject: result.subject }))
    }
  }, [cards])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Initialize with 3 empty cards when changing deck type if empty
  useEffect(() => {
    if (cards.length === 0) {
      const initialCards: EditCard[] = Array.from({ length: 3 }).map(() => ({
        id: uid(),
        type: deckType,
        isNew: true,
        data: deckType === 'mcq'
          ? { question: '', choices: ['', '', '', ''], answer: 0, explanation: '', choicesPlainText: [true, true, true, true] }
          : deckType === 'formula'
            ? { name: '', latex: '', description: '', variables: '' }
            : { front: '', back: '' }
      }))
      setCards(initialCards)
    }
  }, [deckType, cards.length])

  // Handle deck type toggle (warn if switching with filled data)
  const performTypeChange = (newType: 'mcq' | 'flashcard' | 'formula'): boolean => {
    if (newType === deckType) return true
    const hasData = cards.some(c => {
      if (c.type === 'mcq') return (c.data as MCQEdit).question.trim().length > 0;
      if (c.type === 'formula') return (c.data as FormulaEdit).name.trim().length > 0;
      return (c.data as FlashcardEdit).front.trim().length > 0;
    })

    if (hasData) {
      setPendingType(newType)
      setShowConfirmTypeModal(true)
      return false
    }

    setDeckType(newType)
    const newScope = newType === 'formula' ? 'formula' : 'study'
    const oldScope = deckType === 'formula' ? 'formula' : 'study'
    if (newScope !== oldScope) {
      setMetadata(prev => ({ ...prev, folderName: '' }))
    }
    const initialCards: EditCard[] = Array.from({ length: 3 }).map(() => ({
      id: uid(),
      type: newType,
      isNew: true,
      data: newType === 'mcq'
        ? { question: '', choices: ['', '', '', ''], answer: 0, explanation: '', choicesPlainText: [true, true, true, true] }
        : newType === 'formula'
          ? { name: '', latex: '', description: '', variables: '' }
          : { front: '', back: '' }
    }))
    setCards(initialCards)
    return true
  }

  const handleDeckTypeChange = (newType: 'mcq' | 'flashcard' | 'formula') => {
    performTypeChange(newType)
  }

  const handleConfirmTypeChange = () => {
    if (!pendingType) return
    const newType = pendingType

    setDeckType(newType)
    const newScope = newType === 'formula' ? 'formula' : 'study'
    const oldScope = deckType === 'formula' ? 'formula' : 'study'
    if (newScope !== oldScope) {
      setMetadata(prev => ({ ...prev, folderName: '' }))
    }
    const initialCards: EditCard[] = Array.from({ length: 3 }).map(() => ({
      id: uid(),
      type: newType,
      isNew: true,
      data: newType === 'mcq'
        ? { question: '', choices: ['', '', '', ''], answer: 0, explanation: '', choicesPlainText: [true, true, true, true] }
        : newType === 'formula'
          ? { name: '', latex: '', description: '', variables: '' }
          : { front: '', back: '' }
    }))
    setCards(initialCards)
    setShowConfirmTypeModal(false)
    setPendingType(null)
  }

  const openImportModal = (type: 'mcq' | 'flashcard') => {
    if (performTypeChange(type)) {
      setImportModalType(type)
    }
  }

  const addCard = () => {
    const newCard: EditCard = {
      id: uid(),
      type: deckType,
      isNew: true,
      data: deckType === 'mcq'
        ? { question: '', choices: ['', '', '', ''], answer: 0, explanation: '', choicesPlainText: [true, true, true, true] }
        : deckType === 'formula'
          ? { name: '', latex: '', description: '', variables: '' }
          : { front: '', back: '' }
    }
    setCards(prev => [...prev, newCard])
  }

  const updateCard = (id: string, update: Partial<EditCard>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...update, isNew: false } : c))
  }

  const deleteCard = (id: string) => {
    saveSnapshot(cardsRef.current)
    setCards(prev => prev.filter(c => c.id !== id))
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

  const handleImportMCQs = (imported: { mcqData?: any }[]) => {
    const newRows: EditCard[] = imported.filter(c => c.mcqData).map(c => ({
      id: uid(),
      type: 'mcq',
      isNew: false,
      data: {
        question: c.mcqData.question || '',
        choices: c.mcqData.choices || ['', '', '', ''],
        answer: c.mcqData.answer !== undefined ? c.mcqData.answer : 0,
        explanation: c.mcqData.explanation || '',
        choicesPlainText: [true, true, true, true]
      }
    }))

    saveSnapshot(cardsRef.current)
    setCards(prev => {
      const isAllEmpty = prev.every(c => {
        if (c.type === 'mcq') return !(c.data as MCQEdit).question.trim();
        if (c.type === 'formula') return !(c.data as FormulaEdit).name.trim();
        return !(c.data as FlashcardEdit).front.trim();
      });
      if (isAllEmpty) return newRows;
      return [...prev, ...newRows];
    })
  }

  const handleImportFlashcards = (imported: { flashcardData?: any }[]) => {
    const newRows: EditCard[] = imported.filter(c => c.flashcardData).map(c => ({
      id: uid(),
      type: 'flashcard',
      isNew: false,
      data: {
        front: c.flashcardData.front || '',
        back: c.flashcardData.back || '',
      }
    }))

    saveSnapshot(cardsRef.current)
    setCards(prev => {
      const isAllEmpty = prev.every(c => {
        if (c.type === 'mcq') return !(c.data as MCQEdit).question.trim();
        if (c.type === 'formula') return !(c.data as FormulaEdit).name.trim();
        return !(c.data as FlashcardEdit).front.trim();
      });
      if (isAllEmpty) return newRows;
      return [...prev, ...newRows];
    })
  }

  // Validation
  const isValidCard = (card: EditCard) => {
    if (card.type === 'mcq') {
      const d = card.data as MCQEdit
      return d.question.trim().length > 0 && d.choices.every(c => c.trim().length > 0)
    } else if (card.type === 'formula') {
      const d = card.data as FormulaEdit
      return d.name.trim().length > 0 && d.latex.trim().length > 0
    } else {
      const d = card.data as FlashcardEdit
      return d.front.trim().length > 0 && d.back.trim().length > 0
    }
  }

  const validCards = cards.filter(isValidCard)
  const canSave = metadata.title.trim().length > 0 && validCards.length > 0

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)

    const serializeCardData = (data: any) => {
      if (typeof data === 'string') return data
      return JSON.stringify(data)
    }

    const { title, description, subject, folderName, deckTags } = metadata

    try {
      const topicId = 'topic_' + Date.now().toString(36)

      const payload = {
        topicId,
        name: title.trim(),
        subject: subject,
        description: description.trim(),
        tags: JSON.stringify(deckTags),
        folderName: folderName.trim(),
        folderId: metadata.folderId,
        scope: deckType === 'formula' ? 'formula' : 'study',
        defaultTosTopicId: metadata.defaultTosTopicId || null,
        cards: validCards.map(card => {
          const cardId = 'card_' + Math.random().toString(36).substr(2, 9)
          const cleanedData = stripPlaceholders(card.data)
          return {
            id: cardId,
            type: card.type,
            data: serializeCardData(cleanedData),
            is_custom: 1,
            tos_topic_id: card.tosTopicId || metadata.defaultTosTopicId || null,
          }
        })
      };

      const res = await window.electron.decks.addDeckWithCards(payload)
      if (!res.success) throw new Error(res.error)
      useDataVersionStore.getState().bump()
      navigate(deckType === 'formula' ? '/formulas' : '/study')
    } catch (err: any) {
      console.error('Save failed', err)
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full bg-transparent overflow-y-auto show-scrollbar flex flex-col font-['JetBrains_Mono']">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-14 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-lg border shadow-2xl font-['Rajdhani'] tracking-wider text-sm ${toast.type === 'success'
              ? 'bg-[#0a1a0a] border-accent/40 text-accent'
              : 'bg-[#1a0a0a] border-[#FF4444]/40 text-[#FF4444]'
              }`}
          >
            {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-engine-black/90 backdrop-blur-md border-b border-surface shrink-0">
        <div className="w-full px-6 py-4 flex items-center justify-between relative">
          <div className="w-1/3 flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors font-['Rajdhani'] uppercase tracking-widest text-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={() => setShowFormattingGuide(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#2a2a2a] bg-[#111] text-text-muted hover:text-accent hover:border-accent/40 transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs font-bold"
            >
              <Type className="w-3.5 h-3.5" />
              Format Guide
            </button>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-none">
            <PlusCircle className="text-[var(--accent-primary)]" size={28} />
            <h1 className="font-['Orbitron'] text-3xl font-bold tracking-wider m-0">
              <span className="text-[var(--accent-primary)]">ADD</span> <span className="text-white">DECKS</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                className={`px-8 py-2.5 font-['Rajdhani'] uppercase tracking-widest font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap ${canSave && !saving
                  ? 'bg-[var(--accent-primary)] text-black hover:bg-[var(--accent-dim)] shadow-[0_0_15px_rgba(0,255,65,0.25)]'
                  : 'bg-border-base text-[#555] cursor-not-allowed'
                  }`}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Deck'}
              </button>
              {!canSave && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-full right-0 mt-2 w-48 p-2 bg-surface-2 border border-[#333] rounded shadow-xl text-center text-xs font-['JetBrains_Mono'] text-text-muted pointer-events-none z-50">
                  Add a title and at least one complete card to save
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8 xl:grid xl:grid-cols-3 xl:gap-6 flex flex-col gap-8 pb-32 items-center xl:items-start">

        {/* 1. Metadata & Tags — Pane 1 (sticky left) */}
        <DeckMetadataForm
          metadata={metadata}
          setMetadata={setMetadata}
          scope={deckType === 'formula' ? 'formula' : 'study'}
          cards={cards}
          onToast={(type, msg) => {
            setToast({ type, msg })
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
            toastTimerRef.current = setTimeout(() => setToast(null), type === 'error' ? 3500 : 2500)
          }}
        />

        {/* 2 & 3. Cards Pane — Pane 2 (right, 2/3 wide) */}
        <div className="w-full max-w-4xl xl:max-w-none xl:col-span-2 flex flex-col gap-6">
          <section className="flex flex-row flex-wrap items-center justify-between gap-4">
            {/* Deck Type Toggle */}
            <div className="flex flex-row w-auto bg-[#111] border border-border-base p-1 rounded-lg gap-1">
              <button
                onClick={() => handleDeckTypeChange('mcq')}
                className={`w-auto px-6 py-2.5 rounded-md font-['Rajdhani'] uppercase tracking-widest font-bold text-sm transition-all whitespace-nowrap ${deckType === 'mcq'
                  ? 'bg-border-base text-accent shadow-sm'
                  : 'text-text-muted hover:text-[#ccc]'
                  }`}
              >
                MCQ Set
              </button>
              <button
                onClick={() => handleDeckTypeChange('flashcard')}
                className={`w-auto px-6 py-2.5 rounded-md font-['Rajdhani'] uppercase tracking-widest font-bold text-sm transition-all whitespace-nowrap ${deckType === 'flashcard'
                  ? 'bg-border-base text-accent shadow-sm'
                  : 'text-text-muted hover:text-[#ccc]'
                  }`}
              >
                Flashcard Set
              </button>
              <button
                onClick={() => handleDeckTypeChange('formula')}
                className={`w-auto px-6 py-2.5 rounded-md font-['Rajdhani'] uppercase tracking-widest font-bold text-sm transition-all whitespace-nowrap ${deckType === 'formula'
                  ? 'bg-border-base text-accent shadow-sm'
                  : 'text-text-muted hover:text-[#ccc]'
                  }`}
              >
                Formula Set
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 justify-end">
              <Tooltip
                content="Automatically classify and tag all cards in this deck using the offline PRC TOS classifier"
                position="bottom"
              >
                <button
                  type="button"
                  onClick={onAutoTagClick}
                  disabled={isClassifyingTos || cards.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded border border-accent/40 bg-surface-2 text-accent hover:bg-accent/10 hover:border-accent font-['Rajdhani'] uppercase tracking-widest text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Tag size={14} className={isClassifyingTos ? 'animate-spin' : ''} />
                  {isClassifyingTos ? 'Tagging...' : 'Auto-Tag Cards'}
                </button>
              </Tooltip>
              <button
                onClick={() => openImportModal('mcq')}
                className="flex items-center gap-2 px-4 py-2 rounded border border-[#333] bg-surface-2 text-text-muted hover:text-accent hover:border-accent/50 font-['Rajdhani'] uppercase tracking-widest text-xs font-bold transition-all"
              >
                <Upload size={14} /> Import MCQs
              </button>
              <button
                onClick={() => openImportModal('flashcard')}
                className="flex items-center gap-2 px-4 py-2 rounded border border-[#333] bg-surface-2 text-text-muted hover:text-accent hover:border-accent/50 font-['Rajdhani'] uppercase tracking-widest text-xs font-bold transition-all"
              >
                <Upload size={14} /> Import Flashcards
              </button>
            </div>
          </section>

          {/* 3. The Manual Editor */}
          <section className="flex flex-col gap-3">
            <DndContext
              sensors={sensors}
              collisionDetection={customCollisionDetection}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <AnimatePresence>
                  {cards.map((card, i) => (
                    <CardEditor
                      key={card.id}
                      card={card}
                      index={i}
                      subject={metadata.subject}
                      onUpdate={updateCard}
                      onDelete={deleteCard}
                      onError={handleCardError}
                    />
                  ))}
                </AnimatePresence>
              </SortableContext>
            </DndContext>

            {/* 4. Footer Actions */}
            <div className="mt-4 flex items-center gap-3">
              {historyStack.length > 0 && (
                <Tooltip content="Undo (Ctrl+Z)" position="top">
                  <button
                    onClick={undo}
                    className="flex items-center justify-center p-5 rounded-lg border-2 border-[#666] text-[#666] hover:text-accent hover:border-accent transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </Tooltip>
              )}
              <button
                onClick={addCard}
                className="w-full py-5 rounded-lg border-2 border-dashed border-[#333] bg-[#111] hover:bg-surface-2 hover:border-accent/50 text-text-muted hover:text-accent flex flex-col items-center justify-center gap-2 transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-surface group-hover:bg-accent/10 flex items-center justify-center transition-colors">
                  <Plus size={18} />
                </div>
                <span className="font-['Rajdhani'] font-bold uppercase tracking-widest text-sm">Add Card</span>
              </button>
            </div>
          </section>
        </div>{/* end Pane 2 */}

      </div>

      {importModalType === 'mcq' && (
        <ImportModal
          onImportCards={handleImportMCQs}
          onClose={() => setImportModalType('none')}
        />
      )}

      {importModalType === 'flashcard' && (
        <ImportFlashcardsModal
          onImportCards={handleImportFlashcards}
          onClose={() => setImportModalType('none')}
        />
      )}

      {/* Change Type Confirmation Modal */}
      <AnimatePresence>
        {showConfirmTypeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-engine-black border border-[#FF4B4B] rounded-lg shadow-[0_0_30px_rgba(255,75,75,0.15)] w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-border-base flex items-center gap-3 bg-[#111]">
                <AlertTriangle className="w-6 h-6 text-[#FF4B4B]" />
                <h2 className="text-xl font-bold text-text-primary font-['Rajdhani'] uppercase tracking-wider">
                  Change Set Type
                </h2>
              </div>
              <div className="p-6">
                <p className="text-[#CCCCCC] font-['Rajdhani'] tracking-wider mb-4 leading-relaxed text-base">
                  Switching to <strong className="text-text-primary font-bold">{pendingType === 'mcq' ? 'MCQ Set' : pendingType === 'flashcard' ? 'Flashcard Set' : 'Formula Set'}</strong> will permanently clear all current cards in this editor. This action cannot be undone.
                </p>
              </div>
              <div className="p-6 border-t border-border-base bg-[#111] flex justify-end gap-3">
                <button
                  onClick={() => { setShowConfirmTypeModal(false); setPendingType(null); }}
                  className="px-5 py-2 rounded bg-transparent border border-[#333] text-text-muted hover:text-text-primary hover:border-[#555] transition-colors font-['Rajdhani'] uppercase tracking-wider text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmTypeChange}
                  className="px-6 py-2 rounded bg-[#FF4B4B] text-white hover:bg-[#D32F2F] font-bold transition-all font-['Rajdhani'] uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(255,75,75,0.3)]"
                >
                  Proceed
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showFormattingGuide && (
        <FormattingGuideModal onClose={() => setShowFormattingGuide(false)} />
      )}

      <AutoTagConfirmModal
        isOpen={showAutoTagModal}
        taggedCount={cards.filter(c => !!c.tosTopicId).length}
        totalCount={cards.length}
        onOverwriteAll={() => executeAutoClassifyTos('overwrite')}
        onTagUntaggedOnly={() => executeAutoClassifyTos('untagged-only')}
        onClose={() => setShowAutoTagModal(false)}
      />
    </div>
  )
}
