import React, { useState, useMemo } from 'react'
import { SubjectArea, Topic } from './data'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { TOS_ITEMS, getSubjectTotals, TosSubjectCode } from './tosItems'
import { TOS_ROWS, rowTiers, describeLevels, TosRow } from './tosRows'

interface SubjectCardProps {
  subject: SubjectArea
  searchQuery: string
}

function matchesSearch(text: string, query: string) {
  if (!query) return true
  return text.toLowerCase().includes(query.toLowerCase())
}

function RowBadges({ row }: { row: TosRow }) {
  const tiers = rowTiers(row.levels)
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-['JetBrains_Mono']"
      title={describeLevels(row.levels)}
    >
      <span className="text-text-muted">{row.items} items</span>
      {tiers.easy > 0 && (
        <span
          className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] font-bold text-[10px]"
          style={{ color: 'var(--tier-easy)' }}
        >
          E{tiers.easy}
        </span>
      )}
      {tiers.moderate > 0 && (
        <span
          className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] font-bold text-[10px]"
          style={{ color: 'var(--tier-moderate)' }}
        >
          M{tiers.moderate}
        </span>
      )}
      {tiers.difficult > 0 && (
        <span
          className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] font-bold text-[10px]"
          style={{ color: 'var(--tier-difficult)' }}
        >
          D{tiers.difficult}
        </span>
      )}
    </span>
  )
}

function SubtopicLine({
  name,
  isMatch,
  searchQuery,
  badges,
}: {
  name: string
  isMatch: boolean
  searchQuery: string
  badges?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-surface-2 transition-colors rounded px-2 group">
      <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] shrink-0" />
      <span className="text-[13px] font-['JetBrains_Mono'] text-text-muted group-hover:text-text-primary transition-colors">
        {/* TODO: Link to filtered decks for this subtopic */}
        {isMatch && searchQuery ? highlightText(name, searchQuery) : name}
      </span>
      {badges && <div className="ml-auto shrink-0">{badges}</div>}
    </div>
  )
}

function TopicRow({ topic, searchQuery }: { topic: Topic, searchQuery: string }) {
  const [expanded, setExpanded] = useState(false)
  const tos = TOS_ITEMS[topic.id]
  const topicRows = TOS_ROWS[topic.id]

  const rowBySubtopic = useMemo(() => {
    const map = new Map<string, TosRow>()
    if (topicRows) {
      for (const r of topicRows.rows) {
        for (const sid of r.subtopicIds) {
          map.set(sid, r)
        }
      }
    }
    return map
  }, [topicRows])
  
  // A topic is visible if its name matches the query OR any of its subtopics match
  const visibleSubtopics = topic.subtopics.filter(st => matchesSearch(st.name, searchQuery))
  const topicMatches = matchesSearch(topic.name, searchQuery)
  
  if (!topicMatches && visibleSubtopics.length === 0) return null

  // Auto-expand if there's a search query and a subtopic matches
  const isExpanded = expanded || (searchQuery.trim().length > 0 && visibleSubtopics.length > 0)

  return (
    <div className="flex flex-col border-b border-border-base last:border-b-0">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="font-['Orbitron'] text-[var(--text-primary)] font-bold text-sm tracking-wide">
            {topicMatches && searchQuery ? highlightText(topic.name, searchQuery) : topic.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {tos && (
            <>
              <span className="text-xs font-['JetBrains_Mono'] text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-1 rounded border border-[#333]">
                {tos.items} items
              </span>
              <div
                className="w-24 h-1.5 rounded overflow-hidden flex bg-[var(--bg-elevated)] shrink-0"
                title={`Easy ${tos.easy} · Moderate ${tos.moderate} · Difficult ${tos.difficult}`}
              >
                {tos.easy > 0 && (
                  <div
                    style={{
                      width: `${(tos.easy / tos.items) * 100}%`,
                      backgroundColor: 'var(--tier-easy)',
                    }}
                  />
                )}
                {tos.moderate > 0 && (
                  <div
                    style={{
                      width: `${(tos.moderate / tos.items) * 100}%`,
                      backgroundColor: 'var(--tier-moderate)',
                    }}
                  />
                )}
                {tos.difficult > 0 && (
                  <div
                    style={{
                      width: `${(tos.difficult / tos.items) * 100}%`,
                      backgroundColor: 'var(--tier-difficult)',
                    }}
                  />
                )}
              </div>
            </>
          )}
          <span className="text-xs font-['JetBrains_Mono'] text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-1 rounded border border-[#333]">
            {topic.subtopics.length} subtopics
          </span>
          {isExpanded ? <ChevronDown size={16} className="text-[var(--accent-primary)]" /> : <ChevronRight size={16} className="text-[var(--text-secondary)]" />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden bg-[var(--bg-primary)]"
          >
            <div className="flex flex-col py-2 px-6">
              {tos && (
                <div className="text-[11px] font-['JetBrains_Mono'] text-[var(--text-secondary)] pb-1.5 pt-0.5">
                  <span style={{ color: 'var(--tier-easy)' }}>Easy {tos.easy}</span>
                  {' · '}
                  <span style={{ color: 'var(--tier-moderate)' }}>Moderate {tos.moderate}</span>
                  {' · '}
                  <span style={{ color: 'var(--tier-difficult)' }}>Difficult {tos.difficult}</span>
                  {tos.sharedWith && ` · also shared with ${tos.sharedWith}`}
                </div>
              )}
              {visibleSubtopics.length > 0 && (() => {
                const emitted = new Set<TosRow>()
                return visibleSubtopics.map(st => {
                  const isMatch = matchesSearch(st.name, searchQuery)
                  const row = rowBySubtopic.get(st.id)

                  if (!row) {
                    return (
                      <SubtopicLine
                        key={st.id}
                        name={st.name}
                        isMatch={isMatch}
                        searchQuery={searchQuery}
                      />
                    )
                  }

                  if (row.subtopicIds.length === 1) {
                    return (
                      <SubtopicLine
                        key={st.id}
                        name={st.name}
                        isMatch={isMatch}
                        searchQuery={searchQuery}
                        badges={<RowBadges row={row} />}
                      />
                    )
                  }

                  if (emitted.has(row)) return null
                  emitted.add(row)

                  const groupSubtopics = visibleSubtopics.filter(s => row.subtopicIds.includes(s.id))

                  return (
                    <div
                      key={row.subtopicIds.join(',')}
                      className="border-l-2 border-border-base pl-3 my-1 flex flex-col"
                    >
                      <div className="flex items-center justify-between gap-3 py-1">
                        <span
                          className="text-[11px] font-['JetBrains_Mono'] text-text-muted truncate min-w-0"
                          title={row.label}
                        >
                          {row.label}
                        </span>
                        <div className="ml-auto shrink-0">
                          <RowBadges row={row} />
                        </div>
                      </div>
                      {groupSubtopics.map(sub => (
                        <SubtopicLine
                          key={sub.id}
                          name={sub.name}
                          isMatch={matchesSearch(sub.name, searchQuery)}
                          searchQuery={searchQuery}
                        />
                      ))}
                    </div>
                  )
                })
              })()}
              {visibleSubtopics.length === 0 && (
                <div className="text-xs text-[#555] font-['JetBrains_Mono'] py-2 px-2">No matching subtopics</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function highlightText(text: string, query: string) {
  if (!query) return <>{text}</>
  const parts = text.split(new RegExp(`(${query})`, 'gi'))
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <span key={i} className="bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] font-bold">{part}</span>
          : part
      )}
    </>
  )
}

export function SubjectCard({ subject, searchQuery }: SubjectCardProps) {
  const [expanded, setExpanded] = useState(false)
  const totals = getSubjectTotals(subject.id as TosSubjectCode)

  // A subject is visible if its name matches OR any topic matches OR any subtopic matches
  const visibleTopics = subject.topics.filter(t => {
    if (matchesSearch(t.name, searchQuery)) return true
    if (t.subtopics.some(st => matchesSearch(st.name, searchQuery))) return true
    return false
  })
  
  const subjectMatches = matchesSearch(subject.name, searchQuery)
  if (!subjectMatches && visibleTopics.length === 0) return null

  // Auto-expand if there's a search query and a topic/subtopic matches
  const isExpanded = expanded || (searchQuery.trim().length > 0 && visibleTopics.length > 0)

  return (
    <div className={`flex flex-col bg-[var(--bg-card)] border rounded-xl overflow-hidden transition-all ${isExpanded ? 'border-[#333] border-l-[4px] border-l-[var(--accent-primary)] shadow-[0_0_20px_rgba(0,255,65,0.05)]' : 'border-border-base hover:border-[#333]'}`}>
      <div 
        className="flex items-center justify-between p-6 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-[var(--accent-glow)] border border-[rgba(0,255,65,0.1)] flex items-center justify-center shrink-0">
            <subject.icon size={20} className="text-[var(--accent-primary)]" />
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="font-['Orbitron'] text-xl font-bold text-[var(--text-primary)] tracking-wider uppercase leading-tight truncate">
              {subjectMatches && searchQuery ? highlightText(subject.name, searchQuery) : subject.name}
            </h2>
            <div className="text-xs font-['JetBrains_Mono'] text-[var(--text-secondary)] truncate mt-1">
              {totals.items} items · Easy {totals.easy} · Moderate {totals.moderate} · Difficult {totals.difficult}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
          <span className="text-sm font-['Rajdhani'] uppercase tracking-widest font-bold text-[var(--accent-primary)] bg-[var(--accent-glow)] border border-[rgba(0,255,65,0.2)] px-3 py-1.5 rounded flex-shrink-0 whitespace-nowrap">
            {subject.topics.length} topics
          </span>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-[var(--accent-primary)]" /> : <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border-base"
          >
            <div className="flex flex-col">
              {visibleTopics.map(topic => (
                <TopicRow key={topic.id} topic={topic} searchQuery={searchQuery} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
