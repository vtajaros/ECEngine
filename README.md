<div align="center">
  <img src="resources/ecengine_icon.png" alt="ECEngine Logo" width="120" />
  <h1>⚡ ECEngine</h1>
  <p><strong>The Ultimate Cyberpunk-Utility Study Command Center for the Philippine Electronics Engineering (ECE) Licensure Exam</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/version-1.0.0-00FF41.svg?style=flat-square" alt="version" />
    <img src="https://img.shields.io/badge/Electron-31.0-47848F.svg?style=flat-square&logo=electron" alt="Electron" />
    <img src="https://img.shields.io/badge/React-18.3-61DAFB.svg?style=flat-square&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6.svg?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Database-SQLite-003B57.svg?style=flat-square&logo=sqlite" alt="Database" />
    <img src="https://img.shields.io/badge/Styling-Tailwind%20%2B%20CSS%20Vars-38B2AC.svg?style=flat-square&logo=tailwind-css" alt="Tailwind" />
  </p>
</div>

---

ECEngine is an offline-first desktop application engineered for examinees preparing for the Philippine Electronics Engineering (ECE) and Electronics Technician (ECT) Licensure Exams. It combines a local SQLite database with advanced spaced repetition (SM-2) algorithms to provide an integrated study environment. The application supports standard flashcards, multiple-choice questions (MCQs), and LaTeX-rendered formula sets, utilizing a tech stack comprised of Electron, React 18, TypeScript, and Vite. State management is handled by Zustand, styling via Tailwind CSS with custom CSS properties, and animations by Framer Motion. 

**Supported Platforms**: Windows, macOS, and Linux — fully cross-platform, with all core study features identical across all three. (One platform-specific difference: the Text-to-Speech backend — see Linux TTS Setup under Getting Started.)

---

## 🚀 Features

### Study Modes
* **Spaced Repetition**: Flashcard and formula sets utilize the SM-2 algorithm, providing Again / Hard / Good / Easy rating buttons to schedule reviews.
* **Preview Mode**: Browse formula sets without writing SM-2 progress data.
* **Written Mode**: Require typing the exact answer before flipping the flashcard.
* **Autoplay Mode**: Hands-free flashcard review loop powered by native TTS — Web Speech API on Windows/macOS (no setup required), Piper neural TTS on Linux (requires separate installation, see Linux TTS Setup below). Uses a robust single-sequencer synchronized with TTS callbacks.
* **Interactive UI**: Enjoy 3D CSS `rotateY` card flips and smooth Framer Motion horizontal slide transitions.
* **Additional Controls**: Swap Term/Definition toggle, shuffle toggle, and bookmarking for filtered reviews.
* **Keyboard Shortcuts**: Use `Space`, `ArrowUp`, or `ArrowDown` to flip cards; `1-4` to select an SM-2 rating; and left/right arrow keys to navigate.

### Card Types
* **Flashcard**: Standard front/back layout with an optional image and an optional explanation field (with optional image).
* **MCQ**: Structured with a question, 4 multiple-choice choices, correct answer, optional image, and an optional solution field (with optional image).
* **Formula**: Specialized layout containing the formula name, LaTeX equation (rendered via KaTeX and MathLive), description, variables, and an optional explanation field (with optional image).
* **Explanation Field**: A collapsible section available on the back face of flashcard, formula, and MCQ card types. It supports text with LaTeX rendering and an optional image. When expanded, the SM-2 rating buttons and navigation buttons are hidden to maximize reading space.

### Deck Management
* **Add Decks**: Create MCQ, Flashcard, or Formula sets with a comprehensive editor. Features include:
  * **MathLive Integration**: Dedicated equation editors (Σ button) for entering LaTeX formulas effortlessly. Fields default to text or math mode based on context.
  * **Rich Media**: Attach images directly to questions, choices, or dedicated explanation fields.
  * **Advanced Controls**: Drag-and-drop card reordering (via DnD Kit), undo/redo history, and bulk import functionality.
* **Edit Deck**: A full-featured interface for modifying existing decks, sharing all the advanced capabilities of the Add Decks view. Update questions, toggle between text/equation modes, and preview LaTeX rendering in real-time.
* **Folder System**: Support for nested folders (maximum depth of 1), independently scoped for the study and formula tabs.
* **Smart Routing**: After saving, the application automatically redirects to the correct tab based on the deck type (Formula decks route to the Formulas tab, others route to Flashcards).

### Bulk Import & Content Formats
* **Quizlet Import**: Easily import your existing study sets by pasting Quizlet exports directly into the app. ECEngine automatically detects the Quizlet format (both MCQ and Flashcards) and seamlessly converts them into the native ECEngine format, applying common symbol and spelling fixes automatically.
* **Native ECEngine Format**: When bulk importing manually, ECEngine uses a simple plain-text block format separated by blank lines.

  **MCQ Format Snippet:**
  ```text
  Q: What is the unit of capacitance?
  A: Henry
  B: Farad
  C: Ohm
  D: Watt
  ANS: B
  ```

  **Flashcard / Formula Format Snippet:**
  ```text
  Q: Ohm's Law
  A: V = I * R
  ```

* **Explanations & Images**: Beyond basic text, ECEngine's card editor allows you to enrich any MCQ, Flashcard, or Formula with **rich explanations** and **images**. You can easily attach an image to the main card content, as well as provide a collapsible explanation field that can contain its own dedicated solution image.

### Board Exam Tools
* **EELE ToS**: A dedicated tab for viewing the Table of Specifications of the latest board exam (2022 TOS), covering Mathematics, Electronics Engineering, GEAS, and EST.
* **Review Checklist**: A comprehensive, interactive syllabus tracker. Keep tabs on your overall review progress across all subjects and subtopics. Mark items with statuses like "For Review," "Refresher," or "Mastered" to visually manage your study priorities and ensure complete coverage of the board exam scope.

### Analytics & Progress
* **Dashboard Heatmap**: A visual study activity heatmap plotting activity over a 6-month window.
* **Accuracy Trends**: Line charts mapping accuracy trends across the core subjects (MATH, GEAS, ELECS, EST).
* **Mastery Intelligence**: Mastery percentage calculated per subject and per individual deck, derived directly from SM-2 progress data.
* **Board Exam Countdown**: A built-in timer counting down to the user's exam date.

### AI Integration
* **Groq GPT-OSS-120B Integration**: Features an explain button on MCQ cards in Learn and Test modes. Requires a user-supplied Groq API key configured in Settings.
* **Context Extraction**: A "Get Context" button instantly copies a structured prompt to the clipboard for use in external AI tools like ChatGPT or Claude.

### Print & Export & Test Paper View
* **Test Paper View**: Transform any deck into a printable test paper format. Ideal for generating physical mock board exams from your MCQ decks. Includes a toggle to hide/show answers on the fly.
* **Flexible Layouts**: Generate documents optimized for Glossary (list format), Table (grid format), or Q&A (Question & Answer) layouts depending on the deck type.
* **Theming & Controls**: Select between Light, Sepia, and Dark print themes. Features an isolated zoom state independent from the main window.
* **Direct Export**: Native capability to export directly to PDF (with reliable native Save dialog rendering) or export deck contents to a raw text file.

### Settings & Customization
* **Custom Images Storage Path**: Configure a custom directory for image files (such as card diagrams and explanation images). Fully supports native folder browsing as well as direct text path copy-pasting. (Available under Settings → Data & Sync → Unlock Advanced).
* **App Zoom Controls**: Global application scaling (80% to 130%) using `Ctrl+=` (zoom in), `Ctrl+-` (zoom out), `Ctrl+0` (reset to 100%), and **`Ctrl+Mousewheel`** for continuous discrete zoom stepping. Zoom level is automatically persisted across sessions and features a transient on-screen toast indicator.
* **Linux Platform Compatibility**: Features case-insensitive file resolution for image protocol handlers (`ece-app://`), correcting Chromium's automatic hostname lowercasing on case-sensitive Linux filesystems. Also features a dedicated native TTS backend (Piper) bypassing Chromium's lack of Web Speech API support on Linux (see Linux TTS Setup).

### Performance & UI Architecture
* **Responsive Fluid Grids**: Deck browsers utilize native CSS grid `auto-fit` alongside Tailwind `@container` queries to guarantee a robust, zoom-proof responsive layout strictly capped at two columns.
* **Zoom-Proof Dashboard**: The primary Dashboard leverages dynamic overflow handling to permit both vertical scaling and horizontal heatmap scrolling when the main window's zoom factor is increased.
* **Non-Blocking & Queued IPC**: Uses asynchronous `fs/promises` for file I/O operations with an in-memory Promise queue for configuration writes to prevent race conditions. Implements 15-second `AbortController` timeouts on Groq AI IPC handlers to prevent main thread and UI freezing.
* **Clean DB Teardown**: Intercepts the Electron `will-quit` event to explicitly close the local `better-sqlite3` connection, ensuring no orphaned WAL (`.sqlite-wal`) files are left on disk.
* **Strict Theming**: A thoroughly unified CSS variable design system (`surface`, `border-base`, `text-primary`, `accent`) enforced across all components, avoiding arbitrary inline styling.

---

## 🏗 System Architecture

ECEngine runs as a native desktop application powered by React 18, Vite, Electron, and a local SQLite database compiled for desktop distribution.

```mermaid
flowchart TD
    subgraph UI_Layer [React 18 Renderer Layer]
        A[Pages: Dashboard / Study / Exam] --> B[Zustand Stores]
        B --> C[Database Service Layer: db.service.ts]
    end

    subgraph Desktop_Backend [Electron Main Process]
        C --> D[IPC Bridge: window.electron.*]
        D --> F[better-sqlite3 Database Adapter]
        F --> G[(ecengine.sqlite)]
    end
```

### Database Schema

```sql
CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  parent_id TEXT,
  order_index INTEGER DEFAULT 0,
  tags TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  folder_name TEXT DEFAULT 'Uncategorized',
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  FOREIGN KEY(parent_id) REFERENCES topics(id)
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  difficulty TEXT,
  tags TEXT,
  is_custom BOOLEAN DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY(topic_id) REFERENCES topics(id)
);

CREATE TABLE progress (
  card_id TEXT PRIMARY KEY,
  ease_factor REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  next_review TEXT,
  last_reviewed TEXT,
  FOREIGN KEY(card_id) REFERENCES cards(id)
);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id),
  order_index INTEGER DEFAULT 0,
  scope TEXT NOT NULL DEFAULT 'study'
);
```

---

## 📂 Project Directory Layout

```text
ecengine/
├── electron/                    # Electron Shell Files
│   ├── main.ts                  # App launch entry point, window configuration
│   ├── preload.ts               # contextBridge IPC boundaries
│   ├── ipc/                     # DB, file system, and system IPC handlers
│   └── db/                      # Schema and SQLite connections
├── src/                         # React Frontend Renderer Process
│   ├── assets/                  # Fonts, SVGs, Icons
│   ├── components/              # UI Components
│   │   ├── ui/                  # Reusable visual units
│   │   ├── mcq/                 # MCQ components
│   │   ├── flashcard/           # Flashcard and SM-2 components
│   │   ├── formula/             # Formula rendering components
│   │   ├── deck/                # Deck building and forms
│   │   └── layout/              # Sidebars and Navigation
│   ├── hooks/                   # Custom business logic React hooks
│   ├── pages/                   # Main page layout views
│   ├── services/                # Database Service Layer & connectors
│   ├── store/                   # Zustand store slices
│   └── styles/                  # Tailwind styling and CSS custom properties
├── scripts/                     # Operational scripts
├── package.json                 # Project manifest and dependencies
└── electron.vite.config.ts      # Vite build configuration
```

---

## 🛠 Getting Started & Developer Guide

### Prerequisites
* **Node.js**: `v18.x` or higher installed
* **npm** or **yarn** package manager
* **C++ Compiler Tools** (Required to compile native `better-sqlite3` bindings for Electron)
* **Piper TTS (Linux users only)**: Required for the Read-Aloud/Autoplay feature on Linux — see Linux TTS Setup below. Windows and macOS use the OS's built-in Text-to-Speech with no setup required. Not required to build or run the app on any platform; only affects the TTS feature on Linux specifically.

### Installation & Seeding

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/vtajaros/ECEngine.git
   cd ecengine
   ```

2. **Install Node Modules**:
   ```bash
   npm install
   ```

3. **Compile and Seed the SQLite DB**:
   This processes the JSON metadata inside `content/` and compiles it into `ecengine.sqlite`:
   ```bash
   npm run seed
   ```

### Windows Setup Notes

1. Install Node.js 20 LTS or 22 LTS from nodejs.org.
2. **Open a new terminal** after installation — PATH updates don't apply to already-open terminal sessions.
3. If PowerShell blocks `npm` with a script-execution error, run once:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
4. Install and seed (two different `better-sqlite3` ABI targets are involved — seeding uses the system Node.js ABI, `npm run dev` uses Electron's bundled Node.js ABI):
   ```bash
   npm install
   npm rebuild better-sqlite3
   npm run seed
   npx electron-rebuild -f
   npm run dev
   ```
   The `postinstall` script now runs `electron-rebuild` automatically after `npm install`, but it must be re-run via `npm rebuild better-sqlite3` (no `-f`/Electron flag) before `npm run seed`, then `npx electron-rebuild -f` again before `npm run dev` — seeding and dev-mode target different Node ABIs and the module must match whichever process is about to load it.

### Linux TTS Setup

This app does not bundle Piper or any voice models. On Linux, TTS requires manual setup:

1. Install Piper (Arch/AUR example — note for other distros the user should consult [https://github.com/rhasspy/piper](https://github.com/rhasspy/piper) directly):
   ```bash
   yay -S piper-tts-bin
   ```
2. Download a voice model (`.onnx` + matching `.onnx.json` sidecar file) from [https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US) — recommended: the "ryan" voice (medium quality) for a natural-sounding male US English voice, or "amy" for female.
3. In-app: Settings → Sound & Feedback → Reading Voice (Piper TTS) → Browse, and select the downloaded `.onnx` file. The app validates the `.onnx.json` sidecar exists automatically.
4. If Piper is not detected, the Settings panel shows install instructions directly — no auto-download is provided by design.

Playback requires `aplay` (part of `alsa-utils`, present by default on most Linux desktop distros).

### Developer Execution Reference

Use the following commands inside your terminal to launch, build, or test various components:

| Command | Action Description |
|---|---|
| `npm run dev` | Spin up Electron shell in development mode with Hot Module Replacement (HMR) |
| `npm run build` | Compile code and bundle React and Electron assets |
| `npm run preview` | Run a local preview of the compiled application |
| `npm run package` | Generate distributable native binary installers (`.exe`, `.dmg`, `.deb`) via electron-builder |
| `npm run validate-content` | Execute content validations over JSON files under `content/` |
| `npm run test` | Run active Unit Tests with Vitest |

---

## ⚠️ Known Limitations

* **Technical Debt in FlashCard.tsx**: `FlashCard.tsx` (used by the older LooksFam 3D flip view) is an independent third flip-card implementation separate from the primary `FlashcardSession.tsx`, representing UI duplication.
* **No Cloud Sync/Backup**: There is no automatic backup or cloud syncing. Data relies entirely on the local SQLite file.
* **Empty Formula Bank**: The formula bank content is not pre-populated. Users must create their own formula decks from scratch.
* **AI Provider Support**: Only the Groq API is implemented and wired. Mentioned support for Gemini or other multi-provider interfaces in older notes is not present.
* **No Bundled TTS on Linux**: Unlike Windows/macOS (which use the OS's built-in Web Speech API with zero setup), Linux TTS requires the user to separately install Piper and a voice model — this is a deliberate scope decision (see Linux TTS Setup), not a bug.

---

## 📐 Design Decisions

* **SM-2 Scoped to Flashcards & Formulas Only**: Spaced repetition intentionally does not apply to MCQs (including LooksFam). MCQ banks can run into the thousands of questions per subject, which doesn't fit the spaced-repetition model — SM-2 is designed for a bounded set of items being progressively memorized, not for sampling across a large question pool. Flashcards and formula sets are the actual memorization-oriented content, so SM-2 applies there. This is a deliberate scope decision, not unfinished work.

---

## 🤖 AI Auditor & Developer Manifesto

These instructions govern all future modifications to this repository:
1. **No Hex Color Coding**: All styling changes must use established CSS variables inside `src/styles/theme.css` (e.g., `var(--accent-primary)`). Do not add custom hex values.
2. **Access Proxying**: Direct browser `window.electron` calls inside React components should be avoided when possible. Route DB activities through `src/services/db.service.ts` for cleaner separation of concerns.
3. **Typography Standards**: Preserve monospaced readability. Titles must utilize `Orbitron` or `Rajdhani`, and data containers should display body copy in `IBM Plex Mono` or `JetBrains Mono`. No soft pastel or rounded visuals.
4. **TypeScript Rigidness**: Avoid typing bypasses (`any`). Ensure custom payloads are typed correctly within `src/types/` to prevent silent database runtime failures.
5. **Shared Study Views**: Formula sets and Flashcard sets share the `FlashcardSession` component — UI changes to the study view affect both.

---

<div align="center">
  <i>Developed for the Engineers of 2026. Non sibi sed aliis.</i>
</div>
