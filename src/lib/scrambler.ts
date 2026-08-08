import { shuffleArray } from './utils'

// Re-export for backward compatibility
export const shuffle = shuffleArray

/**
 * Returns true if this MCQ's choices are safe to shuffle.
 * Shuffling is blocked when any choice references other choices by letter
 * position (e.g. "All of the above", "Both A and B", "A and C"), because
 * shuffling would make those positional references incorrect.
 *
 * Blocked patterns (case-insensitive):
 *   - "all of the above"
 *   - "none of the above"
 *   - Any choice containing positional references like:
 *     "both a and b", "a and b", "a & b", "a or b", "b and c",
 *     "a, b and c", "a, b, and c", "b & d", etc.
 *     i.e. two or more of the letters a/b/c/d joined by
 *     "and", "or", "&", or a comma — referring to choice positions.
 */
export function isSafeToShuffleChoices(choices: string[]): boolean {
  // Matches "all of the above" or "none of the above"
  const absolutePattern = /\b(all|none)\s+of\s+(the\s+above|these)\b/i

  // Matches positional references: "a and b", "both a & c", "a, b and c",
  // "a or b", "b & d", "a, b, or c", etc.
  // Requires at least two choice letters (a/b/c/d) near connectors.
  const positionalPattern =
    /\b(both\s+)?([abcd])\s*(?:,\s*[abcd]\s*)*(?:\s+(?:and|or)\s+|\s*&\s*)([abcd])\b(?!\s*\w)/i

  return !choices.some(
    choice => absolutePattern.test(choice) || positionalPattern.test(choice)
  )
}

/**
 * Shuffle MCQ choices and remap the correct answer index.
 * Returns new choices array, the updated answer index, and (if provided)
 * the correspondingly shuffled choicesPlainText array.
 */
export function shuffleChoices(
  choices: string[],
  answerIndex: number,
  choicesPlainText?: boolean[]
): { choices: string[]; answer: number; choicesPlainText?: boolean[] } {
  // Build indexed pairs so we can track which slot went where
  const indexed = choices.map((c, i) => ({ choice: c, originalIndex: i }))
  const shuffled = shuffleArray(indexed)
  const newChoices = shuffled.map(s => s.choice)
  const newAnswer = shuffled.findIndex(s => s.originalIndex === answerIndex)
  const result: { choices: string[]; answer: number; choicesPlainText?: boolean[] } = {
    choices: newChoices,
    answer: newAnswer,
  }
  if (choicesPlainText) {
    result.choicesPlainText = shuffled.map(s => choicesPlainText[s.originalIndex])
  }
  return result
}
