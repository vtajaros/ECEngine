import React, { useState } from 'react'
import { SubjectArea, Topic } from './data'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface SubjectCardProps {
  subject: SubjectArea
  searchQuery: string
}

function matchesSearch(text: string, query: string) {
  if (!query) return true
  return text.toLowerCase().includes(query.toLowerCase())
}

function TopicRow({ topic, searchQuery }: { topic: Topic, searchQuery: string }) {
  const [expanded, setExpanded] = useState(false)
  
  // A topic is visible if its name matches the query OR any of its subtopics match
  const visibleSubtopics = topic.subtopics.filter(st => matchesSearch(st.name, searchQuery))
  const topicMatches = matchesSearch(topic.name, searchQuery)
  
  if (!topicMatches && visibleSubtopics.length === 0) return null

  // Auto-expand if there's a search query and a subtopic matches
  const isExpanded = expanded || (searchQuery.trim().length > 0 && visibleSubtopics.length > 0)

  return (
    <div className="flex flex-col border-b border-[#222] last:border-b-0">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="font-['Orbitron'] text-[var(--text-primary)] font-bold text-sm tracking-wide">
            {topicMatches && searchQuery ? highlightText(topic.name, searchQuery) : topic.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-['IBM_Plex_Mono'] text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-1 rounded border border-[#333]">
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
              {visibleSubtopics.map(st => {
                const isMatch = matchesSearch(st.name, searchQuery)
                return (
                  <div key={st.id} className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-[#161616] transition-colors rounded px-2 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] shrink-0" />
                    <span className="text-[13px] font-['IBM_Plex_Mono'] text-[#888] group-hover:text-[#E8E8E8] transition-colors">
                      {/* TODO: Link to filtered decks for this subtopic */}
                      {isMatch && searchQuery ? highlightText(st.name, searchQuery) : st.name}
                    </span>
                  </div>
                )
              })}
              {visibleSubtopics.length === 0 && (
                <div className="text-xs text-[#555] font-['IBM_Plex_Mono'] py-2 px-2">No matching subtopics</div>
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
    <div className={`flex flex-col bg-[var(--bg-card)] border rounded-xl overflow-hidden transition-all ${isExpanded ? 'border-[#333] border-l-[4px] border-l-[var(--accent-primary)] shadow-[0_0_20px_rgba(0,255,65,0.05)]' : 'border-[#222] hover:border-[#333]'}`}>
      <div 
        className="flex items-center justify-between p-6 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-[var(--accent-glow)] border border-[rgba(0,255,65,0.1)] flex items-center justify-center shrink-0">
            <subject.icon size={20} className="text-[var(--accent-primary)]" />
          </div>
          <h2 className="font-['Orbitron'] text-xl font-bold text-[var(--text-primary)] tracking-wider uppercase leading-tight">
            {subjectMatches && searchQuery ? highlightText(subject.name, searchQuery) : subject.name}
          </h2>
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
            className="overflow-hidden border-t border-[#222]"
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
