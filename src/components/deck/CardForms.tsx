import React, { useState, useEffect } from 'react'
import { X, ImageIcon } from 'lucide-react'
import { renderMath } from '../../lib/latex'
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
  explanation?: string           // ADD
  explanationImagePath?: string  // ADD
}

export interface MCQEdit {
  question: string
  choices: [string, string, string, string]
  answer: number
  explanation: string
  imagePath?: string
  solutionImagePath?: string
}

export interface FlashcardEdit {
  front: string
  back: string
  imagePath?: string
  explanation?: string           // ADD
  explanationImagePath?: string  // ADD
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-text-muted mb-1 block">{children}</span>
)

const inputCls = "w-full bg-engine-black border border-border-subtle rounded px-3 py-2 text-text-primary font-['IBM_Plex_Mono'] text-sm outline-none focus:border-accent transition-colors placeholder-[#555]"
const textareaCls = `${inputCls} resize-none leading-relaxed`

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

  return (
    <div className="relative flex flex-col gap-2 w-full flex-1">
      <button
        type="button"
        onClick={() => setMathMode(m => !m)}
        title={mathMode ? 'Switch to text mode' : 'Switch to equation mode'}
        className="absolute top-2 right-2 z-10 flex items-center justify-center min-w-[28px] h-[24px] px-2 rounded-full bg-[var(--bg-elevated)] border border-[rgba(0,255,65,0.3)] text-[var(--accent-primary)] hover:bg-[rgba(0,255,65,0.1)] font-bold text-xs transition-colors shadow-sm"
      >
        {mathMode ? 'Aa' : '∑'}
      </button>

      {!mathMode ? (
        multiline ? (
          <textarea
            ref={textareaRef}
            rows={rows}
            value={value}
            onChange={e => onChange(e.target.value)}
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
              fontFamily: 'IBM Plex Mono, monospace',
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
  const set = (patch: Partial<MCQEdit>) => onChange({ ...data, ...patch })
  const setChoice = (i: number, val: string) => {
    const choices = [...data.choices] as MCQEdit['choices']
    choices[i] = val
    set({ choices })
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
      {/* QUESTION (full width) */}
      <div className="relative w-full">
        <div className="flex items-center justify-between mb-1">
          <Label>Question</Label>
          <div className="mr-[14px]">
            {data.imagePath ? (
              <div className="relative group flex items-center justify-center">
                <img src={`ece-app://${data.imagePath}`} className="w-5 h-5 object-cover rounded border border-[#333]" />
                <button type="button" onClick={() => set({ imagePath: undefined })} className="absolute -top-1 -right-1 bg-[#FF4B4B] text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Remove image">
                  <X size={10} />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer text-text-muted hover:text-accent transition-colors" title="Add Image">
                <ImageIcon size={16} />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>
        </div>
        <MathInputField
          value={data.question}
          onChange={val => set({ question: val })}
          placeholder="Enter question text..."
          rows={4}
          multiline={true}
        />
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
            <Label>Solution</Label>
            <MathInputField
              value={data.explanation || ''}
              onChange={val => set({ explanation: val })}
              placeholder="Write the solution or reasoning for the correct answer..."
              rows={6}
              multiline={true}
            />
            <div className="mt-3">
              {data.solutionImagePath ? (
                <div className="relative group inline-block">
                  <img src={`ece-app://${data.solutionImagePath}`} alt="Solution image" className="w-24 h-24 object-cover rounded border border-[#333]" />
                  <button
                    type="button"
                    onClick={() => set({ solutionImagePath: undefined })}
                    className="absolute -top-2 -right-2 bg-[#FF4B4B] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-[#333] hover:border-accent hover:text-accent text-text-muted rounded transition-colors bg-[#0a0a0a]">
                  <ImageIcon size={24} />
                  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest mt-2 font-bold text-center leading-tight">Add<br />Image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleSolutionImageUpload} />
                </label>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export const FlashcardForm: React.FC<{ data: FlashcardEdit; onChange: (d: FlashcardEdit) => void; isNew?: boolean; onError?: (msg: string) => void }> = ({ data, onChange, onError }) => {
  const [showExplanation, setShowExplanation] = useState(!!(data.explanation || data.explanationImagePath))

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { onError?.('Image exceeds 10MB limit.'); e.target.value = ''; return }
    const path = (file as any).path
    if (!path) return
    try {
      const result = await window.electron.saveImage(path)
      if (result.success && result.filename) onChange({ ...data, imagePath: result.filename })
      else onError?.(result.error || 'Failed to save image')
    } catch (err: any) { onError?.('Error saving image: ' + err.message) }
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

  return (
    <div className="flex flex-col gap-4">
      {/* FRONT */}
      <div className="relative w-full">
        <div className="flex items-center justify-between mb-1">
          <Label>Front / Term</Label>
          <div className="mr-[6px]">
            {data.imagePath ? (
              <div className="relative group flex items-center justify-center">
                <img src={`ece-app://${data.imagePath}`} className="w-5 h-5 object-cover rounded border border-[#333]" />
                <button type="button" onClick={() => onChange({ ...data, imagePath: undefined })} className="absolute -top-1 -right-1 bg-[#FF4B4B] text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
              </div>
            ) : (
              <label className="cursor-pointer text-text-muted hover:text-accent transition-colors" title="Add Image">
                <ImageIcon size={16} />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>
        </div>
        <MathInputField value={data.front} onChange={val => onChange({ ...data, front: val })} placeholder="Term or question..." rows={5} multiline={true} />
      </div>

      {/* BACK */}
      <div className="relative w-full">
        <Label>Back / Definition</Label>
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
            <Label>Explanation / Notes</Label>
            <MathInputField value={data.explanation || ''} onChange={val => onChange({ ...data, explanation: val })} placeholder="Explain the answer, derivation, or additional notes..." rows={6} multiline={true} />
            <div className="mt-3">
              {data.explanationImagePath ? (
                <div className="relative group inline-block">
                  <img src={`ece-app://${data.explanationImagePath}`} alt="Explanation image" className="w-24 h-24 object-cover rounded border border-[#333]" />
                  <button type="button" onClick={() => onChange({ ...data, explanationImagePath: undefined })}
                    className="absolute -top-2 -right-2 bg-[#FF4B4B] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-[#333] hover:border-accent hover:text-accent text-text-muted rounded transition-colors bg-[#0a0a0a]">
                  <ImageIcon size={24} />
                  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest mt-2 font-bold text-center leading-tight">Add<br />Image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleExplanationImageUpload} />
                </label>
              )}
            </div>
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
        <Label>Front / Term (formula name)</Label>
        <MathInputField value={data.name} onChange={val => onChange({ ...data, name: val })} placeholder="Formula name, e.g. Inverse Sine..." rows={3} multiline={true} />
      </div>
      <div className="relative w-full">
        <Label>Back / LaTeX (equation)</Label>
        <MathInputField value={data.latex} onChange={val => onChange({ ...data, latex: val })} placeholder="LaTeX equation..." rows={5} multiline={true} defaultMathMode={true} />
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
            <Label>Explanation / Notes</Label>
            <MathInputField value={data.explanation || ''} onChange={val => onChange({ ...data, explanation: val })} placeholder="Explain the formula, derivation, variable meanings..." rows={6} multiline={true} />
            <div className="mt-3">
              {data.explanationImagePath ? (
                <div className="relative group inline-block">
                  <img src={`ece-app://${data.explanationImagePath}`} alt="Explanation image" className="w-24 h-24 object-cover rounded border border-[#333]" />
                  <button type="button" onClick={() => onChange({ ...data, explanationImagePath: undefined })}
                    className="absolute -top-2 -right-2 bg-[#FF4B4B] text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-[#333] hover:border-accent hover:text-accent text-text-muted rounded transition-colors bg-[#0a0a0a]">
                  <ImageIcon size={24} />
                  <span className="text-[10px] font-['Rajdhani'] uppercase tracking-widest mt-2 font-bold text-center leading-tight">Add<br />Image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleExplanationImageUpload} />
                </label>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

