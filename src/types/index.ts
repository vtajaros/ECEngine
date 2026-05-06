export type CardType = 'flashcard' | 'mcq' | 'formula' | 'concept'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Card {
  id: string
  topicId: string
  type: CardType
  data: FlashcardData | MCQData | FormulaData | ConceptData
  difficulty: Difficulty
  tags: string[]
  isCustom: boolean
  createdAt: string
}

export interface FlashcardData {
  front: string
  back: string
  imageFront?: string
  imageBack?: string
  imagePath?: string
}

export interface MCQData {
  question: string
  choices: string[]
  answer: number
  explanation: string
  imagePath?: string
  yearAsked?: number
}

export interface FormulaData {
  name: string
  latex: string
  variables: Record<string, string>
  imagePath?: string
}

export interface ConceptData {
  title: string
  body: string
  image?: string
  imagePath?: string
}

export interface Progress {
  cardId: string
  easeFactor: number
  interval: number
  repetitions: number
  nextReview: string
  lastReviewed: string
}

export interface Topic {
  id: string
  name: string
  subject: string
  parentId: string | null
  orderIndex: number
  createdAt?: number
  tags?: string[]
}

export interface ExamSession {
  id: string
  topicId?: string
  mode: 'practice' | 'mock' | 'custom'
  startedAt: string
  finishedAt?: string
  score: number
  total: number
  answers: Record<string, number>
}
