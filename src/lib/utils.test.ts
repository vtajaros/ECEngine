import { describe, it, expect } from 'vitest'
import { resolveCorrectChoiceIndex, shuffleArray, shouldStackChoices } from './utils'

describe('resolveCorrectChoiceIndex', () => {
  it('correctly resolves 0-based integer number index', () => {
    const choices = ['1', '2', '3', '4']
    // Option C (index 2, text '3') is correct
    expect(resolveCorrectChoiceIndex(2, choices)).toBe(2)
    // Option A (index 0, text '1') is correct
    expect(resolveCorrectChoiceIndex(0, choices)).toBe(0)
  })

  it('does NOT match choice text when choice text equals number string for another option', () => {
    const choices = ['1', '2', '3', '4']
    // When answer is 2 (index 2 = choice '3'), choice index 1 ('2') must NOT be returned!
    const correctIdx = resolveCorrectChoiceIndex(2, choices)
    expect(correctIdx).toBe(2)
    expect(choices[correctIdx]).toBe('3')
  })

  it('resolves numeric string index within bounds', () => {
    const choices = ['10 ohms', '20 ohms', '30 ohms', '40 ohms']
    expect(resolveCorrectChoiceIndex('1', choices)).toBe(1)
    expect(resolveCorrectChoiceIndex('3', choices)).toBe(3)
  })

  it('resolves single letter answers (case insensitive)', () => {
    const choices = ['North', 'South', 'East', 'West']
    expect(resolveCorrectChoiceIndex('A', choices)).toBe(0)
    expect(resolveCorrectChoiceIndex('b', choices)).toBe(1)
    expect(resolveCorrectChoiceIndex('C', choices)).toBe(2)
    expect(resolveCorrectChoiceIndex('d', choices)).toBe(3)
  })

  it('resolves text matching full choice value when not an index or letter', () => {
    const choices = ['Capacitor', 'Inductor', 'Resistor', 'Diode']
    expect(resolveCorrectChoiceIndex('Resistor', choices)).toBe(2)
    expect(resolveCorrectChoiceIndex('capacitor', choices)).toBe(0)
  })

  it('returns -1 for invalid, null, undefined, or empty answers', () => {
    const choices = ['A', 'B', 'C', 'D']
    expect(resolveCorrectChoiceIndex(undefined, choices)).toBe(-1)
    expect(resolveCorrectChoiceIndex(null, choices)).toBe(-1)
    expect(resolveCorrectChoiceIndex('', choices)).toBe(-1)
    expect(resolveCorrectChoiceIndex(-1, choices)).toBe(-1)
    expect(resolveCorrectChoiceIndex(4, choices)).toBe(-1) // out of bounds
    expect(resolveCorrectChoiceIndex('Z', choices)).toBe(-1) // out of bounds
    expect(resolveCorrectChoiceIndex('Nonexistent', choices)).toBe(-1)
  })
})

describe('shuffleArray', () => {
  it('returns a new array with the same items', () => {
    const input = [1, 2, 3, 4, 5]
    const output = shuffleArray(input)
    expect(output).toHaveLength(5)
    expect(output.sort()).toEqual(input.sort())
    expect(output).not.toBe(input)
  })
})

describe('shouldStackChoices', () => {
  it('returns false for null, undefined, or empty choices', () => {
    expect(shouldStackChoices(null)).toBe(false)
    expect(shouldStackChoices(undefined)).toBe(false)
    expect(shouldStackChoices([])).toBe(false)
  })

  it('returns false for short, simple choice strings', () => {
    const shortChoices = ['10 V', '20 V', '30 V', '40 V']
    expect(shouldStackChoices(shortChoices)).toBe(false)
  })

  it('returns true if any choice exceeds default 45 characters', () => {
    const choices = [
      'Short choice A',
      'The output voltage of an ideal operational amplifier with negative feedback', // 75 chars
      'Short choice C',
      'Short choice D',
    ]
    expect(shouldStackChoices(choices)).toBe(true)
  })

  it('respects custom maxCharLength threshold', () => {
    const choices = ['12345678901', '1234', '5678', '9012'] // length 11
    expect(shouldStackChoices(choices, 10)).toBe(true)
    expect(shouldStackChoices(choices, 15)).toBe(false)
  })

  it('returns true if any choice contains newline characters', () => {
    const choices = [
      'Line 1\nLine 2',
      'Choice B',
      'Choice C',
      'Choice D',
    ]
    expect(shouldStackChoices(choices)).toBe(true)
  })

  it('returns true if any choice contains <br> tags', () => {
    const choices = [
      'Choice A',
      'Choice B<br/>with break',
      'Choice C',
      'Choice D',
    ]
    expect(shouldStackChoices(choices)).toBe(true)
  })

  it('returns true if any choice contains complex math or LaTeX structures', () => {
    expect(shouldStackChoices(['$\\frac{1}{2\\pi \\sqrt{LC}}$', '20 Hz', '10 kHz', '1 MHz'])).toBe(true)
    expect(shouldStackChoices(['Choice A', '$\\int_{0}^{\\infty} e^{-x} dx$', 'Choice C', 'Choice D'])).toBe(true)
    expect(shouldStackChoices(['$\\begin{matrix} 1 & 0 \\\\ 0 & 1 \\end{matrix}$', 'B', 'C', 'D'])).toBe(true)
    expect(shouldStackChoices(['Choice A', 'Choice B', '$\\sqrt{x^2 + y^2}$', 'Choice D'])).toBe(true)
  })

  it('returns false for simple inline math that does not require vertical stacking', () => {
    const simpleMath = ['$x = 5$', '$y = 10$', '$z = 15$', '$w = 20$']
    expect(shouldStackChoices(simpleMath)).toBe(false)
  })
})

