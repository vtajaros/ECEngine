# ECEngine — Architecture & Project Brief
> Electronics Engineering Board Exam Review App (Philippines)
> Theme: Cyberpunk Black & Neon Green | Stack: Electron + React + Node.js

---

## 1. Project Identity

| Field | Value |
|---|---|
| App Name | ECEngine |
| Target Exam | Philippine ECE Licensure Exam (ECE/ECT) |
| Primary Platform | Desktop (Electron) — offline-first |
| Secondary Platform | Web (React SPA) — same codebase |
| Color Theme | `#0D0D0D` bg / `#00FF41` neon green accent / `#1A1A1A` cards |
| Typography | Display: `Orbitron` or `Rajdhani` / Body: `JetBrains Mono` or `IBM Plex Mono` |
| Design Language | Cyberpunk-utility — dense info, neon glows, monospaced precision |

---

## 2. Tech Stack Decision

```
┌─────────────────────────────────────────────────────┐
│                   ECEngine Stack                     │
│                                                     │
│  UI Layer      →  React 18 + Vite                   │
│  Desktop Shell →  Electron 28 (Chromium + Node.js)  │
│  Web Build     →  Same React app, deployed as SPA   │
│  Styling       →  Tailwind CSS + custom CSS vars    │
│  State Mgmt    →  Zustand (lightweight, no boilerplate) │
│  Local DB      →  SQLite via better-sqlite3 (Electron) │
│  Web DB        →  IndexedDB via Dexie.js (browser)  │
│  File Import   →  Electron fs / File API (web)      │
│  Bundler       →  electron-vite (unified config)    │
│  Testing       →  Vitest + Playwright               │
└─────────────────────────────────────────────────────┘
```

**Why Electron + React?**
- Single React codebase → compile to both Electron and web
- Offline-first by default (SQLite on desktop, IndexedDB on web)
- Node.js access for file system imports, image handling
- Free to ship — no subscription, no cloud required
- Familiar to JS/TS developers; large ecosystem

---

## 3. Folder Structure

```
ecengine/
├── electron/                    # Electron main process
│   ├── main.ts                  # App entry, window creation
│   ├── preload.ts               # Context bridge (secure IPC)
│   ├── ipc/
│   │   ├── db.ipc.ts            # Database IPC handlers
│   │   ├── file.ipc.ts          # File import/export handlers
│   │   └── sync.ipc.ts          # Future: cloud sync hooks
│   └── db/
│       ├── schema.sql           # SQLite schema definitions
│       ├── seed/                # Preloaded ECE content
│       │   ├── topics.json
│       │   ├── flashcards/
│       │   ├── formulas/
│       │   └── mcqs/
│       └── database.ts          # DB connection + queries
│
├── src/                         # React renderer (shared web + desktop)
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root router
│   ├── router.tsx               # React Router v6 config
│   │
│   ├── components/              # Reusable UI components
│   │   ├── ui/                  # Primitives (Button, Card, Badge, Modal)
│   │   ├── flashcard/           # FlashCard, FlashDeck, FlipAnimation
│   │   ├── mcq/                 # MCQCard, ChoiceButton, ExplanationPanel
│   │   ├── formula/             # FormulaCard, LaTeXRenderer
│   │   ├── exam/                # ExamTimer, ProgressBar, ScoreCard
│   │   ├── import/              # ImportWizard, FormatPreview, ImageDrop
│   │   └── layout/              # Sidebar, TopNav, Breadcrumb, ToC
│   │
│   ├── pages/                   # Route-level page components
│   │   ├── Dashboard.tsx        # Home — progress overview, streaks
│   │   ├── TableOfContents.tsx  # ECE topic tree
│   │   ├── FlashcardStudy.tsx   # Anki-style review mode
│   │   ├── FormulaViewer.tsx    # Formula reference sheets
│   │   ├── ConceptExplorer.tsx  # Theory + concept notes
│   │   ├── ExamMode.tsx         # Timed mock exam
│   │   ├── TopicExam.tsx        # Per-topic quiz
│   │   ├── ImportContent.tsx    # Import MCQ/flashcard sets
│   │   ├── CustomDeck.tsx       # User-created decks
│   │   ├── Statistics.tsx       # Study analytics
│   │   └── Settings.tsx         # Theme, data, preferences
│   │
│   ├── store/                   # Zustand state slices
│   │   ├── useSessionStore.ts   # Active study session state
│   │   ├── useProgressStore.ts  # Spaced repetition progress
│   │   ├── useContentStore.ts   # Loaded topics/cards
│   │   └── useSettingsStore.ts  # User preferences
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useSpacedRepetition.ts  # SM-2 algorithm
│   │   ├── useExamTimer.ts
│   │   ├── useImport.ts
│   │   └── usePlatform.ts       # Electron vs Web detection
│   │
│   ├── services/                # Data access layer (platform-agnostic)
│   │   ├── db.service.ts        # Routes to SQLite (Electron) or Dexie (web)
│   │   ├── content.service.ts   # CRUD for topics, cards, MCQs
│   │   ├── exam.service.ts      # Exam generation, scoring
│   │   ├── import.service.ts    # Parse text/JSON/image imports
│   │   └── analytics.service.ts # Study stats calculations
│   │
│   ├── lib/                     # Pure utilities
│   │   ├── sm2.ts               # Spaced repetition (SM-2 algorithm)
│   │   ├── latex.ts             # LaTeX/KaTeX rendering helpers
│   │   ├── parser.ts            # Import format parsers
│   │   ├── scrambler.ts         # MCQ choice randomizer
│   │   └── constants.ts         # ECE topic taxonomy, difficulty levels
│   │
│   ├── assets/
│   │   ├── fonts/
│   │   ├── icons/               # SVG icon set
│   │   └── images/
│   │
│   └── styles/
│       ├── globals.css          # CSS variables, base reset
│       ├── theme.css            # Cyberpunk colorway tokens
│       └── animations.css       # Glow, pulse, flip keyframes
│
├── content/                     # Preloaded ECE content (source of truth)
│   ├── README.md                # Content contribution guide
│   ├── mathematics/
│   │   ├── algebra.json
│   │   ├── calculus.json
│   │   ├── differential-equations.json
│   │   └── probability-statistics.json
│   ├── electronics/
│   │   ├── circuit-analysis.json
│   │   ├── semiconductor-devices.json
│   │   ├── amplifiers.json
│   │   └── digital-electronics.json
│   ├── communications/
│   │   ├── analog-comms.json
│   │   ├── digital-comms.json
│   │   └── transmission-lines.json
│   ├── signal-processing/
│   ├── electromagnetics/
│   ├── electrical-engineering/
│   └── laws-and-ethics/
│
├── scripts/
│   ├── seed-db.ts               # Populate SQLite from /content JSON
│   ├── validate-content.ts      # Schema validation for content JSON
│   └── export-content.ts        # Export to shareable format
│
├── electron.vite.config.ts      # Unified Electron + Vite config
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 4. Data Models

### Content JSON Schema (for `/content/**/*.json`)
```json
{
  "topic": "Semiconductor Devices",
  "subject": "Electronics Engineering",
  "subtopics": ["PN Junction", "BJT", "FET", "Op-Amp"],
  "flashcards": [
    {
      "id": "sd-001",
      "front": "What is the knee voltage of a silicon diode?",
      "back": "Approximately 0.7V",
      "tags": ["diode", "silicon", "basics"],
      "difficulty": "easy",
      "image_back": null
    }
  ],
  "mcqs": [
    {
      "id": "sd-mcq-001",
      "question": "A silicon diode has a forward voltage drop of approximately:",
      "choices": ["0.3V", "0.7V", "1.1V", "1.4V"],
      "answer": 1,
      "explanation": "Silicon PN junctions have a built-in potential of ~0.7V due to the band gap.",
      "tags": ["diode", "silicon"],
      "difficulty": "easy",
      "year_asked": 2019
    }
  ],
  "formulas": [
    {
      "id": "sd-f-001",
      "name": "Shockley Diode Equation",
      "latex": "I_D = I_S \\left(e^{\\frac{V_D}{nV_T}} - 1\\right)",
      "variables": {
        "I_S": "Reverse saturation current",
        "V_T": "Thermal voltage (26mV at room temp)",
        "n": "Ideality factor (1-2)"
      },
      "tags": ["diode", "equation"]
    }
  ],
  "concepts": [
    {
      "id": "sd-c-001",
      "title": "Depletion Region",
      "body": "When a P-N junction forms, majority carriers diffuse across...",
      "image": null,
      "tags": ["PN junction", "fundamentals"]
    }
  ]
}
```

### SQLite Schema
```sql
-- Topics hierarchy
CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  parent_id TEXT REFERENCES topics(id),
  order_index INTEGER
);

-- All card types share a cards table
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  topic_id TEXT REFERENCES topics(id),
  type TEXT CHECK(type IN ('flashcard','mcq','formula','concept')),
  data JSON NOT NULL,         -- Flexible JSON payload per type
  difficulty TEXT,
  tags TEXT,                  -- JSON array
  is_custom INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Spaced repetition progress per card
CREATE TABLE progress (
  card_id TEXT REFERENCES cards(id),
  user_id TEXT DEFAULT 'local',
  ease_factor REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  next_review TEXT,
  last_reviewed TEXT,
  PRIMARY KEY (card_id, user_id)
);

-- Exam sessions
CREATE TABLE exam_sessions (
  id TEXT PRIMARY KEY,
  topic_id TEXT,
  mode TEXT,                  -- 'practice' | 'mock' | 'custom'
  started_at TEXT,
  finished_at TEXT,
  score INTEGER,
  total INTEGER,
  answers JSON
);
```

---

## 5. Core Feature Modules

### 5.1 Spaced Repetition Engine (SM-2)
- Implements SuperMemo SM-2 algorithm
- Cards rated 0–5 after each review
- Intervals: 1 day → 6 days → SM-2 calculated
- "Due today" queue shown on Dashboard
- Applies to both flashcards and MCQs

### 5.2 Exam Mode
- Select topics (multi-select from ToC)
- Set item count (25 / 50 / 100) and time limit
- Randomized MCQ order + shuffled choices
- Timer with pause support
- Post-exam: score, item analysis, explanations, retry wrong items

### 5.3 Import System
Supported formats:
```
1. Plain text (Anki-style tab-separated)
   Q: [question]\tA: [answer]

2. JSON (ECEngine native schema)

3. Formatted text block
   ## QUESTION
   A silicon diode forward voltage is:
   A. 0.3V
   B. 0.7V *
   C. 1.1V
   D. 1.4V
   EXPLANATION: Silicon band gap...

4. Image import (OCR via Tesseract.js for desktop)
```

### 5.4 Formula Viewer
- KaTeX rendering (fast, offline-capable)
- Organized by topic/subject
- Search by formula name or variable
- "Copy LaTeX" button
- Related MCQs linked per formula

### 5.5 Table of Contents (ECE Topic Taxonomy)
```
ECEngine Topics
├── Mathematics
│   ├── Algebra & Advanced Math
│   ├── Calculus
│   ├── Differential Equations
│   ├── Probability & Statistics
│   └── Discrete Math
├── Electronics Engineering
│   ├── Circuit Analysis (DC/AC)
│   ├── Semiconductor Devices
│   ├── Electronic Circuits & Amplifiers
│   ├── Digital Electronics & Logic Design
│   ├── Microprocessors & Microcontrollers
│   └── Control Systems
├── Communications Engineering
│   ├── Analog Communications
│   ├── Digital Communications
│   ├── Transmission Lines & Waveguides
│   ├── Antennas & Wave Propagation
│   └── Fiber Optics & Satellite
├── Signal Processing
│   ├── Signals & Systems
│   ├── Fourier & Laplace Transforms
│   └── Digital Signal Processing
├── Electromagnetics
│   ├── Electrostatics & Magnetostatics
│   ├── Maxwell's Equations
│   └── EMC/EMI
├── Electrical Engineering
│   ├── Power Systems
│   ├── Machines & Transformers
│   └── Electrical Codes (PEC)
├── Electronics Laws & Ethics
│   ├── RA 9292 (ECE Law)
│   ├── Professional Ethics
│   └── Related Laws & Regulations
└── General Engineering Sciences
    ├── Engineering Economy
    ├── Engineering Management
    └── Environmental Engineering
```

---

## 6. Platform Abstraction Layer

```typescript
// src/services/db.service.ts
// Automatically routes to correct DB depending on runtime

const isElectron = typeof window !== 'undefined' && window.electron;

export const db = isElectron
  ? new ElectronDBAdapter()   // IPC → SQLite via better-sqlite3
  : new DexieDBAdapter();     // IndexedDB via Dexie.js

// Both adapters implement the same interface:
interface DBAdapter {
  getCards(topicId: string, type?: CardType): Promise<Card[]>;
  getProgress(cardId: string): Promise<Progress | null>;
  saveProgress(progress: Progress): Promise<void>;
  getTopics(): Promise<Topic[]>;
  importCards(cards: Card[]): Promise<void>;
  getExamSession(id: string): Promise<ExamSession>;
  saveExamSession(session: ExamSession): Promise<void>;
}
```

---

## 7. Design System Tokens

```css
/* src/styles/theme.css */
:root {
  /* Core Palette */
  --bg-primary:     #0D0D0D;
  --bg-secondary:   #111111;
  --bg-card:        #161616;
  --bg-elevated:    #1C1C1C;

  /* Neon Green Accents */
  --accent-primary: #00FF41;
  --accent-dim:     #00CC33;
  --accent-glow:    rgba(0, 255, 65, 0.15);
  --accent-border:  rgba(0, 255, 65, 0.3);

  /* Text */
  --text-primary:   #E8E8E8;
  --text-secondary: #888888;
  --text-muted:     #444444;
  --text-accent:    #00FF41;

  /* Status Colors */
  --color-correct:  #00FF41;
  --color-wrong:    #FF3333;
  --color-warning:  #FFB800;
  --color-info:     #00BFFF;

  /* Typography */
  --font-display: 'Orbitron', 'Rajdhani', sans-serif;
  --font-body:    'IBM Plex Mono', 'JetBrains Mono', monospace;
  --font-ui:      'Rajdhani', sans-serif;

  /* Effects */
  --glow-green:   0 0 8px rgba(0,255,65,0.6), 0 0 20px rgba(0,255,65,0.2);
  --glow-card:    0 0 0 1px rgba(0,255,65,0.15), 0 4px 24px rgba(0,0,0,0.6);

  /* Spacing Scale */
  --space-xs: 4px;  --space-sm: 8px;  --space-md: 16px;
  --space-lg: 24px; --space-xl: 40px; --space-2xl: 64px;

  /* Border Radius */
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
}
```

---

## 8. VS Code Workspace Setup

### `ecengine.code-workspace`
```json
{
  "folders": [
    { "name": "ECEngine Root", "path": "." }
  ],
  "settings": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "editor.tabSize": 2,
    "typescript.preferences.importModuleSpecifier": "relative",
    "tailwindCSS.experimental.classRegex": [
      ["cn\\(([^)]*)\\)", "'([^']*)'"]
    ],
    "files.associations": {
      "*.css": "css"
    },
    "emmet.includeLanguages": { "typescript": "html" }
  },
  "extensions": {
    "recommendations": [
      "esbenp.prettier-vscode",
      "dbaeumer.vscode-eslint",
      "bradlc.vscode-tailwindcss",
      "ms-vscode.vscode-typescript-next",
      "usernamehw.errorlens",
      "PKief.material-icon-theme",
      "formulahendry.auto-rename-tag",
      "naumovs.color-highlight",
      "streetsidesoftware.code-spell-checker"
    ]
  },
  "launch": {
    "configurations": [
      {
        "name": "Electron: Dev",
        "type": "node",
        "request": "launch",
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron-vite",
        "args": ["dev"],
        "console": "integratedTerminal"
      }
    ]
  }
}
```

### `package.json` (skeleton)
```json
{
  "name": "ecengine",
  "version": "0.1.0",
  "description": "ECE Board Exam Review App",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "build:web": "vite build --mode web",
    "dev:web": "vite --mode web",
    "package": "electron-builder",
    "seed": "ts-node scripts/seed-db.ts",
    "validate-content": "ts-node scripts/validate-content.ts",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.24.0",
    "zustand": "^4.5.0",
    "better-sqlite3": "^9.6.0",
    "dexie": "^3.2.7",
    "katex": "^0.16.10",
    "tesseract.js": "^5.1.0",
    "framer-motion": "^11.3.0",
    "lucide-react": "^0.400.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.4.0",
    "date-fns": "^3.6.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-vite": "^2.3.0",
    "electron-builder": "^24.13.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/better-sqlite3": "^7.6.0",
    "typescript": "^5.5.0",
    "vite": "^5.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "vitest": "^2.0.0",
    "playwright": "^1.45.0",
    "prettier": "^3.3.0",
    "eslint": "^9.6.0",
    "ts-node": "^10.9.0"
  }
}
```

---

## 9. Claude Prompt Templates for Development

Use these prompts when working with Claude to build each module:

### MASTER SYSTEM PROMPT (prepend to every session)
```
You are building ECEngine, an offline-first electronics engineering board exam 
review app for the Philippine ECE licensure exam. 

Tech stack: Electron 28 + React 18 + Vite + TypeScript + Zustand + SQLite 
(better-sqlite3 for desktop) + Dexie.js (IndexedDB for web) + Tailwind CSS + 
KaTeX + Framer Motion.

Design system:
- Theme: Cyberpunk — black (#0D0D0D) background, neon green 
  (#00FF41) accents, monospaced fonts (Orbitron display, IBM Plex Mono body)
- No white backgrounds, no rounded-pill buttons, no pastel colors
- Components should feel like high-performance engineering tools
- Use CSS custom properties from theme.css for all colors

Architecture rules:
- All DB access goes through src/services/db.service.ts (platform abstraction)
- Electron IPC handled in electron/ipc/ — never call Node APIs from renderer
- Shared types in src/types/
- SM-2 spaced repetition in src/lib/sm2.ts
- Content JSON schema is in content/README.md

Current working file structure: [paste folder tree here]
```

### Module-Specific Prompts

**Flashcard Component:**
```
Build the FlashCard React component for ECEngine. It should:
- Show front/back with a 3D CSS flip animation on click (use Framer Motion)
- Support LaTeX rendering via KaTeX for formula cards
- Show difficulty badge, topic tag, and SM-2 review buttons (Again/Hard/Good/Easy)
- Keyboard shortcuts: Space=flip, 1=Again, 2=Hard, 3=Good, 4=Easy
- Apply the ECEngine neon green theme (use CSS vars from theme.css)
- Accept props: card: Card, onRate: (rating: 0|1|2|3|4|5) => void
```

**Import Wizard:**
```
Build the ImportWizard component for ECEngine that allows users to paste or 
upload text to create custom MCQ sets. Support these formats:
1. Tab-separated (Q\tA)
2. Numbered MCQ format with * marking the correct answer
3. ECEngine native JSON schema
Show a live preview of parsed cards before importing. Use a stepper UI 
(Format Select → Paste/Upload → Preview → Confirm).
```

**Exam Mode:**
```
Build the ExamMode page for ECEngine. Features needed:
- Topic multi-select from the ECE taxonomy tree
- Item count selector (25/50/100) and time limit (none/30min/1hr/2hr)
- During exam: question display, ABCD choices, timer, item navigator sidebar
- No answer reveal during exam (PRC-style)
- Post-exam: score summary, per-item review with explanations, retry wrong items
- Save session to DB via exam.service.ts
```

---

## 10. Development Phases

### Phase 1 — Core Shell (Week 1-2)
- [ ] Electron + Vite + React scaffold
- [ ] Design system (theme.css, base components)
- [ ] SQLite schema + seed script
- [ ] Platform abstraction layer (DB service)
- [ ] React Router setup with all page stubs
- [ ] Sidebar navigation + Table of Contents

### Phase 2 — Study Modes (Week 3-4)
- [ ] Flashcard component + flip animation
- [ ] SM-2 spaced repetition engine
- [ ] Flashcard study session page
- [ ] Formula viewer with KaTeX
- [ ] Concept explorer (markdown rendering)

### Phase 3 — Exam System (Week 5-6)
- [ ] MCQ card component
- [ ] Exam configuration wizard
- [ ] Timed exam page
- [ ] Score + analysis page
- [ ] Progress tracking + Dashboard

### Phase 4 — Content & Import (Week 7-8)
- [ ] Import wizard (text parsing)
- [ ] Image OCR import (Tesseract.js)
- [ ] Custom deck builder
- [ ] Content validation
- [ ] Seed with initial ECE content

### Phase 5 — Polish & Release (Week 9-10)
- [ ] Animations + micro-interactions
- [ ] Statistics page
- [ ] Electron packaging (Windows/Mac/Linux)
- [ ] Web build (Vercel/Netlify deploy)
- [ ] Beta testing with ECE reviewees

---

## 11. Improvement Suggestions

### Near-Term
1. **Past Board Exam Filter** — tag MCQs with `year_asked` and filter by year range (PRC releases past exams, very valuable)
2. **Formula Quick Reference Cards** — printable PDF export of all formulas per topic
3. **Wrong Answer Log** — dedicated page showing all previously missed MCQs
4. **Streak & XP System** — gamification: daily streaks, XP per card reviewed, level badges
5. **Dark/Dim Mode Toggle** — full black vs. slightly lighter for eye strain during long sessions

### Medium-Term
6. **Collaborative Deck Sharing** — export/import `.ecengine` deck files to share with batchmates
7. **AI Explanation Mode** — optional Claude API integration to explain wrong answers in depth
8. **Equation Solver Mode** — step-by-step worked examples for circuit analysis, etc.
9. **Audio Mnemonics** — text-to-speech for flashcard fronts (accessibility + audio learners)
10. **Mobile App** — React Native wrapper using the same content + service layer

### Long-Term
11. **ECT Exam Mode** — separate track for Electronics Technician exam
12. **Community Content Hub** — web platform to submit/upvote MCQs and decks
13. **Performance Analytics** — weak topic detection, predicted exam score model
14. **Pomodoro Integration** — built-in study timer with break reminders

---

*ECEngine Architecture v1.0 — Generated for VS Code workspace initialization*
