<div align="center">
  <img src="resources/ecengine_icon.png" alt="ECEngine Logo" width="120" />
  <h1>⚡ ECEngine</h1>
  <p><strong>The Ultimate Board Exam Command Center for Philippine Electronics Engineering (ECE)</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/version-0.1.0-blue.svg" alt="version" />
    <img src="https://img.shields.io/badge/Electron-31.0-47848F.svg?logo=electron" alt="Electron" />
    <img src="https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6.svg?logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Database-SQLite-003B57.svg?logo=sqlite" alt="SQLite" />
  </p>
</div>

---

**ECEngine** is a high-performance, cyberpunk-inspired study ecosystem specifically engineered for the Philippine Electronics Engineering (ECE) Licensure Exam. It transforms traditional review into a high-octane engineering workflow, designed to help you dominate the board exams with offline-first capabilities, advanced spaced repetition, and in-depth analytics.

## 📑 Table of Contents

- [Features \& Capabilities](#-features--capabilities)
  - [Tactical Dashboard (Telemetry)](#tactical-dashboard-telemetry)
  - [LooksFam Study Hub (Core Engine)](#looksfam-study-hub-core-engine)
  - [Exam Simulation Mode](#exam-simulation-mode)
  - [Formulas \& Reference Laboratory](#formulas--reference-laboratory)
  - [Manifest Management (Import)](#manifest-management-import)
- [Architecture \& Tech Stack](#-architecture--tech-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development Commands](#development-commands)
- [Project Structure](#-project-structure)
- [Data Models \& Content](#-data-models--content)
- [Roadmap](#-roadmap)
- [AI Auditor Manifesto](#-ai-auditor-manifesto)

---

## 🚀 Features & Capabilities

### Tactical Dashboard (Telemetry)
The Dashboard provides a mission-control overview of your study progress:
- **Activity Heatmap**: Tracks your "Heartbeat" (time spent in app) across a dynamic 6-month window leading up to your exam. Colors saturate from deep green (1h) to neon green (4h+).
- **Performance Telemetry**: Real-time area charts visualize your accuracy trends, allowing you to pinpoint fatigue zones.
- **Subject Intelligence**: Dynamically calculates mastery percentage per core subject (**MATH**, **GEAS**, **ELECS**, **EST**) based on your internalized flashcards and MCQ scores.
- **Mission Countdown**: A high-precision digital clock counting down to the target board exam date.

### LooksFam Study Hub (Core Engine)
A high-performance flashcard and study system:
- **Advanced Spaced Repetition (SM-2)**: Implements the SuperMemo-2 algorithm to calculate your next review date based on performance (Again/Hard/Good/Easy).
- **Multi-Modal Review**: Seamlessly toggle between **Learn** (partitioned repetition), **Test** (full simulation), and **Mixed** modes.
- **Synchronous Navigation**: Features a frame-perfect scroll tracking system in Test Mode, built for zero-lag navigation in high-density question banks.
- **AI Explainer (✨)**: Breaks down engineering solutions into theoretical foundation, mathematical derivation, and distractor rationale.

### Exam Simulation Mode
- Custom exams based on selected topics from the ECE taxonomy tree.
- Configure item count (25, 50, 100) and specific time limits.
- Randomized MCQ order and shuffled choices with no answer reveals during the exam to emulate real PRC conditions.
- Post-exam summary with score analytics, item-by-item explanations, and retry options.

### Formulas & Reference Laboratory
- **Expanded LaTeX Engine**: Robust rendering for complex ECE equations using KaTeX. Automatically translates non-standard commands to KaTeX equivalents.
- **SVG Hardening**: Custom DOMPurify profiles ensure complex radicals and fraction bars are accurately displayed without being stripped.
- **Mastery Tracking**: Visual data parity across all reference decks ensuring formulas are memorized alongside MCQs.

### Manifest Management (Import)
Easily expand your study base:
- **Intelligent Parser**: Ingests raw text, TSV (Anki-style), structured JSON, or Quizlet exports.
- **Cyberpunk Folder System**: Organize your custom decks into hierarchical folders with color-coded tags.
- **Navigation Protection**: Integrates `useBlocker` to prevent accidental data loss during active study sessions.

---

## 🏗 Architecture & Tech Stack

ECEngine is built to be a robust, offline-first application that runs primarily on desktop via Electron, but shares the same React SPA codebase for web deployments.

* **UI Framework**: React 18 + Vite
* **Desktop Shell**: Electron 31 (Chromium + Node.js)
* **Styling**: Tailwind CSS + Custom CSS Variables (Cyberpunk Theme)
* **State Management**: Zustand 4.5 (Flux Architecture)
* **Database (Desktop)**: SQLite 3 via `better-sqlite3` (IPC bridged)
* **Database (Web)**: IndexedDB via `dexie`
* **Math Rendering**: KaTeX + MathLive
* **Animations**: Framer Motion (60FPS optimized)

The database routing is platform-agnostic, seamlessly routing queries to SQLite when running in Electron, and IndexedDB when running in a web browser.

---

## 🛠 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/ecengine.git
   cd ecengine
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Seed the Local Database:**
   Populate your SQLite database with the pre-built ECE content:
   ```bash
   npm run seed
   ```

### Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Electron app in development mode with HMR. |
| `npm run dev:web` | Start the application as a standard web SPA. |
| `npm run build` | Build the Electron application and React assets. |
| `npm run package` | Package the app into an executable (Windows/Mac/Linux). |
| `npm run validate-content` | Run schema validation on the `content/` JSON files. |
| `npm run test` | Run Vitest test suites. |

---

## 📂 Project Structure

```text
ecengine/
├── content/              # Source of truth JSON files (Topics, MCQs, Formulas)
├── electron/             # Electron main process, Preload scripts, SQLite DB IPC
├── src/                  # React Frontend (Desktop & Web Shared)
│   ├── assets/           # Fonts, Icons, Images
│   ├── components/       # Reusable UI (Cards, Layouts, Forms)
│   ├── hooks/            # Custom React Hooks
│   ├── lib/              # SM-2 logic, LaTeX parsers, constants
│   ├── pages/            # Application Views (Dashboard, Flashcards, ExamMode)
│   ├── services/         # Platform-agnostic DB routing and data access layer
│   ├── store/            # Zustand global state slices
│   └── styles/           # Tailwind globals, Cyberpunk CSS variables
├── scripts/              # DB Seeding and Content Validation
└── package.json
```

---

## 📊 Data Models & Content

ECEngine uses a structured JSON schema for its source content, which is then compiled into SQLite/IndexedDB.
Content is divided by core subjects (Mathematics, Electronics, Communications, GEAS).

Example of a natively supported JSON payload:
```json
{
  "topic": "Semiconductor Devices",
  "subject": "Electronics Engineering",
  "mcqs": [
    {
      "id": "sd-mcq-001",
      "question": "A silicon diode has a forward voltage drop of approximately:",
      "choices": ["0.3V", "0.7V", "1.1V", "1.4V"],
      "answer": 1,
      "explanation": "Silicon PN junctions have a built-in potential of ~0.7V.",
      "tags": ["diode", "silicon"],
      "difficulty": "easy"
    }
  ]
}
```

---

## 🗺 Roadmap

- **Phase 1: Persistence & Sync (In Progress)**
  - Cloud Sync (Supabase) for cross-device progress.
  - Automated encrypted local/cloud backups.
- **Phase 2: AI & Analytics**
  - Integrated AI chat sidebar for in-depth card explanations.
  - Predictive accuracy modeling for board exam scores.
- **Phase 3: Community & Content**
  - Global leaderboards and "Speed-Run" rankings.
  - Public Manifest Gallery for downloading shared community decks.
- **Phase 4: UI/UX Refinement**
  - Theming Engine for cyberpunk sub-themes (e.g., "Night City", "Matrix").
  - Interactive 3D Components via Three.js for circuit visualizations.

---

## 🤖 AI Auditor Manifesto

For developers and AI agents contributing to this codebase:
1. **Never Hardcode Hex**: Always use existing CSS variables (e.g., `var(--accent-primary)`).
2. **DB Integrity**: Proxied database access must go through `db.service.ts` exclusively. Do not call Node APIs directly from the React renderer.
3. **Cyberpunk Aesthetic**: High contrast and technical monospaced fonts (`Orbitron`, `Rajdhani`, `IBM Plex Mono`) are mandatory. No soft pastels.

---

<div align="center">
  <i>Developed for the Engineers of 2026. Non sibi sed aliis.</i>
</div>
