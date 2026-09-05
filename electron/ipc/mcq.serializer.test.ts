// electron/ipc/mcq.serializer.test.ts
// Tests the pure MCQ serialization logic.
// Zero IPC, zero filesystem, zero dialog calls.

import { describe, it, expect } from 'vitest'
import { serializeMcqCard } from './mcq.serializer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeData(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
        question: "What is Ohm's Law?",
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
            "Q: What is Ohm's Law?\nA: V = IR\nB: P = IV\nC: I = PR\nD: V = P/I\nANS: A"
        )
    })

    it('serializes a 3-choice card without a blank D line', () => {
        const result = serializeMcqCard(makeData({ choices: ['Alpha', 'Beta', 'Gamma'], answer: 2 }))
        expect(result).toBe("Q: What is Ohm's Law?\nA: Alpha\nB: Beta\nC: Gamma\nANS: C")
        expect(result).not.toContain('D:')
    })

    it('serializes a 5-choice card and includes E', () => {
        const result = serializeMcqCard(makeData({ choices: ['A1', 'B1', 'C1', 'D1', 'E1'], answer: 4 }))
        expect(result).toContain('E: E1')
        expect(result).toContain('ANS: E')
    })

    it('serializes a 6-choice card and includes F', () => {
        const result = serializeMcqCard(makeData({ choices: ['A1', 'B1', 'C1', 'D1', 'E1', 'F1'], answer: 5 }))
        expect(result).toContain('F: F1')
        expect(result).toContain('ANS: F')
    })
})

// ─── Answer key resolution ────────────────────────────────────────────────────

describe('serializeMcqCard — answer key resolution', () => {
    it('resolves numeric index 0 → A', () => {
        expect(serializeMcqCard(makeData({ answer: 0 }))).toContain('ANS: A')
    })

    it('resolves numeric index 3 → D', () => {
        expect(serializeMcqCard(makeData({ answer: 3 }))).toContain('ANS: D')
    })

    it('resolves string letter "B" directly', () => {
        expect(serializeMcqCard(makeData({ answer: 'B' }))).toContain('ANS: B')
    })

    it('resolves lowercase "c" → C', () => {
        expect(serializeMcqCard(makeData({ answer: 'c' }))).toContain('ANS: C')
    })

    it('resolves string letter "E" — was broken before fix (hardcoded A–D check)', () => {
        const result = serializeMcqCard(
            makeData({ choices: ['A1', 'B1', 'C1', 'D1', 'E1'], answer: 'E' })
        )
        expect(result).toContain('ANS: E')
    })

    it('resolves answer text via choices fallback match', () => {
        const result = serializeMcqCard(
            makeData({ choices: ['V = IR', 'P = IV', 'I = PR', 'V = P/I'], answer: 'I = PR' })
        )
        expect(result).toContain('ANS: C')
    })

    it('falls back to A when answer text matches no choice', () => {
        expect(serializeMcqCard(makeData({ answer: 'nonexistent' }))).toContain('ANS: A')
    })

    it('falls back to A when answer is out-of-bounds index', () => {
        expect(serializeMcqCard(makeData({ answer: 99 }))).toContain('ANS: A')
    })

    it('falls back to A when answer is null', () => {
        expect(serializeMcqCard(makeData({ answer: null }))).toContain('ANS: A')
    })
})

// ─── Skip / null conditions ───────────────────────────────────────────────────

describe('serializeMcqCard — skip conditions', () => {
    it('returns null for empty string', () => {
        expect(serializeMcqCard('')).toBeNull()
    })

    it('returns null for whitespace-only string', () => {
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
        expect(serializeMcqCard(makeData({ choices: 'not an array' }))).toBeNull()
    })

    it('returns null when parsed value is not an object', () => {
        expect(serializeMcqCard(JSON.stringify(42))).toBeNull()
    })

    it('coerces null choice entries to empty string rather than throwing', () => {
        const result = serializeMcqCard(makeData({ choices: ['Valid', null, 'Also Valid', 'Last'] }))
        expect(result).not.toBeNull()
        expect(result).toContain('B: ')
    })
})

// ─── Output format ────────────────────────────────────────────────────────────

describe('serializeMcqCard — output format', () => {
    it('block starts with Q:', () => {
        expect(serializeMcqCard(makeData())!.startsWith('Q:')).toBe(true)
    })

    it('last line is ANS:', () => {
        const lines = serializeMcqCard(makeData())!.split('\n')
        expect(lines.at(-1)!.startsWith('ANS:')).toBe(true)
    })

    it('choice lines are contiguous between Q and ANS with correct letters', () => {
        const lines = serializeMcqCard(makeData())!.split('\n')
        const choiceLines = lines.slice(1, -1)
        const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
        choiceLines.forEach((line, i) => {
            expect(line.startsWith(CHOICE_LETTERS[i] + ':')).toBe(true)
        })
    })
})