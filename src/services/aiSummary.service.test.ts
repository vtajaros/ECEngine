import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockElectron = {
  summarizeDeck: vi.fn(),
}

;(global as any).window = { electron: mockElectron }

import { extractCardItems, generateDeckSummary } from './aiSummary.service'
import { EditCard } from '../components/deck/CardEditor'

describe('aiSummary.service', () => {
  describe('extractCardItems', () => {
    it('extracts non-empty MCQ cards including correct answer text', () => {
      const cards: EditCard[] = [
        {
          id: '1',
          type: 'mcq',
          data: {
            question: 'What is Ohm’s Law?',
            choices: ['V = IR', 'P = IV', 'V = I/R', 'I = VR'],
            answer: 0,
            explanation: 'V = I * R is Ohm’s Law.',
          },
        },
        {
          id: '2',
          type: 'mcq',
          data: {
            question: '',
            choices: ['', '', '', ''],
            answer: 0,
            explanation: '',
          },
        },
      ]

      const items = extractCardItems(cards)
      expect(items).toHaveLength(1)
      expect(items[0]).toBe('[MCQ] What is Ohm’s Law? (Answer: V = IR)')
    })

    it('extracts non-empty Flashcard and Formula cards', () => {
      const cards: EditCard[] = [
        {
          id: '1',
          type: 'flashcard',
          data: {
            front: 'Semiconductor',
            back: 'A material whose conductivity is between conductors and insulators.',
          },
        },
        {
          id: '2',
          type: 'formula',
          data: {
            name: 'Resonant Frequency',
            latex: 'f_0 = \\frac{1}{2\\pi\\sqrt{LC}}',
            description: 'Series RLC resonance frequency',
            variables: 'L=inductance, C=capacitance',
          },
        },
      ]

      const items = extractCardItems(cards)
      expect(items).toHaveLength(2)
      expect(items[0]).toBe('[Flashcard] Semiconductor: A material whose conductivity is between conductors and insulators.')
      expect(items[1]).toBe('[Formula] Resonant Frequency (f_0 = \\frac{1}{2\\pi\\sqrt{LC}}) - Series RLC resonance frequency')
    })
  })

  describe('generateDeckSummary', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('throws NO_CONTENT error if cards array is empty or contains only empty cards', async () => {
      await expect(
        generateDeckSummary({ title: 'Test', subject: 'MATH', cards: [] })
      ).rejects.toThrow('Please add cards with content to generate a summary.')
    })

    it('successfully calls summarizeDeck and returns the summary text', async () => {
      mockElectron.summarizeDeck.mockResolvedValueOnce({
        text: 'Covers fundamental DC circuit theorems, Ohm’s law, and Kirchhoff’s current and voltage laws.',
      })

      const cards: EditCard[] = [
        {
          id: '1',
          type: 'mcq',
          data: {
            question: 'State KCL',
            choices: ['Sum of currents is 0', 'Sum of voltages is 0', 'V=IR', 'P=VI'],
            answer: 0,
            explanation: '',
          },
        },
      ]

      const summary = await generateDeckSummary({
        title: 'Circuits 101',
        subject: 'Electronics Engineering',
        cards,
      })

      expect(mockElectron.summarizeDeck).toHaveBeenCalledWith({
        title: 'Circuits 101',
        subject: 'Electronics Engineering',
        cardItems: ['[MCQ] State KCL (Answer: Sum of currents is 0)'],
        totalCards: 1,
      })
      expect(summary).toBe('Covers fundamental DC circuit theorems, Ohm’s law, and Kirchhoff’s current and voltage laws.')
    })

    it('handles NO_KEY error with helpful message', async () => {
      mockElectron.summarizeDeck.mockResolvedValueOnce({
        error: 'NO_KEY',
      })

      const cards: EditCard[] = [
        {
          id: '1',
          type: 'flashcard',
          data: { front: 'Diode', back: 'Two-terminal electronic component' },
        },
      ]

      await expect(
        generateDeckSummary({ title: 'Diodes', cards })
      ).rejects.toThrow('Groq API key not configured. Add your key in Settings to enable AI generation.')
    })

    it('handles RATE_LIMITED error with friendly message', async () => {
      mockElectron.summarizeDeck.mockResolvedValueOnce({
        error: 'RATE_LIMITED',
      })

      const cards: EditCard[] = [
        {
          id: '1',
          type: 'flashcard',
          data: { front: 'Diode', back: 'Two-terminal electronic component' },
        },
      ]

      await expect(
        generateDeckSummary({ title: 'Diodes', cards })
      ).rejects.toThrow('Groq API rate limit reached. Please wait a moment and try again.')
    })
  })
})
