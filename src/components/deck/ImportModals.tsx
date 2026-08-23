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
  const highlightLayerRef = React.useRef<HTMLDivElement>(null)
  const autoFixTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const errorLines = React.useMemo(() => {
    const linesSet = new Set<number>()
    previewWarnings.forEach(w => {
      const match = w.match(/Line\s*(\d+)/i)
      if (match) {
        linesSet.add(parseInt(match[1], 10))
      }
    })
    return linesSet
  }, [previewWarnings])

  useEffect(() => {
    return () => {
      if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current)
    }
  }, [])

  const handleScroll = () => {
    if (textareaRef.current) {
      if (gutterRef.current) gutterRef.current.scrollTop = textareaRef.current.scrollTop
      if (highlightLayerRef.current) highlightLayerRef.current.scrollTop = textareaRef.current.scrollTop
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
        const ansMatch = trimmed.match(/^ANS:\s*\(?([A-Ea-e])\)?(?:\s*[\.\:\,\-\[\]\?\s].*)?$/i)
        if (ansMatch) {
          trimmed = `ANS: ${ansMatch[1].toUpperCase()}`
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
    const warning = previewWarnings[warningIndex]
    if (!warning) return

    let targetLine: number | null = null

    // 1. Try to extract exact line number: "(Line 345)" or "Line 345"
    const lineMatch = warning.match(/Line\s*(\d+)/i)
    if (lineMatch) {
      targetLine = parseInt(lineMatch[1], 10)
    } else {
      // 2. Fallback: if only Block N exists, scan inputText to find start line of Block N
      const blockMatch = warning.match(/Block\s*(\d+)/i)
      if (blockMatch) {
        const blockNum = parseInt(blockMatch[1], 10)
        const lines = inputText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
        let currentBlock = 0
        let inBlock = false
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().length > 0) {
            if (!inBlock) {
              currentBlock++
              inBlock = true
              if (currentBlock === blockNum) {
                targetLine = i + 1
                break
              }
            }
          } else {
            inBlock = false
          }
        }
      }
    }

    if (targetLine !== null && targetLine > 0) {
      const textarea = textareaRef.current
      const lines = textarea.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

      let charStart = 0
      for (let i = 0; i < targetLine - 1 && i < lines.length; i++) {
        charStart += lines[i].length + 1
      }
      const charEnd = charStart + (lines[targetLine - 1]?.length || 0)

      const style = window.getComputedStyle(textarea)
      let lineHeight = parseFloat(style.lineHeight)
      if (isNaN(lineHeight) || lineHeight <= 0) {
        lineHeight = 24
      }

      const clientHeight = textarea.clientHeight || 300
      const targetScrollTop = Math.max(0, (targetLine - 1) * lineHeight - (clientHeight / 3))
      textarea.scrollTop = targetScrollTop

      textarea.focus()
      textarea.setSelectionRange(charStart, charEnd)

      if (gutterRef.current) {
        gutterRef.current.scrollTop = textarea.scrollTop
      }
      if (highlightLayerRef.current) {
        highlightLayerRef.current.scrollTop = textarea.scrollTop
      }
    }
  }

  let feedbackText = "No questions detected"
  let feedbackColor = "text-[#666]"

  if (inputText.trim()) {
    if (previewData.length > 0 && previewWarnings.length === 0) {
      feedbackText = `✓ ${previewData.length} questions detected`
      feedbackColor = "text-accent"
    } else if (previewData.length > 0 && previewWarnings.length > 0) {
      feedbackText = `${previewData.length} questions parsed, ${previewWarnings.length} blocks had errors`
      feedbackColor = "text-warn"
    } else if (previewData.length === 0 && previewWarnings.length > 0) {
      feedbackText = `0 questions parsed, ${previewWarnings.length} blocks had errors`
      feedbackColor = "text-danger"
    }
  }

  const lineCount = inputText.split('\n').length
  const linesArray = Array.from({ length: lineCount }, (_, i) => i + 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="bg-surface-2 border border-[#333] rounded-xl w-full max-w-4xl max-h-[95vh] shadow-2xl flex flex-col animate-[slide-up_0.2s_ease]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-base">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.15)] flex items-center justify-center">
              <FileText size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="font-['Rajdhani'] text-text-primary font-bold uppercase tracking-wider text-lg">Import MCQ Questions</h3>
              <p className="text-[11px] text-text-muted font-['IBM_Plex_Mono']">Paste your questions using the format below</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-2"><X size={20} /></button>
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
                className="bg-[#0D1A0D] border border-accent/30 rounded-lg p-4 flex items-center justify-between gap-4 shrink-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <Wand2 size={14} className="text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-accent text-xs font-['Rajdhani'] font-bold uppercase tracking-widest">Quizlet Format Detected</p>
                    <p className="text-text-muted text-[11px] font-['IBM_Plex_Mono'] truncate">
                      This looks like Quizlet MCQ export — convert it to ECEngine format?
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleQuizletConvert}
                  disabled={quizletConverting}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded bg-accent text-black font-['Rajdhani'] font-bold uppercase tracking-widest text-xs hover:bg-[#00CC33] transition-colors shadow-[0_0_12px_rgba(0,255,65,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 size={12} />
                  {quizletConverting ? 'Converting...' : 'Convert'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Format Guide */}
          <div className="bg-engine-black border-l-4 border-l-[#00FF41] shrink-0 relative overflow-hidden transition-all duration-300">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="w-full text-left p-[12px_16px] text-[11px] text-accent font-['Rajdhani'] font-bold uppercase tracking-widest flex items-center justify-between hover:bg-accent/5 transition-colors"
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
                  <pre className="p-[0_16px_16px_16px] text-text-primary text-[13px] font-['IBM_Plex_Mono'] leading-relaxed whitespace-pre">
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
            <div className="flex flex-1 flex-row border border-[#333] rounded-t-lg bg-engine-black overflow-hidden focus-within:border-accent transition-colors relative">
              {/* Line Numbers Gutter */}
              <div
                ref={gutterRef}
                className="w-12 shrink-0 bg-engine-black text-[#444] font-['IBM_Plex_Mono'] text-sm text-right pr-3 pl-2 select-none overflow-hidden pt-5"
                style={{ lineHeight: '1.5rem' }}
              >
                {linesArray.map(line => {
                  const isErr = errorLines.has(line)
                  return (
                    <div
                      key={line}
                      style={{ height: '1.5rem', lineHeight: '1.5rem' }}
                      className={isErr ? 'text-[#FF003C] font-bold bg-[#FF003C]/20 border-r-2 border-[#FF003C] transition-colors' : ''}
                    >
                      {line}
                    </div>
                  )
                })}
              </div>

              {/* Text Area with Error Highlight Overlay */}
              <div className="relative flex-1 flex overflow-hidden">
                {/* Background Error Highlight Band */}
                <div
                  ref={highlightLayerRef}
                  className="absolute inset-0 pointer-events-none select-none overflow-hidden pt-5 px-5"
                  style={{ lineHeight: '1.5rem' }}
                >
                  {linesArray.map(line => {
                    const isErr = errorLines.has(line)
                    if (!isErr) {
                      return <div key={line} style={{ height: '1.5rem' }} />
                    }
                    return (
                      <div
                        key={line}
                        style={{ height: '1.5rem' }}
                        className="w-full bg-[#FF003C]/20 border-l-2 border-[#FF003C] rounded-r -mx-1 px-1 flex items-center justify-end"
                      >
                        <span className="text-[9px] font-['Rajdhani'] font-bold text-[#FF003C] uppercase tracking-wider pr-2 opacity-80">
                          ERROR
                        </span>
                      </div>
                    )
                  })}
                </div>

                <textarea
                  ref={textareaRef}
                  onScroll={handleScroll}
                  autoFocus
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Paste your MCQ questions here..."
                  className="w-full flex-1 bg-transparent relative z-10 text-text-primary p-5 focus:outline-none font-['IBM_Plex_Mono'] text-sm resize-none leading-normal"
                  style={{ lineHeight: '1.5rem' }}
                />
              </div>
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
        <div className="p-6 border-t border-border-base bg-[#111] flex flex-col rounded-b-xl shrink-0 gap-4">

          <div className="flex items-center gap-3 self-end mb-1">
            {autoFixMessage ? (
              <span className="text-accent text-xs font-['Rajdhani'] uppercase tracking-widest font-bold animate-[fade-in_0.2s]">
                {autoFixMessage}
              </span>
            ) : (
              <button
                disabled={previewWarnings.length === 0}
                onClick={(e) => { e.stopPropagation(); handleAutoFix(); }}
                className={`flex items-center gap-1.5 px-3 py-1 border rounded text-[10px] font-['Rajdhani'] uppercase font-bold tracking-widest transition-colors ${previewWarnings.length > 0
                  ? 'bg-[#111] border-[#333] hover:border-accent hover:text-accent text-text-muted'
                  : 'bg-[#0a0a0a] border-border-base text-[#444] cursor-not-allowed opacity-50'
                  }`}
              >
                <Wand2 size={12} /> Auto-Fix
              </button>
            )}
          </div>

          {previewWarnings.length > 0 && (
            <div className="bg-[#1a1a00] border border-warn/30 rounded-lg overflow-hidden">
              <div className="p-3 flex items-center justify-between cursor-pointer" onClick={() => setShowErrors(!showErrors)}>
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-warn" />
                  <span className="text-warn text-xs font-['Rajdhani'] uppercase tracking-widest font-bold">
                    {previewWarnings.length} Issues Detected
                  </span>
                </div>
              </div>

              {showErrors && (
                <div className="p-3 pt-0 border-t border-warn/10 flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar bg-[#111]/50">
                  {previewWarnings.map((warning, idx) => (
                    <div key={idx} className="text-text-primary text-[11px] font-['IBM_Plex_Mono'] flex items-start gap-2 py-1">
                      <span className="text-warn shrink-0 mt-0.5">•</span>
                      <span className="flex-1">{warning}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); scrollToBlock(idx); }}
                        className="text-[#444] hover:text-accent underline underline-offset-2 transition-colors text-[10px]"
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
            <button onClick={onClose} className="px-6 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold text-text-muted hover:text-text-primary hover:bg-border-base transition-colors">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={previewData.length === 0}
              className={`px-6 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all flex items-center gap-2 ${previewData.length > 0
                ? 'bg-[var(--accent-primary)] text-black hover:bg-[var(--accent-dim)] shadow-[0_0_15px_rgba(0,255,65,0.2)]'
                : 'bg-border-base text-[#555] cursor-not-allowed'
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
  const highlightLayerRef = React.useRef<HTMLDivElement>(null)
  const autoFixTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const errorLines = React.useMemo(() => {
    const linesSet = new Set<number>()
    previewWarnings.forEach(w => {
      const match = w.match(/Line\s*(\d+)/i)
      if (match) {
        linesSet.add(parseInt(match[1], 10))
      }
    })
    return linesSet
  }, [previewWarnings])

  useEffect(() => {
    return () => {
      if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current)
    }
  }, [])

  const handleScroll = () => {
    if (textareaRef.current) {
      if (gutterRef.current) gutterRef.current.scrollTop = textareaRef.current.scrollTop
      if (highlightLayerRef.current) highlightLayerRef.current.scrollTop = textareaRef.current.scrollTop
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
    const warning = previewWarnings[warningIndex]
    if (!warning) return

    let targetLine: number | null = null

    // 1. Try to extract exact line number: "(Line 345)" or "Line 345"
    const lineMatch = warning.match(/Line\s*(\d+)/i)
    if (lineMatch) {
      targetLine = parseInt(lineMatch[1], 10)
    } else {
      // 2. Fallback: if only Block N exists, scan inputText to find start line of Block N
      const blockMatch = warning.match(/Block\s*(\d+)/i)
      if (blockMatch) {
        const blockNum = parseInt(blockMatch[1], 10)
        const lines = inputText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
        let currentBlock = 0
        let inBlock = false
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().length > 0) {
            if (!inBlock) {
              currentBlock++
              inBlock = true
              if (currentBlock === blockNum) {
                targetLine = i + 1
                break
              }
            }
          } else {
            inBlock = false
          }
        }
      }
    }

    if (targetLine !== null && targetLine > 0) {
      const textarea = textareaRef.current
      const lines = textarea.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

      let charStart = 0
      for (let i = 0; i < targetLine - 1 && i < lines.length; i++) {
        charStart += lines[i].length + 1
      }
      const charEnd = charStart + (lines[targetLine - 1]?.length || 0)

      const style = window.getComputedStyle(textarea)
      let lineHeight = parseFloat(style.lineHeight)
      if (isNaN(lineHeight) || lineHeight <= 0) {
        lineHeight = 24
      }

      const clientHeight = textarea.clientHeight || 300
      const targetScrollTop = Math.max(0, (targetLine - 1) * lineHeight - (clientHeight / 3))
      textarea.scrollTop = targetScrollTop

      textarea.focus()
      textarea.setSelectionRange(charStart, charEnd)

      if (gutterRef.current) {
        gutterRef.current.scrollTop = textarea.scrollTop
      }
      if (highlightLayerRef.current) {
        highlightLayerRef.current.scrollTop = textarea.scrollTop
      }
    }
  }

  let feedbackText = "No flashcards detected"
  let feedbackColor = "text-[#666]"

  if (inputText.trim()) {
    if (previewData.length > 0 && previewWarnings.length === 0) {
      feedbackText = `✓ ${previewData.length} flashcard pairs detected`
      feedbackColor = "text-accent"
    } else if (previewData.length > 0 && previewWarnings.length > 0) {
      feedbackText = `${previewData.length} pairs parsed, ${previewWarnings.length} blocks had errors`
      feedbackColor = "text-warn"
    } else if (previewData.length === 0 && previewWarnings.length > 0) {
      feedbackText = `0 pairs parsed, ${previewWarnings.length} blocks had errors`
      feedbackColor = "text-danger"
    }
  }

  const lineCount = inputText.split('\n').length
  const linesArray = Array.from({ length: lineCount }, (_, i) => i + 1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="bg-surface-2 border border-[#333] rounded-xl w-full max-w-4xl max-h-[95vh] shadow-2xl flex flex-col animate-[slide-up_0.2s_ease]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-base">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.15)] flex items-center justify-center">
              <Layers size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="font-['Rajdhani'] text-text-primary font-bold uppercase tracking-wider text-lg">Import Flashcards</h3>
              <p className="text-[11px] text-text-muted font-['IBM_Plex_Mono']">Paste your terms and definitions using the format below</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-2"><X size={20} /></button>
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
                className="bg-[#0D1A0D] border border-accent/30 rounded-lg p-4 flex items-center justify-between gap-4 shrink-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <Wand2 size={14} className="text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-accent text-xs font-['Rajdhani'] font-bold uppercase tracking-widest">Quizlet Format Detected</p>
                    <p className="text-text-muted text-[11px] font-['IBM_Plex_Mono'] truncate">
                      This looks like Quizlet flashcard export — convert it to ECEngine format?
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleQuizletConvert}
                  disabled={quizletConverting}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded bg-accent text-black font-['Rajdhani'] font-bold uppercase tracking-widest text-xs hover:bg-[#00CC33] transition-colors shadow-[0_0_12px_rgba(0,255,65,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 size={12} />
                  {quizletConverting ? 'Converting...' : 'Convert'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Format Guide */}
          <div className="bg-engine-black border-l-4 border-l-[#00FF41] shrink-0 relative overflow-hidden transition-all duration-300">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="w-full text-left p-[12px_16px] text-[11px] text-accent font-['Rajdhani'] font-bold uppercase tracking-widest flex items-center justify-between hover:bg-accent/5 transition-colors"
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
                  <pre className="p-[0_16px_16px_16px] text-text-primary text-[13px] font-['IBM_Plex_Mono'] leading-relaxed whitespace-pre">
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
            <div className="flex flex-1 flex-row border border-[#333] rounded-t-lg bg-engine-black overflow-hidden focus-within:border-accent transition-colors relative">
              {/* Line Numbers Gutter */}
              <div
                ref={gutterRef}
                className="w-12 shrink-0 bg-engine-black text-[#444] font-['IBM_Plex_Mono'] text-sm text-right pr-3 pl-2 select-none overflow-hidden pt-5"
                style={{ lineHeight: '1.5rem' }}
              >
                {linesArray.map(line => {
                  const isErr = errorLines.has(line)
                  return (
                    <div
                      key={line}
                      style={{ height: '1.5rem', lineHeight: '1.5rem' }}
                      className={isErr ? 'text-[#FF003C] font-bold bg-[#FF003C]/20 border-r-2 border-[#FF003C] transition-colors' : ''}
                    >
                      {line}
                    </div>
                  )
                })}
              </div>

              {/* Text Area with Error Highlight Overlay */}
              <div className="relative flex-1 flex overflow-hidden">
                {/* Background Error Highlight Band */}
                <div
                  ref={highlightLayerRef}
                  className="absolute inset-0 pointer-events-none select-none overflow-hidden pt-5 px-5"
                  style={{ lineHeight: '1.5rem' }}
                >
                  {linesArray.map(line => {
                    const isErr = errorLines.has(line)
                    if (!isErr) {
                      return <div key={line} style={{ height: '1.5rem' }} />
                    }
                    return (
                      <div
                        key={line}
                        style={{ height: '1.5rem' }}
                        className="w-full bg-[#FF003C]/20 border-l-2 border-[#FF003C] rounded-r -mx-1 px-1 flex items-center justify-end"
                      >
                        <span className="text-[9px] font-['Rajdhani'] font-bold text-[#FF003C] uppercase tracking-wider pr-2 opacity-80">
                          ERROR
                        </span>
                      </div>
                    )
                  })}
                </div>

                <textarea
                  ref={textareaRef}
                  onScroll={handleScroll}
                  autoFocus
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Paste your flashcards here..."
                  className="w-full flex-1 bg-transparent relative z-10 text-text-primary p-5 focus:outline-none font-['IBM_Plex_Mono'] text-sm resize-none leading-normal"
                  style={{ lineHeight: '1.5rem' }}
                />
              </div>
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
        <div className="p-6 border-t border-border-base bg-[#111] flex flex-col rounded-b-xl shrink-0 gap-4">

          <div className="flex items-center gap-3 self-end mb-1">
            {autoFixMessage ? (
              <span className="text-accent text-xs font-['Rajdhani'] uppercase tracking-widest font-bold animate-[fade-in_0.2s]">
                {autoFixMessage}
              </span>
            ) : (
              <button
                disabled={previewWarnings.length === 0}
                onClick={(e) => { e.stopPropagation(); handleAutoFix(); }}
                className={`flex items-center gap-1.5 px-3 py-1 border rounded text-[10px] font-['Rajdhani'] uppercase font-bold tracking-widest transition-colors ${previewWarnings.length > 0
                  ? 'bg-[#111] border-[#333] hover:border-accent hover:text-accent text-text-muted'
                  : 'bg-[#0a0a0a] border-border-base text-[#444] cursor-not-allowed opacity-50'
                  }`}
              >
                <Wand2 size={12} /> Auto-Fix
              </button>
            )}
          </div>

          {previewWarnings.length > 0 && (
            <div className="bg-[#1a1a00] border border-warn/30 rounded-lg overflow-hidden">
              <div className="p-3 flex items-center justify-between cursor-pointer" onClick={() => setShowErrors(!showErrors)}>
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-warn" />
                  <span className="text-warn text-xs font-['Rajdhani'] uppercase tracking-widest font-bold">
                    {previewWarnings.length} Issues Detected
                  </span>
                </div>
              </div>

              {showErrors && (
                <div className="p-3 pt-0 border-t border-warn/10 flex flex-col gap-2 max-h-32 overflow-y-auto custom-scrollbar bg-[#111]/50">
                  {previewWarnings.map((warning, idx) => (
                    <div key={idx} className="text-text-primary text-[11px] font-['IBM_Plex_Mono'] flex items-start gap-2 py-1">
                      <span className="text-warn shrink-0 mt-0.5">•</span>
                      <span className="flex-1">{warning}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); scrollToBlock(idx); }}
                        className="text-[#444] hover:text-accent underline underline-offset-2 transition-colors text-[10px]"
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
            <button onClick={onClose} className="px-6 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold text-text-muted hover:text-text-primary hover:bg-border-base transition-colors">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={previewData.length === 0}
              className={`px-6 py-2.5 rounded font-['Rajdhani'] uppercase tracking-widest text-sm font-bold transition-all flex items-center gap-2 ${previewData.length > 0
                ? 'bg-[var(--accent-primary)] text-black hover:bg-[var(--accent-dim)] shadow-[0_0_15px_rgba(0,255,65,0.2)]'
                : 'bg-border-base text-[#555] cursor-not-allowed'
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

