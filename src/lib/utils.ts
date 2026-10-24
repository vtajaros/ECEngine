/**
 * Fisher-Yates (Knuth) shuffle — produces an unbiased permutation.
 * Returns a new array; does not mutate the input.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Resolves the 0-based index of the correct choice for an MCQ card.
 * Handles:
 * - Number indices (e.g. 0, 1, 2, 3)
 * - Numeric string indices (e.g. "0", "1", "2")
 * - Single letter choices (e.g. "A", "B", "C", "D")
 * - Text matching the choice content itself
 * Always returns a single 0-based index (or -1 if unresolved), preventing multiple choices from being marked correct.
 */
export function resolveCorrectChoiceIndex(answer: unknown, choices?: string[]): number {
  if (answer === undefined || answer === null || answer === '') return -1

  // 1. If answer is already a valid numeric index
  if (typeof answer === 'number' && Number.isInteger(answer)) {
    if (choices && (answer < 0 || answer >= choices.length)) {
      return -1
    }
    return answer >= 0 ? answer : -1
  }

  const str = String(answer).trim()

  // 2. If answer is a numeric string (e.g. "0", "1", "2") representing index
  if (/^\d+$/.test(str)) {
    const idx = parseInt(str, 10)
    if (choices && idx >= 0 && idx < choices.length) {
      return idx
    }
  }

  // 3. If answer is a single letter (e.g. "A", "B", "C", "D")
  if (/^[a-zA-Z]$/.test(str)) {
    const idx = str.toUpperCase().charCodeAt(0) - 65
    if (choices && idx >= 0 && idx < choices.length) {
      return idx
    }
  }

  // 4. If answer matches the choice text itself (case-insensitive)
  if (Array.isArray(choices)) {
    const textIdx = choices.findIndex((c) => typeof c === 'string' && c.trim().toLowerCase() === str.toLowerCase())
    if (textIdx !== -1) {
      return textIdx
    }
  }

  return -1
}

/**
 * Determines whether multiple choice question options should be stacked vertically
 * into a single column (A, then B, then C, then D) rather than arranged in a 2x2 grid.
 *
 * Rules:
 * - Returns true if any choice exceeds maxCharLength (default: 45 characters).
 * - Returns true if any choice contains line breaks (\n, \r, <br>).
 * - Returns true if any choice contains complex math / LaTeX formulas (e.g., \frac, \sqrt, \int, \sum, \begin, \matrix).
 * - Otherwise returns false (allowing 2x2 grid: A B / C D).
 */
export function shouldStackChoices(choices?: (string | null | undefined)[] | null, maxCharLength: number = 45): boolean {
  if (!Array.isArray(choices) || choices.length === 0) return false

  const complexMathPattern = /\\(frac|dfrac|tfrac|sqrt|int|iint|sum|prod|begin|matrix|pmatrix|bmatrix|cases|over|cfrac)/i

  for (const choice of choices) {
    if (typeof choice !== 'string') continue
    const trimmed = choice.trim()

    // 1. Character length exceeds threshold
    if (trimmed.length > maxCharLength) {
      return true
    }

    // 2. Contains line breaks
    if (/[\r\n]|<br\s*\/?>/i.test(trimmed)) {
      return true
    }

    // 3. Contains complex LaTeX formulas
    if (complexMathPattern.test(trimmed)) {
      return true
    }
  }

  return false
}

