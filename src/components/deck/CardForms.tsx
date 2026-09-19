import React, { useState, useEffect } from 'react'
import { X, ImageIcon, Eye, EyeOff } from 'lucide-react'
import { renderMath, isRawLatex } from '../../lib/latex'
import { Tooltip } from '../ui/Tooltip'
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

export interface FormulaEdit {
  name: string
  latex: string
  description: string
  variables: string
  explanation?: string
  explanationImagePath?: string
  imagePathFront?: string   // image on the formula name (front) face
  imageBack?: string        // image on the back (equation) face
  backIsPlainText?: boolean // true when user chose text mode for the back/equation field
}

export interface MCQEdit {
  question: string
  choices: [string, string, string, string]
  answer: number
  explanation: string
  imagePath?: string
  solutionImagePath?: string
  choicesPlainText?: boolean[]  // per-choice flag: true = plain text, false = equation mode
}

export interface FlashcardEdit {
  front: string
  back: string
  imagePath?: string
  imageBack?: string        // NEW: image on the back face
  explanation?: string
  explanationImagePath?: string
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted mb-1 block">{children}</span>
)

const inputCls = "w-full bg-engine-black border border-border-subtle rounded px-3 py-2 text-text-primary font-['JetBrains_Mono'] text-sm outline-none focus:border-accent transition-colors placeholder-[#555]"
const textareaCls = `${inputCls} resize-none leading-relaxed`

// Shared image upload handler — avoids repeating the same 15-line block across every form.
function makeImageUploadHandler(
  onSuccess: (filename: string) => void,
  onError?: (msg: string) => void
) {
  return async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      onError?.('Image exceeds 10MB limit.')
      e.target.value = ''
      return
    }
    const path = (file as any).path
    if (!path) return
    try {
      const result = await window.electron.saveImage(path)
      if (result.success && result.filename) onSuccess(result.filename)
      else onError?.(result.error || 'Failed to save image')
    } catch (err: any) {
      onError?.('Error saving image: ' + err.message)
    }
    e.target.value = ''
  }
}

interface ImageSlotProps {
  value: string | undefined
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  /** 'inline' = small icon next to a label row
   *  'block'  = dashed 96×96 upload square */
  variant?: 'inline' | 'block'
  alt?: string
}

const ImageSlot: React.FC<ImageSlotProps> = ({
  value, onUpload, onRemove, variant = 'block', alt = 'Image'
}) => {
  if (variant === 'inline') {
    return value ? (
      <div className="relative group flex items-center justify-center">
        <img src={`ece-app://${value}`} className="w-5 h-5 object-cover rounded border border-[#333]" alt={alt} />
        <Tooltip content="Remove image" position="top" className="absolute -top-1 -right-1">
          <button type="button" onClick={onRemove}
            className="bg-[#FF4B4B] text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <X size={10} />
          </button>
        </Tooltip>
      </div>
    ) : (
      <Tooltip content={alt.toLowerCase().startsWith('add') ? alt : `Add ${alt}`} position="top">
        <label className="cursor-pointer text-text-muted hover:text-accent transition-colors">
          <ImageIcon size={16} />
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
        </label>
      </Tooltip>
    )
  }

  return value ? (
    <div className="relative group inline-block">
      <img src={`ece-app://${value}`} alt={alt} className="w-24 h-24 object-cover rounded border border-[#333]" />
      <Tooltip content="Remove image" position="top" className="absolute -top-2 -right-2">
        <button type="button" onClick={onRemove}
          className="bg-[#FF4B4B] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
          <X size={12} />
        </button>
      </Tooltip>
    </div>
  ) : (
    <label className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-[#333] hover:border-accent hover:text-accent text-text-muted rounded transition-colors bg-[#0a0a0a]">
      <ImageIcon size={24} />
      <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest mt-2 font-bold text-center leading-tight">Add<br />Image</span>
      <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
    </label>
  )
}

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

  // Sync external value into math-field
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

  // Wire input event listener
  useEffect(() => {
    const el = mathfieldRef.current
    if (!el || !mathMode) return
    const handler = () => {
      console.log('[RAW from MathLive]', el.value)
      console.log('[typeof]', typeof el.value)
      onChange(el.value)
    }
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
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

    // Tab → insert 4 spaces, never shift focus
    if (e.key === 'Tab') {
      e.preventDefault()
      const next = value.slice(0, start) + '    ' + value.slice(end)
      onChange(next)
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 4 })
      return
    }

    // Ctrl/Cmd + B → **bold**
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

    // Ctrl/Cmd + I → *italic*
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

    // Ctrl/Cmd + U → __underline__
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
          className="flex items-center justify-center min-w-[28px] h-[24px] px-2 rounded-full bg-[var(--bg-elevated)] border border-[rgba(0,255,65,0.3)] text-[var(--accent-primary)] hover:bg-[rgba(0,255,65,0.1)] font-bold text-xs transition-colors shadow-sm"
        >
          {mathMode ? 'Aa' : '∑'}
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
              background: 'var(--bg-secondary)',
              border: '1px solid rgba(0,255,65,0.3)',
              borderRadius: '6px',
              padding: '12px',
              paddingRight: '40px',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              fontFamily: "'JetBrains Mono', monospace",
              '--keyboard-zindex': '99999',
            } as React.CSSProperties & Record<string, string>}
          />
          {value.trim().length > 0 && (
            <div className="bg-[var(--bg-elevated)] border border-[rgba(0,255,65,0.1)] rounded-lg p-3">
              <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted mb-1">Preview</div>
              {(() => {
                try {
                  const rendered = renderMath(value)
                  return <div className="text-text-primary" dangerouslySetInnerHTML={{ __html: rendered }} />
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

export const MCQForm: React.FC<{ data: MCQEdit; onChange: (d: MCQEdit) => void; isNew?: boolean; onError?: (msg: string) => void; cardId: string }> = ({ data, onChange, isNew, onError, cardId }) => {
  const [showSolution, setShowSolution] = useState(!!data.explanation)
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

  const handleImageUpload = makeImageUploadHandler(
    f => set({ imagePath: f }),
    onError
  )

  return (
    <div className="flex flex-col gap-4">
      {/* QUESTION */}
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
          <ImageSlot
            value={data.imagePath}
            onUpload={handleImageUpload}
            onRemove={() => set({ imagePath: undefined })}
            alt="Question image"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {data.choices.map((choice, i) => (
          <div key={i} className="flex flex-col">
            <Label>Choice {labels[i]}</Label>
            <div className="flex items-start gap-2">
              <input
                type="radio"
                name={`ans-${cardId}`}
                checked={data.answer === i}
                onChange={() => set({ answer: i })}
                className="accent-[#00FF41] w-4 h-4 flex-shrink-0 cursor-pointer mt-3"
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
        {!showSolution ? (
          <button
            type="button"
            onClick={() => setShowSolution(true)}
            className="text-[11px] font-['Rajdhani'] uppercase tracking-widest text-text-muted hover:text-accent transition-colors font-bold"
          >
            + Add Solution
          </button>
        ) : (
          <>
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
                <ImageSlot
                  variant="inline"
                  value={data.solutionImagePath}
                  onUpload={makeImageUploadHandler(f => set({ solutionImagePath: f }), onError)}
                  onRemove={() => set({ solutionImagePath: undefined })}
                  alt="Solution image"
                />
              </div>
            </div>
            <MathInputField
              value={data.explanation || ''}
              onChange={val => set({ explanation: val })}
              placeholder="Write the solution or reasoning for the correct answer..."
              rows={6}
              multiline={true}
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
          </>
        )}
      </div>
    </div>
  )
}

export const FlashcardForm: React.FC<{ data: FlashcardEdit; onChange: (d: FlashcardEdit) => void; isNew?: boolean; onError?: (msg: string) => void }> = ({ data, onChange, onError }) => {
  const [showExplanation, setShowExplanation] = useState(!!(data.explanation || data.explanationImagePath))
  const [showExplanationPreview, setShowExplanationPreview] = useState(false)

  const handleImageUpload = makeImageUploadHandler(
    f => onChange({ ...data, imagePath: f }),
    onError
  )
  const handleExplanationImageUpload = makeImageUploadHandler(
    f => onChange({ ...data, explanationImagePath: f }),
    onError
  )

  return (
    <div className="flex flex-col gap-4">
      {/* FRONT */}
      <div className="relative w-full">
        <div className="flex items-center justify-between mb-1">
          <Label>Front / Term</Label>
          <div className="mr-[6px]">
            <ImageSlot
              variant="inline"
              value={data.imagePath}
              onUpload={handleImageUpload}
              onRemove={() => onChange({ ...data, imagePath: undefined })}
              alt="Front image"
            />
          </div>
        </div>
        <MathInputField value={data.front} onChange={val => onChange({ ...data, front: val })} placeholder="Term or question..." rows={5} multiline={true} />
      </div>

      {/* BACK */}
      <div className="relative w-full">
        <div className="flex items-center justify-between mb-1">
          <Label>Back / Definition</Label>
          <div className="mr-[6px]">
            <ImageSlot
              variant="inline"
              value={data.imageBack}
              onUpload={makeImageUploadHandler(f => onChange({ ...data, imageBack: f }), onError)}
              onRemove={() => onChange({ ...data, imageBack: undefined })}
              alt="Back image"
            />
          </div>
        </div>
        <MathInputField value={data.back} onChange={val => onChange({ ...data, back: val })} placeholder="Definition or answer..." rows={5} multiline={true} />
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
                <ImageSlot
                  variant="inline"
                  value={data.explanationImagePath}
                  onUpload={handleExplanationImageUpload}
                  onRemove={() => onChange({ ...data, explanationImagePath: undefined })}
                  alt="Explanation image"
                />
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

export const FormulaForm: React.FC<{
  data: FormulaEdit
  onChange: (d: FormulaEdit) => void
  isNew?: boolean
  onError?: (msg: string) => void
}> = ({ data, onChange, onError }) => {
  const [showExplanation, setShowExplanation] = useState(!!(data.explanation || data.explanationImagePath))
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

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full">
        <div className="flex items-center justify-between mb-1">
          <Label>Front / Term (formula name)</Label>
          <div className="mr-[6px]">
            <ImageSlot
              variant="inline"
              value={data.imagePathFront}
              onUpload={makeImageUploadHandler(f => onChange({ ...data, imagePathFront: f }), onError)}
              onRemove={() => onChange({ ...data, imagePathFront: undefined })}
              alt="Front image"
            />
          </div>
        </div>
        <MathInputField value={data.name} onChange={val => onChange({ ...data, name: val })} placeholder="Formula name, e.g. Inverse Sine..." rows={3} multiline={true} />
      </div>
      <div className="relative w-full">
        <div className="flex items-center justify-between mb-1">
          <Label>Back / LaTeX (equation)</Label>
          <div className="mr-[6px]">
            <ImageSlot
              variant="inline"
              value={data.imageBack}
              onUpload={makeImageUploadHandler(f => onChange({ ...data, imageBack: f }), onError)}
              onRemove={() => onChange({ ...data, imageBack: undefined })}
              alt="Back image"
            />
          </div>
        </div>
        <MathInputField
          value={data.latex}
          onChange={val => onChange({ ...data, latex: val })}
          placeholder="LaTeX equation..."
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
                <ImageSlot
                  variant="inline"
                  value={data.explanationImagePath}
                  onUpload={handleExplanationImageUpload}
                  onRemove={() => onChange({ ...data, explanationImagePath: undefined })}
                  alt="Explanation image"
                />
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

// ── Formatting Guide Modal ────────────────────────────────────────────────────

export const FormattingGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] sticky top-0 bg-[#111] z-10">
          <div>
            <h2 className="font-['Orbitron'] font-bold text-base tracking-widest text-accent uppercase">
              Formatting Guide
            </h2>
            <p className="text-[11px] font-['Rajdhani'] text-text-muted uppercase tracking-widest mt-0.5">
              For explanation, notes, and text fields
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-accent transition-colors p-1.5 rounded hover:bg-accent/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-6">

          {/* Keyboard Shortcuts */}
          <section>
            <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-accent font-bold mb-3">
              Keyboard Shortcuts
            </div>
            <div className="flex flex-col gap-2">
              {[
                { keys: ['Ctrl', 'B'], result: 'Bold text', example: '**text**', renders: 'text appears bold' },
                { keys: ['Ctrl', 'I'], result: 'Italic text', example: '*text*', renders: 'text appears italic' },
                { keys: ['Ctrl', 'U'], result: 'Underline text', example: '__text__', renders: 'text appears underlined' },
                { keys: ['Tab'], result: 'Indent (4 spaces)', example: '', renders: 'adds 4 spaces at cursor' },
              ].map(({ keys, result, example, renders }) => (
                <div key={result} className="flex items-center gap-3 bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {keys.map((k, i) => (
                      <React.Fragment key={k}>
                        <kbd className="px-2 py-0.5 rounded bg-[#1c1c1c] border border-[#333] text-[#ccc] font-['JetBrains_Mono'] text-xs">
                          {k}
                        </kbd>
                        {i < keys.length - 1 && <span className="text-[#444] text-xs">+</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <span className="text-[#555] text-xs">→</span>
                  <span className="font-['Rajdhani'] text-sm text-text-primary font-bold flex-shrink-0">{result}</span>
                  {example && (
                    <code className="ml-auto text-[11px] font-['JetBrains_Mono'] text-[#888] bg-[#0a0a0a] px-2 py-0.5 rounded border border-[#222]">
                      {example}
                    </code>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Text Formatting */}
          <section>
            <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-accent font-bold mb-3">
              Text Formatting — Type Directly
            </div>
            <div className="grid grid-cols-1 gap-2">
              {[
                { syntax: '**bold text**',   result: '<strong>bold</strong>',    label: 'Bold' },
                { syntax: '*italic text*',   result: '<em>italic</em>',          label: 'Italic' },
                { syntax: '__underline__',   result: '<u>underline</u>',         label: 'Underline' },
              ].map(({ syntax, result, label }) => (
                <div key={label} className="flex items-center gap-3 bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-4 py-2.5">
                  <code className="font-['JetBrains_Mono'] text-[11px] text-[#aaa] w-36 flex-shrink-0">{syntax}</code>
                  <span className="text-[#444] text-xs flex-shrink-0">→</span>
                  <span className="font-['Rajdhani'] text-sm font-bold text-[#d4d4d4]">{label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Superscript & Subscript */}
          <section>
            <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-accent font-bold mb-3">
              Superscript &amp; Subscript
            </div>
            <div className="flex flex-col gap-2">
              {[
                { syntax: 'x^2',           html: 'x<sup>2</sup>',        label: 'Superscript — single char' },
                { syntax: '10^{-8}',        html: '10<sup>-8</sup>',      label: 'Superscript — braces (multi-char)' },
                { syntax: 'e^(v - u)',      html: 'e<sup>(v - u)</sup>',  label: 'Superscript — parentheses (expression)' },
                { syntax: 'R_L',            html: 'R<sub>L</sub>',        label: 'Subscript — single char' },
                { syntax: 'V_{out}',        html: 'V<sub>out</sub>',      label: 'Subscript — braces (multi-char)' },
                { syntax: 'f_(n + 1)',      html: 'f<sub>(n + 1)</sub>',  label: 'Subscript — parentheses (expression)' },
              ].map(({ syntax, html, label }) => (
                <div key={syntax} className="flex items-center gap-3 bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-4 py-2.5">
                  <code className="font-['JetBrains_Mono'] text-[11px] text-[#aaa] w-36 flex-shrink-0">{syntax}</code>
                  <span className="text-[#444] text-xs flex-shrink-0">→</span>
                  <span
                    className="font-['JetBrains_Mono'] text-[11px] text-accent w-40 flex-shrink-0"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                  <span className="font-['Rajdhani'] text-xs text-text-muted">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 px-4 py-2.5 bg-[#0a0f0a] border border-accent/10 rounded-lg">
              <p className="text-[11px] font-['JetBrains_Mono'] text-[#888] leading-relaxed">
                Three ways to write multi-character exponents/subscripts:<br />
                <code className="text-accent">^{'{'}-8{'}'}</code> braces &nbsp;·&nbsp;
                <code className="text-accent">^(v - u)</code> parentheses &nbsp;·&nbsp;
                <code className="text-accent">^2</code> single char (no delimiters needed).
                Parentheses are kept in the rendered output, e.g. <span dangerouslySetInnerHTML={{ __html: 'e<sup>(v&nbsp;-&nbsp;u)</sup>' }} />.
              </p>
            </div>
          </section>

          {/* LaTeX */}
          <section>
            <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-accent font-bold mb-3">
              Inline LaTeX (in text fields)
            </div>
            <div className="flex flex-col gap-2">
              {[
                { syntax: '$\\\\sin\\\\theta$',     label: 'Inline equation' },
                { syntax: '$$E = mc^2$$',           label: 'Block equation' },
              ].map(({ syntax, label }) => (
                <div key={label} className="flex items-center gap-3 bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-4 py-2.5">
                  <code className="font-['JetBrains_Mono'] text-[11px] text-[#aaa] flex-1">{syntax}</code>
                  <span className="font-['Rajdhani'] text-xs text-text-muted flex-shrink-0">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 px-4 py-2.5 bg-[#0a0f0a] border border-accent/10 rounded-lg">
              <p className="text-[11px] font-['JetBrains_Mono'] text-[#888] leading-relaxed">
                LaTeX inside <code className="text-accent">$...$</code> is rendered by KaTeX.
                Text formatting markers outside <code className="text-accent">$</code> blocks render as HTML.
                Do not mix <code className="text-accent">**bold**</code> inside a LaTeX block.
              </p>
            </div>
          </section>

          {/* ECE Examples */}
          <section>
            <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-accent font-bold mb-3">
              ECE Examples
            </div>
            <div className="flex flex-col gap-2">
              {[
                {
                  input: 'Copper = 1.7x10^{-8} ohm-meter',
                  html: 'Copper = 1.7x10<sup>-8</sup> ohm-meter'
                },
                {
                  input: 'e^(v - u) — parenthesized exponent',
                  html: 'e<sup>(v - u)</sup> — parenthesized exponent'
                },
                {
                  input: 'u = ln(e^v + c)',
                  html: 'u = ln(e<sup>v</sup> + c)'
                },
                {
                  input: 'V_{BE} = 0.7V for silicon BJT',
                  html: 'V<sub>BE</sub> = 0.7V for silicon BJT'
                },
                {
                  input: '**R** = resistance, *ρ* = resistivity',
                  html: '<strong>R</strong> = resistance, <em>ρ</em> = resistivity'
                },
                {
                  input: 'f_c = 1/(2π√(LC))',
                  html: 'f<sub>c</sub> = 1/(2π√(LC))'
                },
              ].map(({ input, html }) => (
                <div key={input} className="flex flex-col gap-1 bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-4 py-3">
                  <code className="font-['JetBrains_Mono'] text-[11px] text-[#888]">{input}</code>
                  <div className="flex items-center gap-2">
                    <span className="text-accent text-[10px]">→</span>
                    <span
                      className="font-['JetBrains_Mono'] text-xs text-[#d4d4d4]"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#222] flex justify-end sticky bottom-0 bg-[#111]">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 font-['Rajdhani'] font-bold uppercase tracking-widest text-sm transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

