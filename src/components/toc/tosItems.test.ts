import { describe, it, expect } from 'vitest'
import { TOS_ITEMS, TOS_SUBJECT_WEIGHTS, getSubjectTotals } from './tosItems'
import { TOC_DATA } from './data'

// Topics present in the PDF but not yet in toc/data.ts. Remove entries as they are added.
const KNOWN_MISSING_IN_TOC: string[] = []

describe('TOS item counts', () => {
  it('each topic splits exactly into easy + moderate + difficult', () => {
    for (const [id, t] of Object.entries(TOS_ITEMS)) {
      expect(t.easy + t.moderate + t.difficult, id).toBe(t.items)
    }
  })

  it('subject totals match the PRC PDF', () => {
    expect(getSubjectTotals('MATH')).toEqual({ items: 100, easy: 30, moderate: 40, difficult: 30 })
    expect(getSubjectTotals('ELECS')).toEqual({ items: 100, easy: 30, moderate: 40, difficult: 30 })
    expect(getSubjectTotals('EST')).toEqual({ items: 100, easy: 30, moderate: 40, difficult: 30 })
    // GEAS is not 30/40/30 in the PDF: 40+20 easy, 21 application, 11+8 difficult
    expect(getSubjectTotals('GEAS')).toEqual({ items: 100, easy: 60, moderate: 21, difficult: 19 })
  })

  it('TOS_SUBJECT_WEIGHTS sums to 100 and matches PRC specifications', () => {
    expect(TOS_SUBJECT_WEIGHTS).toEqual({
      MATH: 20,
      GEAS: 20,
      ELECS: 30,
      EST: 30,
    })
    const sum = Object.values(TOS_SUBJECT_WEIGHTS).reduce((acc, w) => acc + w, 0)
    expect(sum).toBe(100)
  })

  it('every topic in toc/data.ts has item counts', () => {
    for (const subject of TOC_DATA) {
      for (const topic of subject.topics) {
        expect(TOS_ITEMS[topic.id], topic.id).toBeDefined()
      }
    }
  })

  it('every TOS topic exists in toc/data.ts (except known gaps)', () => {
    const tocIds = new Set(TOC_DATA.flatMap((s) => s.topics.map((t) => t.id)))
    const missing = Object.keys(TOS_ITEMS).filter((id) => !tocIds.has(id))
    expect(missing).toEqual(KNOWN_MISSING_IN_TOC)
  })
})
