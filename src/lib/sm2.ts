export function calculateSM2(
  quality: number,
  repetitions: number,
  previousInterval: number,
  previousEaseFactor: number
) {
  let easeFactor = previousEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (easeFactor < 1.3) easeFactor = 1.3

  let interval: number
  let nextRepetitions: number

  if (quality === 1) {
    // Again — full lapse: reset repetitions and interval
    nextRepetitions = 0
    interval = 1
  } else if (quality === 2) {
    // Hard — partial penalty: keep repetitions, reduce interval by 20%, min 1
    nextRepetitions = repetitions
    interval = Math.max(1, Math.round(previousInterval * 0.8))
  } else {
    // Good (3) or Easy (4) — success path
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(previousInterval * easeFactor)
    }
    nextRepetitions = repetitions + 1
  }

  // Bonus EF boost for Easy — compensates for formula neutral point at quality=4
  if (quality === 4) easeFactor = Math.min(easeFactor + 0.15, 4.0)

  return { interval, repetitions: nextRepetitions, easeFactor }
}

