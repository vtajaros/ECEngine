// electron/ipc/db.ipc.test.ts
// Tests the pure MCQ serialization logic extracted from exportToText.
// Zero IPC, zero filesystem, zero dialog calls.

import { describe, it, expect } from 'vitest'

import { serializeMcqCard } from './mcq.serializer'

const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

interface McqCardData {
    question?: unknown
    choices?: unknown
    answer?: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeData(overrides: Partial<McqCardData> = {}): string {
    return JSON.stringify({
        question: 'What is Ohm\'s Law?',
        choices: ['V = IR', 'P = IV', 'I = PR', 'V = P/I'],
        answer: 0,
        ...overrides,
    })
}

// ─── Choice count variants ────────────────────────────────────────────────────

describe('serializeMcqCard — choice count variants', () => {
    it('serializes a standard 4-choice card correctly', () => {
        const result = serializeMcqCard(makeData())
        expect(result).toBe(
            'Q: What is Ohm\'s Law?\nA: V = IR\nB: P = IV\nC: I = PR\nD: V = P/I\nANS: A'
        )
    })

    it('serializes a 3-choice card without a blank D line', () => {
        const result = serializeMcqCard(makeData({ choices: ['Alpha', 'Beta', 'Gamma'], answer: 2 }))
        expect(result).toBe('Q: What is Ohm\'s Law?\nA: Alpha\nB: Beta\nC: Gamma\nANS: C')
        expect(result).not.toContain('D:')
    })

    it('serializes a 5-choice card and includes E', () => {
        const result = serializeMcqCard(makeData({
            choices: ['A1', 'B1', 'C1', 'D1', 'E1'],
            answer: 4,
        }))
        expect(result).toContain('E: E1')
        expect(result).toContain('ANS: E')
    })

    it('serializes a 6-choice card and includes F', () => {
        const result = serializeMcqCard(makeData({
            choices: ['A1', 'B1', 'C1', 'D1', 'E1', 'F1'],
            answer: 5,
        }))
        expect(result).toContain('F: F1')
        expect(result).toContain('ANS: F')
    })
})

// ─── Answer key resolution ────────────────────────────────────────────────────

describe('serializeMcqCard — answer key resolution', () => {
    it('resolves numeric answer index 0 → A', () => {
        const result = serializeMcqCard(makeData({ answer: 0 }))
        expect(result).toContain('ANS: A')
    })

    it('resolves numeric answer index 3 → D', () => {
        const result = serializeMcqCard(makeData({ answer: 3 }))
        expect(result).toContain('ANS: D')
    })

    it('resolves string letter answer "B" directly', () => {
        const result = serializeMcqCard(makeData({ answer: 'B' }))
        expect(result).toContain('ANS: B')
    })

    it('resolves lowercase string letter "c" → C', () => {
        const result = serializeMcqCard(makeData({ answer: 'c' }))
        expect(result).toContain('ANS: C')
    })

    it('resolves string answer text via choices fallback match', () => {
        const result = serializeMcqCard(makeData({
            choices: ['V = IR', 'P = IV', 'I = PR', 'V = P/I'],
            answer: 'I = PR',
        }))
        expect(result).toContain('ANS: C')
    })

    it('falls back to A when answer text does not match any choice', () => {
        const result = serializeMcqCard(makeData({ answer: 'nonexistent answer' }))
        expect(result).toContain('ANS: A')
    })

    it('falls back to A when answer is out-of-bounds index', () => {
        const result = serializeMcqCard(makeData({ answer: 99 }))
        expect(result).toContain('ANS: A')
    })

    it('falls back to A when answer is null', () => {
        const result = serializeMcqCard(makeData({ answer: null }))
        expect(result).toContain('ANS: A')
    })
})

// ─── Guard / skip conditions ──────────────────────────────────────────────────

describe('serializeMcqCard — skip conditions', () => {
    it('returns null for empty string data', () => {
        expect(serializeMcqCard('')).toBeNull()
    })

    it('returns null for whitespace-only data', () => {
        expect(serializeMcqCard('   ')).toBeNull()
    })

    it('returns null for unparseable JSON', () => {
        expect(serializeMcqCard('NOT_VALID_JSON{{{')).toBeNull()
    })

    it('returns null when question is missing', () => {
        expect(serializeMcqCard(makeData({ question: '' }))).toBeNull()
    })

    it('returns null when question is whitespace only', () => {
        expect(serializeMcqCard(makeData({ question: '   ' }))).toBeNull()
    })

    it('returns null when choices array is empty', () => {
        expect(serializeMcqCard(makeData({ choices: [] }))).toBeNull()
    })

    it('returns null when choices is not an array', () => {
        expect(serializeMcqCard(makeData({ choices: 'not an array' as any }))).toBeNull()
    })

    it('returns null when parsed data is not an object', () => {
        expect(serializeMcqCard(JSON.stringify(42))).toBeNull()
    })

    it('handles null choice entries — coerces to empty string', () => {
        const result = serializeMcqCard(makeData({ choices: ['Valid', null, 'Also Valid', 'Last'] }))
        expect(result).toContain('B: ')
        expect(result).not.toBeNull()
    })
})

// ─── Output format ────────────────────────────────────────────────────────────

describe('serializeMcqCard — output format', () => {
    it('each block starts with Q:', () => {
        const result = serializeMcqCard(makeData())!
        expect(result.startsWith('Q:')).toBe(true)
    })

    it('last line of block is ANS:', () => {
        const result = serializeMcqCard(makeData())!
        const lines = result.split('\n')
        expect(lines[lines.length - 1].startsWith('ANS:')).toBe(true)
    })

    it('choice lines are contiguous between Q and ANS', () => {
        const result = serializeMcqCard(makeData())!
        const lines = result.split('\n')
        // lines[0] = Q, lines[1..n-1] = choices, lines[n] = ANS
        const choiceLines = lines.slice(1, -1)
        choiceLines.forEach((line, i) => {
            expect(line.startsWith(CHOICE_LETTERS[i] + ':')).toBe(true)
        })
    })
})