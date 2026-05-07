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

Please provide a concise, professional explanation for an ECE board exam student.

STRICT FORMATTING RULES:
1. STRUCTURE:
   - **Explanation:** Always start with this header.
     - Direct Answer Justification: The first sentence MUST explicitly mention the correct answer's text and explain its specific role or why it is correct (e.g., "Hans Christian Oersted is correct because his 1820 experiment was the first to prove..."). Do NOT just say "The answer is D".
     - Ban Generic Filler: Strictly prohibit sentences like "This is essential for ECE students" or "Marking a significant milestone." If a sentence doesn't contain a technical fact, delete it.
   - **Key Formula:** Include this section ONLY if a mathematical calculation or specific formula is required. If conceptual, skip entirely. Do not write "N/A".
   - **Memory Tip:** Always end with this header. Provide a Mnemonic or Mental Hook (e.g., "Oersted = Observed magnetism first"). If a specific mnemonic isn't possible, provide a "Quick Fact" instead of generic advice.
2. LATEX: Wrap ALL mathematical formulas, variables (like $V_{gs}$, $I_d$, or $\mu$), and units in standard LaTeX delimiters ($ ... $).
3. SEPARATION: Use exactly two newlines (\\n\\n) between sections.
4. CONSTRAINTS: Max 150 words. Ensure exponents (r^3) and subscripts (V_gs) render naturally in LaTeX.
5. LATEX REFERENCE:
   - JFET: $g_m = \\frac{\\Delta I_d}{\\Delta V_{gs}}$
   - Reluctance: $S = \\frac{l}{\\mu \\cdot A}$
   - APF: $APF = \\frac{n \\cdot \\frac{4}{3} \\pi r^3}{a^3}$`

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
