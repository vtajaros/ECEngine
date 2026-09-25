/**
 * tosClassification.ts
 * Utilities and lookups for Table of Specifications (TOS) category classification.
 */

import { TOS_DATA, TOSSubject, TOSTopic } from './tosData'
import { Subject } from '../types'

export interface FlatTosTopic {
  id: string              // e.g. "ELECS-1.0"
  subject: Subject        // "MATH" | "GEAS" | "ELECS" | "EST"
  name: string            // e.g. "1.0 DC Electrical Circuits"
  title: string           // e.g. "DC Electrical Circuits"
  code: string            // e.g. "1.0"
  fullLabel: string       // e.g. "ELECS 1.0 DC Electrical Circuits"
  shortBadge: string      // e.g. "ELECS · 1.0 DC Circuits"
  subtopics: string[]     // e.g. ["1.1 Resistive Network", ...]
}

/** Flattened lookup list of all 35 TOS topics */
export const ALL_TOS_TOPICS: FlatTosTopic[] = TOS_DATA.flatMap((subj: TOSSubject) =>
  subj.topics.map((t: TOSTopic) => {
    // Extract code and title from name, e.g. "1.0 DC Electrical Circuits" -> code "1.0", title "DC Electrical Circuits"
    const match = t.name.match(/^(\d+\.0)\s+(.*)$/)
    const code = match ? match[1] : ''
    const title = match ? match[2] : t.name
    return {
      id: t.id,
      subject: subj.code as Subject,
      name: t.name,
      title,
      code,
      fullLabel: `${subj.code} ${t.name}`,
      shortBadge: `${subj.code} · ${t.name}`,
      subtopics: t.subtopics.map(s => s.name),
    }
  })
)

/** Map for O(1) topic lookup by topic id */
const TOPIC_BY_ID_MAP = new Map<string, FlatTosTopic>(
  ALL_TOS_TOPICS.map(t => [t.id.toUpperCase(), t])
)

/** Normalize a subject string to canonical Subject code */
export function normalizeSubjectCode(subj?: string | null): Subject | null {
  if (!subj) return null
  const s = subj.toUpperCase().trim()
  if (s.startsWith('MATH')) return 'MATH'
  if (s.startsWith('GEAS')) return 'GEAS'
  if (s.startsWith('ELEC')) return 'ELECS'
  if (s.startsWith('EST') || s.startsWith('COMM')) return 'EST'
  return null
}

/** Get topic by ID (case-insensitive) */
export function getTosTopicById(id?: string | null): FlatTosTopic | null {
  if (!id) return null
  return TOPIC_BY_ID_MAP.get(id.toUpperCase().trim()) ?? null
}

/** Get all topics under a specific subject */
export function getTosTopicsBySubject(subject?: string | null): FlatTosTopic[] {
  const code = normalizeSubjectCode(subject)
  if (!code) return ALL_TOS_TOPICS
  return ALL_TOS_TOPICS.filter(t => t.subject === code)
}

/** Format badge label for display in UI */
export function formatTosBadge(id?: string | null): string | null {
  const topic = getTosTopicById(id)
  if (!topic) return null
  return topic.shortBadge
}

/** Styling helpers for subject theme */
export function getSubjectColorClasses(subject?: Subject | string | null): {
  badgeBg: string
  badgeBorder: string
  badgeText: string
} {
  const code = normalizeSubjectCode(subject)
  switch (code) {
    case 'MATH':
      return {
        badgeBg: 'bg-blue-500/10',
        badgeBorder: 'border-blue-500/30',
        badgeText: 'text-blue-400',
      }
    case 'GEAS':
      return {
        badgeBg: 'bg-purple-500/10',
        badgeBorder: 'border-purple-500/30',
        badgeText: 'text-purple-400',
      }
    case 'ELECS':
      return {
        badgeBg: 'bg-amber-500/10',
        badgeBorder: 'border-amber-500/30',
        badgeText: 'text-amber-400',
      }
    case 'EST':
      return {
        badgeBg: 'bg-emerald-500/10',
        badgeBorder: 'border-emerald-500/30',
        badgeText: 'text-emerald-400',
      }
    default:
      return {
        badgeBg: 'bg-accent/10',
        badgeBorder: 'border-accent/30',
        badgeText: 'text-accent',
      }
  }
}
