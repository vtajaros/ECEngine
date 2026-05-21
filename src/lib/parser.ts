export function parseQuizletText(text: string, termDelimiter: string, cardDelimiter: string) {
  if (!text) return []
  
  const parseChar = (char: string) => {
    switch (char) {
      case '\\t': return '\t'
      case '\\n': return '\n'
      case '\\n\\n': return '\n\n'
      default: return char
    }
  }

  const actualTermDelim = parseChar(termDelimiter)
  const actualCardDelim = parseChar(cardDelimiter)

  const rawCards = text.split(actualCardDelim).filter(c => c.trim().length > 0)
  
  const parsed = rawCards.map(cardStr => {
    const parts = cardStr.split(actualTermDelim)
    if (parts.length >= 2) {
      const front = parts[0].trim()
      const back = parts.slice(1).join(actualTermDelim).trim()
      return { front, back }
    }
    return null
  }).filter(Boolean)

  return parsed as { front: string, back: string }[]
}

export function parseQuizletMCQ(text: string, termDelimiter: string, cardDelimiter: string) {
  if (!text) return []

  const parseChar = (char: string) => {
    switch (char) {
      case '\\t': return '\t'
      case '\\n': return '\n'
      case '\\n\\n': return '\n\n'
      default: return char
    }
  }

  const actualTermDelim = parseChar(termDelimiter)
  const actualCardDelim = parseChar(cardDelimiter)

  const rawCards = text.split(actualCardDelim).filter(c => c.trim().length > 0)
  
  const parsed = rawCards.map(cardStr => {
    const parts = cardStr.split(actualTermDelim)
    if (parts.length >= 2) {
      const frontRaw = parts[0].trim()
      const answerText = parts.slice(1).join(actualTermDelim).trim()
      
      const lines = frontRaw.split('\n').map(l => l.trim()).filter(l => l.length > 0)
      let question = frontRaw
      let choices: string[] = []
      let answerIndex = 0

      if (lines.length > 1) {
        question = lines[0]
        choices = lines.slice(1)
        
        let exactMatch = choices.findIndex(c => c === answerText)
        if (exactMatch !== -1) {
          answerIndex = exactMatch
        } else {
          let lowerMatch = choices.findIndex(c => c.toLowerCase() === answerText.toLowerCase())
          if (lowerMatch !== -1) {
            answerIndex = lowerMatch
          } else {
            choices.push(answerText)
            answerIndex = choices.length - 1
          }
        }
      } else {
        choices = [frontRaw, answerText]
        answerIndex = 1
      }

      return { question, choices, answer: answerIndex, explanation: 'Imported from Text format.' }
    }
    return null
  }).filter(Boolean)

  return parsed as { question: string, choices: string[], answer: number, explanation: string }[]
}

// ─────────────────────────────────────────────────────────────
//  Choice label constants
// ─────────────────────────────────────────────────────────────

/** All recognised single-letter choice prefixes (A–E). */
const CHOICE_LABELS = ['A', 'B', 'C', 'D', 'E'] as const
type ChoiceLabel = typeof CHOICE_LABELS[number]

/**
 * Regex that matches a choice label line, e.g. "A: some text" or "E: another".
 * Captured groups: [1] label letter, [2] choice text.
 */
const CHOICE_LINE_RE = /^([A-Ea-e]):\s+(.+)$/

/**
 * Map from uppercase answer letter to zero-based index.
 * Supports A–E (indices 0–4).
 */
const ANSWER_LABEL_TO_INDEX: Record<string, number> = {
  A: 0, B: 1, C: 2, D: 3, E: 4,
}

export function parseImportedMCQs(rawText: string): {
  cards: any[],
  warnings: string[]
} {
  const warnings: string[] = []
  const cards: any[] = []

  // Step 1: normalize all line endings
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  // Step 2: split into blocks by blank lines
  const blocks = normalized
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(b => b.length > 0)

  // Step 3: parse each block
  blocks.forEach((block, index) => {
    const lines = block
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    // ── Extract question (Q:) ────────────────────────────────
    // Q: may span multiple consecutive lines before the first choice label.
    // We collect all lines until we hit a choice or ANS line.
    const firstChoiceIdx = lines.findIndex(l => CHOICE_LINE_RE.test(l))
    const ansLineIdx = lines.findIndex(l => /^ANS:/i.test(l))

    if (firstChoiceIdx === -1) {
      warnings.push(`Block ${index + 1}: No choice lines (A:/B:/…) found`)
      return
    }
    if (ansLineIdx === -1) {
      warnings.push(`Block ${index + 1}: Missing ANS: field`)
      return
    }

    // Question text: everything before the first choice, joined as multi-line
    const questionLines = lines.slice(0, firstChoiceIdx)
    // Strip leading "Q:" prefix if present on the first line
    if (questionLines.length > 0 && /^Q:/i.test(questionLines[0])) {
      questionLines[0] = questionLines[0].replace(/^Q:\s*/i, '')
    }
    const question = questionLines.join('\n').trim()

    if (!question) {
      warnings.push(`Block ${index + 1}: Question text is empty`)
      return
    }

    // ── Extract choices ──────────────────────────────────────
    // Collect all lines between firstChoiceIdx and ansLineIdx
    const choiceLines = lines.slice(firstChoiceIdx, ansLineIdx)
    const choices: string[] = []

    for (const line of choiceLines) {
      const m = line.match(CHOICE_LINE_RE)
      if (m) {
        choices.push(m[2].trim())
      }
    }

    // True/False: allow exactly 2 choices; otherwise require at least 2
    if (choices.length < 2) {
      warnings.push(`Block ${index + 1}: Expected at least 2 choices, found ${choices.length}`)
      return
    }

    // ── Extract answer ───────────────────────────────────────
    const ansLine = lines[ansLineIdx]
    const answerLetter = ansLine.replace(/^ANS:\s*/i, '').trim().toUpperCase() as ChoiceLabel
    const answer = ANSWER_LABEL_TO_INDEX[answerLetter]

    if (answer === undefined) {
      warnings.push(`Block ${index + 1}: ANS must be A–E. Got: ${answerLetter}`)
      return
    }

    if (answer >= choices.length) {
      warnings.push(`Block ${index + 1}: ANS "${answerLetter}" is out of range for ${choices.length} choices`)
      return
    }

    if (choices.some(c => !c)) {
      warnings.push(`Block ${index + 1}: One or more choices are empty`)
      return
    }

    cards.push({ question, choices, answer, explanation: '' })
  })

  return { cards, warnings }
}

export function parseImportedFlashcards(rawText: string): {
  cards: any[],
  warnings: string[]
} {
  const warnings: string[] = []
  const cards: any[] = []

  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  const blocks = normalized
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(b => b.length > 0)

  blocks.forEach((block, index) => {
    const lines = block
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    // Find the Q: line (always first among labelled lines)
    const qLineIdx = lines.findIndex(l => /^Q:/i.test(l))
    const aLineIdx = lines.findIndex(l => /^A:/i.test(l))

    if (qLineIdx === -1) {
      warnings.push(`Block ${index + 1}: Missing Q: field`)
      return
    }
    if (aLineIdx === -1) {
      warnings.push(`Block ${index + 1}: Missing A: field`)
      return
    }
    if (aLineIdx <= qLineIdx) {
      warnings.push(`Block ${index + 1}: A: must come after Q:`)
      return
    }

    // Term: everything from Q: line up to (not including) the A: line
    const termLines = lines.slice(qLineIdx, aLineIdx)
    termLines[0] = termLines[0].replace(/^Q:\s*/i, '')
    const term = termLines.join('\n').trim()

    // Definition: everything from A: line to end of block (supports multi-line defs)
    const defLines = lines.slice(aLineIdx)
    defLines[0] = defLines[0].replace(/^A:\s*/i, '')
    const definition = defLines.join('\n').trim()

    if (!term) {
      warnings.push(`Block ${index + 1}: Term is empty`)
      return
    }
    if (!definition) {
      warnings.push(`Block ${index + 1}: Definition is empty`)
      return
    }

    cards.push({ front: term, back: definition })
  })

  return { cards, warnings }
}
