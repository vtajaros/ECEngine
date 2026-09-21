import { AccuracySubject } from '../services/db.service'

export const SUBJECT_MAP: Record<string, string> = {
  'Mathematics': 'MATH',
  'General Engineering & Applied Sciences': 'GEAS',
  'Electronics Engineering': 'ELECS',
  'Electronics Systems & Technologies': 'EST',
}

export const SUBJECT_LINE_COLOR: Record<AccuracySubject, string> = {
  ALL:   '#00FF41',
  MATH:  '#f59e0b',
  GEAS:  '#3b82f6',
  ELECS: '#ef4444',
  EST:   '#22c55e',
}
