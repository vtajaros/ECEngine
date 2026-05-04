# ⚡ ECEngine: The Technical Manifest

## Project Identity & Vision
**ECEngine** is a high-performance, offline-first study ecosystem engineered specifically for the **Philippine Electronics Engineering (ECE) Licensure Exam**. Designed for the October 2026 goal, it transforms traditional review into a data-driven engineering workflow.

### Cyberpunk-Utility Philosophy
The system implements a **'Cyberpunk-Utility'** design language:
- **Palette:** Razer-inspired high-contrast theme (`#0D0D0D` deep blacks / `#00FF41` neon greens).
- **Typography:** Monospaced precision using IBM Plex Mono and Rajdhani for a high-tech equipment feel.
- **Motion:** 60fps physics-based animations via Framer Motion to reduce cognitive load during long study sessions.

---

## 🛠 The Hybrid Stack

ECEngine utilizes a robust, modern architecture designed for maximum reliability and local performance.

- **Frontend:** React 18 & TypeScript for type-safe UI logic.
- **Styling:** Tailwind CSS for rapid, utility-first layout construction.
- **Math Engine:** KaTeX for high-performance LaTeX formula rendering across all subjects.
- **Desktop Shell:** Electron 31 with a secure, context-isolated IPC bridge.
- **State Management:** Zustand for lightweight, reactive store patterns.
- **Persistence (Hybrid Architecture):**
    - **Local:** SQLite (`sql.js` / `better-sqlite3`) for instant, zero-latency offline storage.
    - **Cloud:** Future integration for PostgreSQL (Supabase) to handle cross-device synchronization and global performance analytics.

---

## ⚙️ Core Engineering Logic

### SM-2 Spaced Repetition
Retention is managed via an implementation of the **SuperMemo-2 (SM-2)** algorithm. The system tracks `ease_factor`, `interval`, and `repetitions` for every card, dynamically scheduling reviews to optimize the forgetting curve.

### MCQ Engine & Parser
The engine features a sophisticated regex-based parser located in `src/lib/parser.ts` designed to ingest legacy Quizlet and text-based formats. It automatically identifies structures, choices, and LaTeX markers, converting messy review data into structured JSON topics.

---

## 📂 Folder Structure & Architecture

```text
├── content/              # Subject matter source (JSON) for initial seeding
├── electron/             # Main process, Database migrations, and SQLite controllers
│   ├── db/               # Local persistence layer (SQL schemas and migrations)
│   └── ipc/              # Secure bridge between shell and renderer
├── scripts/              # Build tools and data seeding utilities
├── src/                  # React Renderer
│   ├── components/       # Atomic UI parts (MCQ, Flashcards, Formula Viewers)
│   ├── services/         # Platform Abstraction Layer (PAL)
│   ├── store/            # Zustand global state (Settings, Session, Content)
│   └── styles/           # Razer-themefiles (Globals, Animations, Theme)
└── types/                # Unified TypeScript interface definitions
```

### Platform Abstraction Layer (PAL)
The logic in `src/services/db.service.ts` acts as a switcher between local SQLite and cloud PostgreSQL, ensuring the UI remains agnostic to the underlying storage implementation.

---

## 📈 Current Development Status (May 4th Roadmap)

### Technical Debt & In-Progress
- [ ] **UI Stabilization:** Resolving layout shifting/shaking during Framer Motion transitions.
- [ ] **Responsive Scaling:** Implementing dynamic viewport-based font scaling for long-form MCQs.
- [ ] **Persistence Transition:** Moving active session state from mockups to persistent SQL storage.
- [ ] **Schema Migrations:** Finalizing the automated `ALTER TABLE` block for zero-user-intervention updates.

---

## 🤖 Instruction for AI Auditors
> **Critical Guidelines for AI Agents:**
> 1. **Data Integrity:** Prioritize analysis of `src/services/db.service.ts` when modifying data flow.
> 2. **Algorithmic Accuracy:** Ensure any changes to study schedules strictly follow the math in `src/lib/sm2.ts`.
> 3. **Design System:** All UI contributions **must** strictly adhere to the Razer-themed CSS variables defined in `/src/styles/theme.css`. Do not introduce arbitrary hex codes outside this scope.

---
*Optimized for the Oct 2026 ECE Board Exam.*
