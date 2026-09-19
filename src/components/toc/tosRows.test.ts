import { describe, it, expect } from 'vitest'
import { TOS_ROWS, rowTiers } from './tosRows'
import { TOS_ITEMS } from './tosItems'
import { TOC_DATA } from './data'

// Topics where the PDF's row breakdown disagrees with its own topic total.
const KNOWN_TIER_MISMATCH = ['GEAS-5.0']

describe('TOS rows', () => {
  it('has rows for exactly the topics that have item counts', () => {
    expect(Object.keys(TOS_ROWS).sort()).toEqual(Object.keys(TOS_ITEMS).sort())
  })

  it('row level cells add up to the row item count', () => {
    for (const [id, t] of Object.entries(TOS_ROWS)) {
      for (const r of t.rows) {
        const cells = Object.values(r.levels).reduce((a, b) => a + (b ?? 0), 0)
        expect(cells, `${id} ${r.subtopicIds.join(',')}`).toBe(r.items)
      }
    }
  })

  it('row items add up to the topic item count', () => {
    for (const [id, t] of Object.entries(TOS_ROWS)) {
      const sum = t.rows.reduce((a, r) => a + r.items, 0)
      expect(sum, id).toBe(TOS_ITEMS[id].items)
    }
  })

  it('row tiers add up to the topic tiers (except documented PDF mismatches)', () => {
    for (const [id, t] of Object.entries(TOS_ROWS)) {
      if (KNOWN_TIER_MISMATCH.includes(id)) continue
      const sum = t.rows.reduce(
        (a, r) => {
          const x = rowTiers(r.levels)
          return { easy: a.easy + x.easy, moderate: a.moderate + x.moderate, difficult: a.difficult + x.difficult }
        },
        { easy: 0, moderate: 0, difficult: 0 }
      )
      const expected = TOS_ITEMS[id]
      expect(sum, id).toEqual({ easy: expected.easy, moderate: expected.moderate, difficult: expected.difficult })
    }
  })

  it('every subtopic in toc/data.ts is in exactly one row or listed as unmapped', () => {
    for (const subject of TOC_DATA) {
      for (const topic of subject.topics) {
        const t = TOS_ROWS[topic.id]
        expect(t, topic.id).toBeDefined()
        for (const st of topic.subtopics) {
          const inRows = t.rows.filter((r) => r.subtopicIds.includes(st.id)).length
          const inUnmapped = (t.unmapped ?? []).includes(st.id) ? 1 : 0
          expect(inRows + inUnmapped, st.id).toBe(1)
        }
      }
    }
  })

  it('every id referenced by a row exists in toc/data.ts', () => {
    const ids = new Set(TOC_DATA.flatMap((s) => s.topics.flatMap((t) => t.subtopics.map((st) => st.id))))
    for (const [topicId, t] of Object.entries(TOS_ROWS)) {
      for (const r of t.rows) {
        for (const id of r.subtopicIds) expect(ids.has(id), `${topicId} -> ${id}`).toBe(true)
      }
    }
  })
})
