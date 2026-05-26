import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Search, ArrowLeft } from 'lucide-react'
import { FORMULA_BANK, FormulaTopic, countFormulas, FormulaEntry } from '../lib/formulaData'
import { TOS_SUBJECT_COLORS } from '../lib/tosData'
import { renderMath } from '../lib/latex'

type SubjectCode = 'MATH' | 'ELECS' | 'GEAS' | 'EST'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderFormula(latex: string): React.ReactNode {
  try {
    const html = renderMath(`$$${latex}$$`)
    return (
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        className="overflow-x-auto text-center"
      />
    )
  } catch {
    return <code className="text-[#E8E8E8] break-all text-xs">{latex}</code>
  }
}

// ─── Topic List Row ────────────────────────────────────────────────────────────

const TopicRow = ({
  topic,
  index,
  subjectCode,
  subjectLabel,
  showSubjectBadge,
  onClick,
}: {
  topic: FormulaTopic
  index: number
  subjectCode: SubjectCode
  subjectLabel: string
  showSubjectBadge: boolean
  onClick: () => void
}) => {
  const colors = TOS_SUBJECT_COLORS[subjectCode]
  const count = countFormulas(topic)

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#111] border border-[#222] rounded-lg px-5 py-4 flex items-center gap-4 group transition-all"
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = colors.accent
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = '#222'
      }}
    >
      {/* 4px Subject-colored left strip */}
      <div
        className="w-1 self-stretch rounded-full shrink-0 transition-opacity"
        style={{ backgroundColor: colors.accent }}
      />

      {/* Number */}
      <span className="text-xs font-['IBM_Plex_Mono'] shrink-0 w-6 text-right text-[#888]">
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Topic name and formula count */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <div className={`font-['Rajdhani'] font-bold text-lg leading-tight truncate ${count === 0 ? 'text-[#888]' : 'text-[#E8E8E8]'}`}>
            {topic.name}
          </div>
          {showSubjectBadge && (
            <div
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-['IBM_Plex_Mono'] font-bold uppercase tracking-widest"
              style={{ background: colors.badge, color: colors.accent }}
            >
              {subjectCode}
            </div>
          )}
        </div>
        <div className={`text-xs font-['IBM_Plex_Mono'] mt-1 ${count > 0 ? 'text-[#666]' : 'text-[#444]'}`}>
          {count > 0 ? (
            <>
              <span style={{ color: colors.accent }}>{count}</span> formulas
            </>
          ) : (
            'empty'
          )}
        </div>
      </div>

      <ChevronRight
        size={18}
        className="shrink-0 text-[#444] group-hover:text-white transition-colors"
      />
    </button>
  )
}

// ─── Formula Card ─────────────────────────────────────────────────────────────

const FormulaCard = ({
  formula,
  subjectCode,
}: {
  formula: FormulaEntry
  subjectCode: SubjectCode
}) => {
  const colors = TOS_SUBJECT_COLORS[subjectCode]

  return (
    <div
      className="bg-[#0c0c0c] border border-[#222] rounded-lg p-4 relative flex flex-col gap-2 transition-colors"
      style={{ borderLeftColor: colors.accent, borderLeftWidth: '4px' }}
    >
      <div className="font-['Rajdhani'] font-bold uppercase text-sm tracking-widest text-[#E8E8E8]">
        {formula.name}
      </div>
      <div className="bg-[#080808] border border-[#1a1a1a] rounded p-4 my-2 overflow-x-auto flex items-center justify-center min-h-[56px]">
        {renderFormula(formula.latex)}
      </div>
      {formula.description && (
        <div className="text-[#666] text-xs font-['IBM_Plex_Mono'] italic leading-relaxed">
          {formula.description}
        </div>
      )}
      {formula.variables && (
        <div className="text-[#555] text-[10px] font-['IBM_Plex_Mono'] leading-relaxed whitespace-pre-wrap">
          {formula.variables}
        </div>
      )}
    </div>
  )
}

// ─── Topic Detail View ────────────────────────────────────────────────────────

interface LocalTopic {
  topic: FormulaTopic
  subjectCode: SubjectCode
}

const TopicDetail = ({
  selected,
  onBack,
}: {
  selected: LocalTopic
  onBack: () => void
}) => {
  const { topic, subjectCode } = selected
  const colors = TOS_SUBJECT_COLORS[subjectCode]
  const totalTopicFormulas = countFormulas(topic)

  return (
    <motion.div
      key="detail"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full bg-[var(--bg-primary)]"
    >
      {/* Detail header */}
      <div className="sticky top-0 z-50 bg-[var(--bg-secondary)] border-b border-[#222] shadow-lg px-6 py-4 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#888] hover:text-white transition-colors font-['Rajdhani'] font-bold text-sm uppercase tracking-widest shrink-0"
          >
            <ArrowLeft size={16} />
            BACK
          </button>
          
          <div className="text-[#555] font-['Rajdhani'] text-xs font-bold uppercase tracking-widest">
            {subjectCode} <span className="mx-1">&gt;</span> <span className="text-[#888]">{topic.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <div
            className="shrink-0 text-xs font-['IBM_Plex_Mono'] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ background: colors.badge, color: colors.accent }}
          >
            {subjectCode}
          </div>
          <h1 className="font-['Orbitron'] font-bold text-xl uppercase tracking-widest truncate text-white">
            {topic.name}
          </h1>
        </div>

        <div className="text-[#666] font-['IBM_Plex_Mono'] text-xs mt-1">
          {totalTopicFormulas} formula{totalTopicFormulas !== 1 ? 's' : ''} across {topic.subtopics.length} subtopics
        </div>
      </div>

      {/* Subtopics */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-10">
          {topic.subtopics.map((subtopic, si) => (
            <div key={si}>
              {/* Subtopic header */}
              <div className="flex items-center gap-3 mb-4">
                <h2
                  className="font-['Rajdhani'] font-bold text-lg uppercase tracking-widest"
                  style={{ color: colors.accent }}
                >
                  {subtopic.name}
                </h2>
                {subtopic.formulas.length > 0 && (
                  <span
                    className="shrink-0 text-xs font-['IBM_Plex_Mono'] px-2 py-0.5 rounded-full border"
                    style={{ color: colors.accent, borderColor: `rgba(${colors.accentRgb},0.3)`, background: colors.badge }}
                  >
                    {subtopic.formulas.length}
                  </span>
                )}
              </div>

              {subtopic.formulas.length === 0 ? (
                <div className="text-[#2a2a2a] text-xs text-center py-3 font-['IBM_Plex_Mono'] border border-[#1a1a1a] rounded-lg bg-[#0c0c0c]">
                  — no formulas yet —
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {subtopic.formulas.map(formula => (
                    <FormulaCard
                      key={formula.id}
                      formula={formula}
                      subjectCode={subjectCode}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FormulaBank() {
  const [activeSubject, setActiveSubject] = useState<SubjectCode>('MATH')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTopic, setSelectedTopic] = useState<LocalTopic | null>(null)

  const subjects: SubjectCode[] = ['MATH', 'ELECS', 'GEAS', 'EST']

  // Compute visible topic rows
  const topicRows: { topic: FormulaTopic; subjectCode: SubjectCode; subjectLabel: string }[] =
    useMemo(() => {
      const q = searchQuery.trim().toLowerCase()

      if (!q) {
        // No search: show only active subject
        const subData = FORMULA_BANK.find(s => s.code === activeSubject)
        if (!subData) return []
        return subData.topics.map(t => ({
          topic: t,
          subjectCode: subData.code,
          subjectLabel: subData.label,
        }))
      }

      // Search active across ALL subjects
      const results: { topic: FormulaTopic; subjectCode: SubjectCode; subjectLabel: string }[] = []
      for (const sub of FORMULA_BANK) {
        for (const topic of sub.topics) {
          const topicMatch = topic.name.toLowerCase().includes(q)
          const formulaMatch = topic.subtopics.some(st =>
            st.formulas.some(
              f =>
                f.name.toLowerCase().includes(q) ||
                (f.description?.toLowerCase().includes(q)) ||
                (f.variables?.toLowerCase().includes(q))
            )
          )
          if (topicMatch || formulaMatch) {
            results.push({
              topic,
              subjectCode: sub.code,
              subjectLabel: sub.label,
            })
          }
        }
      }
      return results
    }, [activeSubject, searchQuery])

  const isSearching = searchQuery.trim().length > 0

  return (
    <div className="h-full bg-[var(--bg-primary)] flex flex-col relative overflow-hidden">
      <AnimatePresence mode="wait">
        {selectedTopic ? (
          <TopicDetail
            key="detail"
            selected={selectedTopic}
            onBack={() => setSelectedTopic(null)}
          />
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full"
          >
            {/* Page Header */}
            <div className="sticky top-0 z-50 bg-[var(--bg-secondary)] border-b border-[#222] shadow-lg flex flex-col px-6 py-4 shrink-0 gap-4">
              <h1 className="font-['Orbitron'] font-bold text-2xl uppercase tracking-widest text-white">
                FORMULA BANK
              </h1>

              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                {/* Subject tabs */}
                <div className="flex gap-2 justify-center">
                  {subjects.map(code => {
                    const colors = TOS_SUBJECT_COLORS[code]
                    const isActive = activeSubject === code && !isSearching
                    return (
                      <button
                        key={code}
                        onClick={() => {
                          setActiveSubject(code)
                          setSearchQuery('')
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all font-['Rajdhani'] font-bold text-sm uppercase tracking-widest"
                        style={
                          isActive
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
                        {code}
                      </button>
                    )
                  })}
                </div>

                {/* Search bar */}
                <div className="relative w-full md:w-72 shrink-0 ml-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                  <input
                    type="text"
                    placeholder="Search topics & formulas..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg pl-10 pr-4 py-2 text-white font-['Rajdhani'] text-sm tracking-wide placeholder-[#888] focus:border-[#555] focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Topic List */}
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <div className="max-w-4xl mx-auto flex flex-col gap-3">
                {isSearching && (
                  <div className="font-['Rajdhani'] text-[#888] text-sm uppercase tracking-widest mb-2">
                    {topicRows.length} result{topicRows.length !== 1 ? 's' : ''} for "{searchQuery}"
                  </div>
                )}
                {topicRows.map((row, idx) => (
                  <TopicRow
                    key={row.topic.id}
                    topic={row.topic}
                    index={idx}
                    subjectCode={row.subjectCode}
                    subjectLabel={row.subjectLabel}
                    showSubjectBadge={isSearching}
                    onClick={() =>
                      setSelectedTopic({
                        topic: row.topic,
                        subjectCode: row.subjectCode,
                      })
                    }
                  />
                ))}
                {topicRows.length === 0 && (
                  <div className="text-center text-[#444] font-['Rajdhani'] uppercase tracking-widest py-16">
                    No topics found.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
