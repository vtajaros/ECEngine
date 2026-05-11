# ⚡ ECEngine: The Ultimate Board Exam Command Center

**ECEngine** is a high-performance, cyberpunk-inspired study ecosystem specifically engineered for the **Philippine Electronics Engineering (ECE) Licensure Exam**. It transforms traditional review into a high-octane engineering workflow, designed to dominate the October 2026 boards.

---

## 🚀 Core Features & Functionality

### 📊 Tactical Dashboard (Telemetry)
- **Activity Heatmap**: Tracks your "Heartbeat" (time spent in app) across a 6-month window. Colors saturate from deep green (1h) to neon green (4h+).
- **Performance Telemetry**: Real-time Area Charts visualize your **Accuracy Trend**, allowing you to identify "fatigue zones" in your study schedule.
- **Subject Intelligence**: Dynamically calculates mastery percentage per subject (**MATH**, **GEAS**, **ELECS**, **EST**) based on successfully "Internalized" cards.
- **Exam Countdown**: A high-precision digital clock counting down to your target board exam date, creating a "Mission Critical" environment.

### 🧠 LooksFam Study Hub (Core Engine)
- **Multi-Modal Review**: Toggle between **Learn** (Partitioned repetition), **Test** (Full simulation), and **Mixed** modes.
- **Advanced Spaced Repetition**: Implements the **SM-2 Algorithm**. The system calculates your next review date based on your performance:
  - `Correct (First Try)`: Increases interval exponentially.
  - `Missed`: Resets interval, adding the card back to the "Critical List."
- **AI Explainer (✨)**: Leverages Large Language Models to provide "Just-In-Time" tutoring. It breaks down engineering solutions into:
  - *Theoretical Foundation*: The law/principle applied.
  - *Mathematical Derivation*: Step-by-step formula application.
  - *Distractor Rationale*: Why other choices were designed to trick you.
- **Interactive Question Tracker**: A sticky numbered navigation strip in Test Mode that uses pulsing indicators to show your current location in the "Manifest."

### 🧪 Formulas & Reference Laboratory
- **KaTeX Integration**: Renders complex ECE equations (e.g., Friis Transmission Equation, Shannon-Hartley Theorem) with textbook-grade precision.
- **Search & Filter**: Instantly isolate formulas by subject or tag for quick reference during problem-solving sessions.

### 📂 Manifest Management
- **Intelligent Parser**: Ingests raw text, JSON, or Quizlet exports.
- **Cyberpunk Folder System**: Organize decks into hierarchical folders. Folders are collapsible to maintain a clean workspace.
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
- [ ] **Cloud Sync (Supabase)**: Enable cross-device progress synchronization (PC to Laptop).
- [ ] **Multi-Profile Support**: Allow different study profiles for different users on the same machine.
- [ ] **Automatic Backups**: Encrypted SQLite exports to local or cloud drives.

### 🤖 Phase 2: AI & Analytics
- [ ] **Integrated AI Chat**: A dedicated sidebar chat to ask follow-up questions about the current card.
- [ ] **Predictive Accuracy**: An AI model that predicts your board exam score based on current trend data.
- [ ] **Voice-Activated Review**: Hands-free study mode using Speech-to-Text for MCQ selection.

### 🌐 Phase 3: Community & Content
- [ ] **Global Leaderboards**: Opt-in "Speed-Run" rankings for subject completion.
- [ ] **Public Manifest Gallery**: A community-driven repository to download shared decks for specific topics (e.g., "Advanced Filter Design").
- [ ] **Mobile Companion**: A lightweight React Native app for reviewing flashcards on the go.

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
