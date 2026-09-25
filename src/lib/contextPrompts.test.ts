import { describe, it, expect } from 'vitest'
import {
  buildTextExplanationPrompt,
  buildVisualBreakdownPrompt,
  PromptContextData,
} from './contextPrompts'

describe('contextPrompts', () => {
  const sampleMcq: PromptContextData = {
    question: 'What is the characteristic impedance of a distortionless line?',
    choices: ['sqrt(L/C)', 'sqrt(R/G)', 'sqrt(LC)', 'R/G'],
    answer: 0,
    subject: 'EST',
    tosTopicId: 'EST-1.1',
    deckName: 'Transmission Lines 101',
    cardNumber: 14,
    totalInDeck: 50,
    image: 'tline_schematic.png',
  }

  const sampleFlashcard: PromptContextData = {
    front: 'Barkhausen Criterion',
    back: 'Loop gain |Aβ| = 1 and net phase shift = 0° or 360° for sustained oscillation.',
    subject: 'ELECS',
    deckName: 'Oscillators & Timers',
  }

  describe('buildTextExplanationPrompt', () => {
    it('formats MCQ context with choices, correct answer, and metadata', () => {
      const prompt = buildTextExplanationPrompt(sampleMcq)

      expect(prompt).toContain('SUBJECT: EST')
      expect(prompt).toContain('DECK: Transmission Lines 101 (Card #14 of 50)')
      expect(prompt).toContain('QUESTION:\nWhat is the characteristic impedance of a distortionless line?')
      expect(prompt).toContain('A. sqrt(L/C)')
      expect(prompt).toContain('B. sqrt(R/G)')
      expect(prompt).toContain('CORRECT ANSWER: A. sqrt(L/C)')
      expect(prompt).toContain('IMAGE NOTE: This card references visual diagram(s) [Question Image: tline_schematic.png]')
      expect(prompt).toContain('1. Why the correct answer is right')
      expect(prompt).toContain('2. Why each of the other choices is wrong')
    })

    it('formats Flashcard context with front, back, and memory tips', () => {
      const prompt = buildTextExplanationPrompt(sampleFlashcard)

      expect(prompt).toContain('SUBJECT: ELECS')
      expect(prompt).toContain('FRONT (TERM / QUESTION):\nBarkhausen Criterion')
      expect(prompt).toContain('BACK (DEFINITION / ANSWER):\nLoop gain |Aβ| = 1')
      expect(prompt).toContain('1. A clear technical explanation and physical intuition')
    })
  })

  describe('buildVisualBreakdownPrompt', () => {
    it('formats MCQ visual breakdown with diagrams, mental model, and image gen prompt', () => {
      const prompt = buildVisualBreakdownPrompt(sampleMcq)

      expect(prompt).toContain('SUBJECT: EST')
      expect(prompt).toContain('Context: PRC Electronics Engineering (ECE) Licensure Examination review')
      expect(prompt).toContain('QUESTION:\nWhat is the characteristic impedance of a distortionless line?')
      expect(prompt).toContain('IMAGE NOTE: This card references visual diagram(s) [Question Image: tline_schematic.png]')
      expect(prompt).toContain('1. 🧠 MENTAL MODEL & VISUAL INTUITION')
      expect(prompt).toContain('2. 📐 TECHNICAL DIAGRAM / SCHEMATIC CODE')
      expect(prompt).toContain('3. 🎨 IMAGE GENERATION PROMPT')
      expect(prompt).toContain('4. ⚡ EXAM QUICK-IDENTIFICATION TIP')
    })

    it('formats Flashcard visual breakdown correctly', () => {
      const prompt = buildVisualBreakdownPrompt(sampleFlashcard)

      expect(prompt).toContain('FRONT (TERM / CONCEPT):\nBarkhausen Criterion')
      expect(prompt).toContain('BACK (DEFINITION / ANSWER):\nLoop gain |Aβ| = 1')
      expect(prompt).toContain('1. 🧠 MENTAL MODEL & VISUAL INTUITION')
      expect(prompt).toContain('2. 📐 TECHNICAL DIAGRAM / SCHEMATIC CODE')
    })

    it('safely handles empty/missing optional fields', () => {
      const minimalPrompt = buildVisualBreakdownPrompt({
        question: 'Sample minimal question?',
        choices: ['A', 'B'],
        answer: 1,
      })

      expect(minimalPrompt).toContain('QUESTION:\nSample minimal question?')
      expect(minimalPrompt).toContain('CORRECT ANSWER: B. B')
      expect(minimalPrompt).not.toContain('IMAGE NOTE')
      expect(minimalPrompt).not.toContain('SUBJECT:')
    })
  })
})
