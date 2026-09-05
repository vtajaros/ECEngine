import { describe, it, expect } from 'vitest'
import { partitionCards } from './LearnMode'
import { Card } from '../../types'

function makeMockCards(count: number): Card[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `card-${i + 1}`,
    type: 'mcq',
    data: {
      question: `Question ${i + 1}`,
      choices: ['A', 'B', 'C', 'D'],
      answer: 0,
    },
  }))
}

describe('partitionCards', () => {
  it('returns empty array for empty input', () => {
    expect(partitionCards([])).toEqual([])
  })

  it('handles exact multiples of partition size (5, 10, 15)', () => {
    const cards5 = makeMockCards(5)
    const p5 = partitionCards(cards5, 5, 3)
    expect(p5).toHaveLength(1)
    expect(p5[0]).toHaveLength(5)

    const cards10 = makeMockCards(10)
    const p10 = partitionCards(cards10, 5, 3)
    expect(p10).toHaveLength(2)
    expect(p10[0]).toHaveLength(5)
    expect(p10[1]).toHaveLength(5)
  })

  it('merges 1 remainder card into the preceding partition (6 items -> 1 round of 6)', () => {
    const cards6 = makeMockCards(6)
    const p6 = partitionCards(cards6, 5, 3)
    expect(p6).toHaveLength(1)
    expect(p6[0]).toHaveLength(6)
    expect(p6[0].map(c => c.id)).toEqual(['card-1', 'card-2', 'card-3', 'card-4', 'card-5', 'card-6'])
  })

  it('merges 2 remainder cards into the preceding partition (7 items -> 1 round of 7)', () => {
    const cards7 = makeMockCards(7)
    const p7 = partitionCards(cards7, 5, 3)
    expect(p7).toHaveLength(1)
    expect(p7[0]).toHaveLength(7)
  })

  it('leaves 3 remainder cards as a standalone last round (8 items -> 5 and 3)', () => {
    const cards8 = makeMockCards(8)
    const p8 = partitionCards(cards8, 5, 3)
    expect(p8).toHaveLength(2)
    expect(p8[0]).toHaveLength(5)
    expect(p8[1]).toHaveLength(3)
  })

  it('leaves 4 remainder cards as a standalone last round (9 items -> 5 and 4)', () => {
    const cards9 = makeMockCards(9)
    const p9 = partitionCards(cards9, 5, 3)
    expect(p9).toHaveLength(2)
    expect(p9[0]).toHaveLength(5)
    expect(p9[1]).toHaveLength(4)
  })

  it('merges 1 remainder card on multi-round sets (11 items -> 5 and 6)', () => {
    const cards11 = makeMockCards(11)
    const p11 = partitionCards(cards11, 5, 3)
    expect(p11).toHaveLength(2)
    expect(p11[0]).toHaveLength(5)
    expect(p11[1]).toHaveLength(6)
  })

  it('merges 2 remainder cards on multi-round sets (12 items -> 5 and 7)', () => {
    const cards12 = makeMockCards(12)
    const p12 = partitionCards(cards12, 5, 3)
    expect(p12).toHaveLength(2)
    expect(p12[0]).toHaveLength(5)
    expect(p12[1]).toHaveLength(7)
  })

  it('merges 1 remainder card on larger sets (16 items -> 5, 5, 6)', () => {
    const cards16 = makeMockCards(16)
    const p16 = partitionCards(cards16, 5, 3)
    expect(p16).toHaveLength(3)
    expect(p16[0]).toHaveLength(5)
    expect(p16[1]).toHaveLength(5)
    expect(p16[2]).toHaveLength(6)
  })

  it('merges 2 remainder cards on larger sets (17 items -> 5, 5, 7)', () => {
    const cards17 = makeMockCards(17)
    const p17 = partitionCards(cards17, 5, 3)
    expect(p17).toHaveLength(3)
    expect(p17[0]).toHaveLength(5)
    expect(p17[1]).toHaveLength(5)
    expect(p17[2]).toHaveLength(7)
  })

  it('keeps single small decks as single partition without error', () => {
    const cards1 = makeMockCards(1)
    const p1 = partitionCards(cards1, 5, 3)
    expect(p1).toHaveLength(1)
    expect(p1[0]).toHaveLength(1)

    const cards2 = makeMockCards(2)
    const p2 = partitionCards(cards2, 5, 3)
    expect(p2).toHaveLength(1)
    expect(p2[0]).toHaveLength(2)
  })
})
