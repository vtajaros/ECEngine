import { ipcMain, net } from 'electron'

interface ExplainPayload {
  question: string
  choices: string[]
  correctAnswerIndex: number
  apiKey: string
}

// Groq OpenAI-compatible response shape
interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

export function registerAIHandlers() {
  ipcMain.handle('ai:explain', async (_event, payload: ExplainPayload) => {
    const { question, choices, correctAnswerIndex, apiKey } = payload

    const correctAnswerText = choices[correctAnswerIndex]
    const correctAnswerLetter = String.fromCharCode(65 + correctAnswerIndex)
    const choicesText = choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join('\n')

    const userPrompt = `QUESTION:
${question}

CHOICES:
${choicesText}

CORRECT ANSWER: ${correctAnswerLetter}. ${correctAnswerText}

Please provide a concise explanation (2-3 sentences), the key formula/principle, and a one-sentence board exam memory tip.
Constraint: Plain text only, max 150 words.`

    const endpoint = 'https://api.groq.com/openai/v1/chat/completions'

    try {
      const response = await net.fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a professional ECE (Electronics and Communications Engineering) tutor helping Filipino students prepare for the PRC board exam. Be concise, accurate, and practical.',
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        }),
      })

      if (!response.ok) {
        if (response.status === 401) return { error: 'INVALID_KEY' }
        if (response.status === 429) return { error: 'RATE_LIMITED' }
        const errBody = await response.text().catch(() => '')
        console.error('[ai:explain] Groq error:', response.status, errBody)
        return { error: 'API_ERROR' }
      }

      const data = (await response.json()) as GroqResponse
      const text = data?.choices?.[0]?.message?.content

      if (!text) return { error: 'API_ERROR' }

      return { text: text.trim() }
    } catch (err) {
      console.error('[ai:explain] Network error:', err)
      return { error: 'API_ERROR' }
    }
  })
}
