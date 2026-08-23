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

interface ParsedLine {
  text: string
  lineNum: number
}

interface RawBlock {
  index: number
  lines: ParsedLine[]
  startLine: number
}

function splitIntoNumberedBlocks(rawText: string): RawBlock[] {
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  const allLines = normalized.split('\n')
  const blocks: RawBlock[] = []
  let currentBlockLines: ParsedLine[] = []
  let currentStartLine = 0

  for (let i = 0; i < allLines.length; i++) {
    const rawLine = allLines[i]
    const trimmed = rawLine.trim()
    const lineNum = i + 1

    if (trimmed.length === 0) {
      if (currentBlockLines.length > 0) {
        blocks.push({
          index: blocks.length,
          lines: currentBlockLines,
          startLine: currentStartLine,
        })
        currentBlockLines = []
      }
    } else {
      if (currentBlockLines.length === 0) {
        currentStartLine = lineNum
      }
      currentBlockLines.push({ text: trimmed, lineNum })
    }
  }

  if (currentBlockLines.length > 0) {
    blocks.push({
      index: blocks.length,
      lines: currentBlockLines,
      startLine: currentStartLine,
    })
  }

  return blocks
}

export function parseImportedMCQs(rawText: string): {
  cards: any[],
  warnings: string[]
} {
  const warnings: string[] = []
  const cards: any[] = []

  const blocks = splitIntoNumberedBlocks(rawText)

  blocks.forEach((block) => {
    const lines = block.lines

    // ── Extract question (Q:) ────────────────────────────────
    // Q: may span multiple consecutive lines before the first choice label.
    // We collect all lines until we hit a choice or ANS line.
    const firstChoiceIdx = lines.findIndex(l => CHOICE_LINE_RE.test(l.text))
    const ansLineIdx = lines.findIndex(l => /^ANS:/i.test(l.text))

    if (firstChoiceIdx === -1) {
      warnings.push(`Block ${block.index + 1} (Line ${block.startLine}): No choice lines (A:/B:/…) found`)
      return
    }
    if (ansLineIdx === -1) {
      warnings.push(`Block ${block.index + 1} (Line ${block.startLine}): Missing ANS: field`)
      return
    }

    // Question text: everything before the first choice, joined as multi-line
    const questionLines = lines.slice(0, firstChoiceIdx)
    // Strip leading "Q:" prefix if present on the first line
    const firstQLine = questionLines[0]
    let firstLineText = firstQLine ? firstQLine.text : ''
    if (/^Q:/i.test(firstLineText)) {
      firstLineText = firstLineText.replace(/^Q:\s*/i, '')
    }
    const fullQuestionLines = [firstLineText, ...questionLines.slice(1).map(l => l.text)]
    const question = fullQuestionLines.join('\n').trim()

    if (!question) {
      warnings.push(`Block ${block.index + 1} (Line ${block.startLine}): Question text is empty`)
      return
    }

    // ── Extract choices ──────────────────────────────────────
    // Collect all lines between firstChoiceIdx and ansLineIdx
    const choiceLines = lines.slice(firstChoiceIdx, ansLineIdx)
    const choices: string[] = []

    for (const line of choiceLines) {
      const m = line.text.match(CHOICE_LINE_RE)
      if (m) {
        choices.push(m[2].trim())
      }
    }

    const choiceStartLine = choiceLines[0]?.lineNum || block.startLine

    // True/False: allow exactly 2 choices; otherwise require at least 2
    if (choices.length < 2) {
      warnings.push(`Block ${block.index + 1} (Line ${choiceStartLine}): Expected at least 2 choices, found ${choices.length}`)
      return
    }

    // ── Extract answer ───────────────────────────────────────
    const ansLine = lines[ansLineIdx]
    const rawAnswerText = ansLine.text.replace(/^ANS:\s*/i, '').trim()
    const letterMatch = rawAnswerText.match(/^[\(\[]?\s*([A-Ea-e])\s*[\)\]\.\:\,\-]?/i)
    const answerLetter = (letterMatch ? letterMatch[1].toUpperCase() : rawAnswerText.toUpperCase()) as ChoiceLabel
    const answer = ANSWER_LABEL_TO_INDEX[answerLetter]

    if (answer === undefined) {
      warnings.push(`Block ${block.index + 1} (Line ${ansLine.lineNum}): ANS must be A–E. Got: ${rawAnswerText}`)
      return
    }

    if (answer >= choices.length) {
      warnings.push(`Block ${block.index + 1} (Line ${ansLine.lineNum}): ANS "${answerLetter}" is out of range for ${choices.length} choices`)
      return
    }

    if (choices.some(c => !c)) {
      warnings.push(`Block ${block.index + 1} (Line ${choiceStartLine}): One or more choices are empty`)
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

  const blocks = splitIntoNumberedBlocks(rawText)

  blocks.forEach((block) => {
    const lines = block.lines

    // Find the Q: line (always first among labelled lines)
    const qLineIdx = lines.findIndex(l => /^Q:/i.test(l.text))
    const aLineIdx = lines.findIndex(l => /^A:/i.test(l.text))

    if (qLineIdx === -1) {
      warnings.push(`Block ${block.index + 1} (Line ${block.startLine}): Missing Q: field`)
      return
    }
    if (aLineIdx === -1) {
      warnings.push(`Block ${block.index + 1} (Line ${block.startLine}): Missing A: field`)
      return
    }
    if (aLineIdx <= qLineIdx) {
      warnings.push(`Block ${block.index + 1} (Line ${lines[aLineIdx].lineNum}): A: must come after Q:`)
      return
    }

    // Term: everything from Q: line up to (not including) the A: line
    const termLines = lines.slice(qLineIdx, aLineIdx).map(l => l.text)
    termLines[0] = termLines[0].replace(/^Q:\s*/i, '')
    const term = termLines.join('\n').trim()

    // Definition: everything from A: line to end of block (supports multi-line defs)
    const defLines = lines.slice(aLineIdx).map(l => l.text)
    defLines[0] = defLines[0].replace(/^A:\s*/i, '')
    const definition = defLines.join('\n').trim()

    if (!term) {
      warnings.push(`Block ${block.index + 1} (Line ${lines[qLineIdx].lineNum}): Term is empty`)
      return
    }
    if (!definition) {
      warnings.push(`Block ${block.index + 1} (Line ${lines[aLineIdx].lineNum}): Definition is empty`)
      return
    }

    cards.push({ front: term, back: definition })
  })

  return { cards, warnings }
}
