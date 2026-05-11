import React, { useState, useEffect, useCallback } from 'react'
import {
  X, Save, ArrowLeft, FileText, Upload, AlertCircle, Check, Trash2, Plus, Calculator, FlaskConical, Zap, Cpu, Layers, Wand2, GripVertical, ChevronDown, ChevronUp, AlertTriangle, RotateCcw, ImageIcon, Menu, Sigma, Type
} from 'lucide-react'
import { getSubjectFilterClasses } from '../lib/subjectColors'
import { useNavigate, Link } from 'react-router-dom'
import { parseImportedMCQs, parseImportedFlashcards } from '../lib/parser'
import { renderMath } from '../lib/latex'
import { motion, AnimatePresence } from 'framer-motion'
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

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                 */
/* ------------------------------------------------------------------ */

let _uid = 0
const uid = () => `row_${Date.now()}_${++_uid}`

type Subject = 'Mathematics' | 'General Engineering & Applied Sciences' | 'Electronics Engineering' | 'Electronics Systems & Technologies'

const SUBJECTS: { value: Subject; short: string; icon: any }[] = [
  { value: 'Mathematics', short: 'MATH', icon: Calculator },
  { value: 'General Engineering & Applied Sciences', short: 'GEAS', icon: FlaskConical },
  { value: 'Electronics Engineering', short: 'ELECS', icon: Zap },
  { value: 'Electronics Systems & Technologies', short: 'EST', icon: Cpu },
]

const SUBJECT_KEYWORDS: Record<Subject, string[]> = {
  'Mathematics': [
    'calculus', 'differential', 'integral', 'laplace',
    'fourier', 'probability', 'statistics', 'algebra',
    'trigonometry', 'derivative', 'determinant', 'eigenvalue',
    'logarithm', 'polynomial', 'binomial', 'permutation',
    'combination', 'matrices', 'vectors', 'z-transform'
  ],
  'General Engineering & Applied Sciences': [
    'chemistry', 'physics', 'economics', 'thermodynamics',
    'programming', 'ethics', 'materials', 'environmental',
    'management', 'stress', 'strain', 'newton', 'momentum',
    'energy', 'power', 'heat', 'atom', 'molecule', 'reaction',
    'pascal', 'fluid', 'pressure', 'density', 'viscosity',
    'resistivity', 'bond', 'force', 'velocity', 'acceleration'
  ],
  'Electronics Engineering': [
    'transistor', 'amplifier', 'diode', 'op-amp',
    'logic gate', 'microprocessor', 'feedback', 'control',
    'impedance', 'resistor', 'capacitor', 'inductor',
    'thevenin', 'norton', 'kirchhoff', 'boolean',
    'flip-flop', 'multiplexer', 'encoder', 'decoder',
    'oscillator', 'filter', 'rectifier', 'mosfet', 'bjt', 'jfet',
    'semiconductor', 'circuit', 'voltage', 'current'
  ],
  'Electronics Systems & Technologies': [
    'modulation', 'antenna', 'transmission', 'bandwidth',
    'fiber', 'satellite', 'protocol', 'tcp', 'osi', 'noise',
    'decibel', 'attenuation', 'propagation', 'wavelength',
    'spectrum', 'multiplexing', 'fdma', 'tdma', 'cdma', 'gsm',
    'ethernet', 'router', 'packet', 'frame', 'bit rate', 'snr',
    'frequency', 'signal', 'channel', 'network'
  ]
}

const PREDEFINED_TAGS = [
  'Excel', 'Edge', 'TOP', 'Indiabix', 'Pinoybix', 
  'EST Superbook', 'Cuervo'
]

interface EditCard {
  id: string
  type: 'mcq' | 'flashcard' | 'formula'
  data: MCQEdit | FlashcardEdit | FormulaEdit
  isNew?: boolean
}

interface FormulaEdit {
  name: string
  latex: string
  description: string
  variables: string
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

function ImportModal({ onImportCards, onClose }: { onImportCards: (cards: { term: string; definition: string; mcqData?: any }[]) => void; onClose: () => void }) {
  const [inputText, setInputText] = useState('')
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [autoFixMessage, setAutoFixMessage] = useState('')
  
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const gutterRef = React.useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!inputText.trim()) { setPreviewData([]); setPreviewWarnings([]); return }
      const { cards, warnings } = parseImportedMCQs(inputText)
      setPreviewData(cards)
      setPreviewWarnings(warnings)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputText])

  const handleImport = () => {
    if (previewData.length === 0) return
    const cards = previewData.map((item: any) => ({
      term: item.question || '',
      definition: '',
      mcqData: item,
    }))
    onImportCards(cards)
    onClose()
  }

  const handleAutoFix = () => {
    let cleanText = inputText
    const lines = cleanText.split('\n')
    let cleanedLines = lines.map(line => {
      let trimmed = line.trimEnd()
      trimmed = trimmed.replace(/^q:\s*/i, 'Q: ')
      trimmed = trimmed.replace(/^ans:\s*/i, 'ANS: ')
      trimmed = trimmed.replace(/^([a-e]):\s*/i, (match, p1) => `${p1.toUpperCase()}: `)
      if (trimmed.startsWith('ANS: ')) {
        const parts = trimmed.split('ANS: ')
        if (parts[1]) {
          trimmed = `ANS: ${parts[1].trim().toUpperCase()}`
        }
      }
      return trimmed
    })

    const restoredLines: string[] = []
    for (let i = 0; i < cleanedLines.length; i++) {
      const line = cleanedLines[i]
      const nextLine = cleanedLines[i + 1] || ''
      if (line.trim() && !/^[A-Z]+:/.test(line) && nextLine.startsWith('A:')) {
        if (line.trim().startsWith(':')) {
           restoredLines.push(`Q${line}`)
        } else {
           restoredLines.push(`Q: ${line}`)
        }
      } else {
        restoredLines.push(line)
      }
    }
    cleanedLines = restoredLines

    let result = cleanedLines.join('\n')
    result = result.replace(/(ANS:\s*[A-E])\n+([^Q\n])/g, '$1\n\nQ: $2')
    result = result.replace(/(ANS:\s*[A-E])\n+Q:/g, '$1\n\nQ:')
    
    setInputText(result)
    setAutoFixMessage('Auto-fix applied!')
    setTimeout(() => setAutoFixMessage(''), 2000)
  }

  const scrollToBlock = (warningIndex: number) => {
    if (!textareaRef.current) return
    const match = previewWarnings[warningIndex]?.match(/Block\s*(\d+)/i)
    if (match) {
      const blockNum = parseInt(match[1])
      const estimatedLine = (blockNum - 1) * 7
      const lineHeight = 20
      textareaRef.current.scrollTop = estimatedLine * lineHeight
    }
  }

  let feedbackText = "No questions detected"
  let feedbackColor = "text-[#666]"
  
  if (inputText.trim()) {
    if (previewData.length > 0 && previewWarnings.length === 0) {
      feedbackText = `✓ ${previewData.length} questions detected`
      feedbackColor = "text-[#00FF41]"
    } else if (previewData.length > 0 && previewWarnings.length > 0) {
      feedbackText = `${previewData.length} questions parsed, ${previewWarnings.length} blocks had errors`
      feedbackColor = "text-[#FFB800]"
    } else if (previewData.length === 0 && previewWarnings.length > 0) {
      feedbackText = `0 questions parsed, ${previewWarnings.length} blocks had errors`
      feedbackColor = "text-[#FF3333]"
    }
  }

  const lineCount = inputText.split('\n').length
  const linesArray = Array.from({ length: lineCount }, (_, i) => i + 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div 
        className="bg-[#161616] border border-[#333] rounded-xl w-full max-w-4xl max-h-[95vh] shadow-2xl flex flex-col animate-[slide-up_0.2s_ease]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#222]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.15)] flex items-center justify-center">
              <FileText size={18} className="text-[#00FF41]" />
            </div>
            <div>
              <h3 className="font-['Rajdhani'] text-[#E8E8E8] font-bold uppercase tracking-wider text-lg">Import MCQ Questions</h3>
              <p className="text-[11px] text-[#888] font-['IBM_Plex_Mono']">Paste your questions using the format below</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#E8E8E8] transition-colors p-2"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          {/* Format Guide */}
          <div className="bg-[#0D0D0D] border-l-4 border-l-[#00FF41] shrink-0 relative overflow-hidden transition-all duration-300">
            <button 
              onClick={() => setShowGuide(!showGuide)}
              className="w-full text-left p-[12px_16px] text-[11px] text-[#00FF41] font-['Rajdhani'] font-bold uppercase tracking-widest flex items-center justify-between hover:bg-[#00FF41]/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText size={14} />
                FORMAT GUIDE
              </div>
              <span className="text-[10px] opacity-60">{showGuide ? '[ HIDE ]' : '[ SHOW ]'}</span>
            </button>
            <AnimatePresence>
              {showGuide && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <pre className="p-[0_16px_16px_16px] text-[#E8E8E8] text-[13px] font-['IBM_Plex_Mono'] leading-relaxed whitespace-pre">
{`Q: Your question here
A: First choice
B: Second choice
C: Third choice
D: Fourth choice
ANS: B

← blank line between questions →

Q: Second question here
A: ...
...
ANS: D`}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Text Area */}
          <div className="flex flex-col flex-1 min-h-[300px]">
            <div className="flex flex-1 flex-row border border-[#333] rounded-t-lg bg-[#0D0D0D] overflow-hidden focus-within:border-[#00FF41] transition-colors relative">
              <div 
                ref={gutterRef}
                className="w-12 shrink-0 bg-[#0D0D0D] text-[#444] font-['IBM_Plex_Mono'] text-sm text-right pr-3 pl-2 select-none overflow-hidden pt-5"
              >
                {linesArray.map(line => <div key={line}>{line}</div>)}
              </div>
              <textarea
                ref={textareaRef}
                onScroll={handleScroll}
                autoFocus
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Paste your MCQ questions here..."
                className="w-full flex-1 bg-transparent text-[#E8E8E8] p-5 focus:outline-none font-['IBM_Plex_Mono'] text-sm resize-none leading-normal"
                style={{ lineHeight: '1.5rem' }}
              />
            </div>
            {/* Live Feedback Bar */}
            <div className="bg-[#111] border border-t-0 border-[#333] rounded-b-lg p-3 flex items-center justify-between">
              <span className={`text-xs font-['IBM_Plex_Mono'] font-bold ${feedbackColor}`}>
                {feedbackText}
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#222] bg-[#111] flex flex-col rounded-b-xl shrink-0 gap-4">
          
          <div className="flex items-center gap-3 self-end mb-1">
            {autoFixMessage ? (
              <span className="text-[#00FF41] text-xs font-['Rajdhani'] uppercase tracking-widest font-bold animate-[fade-in_0.2s]">
                {autoFixMessage}
              </span>
            ) : (
              <button 
                disabled={previewWarnings.length === 0}
                onClick={(e) => { e.stopPropagation(); handleAutoFix(); }}
                className={`flex items-center gap-1.5 px-3 py-1 border rounded text-[10px] font-['Rajdhani'] uppercase font-bold tracking-widest transition-colors ${
                  previewWarnings.length > 0 
                  ? 'bg-[#111] border-[#333] hover:border-[#00FF41] hover:text-[#00FF41] text-[#888]' 
                  : 'bg-[#0a0a0a] border-[#222] text-[#444] cursor-not-allowed opacity-50'
                }`}
              >
                <Wand2 size={12} /> Auto-Fix
              </button>
            )}
          </div>

          {previewWarnings.length > 0 && (
            <div className="bg-[#1a1a00] border border-[#FFB800]/30 rounded-lg overflow-hidden">
              <div className="p-3 flex items-center justify-between cursor-pointer" onClick={() => setShowErrors(!showErrors)}>
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-[#FFB800]" />
                  <span className="text-[#FFB800] text-xs font-['Rajdhani'] uppercase tracking-widest font-bold">
                    {previewWarnings.length} Issues Detected
                  </span>
                </div>
              </div>
              
              {showErrors && (
                <div className="p-3 pt-0 border-t border-[#FFB800]/10 flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar bg-[#111]/50">
                  {previewWarnings.map((warning, idx) => (
                    <div key={idx} className="text-[#E8E8E8] text-[11px] font-['IBM_Plex_Mono'] flex items-start gap-2 py-1">
                      <span className="text-[#FFB800] shrink-0 mt-0.5">•</span>
                      <span className="flex-1">{warning}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); scrollToBlock(idx); }}
                        className="text-[#444] hover:text-[#00FF41] underline underline-offset-2 transition-colors text-[10px]"
                      >
                        Go to Line
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 shrink-0">
            <button onClick={onClose} className="px-6 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold text-[#888] hover:text-[#E8E8E8] hover:bg-[#222] transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleImport}
              disabled={previewData.length === 0}
              className={`px-6 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all flex items-center gap-2 ${
                previewData.length > 0
                  ? 'bg-[var(--accent-primary)] text-black hover:bg-[var(--accent-dim)] shadow-[0_0_15px_rgba(0,255,65,0.2)]'
                  : 'bg-[#222] text-[#555] cursor-not-allowed'
              }`}
            >
              <Plus size={16} /> Import {previewData.length} Cards
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

function ImportFlashcardsModal({ onImportCards, onClose }: { onImportCards: (cards: { term: string; definition: string; flashcardData?: any }[]) => void; onClose: () => void }) {
  const [inputText, setInputText] = useState('')
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [autoFixMessage, setAutoFixMessage] = useState('')

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const gutterRef = React.useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!inputText.trim()) { setPreviewData([]); setPreviewWarnings([]); return }
      const { cards, warnings } = parseImportedFlashcards(inputText)
      setPreviewData(cards)
      setPreviewWarnings(warnings)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputText])

  const handleImport = () => {
    if (previewData.length === 0) return
    const cards = previewData.map((item: any) => ({
      term: item.front,
      definition: item.back,
      flashcardData: item,
    }))
    onImportCards(cards)
    onClose()
  }

  const handleAutoFix = () => {
    let cleanText = inputText
    const lines = cleanText.split('\n')
    let cleanedLines = lines.map(line => {
      let trimmed = line.trimEnd()
      trimmed = trimmed.replace(/^q:\s*/i, 'Q: ')
      trimmed = trimmed.replace(/^a:\s*/i, 'A: ')
      return trimmed
    })

    const restoredLines: string[] = []
    for (let i = 0; i < cleanedLines.length; i++) {
      const line = cleanedLines[i]
      const nextLine = cleanedLines[i + 1] || ''
      if (line.trim() && !/^[A-Z]+:/.test(line) && nextLine.startsWith('A:')) {
        if (line.trim().startsWith(':')) {
           restoredLines.push(`Q${line}`)
        } else {
           restoredLines.push(`Q: ${line}`)
        }
      } else {
        restoredLines.push(line)
      }
    }
    cleanedLines = restoredLines

    let result = cleanedLines.join('\n')
    result = result.replace(/(A:\s*.*)\n+Q:/g, '$1\n\nQ:')
    
    setInputText(result)
    setAutoFixMessage('Auto-fix applied!')
    setTimeout(() => setAutoFixMessage(''), 2000)
  }

  const scrollToBlock = (warningIndex: number) => {
    if (!textareaRef.current) return
    const match = previewWarnings[warningIndex]?.match(/Block\s*(\d+)/i)
    if (match) {
      const blockNum = parseInt(match[1])
      const estimatedLine = (blockNum - 1) * 3
      const lineHeight = 20
      textareaRef.current.scrollTop = estimatedLine * lineHeight
    }
  }

  let feedbackText = "No flashcards detected"
  let feedbackColor = "text-[#666]"
  
  if (inputText.trim()) {
    if (previewData.length > 0 && previewWarnings.length === 0) {
      feedbackText = `✓ ${previewData.length} flashcard pairs detected`
      feedbackColor = "text-[#00FF41]"
    } else if (previewData.length > 0 && previewWarnings.length > 0) {
      feedbackText = `${previewData.length} pairs parsed, ${previewWarnings.length} blocks had errors`
      feedbackColor = "text-[#FFB800]"
    } else if (previewData.length === 0 && previewWarnings.length > 0) {
      feedbackText = `0 pairs parsed, ${previewWarnings.length} blocks had errors`
      feedbackColor = "text-[#FF3333]"
    }
  }

  const lineCount = inputText.split('\n').length
  const linesArray = Array.from({ length: lineCount }, (_, i) => i + 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div 
        className="bg-[#161616] border border-[#333] rounded-xl w-full max-w-4xl max-h-[95vh] shadow-2xl flex flex-col animate-[slide-up_0.2s_ease]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#222]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.15)] flex items-center justify-center">
              <Layers size={18} className="text-[#00FF41]" />
            </div>
            <div>
              <h3 className="font-['Rajdhani'] text-[#E8E8E8] font-bold uppercase tracking-wider text-lg">Import Flashcards</h3>
              <p className="text-[11px] text-[#888] font-['IBM_Plex_Mono']">Paste your terms and definitions using the format below</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#E8E8E8] transition-colors p-2"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          {/* Format Guide */}
          <div className="bg-[#0D0D0D] border-l-4 border-l-[#00FF41] shrink-0 relative overflow-hidden transition-all duration-300">
            <button 
              onClick={() => setShowGuide(!showGuide)}
              className="w-full text-left p-[12px_16px] text-[11px] text-[#00FF41] font-['Rajdhani'] font-bold uppercase tracking-widest flex items-center justify-between hover:bg-[#00FF41]/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers size={14} />
                FORMAT GUIDE
              </div>
              <span className="text-[10px] opacity-60">{showGuide ? '[ HIDE ]' : '[ SHOW ]'}</span>
            </button>
            <AnimatePresence>
              {showGuide && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <pre className="p-[0_16px_16px_16px] text-[#E8E8E8] text-[13px] font-['IBM_Plex_Mono'] leading-relaxed whitespace-pre">
{`Q: Term here
A: Definition here

← blank line between flashcards →

Q: Another term
A: Another definition`}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Text Area */}
          <div className="flex flex-col flex-1 min-h-[300px]">
            <div className="flex flex-1 flex-row border border-[#333] rounded-t-lg bg-[#0D0D0D] overflow-hidden focus-within:border-[#00FF41] transition-colors relative">
              <div 
                ref={gutterRef}
                className="w-12 shrink-0 bg-[#0D0D0D] text-[#444] font-['IBM_Plex_Mono'] text-sm text-right pr-3 pl-2 select-none overflow-hidden pt-5"
              >
                {linesArray.map(line => <div key={line}>{line}</div>)}
              </div>
              <textarea
                ref={textareaRef}
                onScroll={handleScroll}
                autoFocus
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Paste your flashcards here..."
                className="w-full flex-1 bg-transparent text-[#E8E8E8] p-5 focus:outline-none font-['IBM_Plex_Mono'] text-sm resize-none leading-normal"
                style={{ lineHeight: '1.5rem' }}
              />
            </div>
            {/* Live Feedback Bar */}
            <div className="bg-[#111] border border-t-0 border-[#333] rounded-b-lg p-3 flex items-center justify-between">
              <span className={`text-xs font-['IBM_Plex_Mono'] font-bold ${feedbackColor}`}>
                {feedbackText}
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#222] bg-[#111] flex flex-col rounded-b-xl shrink-0 gap-4">
          
          <div className="flex items-center gap-3 self-end mb-1">
            {autoFixMessage ? (
              <span className="text-[#00FF41] text-xs font-['Rajdhani'] uppercase tracking-widest font-bold animate-[fade-in_0.2s]">
                {autoFixMessage}
              </span>
            ) : (
              <button 
                disabled={previewWarnings.length === 0}
                onClick={(e) => { e.stopPropagation(); handleAutoFix(); }}
                className={`flex items-center gap-1.5 px-3 py-1 border rounded text-[10px] font-['Rajdhani'] uppercase font-bold tracking-widest transition-colors ${
                  previewWarnings.length > 0 
                  ? 'bg-[#111] border-[#333] hover:border-[#00FF41] hover:text-[#00FF41] text-[#888]' 
                  : 'bg-[#0a0a0a] border-[#222] text-[#444] cursor-not-allowed opacity-50'
                }`}
              >
                <Wand2 size={12} /> Auto-Fix
              </button>
            )}
          </div>

          {previewWarnings.length > 0 && (
            <div className="bg-[#1a1a00] border border-[#FFB800]/30 rounded-lg overflow-hidden">
              <div className="p-3 flex items-center justify-between cursor-pointer" onClick={() => setShowErrors(!showErrors)}>
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-[#FFB800]" />
                  <span className="text-[#FFB800] text-xs font-['Rajdhani'] uppercase tracking-widest font-bold">
                    {previewWarnings.length} Issues Detected
                  </span>
                </div>
              </div>
              
              {showErrors && (
                <div className="p-3 pt-0 border-t border-[#FFB800]/10 flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar bg-[#111]/50">
                  {previewWarnings.map((warning, idx) => (
                    <div key={idx} className="text-[#E8E8E8] text-[11px] font-['IBM_Plex_Mono'] flex items-start gap-2 py-1">
                      <span className="text-[#FFB800] shrink-0 mt-0.5">•</span>
                      <span className="flex-1">{warning}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); scrollToBlock(idx); }}
                        className="text-[#444] hover:text-[#00FF41] underline underline-offset-2 transition-colors text-[10px]"
                      >
                        Go to Line
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 shrink-0">
            <button onClick={onClose} className="px-6 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold text-[#888] hover:text-[#E8E8E8] hover:bg-[#222] transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleImport}
              disabled={previewData.length === 0}
              className={`px-6 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all flex items-center gap-2 ${
                previewData.length > 0
                  ? 'bg-[var(--accent-primary)] text-black hover:bg-[var(--accent-dim)] shadow-[0_0_15px_rgba(0,255,65,0.2)]'
                  : 'bg-[#222] text-[#555] cursor-not-allowed'
              }`}
            >
              <Plus size={16} /> Import {previewData.length} Flashcards
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Card Form Components (From EditDeck)                              */
/* ------------------------------------------------------------------ */

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
    if (el.value !== value) el.value = value
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
              <div className="text-[10px] font-['Rajdhani'] uppercase tracking-widest text-[#888] mb-1">Preview</div>
              {(() => {
                try {
                  const rendered = renderMath(value)
                  return <div className="text-[#E8E8E8]" dangerouslySetInnerHTML={{ __html: rendered }} />
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
      {/* QUESTION (full width) */}
      <div className="relative w-full">
        <div className="flex items-center justify-between mb-1">
          <Label>Question</Label>
          <div className="flex items-center gap-2 mr-10 z-10 relative">
            {data.imagePath ? (
              <div className="relative group flex items-center justify-center">
                <img src={`ece-app://${data.imagePath}`} alt="Question image" className="w-6 h-6 object-cover rounded border border-[#333]" />
                <button 
                  onClick={() => set({ imagePath: undefined })}
                  className="absolute -top-1 -right-1 bg-[#FF4B4B] text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer text-[#888] hover:text-[#00FF41] transition-colors" title="Add Image">
                <ImageIcon size={18} />
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

      <div className="grid grid-cols-2 gap-3">
        {data.choices.map((choice, i) => (
          <div key={i} className="flex flex-col">
            <Label>Choice {labels[i]}</Label>
            <div className="flex items-start gap-2">
              <input
                type="radio"
                name={`ans-${data.question.slice(0, 8) || Math.random()}`}
                checked={data.answer === i}
                onChange={() => set({ answer: i })}
                className="accent-[#00FF41] w-4 h-4 flex-shrink-0 cursor-pointer mt-3"
              />
              <MathInputField
                value={choice}
                onChange={val => setChoice(i, val)}
                placeholder={`Choice ${labels[i]}...`}
                multiline={false}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="w-full">
        <Label>Explanation (optional)</Label>
        <textarea rows={2} className={textareaCls} value={data.explanation}
          onChange={e => set({ explanation: e.target.value })} placeholder="Explanation for the correct answer..." />
      </div>
    </div>
  )
}

const FlashcardForm: React.FC<{ data: FlashcardEdit; onChange: (d: FlashcardEdit) => void; isNew?: boolean; onError?: (msg: string) => void }> = ({ data, onChange, onError }) => {
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
      {/* FRONT (full width) */}
      <div className="relative w-full">
        <div className="flex items-center justify-between mb-1">
          <Label>Front / Term</Label>
          <div className="flex items-center gap-2 mr-10 z-10 relative">
            {data.imagePath ? (
              <div className="relative group flex items-center justify-center">
                <img src={`ece-app://${data.imagePath}`} alt="Flashcard image" className="w-6 h-6 object-cover rounded border border-[#333]" />
                <button 
                  onClick={() => onChange({ ...data, imagePath: undefined })}
                  className="absolute -top-1 -right-1 bg-[#FF4B4B] text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer text-[#888] hover:text-[#00FF41] transition-colors" title="Add Image">
                <ImageIcon size={18} />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>
        </div>
        <MathInputField
          value={data.front}
          onChange={val => onChange({ ...data, front: val })}
          placeholder="Term or question..."
          rows={5}
          multiline={true}
        />
      </div>

      {/* BACK (full width) */}
      <div className="relative w-full">
        <Label>Back / Definition</Label>
        <MathInputField
          value={data.back}
          onChange={val => onChange({ ...data, back: val })}
          placeholder="Definition or answer..."
          rows={5}
          multiline={true}
        />
      </div>
    </div>
  )
}

const FormulaForm: React.FC<{
  data: FormulaEdit
  onChange: (d: FormulaEdit) => void
  isNew?: boolean
  onError?: (msg: string) => void
}> = ({ data, onChange, isNew, onError }) => {
  const mappedData: FlashcardEdit = {
    front: data.name,
    back: data.latex,
    imagePath: undefined,
  }

  return (
    <FlashcardForm
      data={mappedData}
      isNew={isNew}
      onError={onError}
      onChange={(next) => onChange({
        ...data,
        name: next.front,
        latex: next.back,
      })}
    />
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

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

export default function AddDeck() {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [folderName, setFolderName] = useState('Uncategorized')
  const [existingFolders, setExistingFolders] = useState<string[]>([])
  const [subject, setSubject] = useState<Subject>('Electronics Engineering')
  const [deckTags, setDeckTags] = useState<Set<string>>(new Set())
  const [customTagInput, setCustomTagInput] = useState('')

  const [deckType, setDeckType] = useState<'mcq' | 'flashcard' | 'formula'>('mcq')
  const [cards, setCards] = useState<EditCard[]>([])
  
  const [importModalType, setImportModalType] = useState<'none' | 'mcq' | 'flashcard'>('none')
  const [saving, setSaving] = useState(false)
  
  const [showConfirmTypeModal, setShowConfirmTypeModal] = useState(false)
  const [pendingType, setPendingType] = useState<'mcq' | 'flashcard' | 'formula' | null>(null)

  const [historyStack, setHistoryStack] = useState<EditCard[][]>([])
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const cardsRef = React.useRef(cards)
  useEffect(() => { cardsRef.current = cards }, [cards])

  // Fetch existing folders for autocomplete
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

  useEffect(() => {
    // Skip if too few cards (initial empty state)
    if (cards.length <= 3) return

    // Build searchable text from all card content
    const text = cards.map(card => {
      if (card.type === 'mcq') {
        const d = card.data as MCQEdit
        return [d.question, ...d.choices].join(' ')
      } else if (card.type === 'formula') {
        const d = card.data as FormulaEdit
        return [d.name, d.latex, d.description, d.variables].join(' ')
      } else {
        const d = card.data as FlashcardEdit
        return [d.front, d.back].join(' ')
      }
    }).join(' ').toLowerCase()

    // Score each subject
    const scores = (Object.entries(SUBJECT_KEYWORDS) as [Subject, string[]][])
      .map(([subj, keywords]) => ({
        subject: subj,
        score: keywords.filter(kw => text.includes(kw)).length
      }))
      .sort((a, b) => b.score - a.score)

    const [first, second] = scores
    console.log('[AutoDetect] scores:', scores, '→', first.subject)

    // Only set if clear winner (score > 0 and strictly greater than second)
    if (first.score > 0 && first.score > second.score) {
      setSubject(first.subject)
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
          ? { question: '', choices: ['', '', '', ''], answer: 0, explanation: '' }
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
    const initialCards: EditCard[] = Array.from({ length: 3 }).map(() => ({
      id: uid(),
      type: newType,
      isNew: true,
      data: newType === 'mcq' 
        ? { question: '', choices: ['', '', '', ''], answer: 0, explanation: '' }
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
    const initialCards: EditCard[] = Array.from({ length: 3 }).map(() => ({
      id: uid(),
      type: newType,
      isNew: true,
      data: newType === 'mcq' 
        ? { question: '', choices: ['', '', '', ''], answer: 0, explanation: '' }
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
        ? { question: '', choices: ['', '', '', ''], answer: 0, explanation: '' }
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
        explanation: c.mcqData.explanation || ''
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
  const canSave = title.trim().length > 0 && validCards.length > 0

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    
    const run = (sql: string, params: any[] = []) => (window as any).electron.db.run(sql, params)
    const serializeCardData = (data: any) => {
      // Prevent double encode if data happens to be a string already
      if (typeof data === 'string') return data
      return JSON.stringify(data)
    }

    try {
      await run('BEGIN TRANSACTION')

      const topicId = 'topic_' + Date.now().toString(36)
      await run(
        `INSERT INTO topics (id, name, subject, description, tags, folder_name) VALUES (?, ?, ?, ?, ?, ?)`,
        [topicId, title.trim(), subject, description.trim(), JSON.stringify(Array.from(deckTags)), folderName.trim()]
      )

      for (const card of validCards) {
        const cardId = 'card_' + Math.random().toString(36).substr(2, 9)
        const cleanedData = stripPlaceholders(card.data)
        if (card.type === 'mcq') {
          console.log('[SAVE choices type]', Array.isArray((cleanedData as any).choices), (cleanedData as any).choices)
        }
        const dataJson = serializeCardData(cleanedData)
        console.log('[before save]', dataJson)
        await run(
          `INSERT INTO cards (id, topic_id, type, data, is_custom) VALUES (?, ?, ?, ?, ?)`,
          [cardId, topicId, card.type, dataJson, 1]
        )
      }

      await run('COMMIT')
      navigate('/study')
    } catch (err: any) {
      console.error('Save failed', err)
      try { await run('ROLLBACK') } catch {}
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full bg-[#0D0D0D] overflow-y-auto flex flex-col font-['IBM_Plex_Mono']">
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
            {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-[#0D0D0D]/90 backdrop-blur-md border-b border-[#1a1a1a] shrink-0">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="font-['Orbitron'] text-2xl font-bold tracking-wider mb-1">
              <span className="text-[var(--accent-primary)]">ADD</span> <span className="text-white">DECKS</span>
            </h1>
            <div className="text-[#888] font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest flex items-center gap-2">
              <Link to="/study" className="hover:text-[#E8E8E8] transition-colors">Study</Link>
              <span className="text-[#444]">›</span>
              <span className="text-[#E8E8E8]">Add Decks</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)}
              className="px-6 py-2.5 rounded border border-[#333] text-[#888] hover:text-[#E8E8E8] hover:border-[#555] transition-colors font-['Rajdhani'] uppercase tracking-widest font-bold text-sm">
              Cancel
            </button>
            <div className="relative group">
              <button 
                onClick={handleSave} 
                disabled={!canSave || saving}
                className={`px-8 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest font-bold text-sm transition-all flex items-center gap-2 ${
                  canSave && !saving
                    ? 'bg-[var(--accent-primary)] text-black hover:bg-[var(--accent-dim)] shadow-[0_0_15px_rgba(0,255,65,0.25)]'
                    : 'bg-[#222] text-[#555] cursor-not-allowed'
                }`}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Deck'}
              </button>
              {!canSave && (
                <div className="absolute top-full right-0 mt-2 w-48 p-2 bg-[#161616] border border-[#333] rounded shadow-xl text-center text-xs font-['IBM_Plex_Mono'] text-[#888] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  Add a title and at least one complete card to save
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-6 py-8 flex flex-col gap-8 pb-32">
        
        {/* 1. Metadata & Tags Header */}
        <section className="flex flex-col gap-6 bg-[#111] border border-[#1e1e1e] p-6 rounded-xl">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={80}
                placeholder='Enter deck title, e.g. "Electromagnetism"'
                className="w-full bg-transparent text-[#E8E8E8] text-[1.5rem] font-['Orbitron'] border-b-2 border-[#333] focus:border-[#00FF41] pb-3 focus:outline-none placeholder:text-[#555] transition-colors tracking-wide pr-16"
              />
              <span className="absolute right-0 bottom-4 text-xs font-['IBM_Plex_Mono'] text-[#666]">
                {title.length} / 80
              </span>
            </div>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add a description... (optional)"
              className="w-full bg-transparent text-[#aaa] text-sm font-['IBM_Plex_Mono'] pb-2 focus:outline-none placeholder:text-[#555] transition-colors"
            />
            <div className="mt-2 pt-2 border-t border-[#222]">
              <label className="text-[10px] text-[#555] font-['Rajdhani'] font-bold uppercase tracking-widest mb-1 block">
                Folder / Category
              </label>
              <div className="relative group/folder">
                <input
                  value={folderName}
                  list="folder-suggestions"
                  onChange={e => setFolderName(e.target.value)}
                  placeholder='e.g. "Electronics Review", "Midterms"...'
                  className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-[#E8E8E8] text-sm font-['IBM_Plex_Mono'] focus:border-[#00FF41] focus:bg-[#111] outline-none transition-colors pr-8"
                />
                {folderName && (
                  <button 
                    onClick={() => setFolderName('')}
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
          </div>

          <div>
            <label className="text-[11px] text-[#00FF41] font-['Rajdhani'] font-bold uppercase tracking-widest mb-3 block">
              Subject
            </label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map(s => {
                const Icon = s.icon
                const isSelected = subject === s.value
                const colorClasses = getSubjectFilterClasses(s.short, isSelected)
                
                return (
                  <button 
                    key={s.value} 
                    onClick={() => setSubject(s.value)}
                    className={`px-4 py-2 rounded-md font-['Rajdhani'] uppercase tracking-widest font-bold text-[11px] flex items-center gap-2 transition-all duration-200 ${colorClasses} ${
                      !isSelected ? 'bg-[#111] hover:bg-[#1A1A1A] border-[#222] text-[#888]' : ''
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
            <div className="flex flex-wrap gap-3">
              {PREDEFINED_TAGS.map(tag => {
                const isSelected = deckTags.has(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      const next = new Set(deckTags)
                      if (next.has(tag)) next.delete(tag)
                      else next.add(tag)
                      setDeckTags(next)
                    }}
                    className={`px-4 py-2 rounded-full font-['Rajdhani'] uppercase tracking-wider text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-[#00FF41]/10 border-[#00FF41] text-[#00FF41]'
                        : 'bg-[#161616] border-[#333] text-[#888] hover:border-[#555] hover:text-[#E8E8E8]'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
              {Array.from(deckTags).filter(t => !PREDEFINED_TAGS.includes(t)).map(tag => (
                <div key={tag} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#00FF41]/10 border border-[#00FF41] text-[#00FF41] font-['Rajdhani'] uppercase tracking-wider text-xs font-bold">
                  {tag}
                  <button onClick={() => {
                    const next = new Set(deckTags)
                    next.delete(tag)
                    setDeckTags(next)
                  }} className="text-[#00FF41] hover:text-white transition-colors cursor-pointer rounded-full p-0.5 -mr-2">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-2 mt-3 w-full max-w-sm">
              <input
                type="text"
                placeholder="Add custom tag..."
                value={customTagInput}
                onChange={e => setCustomTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (customTagInput.trim()) {
                      setDeckTags(prev => new Set(prev).add(customTagInput.trim()));
                      setCustomTagInput('');
                    }
                  }
                }}
                className="flex-1 bg-[#111] border border-[#333] rounded px-3 py-2 text-sm text-[#E8E8E8] placeholder-[#555] focus:border-[#00FF41] focus:outline-none font-['Rajdhani'] uppercase tracking-wider transition-colors h-[38px]"
              />
              <button 
                onClick={() => {
                  if (customTagInput.trim()) {
                    setDeckTags(prev => new Set(prev).add(customTagInput.trim()));
                    setCustomTagInput('');
                  }
                }}
                className="w-[38px] h-[38px] bg-[#111] border border-[#333] text-[#888] flex items-center justify-center rounded hover:text-[#00FF41] hover:border-[#00FF41] transition-colors shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </section>

        {/* 2. Creation Controls */}
        <section className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          {/* Deck Type Toggle */}
          <div className="flex shrink-0 flex-wrap bg-[#111] border border-[#222] p-1 rounded-lg gap-1">
            <button
              onClick={() => handleDeckTypeChange('mcq')}
              className={`px-6 py-2 rounded-md font-['Rajdhani'] uppercase tracking-widest font-bold text-sm transition-all whitespace-nowrap ${
                deckType === 'mcq'
                  ? 'bg-[#222] text-[#00FF41] shadow-sm'
                  : 'text-[#888] hover:text-[#ccc]'
              }`}
            >
              MCQ Set
            </button>
            <button
              onClick={() => handleDeckTypeChange('flashcard')}
              className={`px-6 py-2 rounded-md font-['Rajdhani'] uppercase tracking-widest font-bold text-sm transition-all whitespace-nowrap ${
                deckType === 'flashcard'
                  ? 'bg-[#222] text-[#00FF41] shadow-sm'
                  : 'text-[#888] hover:text-[#ccc]'
              }`}
            >
              Flashcard Set
            </button>
            <button
              onClick={() => handleDeckTypeChange('formula')}
              className={`px-6 py-2 rounded-md font-['Rajdhani'] uppercase tracking-widest font-bold text-sm transition-all whitespace-nowrap ${
                deckType === 'formula'
                  ? 'bg-[#222] text-[#00FF41] shadow-sm'
                  : 'text-[#888] hover:text-[#ccc]'
              }`}
            >
              Formula Set
            </button>
          </div>

          {/* Import Buttons */}
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <button
              onClick={() => openImportModal('mcq')}
              className="flex items-center gap-2 px-4 py-2 rounded border border-[#333] bg-[#161616] text-[#888] hover:text-[#00FF41] hover:border-[#00FF41]/50 font-['Rajdhani'] uppercase tracking-widest text-xs font-bold transition-all"
            >
              <Upload size={14} /> Import MCQs
            </button>
            <button
              onClick={() => openImportModal('flashcard')}
              className="flex items-center gap-2 px-4 py-2 rounded border border-[#333] bg-[#161616] text-[#888] hover:text-[#00FF41] hover:border-[#00FF41]/50 font-['Rajdhani'] uppercase tracking-widest text-xs font-bold transition-all"
            >
              <Upload size={14} /> Import Flashcards
            </button>
          </div>
        </section>

        {/* 3. The Manual Editor */}
        <section className="flex flex-col gap-3">
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

          {/* 4. Footer Actions */}
          <div className="mt-4 flex items-center gap-3">
            {historyStack.length > 0 && (
              <button
                onClick={undo}
                className="flex items-center justify-center p-5 rounded-lg border-2 border-[#666] text-[#666] hover:text-[#00FF41] hover:border-[#00FF41] transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={addCard}
              className="w-full py-5 rounded-lg border-2 border-dashed border-[#333] bg-[#111] hover:bg-[#161616] hover:border-[#00FF41]/50 text-[#888] hover:text-[#00FF41] flex flex-col items-center justify-center gap-2 transition-all group"
            >
              <div className="w-8 h-8 rounded-full bg-[#1a1a1a] group-hover:bg-[#00FF41]/10 flex items-center justify-center transition-colors">
                <Plus size={18} />
              </div>
              <span className="font-['Rajdhani'] font-bold uppercase tracking-widest text-sm">Add Card</span>
            </button>
          </div>
        </section>

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
              className="bg-[#0D0D0D] border border-[#FF4B4B] rounded-lg shadow-[0_0_30px_rgba(255,75,75,0.15)] w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-[#222] flex items-center gap-3 bg-[#111]">
                <AlertTriangle className="w-6 h-6 text-[#FF4B4B]" />
                <h2 className="text-xl font-bold text-[#E8E8E8] font-['Rajdhani'] uppercase tracking-wider">
                  Change Set Type
                </h2>
              </div>
              <div className="p-6">
                <p className="text-[#CCCCCC] font-['Rajdhani'] tracking-wider mb-4 leading-relaxed text-base">
                  Switching to <strong className="text-[#E8E8E8] font-bold">{pendingType === 'mcq' ? 'MCQ Set' : pendingType === 'flashcard' ? 'Flashcard Set' : 'Formula Set'}</strong> will permanently clear all current cards in this editor. This action cannot be undone.
                </p>
              </div>
              <div className="p-6 border-t border-[#222] bg-[#111] flex justify-end gap-3">
                <button 
                  onClick={() => { setShowConfirmTypeModal(false); setPendingType(null); }}
                  className="px-5 py-2 rounded bg-transparent border border-[#333] text-[#888] hover:text-[#E8E8E8] hover:border-[#555] transition-colors font-['Rajdhani'] uppercase tracking-wider text-sm font-bold"
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
    </div>
  )
}
