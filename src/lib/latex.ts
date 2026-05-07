import katex from 'katex'
import DOMPurify from 'dompurify'

/**
 * Render inline LaTeX math expressions within text.
 * Looks for `$...$` patterns, renders them via KaTeX, and sanitizes the
 * entire output with DOMPurify to prevent XSS when used with dangerouslySetInnerHTML.
 *
 * @param text - Raw text potentially containing `$...$` LaTeX expressions
 * @returns Sanitized HTML string safe for dangerouslySetInnerHTML
 */
export const renderMath = (text: string): string => {
  // First pass: render KaTeX expressions
  let rendered = text.replace(/\$([^$]+)\$/g, (match, formula) => {
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
