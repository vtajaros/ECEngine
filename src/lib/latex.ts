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

const isRawLatex = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false
  if (text.startsWith('\\')) return true
  return LATEX_COMMANDS.some(cmd => text.includes(cmd))
}

/**
 * Render inline LaTeX math expressions within text.
 * Looks for `$...$` patterns, renders them via KaTeX, and sanitizes the
 * entire output with DOMPurify to prevent XSS when used with dangerouslySetInnerHTML.
 *
 * @param text - Raw text potentially containing `$...$` LaTeX expressions
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export const renderMath = (text: string): string => {
  // Handle raw LaTeX from MathLive (no $ delimiters)
  if (isRawLatex(text) && !text.includes('$')) {
    try {
      const rendered = katex.renderToString(text, {
        throwOnError: false,
        displayMode: true,
        trust: true
      })
      return DOMPurify.sanitize(rendered, { 
        ALLOWED_TAGS: ['span', 'svg', 'path', 'line', 'rect',
          'circle', 'g', 'defs', 'use', 'br', 'strong', 'b',
          'math', 'semantics', 'mrow', 'mo', 'mi', 'mn'],
        ALLOWED_ATTR: ['class', 'style', 'xmlns', 'd', 
          'viewBox', 'aria-hidden', 'focusable']
      })
    } catch {
      return text
    }
  }

  // First pass: render KaTeX expressions
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

  // Second pass: handle basic markdown bolding **text**
  rendered = rendered.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')


  // Second pass: sanitize to prevent XSS from user-imported content
  return DOMPurify.sanitize(rendered, {
    ALLOWED_TAGS: ['span', 'svg', 'path', 'line', 'rect',
                   'circle', 'g', 'defs', 'use', 'br', 'strong', 'b'],

    ALLOWED_ATTR: ['class', 'style', 'd', 'viewBox',
                   'xmlns', 'width', 'height', 'x', 'y',
                   'x1', 'y1', 'x2', 'y2', 'stroke',
                   'stroke-width', 'fill', 'transform']
  })
}
