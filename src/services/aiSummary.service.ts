/**
 * aiSummary.service.ts
 * Generates an AI-driven summary for deck descriptions based on deck cards.
 * Routes through the Electron main process via Groq API.
 */

import { EditCard } from '../components/deck/CardEditor'
import { MCQEdit, FlashcardEdit, FormulaEdit } from '../components/deck/CardForms'

export class SummaryError extends Error {
  code?: string
  status?: number
  detail?: string
  constructor(message: string, code?: string, status?: number, detail?: string) {
    super(message)
    this.name = 'SummaryError'
    this.code = code
    this.status = status
    this.detail = detail
  }
}

export function extractCardItems(cards: EditCard[]): string[] {
  const items: string[] = []

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    if (card.type === 'mcq') {
      const data = card.data as MCQEdit
      const q = (data.question || '').trim()
      if (!q) continue
      const correctChoice = data.choices?.[data.answer] ? ` (Answer: ${data.choices[data.answer]})` : ''
      items.push(`[MCQ] ${q}${correctChoice}`)
    } else if (card.type === 'flashcard') {
      const data = card.data as FlashcardEdit
      const front = (data.front || '').trim()
      const back = (data.back || '').trim()
      if (!front && !back) continue
      items.push(`[Flashcard] ${front}: ${back}`)
    } else if (card.type === 'formula') {
      const data = card.data as FormulaEdit
      const name = (data.name || '').trim()
      const latex = (data.latex || '').trim()
      const desc = (data.description || data.variables || '').trim()
      if (!name && !latex && !desc) continue
      items.push(`[Formula] ${name} (${latex}) ${desc ? '- ' + desc : ''}`.trim())
    }
  }

  return items
}

export async function generateDeckSummary(params: {
  title?: string
  subject?: string
  cards: EditCard[]
}): Promise<string> {
  const cardItems = extractCardItems(params.cards)

  if (cardItems.length === 0) {
    throw new SummaryError(
      'Please add cards with content to generate a summary.',
      'NO_CONTENT'
    )
  }

  // Sample up to 40 cards to keep request fast and within context
  const sampleItems = cardItems.length > 40 ? cardItems.slice(0, 40) : cardItems

  const result = await window.electron.summarizeDeck({
    title: params.title || '',
    subject: params.subject || '',
    cardItems: sampleItems,
    totalCards: params.cards.length,
  })

  if (result.error === 'NO_KEY') {
    throw new SummaryError(
      'Groq API key not configured. Add your key in Settings to enable AI generation.',
      'NO_KEY'
    )
  }

  if (result.error === 'RATE_LIMITED') {
    throw new SummaryError(
      'Groq API rate limit reached. Please wait a moment and try again.',
      'RATE_LIMITED'
    )
  }

  if (result.error === 'INVALID_KEY') {
    throw new SummaryError(
      'Invalid Groq API key. Please check your key in Settings.',
      'INVALID_KEY'
    )
  }

  if (result.error === 'TIMEOUT') {
    throw new SummaryError(
      'AI request timed out. Please try again.',
      'TIMEOUT'
    )
  }

  if (result.error) {
    const errorMsg = result.detail ? `AI generation failed: ${result.detail}` : `AI generation failed (${result.error}).`
    throw new SummaryError(
      errorMsg,
      result.error,
      result.status,
      result.detail
    )
  }

  if (!result.text) {
    throw new SummaryError('Empty response from AI model.', 'EMPTY_RESPONSE')
  }

  return result.text
}
