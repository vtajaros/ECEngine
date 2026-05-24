/**
 * explain.service.ts
 * Routes Groq API calls through the Electron main process via IPC.
 * The API key is managed exclusively in the main process (config.ipc.ts).
 * The renderer never reads, stores, or transmits the key value.
 */

export interface ExplainParams {
  question: string
  choices: string[]
  correctAnswerIndex: number
}

export async function getExplanation(params: ExplainParams): Promise<string> {

  // Route through Electron main process IPC — key is resolved server-side only
  const result = await window.electron.explainQuestion({
    question: params.question,
    choices: params.choices,
    correctAnswerIndex: params.correctAnswerIndex,
    // apiKey intentionally omitted — main process reads it from userData/config.json
  })

  if (result.error === 'NO_KEY') {
    throw new Error('NO_KEY')
  }

  if (result.error) {
    throw new Error(result.error)
  }

  if (!result.text) {
    throw new Error('API_ERROR')
  }

  return result.text
}
