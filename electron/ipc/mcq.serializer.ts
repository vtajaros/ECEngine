// electron/ipc/mcq.serializer.ts
// Pure serialization logic extracted from the exportToText IPC handler.
// Zero side effects — no IPC, no filesystem, no dialog calls.
// Directly importable in tests without mocking anything.

const LETTER_MAP: Record<number, string> = Object.fromEntries(
    ['A', 'B', 'C', 'D', 'E', 'F'].map((l, i) => [i, l])
)
const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const VALID_LETTERS = new Set(CHOICE_LETTERS)

interface McqCardData {
    question?: unknown
    choices?: unknown
    answer?: unknown
}

/**
 * Serializes a single MCQ card's raw JSON data string into export text format.
 *
 * Returns null if the card should be skipped (missing question, empty choices,
 * unparseable JSON, or non-object data). Callers should filter nulls.
 *
 * Supports 1–6 choices. Answer key resolution order:
 *   1. Numeric index  → LETTER_MAP lookup
 *   2. Letter string  → direct use if in A–F
 *   3. Text string    → matched against choices array
 *   4. Fallback       → 'A'
 */
export function serializeMcqCard(rawData: string): string | null {
    if (!rawData || typeof rawData !== 'string' || rawData.trim() === '') return null

    let parsed: McqCardData
    try {
        parsed = JSON.parse(rawData)
    } catch {
        return null
    }

    if (!parsed || typeof parsed !== 'object') return null

    const question = (parsed.question != null ? String(parsed.question) : '').trim()
    if (!question) return null

    const rawChoices: unknown[] = Array.isArray(parsed.choices) ? parsed.choices : []
    if (rawChoices.length === 0) return null

    const choices: string[] = rawChoices.map(c => (c != null ? String(c) : '').trim())

    const ansVal = parsed.answer
    let ansLetter = 'A'

    if (typeof ansVal === 'number' && Number.isFinite(ansVal)) {
        ansLetter = LETTER_MAP[ansVal] ?? 'A'
    } else if (typeof ansVal === 'string') {
        const clean = ansVal.trim().toUpperCase()
        if (VALID_LETTERS.has(clean)) {
            ansLetter = clean
        } else {
            const matchedIdx = choices.findIndex(c => c.trim() === ansVal.trim())
            ansLetter = LETTER_MAP[matchedIdx] ?? 'A'
        }
    }

    const choiceLines = choices
        .map((c, i) => `${CHOICE_LETTERS[i]}: ${c}`)
        .join('\n')

    return `Q: ${question}\n${choiceLines}\nANS: ${ansLetter}`
}