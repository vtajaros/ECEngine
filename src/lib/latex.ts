import katex from 'katex'
import DOMPurify from 'dompurify'

const LATEX_COMMANDS = [
  '\\frac', '\\sqrt', '\\sum', '\\int', '\\lim',
  '\\log', '\\sin', '\\cos', '\\tan', '\\cot', '\\sec', '\\csc',
  '\\arcsin', '\\arccos', '\\arctan',
  '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\varepsilon',
  '\\zeta', '\\eta', '\\theta', '\\vartheta', '\\iota', '\\kappa',
  '\\lambda', '\\mu', '\\nu', '\\xi', '\\pi', '\\varpi',
  '\\rho', '\\varrho', '\\sigma', '\\varsigma', '\\tau', '\\upsilon',
  '\\phi', '\\varphi', '\\chi', '\\psi', '\\omega',
  '\\Gamma', '\\Delta', '\\Theta', '\\Lambda', '\\Xi', '\\Pi',
  '\\Sigma', '\\Upsilon', '\\Phi', '\\Psi', '\\Omega',
  '\\infty', '\\pm', '\\mp', '\\cdot', '\\times', '\\div',
  '\\leq', '\\geq', '\\neq', '\\approx', '\\equiv', '\\sim',
  '\\left', '\\right', '\\forall', '\\exists', '\\in', '\\notin',
  '\\subset', '\\supset', '\\subseteq', '\\supseteq',
  '\\cup', '\\cap', '\\vec', '\\hat', '\\bar', '\\dot', '\\ddot',
  '\\partial', '\\nabla', '\\mathrm', '\\mathbf', '\\mathit', '\\text',
  '\\vert', '\\Vert', '\\langle', '\\rangle',
  '\\larr', '\\rarr', '\\lArr', '\\rArr',
  '\\to', '\\Rightarrow', '\\Leftarrow', '\\Leftrightarrow',
  '\\prod', '\\coprod', '\\oint', '\\iint', '\\iiint',
  '\\overline', '\\underline', '\\overbrace', '\\underbrace',
  '\\binom', '\\choose', '\\begin', '\\end', '\\matrix', '\\pmatrix',
  '\\placeholder', '\\cdots', '\\ldots', '\\vdots', '\\ddots',
  '\\hline', '\\circ', '\\bullet', '\\star', '\\degree',
  '\\phase', '\\SI', '\\unit', '\\ang', '\\boldsymbol'
]

// Detects if text contains LaTeX that needs rendering:
// - backslash commands (\frac, etc.)
// - superscripts (a^b) or subscripts (a_b) using curly braces
// - curly brace grouping that implies structure
// - dollar sign delimiters
export const isRawLatex = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false
  // Contains known backslash commands
  if (LATEX_COMMANDS.some(cmd => text.includes(cmd))) return true
  // Starts with backslash (raw command)
  if (text.startsWith('\\')) return true
  // Contains $ delimiters
  if (text.includes('$')) return true
  // Superscripts or subscripts with braces: a^{...} or a_{...}
  if (/[\^_]\{/.test(text)) return true
  // Bare superscripts or subscripts
  const hasBareNotation = /\^\w/.test(text) || /(?<!^|[_])_(?![_])[a-zA-Z0-9{]/.test(text)
  if (hasBareNotation) {
    // Prose guard: if text contains 4+ English words separated by spaces, it's likely prose
    // with incidental notation (e.g. "The f_T of a BJT is..."), not a pure math expression.
    let stripped = text.replace(/\\(text|mathrm|textbf|textit)\{[^}]*\}/g, '')
    stripped = stripped.replace(/\\[a-zA-Z]+/g, '')
    const words = stripped.match(/\b[a-zA-Z]{2,}\b/g) || []
    if (words.length >= 4 && /\s/.test(stripped)) {
      return false
    }
    return true
  }
  return false
}

// Determines if a string is almost entirely math (no regular English sentences)
export const isPureMath = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false
  if (!isRawLatex(text)) return false
  if (text.includes('$')) return false // Mixed with text if $ is used

  let stripped = text.replace(/\\(text|mathrm|textbf|textit)\{[^}]*\}/g, '')
  stripped = stripped.replace(/\\[a-zA-Z]+/g, '')
  const words = stripped.match(/\b[a-zA-Z]{2,}\b/g) || []
  const hasSpace = /\s/.test(stripped)
  const isText = hasSpace && words.length > 0

  return !isText
}

// Renders a single segment of text that has no $ delimiters.
// Since users who use $ are explicitly opting into delimiters, we should
// NOT aggressively auto-detect raw latex in mixed contexts.
function renderSegment(segment: string): string {
  return segment.replace(/\n/g, '<br>')
}

// Use DOMPurify's built-in profiles: html + svg + svgFilters.
// KaTeX renders \sqrt and other symbols using complex SVG paths and clip-paths
// that a manual allowlist will silently strip. The profiles approach keeps
// full XSS protection while allowing all valid KaTeX SVG output.
const PURIFY_OPTS_FULL = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true }
}

/**
 * Applies Markdown-style inline formatting markers to HTML.
 * Called on plain-text segments ONLY — never passed into KaTeX.
 * Order: bold before italic to prevent partial marker matches.
 *
 *   **text**  →  <strong>text</strong>
 *   *text*    →  <em>text</em>
 *   __text__  →  <u>text</u>
 */
function applyInlineFormatting(text: string): string {
  let result = text
    .replace(/\*\*(.*?)\*\*/gs, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/gs, '<em>$1</em>')
    .replace(/__(.*?)__/gs, '<u>$1</u>')

  // Superscript: ^{multi} or ^x (single non-space char)
  result = result.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')
  result = result.replace(/\^([^\s{])/g, '<sup>$1</sup>')

  // Subscript: _{multi} or _x (single non-space char)
  result = result.replace(/\_\{([^}]+)\}/g, '<sub>$1</sub>')
  result = result.replace(/(?<!\*\*?)_(?!\*\*?)([^\s_{])/g, '<sub>$1</sub>')

  return result
}

/**
 * Render inline LaTeX math expressions within text.
 * Handles three cases:
 *   Path A — pure raw LaTeX (no $ delimiters): render entire string as display math.
 *   Path B — $ / $$ delimited content: split and render each block.
 *   Path C — mixed content (raw LaTeX commands AND $ delimiters): split on
 *            delimiter boundaries, render each segment individually, then rejoin.
 *
 * @param text - Raw text potentially containing LaTeX expressions
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export const renderMath = (text: string): string => {
  if (!text || typeof text !== 'string') return ''

  // ── Normalize non-standard / MathJax-only commands to KaTeX equivalents ──
  // These commands are valid MathJax/ISO-80000-2 but undefined in KaTeX,
  // causing KaTeX to render them in red as unknown commands.
  const normalized = text
    .replace(/\\exponentialE\b/g, 'e')           // Euler's number e
    .replace(/\\imaginaryI\b/g, 'i')             // imaginary unit i
    .replace(/\\imaginaryJ\b/g, 'j')             // imaginary unit j (engineering)
    .replace(/\\differentialD\b/g, 'd')          // differential d
    .replace(/\\capitalDifferentialD\b/g, 'D')   // D operator
    .replace(/\\DoubleStruckCapitalE\b/g, '\\mathbb{E}') // Expected value E
    .replace(/\\DoubleStruckCapitalN\b/g, '\\mathbb{N}') // Natural numbers
    .replace(/\\DoubleStruckCapitalR\b/g, '\\mathbb{R}') // Reals
    .replace(/\\DoubleStruckCapitalZ\b/g, '\\mathbb{Z}') // Integers
    .replace(/\\DoubleStruckCapitalC\b/g, '\\mathbb{C}') // Complex numbers
    // ECE-specific command normalization
    .replace(/\\phase\{([^}]+)\}/g, '\\angle $1')
    .replace(/\\SI\{([^}]+)\}\{([^}]+)\}/g, '$1\\,\\text{$2}')
    .replace(/\\unit\{([^}]+)\}/g, '\\text{$1}')
    .replace(/\\ang\{([^}]+)\}/g, '$1^{\\circ}')
    .replace(/\\boldsymbol\{([^}]+)\}/g, '\\mathbf{$1}')

  const hasDollar = normalized.includes('$')
  const hasRaw = isRawLatex(normalized)
  const t = normalized  // use normalized text from here on


  // ── Path C: mixed content — raw LaTeX commands AND $ delimiters present ──
  if (hasRaw && hasDollar) {
    const segments: string[] = []
    // Important: match $$ BEFORE $ to avoid consuming the first $ of a $$ pair
    const delimRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = delimRegex.exec(t)) !== null) {
      // Text before this delimiter block
      if (match.index > lastIndex) {
        segments.push(applyInlineFormatting(renderSegment(t.slice(lastIndex, match.index))))
      }
      // The delimited block itself — strip delimiters and render
      const isDisplay = match[0].startsWith('$$')
      const inner = match[0].replace(/^\$\$?/, '').replace(/\$\$?$/, '')
      try {
        segments.push(
          katex.renderToString(inner.trim(), {
            throwOnError: false,
            displayMode: isDisplay
          })
        )
      } catch {
        segments.push(match[0])
      }
      lastIndex = match.index + match[0].length
    }

    // Remaining text after last delimiter
    if (lastIndex < t.length) {
      segments.push(applyInlineFormatting(renderSegment(t.slice(lastIndex))))
    }

    return DOMPurify.sanitize(segments.join('').replace(/\n/g, '<br>'), PURIFY_OPTS_FULL)
  }

  // ── Path A: raw LaTeX with no $ delimiters ──
  // If isRawLatex and no $ present, render as inline math wrapped in $...$.
  // isPureMath was too restrictive — it rejected valid equations containing spaces
  // (e.g. "I_{CEO}=\alpha\cdot I_{CBO}") because stripped text had whitespace.
  if (isRawLatex(t) && !t.includes('$')) {
    // If the string contains inline formatting markers, treat as prose — not raw LaTeX.
    // KaTeX cannot handle ** or __ and will error on them.
    const hasFormatting = /\*\*|\*[^*]|__/.test(t)
    if (hasFormatting) {
      return DOMPurify.sanitize(
        applyInlineFormatting(t.replace(/\n/g, '<br>')),
        PURIFY_OPTS_FULL
      )
    }
    try {
      const rendered = katex.renderToString(t, {
        throwOnError: false,
        displayMode: isPureMath(t), // block display only for pure single-expression math
        trust: true
      })
      return DOMPurify.sanitize(rendered, PURIFY_OPTS_FULL)
    } catch {
      return t.replace(/\n/g, '<br>')
    }
  }

  // ── Path B: standard $...$ / $$...$$ delimited math ──
  // Process $$ BEFORE $ to avoid regex ambiguity
  let rendered = t

  // Block math handling for $$...$$
  rendered = rendered.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        throwOnError: false,
        displayMode: true
      })
    } catch (e) {
      console.warn('KaTeX block error:', e)
      return match
    }
  })

  // Inline math: $...$
  rendered = rendered.replace(/\$([^$\n]+?)\$/g, (match, formula) => {
    try {
      return katex.renderToString(formula, {
        throwOnError: false,
        displayMode: false
      })
    } catch (e) {
      console.warn('KaTeX error:', e)
      return match
    }
  })

  // Markdown bolding, italic, underline
  rendered = applyInlineFormatting(rendered)
  return DOMPurify.sanitize(rendered.replace(/\n/g, '<br>'), PURIFY_OPTS_FULL)
}

/**
 * Scans for double-escaped backslashes followed by a letter (e.g. \\frac).
 * These often occur due to incorrect JSON stringification of LaTeX data.
 */
export const scanForDoubleEscapes = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false
  return /\\\\\w/.test(text)
}
