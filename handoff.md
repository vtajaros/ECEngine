# ECEngine Handoff Context

This document is intended for AI chat agents to quickly get up to speed with the `ECEngine` project.

## 1. Project Overview
ECEngine is a native, offline-first desktop application designed for Philippine Electronics Engineering (ECE) board exam preparation.
- **Tech Stack**: Electron 31, React 18, Vite, TypeScript, Tailwind CSS, Better-SQLite3.
- **It is NOT a web application.** All backend logic runs through Electron's IPC bridge into a local SQLite database (`ecengine.sqlite`). Do not write web-specific code (like using `window.localStorage` heavily when the DB is preferred, or `fetch()` for internal data).

## 2. UI & Design System
- **Theme**: Cyberpunk-inspired, highly tactical interface.
- **Typography**: 
  - `Orbitron` / `Rajdhani` (Headers, Titles, UI Labels)
  - `IBM_Plex_Mono` / `JetBrains Mono` (Data, Numbers, Tables, Code/Monospace)
- **Colors**: Deep dark backgrounds (`#050505`, `#080808`, `#0c0c0c`), neon accents. Do NOT use Tailwind generic colors unless instructed. Rely on existing CSS variables in `src/styles/theme.css` (e.g. `var(--bg-primary)`) or explicit hex values mimicking the cyberpunk feel.
- **Subject Colors**: Handled in `src/lib/subjectColors.ts`. MATH (Amber), GEAS (Blue), ELECS (Red), EST (Green).
- **Icons**: `lucide-react`.

## 3. Architecture & Data Flow
```text
React Components -> Zustand / React State -> src/services/db.service.ts -> window.electron.db -> electron/ipc/ -> Better-SQLite3
```
- **Frontend Service Layer**: `src/services/db.service.ts` is the single source of truth for interacting with the database from the React layer.
- **Backend IPCs**: Defined in `electron/ipc/`.
- **Database Schema**: Handled in `electron/db/`.
- **Data Models**: Types are strictly defined in `src/types/index.ts`. Specifically, `CardData` is a union of `FlashcardData | MCQData | FormulaData | ConceptData`.

## 4. Key Directories
- `src/pages/`: Contains major views like `Dashboard`, `FlashcardViewer` (Deck Browser), `FlashcardStudy` (LooksFam / active recall engine), `Formulas`, `ExamMode`, and `TOSTracker`.
- `src/components/ui/`: Reusable UI components.
- `content/`: JSON files acting as the seed content for the database.
- `electron/`: Main process files (main.ts, preload.ts, ipc/, db/).

## 5. Development Workflow
- **Run dev server**: `npm run dev` (Starts Vite + Electron).
- **Compile DB**: `npm run seed` (Parses JSON in `content/` to SQLite).
- **TypeScript Checking**: `npx tsc --noEmit` (Always ensure TS builds cleanly).

## 6. Recent Refactors
- `TOSTracker.tsx` was heavily refactored for a centralized and responsive layout.
- Subject filter buttons across the app (Deck editor, Viewers) were unified to use the Review Checklist style with `getSubjectFilterClasses()`.
- Added `isLoading` state handling across viewers to prevent empty state flashes while querying the database.
- Print to PDF handlers in `electron/ipc/print.ipc.ts` were updated to conform to Electron 31 typings (`margins` object instead of `marginType`).
- **Cross-Platform TTS Architecture**: Web Speech API is used natively on Windows/macOS. For Linux, a custom Piper neural TTS backend was integrated via `electron/ipc/tts.ipc.ts` and the `window.electron.tts` IPC bridge.
- **`useTTS.ts` additions**: Exposes `speakWithCallback(text, onEnd)` to abstract away platform differences. It coordinates with either the native Web Speech API or the Piper IPC backend, ensuring `onEnd` fires reliably for the Autoplay feature.
- **Autoplay feature** added to `FlashcardViewer.tsx` only:
  - `isAutoplay` boolean state + `autoplayRef` (timer, activeIndex, phase, isNewCard) + `autoplaySpeechDoneRef` manage the sequence without race conditions.
  - Single sequencer `useEffect` (deps: `[isAutoplay, isFlipped, currentIndex, activeDeck]`): waits for TTS to finish via `speakWithCallback`, then applies a post-speech delay (front: 1 s, back: 1 s, new-card gap: 2 s) before flipping or advancing.
  - Manual navigation (`goNext`, `goPrev`, Space/ArrowUp/ArrowDown keys) stops autoplay immediately.
  - Written mode disables the AUTO button entirely.
  - AUTO button (Play/Pause icon) is rendered before the TTS toggle in the top bar.
- **Keyboard shortcuts**: `ArrowUp` and `ArrowDown` now flip the card (same behaviour as Space).
- **3D card flip animation**: The card uses a CSS `rotateY` 3D flip (`transformStyle: preserve-3d`, `backfaceVisibility: hidden`, `WebkitBackfaceVisibility: hidden` on both faces). Front and back are always in the DOM — no conditional render. Duration: 0.5 s cubic-bezier.
- **Card transition animation**: `AnimatePresence + motion.div` slides cards horizontally (`x: ±30`, 0.2 s `easeOut`) instead of the previous vertical fade.
- **Visual fixes**: Back face border normalised to `border-[#222]` (was incorrectly green). Nav Prev/Next buttons wrapped in a persistent `h-[52px]` container so the card never jumps when they appear. TTS and Settings2 top-bar buttons updated to `px-3 py-1.5` to match SWAP/AUTO height.
- **Typography updates**: `Formulas.tsx` and `TestMode.tsx` headers updated to use `Rajdhani` and standardized sizing/colors to match `FlashcardViewer`.
- **AI Handlers**: Added 15-second timeouts with `AbortController` to Groq API calls in `electron/ipc/ai.ipc.ts` to prevent IPC channel freezing on dropped connections.
- **Navigation Stability**: Fixed a navigation lock bug where `useBlocker` gets stuck when aborting a learn mode or test session. Blocker is now synchronously reset on exit.
- **Async I/O Optimization**: Replaced synchronous `fs.*` calls in `ipcMain.handle` with `fs/promises` equivalents to prevent blocking the main thread during large file exports and DB backups.
- **Fix 13 — FlashcardLearn.tsx decomposition COMPLETE**
  - Original: 1544 lines, 32 useState, 13 useEffect (god component)
  - Result:
    - `src/pages/FlashcardLearn.tsx` — 821 lines (state orchestrator)
    - `src/components/flashcard/FlashcardSession.tsx` — 349 lines (active study UI)
    - `src/components/flashcard/FlashcardDeckBrowser.tsx` — 328 lines (deck browser UI)
    - `src/components/flashcard/StudyCard.tsx` — 224 lines (3D card + written mode)
    - `src/components/deck/AdvancedFiltersPopover.tsx` — 152 lines (filter popover)
    - `src/components/deck/DeckCard.tsx` — 149 lines (deck card, React.memo)
  - Validation: `tsc --noEmit` zero errors post-refactor.
- **Fix 14 — Tailwind token unification COMPLETE**
  - Scope: 49 files, 1127 instances replaced
  - New tokens added to `tailwind.config.ts`: `surface`, `surface-2`, `border-base`, `border-subtle`, `text-primary`, `text-muted`, `accent`, `warn`, `danger`
  - Residuals intentionally left: `#333`, `#111`, `#555`, `#FF003C` and other component-specific one-off values.
  - Validation: `tsc --noEmit` zero errors.
- **Grid Stability**: Rewrote `DeckGrid.tsx` to use `@tailwindcss/container-queries` (`@container` and `@[1080px]:grid-cols-2`) for responsive 2-column caps without fragile viewport-based JS or CSS `calc()` boundary math.
- **LooksFam Restructure**: Updated `LooksFamStudy.tsx` bottom row to use a flexible, unified layout for mastery bars (`flex-1`) and action buttons (`shrink-0`), matching `DeckCard.tsx`.
- **Print Window Fixes**: Isolated `printWindow` zoom from `mainWindow` by forcing `setZoomFactor(1)` on load, and fixed a Linux KDE/KWin stacking bug by toggling `alwaysOnTop: false` before opening the Save to PDF dialog.
- **Global Zoom Controls**: Added `Ctrl+Mousewheel` discrete zoom stepping via a throttled listener in `AppShell.tsx`, delegating to a centralized `applyZoomIndex()` in `main.ts`. Capped max zoom at 130%.
- **Config & DB Stability**: Fixed a race condition in `config.ipc.ts` by consolidating configuration writes into a single asynchronous Promise queue. Added `closeDB()` in `database.ts` to cleanly close the `better-sqlite3` instance and avoid orphaned WAL files on quit.
- **Dashboard Zoom Layout**: Adjusted `Dashboard.tsx` root container to allow vertical and horizontal scrolling when the UI is scaled up via zoom controls, preventing content clipping and flex-squeeze.
- **UI Terminology**: Standardized "Add [Type] Set" buttons to "Add [Type] Deck" across all major tabs.

## 7. Strict Rules
- **DO NOT** introduce arbitrary inline styles unless absolutely necessary for dynamic layout (e.g., progress bars). Use Tailwind classes.
- **DO NOT** change `onClick` logic or data structure shapes when performing visual redesigns.
- **ALWAYS** check `src/types/index.ts` before modifying data objects to avoid TypeScript errors.
- **DO NOT** add a second sequencer `useEffect` for autoplay — the single effect pattern with `autoplaySpeechDoneRef` is intentional to prevent stale closure race conditions.
