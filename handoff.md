# ECEngine Handoff Context

This document is intended for AI chat agents to quickly get up to speed with the `ECEngine` project.

## 1. Project Overview
ECEngine is a native, offline-first desktop application designed for Philippine Electronics Engineering (ECE) and Electronics Technician (ECT) board exam preparation.
- **Tech Stack**: Electron 31, React 18, Vite, TypeScript, Tailwind CSS, Better-SQLite3.
- **AI Integration**: Groq API (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`) for step-by-step problem explanations, automated deck descriptions, and live rate-limit telemetry.
- **Audio Engines**: Web Speech API on Windows/macOS; Piper neural ONNX TTS on Linux via ALSA (`aplay`).
- **It is NOT a web application.** All backend logic runs through Electron's IPC bridge into a local SQLite database (`ecengine.sqlite`). Do not write web-specific code (like using `window.localStorage` heavily when the DB is preferred, or `fetch()` for internal data).

## 2. UI & Design System
- **Theme**: Cyberpunk-inspired, highly tactical interface.
- **Typography**: 
  - `Orbitron`: Display headers, page titles, hero text, and alert banners.
  - `Rajdhani`: Primary UI interface, navigation, buttons, badges, MCQ question/choice cards, flashcards, and Test Paper View.
  - `JetBrains Mono`: All monospace data, numbers, charts, table reviews, code editors, AI explanations, and choice prefixes (`[A]`, `[B]`, `[C]`, `[D]`).
  - *(Note: `IBM Plex Mono` has been completely deprecated and removed from application code/styles in favor of `JetBrains Mono`)*
- **Colors**: Deep dark backgrounds (`#050505`, `#080808`, `#0c0c0c`), neon accents. Do NOT use Tailwind generic colors unless instructed. Rely on existing CSS variables in `src/styles/theme.css` (e.g. `var(--bg-primary)`) or semantic tokens in `tailwind.config.ts` (`surface`, `surface-2`, `border-base`, `border-subtle`, `text-primary`, `text-muted`, `accent`, `warn`, `danger`).
- **Subject Colors**: Handled in `src/lib/subjectColors.ts`. MATH (Amber), GEAS (Blue), ELECS (Red), EST (Green).
- **Icons**: `lucide-react`.

## 3. Architecture & Data Flow
```text
React Components -> Zustand / React State -> src/services/db.service.ts (or aiSummary.service.ts) -> window.electron.* -> electron/ipc/ -> Better-SQLite3 / Groq / Piper / Archiver
```
- **Frontend Service Layer**: `src/services/db.service.ts` is the single source of truth for interacting with the database from the React layer. `src/services/aiSummary.service.ts` handles AI deck description synthesis.
- **Backend IPC Modules** (`electron/ipc/`):
  - `deck.ipc.ts`: Topics/decks CRUD, folder CRUD, card counts, favorite toggling (`decks:toggleFavorite`, `decks:setFavorite`).
  - `db.ipc.ts`: Card retrieval, batch queries, search.
  - `ai.ipc.ts`: Problem explanations (`ai:explainProblem`), deck summary generation (`ai:summarizeDeck`), and rate-limit tracking (`ai:getUsageLimits`, `ai:refreshUsageLimits`).
  - `export.ipc.ts`: Database and media packaging (`export:dbAndImages`) for backups and Companion App sync.
  - `print.ipc.ts`: PDF generation with themed styles and Electron 31 margin typings.
  - `tts.ipc.ts`: Linux Piper ONNX TTS synthesis, voice discovery, and stream playback.
  - `config.ipc.ts`: Configuration Promise queue, API keys, paths, and audio preferences.
  - `progress.ipc.ts`: SM-2 spaced repetition state updates.
  - `stats.ipc.ts`: Daily study activity and subject accuracy metrics.
- **Database Schema**: Handled in `electron/db/schema.sql` and `electron/db/database.ts`. Incremental schema migrations are tracked via SQLite `PRAGMA user_version` (currently v9).
- **Data Models**: Types are strictly defined in `src/types/index.ts`. Specifically, `CardData` is a union of `FlashcardData | MCQData | FormulaData | ConceptData`.

## 4. Key Directories
- `src/pages/`: Main application views:
  - `Dashboard.tsx`: Study activity heatmap, accuracy trends, countdown timer, session history.
  - `FlashcardLearn.tsx`: Decomposed orchestrator for flashcard study sessions and deck browsing.
  - `LooksFamStudy.tsx`: MCQ Learn Mode and Test Mode runner with bookmark modal and choice shuffling.
  - `Formulas.tsx`: Formula bank, LaTeX study sessions, and formula deck browser.
  - `ExamMode.tsx`: Timed board exam simulation runner.
  - `TOSTracker.tsx`: PRC Table of Specifications interactive review checklist.
  - `PrintView.tsx`: Test paper and mock exam document viewer with PDF export.
  - `Settings.tsx`: System settings, AI API keys & rate limits, audio volume, Piper voice manager, database paths.
  - `AddDeck.tsx` / `EditDeck.tsx`: Deck metadata authoring with AI description generator.
  - `ImportBackup.tsx`: Quizlet and plaintext bulk card import.
- `src/components/ui/`: Reusable UI components (`Tooltip` with auto-flipping collision detection, `VolumeControl`, `FolderPanel` with favorites filtering, `ExplanationPanel`, `TOSTracker`, `Toast`, `ZoomIndicator`).
- `src/components/deck/`: Deck authoring components (`DeckCard` with favorite star toggle, `DeckMetadataForm` with `AIDescriptionButton`, `AdvancedFiltersPopover`, `CardEditor`, `CardForms`, `ImportModals`, `DeckGrid`).
- `src/components/flashcard/`: Decomposed flashcard study components (`FlashcardSession`, `FlashcardDeckBrowser`, `StudyCard`, `FlashCardSettingsModal`, `FlashcardContextPanel`).
- `src/components/mcq/`: MCQ practice components (`MCQCard`, `LearnMode`, `TestMode`, `BookmarkedCardsModal`, `LearnSettingsModal`, `TestSettingsModal`).
- `src/services/`: `db.service.ts` (primary DB interface) and `aiSummary.service.ts` (Groq summary orchestration).
- `content/`: JSON files acting as the seed content for the database.
- `electron/`: Main process files (`main.ts`, `preload.ts`, `ipc/`, `db/`).

## 5. Development Workflow
- **Run dev server**: `npm run dev` (Starts Vite + Electron).
- **Compile DB**: `npm run seed` (Parses JSON in `content/` to SQLite).
- **TypeScript Checking**: `npx tsc --noEmit` (Always ensure TS builds cleanly).

## 6. Recent Refactors & Features
- **SM-2 Spaced Repetition Engine & Keyboard-Driven Study Workflow**:
  - Implemented 4-grade SuperMemo-2 algorithm (`src/lib/sm2.ts`): Again (1, lapse reset), Hard (2, -20% interval), Good (3, progression ladder), and Easy (4, +0.15 EF boost).
  - Database queries in `electron/db/database.ts` (`getCardsWithProgress` / `getDueCards`) filter due cards (`next_review <= today` or `NULL`), prioritizing unreviewed cards and deferring future items.
  - Separate progress pathways: `data:saveProgress` for full SM-2 scheduling vs `data:recordCardResult` for lightweight MCQ stats.
  - Keyboard study hotkeys: `1-4` for ratings, `Space`/`Enter` to advance, `Space`/`ArrowUp`/`ArrowDown` for flipping and collapsible explanations, `F` for Term/Def swap.
  - Immediate audio cutoff on rating / navigation to stop active TTS streams and prevent sound bleed.
  - End-to-end multi-session integration tests in `electron/db/sm2.integration.test.ts`.
- **Favorite Decks System (Migration v9 & UI Integration)**:
  - Added `is_favorite BOOLEAN DEFAULT 0` column to `topics` table with index `idx_topics_is_favorite`.
  - Auto-migration v9 in `electron/db/database.ts` ensures backward-compatible upgrades on startup.
  - IPC handlers `decks:toggleFavorite` and `decks:setFavorite` in `electron/ipc/deck.ipc.ts`.
  - Frontend services: `dbService.toggleTopicFavorite(topicId)` and `dbService.setTopicFavorite(topicId, isFavorite)`.
  - UI components:
    - Interactive star toggle on `DeckCard.tsx` with cyber-gold hover/active states.
    - Dedicated "Favorites" filter button with counter badge in `FolderPanel.tsx`.
    - "Favorites Only" toggle switch in `AdvancedFiltersPopover.tsx`.
    - Synchronized favorite toggling and filtering across `FlashcardDeckBrowser`, `FlashcardLearn`, `Formulas`, and `LooksFamStudy`.
- **AI-Powered Deck Description / Topic Summary Generation**:
  - Added `ai:summarizeDeck` IPC handler using Groq API (`openai/gpt-oss-120b`). Formats sampled cards (up to 40 cards across MCQs, flashcards, and formulas) and prompts model to output concise topic phrases (<12 words) without introductory filler.
  - Added `AIDescriptionButton.tsx` and `aiSummary.service.ts` for one-click auto-generation in `DeckMetadataForm` (Add/Edit Deck views).
- **Groq API Rate Limit & Usage Monitoring Dashboard**:
  - Live usage monitoring in `Settings.tsx` displaying requests and tokens per minute rate limits.
  - IPC handlers `ai:getUsageLimits` and `ai:refreshUsageLimits` in `electron/ipc/ai.ipc.ts` intercepting `x-ratelimit-*` headers from Groq responses.
  - Cyberpunk dashboard with percentage usage bars, warning states (>85%), and dynamic countdown timers for rate-limit window resets.
- **Smart Collision Detection & Auto-Flipping Tooltips**:
  - Overhauled `src/components/ui/Tooltip.tsx` with dynamic bounding box collision detection and multi-axis auto-flipping (top/bottom and left/right).
  - Eliminates off-screen clipping and container boundary issues within nested components like `FolderPanel.tsx`.
- **Master Audio Volume Control & SFX Customization**:
  - Added `VolumeControl.tsx` popup slider component for global SFX volume adjusting.
  - Persisted volume level in `useSound.ts`.
  - Added toggle in `Settings.tsx` for custom wrong-answer meme sound ("faah sound meme") vs default synthesized tone.
- **Database & Asset Export for Companion App**:
  - Integrated `electron/ipc/export.ipc.ts` with `archiver` for one-click bundling of `ecengine.sqlite` and diagram assets (`ece-images.zip`) to sync with the ECEngine Android companion app.
- **LaTeX Engine Enhancements**:
  - Improved `src/lib/latex.ts` handling of mixed prose, lists, currency symbols, and parenthesized algebraic super/subscript expressions (`e^(v - u)`, `f_(n + 1)`).
- **Fix 13 — FlashcardLearn.tsx decomposition COMPLETE**:
  - Original: 1544 lines, 32 useState, 13 useEffect (god component).
  - Result:
    - `src/pages/FlashcardLearn.tsx` — state orchestrator.
    - `src/components/flashcard/FlashcardSession.tsx` — active study UI.
    - `src/components/flashcard/FlashcardDeckBrowser.tsx` — deck browser UI.
    - `src/components/flashcard/StudyCard.tsx` — 3D card + written mode.
    - `src/components/deck/AdvancedFiltersPopover.tsx` — filter popover.
    - `src/components/deck/DeckCard.tsx` — memoized deck card.
- **Fix 14 — Tailwind token unification COMPLETE**:
  - Replaced ad-hoc colors across 49 files with semantic tokens: `surface`, `surface-2`, `border-base`, `border-subtle`, `text-primary`, `text-muted`, `accent`, `warn`, `danger`.
- **Grid Stability**: Rewrote `DeckGrid.tsx` to use `@tailwindcss/container-queries` (`@container` and `@[1080px]:grid-cols-2`) for responsive 2-column caps without fragile viewport-based JS or CSS `calc()` boundary math.
- **Cross-Platform TTS Architecture**: Web Speech API natively on Windows/macOS. Piper ONNX neural TTS backend on Linux via `tts.ipc.ts`. `useTTS.ts` provides unified `speakWithCallback(text, onEnd)` abstraction.
- **Autoplay feature** in `FlashcardLearn.tsx` with single sequencer `useEffect` and `autoplaySpeechDoneRef` to prevent stale closure race conditions.
- **3D card flip & slide transitions**: `rotateY` 3D CSS flip with cubic-bezier timing and `AnimatePresence + motion.div` horizontal card transitions.
- **Print Window Fixes**: Isolated `printWindow` zoom from `mainWindow` by forcing `setZoomFactor(1)` on load, and fixed a Linux KDE/KWin stacking bug by toggling `alwaysOnTop: false` before opening the Save to PDF dialog.
- **Global Zoom Controls**: Added `Ctrl+Mousewheel` discrete zoom stepping via a throttled listener in `AppShell.tsx`, delegating to a centralized `applyZoomIndex()` in `main.ts` (capped at 130%).
- **Typography & Monospace Unification (IBM Plex Mono -> JetBrains Mono & Rajdhani)**:
  - Deprecated and eliminated all instances of `IBM Plex Mono` across 39+ files, standardizing on `JetBrains Mono` for all monospace contexts (`font-['JetBrains_Mono']`, `body: ['JetBrains Mono', 'monospace']` in `tailwind.config.ts`, `--font-body: 'JetBrains Mono', monospace;` in `theme.css`).
  - Switched the entire Test Paper View (`PrintView.tsx`) to `Rajdhani` sans-serif (18.5px question font, 17px choices, 15.5px explanations), matching interactive exam cards and improving readability.
  - Stabilized local font loading in `globals.css` with `font-display: block;` and ensured smooth, flicker-free window opening for `PrintView` via Electron's `ready-to-show` event with synchronous zoom scale initialization.

## 7. Strict Rules
- **DO NOT** introduce arbitrary inline styles unless absolutely necessary for dynamic layout (e.g., progress bars). Use Tailwind classes.
- **DO NOT** change `onClick` logic or data structure shapes when performing visual redesigns.
- **ALWAYS** check `src/types/index.ts` before modifying data objects to avoid TypeScript errors.
- **ALWAYS** route database queries through `src/services/db.service.ts` rather than calling Electron IPCs directly from React components.
- **DO NOT** add a second sequencer `useEffect` for autoplay — the single effect pattern with `autoplaySpeechDoneRef` is intentional to prevent stale closure race conditions.

