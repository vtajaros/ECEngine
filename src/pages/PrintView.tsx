import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, Table2, List, BookOpen, Bold, Loader2, CheckCircle2, AlertCircle, Minus, Square, X } from 'lucide-react'
import { dbService } from '../services/db.service'
import { Card, MCQData, FlashcardData, FormulaData } from '../types'
import { renderMath } from '../lib/latex'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LayoutMode = 'table' | 'glossary' | 'qa'
type BoldSide = 'term' | 'definition' | 'none'
type ExportState = 'idle' | 'loading' | 'success' | 'error'

type PrintTheme = 'light' | 'sepia' | 'dark'

interface ThemeDef {
  label: string
  vars: Record<string, string>
}

const PRINT_THEMES: Record<PrintTheme, ThemeDef> = {
  light: {
    label: 'Light',
    vars: {
      '--pt-bg-outer': '#e5e7eb',
      '--pt-bg-paper': '#ffffff',
      '--pt-text-primary': '#111827',
      '--pt-text-secondary': '#6b7280',
      '--pt-text-body': '#374151',
      '--pt-text-muted': '#9ca3af',
      '--pt-border': '#d1d5db',
      '--pt-border-light': '#e5e7eb',
      '--pt-thead-bg': '#f9fafb',
      '--pt-answer-bg': '#fef3c7',
      '--pt-answer-text': '#92400e',
      '--pt-formula-bg': '#f3f4f6',
      '--pt-formula-text': '#1e40af',
      '--pt-rule': '#111827',
    },
  },
  sepia: {
    label: 'Sepia',
    vars: {
      '--pt-bg-outer': '#c8b89a',
      '--pt-bg-paper': '#f5ead7',
      '--pt-text-primary': '#2c1a0e',
      '--pt-text-secondary': '#7a5c3e',
      '--pt-text-body': '#3d2b1a',
      '--pt-text-muted': '#a08060',
      '--pt-border': '#c4a882',
      '--pt-border-light': '#ddd0b8',
      '--pt-thead-bg': '#ede0c4',
      '--pt-answer-bg': '#e8d5a3',
      '--pt-answer-text': '#5c3a00',
      '--pt-formula-bg': '#ede0c4',
      '--pt-formula-text': '#3a2200',
      '--pt-rule': '#2c1a0e',
    },
  },
  dark: {
    label: 'Dark',
    vars: {
      '--pt-bg-outer': '#1a1d23',
      '--pt-bg-paper': '#252931',
      '--pt-text-primary': '#e8eaf0',
      '--pt-text-secondary': '#9099a8',
      '--pt-text-body': '#c8cdd6',
      '--pt-text-muted': '#5a6070',
      '--pt-border': '#363b45',
      '--pt-border-light': '#2e3340',
      '--pt-thead-bg': '#1e2128',
      '--pt-answer-bg': 'rgba(100,160,255,0.12)',
      '--pt-answer-text': '#7eb8f7',
      '--pt-formula-bg': '#1e2128',
      '--pt-formula-text': '#7eb8f7',
      '--pt-rule': '#4a5060',
    },
  },
}

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
    <tr style={{ borderBottom: '1px solid var(--pt-border)', pageBreakInside: 'avoid' }}>
      <td style={{ padding: '10px 12px', verticalAlign: 'top', width: '65%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontWeight: 700, minWidth: '24px', color: 'var(--pt-text-primary)' }}>{index}.</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, color: 'var(--pt-text-primary)', marginBottom: '6px', lineHeight: 1.5 }}>
              <MathText text={question} />
            </p>
            {/* question imagePath */}
            {(card.data as MCQData & { imagePath?: string }).imagePath && (
              <img
                src={`ece-app://${(card.data as MCQData & { imagePath?: string }).imagePath}`}
                alt="Question diagram"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '6px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
              />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: '2px 8px', marginTop: '4px' }}>
              {/* Column order: A(0) C(2) in col1, B(1) D(3) in col2 — rendered in row order so grid places them correctly */}
              {[0, 1, 2, 3].map((ci) => {
                const choice = choices[ci]
                if (choice === undefined) return null
                return (
                  <div
                    key={ci}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: ci === answer ? 'var(--pt-answer-bg)' : 'transparent',
                      color: ci === answer ? 'var(--pt-answer-text)' : 'var(--pt-text-body)',
                      fontWeight: ci === answer ? 700 : 400,
                      borderRadius: '3px',
                      display: 'flex',
                      gap: '6px',
                      gridColumn: ci % 2 === 0 ? 1 : 2,
                      gridRow: ci < 2 ? 1 : 2,
                      alignSelf: 'start',
                      justifySelf: 'start',
                    }}
              >
                    <span style={{ minWidth: '18px', fontWeight: 700 }}>{CHOICE_LABELS[ci]}.</span>
                    <span><MathText text={choice} /></span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </td>
      <td
        style={{
          padding: '10px 12px',
          verticalAlign: 'top',
          width: '35%',
          borderLeft: '1px solid var(--pt-border)',
          fontSize: '13px',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--pt-text-secondary)' }}></span>
        <span style={{ fontWeight: 700, color: 'var(--pt-text-primary)' }}>
          <MathText text={choices[answer] ?? '—'} />
        </span>
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
      <div style={{ marginBottom: '14px', pageBreakInside: 'avoid', borderBottom: '1px solid var(--pt-border-light)', paddingBottom: '10px' }}>
        <p style={{ fontWeight: 400, color: 'var(--pt-text-primary)', marginBottom: '4px' }}>
          {index}. <MathText text={question} />
        </p>
        {imagePath && (
          <img
            src={`ece-app://${imagePath}`}
            alt="Question diagram"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '6px', marginLeft: '16px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
          />
        )}
        <p style={{ fontWeight: 700, color: 'var(--pt-text-body)', margin: 0, paddingLeft: '16px' }}>
          <MathText text={choices[answer] ?? '—'} />
        </p>
      </div>
    )
  }
  return (
    <div style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
      <p style={{ fontWeight: 600, color: 'var(--pt-text-primary)', marginBottom: '6px' }}>
        {index}. <MathText text={question} />
      </p>
      {imagePath && (
        <img
          src={`ece-app://${imagePath}`}
          alt="Question diagram"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginBottom: '6px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: '2px 8px', marginTop: '4px' }}>
        {[0, 1, 2, 3].map((ci) => {
          const choice = choices[ci]
          if (choice === undefined) return null
          return (
            <div
              key={ci}
              style={{
                padding: '4px 8px',
                backgroundColor: ci === answer ? 'var(--pt-answer-bg)' : 'transparent',
                color: ci === answer ? 'var(--pt-answer-text)' : 'var(--pt-text-body)',
                fontWeight: ci === answer ? 700 : 400,
                borderRadius: '3px',
                display: 'flex',
                gap: '6px',
                gridColumn: ci % 2 === 0 ? 1 : 2,
                gridRow: ci < 2 ? 1 : 2,
                alignSelf: 'start',
                justifySelf: 'start',
              }}
            >
              <span style={{ minWidth: '18px', fontWeight: 700 }}>{CHOICE_LABELS[ci]}.</span>
              <span><MathText text={choice} /></span>
            </div>
          )
        })}
      </div>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', pageBreakInside: 'avoid', borderBottom: '1px solid var(--pt-border-light)', paddingBottom: '12px' }}>
      <div style={{ width: '35%', minWidth: '120px' }}>
        <p style={{ fontWeight: 700, color: 'var(--pt-text-primary)', margin: 0 }}>
          {index}. <MathText text={name} />
        </p>
        {/* variables below name if present */}
        {vars ? (
          <div style={{ fontSize: '12px', color: 'var(--pt-text-secondary)', lineHeight: 1.8, marginTop: '4px' }}>
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
            style={{ fontFamily: 'monospace', backgroundColor: 'var(--pt-formula-bg)', padding: '6px 8px', borderRadius: '4px', color: 'var(--pt-formula-text)', marginBottom: '0px', overflowX: 'auto' }}
            dangerouslySetInnerHTML={{ __html: renderMath(`$$${latex}$$`) }}
          />
        ) : null}
        {imagePath && (
          <img
            src={`ece-app://${imagePath}`}
            alt="Formula diagram"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
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

  const controls = window.electron.windowControls
  const [searchParams] = useSearchParams()

  const topicId = searchParams.get('id') ?? searchParams.get('topicId') ?? ''
  const title = decodeURIComponent(searchParams.get('title') ?? 'Test Paper')

  // pdf config injected by main process via executeJavaScript BEFORE React mounts.
  // We gate rendering until config is present in pdf mode.
  const [pdfConfig, setPdfConfig] = useState<{ pdfmode: string; theme: string; layout: string } | null>(
    () => (window as any).__pdfConfig ?? null
  )
  const isPdfMode = pdfConfig?.pdfmode === '1' || (window as any).__pdfConfig?.pdfmode === '1'

  useEffect(() => {
    if ((window as any).__pdfConfig) {
      setPdfConfig((window as any).__pdfConfig)
      return
    }
    const handler = () => {
      setPdfConfig((window as any).__pdfConfig ?? null)
    }
    window.addEventListener('pdf-config-ready', handler)
    return () => window.removeEventListener('pdf-config-ready', handler)
  }, [])

  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [layout, setLayout] = useState<LayoutMode>('glossary')
  const [boldSide, setBoldSide] = useState<BoldSide>('term')
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [exportError, setExportError] = useState('')
  const [scale, setScale] = useState(1)
  const [theme, setTheme] = useState<PrintTheme>('light')

  // Sync theme+layout from pdfConfig once it arrives
  useEffect(() => {
    if (!pdfConfig) return
    setTheme((pdfConfig.theme ?? 'light') as PrintTheme)
    setLayout((pdfConfig.layout ?? 'table') as LayoutMode)
  }, [pdfConfig])

  const MIN_SCALE = 0.5
  const MAX_SCALE = 2.0
  const SCALE_STEP = 0.1

  // Ref for cleanup on unmount
  const zoomCleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => () => { zoomCleanupRef.current?.() }, [])

  // Right-click + wheel zoom (Sumatra PDF style)
  // useCallback ref: fires the instant the DOM node exists, bypasses early-return null problem
  const rightMouseDown = useRef(false)
  const scrollAreaRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return

    let didZoom = false

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        rightMouseDown.current = true
        didZoom = false
      }
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) rightMouseDown.current = false
    }
    const onContextMenu = (e: MouseEvent) => {
      if (didZoom) {
        e.preventDefault()
        didZoom = false
      }
    }
    const onWheel = (e: WheelEvent) => {
      const isCtrl = e.ctrlKey
      const isRightHeld = rightMouseDown.current
      if (!isCtrl && !isRightHeld) return

      e.preventDefault()
      e.stopPropagation()

      const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP
      setScale(prev => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((prev + delta) * 10) / 10)))
      if (isRightHeld) didZoom = true
    }

    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('contextmenu', onContextMenu)
    el.addEventListener('wheel', onWheel, { passive: false })

    zoomCleanupRef.current = () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  useEffect(() => {
    const initialScale = () => {
      const availableWidth = window.innerWidth
      if (availableWidth < 800) setScale(availableWidth / 800)
      else setScale(1)
    }
    initialScale()
    window.addEventListener('resize', initialScale)
    return () => window.removeEventListener('resize', initialScale)
  }, [])

  useEffect(() => {
    if (!topicId) { setLoading(false); return }
    dbService.getAllCardsByTopic(topicId).then((result) => {
      setCards(result)
      setLoading(false)
    })
  }, [topicId])



  const handleExportPDF = async () => {
    setExportState('loading')
    setExportError('')
    try {
        const result = await window.electron.print.toPDF(title, PRINT_THEMES[theme].vars, topicId, title, theme, layout)
        if (result.canceled) {
          setExportState('idle')
        } else if (result.success) {
          setExportState('success')
          setTimeout(() => setExportState('idle'), 2500)
        } else {
          setExportError(result.error ?? 'Unknown error')
          setExportState('error')
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
        <img
          src="favicon.png"
          alt="Logo"
          className="w-4 h-4 object-contain"
          onError={(e) => {
            const img = e.currentTarget
            if (img.src.includes('favicon.png')) {
              img.src = 'ecengine_icon.png'
            }
          }}
        />
      </div>

      {/* Centered Title */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
        <span className="font-rajdhani font-bold tracking-wider text-white text-xs whitespace-nowrap">
          <span className="text-[#00FF41]">TEST PAPER VIEW</span> — {title}
          <span className="text-gray-500 font-normal"> · {cards.length} cards</span>
        </span>
      </div>

      {/* Right Side: Window Controls */}
      {controls && (
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
      className="print:hidden w-full flex flex-col px-6 py-3"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--bg-card)',
      }}
    >
      <div className="flex flex-nowrap items-center justify-center gap-2 w-full overflow-x-auto no-scrollbar pb-1">
      {/* Layout toggle */}
      <div
        className="flex-shrink-0"
        style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--bg-card)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-elevated)',
        }}
      >
        {([['glossary', List, 'Glossary'], ['table', Table2, 'Table'], ['qa', BookOpen, 'Q&A']] as const).map(
          ([mode, Icon, label]) => {
            const isDisabled = (mode === 'qa' && isFlashcardOnly) || (hasFormulas && (mode === 'glossary' || mode === 'qa'))
            // Hide Q&A button entirely for flashcard-only decks instead of showing it grayed out
            if (mode === 'qa' && isFlashcardOnly) return null
            return (
              <motion.button
                key={mode}
                id={`print-layout-${mode}`}
                disabled={isDisabled}
                onClick={() => { if (!isDisabled) setLayout(mode) }}
                whileTap={{ scale: isDisabled ? 1 : 0.95 }}
                className="whitespace-nowrap flex-shrink-0 text-[12px] px-[14px] py-[6px]"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 700,
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
          className="flex-shrink-0"
          style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--bg-card)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-elevated)',
          }}
        >
          {([['term', 'Bold Term'], ['definition', 'Bold Def']] as const).map(
            ([side, label]) => (
              <motion.button
                key={side}
                onClick={() => setBoldSide(side)}
                whileTap={{ scale: 0.95 }}
                className="whitespace-nowrap flex-shrink-0 text-[11px] px-[10px] py-[5px]"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  transition: 'all 0.15s',
                  background: boldSide === side ? 'var(--accent-primary)' : 'transparent',
                  color: boldSide === side ? '#000' : 'var(--text-secondary)',
                }}
              >
                <Bold size={12} />
                {label}
              </motion.button>
            )
          )}
        </div>
      )}

      {/* Theme picker */}
      <div
        className="flex-shrink-0"
        style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--bg-card)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-elevated)',
        }}
      >
        {(Object.keys(PRINT_THEMES) as PrintTheme[]).map((t) => (
          <motion.button
            key={t}
            onClick={() => setTheme(t)}
            whileTap={{ scale: 0.95 }}
            className="whitespace-nowrap flex-shrink-0 text-[11px] px-[10px] py-[5px]"
            style={{
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: 'all 0.15s',
              background: theme === t ? 'var(--accent-primary)' : 'transparent',
              color: theme === t ? '#000' : 'var(--text-secondary)',
            }}
          >
            {PRINT_THEMES[t].label}
          </motion.button>
        ))}
      </div>

      {/* Zoom controls */}
      <div
        className="flex-shrink-0"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'var(--bg-card)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--bg-elevated)',
        }}
      >
        <motion.button
          onClick={() => setScale(s => Math.max(MIN_SCALE, Math.round((s - SCALE_STEP) * 10) / 10))}
          whileTap={{ scale: 0.9 }}
          title="Zoom Out"
          style={{
            width: '28px', height: '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '16px', fontWeight: 700,
            transition: 'all 0.15s',
          }}
        >−</motion.button>
        <span
          onClick={() => setScale(1)}
          title="Reset zoom"
          style={{
            fontSize: '11px', fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)',
            minWidth: '36px', textAlign: 'center',
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          {Math.round(scale * 100)}%
        </span>
        <motion.button
          onClick={() => setScale(s => Math.min(MAX_SCALE, Math.round((s + SCALE_STEP) * 10) / 10))}
          whileTap={{ scale: 0.9 }}
          title="Zoom In"
          style={{
            width: '28px', height: '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '16px', fontWeight: 700,
            transition: 'all 0.15s',
          }}
        >+</motion.button>
      </div>

      {/* Export PDF button */}
      <motion.button
        id="print-export-pdf"
        onClick={handleExportPDF}
        disabled={exportState === 'loading'}
        whileTap={{ scale: 0.96 }}
        className="whitespace-nowrap flex-shrink-0 text-[13px] px-[20px] py-[8px]"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: exportState === 'success' ? 'var(--color-correct)' : 'var(--accent-primary)',
          color: '#000',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
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
    </div>
  )

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div style={{ background: '#0D0D0D', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        color: 'var(--pt-text-primary)',
        maxWidth: isPdfMode ? 'none' : '800px',
        margin: isPdfMode ? '0' : '0 auto',
        padding: isPdfMode ? '28px 36px' : '0',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--pt-text-primary)', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--pt-text-secondary)', margin: '0 0 12px 0' }}>
          {cards.length} item{cards.length !== 1 ? 's' : ''} &nbsp;·&nbsp; Generated {dateStr}
        </p>
        <hr style={{ border: 'none', borderTop: '2px solid var(--pt-rule)', margin: '0' }} />
      </div>

      {/* MCQ Section */}
      {mcqCards.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          {cards.some(c => !isMCQ(c)) && (
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--pt-text-body)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', borderBottom: '1px solid var(--pt-border-light)', paddingBottom: '4px' }}>
              Multiple Choice
            </h2>
          )}
          {layout === 'table' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--pt-border)', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--pt-border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pt-text-body)', width: '65%', backgroundColor: 'var(--pt-thead-bg)' }}>Question &amp; Choices</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pt-text-body)', borderLeft: '1px solid var(--pt-border)', width: '35%', backgroundColor: 'var(--pt-thead-bg)' }}>Answer</th>
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
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--pt-text-body)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', borderBottom: '1px solid var(--pt-border-light)', paddingBottom: '4px' }}>
              Flashcards
            </h2>
          )}
          {layout === 'table' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--pt-border)', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--pt-border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pt-text-body)', width: '50%', backgroundColor: 'var(--pt-thead-bg)' }}>TERM</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pt-text-body)', borderLeft: '1px solid var(--pt-border)', width: '50%', backgroundColor: 'var(--pt-thead-bg)' }}>DEFINITION</th>
                </tr>
              </thead>
              <tbody>
                {flashcardCards.map((card) => {
                  const { front, back, imageFront, imageBack, imagePath } = card.data
                  return (
                    <tr key={card.id} style={{ borderBottom: '1px solid var(--pt-border)', pageBreakInside: 'avoid' }}>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top', width: '50%', overflow: 'hidden' }}>
                        {imageFront && (
                          <img
                            src={`ece-app://${imageFront}`}
                            alt="Front diagram"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
                          />
                        )}
                        {imagePath && (
                          <img
                            src={`ece-app://${imagePath}`}
                            alt="Flashcard diagram"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
                          />
                        )}
                        <p style={{ color: 'var(--pt-text-primary)', margin: 0, fontWeight: boldSide === 'term' ? 700 : 400 }}><MathText text={front} /></p>
                      </td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top', width: '50%', borderLeft: '1px solid var(--pt-border)', overflow: 'hidden' }}>
                        {imageBack && (
                          <img
                            src={`ece-app://${imageBack}`}
                            alt="Back diagram"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
                          />
                        )}
                        <p style={{ color: 'var(--pt-text-body)', margin: 0, fontWeight: boldSide === 'definition' ? 700 : 400 }}><MathText text={back} /></p>
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
                    <p style={{ fontWeight: boldSide === 'term' ? 700 : 400, color: 'var(--pt-text-primary)', marginBottom: '4px' }}>
                      <MathText text={front} />
                    </p>
                    {imageFront && (
                      <img
                        src={`ece-app://${imageFront}`}
                        alt="Front diagram"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginLeft: '20px', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
                      />
                    )}
                    {imagePath && (
                      <img
                        src={`ece-app://${imagePath}`}
                        alt="Flashcard diagram"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginLeft: '20px', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
                      />
                    )}
                    <div style={{ paddingLeft: '20px', color: 'var(--pt-text-body)' }}>
                      {imageBack && (
                        <img
                          src={`ece-app://${imageBack}`}
                          alt="Back diagram"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          style={{ display: 'block', maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '4px', marginBottom: '4px', borderRadius: '4px', border: '1px solid var(--pt-border-light)' }}
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
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--pt-text-body)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', borderBottom: '1px solid var(--pt-border-light)', paddingBottom: '4px' }}>
            Formulas
          </h2>
          {formulaCards.map((card, i) => (
            <FormulaItem key={card.id} index={i + 1} card={card} />
          ))}
        </section>
      )}

      {cards.length === 0 && (
        <p style={{ color: 'var(--pt-text-muted)', textAlign: 'center', padding: '48px 0' }}>No cards found for this deck.</p>
      )}
    </div>
  )

  // -------------------------------------------------------------------------
  // Render — full-screen white layout (no AppShell chrome)
  // -------------------------------------------------------------------------

  // PDF mode: render bare paper content with no shell, no height constraints
  if (isPdfMode) {
    const currentThemeVars = PRINT_THEMES[theme].vars
    const paperBg = currentThemeVars['--pt-bg-paper']
    return (
      <>
        <style>{`
          @page {
            size: 794px 1123px;
            margin: 0 !important;
          }
          *, *::before, *::after { box-sizing: border-box; }
          html, body, #root {
            margin: 0 !important;
            padding: 0 !important;
            background: ${paperBg} !important;
            height: auto !important;
            overflow: visible !important;
            width: 794px !important;
          }
        `}</style>
        <div
          id="pdf-paper-content"
          style={{
            ...currentThemeVars,
            background: paperBg,
            color: currentThemeVars['--pt-text-primary'],
            fontFamily: 'Georgia, "Times New Roman", serif',
            minHeight: 'unset',
            height: 'auto',
            width: '794px',
            boxSizing: 'border-box',
            margin: 0,
            padding: 0,
          } as React.CSSProperties}
        >
          {paperContent}
        </div>
      </>
    )
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#0D0D0D] print:bg-white">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }

        /* theme vars are applied inline via JS — no static override needed */

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
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto show-scrollbar" style={{ background: PRINT_THEMES[theme].vars['--pt-bg-outer'], padding: '40px 0' }}>
        <div className="w-full flex justify-center pb-12 overflow-x-auto">
          <div
            id="print-paper-area"
            className="w-[800px] max-w-none"
            style={{
              ...PRINT_THEMES[theme].vars,
              maxWidth: '800px',
              margin: '0 auto',
              background: PRINT_THEMES[theme].vars['--pt-bg-paper'],
              padding: '60px 70px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.13)',
              minHeight: '1100px',
              zoom: scale
            } as any}
          >
            {paperContent}
          </div>
        </div>
      </div>
    </div>
  )
}
