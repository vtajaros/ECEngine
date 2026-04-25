import { Card, FlashcardData, MCQData } from '../types'

const today = new Date().toISOString()

export const MOCK_FLASHCARDS: Card[] = [
  {
    id: 'f1',
    topicId: 'electronics',
    type: 'flashcard',
    difficulty: 'medium',
    tags: ['semiconductor', 'diode'],
    isCustom: false,
    createdAt: today,
    data: {
      front: 'What is the barrier potential of a silicon diode at room temperature?',
      back: 'Approximately 0.7V',
    } as FlashcardData
  },
  {
    id: 'f2',
    topicId: 'electronics',
    type: 'flashcard',
    difficulty: 'hard',
    tags: ['bjt', 'amplifiers'],
    isCustom: false,
    createdAt: today,
    data: {
      front: 'What is the relationship between $\\alpha$ and $\\beta$ in a BJT?',
      back: '$\\beta = \\frac{\\alpha}{1 - \\alpha}$',
    } as FlashcardData
  },
  {
    id: 'f3',
    topicId: 'electronics',
    type: 'flashcard',
    difficulty: 'easy',
    tags: ['current', 'charge'],
    isCustom: false,
    createdAt: today,
    data: {
      front: '1 Ampere is equal to how many Coulombs per second?',
      back: '1 Coulomb per second (1 A = 1 C/s)'
    } as FlashcardData
  },
  {
    id: 'f4',
    topicId: 'electronics',
    type: 'flashcard',
    difficulty: 'medium',
    tags: ['components'],
    isCustom: false,
    createdAt: today,
    data: {
      front: 'Which electronic component stores energy in an electric field?',
      back: 'Capacitor',
    } as FlashcardData
  },
  {
    id: 'f5',
    topicId: 'electronics',
    type: 'flashcard',
    difficulty: 'hard',
    tags: ['bjt', 'modes'],
    isCustom: false,
    createdAt: today,
    data: {
      front: 'In what region does a BJT operate when both junctions are forward-biased?',
      back: 'Saturation region',
    } as FlashcardData
  }
]

export const MOCK_MCQS: Card[] = [
  {
    id: 'm1',
    topicId: 'electronics',
    type: 'mcq',
    difficulty: 'medium',
    tags: ['components', 'diode'],
    isCustom: false,
    createdAt: today,
    data: {
      question: 'Which of the following describes a Zener diode?',
      choices: [
        'A diode designed to break down at a specific reverse voltage',
        'A diode that emits light when forward-biased',
        'A diode with a very low forward voltage drop',
        'A diode used exclusively for rectification'
      ],
      answer: 0,
      explanation: 'A Zener diode is heavily doped and designed to operate reliably in its reverse breakdown region.'
    } as MCQData
  },
  {
    id: 'm2',
    topicId: 'electronics',
    type: 'mcq',
    difficulty: 'hard',
    tags: ['op-amp'],
    isCustom: false,
    createdAt: today,
    data: {
      question: 'What is the ideal input impedance of an operational amplifier?',
      choices: [
        'Zero',
        '1 MΩ',
        'Infinity',
        '50 Ω'
      ],
      answer: 2,
      explanation: 'An ideal op-amp draws zero input current, hence it is considered to have infinite input impedance.'
    } as MCQData
  },
  {
    id: 'm3',
    topicId: 'electronics',
    type: 'mcq',
    difficulty: 'easy',
    tags: ['laws'],
    isCustom: false,
    createdAt: today,
    data: {
      question: "According to Ohm's Law, what happens to current if resistance is doubled while voltage remains constant?",
      choices: [
        'It doubles',
        'It halves',
        'It quadruples',
        'It remains the same'
      ],
      answer: 1,
      explanation: 'I = V / R. If R is doubled, I is halved.'
    } as MCQData
  },
  {
    id: 'm4',
    topicId: 'electronics',
    type: 'mcq',
    difficulty: 'medium',
    tags: ['bjt'],
    isCustom: false,
    createdAt: today,
    data: {
      question: 'In a bipolar junction transistor, the emitter is primarily responsible for:',
      choices: [
        'Collecting majority carriers',
        'Controlling the base current',
        'Emitting majority carriers into the base',
        'Acting as a heat sink'
      ],
      answer: 2,
      explanation: 'The emitter is heavily doped so it can emit a large number of majority carriers into the base region.'
    } as MCQData
  },
  {
    id: 'm5',
    topicId: 'electronics',
    type: 'mcq',
    difficulty: 'hard',
    tags: ['oscillators'],
    isCustom: false,
    createdAt: today,
    data: {
      question: 'The Barkhausen criterion for oscillation states that the loop gain magnitude must be:',
      choices: [
        'Zero',
        'Less than 1',
        'Equal to or greater than 1',
        'Infinity'
      ],
      answer: 2,
      explanation: 'For sustained oscillations, the loop gain must be ≥ 1 and the phase shift around the loop must be an integer multiple of 360°.'
    } as MCQData
  }
]
