import React, { useState, useEffect } from 'react'
import { X, Upload, AlertCircle, Check, AlertTriangle, RotateCcw, Plus, FileText, Layers, Wand2 } from 'lucide-react'
import { parseImportedMCQs, parseImportedFlashcards } from '../../lib/parser'
import { detectQuizletFormat, tryConvertQuizlet } from '../../lib/quizletParser'
import { motion, AnimatePresence } from 'framer-motion'

export function ImportModal({ onImportCards, onClose }: { onImportCards: (cards: { term: string; definition: string; mcqData?: any }[]) => void; onClose: () => void }) {
  const [inputText, setInputText] = useState('')
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [autoFixMessage, setAutoFixMessage] = useState('')
  const [quizletDetected, setQuizletDetected] = useState(false)
  const [quizletConverting, setQuizletConverting] = useState(false)

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const gutterRef = React.useRef<HTMLDivElement>(null)
  const autoFixTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current)
    }
  }, [])

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
      if (!inputText.trim()) {
        setPreviewData([])
        setPreviewWarnings([])
        setQuizletDetected(false)
        return
      }
      const fmt = detectQuizletFormat(inputText)
      setQuizletDetected(fmt === 'mcq')
      const { cards, warnings } = parseImportedMCQs(inputText)
      setPreviewData(cards)
      setPreviewWarnings(warnings)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputText])

  const handleQuizletConvert = () => {
    setQuizletConverting(true)
    const result = tryConvertQuizlet(inputText)
    if (result && result.format === 'mcq') {
      setInputText(result.ecEngineText)
      setQuizletDetected(false)
      const fixCount = result.symbolFixes + result.spellingFixes
      const fixMsg = fixCount > 0
        ? `Converted ${result.converted} questions · ${fixCount} fixes applied`
        : `Converted ${result.converted} questions`
      setAutoFixMessage(fixMsg)
      if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current)
      autoFixTimerRef.current = setTimeout(() => setAutoFixMessage(''), 3000)
    }
    setQuizletConverting(false)
  }

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
    if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current)
    autoFixTimerRef.current = setTimeout(() => setAutoFixMessage(''), 2000)
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

          {/* Quizlet Detection Banner */}
          <AnimatePresence>
            {quizletDetected && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="bg-[#0D1A0D] border border-[#00FF41]/30 rounded-lg p-4 flex items-center justify-between gap-4 shrink-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-[#00FF41]/10 border border-[#00FF41]/20 flex items-center justify-center shrink-0">
                    <Wand2 size={14} className="text-[#00FF41]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#00FF41] text-xs font-['Rajdhani'] font-bold uppercase tracking-widest">Quizlet Format Detected</p>
                    <p className="text-[#888] text-[11px] font-['IBM_Plex_Mono'] truncate">
                      This looks like Quizlet MCQ export — convert it to ECEngine format?
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleQuizletConvert}
                  disabled={quizletConverting}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded bg-[#00FF41] text-black font-['Rajdhani'] font-bold uppercase tracking-widest text-xs hover:bg-[#00CC33] transition-colors shadow-[0_0_12px_rgba(0,255,65,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 size={12} />
                  {quizletConverting ? 'Converting...' : 'Convert'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

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
                className={`flex items-center gap-1.5 px-3 py-1 border rounded text-[10px] font-['Rajdhani'] uppercase font-bold tracking-widest transition-colors ${previewWarnings.length > 0
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
              className={`px-6 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all flex items-center gap-2 ${previewData.length > 0
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

export function ImportFlashcardsModal({ onImportCards, onClose }: { onImportCards: (cards: { term: string; definition: string; flashcardData?: any }[]) => void; onClose: () => void }) {
  const [inputText, setInputText] = useState('')
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [autoFixMessage, setAutoFixMessage] = useState('')
  const [quizletDetected, setQuizletDetected] = useState(false)
  const [quizletConverting, setQuizletConverting] = useState(false)

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const gutterRef = React.useRef<HTMLDivElement>(null)
  const autoFixTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current)
    }
  }, [])

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
      if (!inputText.trim()) {
        setPreviewData([])
        setPreviewWarnings([])
        setQuizletDetected(false)
        return
      }
      const fmt = detectQuizletFormat(inputText)
      setQuizletDetected(fmt === 'flashcard')
      const { cards, warnings } = parseImportedFlashcards(inputText)
      setPreviewData(cards)
      setPreviewWarnings(warnings)
    }, 300)
    return () => clearTimeout(timer)
  }, [inputText])

  const handleQuizletConvert = () => {
    setQuizletConverting(true)
    const result = tryConvertQuizlet(inputText)
    if (result && result.format === 'flashcard') {
      setInputText(result.ecEngineText)
      setQuizletDetected(false)
      const fixCount = result.symbolFixes + result.spellingFixes
      const fixMsg = fixCount > 0
        ? `Converted ${result.converted} flashcards · ${fixCount} fixes applied`
        : `Converted ${result.converted} flashcards`
      setAutoFixMessage(fixMsg)
      if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current)
      autoFixTimerRef.current = setTimeout(() => setAutoFixMessage(''), 3000)
    }
    setQuizletConverting(false)
  }

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
    if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current)
    autoFixTimerRef.current = setTimeout(() => setAutoFixMessage(''), 2000)
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

          {/* Quizlet Detection Banner */}
          <AnimatePresence>
            {quizletDetected && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="bg-[#0D1A0D] border border-[#00FF41]/30 rounded-lg p-4 flex items-center justify-between gap-4 shrink-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-[#00FF41]/10 border border-[#00FF41]/20 flex items-center justify-center shrink-0">
                    <Wand2 size={14} className="text-[#00FF41]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#00FF41] text-xs font-['Rajdhani'] font-bold uppercase tracking-widest">Quizlet Format Detected</p>
                    <p className="text-[#888] text-[11px] font-['IBM_Plex_Mono'] truncate">
                      This looks like Quizlet flashcard export — convert it to ECEngine format?
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleQuizletConvert}
                  disabled={quizletConverting}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded bg-[#00FF41] text-black font-['Rajdhani'] font-bold uppercase tracking-widest text-xs hover:bg-[#00CC33] transition-colors shadow-[0_0_12px_rgba(0,255,65,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 size={12} />
                  {quizletConverting ? 'Converting...' : 'Convert'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

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
                className={`flex items-center gap-1.5 px-3 py-1 border rounded text-[10px] font-['Rajdhani'] uppercase font-bold tracking-widest transition-colors ${previewWarnings.length > 0
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
              className={`px-6 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all flex items-center gap-2 ${previewData.length > 0
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

