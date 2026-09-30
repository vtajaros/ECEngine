import { ipcMain, net } from 'electron'
import { resolveGroqApiKey } from './config.ipc'

const GROQ_MODEL = 'openai/gpt-oss-120b'

interface ExplainPayload {
  question: string
  choices: string[]
  correctAnswerIndex: number
}

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

export interface UsageLimits {
  limitRequests: number
  remainingRequests: number
  resetRequests: string
  limitTokens: number
  remainingTokens: number
  resetTokens: string
  lastUpdated: number
}

let cachedUsageLimits: UsageLimits | null = null

function captureRateLimits(headers: any): void {
  try {
    if (!headers) return
    const getHeader = (name: string): string | null => {
      if (typeof headers.get === 'function') return headers.get(name)
      return headers[name] || headers[name.toLowerCase()] || null
    }

    const limitReq = getHeader('x-ratelimit-limit-requests')
    const remReq = getHeader('x-ratelimit-remaining-requests')
    const resetReq = getHeader('x-ratelimit-reset-requests')
    const limitTok = getHeader('x-ratelimit-limit-tokens')
    const remTok = getHeader('x-ratelimit-remaining-tokens')
    const resetTok = getHeader('x-ratelimit-reset-tokens')

    if (limitReq && remReq) {
      cachedUsageLimits = {
        limitRequests: parseInt(limitReq, 10) || 0,
        remainingRequests: parseInt(remReq, 10) || 0,
        resetRequests: resetReq || '',
        limitTokens: parseInt(limitTok || '0', 10) || 0,
        remainingTokens: parseInt(remTok || '0', 10) || 0,
        resetTokens: resetTok || '',
        lastUpdated: Date.now(),
      }
    }
  } catch (e) {
    console.error('[ai.ipc] Failed to parse rate limit headers:', e)
  }
}

async function fetchFreshUsageLimits(apiKey: string): Promise<UsageLimits | null> {
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await net.fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
    })
    clearTimeout(timeout)
    captureRateLimits(response.headers)
    return cachedUsageLimits
  } catch (err) {
    clearTimeout(timeout)
    console.error('[ai:getUsageLimits] Ping error:', err)
    return cachedUsageLimits
  }
}

export function registerAIHandlers() {
  ipcMain.handle('ai:explain', async (_event, payload: ExplainPayload) => {
    const { question, choices, correctAnswerIndex } = payload

    const apiKey = resolveGroqApiKey()
    if (!apiKey) {
      return { error: 'NO_KEY' }
    }

    const correctAnswerText = choices[correctAnswerIndex]
    const correctAnswerLetter = String.fromCharCode(65 + correctAnswerIndex)
    const choicesText = choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join('\n')

    const userPrompt = [
      `QUESTION:`,
      question,
      '',
      `CHOICES:`,
      choicesText,
      '',
      `CORRECT ANSWER: ${correctAnswerLetter}. ${correctAnswerText}`,
      '',
      `Please provide a concise, professional explanation for an ECE board exam student.`,
      '',
      `STRICT FORMATTING RULES:`,
      `1. STRUCTURE:`,
      `   - **Explanation:** Always start with this header.`,
      `     - Direct Answer Justification: The first sentence MUST explicitly mention the correct answer's text and explain its specific role or why it is correct (e.g., "Hans Christian Oersted is correct because his 1820 experiment was the first to prove..."). Do NOT just say "The answer is D".`,
      `     - Ban Generic Filler: Strictly prohibit sentences like "This is essential for ECE students" or "Marking a significant milestone." If a sentence doesn't contain a technical fact, delete it.`,
      `     - Enumerated Lists: If the Explanation body lists multiple items (e.g. the five forces, steps, components), place EACH numbered item on its OWN LINE using the format "1. item\\n2. item\\n3. item". Do NOT write them inline as "(1) item, (2) item, (3) item".`,
      `   - **Key Formula:** Include this section ONLY if a mathematical calculation or specific formula is required. If conceptual, skip entirely. Do not write "N/A".`,
      `   - **Memory Tip:** Always end with this header. Provide a Mnemonic or Mental Hook (e.g., "Oersted = Observed magnetism first"). If a specific mnemonic isn't possible, provide a "Quick Fact" instead of generic advice.`,
      `2. LATEX: Wrap ALL mathematical formulas, equations, variables (like $V_{gs}$, $I_d$, or $\\mu$), and units in standard LaTeX delimiters ($ ... $ or $$ ... $$). ALWAYS use curly braces {} for multi-character subscripts and superscripts (e.g. write $H_{products}$ or $H_{\\text{products}}$, $V_{gs}$, $r^{3}$, NEVER $H_products$ or $V_gs$).`,
      `3. SEPARATION: Use exactly two newlines (\\n\\n) between sections.`,
      `4. CONSTRAINTS: Max 150 words. Ensure exponents ($r^3$) and subscripts ($V_{gs}$, $H_{products}$) render properly by enclosing multi-character subscripts/superscripts in braces {}.`,
      `5. LATEX REFERENCE:`,
      `   - JFET: $g_m = \\frac{\\Delta I_d}{\\Delta V_{gs}}$`,
      `   - Reluctance: $S = \\frac{l}{\\mu \\cdot A}$`,
      `   - APF: $APF = \\frac{n \\cdot \\frac{4}{3} \\pi r^3}{a^3}$`,
    ].join('\n')

    const endpoint = 'https://api.groq.com/openai/v1/chat/completions'

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const response = await net.fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
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

      clearTimeout(timeout)
      captureRateLimits(response.headers)

      if (!response.ok) {
        if (response.status === 401) return { error: 'INVALID_KEY' }
        if (response.status === 429) return { error: 'RATE_LIMITED' }
        const errBody = await response.text().catch(() => '')
        console.error('[ai:explain] Groq error:', response.status, errBody)
        return { error: 'API_ERROR', status: response.status, detail: errBody }
      }

      const data = (await response.json()) as GroqResponse
      const text = data?.choices?.[0]?.message?.content

      if (!text) return { error: 'API_ERROR', status: 200, detail: 'Empty response from model' }

      return { text: text.trim() }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { error: 'TIMEOUT' }
      }
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ai:explain] Network error:', message)
      return { error: 'NETWORK_ERROR', detail: message }
    }
  })

  ipcMain.handle('ai:explainFlashcard', async (_event, payload: { term: string; definition: string }) => {
    const { term, definition } = payload

    const apiKey = resolveGroqApiKey()
    if (!apiKey) {
      return { error: 'NO_KEY' }
    }

    const userPrompt = [
      `FLASHCARD:`,
      `Term: ${term}`,
      `Definition: ${definition}`,
      '',
      `You are an ECE board exam tutor. Provide a concise explanation to help the student deeply understand and remember this concept.`,
      '',
      `STRICT FORMATTING RULES:`,
      `1. STRUCTURE:`,
      `   - **Explanation:** Start with one sentence stating what the term IS and why it matters in ECE. Be specific — no filler.`,
      `   - **Key Formula or Example:** Include ONLY if a formula or concrete example clarifies the concept. Skip entirely if purely definitional.`,
      `   - **Memory Tip:** Always end with this. One mnemonic, analogy, or quick fact. Not generic advice.`,
      `2. LATEX: Wrap all math, variables, and units in $ ... $ delimiters. ALWAYS use curly braces {} for multi-character subscripts and superscripts (e.g. $H_{products}$, $V_{gs}$).`,
      `3. SEPARATION: Use exactly two newlines between sections.`,
      `4. CONSTRAINTS: Max 120 words. No filler sentences.`,
    ].join('\n')

    const endpoint = 'https://api.groq.com/openai/v1/chat/completions'

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 25000)
      const response = await net.fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: 800,
          temperature: 0.4,
        }),
      })

      clearTimeout(timeout)
      captureRateLimits(response.headers)

      if (!response.ok) {
        if (response.status === 401) return { error: 'INVALID_KEY' }
        if (response.status === 429) return { error: 'RATE_LIMITED' }
        const errBody = await response.text().catch(() => '')
        console.error('[ai:explainFlashcard] Groq error:', response.status, errBody)
        return { error: 'API_ERROR', status: response.status, detail: errBody }
      }

      const data = (await response.json()) as GroqResponse
      const text = data?.choices?.[0]?.message?.content

      if (!text) return { error: 'API_ERROR', status: 200, detail: 'Empty response from model' }

      return { text: text.trim() }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { error: 'TIMEOUT' }
      }
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ai:explainFlashcard] Network error:', message)
      return { error: 'NETWORK_ERROR', detail: message }
    }
  })

  ipcMain.handle('ai:summarizeDeck', async (_event, payload: {
    title?: string
    subject?: string
    cardItems: string[]
    totalCards: number
  }) => {
    const apiKey = resolveGroqApiKey()
    if (!apiKey) {
      return { error: 'NO_KEY' }
    }

    const { title = '', subject = '', cardItems = [], totalCards = 0 } = payload
    if (cardItems.length === 0) {
      return { error: 'NO_CONTENT', detail: 'No card content provided to summarize' }
    }

    const cardsText = cardItems.join('\n')
    const userPrompt = `DECK TITLE: ${title || 'Untitled Deck'}
SUBJECT: ${subject || 'General'}
TOTAL CARDS: ${totalCards || cardItems.length}

CARD SAMPLES:
${cardsText}

RULES:
1. Identify the top 2 to 4 most prominent topics in the deck.
2. Output ONLY the topics as a clean, concise phrase or comma-separated list (maximum 4 topics).
3. Strictly DO NOT include any introductory phrases, headers, or lead-ins (e.g., 'Key concepts in...', 'Overview of...', 'Covers...', 'Topics include:'). Get straight to the topics.
4. Keep it very short (strictly under 12 words).
5. Return ONLY the plain text description without quotes.`

    const endpoint = 'https://api.groq.com/openai/v1/chat/completions'

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      const response = await net.fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You generate ultra-short, direct topic summaries for flashcard decks (maximum 4 topics, strictly under 12 words). You NEVER use introductory phrases or headers. You get straight to the topics.',
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          max_tokens: 600,
          temperature: 0.1,
        }),
      })

      clearTimeout(timeout)
      captureRateLimits(response.headers)

      if (!response.ok) {
        if (response.status === 401) return { error: 'INVALID_KEY' }
        if (response.status === 429) return { error: 'RATE_LIMITED' }
        const errBody = await response.text().catch(() => '')
        console.error('[ai:summarizeDeck] Groq error:', response.status, errBody)
        return { error: 'API_ERROR', status: response.status, detail: errBody }
      }

      const data = (await response.json()) as GroqResponse
      let text = data?.choices?.[0]?.message?.content?.trim()

      if (!text) return { error: 'API_ERROR', status: 200, detail: 'Empty response from model' }

      // Strip leading/trailing quotation marks and any accidental header/lead-in prefixes
      text = text
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/^(key concepts in[^:]*|topics include|topics covered|overview of|covers|deck covers|main topics)\s*[:\-–—]?\s*/i, '')
        .trim()

      return { text }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { error: 'TIMEOUT' }
      }
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ai:summarizeDeck] Network error:', message)
      return { error: 'NETWORK_ERROR', detail: message }
    }
  })

  ipcMain.handle('ai:getUsageLimits', async () => {
    const apiKey = resolveGroqApiKey()
    if (!apiKey) {
      return { success: true, isConfigured: false, usage: null }
    }
    if (cachedUsageLimits) {
      return { success: true, isConfigured: true, usage: cachedUsageLimits }
    }
    const usage = await fetchFreshUsageLimits(apiKey)
    return { success: true, isConfigured: true, usage }
  })

  ipcMain.handle('ai:refreshUsageLimits', async () => {
    const apiKey = resolveGroqApiKey()
    if (!apiKey) {
      return { success: false, isConfigured: false, error: 'NO_KEY' }
    }
    const usage = await fetchFreshUsageLimits(apiKey)
    return { success: Boolean(usage), isConfigured: true, usage }
  })
}


