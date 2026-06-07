// src/lib/latex.test.ts
// Tests for pure LaTeX detection and scanning utilities.
// Expected values map to the pure functions in latex.ts.

import { describe, it, expect } from 'vitest'
import { isRawLatex, isPureMath, scanForDoubleEscapes } from './latex'

// ─── isRawLatex ─────────────────────────────────────────────────────────────

describe('isRawLatex', () => {
  it('empty string → false', () => {
    // Empty or falsy input is not LaTeX
    expect(isRawLatex('')).toBe(false)
  })

  it('plain English prose → false', () => {
    // Normal sentences without math symbols should not be parsed as LaTeX
    expect(isRawLatex('This is just a normal sentence.')).toBe(false)
  })

  it('\\frac{1}{2} → true', () => {
    // Contains known LaTeX command \frac
    expect(isRawLatex('\\frac{1}{2}')).toBe(true)
  })

  it('\\alpha → true', () => {
    // Contains known LaTeX command \alpha
    expect(isRawLatex('\\alpha')).toBe(true)
  })

  it('$x^2$ → true (contains $)', () => {
    // Explicit $ delimiters indicate LaTeX
    expect(isRawLatex('$x^2$')).toBe(true)
  })

  it('a^{2} → true (superscript with braces)', () => {
    // Explicit superscript with braces is recognized as LaTeX
    expect(isRawLatex('a^{2}')).toBe(true)
  })

  it('"The f_T of a BJT is the frequency" → false (prose guard: 4+ English words)', () => {
    // Contains a bare subscript (f_T) but the prose guard catches it because it has >= 4 words and spaces
    expect(isRawLatex('The f_T of a BJT is the frequency')).toBe(false)
  })

  it('a^2 → true (bare superscript)', () => {
    // Bare superscript without enough English prose triggers LaTeX mode
    expect(isRawLatex('a^2')).toBe(true)
  })

  it('starts with \\ → true', () => {
    // Any string starting with a backslash is treated as raw LaTeX
    expect(isRawLatex('\\unknowncommand')).toBe(true)
  })
})

// ─── isPureMath ─────────────────────────────────────────────────────────────

describe('isPureMath', () => {
  it('empty string → false', () => {
    // Falsy input is not pure math
    expect(isPureMath('')).toBe(false)
  })

  it('plain English → false', () => {
    // Prose is not pure math
    expect(isPureMath('This is a test sentence.')).toBe(false)
  })

  it('\\frac{1}{2} → true (no spaces, no $)', () => {
    // A single raw LaTeX command without spaces is pure math
    expect(isPureMath('\\frac{1}{2}')).toBe(true)
  })

  it('$\\frac{1}{2}$ → false (contains $)', () => {
    // Explicit $ delimiters mean it's mixed content, not pure display math
    expect(isPureMath('$\\frac{1}{2}$')).toBe(false)
  })

  it('I_{CEO}=\\alpha\\cdot I_{CBO} → false (has spaces after stripping, words present)', () => {
    // After stripping commands, it becomes "I_{CEO}= I_{CBO}"
    // It has spaces and >= 1 word ("CEO", "CBO"), so it falls back to inline math
    expect(isPureMath('I_{CEO}=\\alpha\\cdot I_{CBO}')).toBe(false)
  })
})

// ─── scanForDoubleEscapes ───────────────────────────────────────────────────

describe('scanForDoubleEscapes', () => {
  it('empty string → false', () => {
    // Falsy input
    expect(scanForDoubleEscapes('')).toBe(false)
  })

  it('\\\\\\frac → true', () => {
    // Matches \\\\ followed by a letter (f)
    expect(scanForDoubleEscapes('\\\\frac')).toBe(true)
  })

  it('\\frac → false', () => {
    // Single backslash doesn't trigger the double escape scanner
    expect(scanForDoubleEscapes('\\frac')).toBe(false)
  })

  it('hello world → false', () => {
    // No backslashes at all
    expect(scanForDoubleEscapes('hello world')).toBe(false)
  })
})
