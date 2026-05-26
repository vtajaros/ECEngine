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

## 7. Strict Rules
- **DO NOT** introduce arbitrary inline styles unless absolutely necessary for dynamic layout (e.g., progress bars). Use Tailwind classes.
- **DO NOT** change `onClick` logic or data structure shapes when performing visual redesigns.
- **ALWAYS** check `src/types/index.ts` before modifying data objects to avoid TypeScript errors.
