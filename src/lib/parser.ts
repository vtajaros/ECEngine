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
    
    // Extract each labeled field
    const qLine = lines.find(l => l.startsWith('Q:'))
    const aLine = lines.find(l => l.startsWith('A:'))
    const bLine = lines.find(l => l.startsWith('B:'))
    const cLine = lines.find(l => l.startsWith('C:'))
    const dLine = lines.find(l => l.startsWith('D:'))
    const ansLine = lines.find(l => l.startsWith('ANS:'))
    
    // Validate all fields exist
    if (!qLine) { 
      warnings.push(`Block ${index + 1}: Missing Q: field`) 
      return 
    }
    if (!aLine || !bLine || !cLine || !dLine) { 
      warnings.push(`Block ${index + 1}: Missing one or more choices (A/B/C/D)`) 
      return 
    }
    if (!ansLine) { 
      warnings.push(`Block ${index + 1}: Missing ANS: field`) 
      return 
    }
    
    // Strip prefixes
    const question = qLine.substring(2).trim()
    const choices = [
      aLine.substring(2).trim(),
      bLine.substring(2).trim(),
      cLine.substring(2).trim(),
      dLine.substring(2).trim(),
    ]
    const answerLetter = ansLine.substring(4).trim().toUpperCase()
    
    // Convert answer letter to index
    const answerMap: Record<string, number> = { 
      'A': 0, 'B': 1, 'C': 2, 'D': 3 
    }
    const answer = answerMap[answerLetter]
    
    // Validate
    if (!question) { 
      warnings.push(`Block ${index + 1}: Question text is empty`) 
      return 
    }
    if (choices.some(c => !c)) { 
      warnings.push(`Block ${index + 1}: One or more choices are empty`) 
      return 
    }
    if (answer === undefined) { 
      warnings.push(`Block ${index + 1}: ANS must be A, B, C, or D. Got: ${answerLetter}`) 
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
    
    const qLine = lines.find(l => l.startsWith('Q:'))
    const aLine = lines.find(l => l.startsWith('A:'))
    
    if (lines.length !== 2 || !qLine || !aLine) {
      warnings.push(`Block ${index + 1}: Must have exactly two lines starting with Q: and A:`)
      return
    }
    
    const term = qLine.substring(2).trim()
    const definition = aLine.substring(2).trim()
    
    if (!term || !definition) {
      warnings.push(`Block ${index + 1}: Term or definition is empty`)
      return
    }
    
    cards.push({ front: term, back: definition })
  })
  
  return { cards, warnings }
}
