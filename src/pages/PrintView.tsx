import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, Table2, List, BookOpen, Bold, Loader2, CheckCircle2, AlertCircle, Minus, Square, X } from 'lucide-react'
import { activeDBService } from '../services/db.service'
import { Card, MCQData, FlashcardData, FormulaData } from '../types'
import { renderMath } from '../lib/latex'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LayoutMode = 'table' | 'glossary' | 'qa'
type BoldSide = 'term' | 'definition' | 'none'
type ExportState = 'idle' | 'loading' | 'success' | 'error'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

function isMCQ(card: Card): card is Card & { data: MCQData } {
  return card.type === 'mcq'
}
function isFlashcard(card: Card): card is Card & { data: FlashcardData } {
  return card.type === 'flashcard'
}
function isFormula(card: Card): card is Card & { data: FormulaData } {
  return card.type === 'formula'
}

/** Renders text that may contain LaTeX via dangerouslySetInnerHTML. */
function MathText({ text, style }: { text: string; style?: React.CSSProperties }) {
  return (
    <span
      style={style}
      dangerouslySetInnerHTML={{ __html: renderMath(text) }}
    />
  )
}

// ---------------------------------------------------------------------------
// Sub-renderers — Paper content (print-safe black/white)
// ---------------------------------------------------------------------------

interface MCQTableRowProps {
  index: number
  card: Card & { data: MCQData }
}
function MCQTableRow({ index, card }: MCQTableRowProps) {
  const { question, choices, answer } = card.data
  return (
    <tr style={{ borderBottom: '1px solid #d1d5db', pageBreakInside: 'avoid' }}>
      <td style={{ padding: '10px 12px', verticalAlign: 'top', width: '65%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontWeight: 700, minWidth: '24px', color: '#111827' }}>{index}.</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, color: '#111827', marginBottom: '6px', lineHeight: 1.5 }}>
              <MathText text={question} />
            </p>
            {/* question imagePath */}
            {(card.data as MCQData & { imagePath?: string }).imagePath && (
              <img
                src={
                  (window as any).electron
                    ? `ece-app://${(card.data as MCQData & { imagePath?: string }).imagePath}`
                    : `/ece-images/${(card.data as MCQData & { imagePath?: string }).imagePath}`
                }
                alt="Question diagram"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '6px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
              />
            )}
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {choices.map((choice, ci) => (
                <li key={ci} style={{ marginBottom: '4px', listStyle: 'none' }}>
                  <div
                    style={{
                      padding: '4px 8px',
                      backgroundColor: ci === answer ? '#fef3c7' : 'transparent',
                      color: ci === answer ? '#92400e' : '#374151',
                      fontWeight: ci === answer ? 700 : 400,
                      borderRadius: '3px',
                      display: 'flex',
                      gap: '6px',
                    }}
                  >
                    <span style={{ minWidth: '18px', fontWeight: 700 }}>{CHOICE_LABELS[ci]}.</span>
                    <span><MathText text={choice} /></span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </td>
      <td
        style={{
          padding: '10px 12px',
          verticalAlign: 'top',
          width: '35%',
          borderLeft: '1px solid #d1d5db',
          color: '#6b7280',
          fontSize: '13px',
        }}
      >
        <span style={{ fontWeight: 600, color: '#374151' }}>Ans: </span>
        {CHOICE_LABELS[answer]}. <MathText text={choices[answer] ?? '—'} />
      </td>
    </tr>
  )
}

interface MCQGlossaryItemProps {
  index: number
  card: Card & { data: MCQData }
  qaMode?: boolean
}
function MCQGlossaryItem({ index, card, qaMode = false }: MCQGlossaryItemProps) {
  const { question, choices, answer, imagePath } = card.data
  if (qaMode) {
    return (
      <div style={{ marginBottom: '14px', pageBreakInside: 'avoid', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
        <p style={{ fontWeight: 400, color: '#111827', marginBottom: '4px' }}>
          {index}. <MathText text={question} />
        </p>
        {imagePath && (
          <img
            src={
              (window as any).electron
                ? `ece-app://${imagePath}`
                : `/ece-images/${imagePath}`
            }
            alt="Question diagram"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '6px', marginLeft: '16px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
          />
        )}
        <p style={{ fontWeight: 700, color: '#374151', margin: 0, paddingLeft: '16px' }}>
          <MathText text={choices[answer] ?? '—'} />
        </p>
      </div>
    )
  }
  return (
    <div style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
      <p style={{ fontWeight: 600, color: '#111827', marginBottom: '6px' }}>
        {index}. <MathText text={question} />
      </p>
      {imagePath && (
        <img
          src={
            (window as any).electron
              ? `ece-app://${imagePath}`
              : `/ece-images/${imagePath}`
          }
          alt="Question diagram"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '6px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
        />
      )}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {choices.map((choice, ci) => (
          <li key={ci} style={{ marginBottom: '4px', listStyle: 'none' }}>
            <div
              style={{
                padding: '4px 8px',
                backgroundColor: ci === answer ? '#fef3c7' : 'transparent',
                color: ci === answer ? '#92400e' : '#374151',
                fontWeight: ci === answer ? 700 : 400,
                borderRadius: '3px',
                display: 'flex',
                gap: '6px',
              }}
            >
              <span style={{ minWidth: '18px', fontWeight: 700 }}>{CHOICE_LABELS[ci]}.</span>
              <span><MathText text={choice} /></span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

interface FormulaItemProps {
  index: number
  card: Card & { data: FormulaData }
}
function FormulaItem({ index, card }: FormulaItemProps) {
  const { name, latex, variables, imagePath } = card.data
  const vars = variables as unknown
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', pageBreakInside: 'avoid', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
      <div style={{ width: '35%', minWidth: '120px' }}>
        <p style={{ fontWeight: 700, color: '#111827', margin: 0 }}>
          {index}. <MathText text={name} />
        </p>
        {/* variables below name if present */}
        {vars ? (
          <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.8, marginTop: '4px' }}>
            {typeof vars === 'string' ? (
              vars.split('\n').map((line, idx) => (
                <span key={idx} style={{ display: 'block', marginBottom: '2px' }}>
                  <MathText text={line} />
                </span>
              ))
            ) : typeof vars === 'object' && vars !== null && Object.keys(vars as Record<string, string>).length > 0 ? (
              Object.entries(vars as Record<string, string>).map(([k, v]) => (
                <span key={k} style={{ display: 'inline-block', marginRight: '16px' }}>
                  <strong><MathText text={k} /></strong>: <MathText text={String(v)} />
                </span>
              ))
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {latex ? (
          <div
            style={{ fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '6px 8px', borderRadius: '4px', color: '#1e40af', marginBottom: '0px', overflowX: 'auto' }}
            dangerouslySetInnerHTML={{ __html: renderMath(`$$${latex}$$`) }}
          />
        ) : null}
        {imagePath && (
          <img
            src={
              (window as any).electron
                ? `ece-app://${imagePath}`
                : `/ece-images/${imagePath}`
            }
            alt="Formula diagram"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #e5e7eb' }}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PrintView() {
  const isWeb = !(window as any).electron
  const controls = (window as any).electron?.windowControls
  const [searchParams] = useSearchParams()
  const topicId = searchParams.get('id') ?? searchParams.get('topicId') ?? ''
  const title = decodeURIComponent(searchParams.get('title') ?? 'Test Paper')

  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [layout, setLayout] = useState<LayoutMode>('table')
  const [boldSide, setBoldSide] = useState<BoldSide>('term')
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    if (!topicId) { setLoading(false); return }
    activeDBService.getAllCardsByTopic(topicId).then((result) => {
      setCards(result)
      setLoading(false)
    })
  }, [topicId])

  const handleExportPDF = async () => {
    setExportState('loading')
    setExportError('')
    try {
      if (isWeb) {
        // Serialize the paper content to HTML and open in a clean new window
        const paperEl = document.getElementById('print-paper-area')
        if (!paperEl) return

        const printWindow = window.open('', '_blank', 'width=900,height=700')
        if (!printWindow) return

        printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <style>
    @page { margin: 1.5cm; size: A4 portrait; }
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #111827;
      margin: 0;
      padding: 0;
      background: white;
    }
    h1 { font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px 0; }
    p { font-size: 13px; color: #6b7280; margin: 0 0 12px 0; }
    hr { border: none; border-top: 2px solid #111827; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase;
         letter-spacing: 0.08em; color: #374151; padding: 8px 12px;
         border-top: 2px solid #111827; border-bottom: 1px solid #d1d5db; }
    td { padding: 10px 12px; vertical-align: top; border-bottom: 1px solid #d1d5db; font-size: 13px; }
    tr { page-break-inside: avoid; }
    .answer { font-size: 12px; color: #374151; }
    .correct { color: #b45309; font-weight: 700; }
    .choice { margin: 3px 0; font-size: 13px; }
    .question-num { font-weight: 700; }
    .glossary-item { margin-bottom: 14px; page-break-inside: avoid;
                     border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
    .qa-item { margin-bottom: 16px; page-break-inside: avoid; }
    img { max-width: 100%; height: auto; margin: 6px 0; border-radius: 4px; }
  </style>
</head>
<body>
  ${paperEl.innerHTML}
</body>
</html>`)
        printWindow.document.close()
        printWindow.focus()
        // Small delay to ensure content renders before print dialog opens
        setTimeout(() => {
          printWindow.print()
        }, 500)
        setExportState('success')
        setTimeout(() => setExportState('idle'), 2500)
      } else {
        const result = await window.electron.print.toPDF(title)
        if (result.canceled) {
          setExportState('idle')
        } else if (result.success) {
          setExportState('success')
          setTimeout(() => setExportState('idle'), 2500)
        } else {
          setExportError(result.error ?? 'Unknown error')
          setExportState('error')
        }
      }
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Unexpected error')
      setExportState('error')
    }
  }

  const mcqCards = cards.filter(isMCQ)
  const flashcardCards = cards.filter(isFlashcard)
  const formulaCards = cards.filter(isFormula)

  const isFlashcardOnly = flashcardCards.length > 0 && mcqCards.length === 0
  const hasFormulas = formulaCards.length > 0

  useEffect(() => {
    if (isFlashcardOnly && layout === 'qa') {
      setLayout('glossary')
    }
  }, [isFlashcardOnly, layout])

  useEffect(() => {
    if (hasFormulas && (layout === 'glossary' || layout === 'qa')) {
      setLayout('table')
    }
  }, [hasFormulas, layout])

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  // -------------------------------------------------------------------------
  // Titlebar (custom centered, matching main window, not printed)
  // -------------------------------------------------------------------------
  const titleBar = (
    <div className="print:hidden w-full h-8 bg-[#1A1A1A] text-gray-400 flex items-center justify-between select-none [-webkit-app-region:drag] relative shrink-0 px-0">
      {/* Left side spacer to balance the right controls or put logo */}
      <div className="flex items-center [-webkit-app-region:no-drag] pl-3">
        <img src="/ecengine_icon.png" alt="Logo" className="w-4 h-4 object-contain" />
      </div>

      {/* Centered Title */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
        <span className="font-rajdhani font-bold tracking-wider text-white text-xs whitespace-nowrap">
          <span className="text-[#00FF41]">TEST PAPER VIEW</span> — {title}
        </span>
      </div>

      {/* Right Side: Window Controls */}
      {!isWeb && controls && (
        <div className="flex h-full ml-auto [-webkit-app-region:no-drag]">
          <button
            onClick={() => controls?.minimize()}
            className="px-3 h-full hover:bg-[#333] hover:text-white transition-colors flex items-center justify-center"
            title="Minimize"
          >
            <Minus size={12} />
          </button>
          <button
            onClick={() => controls?.maximize()}
            className="px-3 h-full hover:bg-[#333] hover:text-white transition-colors flex items-center justify-center"
            title="Maximize"
          >
            <Square size={10} />
          </button>
          <button
            onClick={() => controls?.close()}
            className="px-3 h-full hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Toolbar (not printed)
  // -------------------------------------------------------------------------
  const toolbar = (
    <div
      className="print:hidden"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--bg-card)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
        <FileText size={18} color="var(--accent-primary)" />
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            fontSize: '14px',
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          — {cards.length} card{cards.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Layout toggle */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--bg-card)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-elevated)',
        }}
      >
        {([['table', Table2, 'Table'], ['glossary', List, 'Glossary'], ['qa', BookOpen, 'Q&A']] as const).map(
          ([mode, Icon, label]) => {
            const isDisabled = (mode === 'qa' && isFlashcardOnly) || (hasFormulas && (mode === 'glossary' || mode === 'qa'))
            return (
              <motion.button
                key={mode}
                id={`print-layout-${mode}`}
                disabled={isDisabled}
                onClick={() => { if (!isDisabled) setLayout(mode) }}
                whileTap={{ scale: isDisabled ? 1 : 0.95 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 700,
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  transition: 'all 0.15s',
                  background: layout === mode ? 'var(--accent-primary)' : 'transparent',
                  color: isDisabled ? 'var(--text-secondary)' : (layout === mode ? '#000' : 'var(--text-secondary)'),
                  opacity: isDisabled ? 0.35 : 1,
                }}
              >
                <Icon size={14} />
                {label}
              </motion.button>
            )
          }
        )}
      </div>

      {/* Bold side toggle — only shown for flashcard/mixed decks in table or glossary layout */}
      {flashcardCards.length > 0 && layout !== 'qa' && (
        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--bg-card)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-elevated)',
          }}
        >
          {([['term', 'Bold Term'], ['definition', 'Bold Def'], ['none', 'No Bold']] as const).map(
            ([side, label]) => (
              <motion.button
                key={side}
                onClick={() => setBoldSide(side)}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 700,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  transition: 'all 0.15s',
                  background: boldSide === side ? 'var(--accent-primary)' : 'transparent',
                  color: boldSide === side ? '#000' : 'var(--text-secondary)',
                }}
              >
                {side !== 'none' && <Bold size={12} />}
                {label}
              </motion.button>
            )
          )}
        </div>
      )}

      {/* Export PDF button */}
      <motion.button
        id="print-export-pdf"
        onClick={handleExportPDF}
        disabled={exportState === 'loading'}
        whileTap={{ scale: 0.96 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 20px',
          background: exportState === 'success' ? 'var(--color-correct)' : 'var(--accent-primary)',
          color: '#000',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          fontSize: '13px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          cursor: exportState === 'loading' ? 'not-allowed' : 'pointer',
          opacity: exportState === 'loading' ? 0.7 : 1,
          transition: 'all 0.15s',
        }}
      >
        {exportState === 'loading' ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Generating…
          </>
        ) : exportState === 'success' ? (
          <>
            <CheckCircle2 size={15} />
            Saved!
          </>
        ) : (
          <>
            <FileText size={15} />
            Export PDF
          </>
        )}
      </motion.button>

      {/* Error message */}
      {exportState === 'error' && exportError && (
        <motion.span
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--color-wrong)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <AlertCircle size={13} />
          {exportError}
        </motion.span>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div style={{ background: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Paper content
  // -------------------------------------------------------------------------
  const paperContent = (
    <div
      style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: '#111827',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px 0' }}>
          {cards.length} item{cards.length !== 1 ? 's' : ''} &nbsp;·&nbsp; Generated {dateStr}
        </p>
        <hr style={{ border: 'none', borderTop: '2px solid #111827', margin: '0' }} />
      </div>

      {/* MCQ Section */}
      {mcqCards.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          {cards.some(c => !isMCQ(c)) && (
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
              Multiple Choice
            </h2>
          )}
          {layout === 'table' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151', width: '65%' }}>Question &amp; Choices</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151', borderLeft: '1px solid #d1d5db', width: '35%' }}>Answer</th>
                </tr>
              </thead>
              <tbody>
                {mcqCards.map((card, i) => (
                  <MCQTableRow key={card.id} index={i + 1} card={card} />
                ))}
              </tbody>
            </table>
          ) : (
            <div>
              {mcqCards.map((card, i) => (
                <MCQGlossaryItem key={card.id} index={i + 1} card={card} qaMode={layout === 'qa'} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Flashcard Section */}
      {flashcardCards.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          {cards.some(c => !isFlashcard(c)) && (
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
              Flashcards
            </h2>
          )}
          {layout === 'table' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #d1d5db' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151', width: '50%' }}>TERM</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#374151', borderLeft: '1px solid #d1d5db', width: '50%' }}>DEFINITION</th>
                </tr>
              </thead>
              <tbody>
                {flashcardCards.map((card) => {
                  const { front, back, imageFront, imageBack, imagePath } = card.data
                  return (
                    <tr key={card.id} style={{ borderBottom: '1px solid #d1d5db', pageBreakInside: 'avoid' }}>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top', width: '50%', overflow: 'hidden' }}>
                        {imageFront && (
                          <img
                            src={
                              (window as any).electron
                                ? `ece-app://${imageFront}`
                                : `/ece-images/${imageFront}`
                            }
                            alt="Front diagram"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                          />
                        )}
                        {imagePath && (
                          <img
                            src={
                              (window as any).electron
                                ? `ece-app://${imagePath}`
                                : `/ece-images/${imagePath}`
                            }
                            alt="Flashcard diagram"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                          />
                        )}
                        <p style={{ color: '#111827', margin: 0, fontWeight: boldSide === 'term' ? 700 : 400 }}><MathText text={front} /></p>
                      </td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top', width: '50%', borderLeft: '1px solid #d1d5db', overflow: 'hidden' }}>
                        {imageBack && (
                          <img
                            src={
                              (window as any).electron
                                ? `ece-app://${imageBack}`
                                : `/ece-images/${imageBack}`
                            }
                            alt="Back diagram"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                          />
                        )}
                        <p style={{ color: '#374151', margin: 0, fontWeight: boldSide === 'definition' ? 700 : 400 }}><MathText text={back} /></p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div>
              {flashcardCards.map((card) => {
                const { front, back, imageFront, imageBack, imagePath } = card.data
                return (
                  <div key={card.id} style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
                    <p style={{ fontWeight: boldSide === 'term' ? 700 : 400, color: '#111827', marginBottom: '4px' }}>
                      <MathText text={front} />
                    </p>
                    {imageFront && (
                      <img
                        src={
                          (window as any).electron
                            ? `ece-app://${imageFront}`
                            : `/ece-images/${imageFront}`
                        }
                        alt="Front diagram"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginLeft: '20px', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                      />
                    )}
                    {imagePath && (
                      <img
                        src={
                          (window as any).electron
                            ? `ece-app://${imagePath}`
                            : `/ece-images/${imagePath}`
                        }
                        alt="Flashcard diagram"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginLeft: '20px', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                      />
                    )}
                    <div style={{ paddingLeft: '20px', color: '#374151' }}>
                      {imageBack && (
                        <img
                          src={
                            (window as any).electron
                              ? `ece-app://${imageBack}`
                              : `/ece-images/${imageBack}`
                          }
                          alt="Back diagram"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                        />
                      )}
                      <p style={{ margin: 0, fontWeight: boldSide === 'definition' ? 700 : 400 }}><MathText text={back} /></p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Formula Section */}
      {formulaCards.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
            Formulas
          </h2>
          {formulaCards.map((card, i) => (
            <FormulaItem key={card.id} index={i + 1} card={card} />
          ))}
        </section>
      )}

      {cards.length === 0 && (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '48px 0' }}>No cards found for this deck.</p>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Render — full-screen white layout (no AppShell chrome)
  // -------------------------------------------------------------------------
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#0D0D0D] print:bg-white">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }

        @media print {
          /* Remove browser-added URL, date, and page number headers/footers */
          @page {
            margin: 1cm 1.5cm;
            size: A4 portrait;
          }

          /* Hide all UI chrome */
          .print\\:hidden { display: none !important; }

          /* Hide the dark outer shell, show only white paper area */
          body > * { visibility: hidden; }
          #print-paper-area,
          #print-paper-area * { visibility: visible; }

          /* Position paper area to fill the page */
          #print-paper-area {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Ensure page breaks work correctly */
          table { border-collapse: collapse; width: 100%; }
          tr { page-break-inside: avoid; }
          .page-break-inside-avoid { page-break-inside: avoid; }
        }
      `}</style>
      {titleBar}
      {toolbar}
      <div className="flex-1 overflow-y-auto" style={{ background: '#e5e7eb', padding: '40px 0' }}>
        <div id="print-paper-area" style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '60px 70px', boxShadow: '0 2px 16px rgba(0,0,0,0.13)', minHeight: '1100px' }}>
          {paperContent}
        </div>
      </div>
    </div>
  )
}
