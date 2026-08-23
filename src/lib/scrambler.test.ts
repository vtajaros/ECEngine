import { describe, it, expect } from 'vitest'
import { isSafeToShuffleChoices, shuffleChoices } from './scrambler'

describe('isSafeToShuffleChoices', () => {
  it('allows normal choices', () => {
    const choices = ['Resistor', 'Capacitor', 'Inductor', 'Diode']
    expect(isSafeToShuffleChoices(choices)).toBe(true)
  })

  it('blocks choices with positional references like "Both A and B"', () => {
    const choices = ['Option 1', 'Option 2', 'Both A and B', 'Neither']
    expect(isSafeToShuffleChoices(choices)).toBe(false)
  })

  it('blocks choices with positional references like "A and C"', () => {
    const choices = ['Option 1', 'Option 2', 'A and C', 'None']
    expect(isSafeToShuffleChoices(choices)).toBe(false)
  })

  it('allows absolute references like "All of the above" (since scrambler pins them)', () => {
    const choices = ['Option 1', 'Option 2', 'Option 3', 'All of the above']
    expect(isSafeToShuffleChoices(choices)).toBe(true)
  })
})

describe('shuffleChoices', () => {
  it('correctly remaps answer index when shuffling choices', () => {
    const choices = ['Apple', 'Banana', 'Cherry', 'Date']
    const answerIndex = 1 // 'Banana'
    const result = shuffleChoices(choices, answerIndex)

    expect(result.choices).toHaveLength(4)
    expect(result.choices).toContain('Apple')
    expect(result.choices).toContain('Banana')
    expect(result.choices).toContain('Cherry')
    expect(result.choices).toContain('Date')
    // The new answer index must point to 'Banana'
    expect(result.choices[result.answer]).toBe('Banana')
  })

  it('pins "All of the above" to the last position and remaps answer index', () => {
    const choices = ['Apple', 'All of the above', 'Banana', 'Cherry']
    const answerIndex = 1 // 'All of the above' is the answer
    const result = shuffleChoices(choices, answerIndex)

    expect(result.choices[3]).toBe('All of the above')
    expect(result.answer).toBe(3)
  })

  it('pins "None of the above" to the last position when another choice is the answer', () => {
    const choices = ['Apple', 'Banana', 'Cherry', 'None of the above']
    const answerIndex = 0 // 'Apple' is answer
    const result = shuffleChoices(choices, answerIndex)

    expect(result.choices[3]).toBe('None of the above')
    expect(result.choices[result.answer]).toBe('Apple')
  })

  it('correctly maps choicesPlainText flags when provided', () => {
    const choices = ['A', 'B', 'C', 'D']
    const choicesPlainText = [true, false, true, false]
    const answerIndex = 2 // 'C'
    const result = shuffleChoices(choices, answerIndex, choicesPlainText)

    expect(result.choices[result.answer]).toBe('C')
    expect(result.choicesPlainText).toBeDefined()
    const cIndex = result.choices.indexOf('C')
    expect(result.choicesPlainText![cIndex]).toBe(true)
  })
})
