/**
 * quizletParser.ts
 * Pure TypeScript port of ECEngine Quiz Converter v2.1 (newmain.py)
 * Supports: Quizlet MCQ, Quizlet Flashcard
 * No IndiaBix CSV in this version.
 */

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

export type QuizletFormat = 'mcq' | 'flashcard' | 'unknown'

export interface QuizletMCQ {
  question: string
  choices: string[]
  answer: string // letter: 'A' | 'B' | 'C' | 'D'
}

export interface QuizletFlashcard {
  term: string
  definition: string
}

export interface QuizletParseResult {
  format: QuizletFormat
  mcqs: QuizletMCQ[]
  flashcards: QuizletFlashcard[]
  detected: number
  converted: number
  symbolFixes: number
  spellingFixes: number
}

// ─────────────────────────────────────────────────────────────
//  SYMBOL FIX TABLE
// ─────────────────────────────────────────────────────────────

const SYMBOL_FIXES: [string, string][] = [
  // Superscripts → caret notation
  ['\u00b2', '^2'], ['\u00b3', '^3'], ['\u00b9', '^1'],
  ['\u2070', '^0'], ['\u2074', '^4'], ['\u2075', '^5'],
  ['\u2076', '^6'], ['\u2077', '^7'], ['\u2078', '^8'], ['\u2079', '^9'],
  // Subscripts → underscore notation
  ['\u2080', '_0'], ['\u2081', '_1'], ['\u2082', '_2'], ['\u2083', '_3'],
  ['\u2084', '_4'], ['\u2085', '_5'], ['\u2086', '_6'], ['\u2087', '_7'],
  ['\u2088', '_8'], ['\u2089', '_9'],
  // Math symbols
  ['\u00d7', '×'], ['\u00f7', '÷'], ['\u00b1', '±'],
  ['\u2212', '-'],
  ['\u2260', '≠'], ['\u2264', '≤'], ['\u2265', '≥'],
  ['\u221a', '√'], ['\u221e', '∞'], ['\u2248', '≈'],
  // Degree
  ['\u00b0', '°'], ['&deg;', '°'],
  // Quotes and dashes
  ['\u2018', "'"], ['\u2019', "'"], ['\u201c', '"'], ['\u201d', '"'],
  ['\u2013', '-'], ['\u2014', '-'],
  ['\u00a0', ' '],
  // HTML entities
  ['&#945;', 'α'], ['&#946;', 'β'], ['&#947;', 'γ'], ['&#960;', 'π'],
  ['&#969;', 'ω'], ['&#937;', 'Ω'],
]

// ─────────────────────────────────────────────────────────────
//  SPELLING FIX TABLE
// ─────────────────────────────────────────────────────────────

const SPELLING_FIXES: [RegExp, string][] = [
  [/\bteh\b/gi, 'the'],
  [/\bthier\b/gi, 'their'],
  [/\brecieve\b/gi, 'receive'],
  [/\boccured\b/gi, 'occurred'],
  [/\bwhcih\b/gi, 'which'],
  [/\bwich\b/gi, 'which'],
  [/\bbeacuse\b/gi, 'because'],
  [/\belectic\b/gi, 'electric'],
  [/\belectical\b/gi, 'electrical'],
  [/\belecrical\b/gi, 'electrical'],
  [/\bmagnatic\b/gi, 'magnetic'],
  [/\belectomagnetic\b/gi, 'electromagnetic'],
  [/\belectromagnetc\b/gi, 'electromagnetic'],
  [/\bindcution\b/gi, 'induction'],
  [/\binducton\b/gi, 'induction'],
  [/\bconductore\b/gi, 'conductor'],
  [/\bcondcutor\b/gi, 'conductor'],
  [/\bresitance\b/gi, 'resistance'],
  [/\bresistanse\b/gi, 'resistance'],
  [/\bcurent\b/gi, 'current'],
  [/\bfrequancy\b/gi, 'frequency'],
  [/\bfrequncy\b/gi, 'frequency'],
  [/\bvoltege\b/gi, 'voltage'],
  [/\bvolatge\b/gi, 'voltage'],
  [/\bcapacitence\b/gi, 'capacitance'],
  [/\bcapcitance\b/gi, 'capacitance'],
  [/\bindutance\b/gi, 'inductance'],
  [/\bindcutance\b/gi, 'inductance'],
  [/\bimpedence\b/gi, 'impedance'],
  [/\boscilattion\b/gi, 'oscillation'],
  [/\boscillaion\b/gi, 'oscillation'],
  [/\bpotencial\b/gi, 'potential'],
  [/\bpotentail\b/gi, 'potential'],
  [/\bpropagtion\b/gi, 'propagation'],
  [/\bpropogation\b/gi, 'propagation'],
]

// ─────────────────────────────────────────────────────────────
//  FORMAT DETECTOR
// ─────────────────────────────────────────────────────────────

/**
 * Detects whether pasted text looks like Quizlet MCQ or Quizlet Flashcard.
 * Returns 'unknown' if there's not enough signal.
 *
 * Quizlet MCQ signature:
 *   QUESTION TEXT
 *   Choice A
 *   Choice B
 *   Choice C
 *   Correct Choice: Correct Answer Text
 *
 * Quizlet Flashcard signature:
 *   Term: Definition
 *   Term: Definition
 *   (high ratio of lines with ': ', definitions tend to be longer)
 */
export function detectQuizletFormat(text: string): QuizletFormat {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (lines.length < 2) return 'unknown'

  // Check if it already looks like ECEngine format — if so, not Quizlet
  const ecEngineLines = lines.filter(l =>
    /^Q:\s/.test(l) || /^A:\s/.test(l) || /^B:\s/.test(l) ||
    /^C:\s/.test(l) || /^D:\s/.test(l) || /^ANS:\s/i.test(l)
  )
  if (ecEngineLines.length > lines.length * 0.3) return 'unknown'

  const colonLines = lines.filter(l => l.includes(': ') && l.split(': ')[0].trim().length > 0)
  if (colonLines.length === 0) {
    // No colon lines at all — could still be MCQ if we see blocks of 5
    // Check for blocks: non-colon lines of ≥5 grouped together
    return lines.length >= 5 ? 'mcq' : 'unknown'
  }

  const colonRatio = colonLines.length / lines.length

  // High colon ratio → flashcard (removed avgAfter > 40 heuristic to support short definitions)
  if (colonRatio > 0.70) return 'flashcard'

  // Low colon ratio → MCQ (answers are choices, only the last line per block has ': ')
  if (colonRatio < 0.35 && lines.length >= 3) return 'mcq'

  // Medium range — look for "Correct Choice:" style lines
  const correctChoiceLines = lines.filter(l => /^[^:]+:\s*.{3,}$/.test(l))
  if (correctChoiceLines.length > 0 && colonRatio < 0.5) return 'mcq'

  return 'unknown'
}

// ─────────────────────────────────────────────────────────────
//  FLASHCARD PARSER
// ─────────────────────────────────────────────────────────────

function parseQuizletFlashcards(text: string): { cards: QuizletFlashcard[]; detected: number } {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Split on blank lines to get per-card blocks; each block has
  // "Term: Definition" where the definition may span additional lines.
  const rawBlocks = normalized
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(b => b.length > 0)

  const detected = rawBlocks.length
  const cards: QuizletFlashcard[] = []

  for (const block of rawBlocks) {
    const blockLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    if (blockLines.length === 0) continue

    // The first line must contain ': ' which splits term from start of definition.
    const firstLine = blockLines[0]
    const colonIdx = firstLine.indexOf(': ')
    if (colonIdx === -1) continue

    const term = firstLine.slice(0, colonIdx).trim()
    // Definition = rest of first line + any continuation lines
    const defStart = firstLine.slice(colonIdx + 2).trim()
    const defContinuation = blockLines.slice(1).join('\n').trim()
    const definition = defContinuation ? `${defStart}\n${defContinuation}`.trim() : defStart

    if (term && definition) {
      cards.push({ term, definition })
    }
  }

  return { cards, detected }
}

// ─────────────────────────────────────────────────────────────
//  MCQ PARSER
// ─────────────────────────────────────────────────────────────

/** Labels for up to 5 choices (A–E). */
const MCQ_LABELS = ['A', 'B', 'C', 'D', 'E']

function findCorrectLetter(choices: string[], answerName: string): string {
  const an = answerName.trim().toLowerCase()
  for (let i = 0; i < choices.length; i++) {
    if (choices[i].trim().toLowerCase() === an) {
      return MCQ_LABELS[i] ?? MCQ_LABELS[choices.length - 1]
    }
  }
  // Default to the last available label rather than always 'D'
  return MCQ_LABELS[choices.length - 1] ?? 'A'
}

/**
 * Regex that recognises the "Correct Choice: Answer Text" marker line
 * which Quizlet always places at the end of an MCQ block.
 * Group 1: the choice text (same as one of the choices above).
 * Group 2: the correct answer name.
 *
 * Pattern breakdown:
 *   ^(.+?)          – non-greedy capture of the choice label (choice D / last choice text)
 *   :\s+            – literal colon + whitespace separator used by Quizlet
 *   (.+)$           – the correct answer text
 */
const QUIZLET_MARKER_RE = /^(.+?):\s+(.+)$/

/**
 * Split raw Quizlet text into per-question blocks.
 *
 * Each block ends at the line containing the "Correct Choice: Answer" marker.
 * We detect that marker as a line matching QUIZLET_MARKER_RE that comes AFTER
 * at least one plain (non-marker) line – i.e., the previous lines were choices.
 *
 * Strategy:
 *  1. Normalise & split into non-empty lines.
 *  2. Accumulate lines into `current`.
 *  3. When we detect a marker line AND current already has ≥2 lines (question
 *     + at least one choice), flush current as a block.
 */
function splitIntoRawBlocks(text: string): string[][] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  const blocks: string[][] = []
  let current: string[] = []

  for (const line of lines) {
    current.push(line)
    // A marker line is one that matches "SomeText: CorrectAnswerText" AND is
    // not the very first line of the accumulator (i.e., it is not the question).
    if (current.length >= 3 && QUIZLET_MARKER_RE.test(line)) {
      blocks.push([...current])
      current = []
    }
  }

  // Any trailing lines that did not end with a marker are discarded (incomplete block).
  return blocks
}

function parseQuizletMCQ(text: string): { questions: QuizletMCQ[]; detected: number } {
  const rawBlocks = splitIntoRawBlocks(text)
  const detected = rawBlocks.length
  const questions: QuizletMCQ[] = []

  for (const block of rawBlocks) {
    // Minimum viable block: question + 1 choice + marker = 3 lines
    if (block.length < 3) continue

    // The last line is always the marker: "LastChoiceText: CorrectAnswerText"
    const markerLine = block[block.length - 1]
    const markerMatch = markerLine.match(QUIZLET_MARKER_RE)
    if (!markerMatch) continue

    const lastChoiceText = markerMatch[1].trim()
    const correctName = markerMatch[2].trim()

    // The question is the first line.
    const questionText = block[0]

    // Middle lines (between question and marker) are intermediate choices.
    // The last choice text comes from the marker's first capture group.
    const middleChoices = block.slice(1, block.length - 1)
    const choices = [...middleChoices, lastChoiceText]

    // Must have at least 2 choices (True/False) and at most 5 (A–E).
    if (choices.length < 2 || choices.length > 5) continue

    const correctLetter = findCorrectLetter(choices, correctName)

    questions.push({
      question: questionText,
      choices,
      answer: correctLetter,
    })
  }

  return { questions, detected }
}

// ─────────────────────────────────────────────────────────────
//  PROOFREADER
// ─────────────────────────────────────────────────────────────

function applySymbolFixes(text: string): { text: string; count: number } {
  let count = 0
  for (const [wrong, right] of SYMBOL_FIXES) {
    const occurrences = text.split(wrong).length - 1
    if (occurrences > 0) {
      count += occurrences
      text = text.split(wrong).join(right)
    }
  }
  return { text, count }
}

function applySpellingFixes(text: string): { text: string; count: number } {
  let count = 0
  for (const [pattern, replacement] of SPELLING_FIXES) {
    const before = text
    text = text.replace(pattern, replacement)
    if (text !== before) count++
  }
  return { text, count }
}

// ─────────────────────────────────────────────────────────────
//  ECEngine TXT FORMATTERS
// ─────────────────────────────────────────────────────────────

/**
 * Converts parsed Quizlet MCQs to ECEngine TXT format string.
 * This is the format that parseImportedMCQs() in parser.ts already understands.
 */
export function formatAsECEngineMCQ(questions: QuizletMCQ[]): string {
  const labels = ['A', 'B', 'C', 'D', 'E']
  const blocks = questions.map(q => {
    const lines = [`Q: ${q.question}`]
    q.choices.forEach((choice, i) => {
      if (labels[i]) lines.push(`${labels[i]}: ${choice}`)
    })
    lines.push(`ANS: ${q.answer}`)
    return lines.join('\n')
  })
  return blocks.join('\n\n')
}

/**
 * Converts parsed Quizlet flashcards to ECEngine TXT format string.
 * This is the format that parseImportedFlashcards() in parser.ts already understands.
 */
export function formatAsECEngineFlashcards(flashcards: QuizletFlashcard[]): string {
  const blocks = flashcards.map(c => `Q: ${c.term}\nA: ${c.definition}`)
  return blocks.join('\n\n')
}

// ─────────────────────────────────────────────────────────────
//  MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────

/**
 * Full pipeline: detect format → parse → proofread → format as ECEngine TXT.
 * Returns the converted ECEngine-format string ready to drop into the import textarea,
 * plus stats for the UI to display.
 */
export function convertQuizletToECEngine(
  rawText: string,
  forceFormat?: 'mcq' | 'flashcard',
  applyFixes = true
): QuizletParseResult {
  const format = forceFormat ?? detectQuizletFormat(rawText)

  if (format === 'unknown') {
    return {
      format: 'unknown',
      mcqs: [],
      flashcards: [],
      detected: 0,
      converted: 0,
      symbolFixes: 0,
      spellingFixes: 0,
    }
  }

  let symFixes = 0
  let spellFixes = 0
  let processedText = rawText

  if (applyFixes) {
    const sym = applySymbolFixes(processedText)
    processedText = sym.text
    symFixes = sym.count

    const spell = applySpellingFixes(processedText)
    processedText = spell.text
    spellFixes = spell.count
  }

  if (format === 'flashcard') {
    const { cards, detected } = parseQuizletFlashcards(processedText)
    return {
      format: 'flashcard',
      mcqs: [],
      flashcards: cards,
      detected,
      converted: cards.length,
      symbolFixes: symFixes,
      spellingFixes: spellFixes,
    }
  } else {
    const { questions, detected } = parseQuizletMCQ(processedText)
    return {
      format: 'mcq',
      mcqs: questions,
      flashcards: [],
      detected,
      converted: questions.length,
      symbolFixes: symFixes,
      spellingFixes: spellFixes,
    }
  }
}

/**
 * Convenience: detect Quizlet format from raw pasted text and return
 * the formatted ECEngine string + stats. Returns null if not Quizlet.
 */
export function tryConvertQuizlet(rawText: string): {
  ecEngineText: string
  format: 'mcq' | 'flashcard'
  converted: number
  symbolFixes: number
  spellingFixes: number
} | null {
  const format = detectQuizletFormat(rawText)
  if (format === 'unknown') return null

  const result = convertQuizletToECEngine(rawText, format)
  if (result.converted === 0) return null

  const ecEngineText = format === 'flashcard'
    ? formatAsECEngineFlashcards(result.flashcards)
    : formatAsECEngineMCQ(result.mcqs)

  return {
    ecEngineText,
    format,
    converted: result.converted,
    symbolFixes: result.symbolFixes,
    spellingFixes: result.spellingFixes,
  }
}
