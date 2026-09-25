import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowLeft, Save, ChevronDown, ChevronUp, Trash2, GripVertical, Plus,
  CheckCircle2, AlertCircle, RotateCcw, ImageIcon, X, Sigma,
  Calculator, FlaskConical, Zap, Cpu, FileText, Type, Eye, EyeOff, Upload, Sparkles
} from 'lucide-react'
import { FormattingGuideModal } from '../components/deck/CardForms'
import { ImportModal, ImportFlashcardsModal } from '../components/deck/ImportModals'
import { renderMath, isRawLatex } from '../lib/latex'
import { getSubjectFilterClasses } from '../lib/subjectColors'
import { TOS_SUBJECT_COLORS } from '../lib/tosData'
import { getAllAvailableTags, saveCustomTag, markTagDeleted } from '../lib/tags'
import { TagDeleteConfirmModal, AffectedDeck } from '../components/deck/TagDeleteConfirmModal'
import { AIDescriptionButton } from '../components/deck/AIDescriptionButton'
import { Tooltip } from '../components/ui/Tooltip'
import { generateDeckSummary } from '../services/aiSummary.service'
import { useDataVersionStore } from '../store/useDataVersionStore'
import { getTosTopicsBySubject, formatTosBadge } from '../lib/tosClassification'
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
  folderId: string | null
}

interface EditCard {
  id: string
  type: 'mcq' | 'flashcard' | 'formula'
  data: MCQEdit | FlashcardEdit | FormulaEdit
  isNew?: boolean
  defaultExpanded?: boolean
  tosTopicId?: string | null
}

interface MCQEdit {
  question: string
  choices: [string, string, string, string]
  answer: number
  explanation: string
  imagePath?: string
  solutionImagePath?: string
  choicesPlainText?: boolean[]
}

interface FlashcardEdit {
  front: string
  back: string
  imagePath?: string
  imageBack?: string
  explanation?: string           // ADD
  explanationImagePath?: string  // ADD
}

interface FormulaEdit {
  name: string
  latex: string
  description: string
  variables: string
  imagePathFront?: string
  imageBack?: string
  explanation?: string
  explanationImagePath?: string
  backIsPlainText?: boolean
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted mb-1 block">{children}</span>
)

const inputCls = "w-full bg-engine-black border border-border-subtle rounded px-3 py-2 text-text-primary font-['JetBrains_Mono'] text-sm outline-none focus:border-accent transition-colors placeholder-[#555]"
const textareaCls = `${inputCls} resize-none leading-relaxed`

// ── MathInputField: text area with ∑ toggle for MathLive equation entry ──────
interface MathInputFieldProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  rows?: number
  multiline?: boolean
  defaultMathMode?: boolean
  onMathModeChange?: (isMathMode: boolean) => void
}

const MathInputField: React.FC<MathInputFieldProps> = ({
  value, onChange, placeholder, rows = 3, multiline = true, defaultMathMode = false, onMathModeChange
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

    const spaceHandler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        e.stopPropagation()
        const mathEl = el as any
        if (typeof mathEl.executeCommand === 'function') {
          mathEl.executeCommand(['insert', '\\text{ }'])
        } else if (typeof mathEl.insert === 'function') {
          mathEl.insert('\\text{ }')
        }
      }
    }
    el.addEventListener('keydown', spaceHandler)

    return () => {
      el.removeEventListener('input', handler)
      el.removeEventListener('keydown', spaceHandler)
    }
  }, [mathMode, onChange])

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [value, mathMode])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)

    if (e.key === 'Tab') {
      e.preventDefault()
      const next = value.slice(0, start) + '    ' + value.slice(end)
      onChange(next)
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 4 })
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      const wrapped = selected ? `**${selected}**` : '****'
      onChange(value.slice(0, start) + wrapped + value.slice(end))
      requestAnimationFrame(() => {
        el.selectionStart = selected ? start : start + 2
        el.selectionEnd = selected ? start + wrapped.length : start + 2
      })
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault()
      const wrapped = selected ? `*${selected}*` : '**'
      onChange(value.slice(0, start) + wrapped + value.slice(end))
      requestAnimationFrame(() => {
        el.selectionStart = selected ? start : start + 1
        el.selectionEnd = selected ? start + wrapped.length : start + 1
      })
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault()
      const wrapped = selected ? `__${selected}__` : '____'
      onChange(value.slice(0, start) + wrapped + value.slice(end))
      requestAnimationFrame(() => {
        el.selectionStart = selected ? start : start + 2
        el.selectionEnd = selected ? start + wrapped.length : start + 2
      })
      return
    }
  }

  return (
    <div className="relative flex flex-col gap-2 w-full flex-1">
      <Tooltip
        content={mathMode ? 'Switch to text mode' : 'Switch to equation mode'}
        position="top"
        className="absolute top-2 right-2 z-10"
      >
        <button
          type="button"
          onClick={() => {
            setMathMode(m => {
              const next = !m
              onMathModeChange?.(next)
              return next
            })
          }}
          className="flex items-center justify-center min-w-[28px] h-[24px] px-2 rounded-full bg-[#1C1C1C] border border-[rgba(0,255,65,0.3)] text-accent hover:bg-[rgba(0,255,65,0.1)] font-bold text-xs transition-colors shadow-sm"
        >
          {mathMode ? 'Aa' : <Sigma size={12} />}
        </button>
      </Tooltip>

      {!mathMode ? (
        multiline ? (
          <textarea
            ref={textareaRef}
            rows={rows}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`${textareaCls} pr-10`}
            style={{ resize: 'none', overflow: 'hidden' }}
            onInput={(e) => {
              const el = e.currentTarget as HTMLTextAreaElement
              el.style.height = 'auto'
              el.style.height = el.scrollHeight + 'px'
            }}
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
              fontFamily: "'JetBrains Mono', monospace",
              '--keyboard-zindex': '99999',
            } as React.CSSProperties & Record<string, string>}
          />
          {value.trim().length > 0 && (
            <div className="bg-[#1C1C1C] border border-[rgba(0,255,65,0.1)] rounded-lg p-3">
              <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted mb-1">Preview</div>
              {(() => {
                try {
                  const previewText = !value.includes('$') && isRawLatex(value) ? `$${value}$` : value
                  return <div className="text-text-primary" dangerouslySetInnerHTML={{ __html: renderMath(previewText) }} />
                } catch {
                  return <code className="text-text-primary break-all">{value}</code>
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
const FormulaForm: React.FC<{ data: FormulaEdit; onChange: (d: FormulaEdit) => void; isNew?: boolean; onError?: (msg: string) => void }> = ({ data, onChange, onError }) => {
  const hasExplanation = Boolean((data.explanation && data.explanation.trim().length > 0) || data.explanationImagePath)
  const [showExplanation, setShowExplanation] = useState(hasExplanation)
  const isExplanationOpen = showExplanation || hasExplanation
  const [showExplanationPreview, setShowExplanationPreview] = useState(false)

  const handleExplanationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { onError?.('Image exceeds 10MB limit.'); e.target.value = ''; return }
    const path = (file as any).path
    if (!path) return
    try {
      const result = await window.electron.saveImage(path)
      if (result.success && result.filename) onChange({ ...data, explanationImagePath: result.filename })
      else onError?.(result.error || 'Failed to save image')
    } catch (err: any) { onError?.('Error saving image: ' + err.message) }
    e.target.value = ''
  }

  const handleFrontImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { onError?.('Image exceeds 10MB limit.'); e.target.value = ''; return }
    const path = (file as any).path
    if (!path) return
    try {
      const result = await window.electron.saveImage(path)
      if (result.success && result.filename) onChange({ ...data, imagePathFront: result.filename })
      else onError?.(result.error || 'Failed to save image')
    } catch (err: any) { onError?.('Error saving image: ' + err.message) }
    e.target.value = ''
  }

  const handleBackImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { onError?.('Image exceeds 10MB limit.'); e.target.value = ''; return }
    const path = (file as any).path
    if (!path) return
    try {
      const result = await window.electron.saveImage(path)
      if (result.success && result.filename) onChange({ ...data, imageBack: result.filename })
      else onError?.(result.error || 'Failed to save image')
    } catch (err: any) { onError?.('Error saving image: ' + err.message) }
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full">
        <div className="flex items-center justify-between mb-1">
          <Label>Front / Term (formula name)</Label>
          <div className="mr-[6px]">
            {data.imagePathFront ? (
              <div className="relative group flex items-center justify-center">
                <img src={`ece-app://${data.imagePathFront}`} className="w-5 h-5 object-cover rounded border border-[#333]" alt="Front image" />
                <Tooltip content="Remove image" position="top" className="absolute -top-1 -right-1">
                  <button type="button" onClick={() => onChange({ ...data, imagePathFront: undefined })}
                    className="bg-[#FF4B4B] text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={10} />
                  </button>
                </Tooltip>
              </div>
            ) : (
              <Tooltip content="Add Front Image" position="top">
                <label className="cursor-pointer text-text-muted hover:text-accent transition-colors">
                  <ImageIcon size={16} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleFrontImageUpload} />
                </label>
              </Tooltip>
            )}
          </div>
        </div>
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
        <div className="flex items-center justify-between mb-1">
          <Label>Back / LaTeX (equation)</Label>
          <div className="mr-[6px]">
            {data.imageBack ? (
              <div className="relative group flex items-center justify-center">
                <img src={`ece-app://${data.imageBack}`} className="w-5 h-5 object-cover rounded border border-[#333]" alt="Back image" />
                <Tooltip content="Remove image" position="top" className="absolute -top-1 -right-1">
                  <button type="button" onClick={() => onChange({ ...data, imageBack: undefined })}
                    className="bg-[#FF4B4B] text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={10} />
                  </button>
                </Tooltip>
              </div>
            ) : (
              <Tooltip content="Add Back Image" position="top">
                <label className="cursor-pointer text-text-muted hover:text-accent transition-colors">
                  <ImageIcon size={16} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleBackImageUpload} />
                </label>
              </Tooltip>
            )}
          </div>
        </div>
        <MathInputField
          value={data.latex || ''}
          onChange={val => onChange({ ...data, latex: val })}
          placeholder="LaTeX equation, e.g. \\sin^{-1}u..."
          rows={5}
          multiline={true}
          defaultMathMode={!data.backIsPlainText}
          onMathModeChange={(isMath) => onChange({ ...data, backIsPlainText: !isMath })}
        />
      </div>


      {/* EXPLANATION */}
      <div className="w-full">
        {!showExplanation ? (
          <button type="button" onClick={() => setShowExplanation(true)}
            className="text-[11px] font-['Rajdhani'] uppercase tracking-widest text-text-muted hover:text-accent transition-colors font-bold">
            + Add Explanation
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <Label>Explanation / Notes</Label>
              <div className="flex items-center gap-2 mr-[6px]">
                <Tooltip content={showExplanationPreview ? 'Hide preview' : 'Preview formatting'} position="top">
                  <button
                    type="button"
                    onClick={() => setShowExplanationPreview(p => !p)}
                    className="text-text-muted hover:text-accent transition-colors"
                  >
                    {showExplanationPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </Tooltip>
                {data.explanationImagePath ? (
                  <div className="relative group flex items-center justify-center">
                    <img src={`ece-app://${data.explanationImagePath}`} className="w-5 h-5 object-cover rounded border border-[#333]" alt="Explanation image" />
                    <Tooltip content="Remove image" position="top" className="absolute -top-1 -right-1">
                      <button type="button" onClick={() => onChange({ ...data, explanationImagePath: undefined })}
                        className="bg-[#FF4B4B] text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    </Tooltip>
                  </div>
                ) : (
                  <Tooltip content="Add Explanation Image" position="top">
                    <label className="cursor-pointer text-text-muted hover:text-accent transition-colors">
                      <ImageIcon size={16} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleExplanationImageUpload} />
                    </label>
                  </Tooltip>
                )}
              </div>
            </div>
            <MathInputField value={data.explanation || ''} onChange={val => onChange({ ...data, explanation: val })} placeholder="Explain the formula, derivation, variable meanings..." rows={6} multiline={true} />
            {showExplanationPreview && (data.explanation || '').trim().length > 0 && (
              <div className="bg-[#0d0d0d] border border-[rgba(0,255,65,0.1)] rounded-lg p-3 mt-1">
                <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted mb-2">Preview</div>
                <div
                  className="text-sm font-['JetBrains_Mono'] text-[#d4d4d4] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMath(data.explanation || '') }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface CardRowProps {
  card: EditCard
  index: number
  isExpanded: boolean
  subject?: string
  onToggleExpand: (id: string) => void
  onUpdate: (id: string, data: Partial<EditCard>) => void
  onDelete: (id: string) => void
  onError?: (msg: string) => void
}

const MCQForm: React.FC<{ data: MCQEdit; onChange: (d: MCQEdit) => void; isNew?: boolean; onError?: (msg: string) => void }> = ({ data, onChange, isNew, onError }) => {
  const hasSolution = Boolean(
    (data.explanation && data.explanation.trim().length > 0) ||
    data.solutionImagePath
  )
  const [showSolution, setShowSolution] = useState(hasSolution)
  const isSolutionOpen = showSolution || hasSolution
  const [showSolutionPreview, setShowSolutionPreview] = useState(false)
  const set = (patch: Partial<MCQEdit>) => onChange({ ...data, ...patch })
  const setChoice = (i: number, val: string) => {
    const choices = [...data.choices] as MCQEdit['choices']
    choices[i] = val
    set({ choices })
  }
  const setChoicePlainText = (i: number, isPlain: boolean) => {
    const arr = [...(data.choicesPlainText || [true, true, true, true])]
    arr[i] = isPlain
    set({ choicesPlainText: arr })
  }
  const labels = ['A', 'B', 'C', 'D']

  const handleSolutionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        set({ solutionImagePath: result.filename })
      } else {
        if (onError) onError(result.error || 'Failed to save image')
      }
    } catch (err: any) {
      console.error(err)
      if (onError) onError('Error saving image: ' + err.message)
    }
    e.target.value = ''
  }

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
            defaultMathMode={false}
          />
        </div>
        <div className="shrink-0 flex flex-col items-center justify-start mt-5">
          {data.imagePath ? (
            <div className="relative group">
              <img src={`ece-app://${data.imagePath}`} alt="Question image" className="w-24 h-24 object-cover rounded border border-[#333]" />
              <Tooltip content="Remove image" position="top" className="absolute -top-2 -right-2">
                <button
                  onClick={() => set({ imagePath: undefined })}
                  className="bg-[#FF4B4B] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <X size={12} />
                </button>
              </Tooltip>
            </div>
          ) : (
            <label className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-[#333] hover:border-accent hover:text-accent text-text-muted rounded transition-colors bg-[#0a0a0a]">
              <ImageIcon size={24} />
              <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest mt-2 font-bold text-center leading-tight">Add<br />Image</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
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
                multiline={true}
                rows={1}
                defaultMathMode={data.choicesPlainText ? !data.choicesPlainText[i] : (isRawLatex(choice) || choice.includes('$'))}
                onMathModeChange={(isMath) => setChoicePlainText(i, !isMath)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="w-full">
        {!isSolutionOpen ? (
          <button
            type="button"
            onClick={() => setShowSolution(true)}
            className="text-[11px] font-['Rajdhani'] uppercase tracking-widest text-text-muted hover:text-accent transition-colors font-bold"
          >
            + Add Solution
          </button>
        ) : (
          <div className="flex flex-col gap-1 transition-all">
            <div className="flex items-center justify-between mb-1">
              <Label>Solution</Label>
              <div className="flex items-center gap-2 mr-[6px]">
                <Tooltip content={showSolutionPreview ? 'Hide preview' : 'Preview formatting'} position="top">
                  <button
                    type="button"
                    onClick={() => setShowSolutionPreview(p => !p)}
                    className="text-text-muted hover:text-accent transition-colors"
                  >
                    {showSolutionPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </Tooltip>
                {data.solutionImagePath ? (
                  <div className="relative group flex items-center justify-center">
                    <img src={`ece-app://${data.solutionImagePath}`} className="w-5 h-5 object-cover rounded border border-[#333]" alt="Solution image" />
                    <Tooltip content="Remove image" position="top" className="absolute -top-1 -right-1">
                      <button type="button" onClick={() => set({ solutionImagePath: undefined })}
                        className="bg-[#FF4B4B] text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    </Tooltip>
                  </div>
                ) : (
                  <Tooltip content="Add Solution Image" position="top">
                    <label className="cursor-pointer text-text-muted hover:text-accent transition-colors">
                      <ImageIcon size={16} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleSolutionImageUpload} />
                    </label>
                  </Tooltip>
                )}
                {!hasSolution && (
                  <Tooltip content="Hide solution" position="top">
                    <button
                      type="button"
                      onClick={() => setShowSolution(false)}
                      className="text-text-muted hover:text-[#FF4B4B] transition-colors p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
            <MathInputField
              value={data.explanation || ''}
              onChange={val => set({ explanation: val })}
              placeholder="Write the solution or reasoning for the correct answer..."
              rows={6}
              multiline={true}
              defaultMathMode={false}
            />
            {showSolutionPreview && (data.explanation || '').trim().length > 0 && (
              <div className="bg-[#0d0d0d] border border-[rgba(0,255,65,0.1)] rounded-lg p-3 mt-1">
                <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted mb-2">Preview</div>
                <div
                  className="text-sm font-['JetBrains_Mono'] text-[#d4d4d4] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMath(data.explanation || '') }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const FlashcardForm: React.FC<{ data: FlashcardEdit; onChange: (d: FlashcardEdit) => void; isNew?: boolean; onError?: (msg: string) => void }> = ({ data, onChange, isNew, onError }) => {
  const hasExplanation = Boolean((data.explanation && data.explanation.trim().length > 0) || data.explanationImagePath)
  const [showExplanation, setShowExplanation] = useState(hasExplanation)
  const isExplanationOpen = showExplanation || hasExplanation
  const [showExplanationPreview, setShowExplanationPreview] = useState(false)

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

  const handleExplanationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { onError?.('Image exceeds 10MB limit.'); e.target.value = ''; return }
    const path = (file as any).path
    if (!path) return
    try {
      const result = await window.electron.saveImage(path)
      if (result.success && result.filename) onChange({ ...data, explanationImagePath: result.filename })
      else onError?.(result.error || 'Failed to save image')
    } catch (err: any) { onError?.('Error saving image: ' + err.message) }
    e.target.value = ''
  }

  const handleBackImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { onError?.('Image exceeds 10MB limit.'); e.target.value = ''; return }
    const path = (file as any).path
    if (!path) return
    try {
      const result = await window.electron.saveImage(path)
      if (result.success && result.filename) onChange({ ...data, imageBack: result.filename })
      else onError?.(result.error || 'Failed to save image')
    } catch (err: any) { onError?.('Error saving image: ' + err.message) }
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
            <div className="flex items-center justify-between mb-1">
              <Label>Back / Definition</Label>
              <div className="mr-[6px]">
                {data.imageBack ? (
                  <div className="relative group flex items-center justify-center">
                    <img src={`ece-app://${data.imageBack}`} className="w-5 h-5 object-cover rounded border border-[#333]" alt="Back image" />
                    <Tooltip content="Remove image" position="top" className="absolute -top-1 -right-1">
                      <button type="button" onClick={() => onChange({ ...data, imageBack: undefined })}
                        className="bg-[#FF4B4B] text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    </Tooltip>
                  </div>
                ) : (
                  <Tooltip content="Add Back Image" position="top">
                    <label className="cursor-pointer text-text-muted hover:text-accent transition-colors">
                      <ImageIcon size={16} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleBackImageUpload} />
                    </label>
                  </Tooltip>
                )}
              </div>
            </div>
            <textarea rows={8} className={textareaCls} value={data.back}
              onChange={e => onChange({ ...data, back: e.target.value })} placeholder="Definition or answer..." />
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-center justify-start mt-5">
          {data.imagePath ? (
            <div className="relative group">
              <img src={`ece-app://${data.imagePath}`} alt="Flashcard image" className="w-24 h-24 object-cover rounded border border-[#333]" />
              <Tooltip content="Remove image" position="top" className="absolute -top-2 -right-2">
                <button
                  onClick={() => onChange({ ...data, imagePath: undefined })}
                  className="bg-[#FF4B4B] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <X size={12} />
                </button>
              </Tooltip>
            </div>
          ) : (
            <label className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-[#333] hover:border-accent hover:text-accent text-text-muted rounded transition-colors bg-[#0a0a0a]">
              <ImageIcon size={24} />
              <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest mt-2 font-bold text-center leading-tight">Add<br />Image</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          )}
        </div>
      </div>

      {/* EXPLANATION */}
      <div className="w-full">
        {!isExplanationOpen ? (
          <button type="button" onClick={() => setShowExplanation(true)}
            className="text-[11px] font-['Rajdhani'] uppercase tracking-widest text-text-muted hover:text-accent transition-colors font-bold">
            + Add Explanation
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <Label>Explanation / Notes</Label>
              <div className="flex items-center gap-2 mr-[6px]">
                <Tooltip content={showExplanationPreview ? 'Hide preview' : 'Preview formatting'} position="top">
                  <button
                    type="button"
                    onClick={() => setShowExplanationPreview(p => !p)}
                    className="text-text-muted hover:text-accent transition-colors"
                  >
                    {showExplanationPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </Tooltip>
                {data.explanationImagePath ? (
                  <div className="relative group flex items-center justify-center">
                    <img src={`ece-app://${data.explanationImagePath}`} className="w-5 h-5 object-cover rounded border border-[#333]" alt="Explanation image" />
                    <Tooltip content="Remove image" position="top" className="absolute -top-1 -right-1">
                      <button type="button" onClick={() => onChange({ ...data, explanationImagePath: undefined })}
                        className="bg-[#FF4B4B] text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={10} />
                      </button>
                    </Tooltip>
                  </div>
                ) : (
                  <Tooltip content="Add Explanation Image" position="top">
                    <label className="cursor-pointer text-text-muted hover:text-accent transition-colors">
                      <ImageIcon size={16} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleExplanationImageUpload} />
                    </label>
                  </Tooltip>
                )}
              </div>
            </div>
            <MathInputField value={data.explanation || ''} onChange={val => onChange({ ...data, explanation: val })} placeholder="Explain the answer, derivation, or additional notes..." rows={6} multiline={true} />
            {showExplanationPreview && (data.explanation || '').trim().length > 0 && (
              <div className="bg-[#0d0d0d] border border-[rgba(0,255,65,0.1)] rounded-lg p-3 mt-1">
                <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted mb-2">Preview</div>
                <div
                  className="text-sm font-['JetBrains_Mono'] text-[#d4d4d4] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMath(data.explanation || '') }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const CardRow: React.FC<CardRowProps & { dragHandleProps?: React.HTMLAttributes<HTMLElement> }> = ({ card, index, isExpanded, subject, onToggleExpand, onUpdate, onDelete, onError, dragHandleProps }) => {
  const preview = card.type === 'mcq'
    ? (card.data as MCQEdit).question || '(empty question)'
    : card.type === 'formula'
      ? (card.data as FormulaEdit).name || '(empty formula)'
      : (card.data as FlashcardEdit).front || '(empty term)'

  const truncated = preview.length > 72 ? preview.slice(0, 72) + '…' : preview

  return (
    <div
      className={`rounded-lg border transition-colors ${isExpanded ? 'border-accent/30 bg-[#0f1a0f]' : 'border-border-base bg-[#111] hover:border-[#333]'}`}
    >
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => onToggleExpand(card.id)}
      >
        <Tooltip content="Drag to reorder" position="top">
          <span
            {...dragHandleProps}
            onClick={e => e.stopPropagation()}
            className="text-[#444] hover:text-text-muted cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </span>
        </Tooltip>
        <span className="text-[#555] font-['JetBrains_Mono'] text-xs w-6 flex-shrink-0">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="flex-1 text-[#ccc] font-['JetBrains_Mono'] text-sm truncate">
          {card.type === 'formula' || truncated.includes('$') || truncated.includes('\\') ? (
            <span dangerouslySetInnerHTML={{ __html: renderMath(truncated) }} />
          ) : (
            truncated
          )}
        </span>
        {card.tosTopicId && (
          <span
            className="text-[9px] font-['JetBrains_Mono'] font-bold px-1.5 py-0.5 rounded border border-border-base bg-[#181818] text-[#888] truncate max-w-[130px] flex-shrink-0"
            title={formatTosBadge(card.tosTopicId) || ''}
          >
            {card.tosTopicId}
          </span>
        )}
        <span className={`text-[10px] font-['JetBrains_Mono'] font-bold px-2 py-0.5 rounded border uppercase flex-shrink-0 ${card.type === 'mcq'
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
        {isExpanded ? <ChevronUp className="w-4 h-4 text-[#555] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#555] flex-shrink-0" />}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-8 pt-4 border-t border-surface min-h-[220px]">
              <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-[#222]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-['Rajdhani'] font-bold uppercase tracking-wider text-text-muted">
                    TOS Category:
                  </span>
                  <select
                    value={card.tosTopicId || ''}
                    onChange={e => onUpdate(card.id, { tosTopicId: e.target.value || null })}
                    className="bg-[#151515] border border-border-base rounded px-2.5 py-1 text-xs font-['JetBrains_Mono'] text-text-primary focus:border-accent outline-none"
                  >
                    <option value="">(Default from Deck / None)</option>
                    {getTosTopicsBySubject(subject).map(t => (
                      <option key={t.id} value={t.id}>
                        {t.fullLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
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

let _uid = 0
const uid = () => `new_${Date.now()}_${++_uid}`

export default function EditDeck() {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/study'


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const [deckMeta, setDeckMeta] = useState<DeckMeta>({
    title: '',
    description: '',
    subject: 'Electronics Engineering',
    tags: '',
    folderName: '',
    folderId: null
  })
  const [cards, setCards] = useState<EditCard[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [originalCardIds, setOriginalCardIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showFormattingGuide, setShowFormattingGuide] = useState(false)
  const [importModalType, setImportModalType] = useState<'none' | 'mcq' | 'flashcard'>('none')
  const [isExporting, setIsExporting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)

  const isFormulaDeck = cards.length > 0 && cards.every(c => c.type === 'formula')
  const scope = isFormulaDeck ? 'formula' : 'study'

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const listContainerRef = useRef<HTMLDivElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(() => {
    const updateMargin = () => {
      if (scrollContainerRef.current && listContainerRef.current) {
        const containerRect = scrollContainerRef.current.getBoundingClientRect()
        const listRect = listContainerRef.current.getBoundingClientRect()
        const offset = listRect.top - containerRect.top + scrollContainerRef.current.scrollTop
        setScrollMargin(Math.max(0, Math.round(offset)))
      }
    }
    updateMargin()
    window.addEventListener('resize', updateMargin)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && scrollContainerRef.current) {
      observer = new ResizeObserver(updateMargin)
      observer.observe(scrollContainerRef.current)
    }

    return () => {
      window.removeEventListener('resize', updateMargin)
      observer?.disconnect()
    }
  }, [])

  const virtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 320,
    getItemKey: (index) => cards[index]?.id ?? index,
    overscan: 5,
    scrollMargin,
  })

  const handleGenerateSummary = async () => {
    if (cards.length === 0) {
      setToast({ type: 'error', msg: 'Please add some cards to generate a summary.' })
      setTimeout(() => setToast(null), 3000)
      return
    }

    setIsGeneratingSummary(true)
    try {
      const summary = await generateDeckSummary({
        title: deckMeta.title,
        subject: deckMeta.subject,
        cards,
      })
      setDeckMeta(m => ({ ...m, description: summary }))
      setToast({ type: 'success', msg: 'AI summary generated!' })
      setTimeout(() => setToast(null), 2500)
    } catch (err: any) {
      console.error('[AI Summary Generation Error]', err)
      setToast({ type: 'error', msg: err.message || 'Failed to generate summary.' })
      setTimeout(() => setToast(null), 3500)
    } finally {
      setIsGeneratingSummary(false)
    }
  }

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

  const [existingTopics, setExistingTopics] = useState<any[]>([])
  const [pendingDeleteTag, setPendingDeleteTag] = useState<string | null>(null)
  const [affectedDecks, setAffectedDecks] = useState<AffectedDeck[]>([])
  const [isDeletingTag, setIsDeletingTag] = useState(false)
  const [tagRefreshKey, setTagRefreshKey] = useState(0)

  const availableTags = React.useMemo(() => {
    return getAllAvailableTags(existingTopics)
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
        useDataVersionStore.getState().bump()
      }
      markTagDeleted(pendingDeleteTag)

      const normalized = pendingDeleteTag.trim().toLowerCase()
      setDeckMeta(prev => {
        const arr = prev.tags.split(',').map(t => t.trim()).filter(Boolean)
        const next = arr.filter(t => t.toLowerCase() !== normalized)
        return { ...prev, tags: next.join(', ') }
      })

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
      setToast({ type: 'success', msg: `Tag "${pendingDeleteTag}" deleted.` })
      setTimeout(() => setToast(null), 3000)
      setPendingDeleteTag(null)
      setAffectedDecks([])
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message || 'Failed to delete tag' })
      setTimeout(() => setToast(null), 4000)
    } finally {
      setIsDeletingTag(false)
    }
  }

  const handleAddCustomTag = () => {
    const tag = customTagInput.trim()
    if (!tag) return
    saveCustomTag(tag)
    const currentTags = deckMeta.tags.split(',').map(t => t.trim()).filter(Boolean)
    if (!currentTags.some(t => t.toLowerCase() === tag.toLowerCase())) {
      setDeckMeta(m => ({ ...m, tags: [...currentTags, tag].join(', ') }))
    }
    setCustomTagInput('')
    setTagRefreshKey(k => k + 1)
  }

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
      try {
        const res = await window.electron.folders.getAll({ scope })
        const folderNames = res.success && res.data
          ? [...new Set(res.data.map((f: any) => f.name))].sort() as string[]
          : []
        setExistingFolders(folderNames)
      } catch {
        setExistingFolders([])
      }
    }
    fetchFolders()
  }, [scope])

  // ── Load from DB ──────────────────────────────────────────────────────────
  const loadCards = useCallback(async (isInitial = false) => {
    if (!deckId) return
    try {
      if (isInitial) setLoading(true)
      // ── Electron: load via IPC ──
      const topicsRes = await window.electron.decks.getTopics()
      if (topicsRes?.data) {
        setExistingTopics(topicsRes.data)
      }
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
              folderName: (!t.folder_name || t.folder_name === 'Uncategorized') ? '' : t.folder_name,
              folderId: t.folder_id || null
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
                if (parsed.solutionImagePath) d.solutionImagePath = parsed.solutionImagePath
                if (parsed.choicesPlainText) d.choicesPlainText = parsed.choicesPlainText
                return { id: row.id, type: 'mcq', data: d, tosTopicId: row.tos_topic_id ?? null } as EditCard
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
                if (parsed.explanation) d.explanation = parsed.explanation
                if (parsed.explanationImagePath) d.explanationImagePath = parsed.explanationImagePath
                if (parsed.imagePathFront) d.imagePathFront = parsed.imagePathFront
                if (parsed.imageBack) d.imageBack = parsed.imageBack
                if (parsed.backIsPlainText) d.backIsPlainText = parsed.backIsPlainText
                return { id: row.id, type: 'formula', data: d, tosTopicId: row.tos_topic_id ?? null } as EditCard
              } else {
                const d: FlashcardEdit = {
                  front: parsed.front ?? '',
                  back: parsed.back ?? '',
                }
                if (parsed.imagePath) d.imagePath = parsed.imagePath
                if (parsed.imageBack) d.imageBack = parsed.imageBack
                if (parsed.explanation) d.explanation = parsed.explanation
                if (parsed.explanationImagePath) d.explanationImagePath = parsed.explanationImagePath
                return { id: row.id, type: 'flashcard', data: d, tosTopicId: row.tos_topic_id ?? null } as EditCard
              }
        })
        setCards(loaded)
        setOriginalCardIds(new Set(loaded.map(c => c.id)))

        // Preserve expanded cards by position/id across background reloads
        if (!isInitial) {
          setExpandedIds(prev => {
            const next = new Set<string>()
            const prevCards = cardsRef.current
            prevCards.forEach((c, idx) => {
              if (prev.has(c.id) && loaded[idx]) {
                next.add(loaded[idx].id)
              }
            })
            return next
          })
        }
      }
    } catch (err) {
      console.error('[EditDeck] Load error', err)
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [deckId])

  useEffect(() => {
    loadCards(true)
  }, [loadCards])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // ── Card mutations ────────────────────────────────────────────────────────
  const updateCard = useCallback((id: string, patch: Partial<EditCard>) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [])

  const deleteCard = useCallback((id: string) => {
    saveSnapshot(cardsRef.current)
    setCards(prev => prev.filter(c => c.id !== id))
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [saveSnapshot])

  const addCard = (type: 'mcq' | 'flashcard' | 'formula') => {
    const id = uid()
    const data: EditCard = type === 'mcq'
      ? { id, type, data: { question: '', choices: ['', '', '', ''], answer: 0, explanation: '', choicesPlainText: [true, true, true, true] }, isNew: true }
      : type === 'formula'
        ? { id, type, data: { name: '', latex: '', description: '', variables: '', explanation: '', explanationImagePath: undefined, imageBack: undefined }, isNew: true }
        : { id, type, data: { front: '', back: '' }, isNew: true }
    setCards(prev => [...prev, data])
    setExpandedIds(prev => new Set(prev).add(id))
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
      isNew: true,
      defaultExpanded: false,
      data: {
        question: c.mcqData.question || '',
        choices: [
          c.mcqData.choices?.[0] || '',
          c.mcqData.choices?.[1] || '',
          c.mcqData.choices?.[2] || '',
          c.mcqData.choices?.[3] || '',
        ] as [string, string, string, string],
        answer: c.mcqData.answer !== undefined ? c.mcqData.answer : 0,
        explanation: c.mcqData.explanation || '',
        choicesPlainText: [true, true, true, true]
      }
    }))

    if (newRows.length === 0) return

    saveSnapshot(cardsRef.current)
    setCards(prev => {
      const isAllEmpty = prev.length > 0 && prev.every(c => {
        if (!c.isNew) return false
        if (c.type === 'mcq') return !(c.data as MCQEdit).question.trim()
        if (c.type === 'formula') return !(c.data as FormulaEdit).name.trim()
        return !(c.data as FlashcardEdit).front.trim()
      })
      if (isAllEmpty) return newRows
      return [...prev, ...newRows]
    })
    setToast({ type: 'success', msg: `Imported ${newRows.length} MCQ${newRows.length > 1 ? 's' : ''}` })
    setTimeout(() => setToast(null), 3000)
  }

  const handleImportFlashcards = (imported: { flashcardData?: any }[]) => {
    const newRows: EditCard[] = imported.filter(c => c.flashcardData).map(c => ({
      id: uid(),
      type: 'flashcard',
      isNew: true,
      defaultExpanded: false,
      data: {
        front: c.flashcardData.front || '',
        back: c.flashcardData.back || '',
        explanation: c.flashcardData.explanation || '',
      }
    }))

    if (newRows.length === 0) return

    saveSnapshot(cardsRef.current)
    setCards(prev => {
      const isAllEmpty = prev.length > 0 && prev.every(c => {
        if (!c.isNew) return false
        if (c.type === 'mcq') return !(c.data as MCQEdit).question.trim()
        if (c.type === 'formula') return !(c.data as FormulaEdit).name.trim()
        return !(c.data as FlashcardEdit).front.trim()
      })
      if (isAllEmpty) return newRows
      return [...prev, ...newRows]
    })
    setToast({ type: 'success', msg: `Imported ${newRows.length} flashcard${newRows.length > 1 ? 's' : ''}` })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Save: full transactional diff write ──────────────────────────────────
  const handleSave = async () => {
    if (!deckId || isSaving) return
    setIsSaving(true)

    try {
      const tagsArr = deckMeta.tags.split(',').map(t => t.trim()).filter(Boolean)
        const currentIds = new Set(cards.filter(c => !c.id.startsWith('new_')).map(c => c.id))
        const deletedCardIds = [...originalCardIds].filter(id => !currentIds.has(id))
      const isNewFolder = deckMeta.folderName.trim() !== '' && 
                          deckMeta.folderName.trim().toLowerCase() !== 'uncategorized' &&
                          !existingFolders.some(f => f.toLowerCase() === deckMeta.folderName.trim().toLowerCase())

      const res = await window.electron.decks.updateDeckWithCards({
        deckId,
        title: deckMeta.title.trim(),
        subject: deckMeta.subject,
        description: deckMeta.description.trim(),
        tags: JSON.stringify(tagsArr),
        folderName: deckMeta.folderName.trim(),
        folderId: deckMeta.folderId,
        scope,
        cards: cards.map(card => ({
          id: card.id,
          type: card.type,
          data: JSON.stringify(card.data),
          isNew: card.isNew ?? false,
          tos_topic_id: card.tosTopicId ?? null,
        })),
        deletedCardIds
      })
      if (!res.success) throw new Error(res.error)
      useDataVersionStore.getState().bump()
      await loadCards(false)
      if (isNewFolder) {
        setToast({ type: 'success', msg: `Deck saved and new folder "${deckMeta.folderName.trim()}" created!` })
      } else {
        setToast({ type: 'success', msg: 'Deck saved successfully!' })
      }
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
      <div className="h-full bg-engine-black flex items-center justify-center">
        <div className="text-accent font-['JetBrains_Mono'] text-sm tracking-widest animate-pulse">LOADING DECK...</div>
      </div>
    )
  }

  return (
    <div className="h-full bg-transparent flex flex-col overflow-hidden">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[200] flex items-center gap-3 px-5 py-3 rounded-lg border shadow-2xl font-['Rajdhani'] tracking-wider text-sm ${toast.type === 'success'
                ? 'bg-[#0a1a0a] border-accent/40 text-accent'
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(returnTo)}
            className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors font-['Rajdhani'] uppercase tracking-widest text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={() => setShowFormattingGuide(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#2a2a2a] bg-[#111] text-text-muted hover:text-accent hover:border-accent/40 transition-colors font-['Rajdhani'] uppercase tracking-widest text-xs font-bold"
          >
            <Type className="w-3.5 h-3.5" />
            Format Guide
          </button>
        </div>

        <div className="flex-1 text-center">
          <h1 className="font-['Orbitron'] font-bold text-lg tracking-[0.2em] text-text-primary uppercase">
            Edit <span className="text-accent">Deck</span>
          </h1>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-5 py-2 font-['Rajdhani'] font-bold uppercase tracking-widest text-sm rounded transition-all ${isSaving
              ? 'bg-accent/40 text-black/60 cursor-not-allowed'
              : 'bg-accent text-black hover:bg-[rgba(0,255,65,0.85)] shadow-[0_0_12px_rgba(0,255,65,0.25)]'
            }`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* ── Scrollable Body ── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto show-scrollbar w-full">
        <div className="w-full px-6 lg:px-10 xl:grid xl:grid-cols-3 xl:gap-6 flex flex-col gap-6 py-6 lg:py-8 items-center xl:items-start">

          {/* ── Metadata Section — Pane 1 (sticky left 1/3) */}
          <div className="w-full max-w-4xl xl:max-w-none xl:col-span-1 xl:sticky xl:top-6 bg-[#111] border border-zinc-800 rounded-xl p-6 flex flex-col gap-5">
            <h2 className="font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted text-xs">Deck Info</h2>

            <div>
              <div className="relative">
                <input
                  type="text"
                  className="w-full bg-transparent text-text-primary text-[1.15rem] font-['Orbitron'] border-b-2 border-[#333] focus:border-accent pb-3 focus:outline-none placeholder:text-[#555] transition-colors tracking-wide pr-16"
                  value={deckMeta.title}
                  onChange={e => setDeckMeta(m => ({ ...m, title: e.target.value }))}
                  placeholder="Deck title..."
                  maxLength={80}
                />
                <span className="absolute right-0 bottom-4 text-xs font-['JetBrains_Mono'] text-[#666]">
                  {deckMeta.title.length} / 80
                </span>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  className={`${inputCls} pr-10`}
                  value={deckMeta.description}
                  onChange={e => setDeckMeta(m => ({ ...m, description: e.target.value }))}
                  placeholder="Short description..."
                />
                <div className="absolute right-1.5 flex items-center">
                  <AIDescriptionButton
                    onClick={handleGenerateSummary}
                    isGenerating={isGeneratingSummary}
                    disabled={cards.length === 0}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Folder / Category</Label>
              <div className="relative" ref={folderDropdownRef}>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-text-primary font-['JetBrains_Mono'] text-sm focus:border-accent focus:bg-[#111] outline-none transition-colors pr-16 placeholder-[#555]"
                    value={deckMeta.folderName}
                    onChange={e => {
                      setDeckMeta(m => ({ ...m, folderName: e.target.value, folderId: null }))
                      setShowFolderDropdown(true)
                    }}
                    onFocus={() => setShowFolderDropdown(true)}
                    placeholder="e.g. Select or type folder name..."
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    {deckMeta.folderName && (
                      <Tooltip content="Clear folder" position="top">
                        <button
                          type="button"
                          onClick={() => {
                            setDeckMeta(m => ({ ...m, folderName: '', folderId: null }))
                            setShowFolderDropdown(true)
                          }}
                          className="p-1 text-[#444] hover:text-accent transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip content="Toggle folder list" position="top">
                      <button
                        type="button"
                        onClick={() => setShowFolderDropdown(prev => !prev)}
                        className="p-1 text-[#666] hover:text-accent transition-colors"
                      >
                        <ChevronDown size={14} className={`transform transition-transform ${showFolderDropdown ? 'rotate-180' : ''}`} />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <AnimatePresence>
                  {showFolderDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface-2 border border-[#333] rounded-lg shadow-2xl max-h-48 overflow-y-auto custom-scrollbar"
                    >
                      {existingFolders.length === 0 ? (
                        <div className="p-3 text-xs text-[#666] font-['JetBrains_Mono'] text-center">
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
                                  setDeckMeta(m => ({ ...m, folderName: f, folderId: null }))
                                  setShowFolderDropdown(false)
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-['JetBrains_Mono'] text-[#ccc] hover:bg-border-base hover:text-accent transition-colors flex items-center justify-between"
                              >
                                <span>{f}</span>
                                {deckMeta.folderName.toLowerCase() === f.toLowerCase() && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                                )}
                              </button>
                            ))}
                          {existingFolders.filter(f => f.toLowerCase().includes(deckMeta.folderName.toLowerCase())).length === 0 && (
                            <div
                              className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-surface transition-colors"
                              onClick={() => { setShowFolderDropdown(false) }}
                            >
                              <span className="font-['JetBrains_Mono'] text-xs text-accent">
                                Create "{deckMeta.folderName}"
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

            <div>
              <Label>Subject</Label>
              <div className="flex gap-2 flex-wrap">
                {SUBJECTS.map(s => {
                  const isSelected = deckMeta.subject === s.value
                  const colors = TOS_SUBJECT_COLORS[s.short]

                  return (
                    <button
                      key={s.value}
                      onClick={() => setDeckMeta(m => ({ ...m, subject: s.value }))}
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
              <div className="flex flex-wrap gap-2.5 mb-3">
                {availableTags.map(tag => {
                  const currentTags = deckMeta.tags.split(',').map(t => t.trim()).filter(Boolean)
                  const isSelected = currentTags.some(t => t.toLowerCase() === tag.toLowerCase())
                  return (
                    <div
                      key={tag}
                      onClick={() => {
                        const arr = deckMeta.tags.split(',').map(t => t.trim()).filter(Boolean)
                        const next = isSelected
                          ? arr.filter(t => t.toLowerCase() !== tag.toLowerCase())
                          : [...arr, tag]
                        setDeckMeta(m => ({ ...m, tags: next.join(', ') }))
                      }}
                      className={`group flex items-center gap-1.5 pl-3.5 pr-2 py-1.5 rounded-full font-['Rajdhani'] uppercase tracking-wider text-xs font-bold transition-all border cursor-pointer select-none ${isSelected
                        ? 'bg-accent/15 border-accent text-accent shadow-[0_0_12px_rgba(0,255,65,0.15)]'
                        : 'bg-surface-2 border-[#333] text-text-muted hover:border-[#555] hover:text-text-primary'
                        }`}
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={(e) => handleInitiateDeleteTag(tag, e)}
                        title={`Delete tag "${tag}"`}
                        className="w-4 h-4 rounded-full flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/20 transition-all opacity-60 group-hover:opacity-100"
                      >
                        <X size={11} />
                      </button>
                    </div>
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
                      handleAddCustomTag();
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

            <div className="border-t border-zinc-800 pt-5 mt-2">
              <button
                type="button"
                onClick={handleExportToText}
                disabled={isExporting}
                className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg border font-['Rajdhani'] font-bold uppercase tracking-widest text-xs transition-all duration-200 ${isExporting
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-[#111] hover:bg-accent/5 border-zinc-800 hover:border-accent/40 text-text-muted hover:text-accent shadow-md hover:shadow-[0_0_15px_rgba(0,255,65,0.1)]'
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
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-['Rajdhani'] font-bold uppercase tracking-widest text-text-muted text-xs">
                    Questions
                  </h2>
                  <span className="text-[#555] font-['JetBrains_Mono'] text-xs">
                    {cards.length} {cards.length === 1 ? 'item' : 'items'} total
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setImportModalType('mcq')}
                    className="flex items-center gap-2 px-4 py-2 rounded border border-[#333] bg-surface-2 text-text-muted hover:text-accent hover:border-accent/50 font-['Rajdhani'] uppercase tracking-widest text-xs font-bold transition-all"
                  >
                    <Upload size={14} /> Import MCQs
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportModalType('flashcard')}
                    className="flex items-center gap-2 px-4 py-2 rounded border border-[#333] bg-surface-2 text-text-muted hover:text-accent hover:border-accent/50 font-['Rajdhani'] uppercase tracking-widest text-xs font-bold transition-all"
                  >
                    <Upload size={14} /> Import Flashcards
                  </button>
                </div>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={customCollisionDetection}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  <div
                    ref={listContainerRef}
                    className="w-full relative"
                    style={{ height: `${virtualizer.getTotalSize()}px` }}
                  >
                    {virtualizer.getVirtualItems().map(virtualRow => {
                      const card = cards[virtualRow.index]
                      if (!card) return null
                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          ref={virtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                            paddingBottom: '0.75rem',
                          }}
                        >
                          <SortableQuestionRow
                            card={card}
                            index={virtualRow.index}
                            isExpanded={expandedIds.has(card.id)}
                            subject={deckMeta.subject}
                            onToggleExpand={toggleExpand}
                            onUpdate={updateCard}
                            onDelete={deleteCard}
                            onError={(msg) => {
                              setToast({ type: 'error', msg })
                              setTimeout(() => setToast(null), 3000)
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>

              {cards.length === 0 && (
                <div className="text-center py-16 text-[#444] font-['JetBrains_Mono'] text-sm">
                  No questions yet. Add one below.
                </div>
              )}
            </div>{/* end question list */}

            {/* ── Bottom Bar ── */}
            <div className="flex items-center justify-between bg-[#111] border border-[#1e1e1e] rounded-xl px-6 py-4 gap-4">
              <span className="text-[#555] font-['JetBrains_Mono'] text-xs">
                {cards.length} question{cards.length !== 1 ? 's' : ''} total
              </span>
              <div className="flex items-center gap-3">
                {historyStack.length > 0 && (
                  <Tooltip content="Undo (Ctrl+Z)" position="top">
                    <button
                      onClick={undo}
                      className="flex items-center justify-center p-2 rounded border border-[#666] text-[#666] hover:text-accent hover:border-accent transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </Tooltip>
                )}
                <button
                  onClick={() => addCard('flashcard')}
                  className="flex items-center gap-2 px-4 py-2 rounded border border-[#333] bg-surface-2 text-text-muted hover:text-accent hover:border-accent/50 font-['Rajdhani'] uppercase tracking-widest text-sm transition-all"
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
                  className="flex items-center gap-2 px-4 py-2 rounded border border-accent/40 bg-accent/5 text-accent hover:bg-accent/10 font-['Rajdhani'] uppercase tracking-widest text-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add MCQ
                </button>
              </div>
            </div>

          </div>{/* end Pane 2 */}

        </div>
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

      {showFormattingGuide && (
        <FormattingGuideModal onClose={() => setShowFormattingGuide(false)} />
      )}

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
    </div>
  )
}
