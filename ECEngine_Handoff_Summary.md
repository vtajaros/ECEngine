# ECEngine Architecture & Design Summary

## Purpose
ECEngine is a high-performance, specialized desktop study environment for Electronics Engineering licensure preparation. It combines active recall (MCQs/Flashcards) with algorithmic spaced repetition (SM2) and AI-assisted content analysis.

## Tech Stack
- **Framework**: Electron 31 + Vite
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **State Management**: Zustand (Session, Settings, Progress)
- **Database**: SQLite3 (accessed via Electron IPC `dbService` layer)
- **Animations**: Framer Motion
- **Icons**: Lucide React

## Core Modules & Features

### 1. Database & Persistence Layer (`/src/services/db.service.ts`)
- All DB operations pass through a central service using `window.electron.db`.
- **SM2 Implementation**: Algorithm handles scheduling (repetitions, interval, ease factor).
- **Time Tracking**: Automatic study duration logging via `study_activity`.
- **Subject Categorization**: Tracks Mathematics (MATH), General Engineering (GEAS), Electronics (ELECS), and Systems (EST).

### 2. Study Engine (`/src/components/mcq/`)
- **Learn Mode**: Partitioned learning flow (5-card blocks) that forces mastery (retrying wrong cards until flawless) before moving to the next set.
- **Test Mode**: Simulates board exams with timer, "mark for review," and instant checking options.
- **Progress Wiring**: Real-time persistence of performance data to the SM2 engine via `recordCardResult`.

### 3. Analytics & Progress Dashboard (`/src/pages/Dashboard.tsx`)
- **Activity Monitoring**: GitHub-style heatmap showing study time over the last 6 months.
- **Accuracy Trend**: Intelligent chart switching:
    - `ALL`: Shows 14-day global accuracy trend from `study_activity`.
    - `SUBJECT`: Shows cumulative accuracy per subject (Progress → Cards → Topics join).
- **Exam Countdown**: Dynamic timer targeting the next board exam date.

### 4. Content Architecture (`/content/`)
- Topics and Card data are imported/seeded from local JSON files.
- Supports Mixed Decks: MCQ and Flashcard types within the same topic.
- Dynamic MCQ Generation: Flashcards can be automatically converted into MCQs with distractor generation.

## Key Files for Review
- `src/services/db.service.ts`: The source of truth for all data flow.
- `src/lib/sm2.ts`: The spaced repetition logic.
- `electron/db/schema.sql`: Database structure (Topics, Cards, Progress, Activity).
- `src/pages/Dashboard.tsx`: Primary analytics implementation.

## Governance & Rules
- **No HEX**: All colors must use CSS variables from `theme.css`.
- **Type Safety**: No `any` types allowed; strict TypeScript enforcement.
- **Access**: Strictly no direct `window.electron` calls outside of service layers.
