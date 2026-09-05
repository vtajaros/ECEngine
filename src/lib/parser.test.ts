import { describe, it, expect } from 'vitest'
import { parseImportedMCQs, parseImportedFlashcards, parseQuizletText, parseQuizletMCQ } from './parser'

describe('parseImportedMCQs', () => {
  it('parses valid MCQs and generates no warnings', () => {
    const text = `Q: What is the capital of France?
A: Berlin
B: Madrid
C: Paris
D: Rome
ANS: C

Q: What is 2 + 2?
A: 3
B: 4
C: 5
D: 6
ANS: B`

    const { cards, warnings } = parseImportedMCQs(text)
    expect(warnings).toHaveLength(0)
    expect(cards).toHaveLength(2)
    expect(cards[0].question).toBe('What is the capital of France?')
    expect(cards[0].choices).toEqual(['Berlin', 'Madrid', 'Paris', 'Rome'])
    expect(cards[0].answer).toBe(2)
  })

  it('accepts answers with trailing annotations like D [?], (C), B.', () => {
    const text = `Q: Question 1
A: Option 1
B: Option 2
C: Option 3
D: Option 4
ANS: D [?]

Q: Question 2
A: Option A
B: Option B
C: Option C
D: Option D
ANS: (B)`

    const { cards, warnings } = parseImportedMCQs(text)
    expect(warnings).toHaveLength(0)
    expect(cards).toHaveLength(2)
    expect(cards[0].answer).toBe(3)
    expect(cards[1].answer).toBe(1)
  })

  it('detects invalid ANS and includes exact line number in warning', () => {
    const text = `Q: Question 1
A: Option 1
B: Option 2
C: Option 3
D: Option 4
ANS: A

Q: Question 2 with invalid answer
A: Option A
B: Option B
C: Option C
D: Option D
ANS: Unknown`

    const { cards, warnings } = parseImportedMCQs(text)
    expect(cards).toHaveLength(1)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Block 2 (Line 13): ANS must be A–E. Got: Unknown')
  })

  it('handles multi-line questions and reports correct line numbers across blank lines', () => {
    const text = `Q: First line of question 1
second line of question 1
third line of question 1
A: Alpha
B: Beta
C: Gamma
D: Delta
ANS: A


Q: Question 2
A: Choice 1
B: Choice 2
ANS: Z`

    const { cards, warnings } = parseImportedMCQs(text)
    expect(cards).toHaveLength(1)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Block 2 (Line 14): ANS must be A–E. Got: Z')
  })

  it('reports missing ANS field with block start line', () => {
    const text = `Q: Question 1
A: Option A
B: Option B
C: Option C
D: Option D`

    const { cards, warnings } = parseImportedMCQs(text)
    expect(cards).toHaveLength(0)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Block 1 (Line 1): Missing ANS: field')
  })

  it('reports missing choice lines with block start line', () => {
    const text = `Q: Question 1
ANS: A`

    const { cards, warnings } = parseImportedMCQs(text)
    expect(cards).toHaveLength(0)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Block 1 (Line 1): No choice lines (A:/B:/…) found')
  })
})

describe('parseImportedFlashcards', () => {
  it('parses valid flashcards with no warnings', () => {
    const text = `Q: Resistor
A: Limits current flow

Q: Capacitor
A: Stores electrical energy`

    const { cards, warnings } = parseImportedFlashcards(text)
    expect(warnings).toHaveLength(0)
    expect(cards).toHaveLength(2)
    expect(cards[0].front).toBe('Resistor')
    expect(cards[0].back).toBe('Limits current flow')
  })

  it('reports line numbers for missing fields in flashcards', () => {
    const text = `Q: Term only

Q: Another term
A: Another definition`

    const { cards, warnings } = parseImportedFlashcards(text)
    expect(cards).toHaveLength(1)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Block 1 (Line 1): Missing A: field')
  })
})
