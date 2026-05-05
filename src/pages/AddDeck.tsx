import React, { useState, useEffect } from 'react'
import {
  X, Save, ArrowLeft, FileText, Upload, AlertCircle, Check, Trash2, Plus, Calculator, FlaskConical, Zap, Cpu, Layers
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { parseImportedMCQs, parseImportedFlashcards } from '../lib/parser'
import { renderMath } from '../lib/latex'
import { motion, AnimatePresence } from 'framer-motion'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
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

const PREDEFINED_TAGS = [
  'Excel', 'Edge', 'Indiabix', 'Pinoybix', 'Top', 
  'PERCDC', 'EST Superbook', 'Forouzan'
]

/* ------------------------------------------------------------------ */
/*  Import Modal (fullscreen overlay)                                  */
/* ------------------------------------------------------------------ */

function ImportModal({ onImportCards, onClose }: { onImportCards: (cards: { term: string; definition: string; mcqData?: any }[]) => void; onClose: () => void }) {
  const [inputText, setInputText] = useState('')
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])

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
      term: item.question || '', // Used as fallback
      definition: '', // Not used for MCQ in UI
      mcqData: item,
    }))
    onImportCards(cards)
    onClose()
  }

  // Live feedback text
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
          <div className="bg-[#0D0D0D] border-l-4 border-l-[#00FF41] p-[12px_16px] shrink-0 relative">
            <div className="text-[11px] text-[#00FF41] font-['Rajdhani'] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
              FORMAT GUIDE
            </div>
            <pre className="text-[#E8E8E8] text-[13px] font-['IBM_Plex_Mono'] leading-relaxed whitespace-pre">
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
          </div>

          {/* Text Area */}
          <div className="flex flex-col flex-1 min-h-[300px]">
            <textarea
              autoFocus
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Paste your MCQ questions here..."
              className="w-full flex-1 bg-[#0D0D0D] text-[#E8E8E8] border border-[#333] focus:border-[#00FF41] p-5 rounded-t-lg focus:outline-none font-['IBM_Plex_Mono'] text-sm resize-none transition-colors"
            />
            {/* Live Feedback Bar */}
            <div className="bg-[#111] border border-t-0 border-[#333] rounded-b-lg p-3 flex items-center justify-between">
              <span className={`text-xs font-['IBM_Plex_Mono'] font-bold ${feedbackColor}`}>
                {feedbackText}
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#222] bg-[#111] flex justify-between items-start rounded-b-xl shrink-0 gap-6">
          {/* Errors List */}
          <div className="flex-1 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
            {previewWarnings.length > 0 && (
              <div className="flex flex-col gap-1">
                {previewWarnings.map((warning, idx) => (
                  <div key={idx} className="text-[#FF3333] text-xs font-['IBM_Plex_Mono'] flex items-start gap-1.5">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0 mt-auto">
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

/* ------------------------------------------------------------------ */
/*  Import Flashcards Modal (fullscreen overlay)                       */
/* ------------------------------------------------------------------ */

function ImportFlashcardsModal({ onImportCards, onClose }: { onImportCards: (cards: { term: string; definition: string; flashcardData?: any }[]) => void; onClose: () => void }) {
  const [inputText, setInputText] = useState('')
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])

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
          <div className="bg-[#0D0D0D] border-l-4 border-l-[#00FF41] p-[12px_16px] shrink-0 relative">
            <div className="text-[11px] text-[#00FF41] font-['Rajdhani'] font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
              FORMAT GUIDE
            </div>
            <pre className="text-[#E8E8E8] text-[13px] font-['IBM_Plex_Mono'] leading-relaxed whitespace-pre">
{`Q: Term here
A: Definition here

← blank line between flashcards →

Q: Another term
A: Another definition`}
            </pre>
          </div>

          {/* Text Area */}
          <div className="flex flex-col flex-1 min-h-[300px]">
            <textarea
              autoFocus
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Paste your flashcards here..."
              className="w-full flex-1 bg-[#0D0D0D] text-[#E8E8E8] border border-[#333] focus:border-[#00FF41] p-5 rounded-t-lg focus:outline-none font-['IBM_Plex_Mono'] text-sm resize-none transition-colors"
            />
            {/* Live Feedback Bar */}
            <div className="bg-[#111] border border-t-0 border-[#333] rounded-b-lg p-3 flex items-center justify-between">
              <span className={`text-xs font-['IBM_Plex_Mono'] font-bold ${feedbackColor}`}>
                {feedbackText}
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#222] bg-[#111] flex justify-between items-start rounded-b-xl shrink-0 gap-6">
          {/* Errors List */}
          <div className="flex-1 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
            {previewWarnings.length > 0 && (
              <div className="flex flex-col gap-1">
                {previewWarnings.map((warning, idx) => (
                  <div key={idx} className="text-[#FF3333] text-xs font-['IBM_Plex_Mono'] flex items-start gap-1.5">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0 mt-auto">
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
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

interface ImportedCard {
  id: string;
  mcqData?: any;
  flashcardData?: any;
}

export default function AddDeck() {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState<Subject>('Electronics Engineering')
  const [deckTags, setDeckTags] = useState<Set<string>>(new Set())
  const [customTagInput, setCustomTagInput] = useState('')

  const [importModalType, setImportModalType] = useState<'none' | 'mcq' | 'flashcard'>('none')
  const [cards, setCards] = useState<ImportedCard[]>([])
  const [saving, setSaving] = useState(false)
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0)
  const [suggestedSubject, setSuggestedSubject] = useState<Subject | null>(null)

  // Auto-detect subject when cards are imported
  useEffect(() => {
    if (cards.length === 0) {
      setSuggestedSubject(null)
      return
    }

  const KEYWORDS: Record<Subject, { word: string; weight: number }[]> = {
      'Mathematics': [
        { word: 'calculus', weight: 1 }, { word: 'integral', weight: 1 }, { word: 'derivative', weight: 1 },
        { word: 'laplace', weight: 3 }, { word: 'fourier', weight: 3 }, { word: 'z-transform', weight: 3 },
        { word: 'differential equation', weight: 3 }, { word: 'matrix', weight: 1 }, { word: 'probability', weight: 2 },
        { word: 'statistics', weight: 1 }, { word: 'divergence', weight: 3 }, { word: 'curl', weight: 2 },
        { word: 'bessel', weight: 3 }, { word: 'legendre', weight: 3 }, { word: 'stokes theorem', weight: 3 }
      ],
      'General Engineering & Applied Sciences': [
        { word: 'chemistry', weight: 2 }, { word: 'physics', weight: 1 }, { word: 'thermodynamics', weight: 3 },
        { word: 'enthalpy', weight: 3 }, { word: 'entropy', weight: 3 }, { word: 'economics', weight: 2 },
        { word: 'annuity', weight: 3 }, { word: 'depreciation', weight: 3 }, { word: 'present worth', weight: 3 },
        { word: 'ethics', weight: 3 }, { word: 'prc', weight: 3 }, { word: 'licensure', weight: 3 },
        { word: 'contract', weight: 2 }, { word: 'autocad', weight: 3 }, { word: 'cad', weight: 3 },
        { word: 'material science', weight: 3 }, { word: 'crystalline', weight: 3 }, { word: 'polymer', weight: 3 },
        { word: 'management', weight: 3 }, { word: 'planning', weight: 3 }, 
        { word: 'organizing', weight: 3 }, { word: 'leading', weight: 3 }, 
        { word: 'controlling', weight: 3 }, { word: 'swot', weight: 3 }, 
        { word: 'budget', weight: 2 }, { word: 'project', weight: 2 },
        { word: 'organization', weight: 2 }, { word: 'sales', weight: 2 },
        { word: 'consulting', weight: 2 }, { word: 'manufacturing', weight: 2 },
        { word: 'technopreneurship', weight: 3 }
      ],
      'Electronics Engineering': [
        { word: 'resistor', weight: 1 }, { word: 'capacitor', weight: 1 }, { word: 'inductor', weight: 1 },
        { word: 'diode', weight: 2 }, { word: 'transistor', weight: 2 }, { word: 'bjt', weight: 3 },
        { word: 'fet', weight: 3 }, { word: 'mosfet', weight: 3 }, { word: 'op-amp', weight: 3 },
        { word: 'thyristor', weight: 3 }, { word: 'scr', weight: 3 }, { word: 'triac', weight: 3 },
        { word: 'logic gate', weight: 2 }, { word: 'boolean', weight: 2 }, { word: 'karnaugh', weight: 3 },
        { word: 'flip flop', weight: 3 }, { word: 'microprocessor', weight: 3 }, { word: 'microcontroller', weight: 3 },
        { word: 'thevenin', weight: 3 }, { word: 'norton', weight: 3 }, { word: 'kirchhoff', weight: 2 }
      ],
      'Electronics Systems & Technologies': [
        { word: 'modulation', weight: 3 }, { word: 'demodulation', weight: 3 }, { word: 'am', weight: 2 },
        { word: 'fm', weight: 2 }, { word: 'pcm', weight: 3 }, { word: 'ask', weight: 3 }, { word: 'fsk', weight: 3 },
        { word: 'psk', weight: 3 }, { word: 'qam', weight: 3 }, { word: 'antenna', weight: 3 },
        { word: 'waveguide', weight: 3 }, { word: 'smith chart', weight: 3 }, { word: 'transmission line', weight: 3 },
        { word: 'fiber optic', weight: 3 }, { word: 'multiplexing', weight: 3 }, { word: 'tdm', weight: 3 },
        { word: 'fdm', weight: 3 }, { word: 'cdma', weight: 3 }, { word: 'osi model', weight: 3 },
        { word: 'tcp/ip', weight: 3 }, { word: 'superheterodyne', weight: 3 }, { word: 'path loss', weight: 3 }
      ]
    }

    const allText = cards.map(c => {
      if (c.mcqData) return c.mcqData.question + ' ' + (c.mcqData.choices?.join(' ') || '')
      if (c.flashcardData) return (c.flashcardData.front || '') + ' ' + (c.flashcardData.back || '')
      return ''
    }).join(' ').toLowerCase()

    const scores: Record<Subject, number> = {
      'Mathematics': 0,
      'General Engineering & Applied Sciences': 0,
      'Electronics Engineering': 0,
      'Electronics Systems & Technologies': 0
    }

    Object.entries(KEYWORDS).forEach(([subj, words]) => {
      words.forEach(({ word, weight }) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi')
        const matches = allText.match(regex)
        if (matches) scores[subj as Subject] += (matches.length * weight)
      })
    })

    const sorted = Object.entries(scores)
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])

    if (sorted.length > 0) {
      const top = sorted[0]
      const secondScore = sorted.length > 1 ? sorted[1][1] : 0
      
      // Auto-switch only if the top score is a clear winner (e.g., 20% higher than 2nd place)
      if (sorted.length === 1 || top[1] > secondScore * 1.2) {
        const topSubject = top[0] as Subject
        setSuggestedSubject(topSubject)
        setSubject(topSubject)

        // Smart Title Generation: only if title is currently empty
        if (!title.trim()) {
          const shortName = SUBJECTS.find(s => s.value === topSubject)?.short || 'MIXED'
          setTitle(`${shortName} Review Batch — ${cards.length} items`)
        }
      } else {
        // If it's too close to call, suggest it but don't force switch the UI
        setSuggestedSubject(top[0] as Subject)
        if (!title.trim()) {
          setTitle(`Mixed Review Batch — ${cards.length} items`)
        }
      }
    } else {
      setSuggestedSubject(null)
      if (cards.length > 0 && !title.trim()) {
        setTitle(`Mixed Review Batch — ${cards.length} items`)
      }
    }
  }, [cards])

  const handleImportMCQs = (imported: { mcqData?: any }[]) => {
    const newRows: ImportedCard[] = imported.filter(c => c.mcqData).map(c => ({
      id: uid(),
      mcqData: c.mcqData,
    }))
    setCards(newRows)
    setSelectedQuestionIndex(0)
  }

  const handleImportFlashcards = (imported: { flashcardData?: any }[]) => {
    const newRows: ImportedCard[] = imported.filter(c => c.flashcardData).map(c => ({
      id: uid(),
      flashcardData: c.flashcardData,
    }))
    setCards(newRows)
    setSelectedQuestionIndex(0)
  }

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all imported questions?')) {
      setCards([])
    }
  }

  const handleSave = async () => {
    if (!title.trim()) { alert('Please enter a title for your set.'); return }
    if (cards.length === 0) { alert('Please import at least one question.'); return }

    setSaving(true)
    try {
      const topicId = 'topic_' + Date.now().toString(36)
      const topicResult = await (window as any).electron.db.run(
        `INSERT INTO topics (id, name, subject, description, tags) VALUES (?, ?, ?, ?, ?)`,
        [topicId, title.trim(), subject, description.trim(), JSON.stringify(Array.from(deckTags))]
      )
      if (!topicResult.success) throw new Error(topicResult.error || 'Failed to create topic')

      for (const card of cards) {
        const cardId = 'card_' + Math.random().toString(36).substr(2, 9)
        const type = card.flashcardData ? 'flashcard' : 'mcq'
        const data = card.flashcardData ? {
          front: card.flashcardData.front,
          back: card.flashcardData.back,
        } : {
          question: card.mcqData.question,
          choices: card.mcqData.choices,
          answer: card.mcqData.answer,
          explanation: card.mcqData.explanation,
        }
        
        const cardResult = await (window as any).electron.db.run(
          `INSERT INTO cards (id, topic_id, type, data, is_custom) VALUES (?, ?, ?, ?, ?)`,
          [cardId, topicId, type, JSON.stringify(data), 1]
        )
        if (!cardResult.success) throw new Error(cardResult.error || 'Failed to save card')
      }

      navigate('/flashcards')
    } catch (err: any) {
      console.error('Save failed', err)
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const canSave = title.trim().length > 0 && cards.length > 0
  const selectedSubjectShort = SUBJECTS.find(s => s.value === subject)?.short || ''

  return (
    <div className="h-full bg-[#0D0D0D] overflow-y-auto flex flex-col">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-[#0D0D0D]/90 backdrop-blur-md border-b border-[#1a1a1a] shrink-0">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="font-['Orbitron'] text-2xl font-bold text-[#E8E8E8] tracking-wider mb-1">
              Add Decks
            </h1>
            <div className="text-[#888] font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest flex items-center gap-2">
              <Link to="/flashcards" className="hover:text-[#E8E8E8] transition-colors">Study</Link>
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
                  Add a title and import questions to save
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Two-Column */}
      <div className="max-w-[1200px] mx-auto w-full px-6 lg:px-10 py-8 flex flex-col lg:flex-row gap-[32px] pb-24 flex-1">
        
        {/* Left Column (60%) */}
        <div className="flex-[3] flex flex-col gap-10">
          
          {/* Title Section */}
          <section className="flex flex-col gap-4">
            <div className="relative">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={80}
                placeholder='Enter deck title, e.g. "Magnetism & Electromagnetism"'
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
          </section>

          {/* Subject Selector */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-[#00FF41] font-['Rajdhani'] font-bold uppercase tracking-widest">
                Subject
              </label>
              {suggestedSubject && suggestedSubject !== subject && (
                <div className="flex items-center gap-2 animate-[fade-in_0.3s_ease]">
                  <span className="text-[10px] text-[#888] font-['IBM_Plex_Mono'] uppercase">
                    Suggested: <span className="text-[#00FF41]">{SUBJECTS.find(s => s.value === suggestedSubject)?.short}</span>
                  </span>
                  <button 
                    onClick={() => setSubject(suggestedSubject)}
                    className="text-[10px] px-2 py-0.5 rounded border border-[#00FF41]/30 text-[#00FF41] hover:bg-[#00FF41]/10 transition-colors font-['Rajdhani'] uppercase font-bold"
                  >
                    Use this
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {SUBJECTS.map(s => {
                const Icon = s.icon
                const isSelected = subject === s.value
                return (
                  <button 
                    key={s.value} 
                    onClick={() => setSubject(s.value)}
                    className={`px-4 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest font-bold text-sm flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'bg-[#00FF41] text-black shadow-[0_0_15px_rgba(0,255,65,0.2)]'
                        : 'bg-[#111] border border-[#00FF41] text-[#888] hover:bg-[#161616]'
                    }`}
                  >
                    <Icon size={16} className={isSelected ? 'text-black' : 'text-[#00FF41]'} />
                    {s.short}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Tags Selector */}
          <section className="flex flex-col gap-3 mt-4">
            <label className="text-[11px] text-[#00FF41] font-['Rajdhani'] font-bold uppercase tracking-widest">
              SOURCE TAGS
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
            
            <div className="flex items-center gap-2 mt-2 w-full max-w-sm">
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
          </section>

          {/* Import Zone */}
          <section className="flex flex-col gap-3 mt-4">
            {cards.length === 0 ? (
              <>
                <motion.div 
                  whileHover={{ borderColor: 'rgba(0,255,65,0.7)', backgroundColor: 'rgba(0,255,65,0.06)' }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  onClick={() => setImportModalType('mcq')}
                  className="w-full border-2 border-dashed border-[rgba(0,255,65,0.3)] bg-[rgba(0,255,65,0.03)] rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer text-center group mb-4"
                >
                  <div className="w-16 h-16 rounded-full bg-[rgba(0,255,65,0.1)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Upload size={32} className="text-[#00FF41]" />
                  </div>
                  <h3 className="font-['Rajdhani'] text-[#E8E8E8] font-bold uppercase tracking-widest text-xl mb-2">
                    Import MCQ Questions
                  </h3>
                  <p className="text-[#888] font-['IBM_Plex_Mono'] text-sm mb-8">
                    Paste or drag your Q:/ANS: format
                  </p>
                  <button className="px-6 py-2 bg-[#111] border border-[#00FF41] text-[#00FF41] font-['Rajdhani'] uppercase tracking-widest font-bold text-sm rounded pointer-events-none group-hover:bg-[#00FF41] group-hover:text-black transition-colors">
                    [ Open Import ]
                  </button>
                </motion.div>

                <motion.div 
                  whileHover={{ borderColor: 'rgba(0,255,65,0.7)', backgroundColor: 'rgba(0,255,65,0.06)' }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  onClick={() => setImportModalType('flashcard')}
                  className="w-full border border-dashed border-[rgba(0,255,65,0.2)] bg-[rgba(0,255,65,0.015)] rounded-xl p-6 flex items-center justify-center cursor-pointer text-center group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[rgba(0,255,65,0.1)] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Layers size={20} className="text-[#00FF41]" />
                    </div>
                    <h3 className="font-['Rajdhani'] text-[#E8E8E8] font-bold uppercase tracking-widest text-md group-hover:text-[#00FF41] transition-colors">
                      IMPORT FLASHCARDS
                    </h3>
                  </div>
                </motion.div>
              </>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-[#222] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[rgba(0,255,65,0.1)] flex items-center justify-center">
                      <Check size={20} className="text-[#00FF41]" />
                    </div>
                    <h2 className="font-['Rajdhani'] text-lg uppercase tracking-widest text-[#00FF41] font-bold">
                      {cards.length} questions imported
                    </h2>
                  </div>
                  <button 
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear and re-import?')) {
                        setCards([])
                        // Since we don't know which type they want to re-import, we just clear it.
                      }
                    }}
                    className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888] hover:text-[#E8E8E8] underline underline-offset-4 transition-colors"
                  >
                    Re-import
                  </button>
                </div>
                
                <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {cards.map((card, idx) => {
                    const isFC = !!card.flashcardData
                    const qText = isFC ? card.flashcardData.front : card.mcqData.question
                    const displayQ = qText.length > 60 ? qText.substring(0, 60) + '...' : qText
                    const isSelected = idx === selectedQuestionIndex
                    return (
                      <div 
                        key={card.id} 
                        onClick={() => setSelectedQuestionIndex(idx)}
                        className={`bg-[#161616] border rounded flex gap-4 items-center p-[10px_16px] cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-[#00FF41] shadow-[0_0_15px_rgba(0,255,65,0.2)]' 
                            : 'border-[#222] hover:border-[#444]'
                        }`}
                      >
                        <span className={`font-['Rajdhani'] text-xs uppercase tracking-widest font-bold w-6 shrink-0 ${isSelected ? 'text-[#00FF41]' : 'text-[#555]'}`}>Q{idx + 1}</span>
                        <p className={`font-['IBM_Plex_Mono'] text-[13px] truncate flex-1 ${isSelected ? 'text-[#E8E8E8]' : 'text-[#aaa]'}`}>
                          {displayQ}
                        </p>
                        {isSelected && <Check size={16} className="text-[#00FF41] shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

        </div>

        {/* Right Column (40%) */}
        <div className="flex-[2] flex flex-col gap-4 sticky top-[100px] self-start">
          <label className="text-[11px] text-[#00FF41] font-['Rajdhani'] font-bold uppercase tracking-widest flex justify-between">
            <span>Question Inspector</span>
            {cards.length > 0 && <span>ITEM {(selectedQuestionIndex + 1).toString().padStart(2, '0')} / {cards.length.toString().padStart(2, '0')}</span>}
          </label>
          
          <AnimatePresence mode="wait">
            {cards.length > 0 ? (
              <motion.div
                key={selectedQuestionIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="bg-[#161616] border border-[#222] rounded-xl p-6 shadow-xl relative flex flex-col min-h-[300px]"
              >
                {/* Card Content */}
                {cards[selectedQuestionIndex].flashcardData ? (
                  <div className="flex flex-col gap-6 flex-1">
                    <div className="flex-1">
                      <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888] block mb-2">Term</span>
                      <div 
                        className="text-white font-['IBM_Plex_Mono'] text-[15px] leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMath(cards[selectedQuestionIndex].flashcardData.front) }}
                      />
                    </div>
                    <div className="flex-1 border-t border-[#222] pt-6">
                      <span className="text-xs font-['Rajdhani'] uppercase tracking-widest text-[#888] block mb-2">Definition</span>
                      <div 
                        className="text-[#00FF41] font-['IBM_Plex_Mono'] text-[15px] leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMath(cards[selectedQuestionIndex].flashcardData.back) }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Question Text */}
                    <div 
                      className="text-white font-['IBM_Plex_Mono'] text-[15px] leading-relaxed mb-6"
                      dangerouslySetInnerHTML={{ __html: renderMath(cards[selectedQuestionIndex].mcqData.question) }}
                    />

                    {/* Choices */}
                    <div className="flex flex-col gap-3 mt-auto">
                      {cards[selectedQuestionIndex].mcqData.choices.map((choice: string, cIdx: number) => {
                        const isCorrect = cards[selectedQuestionIndex].mcqData.answer === cIdx
                        return (
                          <div 
                            key={cIdx} 
                            className={`p-3 rounded border flex items-start gap-3 font-['IBM_Plex_Mono'] text-[13px] ${
                              isCorrect 
                                ? 'bg-[var(--accent-primary)]/10 border-l-2 border-l-[#00FF41] border-t-transparent border-r-transparent border-b-transparent text-[#00FF41]' 
                                : 'bg-[#111] border-[#222] text-[#888]'
                            }`}
                          >
                            <span className="font-bold shrink-0 text-current">{String.fromCharCode(65 + cIdx)}.</span>
                            <div className="text-current" dangerouslySetInnerHTML={{ __html: renderMath(choice) }} />
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* Metadata */}
                <div className="mt-6 pt-4 border-t border-[#222] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-[var(--accent-primary)] font-['Rajdhani'] uppercase tracking-widest font-bold text-[10px] bg-[var(--accent-primary)]/10 px-2 py-1 rounded">
                      {SUBJECTS.find(s => s.value === subject)?.icon && React.createElement(SUBJECTS.find(s => s.value === subject)!.icon, { size: 12 })}
                      {selectedSubjectShort}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-[#161616] border border-[#222] rounded-xl p-6 shadow-xl flex flex-col items-center justify-center min-h-[300px] text-center">
                <FileText size={48} className="text-[#333] mb-4" />
                <p className="text-[#666] font-['IBM_Plex_Mono'] text-sm">Import questions to inspect them here.</p>
              </div>
            )}
          </AnimatePresence>

          {cards.length > 0 && (
            <div className="bg-[#111] border border-[#222] rounded p-4 text-[#888] font-['IBM_Plex_Mono'] text-xs leading-relaxed text-center mt-2">
              After saving, this deck will appear in your Study page under <span className="text-[#E8E8E8] font-bold">{subject}</span>
            </div>
          )}
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
    </div>
  )
}
