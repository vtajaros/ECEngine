# ⚡ ECEngine: The Ultimate Board Exam Command Center

**ECEngine** is a high-performance, cyberpunk-inspired study ecosystem specifically engineered for the **Philippine Electronics Engineering (ECE) Licensure Exam**. It transforms traditional review into a high-octane engineering workflow, designed to dominate the October 2026 boards.

---

## 🚀 Core Features & Functionality

### 📊 Tactical Dashboard (Telemetry)
- **Activity Heatmap**: Tracks your "Heartbeat" (time spent in app) across a **dynamic 6-month window** leading up to your target exam date. Colors saturate from deep green (1h) to neon green (4h+).
- **Performance Telemetry**: Real-time Area Charts visualize your **Accuracy Trend**, allowing you to identify "fatigue zones" in your study schedule.
- **Subject Intelligence**: Dynamically calculates mastery percentage per subject (**MATH**, **GEAS**, **ELECS**, **EST**) based on successfully "Internalized" cards.
- **Exam Countdown**: A high-precision digital clock counting down to your target board exam date, creating a "Mission Critical" environment.

### 🧠 LooksFam Study Hub (Core Engine)
- **Multi-Modal Review**: Toggle between **Learn** (Partitioned repetition), **Test** (Full simulation), and **Mixed** modes.
- **Advanced Spaced Repetition**: Implements the **SM-2 Algorithm**. The system calculates your next review date based on your performance.
- **Synchronous Navigation (🚀)**: A high-performance, frame-perfect scroll tracking system in Test Mode. Replaces asynchronous observers with a manual scanline engine for zero-lag navigation in high-density question banks.
- **AI Explainer (✨)**: Leverages LLMs to provide "Just-In-Time" tutoring. It breaks down engineering solutions into Theoretical Foundation, Mathematical Derivation, and Distractor Rationale.

### 🧪 Formulas & Reference Laboratory
- **Expanded LaTeX Engine**: Robust rendering for complex ECE equations using KaTeX.
  - *Normalization*: Automatically translates non-standard/MathJax commands (e.g., `\exponentialE`, `\imaginaryI`) to standard KaTeX equivalents.
  - *SVG Hardening*: Custom DOMPurify profiles ensure complex radicals (`\sqrt`) and fraction bars are never stripped by sanitizers.
- **Mastery Tracking**: Now features the same "MASTERY" progress bar as the main study hub, ensuring visual and data parity across all reference decks.

### 📂 Manifest Management
- **Intelligent Parser**: Ingests raw text, JSON, or Quizlet exports.
- **Cyberpunk Folder System**: Organize decks into hierarchical folders with standardized color-coded subject tags.
- **Navigation Protection**: Custom `useBlocker` integration intercepts accidental sidebar clicks, protecting your active session data.

---

## 🛠 Engineering Specifications & Stack

- **Framework**: Electron 31 + React 18 + Vite (Desktop Native)
- **Language**: TypeScript 5.4 (Strict Typing)
- **State**: Zustand 4.5 (Flux Architecture)
- **Database**: SQLite 3 (Offline-First persistence)
- **UI/UX**: Tailwind CSS + Framer Motion (60FPS Animations)
- **Fonts**: `Orbitron`, `Rajdhani`, `IBM Plex Mono`

---

## 🏗 Development Workflow

```bash
# Start the engine
npm run dev

# Run diagnostic type checks
npx tsc --noEmit

# Build production executable (.exe)
npm run build
```

---

## 🗺 Future Roadmap & TODO List

### 🛰 Phase 1: Persistence & Sync
- [ ] **DB-Driven Mastery**: Transition from localStorage sets to SQLite-persisted `correct_count` / `total_count` tracking for unified analytics.
- [ ] **Cloud Sync (Supabase)**: Enable cross-device progress synchronization (PC to Laptop).
- [ ] **Automatic Backups**: Encrypted SQLite exports to local or cloud drives.

### 🤖 Phase 2: AI & Analytics
- [ ] **Integrated AI Chat**: A dedicated sidebar chat to ask follow-up questions about the current card.
- [ ] **Predictive Accuracy**: An AI model that predicts your board exam score based on current trend data.
- [ ] **Time-in-Study Gate**: Refine heatmap telemetry to count active study time rather than app-uptime.

### 🌐 Phase 3: Community & Content
- [ ] **Global Leaderboards**: Opt-in "Speed-Run" rankings for subject completion.
- [ ] **Public Manifest Gallery**: A community-driven repository to download shared decks for specific topics.

### 🎨 Phase 4: UI/UX Refinement
- [ ] **Theming Engine**: Support for multiple cyberpunk sub-themes (e.g., "Night City Blue", "Matrix Green").
- [ ] **Interactive 3D Components**: Integrate Three.js for 3D circuit visualizations in the formula lab.

---

## 🤖 AI Auditor Manifesto
1. **Never Hardcode Hex**: Use existing CSS variables.
2. **DB Integrity**: Proxied access via `db.service.ts` only.
3. **Cyberpunk Aesthetic**: High contrast and technical fonts are mandatory.

---
*Developed for the Engineers of 2026. Non sibi sed aliis.*
