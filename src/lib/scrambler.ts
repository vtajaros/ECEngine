import { shuffleArray } from './utils'

// Re-export for backward compatibility
export const shuffle = shuffleArray

/**
 * Shuffle MCQ choices and remap the correct answer index.
 * Returns new choices array and the updated answer index.
 */
export function shuffleChoices(choices: string[], answerIndex: number): { choices: string[]; answer: number } {
  const correctAnswer = choices[answerIndex]
  const shuffled = shuffleArray(choices)
  return {
    choices: shuffled,
    answer: shuffled.indexOf(correctAnswer),
  }
}
