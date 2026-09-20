import { describe, it, expect } from 'vitest'
import { weightedSample } from './sampling'

function makeCards(count: number, extra: Record<string, unknown>) {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    correct_count: 1,
    total_count: 4,
    last_result: null as string | null,
    ...extra,
  }))
}

function distinctSamples(cards: ReturnType<typeof makeCards>, n: number, runs: number): number {
  const seen = new Set<string>()
  for (let r = 0; r < runs; r++) {
    seen.add(weightedSample(cards, n).map(c => c.id).join(','))
  }
  return seen.size
}

describe('weightedSample', () => {
  it('produces varied samples for camelCase easeFactor cards', () => {
    expect(distinctSamples(makeCards(30, { easeFactor: 2.0 }), 5, 30)).toBeGreaterThan(1)
  })
  it('produces varied samples for snake_case ease_factor cards', () => {
    expect(distinctSamples(makeCards(30, { ease_factor: 2.0 }), 5, 30)).toBeGreaterThan(1)
  })
  it('handles cards with no progress fields at all', () => {
    const bare = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}` }))
    // @ts-expect-error bare cards intentionally omit progress fields (generateMCQs output)
    expect(distinctSamples(bare, 5, 30)).toBeGreaterThan(1)
  })
  it('returns n unique cards', () => {
    const out = weightedSample(makeCards(30, { easeFactor: 2.5 }), 7)
    expect(out).toHaveLength(7)
    expect(new Set(out.map(c => c.id)).size).toBe(7)
  })
  it('returns a copy of all cards when n >= length', () => {
    const cards = makeCards(5, { easeFactor: 2.5 })
    const out = weightedSample(cards, 10)
    expect(out).toHaveLength(5)
    expect(out).not.toBe(cards)
  })
})
