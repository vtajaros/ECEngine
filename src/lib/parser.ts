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

export function parseSmartMCQ(text: string) {
  if (!text) return []

  const results: { question: string; choices: string[]; answer: number; explanation: string }[] = []
  const normalized = text.replace(/\r\n/g, '\n')
  
  // Try finding blocks starting with a number and dot `1. ` or `1) `
  const blocks = normalized.split(/\n(?=\d+[\.\)])/g)
  
  for (const block of blocks) {
    if (!block.trim()) continue
    
    let question = ''
    const choices: string[] = []
    let answerIndex = 0
    let explanation = 'Imported from smart text.'

    // Grab question until first option
    const qMatch = block.match(/^(?:\d+[\.\)]\s*)?([\s\S]+?)(?=\n\s*(?:[A-Ea-e][\.\)]))/s)
    if (qMatch) {
      question = qMatch[1].trim()
    } else {
      question = block.split('\n')[0].trim() // Fallback
    }

    // Extract all choices starting with A. B. C. D.
    const choiceRegex = /\n\s*([A-Ea-e])[\.\)]\s*([^\n]+)/g
    let match
    while ((match = choiceRegex.exec(block)) !== null) {
       choices.push(match[2].trim())
    }

    // Extract Answer
    const ansMatch = block.match(/\n\s*(?:Answer|Ans)[\s:=]*([A-Ea-e])/i)
    if (ansMatch) {
      const letter = ansMatch[1].toUpperCase()
      answerIndex = letter.charCodeAt(0) - 65
    }

    // Explanation
    const expMatch = block.match(/\n\s*(?:Explanation|Rationale)[\s:=]*([\s\S]+)$/i)
    if (expMatch) {
      explanation = expMatch[1].trim()
    }

    if (question && choices.length >= 2) {
      results.push({ question, choices, answer: answerIndex >= 0 && answerIndex < choices.length ? answerIndex : 0, explanation })
    }
  }

  return results
}

