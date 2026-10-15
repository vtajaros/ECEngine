/**
 * Returns a Tailwind font-size class based on text length.
 * Used for dynamic card face sizing across FlashCard.tsx and FlashcardLearn.tsx.
 */
export function getDynamicFontSize(text: string): string {
  if (!text) return 'text-lg'
  const isMath = text.includes('$$') || text.includes('\\frac') || text.includes('\\sqrt') || text.includes('\\text') || text.includes('\\sum')
  const len = text.length

  if (isMath) {
    // Multi-part or complex equations need proper font sizing so they don't blow out card bounds
    const fracCount = (text.match(/\\frac/g) || []).length
    if (fracCount > 1 || len > 50) return 'text-xl'
    if (len <= 25) return 'text-3xl'
    return 'text-2xl'
  }

  if (len <= 20)  return 'text-5xl'
  if (len <= 40)  return 'text-4xl'
  if (len <= 80)  return 'text-3xl'
  if (len <= 160) return 'text-2xl'
  if (len <= 300) return 'text-xl'
  return 'text-lg'
}
