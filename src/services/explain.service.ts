/**
 * explain.service.ts
 * Routes Groq API calls through the Electron main process via IPC.
 * Groq uses an OpenAI-compatible request format for ultra-fast inference.
 */

export function getApiKey(): string {
  // 1. Check Developer Environment Key (injected by Vite at build time)
  if (import.meta.env.VITE_GROQ_API_KEY) {
    return import.meta.env.VITE_GROQ_API_KEY
  }
  if (import.meta.env.VITE_GROK_API_KEY) {
    return import.meta.env.VITE_GROK_API_KEY
  }

  // 2. Fallback to User-Saved Key in localStorage
  const savedKey = localStorage.getItem('ecengine_groq_key')
  if (savedKey && savedKey.trim() !== '') {
    return savedKey.trim()
  }

  // 3. Neither exists
  throw new Error('NO_KEY')
}

export interface ExplainParams {
  question: string
  choices: string[]
  correctAnswerIndex: number
}

export async function getExplanation(params: ExplainParams): Promise<string> {
  // Throws 'NO_KEY' if no key is configured
  const apiKey = getApiKey()

  // Route through Electron main process IPC to bypass renderer CSP/sandbox
  const result = await (window as any).electron.explainQuestion({
    question: params.question,
    choices: params.choices,
    correctAnswerIndex: params.correctAnswerIndex,
    apiKey,
  })

  if (result.error) {
    throw new Error(result.error)
  }

  if (!result.text) {
    throw new Error('API_ERROR')
  }

  return result.text
}
