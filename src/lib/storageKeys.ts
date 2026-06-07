/**
Central registry of all localStorage keys used in ECEngine.
Always import from here — never hardcode key strings inline.
*/
export const STORAGE_KEYS = {
// TTS
TTS_VOICE:           'ecengine:tts:voice',
TTS_ENABLED:         'ecengine:tts:enabled',
FLASH_TTS_ENABLED:   'ecengine:flash:tts:enabled',

// UI state
SHOW_FORMULA_BANK:   'ecengine:show-formula-bank',
SOUNDS_MUTED:        'ecengine:sounds:muted',
WRONG_SOUND_ENABLED: 'ecengine:wrongSound:enabled',

// Flashcard viewer
FC_BOOKMARKS:        'fc_bookmarks',

// Dashboard
EXAM_DATE:           'ecengine_exam_date',
PREBOARD_DATE:       'ecengine_preboard_date',
} as const
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]
