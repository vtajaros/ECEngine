const fs = require('fs');

// 1. src/types/index.ts
let typesContent = fs.readFileSync('src/types/index.ts', 'utf8');
typesContent = typesContent.replace(
  `  ease_factor?: number`,
  `  easeFactor?: number\n  repetitions?: number\n  interval?: number`
);
fs.writeFileSync('src/types/index.ts', typesContent);

// 2. src/store/useSessionStore.ts
let storeContent = fs.readFileSync('src/store/useSessionStore.ts', 'utf8');
storeContent = storeContent.replace(
  `      // Load prior SM2 state from DB; fall back to defaults on first review\r\n      const prior = await dbService.getProgress(currentCard.id)\r\n      const previousRepetitions = prior?.repetitions ?? 0\r\n      const previousInterval    = prior?.interval    ?? 1\r\n      const previousEaseFactor  = prior?.easeFactor  ?? 2.5`,
  `      // Load prior SM2 state from DB; fall back to defaults on first review\n      const previousRepetitions = currentCard.repetitions ?? 0\n      const previousInterval    = currentCard.interval    ?? 1\n      const previousEaseFactor  = currentCard.easeFactor  ?? 2.5`
);
fs.writeFileSync('src/store/useSessionStore.ts', storeContent);

// 3. src/services/db.service.ts
let dbContent = fs.readFileSync('src/services/db.service.ts', 'utf8');

// Update parseCardRow
const targetParseCardRow = `    createdAt: row.created_at != null ? String(row.created_at) : '',\n  }`;
const targetParseCardRowCRLF = `    createdAt: row.created_at != null ? String(row.created_at) : '',\r\n  }`;
const replaceParseCardRow = `    createdAt: row.created_at != null ? String(row.created_at) : '',\n    easeFactor: row.ease_factor,\n    repetitions: row.repetitions,\n    interval: row.interval,\n    correct_count: row.correct_count,\n    total_count: row.total_count,\n    last_result: row.last_result,\n  }`;

if (dbContent.includes(targetParseCardRowCRLF)) {
  dbContent = dbContent.replace(targetParseCardRowCRLF, replaceParseCardRow);
} else if (dbContent.includes(targetParseCardRow)) {
  dbContent = dbContent.replace(targetParseCardRow, replaceParseCardRow);
} else {
  console.error("Could not find parseCardRow end");
}

// Deprecate getProgress
const targetGetProgress = `  getProgress: async (cardId: string): Promise<{ repetitions: number; interval: number; easeFactor: number } | null> => {`;
const targetGetProgressCRLF = targetGetProgress.replace(/\n/g, '\r\n');
const replaceGetProgress = `  /** @deprecated SM-2 state is now preloaded via getCardsWithProgress.\n   *  Only kept for any legacy callers. Do not use in new code. */\n  getProgress: async (cardId: string): Promise<{ repetitions: number; interval: number; easeFactor: number } | null> => {`;

if (dbContent.includes(targetGetProgressCRLF)) {
  dbContent = dbContent.replace(targetGetProgressCRLF, replaceGetProgress);
} else if (dbContent.includes(targetGetProgress)) {
  dbContent = dbContent.replace(targetGetProgress, replaceGetProgress);
} else {
  console.error("Could not find getProgress declaration");
}

fs.writeFileSync('src/services/db.service.ts', dbContent);

// 4. src/pages/FlashcardStudy.tsx
let studyContent = fs.readFileSync('src/pages/FlashcardStudy.tsx', 'utf8');

const targetMapBlock1 = `        id: card.id,\r\n        ease_factor: card.ease_factor ?? 2.5,\r\n        correct_count: card.correct_count ?? 0,\r\n        total_count: card.total_count ?? 0,\r\n        last_result: card.last_result ?? null,`;
const replaceMapBlock1 = `        id: card.id,\n        easeFactor: card.easeFactor ?? 2.5,\n        repetitions: card.repetitions ?? 0,\n        interval: card.interval ?? 1,\n        correct_count: card.correct_count ?? 0,\n        total_count: card.total_count ?? 0,\n        last_result: card.last_result ?? null,`;

// Note: Replace all occurrences of targetMapBlock1
studyContent = studyContent.split(targetMapBlock1).join(replaceMapBlock1);

// Now the LF version if CRLF not found
const targetMapBlock1LF = targetMapBlock1.replace(/\r\n/g, '\n');
studyContent = studyContent.split(targetMapBlock1LF).join(replaceMapBlock1);

const targetMapBlock2 = `        id: r.id, topicId: 'custom', type: 'mcq', difficulty: 'medium', tags: [], isCustom: true, data: r.data,\r\n        ease_factor: r.ease_factor,\r\n        correct_count: r.correct_count,\r\n        total_count: r.total_count,\r\n        last_result: r.last_result,`;
const replaceMapBlock2 = `        id: r.id, topicId: 'custom', type: 'mcq', difficulty: 'medium', tags: [], isCustom: true, data: r.data,\n        easeFactor: r.easeFactor,\n        repetitions: r.repetitions,\n        interval: r.interval,\n        correct_count: r.correct_count,\n        total_count: r.total_count,\n        last_result: r.last_result,`;

studyContent = studyContent.split(targetMapBlock2).join(replaceMapBlock2);
const targetMapBlock2LF = targetMapBlock2.replace(/\r\n/g, '\n');
studyContent = studyContent.split(targetMapBlock2LF).join(replaceMapBlock2);

// There is one more usage in generateMCQs? No, we saw flashcards map: `const flashcards = rawCards.filter((r: any) => r.type !== 'mcq').map((r: any) => ({ ...r.data, id: r.id }))`
// Let's modify this to also include SM-2 fields so when we generate MCQs from flashcards we retain their repetitions, interval, easeFactor!
// Let's check `generateMCQs` implementation?
// The user prompt didn't say to fix generateMCQs, it only asked to modify useSessionStore!
// "STEP 3 — Update src/store/useSessionStore.ts in rateCard(): REPLACE WITH: currentCard.easeFactor..."
// If flashcard-generated MCQs don't have SM-2 state attached, they will default to 2.5, 0, 1 inside useSessionStore anyway.

fs.writeFileSync('src/pages/FlashcardStudy.tsx', studyContent);
console.log('done');
