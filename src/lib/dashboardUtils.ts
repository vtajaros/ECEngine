import { AccuracySubject } from '../services/db.service'

export const SUBJECT_MAP: Record<string, string> = {
  'Mathematics': 'MATH',
  'General Engineering & Applied Sciences': 'GEAS',
  'Electronics Engineering': 'ELECS',
  'Electronics Systems & Technologies': 'EST',
}

export const SUBJECT_LINE_COLOR: Record<AccuracySubject, string> = {
  ALL:   '#00FF41',
  MATH:  '#FB923C',
  GEAS:  '#60A5FA',
  ELECS: '#F87171',
  EST:   '#22C55E',
}
