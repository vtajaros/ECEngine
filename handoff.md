---BEGIN HANDOFF RULES BLOCK---
HANDOFF RULES — FOR THE RECEIVING AI MODEL: READ BEFORE PROCEEDING

1. FILE PATHS ARE REQUIRED
   Every suggestion, fix, or refactor must cite the exact file path.
   Format: path/to/file.ext · line N (where applicable).

2. NO GIT COMMANDS
   Do not suggest, output, or reference any git commands unless the user
   explicitly says "give me a git command for this." Includes: git diff,
   git blame, git log, git stash, and all other git subcommands.

3. BASH SCRIPTS FOR LONG FILES
   If you need the full content of a file too long to be in context, output
   a bash script the user can run and paste results back. Do not infer or
   guess file contents you have not read.

4. STATE ALL UNCERTAINTIES EXPLICITLY
   If you are unsure about something, label it: [UNCERTAIN — reason].
   Do not present assumptions as facts.

5. MODEL RECOMMENDATIONS
   When suggesting a follow-up task, recommend the appropriate AI model:
   -> Deep reasoning / architecture / security -> Claude Sonnet (latest)
   -> Large codebase / full repo context     -> Gemini Pro (latest)
   -> Fast iterative fixes / low complexity  -> Gemini Flash (latest)
   -> Repetitive generation / boilerplate    -> Claude Haiku (latest)
   -> Test generation                        -> Claude Sonnet or Gemini Pro

6. NO FLUFF
   Omit preamble, affirmations, and filler. Every sentence must carry information.

7. SEVERITY TAGGING
   Tag all findings with one of:
   [CRITICAL] -- production-breaking or security risk
   [HIGH]     -- significant bug or data integrity risk
   [MEDIUM]   -- functional issue or maintainability concern
   [LOW]      -- style, naming, or minor cleanup
---END HANDOFF RULES BLOCK---

---

# STEP 1 -- WORKSPACE SNAPSHOT

```
ecengine/                              <- workspace root
.env                               <- [CONFIG] local dev env (ECE_IMAGES_PATH)
.env.example                       <- [CONFIG] stale: references VITE_GROQ_API_KEY (renderer pattern), actual key is main-process only
.gitignore / .gitattributes
.npmrc / .prettierrc / cspell.json
.native-node/                      <- [BUILD ARTIFACT] Node ABI copy of better-sqlite3 for vitest; exclude from audit
dist/ out/ node_modules/           <- [BUILD ARTIFACTS] exclude
ecengine.sqlite                    <- [DATA] dev SQLite file at workspace root -- see security note
ecengine.code-workspace / tsconfig.json / vitest.config.ts
package.json                       <- [CONFIG] deps + build targets
postcss.config.js / tailwind.config.ts / electron.vite.config.ts
README.md / todo.md / handoff.md
EE2022-10 TOS.pdf                  <- [ASSET]
content/                           <- [UNCERTAIN -- not explored]
public/ resources/ scripts/

electron/                          <- MAIN PROCESS
  main.ts                          <- [ENTRY] Electron main
  preload.ts                       <- [ENTRY] contextBridge IPC surface
  db/
    database.ts                    <- DB init, migrations, query helpers
    schedule.ts                    <- SM-2 scheduling SQL helpers
    schema.sql                     <- baseline schema (fresh installs)
    database.test.ts / schedule.test.ts / sm2.integration.test.ts
    seed/
  ipc/
    ai.ipc.ts                      <- Groq API calls
    config.ipc.ts                  <- app config, API key storage, paths
    db.ipc.ts / db.ipc.test.ts
    deck.ipc.ts                    <- deck/card/folder CRUD
    export.ipc.ts                  <- backup export/import, ZIP
    file.ipc.ts / image.ipc.ts / print.ipc.ts / stats.ipc.ts / tts.ipc.ts
    progress.ipc.ts                <- SM-2 + MCQ progress writes
    mcq.serializer.ts / mcq.serializer.test.ts
    [NO TESTS FOR]: ai, config, deck, export, file, image, print, stats, tts

src/                               <- RENDERER PROCESS
  main.tsx / App.tsx / router.tsx / vite-env.d.ts / index.html
  types/
    index.ts                       <- shared domain types
    window.d.ts                    <- electron IPC type declarations
  store/
    useSessionStore.ts             <- Zustand SM-2 session state
  services/
    db.service.ts                  <- renderer IPC wrapper + Zod validation
    aiSummary.service.ts / explain.service.ts
  hooks/
    useExamTimer.ts / useFolderState.ts / useIdleAwareTimer.ts
    useSound.ts / useTTS.ts
  lib/
    sm2.ts / scrambler.ts / sampling.ts / parser.ts / quizletParser.ts
    latex.ts / scheduleView.ts / subjectClassifier.ts (31 KB)
    formulaData.ts (34 KB) / tosData.ts (18 KB) / utils.ts / textUtils.ts
    constants.ts / dashboardUtils.ts / subjectColors.ts / scheduleView.ts
    [test files for most of the above]
  pages/ (13 files; largest: EditDeck 77 KB, Settings 75 KB, PrintView 67 KB, LooksFamStudy 65 KB)
  components/
    dashboard/ deck/ flashcard/ layout/ mcq/ study/ toc/ ui/
    deck/: CardForms 38 KB, ImportModals 39 KB
    flashcard/: FlashcardSession 31 KB
    mcq/: LearnMode 42 KB, TestMode 37 KB
```

**Summary:**
- ~90 source files, ~30 test files
- Languages: TypeScript (main), TSX (renderer)
- Framework: Electron 31 + React 18 + Vite (electron-vite) + TailwindCSS 3
- Database: better-sqlite3 (local SQLite only, no network DB)
- AI: Groq API (external, optional); TTS: piper binary (Linux only)
- Build targets: Windows NSIS, macOS DMG, Linux AppImage
- Exclude from audit: dist/, out/, node_modules/, .native-node/

---

# STEP 2 -- SYSTEM OVERVIEW

**Purpose:** Desktop Electron application for Filipino ECE (Electronics and Communications Engineering) board exam review. Provides SM-2 spaced-repetition flashcards, MCQ practice and test modes, formula banks, and AI-powered explanations via Groq.

**Architecture:** Electron two-process desktop monolith.
- Main process (electron/): owns SQLite DB, IPC handlers, AI HTTP, TTS subprocess, image protocol, filesystem.
- Renderer process (src/): React SPA, Zustand session state, service layer calling window.electron.* IPC.
- contextBridge with contextIsolation=true, nodeIntegration=false. IPC surface typed in src/types/window.d.ts.

**Main components:**

| File Path | Responsibility |
|---|---|
| electron/main.ts | App lifecycle, BrowserWindow, CSP, zoom, window controls |
| electron/preload.ts | contextBridge IPC surface (~50 channels) |
| electron/db/database.ts | SQLite init, versioned migrations, query helpers |
| electron/db/schedule.ts | SM-2 scheduling SQL expression builders |
| electron/ipc/deck.ipc.ts | Deck/card/folder CRUD, mastery queries |
| electron/ipc/progress.ipc.ts | SM-2 + MCQ progress writes, exam session records |
| electron/ipc/export.ipc.ts | Backup ZIP export/import, text export |
| electron/ipc/ai.ipc.ts | Groq API: explain MCQ, explain flashcard, summarize deck |
| electron/ipc/config.ipc.ts | API key storage, settings, path resolution |
| electron/ipc/tts.ipc.ts | piper TTS subprocess (Linux) |
| electron/ipc/image.ipc.ts | Image save via sharp, ece-app:// custom protocol |
| src/services/db.service.ts | Renderer IPC wrapper + Zod row validation |
| src/store/useSessionStore.ts | Zustand: active SM-2 session state + rateCard |
| src/lib/sm2.ts | SM-2 algorithm |
| src/lib/scrambler.ts | MCQ choice shuffling with positional-ref detection |
| src/lib/sampling.ts | Efraimidis-Spirakis weighted card sampling |
| src/lib/subjectClassifier.ts | Keyword-based subject classification (31 KB) |
| src/lib/parser.ts | Text/MCQ import parsers |
| src/router.tsx | HashRouter with lazy-loaded pages |
| src/pages/EditDeck.tsx | Deck editing (77 KB -- largest file) |

**External dependencies:**
- Groq API (https://api.groq.com) -- AI explanations; key stored in userData/config.json
- piper TTS binary (optional, Linux) -- spawned as subprocess
- No cloud DB, no auth service; fully offline except AI

**Deployment:** Windows (NSIS), macOS (DMG), Linux (AppImage)

---

# STEP 3 -- FUNCTIONALITY BREAKDOWN

### SM-2 Spaced Repetition (Flashcards)
- Files: src/lib/sm2.ts, src/store/useSessionStore.ts, electron/ipc/progress.ipc.ts, electron/db/schedule.ts
- 4-quality ratings (Again/Hard/Good/Easy). Local date strings for scheduling (avoids UTC shift).
- Inputs: quality (1-4), prior SM-2 state from DB. Outputs: updated ease_factor, interval, repetitions, next_review written to progress table.
- Zustand submission lock (isSubmitting) prevents concurrent writes.

### MCQ Learn / Test Modes
- Files: src/components/mcq/LearnMode.tsx (42 KB), src/components/mcq/TestMode.tsx (37 KB), electron/ipc/progress.ipc.ts
- Learn mode partitions cards into rounds, reruns missed. Test mode is timed/untimed with exam UX.
- partitionCards() is tested; choice shuffling via scrambler.ts; weighted sampling via sampling.ts.

### Deck/Card CRUD
- Files: electron/ipc/deck.ipc.ts, src/pages/AddDeck.tsx, src/pages/EditDeck.tsx, src/components/deck/CardForms.tsx
- Full CRUD for topics + cards. Zod schema validation at IPC boundary. Folder hierarchy (max depth 1) via folders table.
- better-sqlite3 transactions for atomicity. resolveOrCreateFolderId() handles legacy string-to-FK migration.

### AI Integration
- Files: electron/ipc/ai.ipc.ts, src/services/aiSummary.service.ts, src/services/explain.service.ts
- Groq API (openai/gpt-oss-120b): explain MCQ answer, explain flashcard term, summarize deck content.
- AbortController timeouts (15 s / 25 s / 30 s). API key never sent to renderer.

### Export / Import
- Files: electron/ipc/export.ipc.ts
- JSON backup (topics + cards + progress), selective deck export, ZIP archive of DB + images via archiver.
- Import runs in a DB transaction. Zod validates import payloads.

### TTS (Linux piper)
- Files: electron/ipc/tts.ipc.ts, src/hooks/useTTS.ts
- Shells out to piper via aplay pipeline. Web Speech API fallback on Windows/macOS.
- Real-time PCM volume scaling via Transform stream. killAllTTSChildren() on before-quit.

### Image Management
- Files: electron/ipc/image.ipc.ts
- sharp resize + webp conversion. ece-app:// custom protocol. Path-traversal guard.
- Extension allowlist, case-insensitive lookup (Linux), 24 h cache headers.

---

# STEP 4 -- CODE QUALITY ASSESSMENT

**Naming:** Consistent camelCase / PascalCase / snake_case for DB. IPC channels follow domain:action.

**any type usage (IPC boundaries):**
- electron/preload.ts . lines 9, 16, 24, 35, 49
- electron/ipc/deck.ipc.ts . line 70
- src/services/db.service.ts . line 454

**Oversized files:**
- src/pages/EditDeck.tsx . 77 KB [MEDIUM]
- src/pages/Settings.tsx . 75 KB [MEDIUM]
- src/pages/PrintView.tsx . 67 KB [MEDIUM]
- src/pages/LooksFamStudy.tsx . 65 KB [MEDIUM]
- src/lib/subjectClassifier.ts . 31 KB (acceptable if data-driven) [LOW]

**Duplication:**
- resolveOrCreateFolderId: electron/ipc/deck.ipc.ts . line 70 AND electron/ipc/export.ipc.ts . line 59. Identical SQL, different names. [MEDIUM]
- parseChar helper: src/lib/parser.ts . lines 4-11 AND lines 34-41. [LOW]
- Date padding (n) => String(n).padStart(2, '0'): src/services/db.service.ts (lines 47, 145, 277) AND src/store/useSessionStore.ts . line 74. [LOW]

**Magic values:**
- electron/ipc/ai.ipc.ts . lines 74, 141, 296 -- model name 'openai/gpt-oss-120b' hardcoded 3x. [MEDIUM]
- electron/ipc/progress.ipc.ts . line 36 -- SM-2 defaults 2.5, 1, 0 in SQL. [LOW]
- src/lib/sampling.ts . line 15 -- accuracy default 0.5 and ease penalty 2.5. [LOW]

**SELECT * usage:**
- electron/ipc/deck.ipc.ts . line 94 -- SELECT * FROM topics [MEDIUM]
- electron/ipc/deck.ipc.ts . line 104 -- SELECT * FROM cards WHERE topic_id = ? [MEDIUM]

**Dead / stale code:**
- electron/db/database.ts . lines 249-255 -- saveDB() and flushDB() are no-ops. [LOW]
- src/services/db.service.ts . lines 99-113 -- getProgress() marked @deprecated but still callable. [LOW]
- .env.example . line 1 -- VITE_GROQ_API_KEY is stale; key is main-process only. [MEDIUM]

---

# STEP 5 -- BUGS & RISK AREAS

**electron/ipc/deck.ipc.ts . line 388 -- [HIGH] Lost card IDs on update**
When updateDeckWithCards handles card.isNew === true, it generates a new UUID via crypto.randomUUID() and ignores card.id from the renderer. Renderer may use that ID for local tracking. Mismatch causes orphaned cards on retry or cross-reference before re-fetch.

**electron/ipc/deck.ipc.ts . lines 406-420 -- [HIGH] decks:updateFolderOrder updates wrong table**
Updates topics.order_index WHERE folder_name = ? instead of folders.order_index WHERE name = ?. Sets all topics in a folder to the same order_index; does not order folders. Legacy behavior predating the folder table migration.

**electron/ipc/progress.ipc.ts . line 49 -- [MEDIUM] data:saveProgress missing Zod validation**
data:recordCardResult (line 26) uses RecordCardResultSchema.parse; data:saveProgress does not. Malformed payload throws an uncontrolled SQLite error.

**electron/ipc/config.ipc.ts . line 194 -- [MEDIUM] Object.assign merges arbitrary renderer settings**
config:updateSettings does Object.assign(config, settings) on a Partial<AppConfig> that includes groqApiKey and dbPath. A renderer bug could overwrite the API key or DB path through this channel.

**src/hooks/useExamTimer.ts . line 21 -- [MEDIUM] Stale interval reference on countdown end**
clearInterval called inside setSeconds functional updater on a stale closure reference. Under React 18 Strict Mode, two intervals can run simultaneously. Fix: useRef for interval ID.

**electron/ipc/ai.ipc.ts . line 64 -- [MEDIUM] Timeout abort silently returns stale cache**
In fetchFreshUsageLimits: if AbortController fires, catch returns cachedUsageLimits (possibly null) without error signal, masking the timeout.

**electron/ipc/image.ipc.ts . line 98 -- [LOW] Silent catch(e) {} in directory listing**
Filesystem errors during case-insensitive filename lookup swallowed silently. Should log.

**src/lib/parser.ts . line 164 -- [MEDIUM] parseImportedMCQs returns any[]**
Bypasses TypeScript. Downstream casts to Card['data'] are unsafe if parsed shape diverges from MCQData.

**electron/db/database.ts . lines 203-207 -- [LOW] Migration catch too broad**
'duplicate column name' catch could also swallow CREATE INDEX name conflicts. Should scope to ALTER TABLE statements only.

**src/store/useSessionStore.ts . line 90 -- [LOW] Post-await state re-read pattern**
get().sessionStats re-read after await dbService.saveProgress(). Safe only because isSubmitting guard prevents concurrency, but guard relies on a single boolean, not a queue.

---

# STEP 6 -- PERFORMANCE & SCALABILITY

**electron/ipc/deck.ipc.ts . line 274 -- [MEDIUM] Large mastery CTE**
decks:getFormulaMastery runs a multi-CTE full scan over all cards + progress. No compound index on (topic_id, type). idx_cards_topic_id exists but does not cover type.

**electron/ipc/deck.ipc.ts . line 331 -- [LOW] Chunked IN clause (positive)**
500-item IN chunks for getBookmarkCountsByTopic is correct for SQLite limits.

**src/lib/subjectClassifier.ts -- [UNCERTAIN] Eager load cost**
31 KB keyword map on renderer side. Should be lazy-imported.

**src/pages/EditDeck.tsx . 77 KB -- [UNCERTAIN] Render performance on large decks**
Internal structure not fully read. Without useMemo/useCallback or virtualization, 200+ card decks may be sluggish.

**electron/ipc/tts.ipc.ts -- [LOW] PCM transform on main thread**
Volume transform runs per audio chunk on main process event loop. Negligible in practice.

**electron/db/database.ts -- [LOW] WAL + synchronous=NORMAL (positive)**
Appropriate for desktop SQLite.

---

# STEP 7 -- SECURITY REVIEW

**.env . line 1 -- [LOW] Developer absolute path committed**
ECE_IMAGES_PATH=/home/delata/.config/ECEngine/ece-images leaks filesystem structure. [UNCERTAIN -- whether .gitignore excludes it]

**electron/main.ts . line 70 -- [MEDIUM] 'unsafe-inline' in CSP script-src**
Allows XSS via injected inline scripts. dompurify usage reduces risk. Should use nonces.

**electron/ipc/config.ipc.ts . line 194 -- [HIGH] Settings handler can overwrite groqApiKey**
Object.assign(config, settings) allows renderer to silently overwrite API key or DB path. Suggested fix:
```
const SAFE_SETTINGS = ['examDate', 'preboardDate', 'katexScale', 'katexBold', 'sidebarCollapsed', 'showFormulaBank']
const safe = Object.fromEntries(Object.entries(settings).filter(([k]) => SAFE_SETTINGS.includes(k)))
Object.assign(config, safe)
```

**electron/ipc/config.ipc.ts . lines 310-318 -- [LOW] shell:openExternal allowlist**
Correctly allows only console.groq.com and groq.com.

**electron/ipc/image.ipc.ts . lines 104-109 -- [LOW] Path traversal guard**
Correctly implemented with resolve() + startsWith(resolvedImagesDir + sep).

**electron/ipc/ai.ipc.ts -- [LOW] No input length cap on AI payloads**
No max-length guard before sending to Groq. Users only harm their own quota, but hygiene fix recommended.

**ecengine.sqlite -- [MEDIUM] Dev SQLite at workspace root**
94 KB file present. [UNCERTAIN -- whether .gitignore excludes it] If committed, exposes study data.

**electron/ipc/tts.ipc.ts -- [LOW] User-supplied model path to piper CLI**
Path from renderer localStorage. [UNCERTAIN -- whether directory traversal validation exists in unread portion]

---

# STEP 8 -- TESTING & COVERAGE

Tests are co-located with source files (no __tests__/ directory).

| Test file | Type | Target |
|---|---|---|
| electron/db/database.test.ts | Integration | DB init, migrations, helpers |
| electron/db/schedule.test.ts | Unit | SM-2 scheduling SQL |
| electron/db/sm2.integration.test.ts | Integration | End-to-end SM-2 |
| electron/ipc/db.ipc.test.ts | Unit | IPC handler registration |
| electron/ipc/mcq.serializer.test.ts | Unit | MCQ serialization |
| src/services/db.service.test.ts | Unit | Renderer service layer |
| src/services/aiSummary.service.test.ts | Unit | AI summary service |
| src/store/useSessionStore.test.ts | Unit | Zustand session store |
| src/hooks/useSound.test.ts | Unit | Sound hook |
| src/lib/latex.test.ts | Unit | LaTeX processing |
| src/lib/parser.test.ts | Unit | Import parsers |
| src/lib/scheduleView.test.ts | Unit | Schedule view helpers |
| src/lib/scrambler.test.ts | Unit | Choice scrambling |
| src/lib/sm2.test.ts | Unit | SM-2 algorithm |
| src/lib/subjectClassifier.test.ts | Unit | Subject classifier |
| src/components/mcq/LearnMode.test.ts | Unit | partitionCards function |

Test types: Unit, Integration. No E2E, no snapshot tests.

**Coverage estimates:**

| Module | Coverage |
|---|---|
| src/lib/sm2.ts | HIGH |
| src/lib/scrambler.ts | HIGH |
| src/lib/parser.ts | HIGH |
| src/lib/subjectClassifier.ts | HIGH |
| electron/db/database.ts | HIGH |
| electron/db/schedule.ts | HIGH |
| src/lib/sampling.ts | MEDIUM [UNCERTAIN -- no sampling.test.ts found] |
| src/store/useSessionStore.ts | MEDIUM |
| src/services/db.service.ts | MEDIUM |
| electron/ipc/deck.ipc.ts | NONE |
| electron/ipc/progress.ipc.ts | NONE |
| electron/ipc/export.ipc.ts | NONE |
| electron/ipc/ai.ipc.ts | NONE |
| electron/ipc/config.ipc.ts | NONE |
| electron/ipc/tts.ipc.ts | NONE |
| electron/ipc/image.ipc.ts | NONE |
| src/pages/* (all 13) | NONE |
| src/components/* | NONE (except partitionCards) |
| src/hooks/useTTS.ts | NONE |
| src/hooks/useExamTimer.ts | NONE |

**Critical untested paths:**
- electron/ipc/export.ipc.ts -- backup import/export, data integrity critical [HIGH]
- electron/ipc/deck.ipc.ts -- all CRUD + mastery computation [HIGH]
- electron/ipc/progress.ipc.ts -- data:saveProgress and data:recordCardResult [HIGH]
- electron/ipc/config.ipc.ts -- API key storage, settings merge [HIGH]
- src/lib/sampling.ts -- weighted card sampling [MEDIUM]

**Suggested tests to add:**
1. electron/ipc/deck.ipc.ts -- integration: addDeckWithCards, updateDeckWithCards, folders:delete cascade
2. electron/ipc/progress.ipc.ts -- unit: data:saveProgress with malformed payload
3. electron/ipc/export.ipc.ts -- round-trip: export deck -> import -> verify card count + progress
4. src/lib/sampling.ts -- edge cases: all-zero weights, all-equal weights, n >= cards.length
5. src/hooks/useExamTimer.ts -- countdown behavior, interval cleanup on unmount

---

# STEP 9 -- IMPROVEMENT OPPORTUNITIES

## [HIGH IMPACT . LOW EFFORT]

**1. Fix config:updateSettings allowlist**
- electron/ipc/config.ipc.ts . line 194
- Replace Object.assign(config, settings) with explicit safe-key merge. 5-line fix.
- Prevents API key / DB path corruption via the settings channel.

**2. Deduplicate resolveOrCreateFolderId**
- electron/ipc/deck.ipc.ts . line 70 and electron/ipc/export.ipc.ts . line 59
- Extract to electron/db/folderHelpers.ts; import in both IPC files.

**3. Hoist AI model name to a constant**
- electron/ipc/ai.ipc.ts . lines 74, 141, 296
- const GROQ_MODEL = 'openai/gpt-oss-120b' at module top.

**4. Add Zod validation to data:saveProgress**
- electron/ipc/progress.ipc.ts . line 49
- Define SaveProgressSchema analogous to RecordCardResultSchema in this file.

**5. Fix useExamTimer stale interval reference**
- src/hooks/useExamTimer.ts . line 17
- Use useRef<number | null>(null) outside effect; clear via intervalRef.current.

**6. Update .env.example**
- .env.example . line 1
- Replace stale VITE_GROQ_API_KEY with comment explaining in-app key management.

## [HIGH IMPACT . HIGH EFFORT]

**7. Split large page components**
- src/pages/EditDeck.tsx, src/pages/Settings.tsx, src/pages/LooksFamStudy.tsx, src/pages/PrintView.tsx
- Extract sub-sections into child components in src/components/.
- Required for testability and AI-assisted editing within context windows.

**8. Integration test suite for IPC handlers**
- electron/ipc/deck.ipc.ts, electron/ipc/progress.ipc.ts, electron/ipc/export.ipc.ts
- Use in-memory SQLite (:memory:) to test full handler behavior without mocking.

**9. Replace SELECT * with explicit columns**
- electron/ipc/deck.ipc.ts . lines 94, 104

## [LOW IMPACT . LOW EFFORT]

**10. Remove dead no-op functions**
- electron/db/database.ts . lines 249-255 (saveDB, flushDB)

**11. Deduplicate date-padding helper**
- src/services/db.service.ts . lines 47, 145, 277 and src/store/useSessionStore.ts . line 74
- Extract to src/lib/dateUtils.ts as padDate(n: number): string

**12. Deduplicate parseChar**
- src/lib/parser.ts . lines 4-11 and 34-41

**13. Type parseImportedMCQs return value**
- src/lib/parser.ts . line 164
- Replace any[] with MCQData[] from src/types/index.ts

---

# STEP 10 -- ACTIONABLE NEXT STEPS

| # | Task | File Path(s) | Model | Complexity | Depends on |
|---|---|---|---|---|---|
| 1 | Fix config:updateSettings allowlist | electron/ipc/config.ipc.ts . line 194 | Gemini Flash | S | -- |
| 2 | Fix useExamTimer stale interval ref | src/hooks/useExamTimer.ts . line 17 | Gemini Flash | S | -- |
| 3 | Hoist AI model constant | electron/ipc/ai.ipc.ts . lines 74, 141, 296 | Gemini Flash | S | -- |
| 4 | Add Zod to data:saveProgress | electron/ipc/progress.ipc.ts . line 49 | Gemini Flash | S | -- |
| 5 | Deduplicate resolveOrCreateFolderId | electron/ipc/deck.ipc.ts . line 70, electron/ipc/export.ipc.ts . line 59 | Gemini Flash | S | -- |
| 6 | Fix decks:updateFolderOrder (wrong table) | electron/ipc/deck.ipc.ts . lines 406-420 | Claude Sonnet | M | -- |
| 7 | Fix lost card IDs on updateDeckWithCards | electron/ipc/deck.ipc.ts . line 388 | Claude Sonnet | M | -- |
| 8 | Replace SELECT * with explicit columns | electron/ipc/deck.ipc.ts . lines 94, 104 | Gemini Flash | S | -- |
| 9 | Integration tests: deck CRUD + folder cascade | electron/ipc/deck.ipc.ts | Claude Sonnet or Gemini Pro | L | 5 |
| 10 | Integration tests: progress IPC | electron/ipc/progress.ipc.ts | Claude Sonnet | M | 4 |
| 11 | Round-trip export/import integration test | electron/ipc/export.ipc.ts | Claude Sonnet | M | -- |
| 12 | Unit tests for sampling.ts | src/lib/sampling.ts | Claude Haiku | S | -- |
| 13 | Split EditDeck.tsx into sub-components | src/pages/EditDeck.tsx | Gemini Pro | XL | -- |
| 14 | Split Settings.tsx into sub-components | src/pages/Settings.tsx | Gemini Pro | XL | -- |
| 15 | Update .env.example | .env.example | Gemini Flash | S | -- |
| 16 | Add composite index (topic_id, type) on cards | electron/db/database.ts | Gemini Flash | S | -- |
| 17 | Type parseImportedMCQs return values | src/lib/parser.ts | Gemini Flash | S | -- |

---

# STEP 11 -- AI-OPTIMIZATION INSIGHTS

**1. Oversized files resist context-windowed editing**
src/pages/EditDeck.tsx (77 KB), Settings.tsx (75 KB), LooksFamStudy.tsx (65 KB), PrintView.tsx (67 KB). An AI editing one section cannot see the other sections. Splitting into named subcomponents is the single highest-leverage structural change for AI-assisted development.

**2. any types at IPC boundaries**
preload.ts and IPC handler files use payload: any extensively. AI reading only one side of the IPC has no type information for what the other side sends. Adding explicit TypeScript interfaces or Zod schemas to all channels enables correct cross-boundary reasoning.

**3. Implicit global window.electron surface**
src/types/window.d.ts and electron/preload.ts both declare the IPC contract. Must be manually kept in sync. AI edits to one will not update the other. The declaration file should be the single authoritative contract.

**4. Mixed naming on Card type**
src/types/index.ts . lines 30-32: correct_count, total_count, last_result are snake_case exceptions on an otherwise camelCase Card interface. Rename to correctCount, totalCount, lastResult and update all consumer sites.

**Documentation gaps:**
- electron/ipc/ai.ipc.ts -- No JSDoc on captureRateLimits or fetchFreshUsageLimits. Caching strategy is implicit.
- electron/ipc/deck.ipc.ts -- resolveOrCreateFolderId needs docstring explaining legacy string-vs-FK logic.
- src/lib/sampling.ts -- Weight formula (1 - accuracy) + easePenalty + lastWrong not documented.
- src/store/useSessionStore.ts -- isSubmitting lock semantics not documented.

**Patterns that resist AI refactoring:**
- Dynamic SQL via string concatenation: electron/db/database.ts . lines 314-339 append dueOrNewSql() and NEW_SQL from schedule.ts. AI modifying this without both files in context produces incorrect SQL.
- db.transaction(fn)() double-invocation: better-sqlite3 pattern. AI may remove second invocation. Add comment at each usage.
- CSP as 200+ char single-line string: electron/main.ts . line 70. Extract as named constant with one directive per line.

**Naming improvements:**
- useSessionStore.currentDeck -> sessionCards (prevents collision with deck domain concept)
- ExamSessionRecord -> StudySessionRecord (src/services/db.service.ts . line 509; mode accepts 'learn' | 'test' | 'exam')
- Card.isGenerated -> isSynthesizedMCQ or move to MCQData (MCQ-specific flag on union type confuses AI when iterating flashcard/formula cards)

---

# SUMMARY SCORECARD

| Metric | Score | Notes |
|---|---|---|
| CODE QUALITY | 6/10 | Well-structured IPC/renderer split; Zod on most boundaries; good migration system. Dragged down by oversized page files, duplicated helpers, any at IPC surface, SELECT * usage. |
| TEST COVERAGE | 4/10 | Core algorithm libraries well-tested. All IPC handlers (highest-risk surface) untested. All pages and components untested. |
| SECURITY POSTURE | 7/10 | contextIsolation=true, nodeIntegration=false. API key never returned to renderer. Path traversal guard on image protocol. unsafe-inline CSP and config:updateSettings overwrite risk lower score. |
| SCALABILITY | 6/10 | SQLite + WAL appropriate for desktop. Multi-CTE mastery query will slow at scale. Large static bundles add parse cost. Oversized pages degrade render performance on large card sets. |
| AI READABILITY | 4/10 | IPC surface typed via window.d.ts. snake_case exceptions on Card type, oversized files, duplicated helpers, and implicit window.electron global reduce AI model effectiveness. |
| OVERALL RISK | MEDIUM | Two HIGH-severity data integrity issues (updateFolderOrder, new card ID loss on update). One HIGH-severity security concern (updateSettings key overwrite). No hardcoded secrets in source. No known CVE-flagged versions visible in package.json. |
