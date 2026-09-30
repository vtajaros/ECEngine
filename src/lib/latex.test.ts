// src/lib/latex.test.ts
// Tests for pure LaTeX detection and scanning utilities.
// Expected values map to the pure functions in latex.ts.

import { describe, it, expect } from 'vitest'
import {
  isRawLatex,
  isPureMath,
  scanForDoubleEscapes,
  formatQuestionPreview,
  renderQuestionPreview,
  normalizeLatexSubscriptsAndSuperscripts,
} from './latex'

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

// ─── renderMath ─────────────────────────────────────────────────────────────

import { renderMath } from './latex'

describe('renderMath', () => {
  it('renders question prose with superscripts without equation italics on text', () => {
    const q16 = 'Given z = 3 + 3i. Find z^4.'
    const html = renderMath(q16)
    expect(html).toContain('Given z = 3 + 3i. Find z<sup>4</sup>.')
    expect(html).not.toContain('katex')
  })

  it('renders questions with multiple algebraic terms as formatted text', () => {
    const q24 = 'If Z1 = 1 - i and Z2 = -2 + 4i, evaluate Z1^2 + 2Z1 - 3.'
    const html = renderMath(q24)
    expect(html).toContain('evaluate Z1<sup>2</sup> + 2Z1 - 3.')
    expect(html).not.toContain('katex')
  })

  it('renders equation solve question without merging words', () => {
    const q25 = 'Solve the equation z^2 + (2i - 3)z + 5 - i = 0.'
    const html = renderMath(q25)
    expect(html).toContain('Solve the equation z<sup>2</sup> + (2i - 3)z + 5 - i = 0.')
    expect(html).not.toContain('katex')
  })

  it('renders embedded un-delimited LaTeX commands while keeping prose as text', () => {
    const q17 = 'If z = sqrt(2x^2y^-3), find \\partial z / \\partial y.'
    const html = renderMath(q17)
    expect(html).toContain('If z = sqrt(2x<sup>2</sup>y<sup>-3</sup>), find')
    expect(html).toContain('katex')
  })

  it('renders pure LaTeX formulas with KaTeX', () => {
    const formula = '\\frac{1}{2}'
    const html = renderMath(formula)
    expect(html).toContain('katex')
  })

  it('renders questions with currency dollar signs without mistaking them for LaTeX delimiters', () => {
    const q54 = 'An electronics firm is deciding whether to continue R&D on a prototype. The potential benefits are $500,000, but the R&D cost already spent is $150,000. The $150,000 is considered:'
    const html = renderMath(q54)
    expect(html).toContain('$500,000')
    expect(html).toContain('$150,000')
    expect(html).toContain('R&amp;D')
    expect(html).not.toContain('katex-error')
    expect(html).not.toContain('color:#cc0000')
  })

  it('renders mixed currency and LaTeX math formulas correctly', () => {
    const q = 'If initial cost is $25,000 and value is given by $V(t) = 25000e^{-0.1t}$, calculate value at t = 5.'
    const html = renderMath(q)
    expect(html).toContain('$25,000')
    expect(html).toContain('katex')
    expect(html).not.toContain('katex-error')
  })

  it('handles escaped dollar signs cleanly', () => {
    const q = 'The price was \\$50 before discount.'
    const html = renderMath(q)
    expect(html).toContain('The price was $50 before discount.')
    expect(html).not.toContain('katex')
  })

  it('renders AI explanation with formulas and numbers correctly', () => {
    const input = `Explanation: B. $5.57 \\times 10^{-13}\\text{ m}$ is correct because the photon must provide at least the deuteron binding energy of $2.23\\ \\text{MeV}$, and inserting this energy into $E=\\frac{hc}{\\lambda}$ yields that wavelength.`
    const html = renderMath(input)
    expect(html).not.toContain('andinsertingthisenergyinto')
    expect(html).toContain('katex')
  })

  it('renders AI explanation memory tip with mixed LaTeX and bare commands', () => {
    const input = `Memory Tip: *Bind-Energy -> \\lambda = hc/E; higher E means shorter \\lambda, so plug 2.23 MeV to get $5.57\\times10^{-13}$ m.*`
    const html = renderMath(input)
    expect(html).toContain('katex')
  })

  it('renders AI explanation with delimited numbers without red errors or broken delimiters', () => {
    const p1 = 'B. 32 is correct because every instruction in this fixed-length RISC ISA occupies $32$ bits, so any mixture of instruction types yields an average of $32$ bits.'
    const html1 = renderMath(p1)
    expect(html1).not.toContain('katex-error')
    expect(html1).not.toContain('color:#cc0000')
    expect(html1).toContain('katex')

    const p2 = '3. Immediate instructions: opcode + $16$-bit immediate = $32$ bits'
    const html2 = renderMath(p2)
    expect(html2).not.toContain('katex-error')
    expect(html2).not.toContain('color:#cc0000')
    expect(html2).toContain('katex')

    const p3 = 'Since each class is $32$ bits, the weighted average = $0.2\\! \\times \\! 32 + 0.5\\! \\times \\! 32 + 0.3\\! \\times \\! 32 = 32$ bits.'
    const html3 = renderMath(p3)
    expect(html3).not.toContain('katex-error')
    expect(html3).not.toContain('color:#cc0000')
    expect(html3).toContain('katex')
  })

  it('gracefully handles malformed LaTeX expressions without red error markup', () => {
    const broken = 'The value is $\\unknownMacro{abc} + $32$ and done.'
    const html = renderMath(broken)
    expect(html).not.toContain('katex-error')
    expect(html).not.toContain('color:#cc0000')
  })

  it('correctly normalizes and renders long multi-character subscripts in equations', () => {
    const equation = '1. \\Delta H = H_products - H_reactants < 0.'
    const html = renderMath(equation)
    expect(html).toContain('<sub>products</sub>')
    expect(html).toContain('<sub>reactants</sub>')

    const delimited = '1. $$\\Delta H = H_products - H_reactants < 0.$$'
    const htmlDelimited = renderMath(delimited)
    expect(htmlDelimited).toContain('katex')
    expect(htmlDelimited).not.toContain('katex-error')
  })
})

describe('normalizeLatexSubscriptsAndSuperscripts', () => {
  it('auto-braces unbraced multi-character subscripts and superscripts', () => {
    expect(normalizeLatexSubscriptsAndSuperscripts('H_products - H_reactants')).toBe('H_{products} - H_{reactants}')
    expect(normalizeLatexSubscriptsAndSuperscripts('V_gs + I_out')).toBe('V_{gs} + I_{out}')
    expect(normalizeLatexSubscriptsAndSuperscripts('x^10 + r^max')).toBe('x^{10} + r^{max}')
  })

  it('preserves single-character, already-braced, or command subscripts', () => {
    expect(normalizeLatexSubscriptsAndSuperscripts('H_p - H_r')).toBe('H_p - H_r')
    expect(normalizeLatexSubscriptsAndSuperscripts('H_{products}')).toBe('H_{products}')
    expect(normalizeLatexSubscriptsAndSuperscripts('x_\\frac{1}{2}')).toBe('x_\\frac{1}{2}')
  })
})

describe('formatQuestionPreview & renderQuestionPreview', () => {
  it('collapses multi-line questions with linebreaks into a clean single line', () => {
    const raw = 'Assertion (A): A VMOSFET does not...\n\nReason (R): In a VMOSFET...'
    const formatted = formatQuestionPreview(raw)
    expect(formatted).toBe('Assertion (A): A VMOSFET does not... Reason (R): In a VMOSFET...')

    const html = renderQuestionPreview(raw)
    expect(html).not.toContain('<br>')
    expect(html).not.toContain('\n')
  })

  it('renders inline math and preserves KaTeX symbols without block breaks', () => {
    const raw = 'Consider the following statement S1 and S2.\n\nS1: The \\beta of a transistor.\nS2: The \\alpha of a transistor.'
    const formatted = formatQuestionPreview(raw)
    expect(formatted).toBe('Consider the following statement S1 and S2. S1: The \\beta of a transistor. S2: The \\alpha of a transistor.')

    const html = renderQuestionPreview(raw)
    expect(html).not.toContain('<br>')
    expect(html).toContain('katex')
  })

  it('flattens HTML tags and display math delimiters', () => {
    const raw = '<p>Intro paragraph</p><br><div>$$\\sum_{i=1}^n x_i$$</div>'
    const formatted = formatQuestionPreview(raw)
    expect(formatted).toBe('Intro paragraph $\\sum_{i=1}^n x_i$')
  })
})

