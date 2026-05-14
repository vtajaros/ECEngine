import katex from 'katex'
import DOMPurify from 'dompurify'

const LATEX_COMMANDS = [
  '\\frac', '\\sqrt', '\\sum', '\\int', '\\lim',
  '\\log', '\\sin', '\\cos', '\\tan', '\\alpha', '\\beta',
  '\\gamma', '\\delta', '\\theta', '\\phi', '\\psi',
  '\\omega', '\\sigma', '\\lambda', '\\mu', '\\pi',
  '\\infty', '\\pm', '\\cdot', '\\times', '\\div',
  '\\leq', '\\geq', '\\neq', '\\approx', '\\left',
  '\\right', '\\forall', '\\exists', '\\in', '\\subset',
  '\\cup', '\\cap', '\\vec', '\\hat', '\\bar', '\\dot',
  '\\partial', '\\nabla', '\\mathrm', '\\mathbf', '\\text',
  '\\vert', '\\Vert', '\\larr', '\\rarr', '\\lArr', '\\rArr',
  '\\placeholder'
]

export const isRawLatex = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false
  if (text.startsWith('\\')) return true
  return LATEX_COMMANDS.some(cmd => text.includes(cmd))
}

// Renders a single segment of text that has no $ delimiters.
// If it looks like raw LaTeX, render it inline; otherwise return as-is.
function renderSegment(segment: string): string {
  const trimmed = segment.trim()
  if (!trimmed) return segment
  if (isRawLatex(trimmed)) {
    try {
      return katex.renderToString(trimmed, {
        throwOnError: false,
        displayMode: false
      })
    } catch {
      return segment
    }
  }
  return segment
}

const PURIFY_OPTS_FULL = {
  ALLOWED_TAGS: ['span', 'svg', 'path', 'line', 'rect',
                 'circle', 'g', 'defs', 'use', 'br', 'strong', 'b',
                 'math', 'semantics', 'mrow', 'mo', 'mi', 'mn'],
  ALLOWED_ATTR: ['class', 'style', 'xmlns', 'd',
                 'viewBox', 'aria-hidden', 'focusable',
                 'width', 'height', 'x', 'y',
                 'x1', 'y1', 'x2', 'y2', 'stroke',
                 'stroke-width', 'fill', 'transform']
}

/**
 * Render inline LaTeX math expressions within text.
 * Handles three cases:
 *   Path A — pure raw LaTeX (no $ delimiters): render entire string as display math.
 *   Path B — standard $...$ / $$...$$ delimited only: regex-replace each block.
 *   Path C — mixed content (raw LaTeX commands AND $ delimiters): split on
 *            delimiter boundaries, render each segment individually, then rejoin.
 *
 * @param text - Raw text potentially containing LaTeX expressions
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export const renderMath = (text: string): string => {
  if (!text || typeof text !== 'string') return ''

  // ── Path C: mixed content — raw LaTeX commands AND $ delimiters present ──
  if (isRawLatex(text) && text.includes('$')) {
    const segments: string[] = []
    const delimRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = delimRegex.exec(text)) !== null) {
      // Text before this delimiter block
      if (match.index > lastIndex) {
        segments.push(renderSegment(text.slice(lastIndex, match.index)))
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
    if (lastIndex < text.length) {
      segments.push(renderSegment(text.slice(lastIndex)))
    }

    return DOMPurify.sanitize(segments.join(''), PURIFY_OPTS_FULL)
  }

  // ── Path A: pure raw LaTeX (no $ delimiters) ──
  if (isRawLatex(text) && !text.includes('$')) {
    try {
      const rendered = katex.renderToString(text, {
        throwOnError: false,
        displayMode: true,
        trust: true
      })
      return DOMPurify.sanitize(rendered, PURIFY_OPTS_FULL)
    } catch {
      return text
    }
  }

  // ── Path B: standard $...$ / $$...$$ delimited math ──
  // First pass: render inline $...$ expressions
  let rendered = text.replace(/\$([^$]+?)\$/g, (match, formula) => {
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

  // Markdown bolding **text**
  rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  return DOMPurify.sanitize(rendered, PURIFY_OPTS_FULL)
}
