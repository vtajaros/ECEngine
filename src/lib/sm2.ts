export function calculateSM2(
  quality: number,
  repetitions: number,
  previousInterval: number,
  previousEaseFactor: number
) {
  let easeFactor = previousEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (easeFactor < 1.3) easeFactor = 1.3

  let interval = 1
  let nextRepetitions = repetitions

  if (quality < 3) {
    nextRepetitions = 0
    interval = 1
  } else {
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(previousInterval * easeFactor)
    }
    nextRepetitions = repetitions + 1
  }

  return { interval, repetitions: nextRepetitions, easeFactor }
}

