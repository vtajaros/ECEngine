<div align="center">
  <img src="resources/ecengine_icon.png" alt="ECEngine Logo" width="120" />
  <h1>⚡ ECEngine</h1>
  <p><strong>The Ultimate Cyberpunk-Utility Study Command Center for the Philippine Electronics Engineering (ECE) & ECT Licensure Exams</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/version-0.1.0-00FF41.svg?style=flat-square" alt="version" />
    <img src="https://img.shields.io/badge/Electron-31.0-47848F.svg?style=flat-square&logo=electron" alt="Electron" />
    <img src="https://img.shields.io/badge/React-18.3-61DAFB.svg?style=flat-square&logo=react" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6.svg?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Database-SQLite-003B57.svg?style=flat-square&logo=sqlite" alt="Database" />
    <img src="https://img.shields.io/badge/Styling-Tailwind%20%2B%20CSS%20Vars-38B2AC.svg?style=flat-square&logo=tailwind-css" alt="Tailwind" />
  </p>
</div>

---

**ECEngine** is a native, offline-first desktop application designed specifically for examinees preparing for the Philippine Electronics Engineering (ECE) and Electronics Technician (ECT) Licensure Exams. Powered by a local SQLite database and modern spaced repetition (SM-2), ECEngine provides an integrated command center for reviewing multiple-choice questions (MCQs), flashcards, and LaTeX formula banks with real-time mathematical rendering.

Built with **Electron 31**, **React 18**, **TypeScript**, and **Vite**, state-managed via **Zustand**, and styled with a cyberpunk-inspired Tailwind design system and **Framer Motion** animations.

**Supported Platforms**: Windows, macOS, and Linux — 100% offline and cross-platform.

---

## 🚀 Core Features

### 🧠 Active Recall & Spaced Repetition (SM-2)
* **SuperMemo-2 (SM-2) Scheduling Engine**: Fully implemented spaced repetition algorithm (`src/lib/sm2.ts`) that calculates interval expansions and Ease Factor adjustments based on review quality to maximize long-term retention:
  * **Again (`1` / `< 1m`)**: Full lapse / incorrect recall. Resets consecutive repetitions to `0`, resets interval to `1` day, and applies standard SM-2 Ease Factor penalty ($\text{EF} \ge 1.3$).
  * **Hard (`2` / `~5m`)**: Effortful retrieval. Preserves consecutive repetitions, contracts the interval by 20% ($\max(1, \text{round}(\text{Interval} \times 0.8))$), and decreases Ease Factor.
  * **Good (`3` / `~10m`)**: Successful recall. Increments repetition count; schedules standard interval expansion ($1\text{d} \to 6\text{d} \to \text{round}(\text{Interval} \times \text{EF})$).
  * **Easy (`4` / `4d+`)**: Effortless instant recall. Increments repetition count, computes expanded interval, and grants a bonus $+0.15$ Ease Factor boost (capped at $4.0$).
* **Automated Due Queue & Calendar Scheduling**:
  * Prioritizes unreviewed cards (`next_review IS NULL`) first, followed by due cards (`next_review <= today`) ordered chronologically.
  * Future cards are automatically deferred and filtered out of active sessions until their due date arrives.
  * Provides a dedicated completed/deferred queue screen with actionable feedback when all cards in a deck are scheduled for future review.
* **Ergonomic Hotkeys & Keyboard Navigation**:
  * `1` / `2` / `3` / `4`: Instantly submit SM-2 ratings (`Again`, `Hard`, `Good`, `Easy`) once the card back is revealed or a written answer is submitted.
  * `Space` / `Enter`: Advance to the next card immediately after rating without lifting hands from the keyboard.
  * `Space`, `ArrowUp`, or `ArrowDown`: Flip cards; `ArrowDown` / `ArrowUp` also seamlessly expands and collapses inline solutions/explanations.
  * `←` / `→`: Navigate to the previous card or skip ahead.
  * `F`: Instant hotkey toggle for Term / Definition swapping.
* **Interactive Rating UI & Spring Physics**:
  * Color-coded cyberpunk rating buttons (Red `#FF3333`, Amber `#FFB800`, Green `#00FF41`, Cyan `#00BFFF`) with animated spring transitions, button elevation, and active glow effects.
  * Fixed-height utility slots to eliminate layout shifts and content jumping during card flips and rating feedback.
  * Animated rating confirmation badges with dynamic reset countdown hints and glowing neon-green **Next Card** / **Finish** CTAs.
* **Audio & TTS Synchronization**:
  * Automatic audio cutoff: Rating a card or navigating immediately cancels active Web Speech API or Piper neural TTS streams, preventing voice overlap.
  * Distinct sound effects on card ratings (`correct` tone vs `wrong` alert).
* **Written Mode & Study Controls**:
  * Active typed-answer mode requiring exact input validation and live accuracy tracking before revealing card answers.
  * Study controls for shuffling, bookmarked-only filtering, and term/definition swapping.

---

### 📝 Multiple Choice (MCQ) & "LooksFam" Engine
* **Learn Mode**: Immediate feedback with instant answer validation, detailed solution breakdowns, and AI-powered explanations. Features an ergonomic question header with an integrated, non-overlapping bookmark button.
* **Partitioned Learning Rounds**: Breaks large question sets into manageable batches (default 5 cards per round) with dynamic retry queues for incorrect items until 100% mastery is achieved.
* **Isolated Practice Mode**: Supports clean practice runs (e.g. for Gauntlet missed items) that reinforce concepts without altering core SM-2 intervals, attempt logs, or session history.
* **Test Mode**: Simulates exam conditions with randomized choice orders, live timer, and a comprehensive end-of-test summary.
* **Bookmarked Items Manager**: Quickly review, preview, and manage bookmarked questions directly from the deck browser with a dedicated legend and modal.
* **Choice Shuffling**: Automatically randomizes options on every run while preserving correct answer mappings.

---

### ⚔️ Gauntlet Mode: Speed, Survival & Elo Ratings
* **High-Octane Arcade Challenge**: Designed for rapid-fire recall and reflex conditioning under pressure. Correct answers actively contribute to card mastery scores and review statistics while fully protecting your core SM-2 spaced repetition intervals and ease factors from fast-paced error penalties.
* **Interactive Subject Selection & Real-Time Rank Telemetry**:
  * **Single-Click to Solo · Double-Click to Combine**: Instant single-click subject isolation or double-click combination across **MATH**, **GEAS**, **ELECS**, and **EST** with snappy debounce.
  * **Current Rank Pill & XP Meter**: Live header telemetry widget displaying your current rank tier, Elo rating, provisional status (`PROV`), and an animated **XP Meter** progress bar showing points needed until your next rank tier.
  * **2-Column Elo Ranking Tiers Modal (`GauntletRanksModal`)**: 1-click access to view all 6 progression brackets (**Insulator**, **Semiconductor**, **Conductor**, **Copper**, **Silver**, **Superconductor**) and PRC Table of Specifications weighting without vertical scrolling.
* **Multi-Chapter Topic Focus Selection (`GauntletTopicModal`)**:
  * Dedicated pop-up modal replacing legacy dropdowns to customize session pools across multiple TOS syllabus topics simultaneously.
  * **Context-Aware Tabs**: Automatically defaults to the selected subject's tab when drilling a single subject.
  * **Granular Subtopic Switching**: Toggle between 34 Parent Topics ($x.0$) and 181 Granular Subtopics ($x.x$) with live search, *Select All Visible*, and *Clear Filter* controls.
  * **Topic-Focused Ranked Runs**: Topic-filtered ranked runs apply a balanced $0.4\times$ Elo rating scaling factor.
* **Game Modes & Dynamic Presets**:
  * **Timed Mode ("Race the Clock")**:
    * Session duration presets: **5m**, **10m**, **25m**, and **1 hr**.
    * Question distribution strategies: **PRC TOS Allocation** (20% MATH, 20% GEAS, 30% ELECS, 30% EST), **Equal Split**, or **Custom Counts**.
    * Dynamic scoring: Combines question weight, answer speed multiplier (up to $1.5\times$ for answering under half par time), and active streak multiplier.
    * **Skip Bank**: Earn $+1$ skip credit for every 20 consecutive correct answers.
  * **Survival Mode ("Beat the Timer")**:
    * Starting lives presets: **3 Lives** ($1.10\times$ multiplier), **5 Lives** ($1.00\times$ standard), or **Unlimited** ($\infty$ casual practice mode with $0.50\times$ multiplier).
    * Per-question time limits: **30 Seconds** ($1.00\times$), **1 Minute** ($0.70\times$), **2 Minutes** ($0.50\times$), and **Unlimited** (Accuracy Mode, $0.08\times$).
    * **Uncapped Extra Lives**: Earn $+1$ life for every 10-consecutive correct answer streak with **no upper cap**, allowing skilled runs to build deep life reserves.
    * **Accuracy Mode**: Unlimited per-question timer with minimal score multiplier ($0.08\times$) and strictly capped $\pm 1$ Elo rating adjustments, allowing deep calculation without artificial rating inflation.
* **HUD & Dynamic Feedback**:
  * **Streak Bonus Milestones**: Temporary $+50$ point popup badges with 2-second neon-green (`#00FF41`) linger animations upon reaching streak thresholds.
  * **Adaptive Cyberpunk Audio & Visuals**: Crossfading dynamic Web Audio background music across intensity regions (**Stealth**, **Low**, **Med**, **High**, **Boss**), glowing low-health HUD pulse, and calibrated sound effects.
  * **Clean In-Game Focus**: Question cards keep syllabus topic classifications hidden during active play to prevent spoilers.
* **Ranked vs. Unranked Runs**:
  * **Ranked**: Tracks per-subject Elo-style ratings across all 4 subjects with provisional rating indicators ($<30$ answers) and official PRC TOS-weighted overall rating score.
  * **Shared Topics 50/50 Elo Split**: Automatically detects syllabus competencies shared between subjects (e.g. Mathematics and Electronics overlap). Correct and wrong answers dynamically distribute rating adjustments 50/50 across both subjects without duplicating attempt counts.
  * **Unranked**: Casual practice runs leaving Elo ratings unchanged.
* **Rank-Up Celebration Modal (`GauntletRankUpModal`)**:
  * Automatically triggered upon earning a promotion into a higher progression tier (e.g. Copper, Silver, Superconductor).
  * Features real-time animated rating counter interpolation, XP bar filling up to the next tier floor, radial tier-colored ambient glow, keyboard/escape dismissal, and celebration fanfare SFX.
* **Comprehensive Post-Run Review & Session Persistence**:
  * **Two-Column Tactical Breakdown**: Stats sidebar with accuracy, speed, rating deltas, and score metrics.
  * **Struggling Topics Focus Area**: Highlights top problem TOS topics from the run with miss ratios to immediately focus review.
  * **Question Origin & Deck Tracking**: Every reviewed question displays its source deck name and 1-based card position in that deck (e.g. `📁 [Deck Name] #[number]`), enabling instant cross-referencing.
  * **Question Flagging & Exclusion**: Directly flag broken or ambiguous questions with custom reason tags; flagged questions are automatically excluded from subsequent Gauntlet pools.
  * **Inline TOS Category Overrides**: Directly reassign or correct question Table of Specifications (TOS) tags within the post-run review list with a searchable category picker popover.
  * **Learn Missed Items**: Launch an on-demand Learn Mode session targeting only the questions missed in that run, cleanly isolated from core session history and statistics.
  * **Centered Tactical Action Bar**: Quick controls for **Get Context** (formatted clipboard export for AI), **AI Explain** (inline step-by-step breakdown), and **Flag Question**.
  * **Filterable Review List**: Filter by All, Mistakes, Skipped/Timeout, or Correct with inline choices and full mathematical solutions.
  * **Session Snapshot Persistence (`useGauntletStore`)**: In-memory and `sessionStorage` snapshot persistence ensures users can seamlessly navigate between Gauntlet and other tabs without losing review progress, replaying game-over sounds, or re-triggering rank-up popups upon return.
  * **Gauntlet FAQ Modal**: Complete in-game guide covering scoring mechanics, time limits, multipliers, progression tiers, and SM-2 protection.

---

### 📐 Mathematical & LaTeX Rendering Engine
* **Hybrid KaTeX + Plain Text Parser**: Supports raw LaTeX, inline `$...$` and block `$$...$$` math, alongside markdown styling (`**bold**`, `*italic*`, `__underline__`).
* **Advanced Super/Subscript Parsing**:
  * Single character: `x^2`, `R_L`
  * Curly braces: `10^{-8}`, `V_{out}`
  * Parenthesized expressions: `e^(v - u)`, `u = ln(e^v + c)`, `f_(n + 1)`
* **ECE Symbol Normalization**: Seamlessly parses non-standard and MathJax symbols into standard KaTeX (e.g. `\phase{}`, `\SI{}{}`, `\ang{}`, `\boldsymbol{}`, `\exponentialE`, `\imaginaryI`).
* **MathLive Equation Editor**: Interactive visual equation editor (Σ button) embedded into card forms with real-time preview and instant text/math mode toggling.
* **High-Performance LRU Rendering Cache**: In-memory LRU render cache (`MATH_CACHE` / `PLAIN_TEXT_CACHE` capped at 2,000 entries) in `src/lib/latex.ts`, eliminating duplicate KaTeX parsing and delivering instantaneous, flicker-free re-render performance for complex mathematical equations and solutions.

---

### 🖨️ Test Paper & PDF Engine (PrintView)
* **Mock Exam Printouts**: Turn any MCQ, Flashcard, or Formula deck into a high-density, printable exam sheet.
* **3 Layout Modes**:
  * **Glossary**: Clean two-column vertical study list.
  * **Table**: Compact grid with problem and answer/solution columns.
  * **Q&A**: Classic question-and-answer format.
* **Themes**: Switch between **Light**, **Sepia**, and **Dark** (default, with cyber-neon green highlights matching the companion app).
* **Solution & Answer Toggles**: Show or hide answers and detailed solutions with a single click.
* **Find in Document (`Ctrl + F`)**: Integrated search bar with live text highlighting (`<mark>`), occurrence counter, and match stepping.
* **High-Res Image Lightbox**: Click any diagram or solution schematic to expand into a high-resolution lightbox overlay.
* **Themed PDF Export**: Exports clean multi-page PDFs with persistent headers/footers matching the selected paper theme.
* **Chunked Rendering & Window Management**: Asynchronous chunked DOM rendering ensures snappy responsiveness even across large, multi-hundred question test sheets; supports window maximization state and custom title bar controls.

---

### 🗂️ Deck Management & Authoring
* **Comprehensive Deck Editor**: Create and edit MCQ, Flashcard, and Formula decks with live previews and image attachment support.
* **Default Deck TOS Topic Support**: Assign a default decimal Table of Specifications category (`default_tos_topic_id`) at the deck level so newly added or imported questions automatically inherit the appropriate syllabus code.
* **Batch TOS Auto-Tagger Modal (`OperationProgressModal`)**: Full database and deck-level classification utility with choice between overwriting existing tags or tagging untagged questions only, accompanied by real-time progress bar telemetry.
* **Favorite Decks & Instant Filtering**: Star high-priority decks across Study, LooksFam, and Formula banks. Filter favorites with a single click from the Folder panel or Advanced Filters popover.
* **AI-Powered Deck Description**: Auto-generate concise, topic-focused deck descriptions (<12 words) directly in the deck editor using Groq AI (`openai/gpt-oss-120b`).
* **Drag-and-Drop Card Reordering**: Powered by `@dnd-kit`, card order is saved directly to SQLite.
* **Per-Choice LaTeX / Text Toggles**: Specify whether individual choices should render as pure text or LaTeX equations.
* **Collapsible Solutions & Explanations**: Enrich any card with reasoning, derivations, and dedicated solution images.
* **Smart Collision-Aware Tooltips**: Dynamic viewport boundary detection with multi-axis auto-flipping to prevent tooltip clipping in narrow panels and sidebars.
* **Interactive Formatting Guide Modal**: Built-in reference in the editor detailing hotkeys (`Ctrl+B`, `Ctrl+I`, `Ctrl+U`, `Tab`), super/subscripts, and LaTeX syntax.
* **Folder Hierarchy**: Nested folder organization with drag-and-drop ordering and separate namespaces for Study and Formula decks.

---

### 📥 Bulk Import, Migration & Companion App Sync
* **Quizlet Importer**: Paste Quizlet exports directly into the app; automatically detects MCQs vs. Flashcards and applies automatic typo and symbol fixes.
* **Native Plain-Text Format**: Quick bulk creation using clean text blocks separated by blank lines:
  ```text
  Q: What is the unit of magnetic flux density?
  A: Weber
  B: Tesla
  C: Henry
  D: Maxwell
  ANS: B
  ```
* **Full Backup & Selective Export**: Export all decks or cherry-pick specific decks into portable JSON/text archives.
* **Database & Images Export (Companion App Ready)**: One-click export of the active SQLite database (`ecengine.sqlite`) and zipped diagram assets (`ece-images.zip`) to any destination folder for easy offline backup and synchronization with the **ECEngine Android Companion App**.

---

### 📱 ECEngine Android Companion App
* **Study Anywhere**: Transfer your exported `ecengine.sqlite` and `ece-images.zip` directly to your Android device.
* **Unified Cyberpunk Aesthetic**: Consistent dark mode interface with vibrant neon green accents and crisp LaTeX equation rendering.
* **Full Offline Portability**: Access all study decks, question explanations, and schematics on the go without requiring an internet connection.

---

### 📊 Board Exam Tools & Analytics
* **2022 EELE Table of Specifications (ToS) & Cognitive Level Breakdown**:
  * Complete coverage of official PRC Board Examination specifications across **Mathematics**, **Electronics Engineering**, **GEAS**, and **EST**.
  * **Topic & Subject Item Breakdown**: Real-time item counts and proportional difficulty distribution bars (Easy `--tier-easy`, Moderate `--tier-moderate`, Difficult `--tier-difficult`).
  * **Per-Row Exam Item Mapping**: Fine-grained mapping of subtopics to official exam items with cognitive level badges ($K$ Knowledge, $C$ Comprehension, $A$ Application, $An$ Analysis, $S$ Synthesis, $E$ Evaluation).
  * **Grouped Syllabus Accordions**: Subtopic clusters grouped according to PDF specifications with search filtering and instant text highlighting.
* **Interactive Review Checklist**:
  * Synchronously preloaded in-memory state via `useChecklistStore` for instant, flicker-free tab transitions, per-topic accordion expansion state tracking (`expandedTopics`), and offline `localStorage` persistence.
  * Multi-column weighted progress tracking: *Review* (10%), *Refresher* (20%), and *Self Review* (70%) with dynamic subject badges and overall progress animations.
* **Activity Heatmap & Trends**: 6-month study activity heatmap, subject accuracy trends, and mastery metrics.
* **Gauntlet Subject Elo History Chart (`SubjectEloChart`)**: Interactive dashboard chart visualizing Elo rating evolution over time across **MATH**, **GEAS**, **ELECS**, and **EST** with hover telemetry and subject toggling.
* **Exam Countdown Timer**: Live countdown clock targeting your scheduled Board Exam date.

---

### 🏷️ Table of Specifications (TOS) Classification System
* **Official PRC ECE Board Exam Taxonomy**: Built-in hierarchy encompassing 34 parent topics ($x.0$) and 181 granular subtopics ($x.x$) across Mathematics, Electronics Engineering, GEAS, and EST per official PRC Board Examination specifications.
* **Granular Decimal Tagging**: Cards are classified under granular decimal subtopics ($x.x$) or left untagged, while parent topics ($x.0$) serve as high-level organizational aggregators.
* **Card & Question Categorization**: Assign decimal TOS topic tags to questions in the Deck Editor with an organized, searchable dropdown and formatted badge previews.
* **Automated AI Batch Classifier**: Python and Groq AI classifier script integration (`scripts/classify_database_tos.py`) with expanded regex pattern coverage across Mathematics, Access Control, Signal Processing, and Electronics for automated syllabus mapping and whole-database tagging.
* **Syllabus-Linked Gauntlet Targeting**: Classifications link directly with Gauntlet telemetry, automatically detecting struggling subtopics ($<70\%$ accuracy) to prioritize them in practice runs.

---

### 🔬 Data Analytics: TOS Matrix, Statistical EDA & Gauntlet Telemetry
The **Data Analytics Command Center** (`/lab`) provides an integrated, 3-pillar data suite for syllabus mapping, inferential statistics, and competitive speed-run telemetry:

#### 1. ToS Classification & Coverage Matrix (`TosCoverageMatrixDemo`)
* **Master-Detail Two-Column Layout**: Left-hand master syllabus list displaying all 34 PRC parent topics ($x.0$) with live card counts, active neon border indicator, and subject isolation badges; right-hand detail pane listing all decimal subtopics ($x.x$) with direct coverage status bullets and card volume tags.
* **LooksFam Subject Filter Pillboxes**: Instant filter pills (`ALL`, `MATH`, `GEAS`, `ELECS`, `EST`) with custom RGB border/glow accents and inner card count badges.
* **Single-Line Summary Ribbon**: Sleek JetBrains Mono telemetry ribbon tracking Total Cards, Classified %, Untagged Card alert chip, and official subtopic syllabus coverage ratio ($x/181\text{ Subtopics}$).
* **Card Inspector Modal (`TosCardInspectorModal`)**: Deep-dive inspection modal to preview, flip, and manage all cards under any parent topic, subtopic, or untagged pool.
* **Interactive Card Search (`TosCardSearchDemo`)**: Full-text question search across the library with real-time flashcard flip previews, formula/solution inspection, and 1-click jump-to-topic navigation.
* **Gauntlet Excluded Questions Browser**: Dedicated view listing flagged or auto-excluded cards with 1-click reinsertion actions.

#### 2. Statistical EDA (Exploratory Data Analysis)
* **Live Inferential & Descriptive Statistics**:
  * **Content Coverage vs. PRC TOS Target**: Card counts and topic proportions across **MATH**, **GEAS**, **ELECS**, and **EST** compared directly against official PRC Board Examination TOS target weights (20%, 20%, 30%, 30%).
  * **Mean Question Length by Subject (MCQ)**: Character length metrics per subject with total $N$, library mean, and median values to visualize problem statement right-skewness.
  * **Answer Key Position Balance (MCQ)**: Chi-square goodness-of-fit ($\chi^2$), $p$-value, and Cramér's $V$ effect size tests measuring uniform distribution across choices A (0), B (1), C (2), and D (3) to evaluate option balance.
  * **Question Length: One-Way ANOVA (MCQ)**: One-way Analysis of Variance testing whether question character length differs significantly across exam subjects ($F$-statistic, $p$-value, and degrees of freedom $df_1 / df_2$).
  * **Answer Position vs. Subject Independence**: $4 \times 4$ contingency table and two-way Chi-Square Test of Independence ($\chi^2$, $p$-value, $df = 9$) testing whether correct answer placement is independent of subject category, rendered as a color-coded heatmap intensity grid.
  * **Outlier Detection via Z-Scores**: Library-wide question length standardization ($z = \frac{x - \bar{x}}{s}$) categorizing questions into Typical ($|z| \le 2$), Outlier ($|z| > 2$), and Severe Outlier ($|z| > 3$), identifying extreme questions and their respective subject areas.
  * **Response Time Distribution (MCQ vs. Flashcard)**: Unpooled response latency histograms and separate mean/median review paces comparing timed first-attempt MCQ recall (Learn Mode) against self-paced SM-2 spaced repetition (Flashcard Mode).
* **Interactive Stat Info Modals**: Click any statistical metric tile to open an in-depth modal featuring mathematical formulas rendered in KaTeX, conceptual explanations, and practical review takeaways.
* **In-Memory Caching & Snappy Visualization**: Powered by `useDataLabStore` with background preloading on application launch and automatic cache refresh on study completion or deck imports.

#### 3. Gauntlet Analytics (Performance Telemetry & Topic Mastery)
* **Topic Accuracy & Mastery (`GauntletTopicAccuracyDemo`)**:
  * **Unified Master-Detail Two-Column Architecture**: Aligned 1:1 with the TOS Matrix design for visual consistency. Left pane displays parent syllabus topics with overall accuracy percentages, attempt counts, and weak spot indicator dots; right pane details subtopic competencies.
  * **Strict Per-Subject Categorization**: Streamlined tabs (`[MATH 32]`, `[GEAS 64]`, `[ELECS 45]`, `[EST 40]`) with subject-themed glows, eliminating cross-subject topic interleaving.
  * **Real-Time Certified Weak Spot Filter**: 1-click toggle isolating competencies struggling under 70% accuracy with $\ge 3$ attempts.
  * **Calibrated Decimal Subtopic Mastery Tags**:
    * `Calibrating` (blue badge, $<3$ attempts)
    * `Critical Weakness` (red badge, $<50\%$ accuracy, $\ge 3$ attempts)
    * `Needs Review` (amber badge, $<70\%$ accuracy, $\ge 3$ attempts)
    * `Solid` (emerald badge, $70\%\text{--}84\%$ accuracy)
    * `Mastered` (cyan badge, $\ge 85\%$ accuracy, $\ge 5$ attempts)
    * `Untested` (dim gray badge, 0 attempts)
  * **Dual Progress Telemetry**: Side-by-side accuracy bars (accuracy %, correct/wrong attempts) and card penetration meters (coverage %, studied/total cards).
  * **Scope Switcher**: Toggle between **Arena Only** (high-stakes Gauntlet speed runs) and **All Modes** (combined Learn, Test, and Gauntlet attempts).
  * **Custom Sort Engine**: Sort competencies by Syllabus Order, Reverse Syllabus, Lowest Accuracy (Weakest first), Highest Accuracy, Studied Progress, Most Misses, and Most Practiced.
* **Speed & Par Pacing (`GauntletSpeedParDemo`)**: Pacing curves comparing player response times against algorithmic question par times across difficulty weights.
* **Elo Trajectory (`GauntletEloTrajectoryDemo`)**: Interactive telemetry tracking rating evolution, peak milestones, and provisional status over time.
* **Coverage Density (`GauntletCoverageDensityDemo`)**: Syllabus penetration and blind-spot heatmaps identifying unattempted card pools.
* **Endurance & Survival Streak (`GauntletEnduranceStreakDemo`)**: Survival curves, survival run survival rates, and streak bucket distributions.
* **Excluded & Flagged Questions (`GauntletExcludedQuestionsDemo`)**: Comprehensive management table for flagged questions with 1-click reinsertion into the Gauntlet question pool.

---

### 🤖 AI Explanations & Context Generation
* **Groq AI Integration**: Direct integration with Groq (`openai/gpt-oss-120b`) for on-demand step-by-step problem explanations and automated deck summaries.
* **AI-Powered Deck Summaries**: Single-click auto-generation of crisp deck summaries distilling up to 40 sample cards into clean topic phrases without introductory filler.
* **Dual "Get Context" Split Exporter (`GetContextDropdown`)**:
  * **1-Click Text Explanation**: Copies a structured problem prompt to the clipboard (question, choices, correct answer, subject, and TOS topic) requesting step-by-step derivations, distractor analysis, formulas, and board exam memory tips.
  * **Visual & Diagram Prompt**: Specialized prompt directing external AI (ChatGPT, Claude, Gemini, Midjourney) to produce mental models, renderable technical diagram code (Mermaid.js, ASCII schematics, SVG), and tailored image-generation prompts.
  * Universal integration across **Gauntlet Review**, **Learn Mode**, **Test Mode**, and **Flashcard Study**.
* **Live AI Usage & Rate-Limit Dashboard**: Track Groq API rate limits (requests per minute/day and tokens per minute) in real time from Settings, featuring progress indicators, rate-limit warnings (>85%), and dynamic reset countdown timers.

---

### ⚙️ Settings & System Customization
* **Custom Images Directory**: Select a custom folder for all diagrams and card media with native directory browsing.
* **KaTeX Scale & Bold Mode**: Customize math rendering size (`0.8em` to `1.5em`) and toggle high-contrast KaTeX bold mode.
* **Global App Zoom**: Scale the UI (`80%` – `130%`) with `Ctrl+=`, `Ctrl+-`, `Ctrl+0`, and `Ctrl + Mouse Wheel`.
* **Database Management & Export**: View active SQLite file path, switch database location, or export database + zipped images to a directory with a single click.
* **Master Audio Volume & SFX Settings**: Global SFX volume slider (`VolumeControl`), persistent sound levels, and customizable wrong-answer meme audio ("faah sound meme" vs synthesized alert).
* **Cross-Platform TTS Settings**: Configurable speech rate, voice selection, and Linux Piper ONNX neural voice model management.
* **AI Telemetry & Rate-Limit Tracking**: Antigravity-inspired usage tracker with real-time percentage indicators and reset timers for your configured Groq API key.

---

## 📝 Formatting & Math Cheatsheet

Text fields across questions, choices, formulas, and explanations support inline Markdown and LaTeX:

| Syntax | Description | Example Output |
|---|---|---|
| `**text**` (or `Ctrl+B`) | Bold | **text** |
| `*text*` (or `Ctrl+I`) | Italic | *text* |
| `__text__` (or `Ctrl+U`) | Underline | <u>text</u> |
| `x^2` / `R_L` | Single-character super/subscript | x², R<sub>L</sub> |
| `10^{-8}` / `V_{out}` | Multi-character super/subscript (braces) | 10⁻⁸, V<sub>out</sub> |
| `e^(v - u)` / `f_(n + 1)` | Expression super/subscript (parentheses) | e<sup>(v - u)</sup>, f<sub>(n + 1)</sub> |
| `$\sin\theta$` | Inline LaTeX equation | $\sin\theta$ |
| `$$E = mc^2$$` | Centered display block equation | $$E = mc^2$$ |
| `\phase{30}` | Electrical angle / phasor | $\angle 30^{\circ}$ |
| `\SI{10}{k\Omega}` | SI unit formatting | $10\text{ k}\Omega$ |

---

### ⌨️ Flashcard Study & Navigation Hotkeys

| Key | Action | Context / Behavior |
|---|---|---|
| `Space` / `↑` / `↓` | **Flip Card** | Toggle between card Front and Back |
| `↓` (Arrow Down) | **Expand Explanation** | Open collapsible step-by-step solution / AI breakdown (when flipped) |
| `↑` (Arrow Up) | **Collapse Explanation** | Close collapsible explanation and restore card focus |
| `1` | **Again** (`< 1m`) | Reset repetitions to 0, reset interval to 1d, apply EF penalty |
| `2` | **Hard** (`~5m`) | Retain repetitions, contract interval by 20%, decrease EF |
| `3` | **Good** (`~10m`) | Advance repetition stage (1d $\to$ 6d $\to$ $\text{Int} \times \text{EF}$), adjust EF |
| `4` | **Easy** (`4d+`) | Advance repetition stage with bonus $+0.15$ Ease Factor boost |
| `Space` / `Enter` | **Next Card** | Advance to next scheduled card after rating |
| `←` / `→` | **Prev / Skip** | Navigate to previous card or skip current card without rating |
| `F` | **Swap Term / Def** | Toggle between Term $\to$ Definition and Definition $\to$ Term |

---

## 🏗 System Architecture

ECEngine runs as an Electron desktop application where the React UI connects to a local SQLite database via asynchronous Electron IPC channels.

```mermaid
flowchart TD
    subgraph Frontend [React 18 + Vite Renderer]
        UI[Pages & Components]
        Stores[Zustand State Stores]
        DBService[src/services/db.service.ts]
        UI --> Stores
        Stores --> DBService
    end

    subgraph IPC_Bridge [Preload Bridge]
        Bridge[window.electron.*]
        DBService --> Bridge
    end

    subgraph Backend [Electron Main Process]
        IPC[electron/ipc/ handlers]
        SQLite[better-sqlite3 Database Engine]
        DB[(ecengine.sqlite)]
        Bridge --> IPC
        IPC --> SQLite
        SQLite --> DB
    end
```

### Database Schema Overview

```sql
-- Topic / Deck metadata
CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT DEFAULT '',
  parent_id TEXT REFERENCES topics(id),
  order_index INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',
  folder_name TEXT DEFAULT 'Uncategorized',
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  is_favorite BOOLEAN DEFAULT 0,
  default_tos_topic_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Card items (MCQ, Flashcard, Formula)
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  type TEXT NOT NULL,          -- 'mcq' | 'flashcard' | 'formula'
  data TEXT NOT NULL,          -- JSON payload of question/choices/latex/explanation
  difficulty TEXT DEFAULT 'medium',
  tags TEXT DEFAULT '[]',
  tos_topic_id TEXT,           -- e.g. 'ELECS-1.0' or 'ELECS-1.1'
  is_custom BOOLEAN DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

-- SM-2 Spaced Repetition progress
CREATE TABLE progress (
  card_id TEXT PRIMARY KEY,
  ease_factor REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  next_review TEXT,
  last_reviewed TEXT,
  correct_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  last_result TEXT,
  FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- Folder hierarchy for deck organization
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id),
  order_index INTEGER DEFAULT 0,
  scope TEXT NOT NULL DEFAULT 'study' -- 'study' | 'formula'
);

-- Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_next_review ON progress(next_review);
CREATE INDEX IF NOT EXISTS idx_last_reviewed ON progress(last_reviewed);
CREATE INDEX IF NOT EXISTS idx_cards_topic_id ON cards(topic_id);
CREATE INDEX IF NOT EXISTS idx_cards_topic_type ON cards(topic_id, type);
CREATE INDEX IF NOT EXISTS idx_cards_tos_topic ON cards(tos_topic_id);
CREATE INDEX IF NOT EXISTS idx_topics_folder_id ON topics(folder_id);
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject);
CREATE INDEX IF NOT EXISTS idx_topics_is_favorite ON topics(is_favorite);
CREATE INDEX IF NOT EXISTS idx_topics_default_tos ON topics(default_tos_topic_id);

-- Daily activity tracking
CREATE TABLE study_activity (
  day TEXT PRIMARY KEY,        -- YYYY-MM-DD
  count INTEGER DEFAULT 0,
  time_spent INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0
);

-- Mock exam records
CREATE TABLE exam_sessions (
  id TEXT PRIMARY KEY,
  topic_id TEXT,
  mode TEXT,
  started_at TEXT,
  finished_at TEXT,
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  answers TEXT DEFAULT '{}'
);

-- Attempt telemetry for response time & performance analysis (survives card deletion)
CREATE TABLE attempt_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,           -- YYYY-MM-DD
  card_id TEXT NOT NULL,
  topic_id TEXT,
  subject TEXT,
  card_type TEXT,
  mode TEXT NOT NULL,          -- 'learn' | 'flashcard' | 'test'
  correct INTEGER NOT NULL,
  quality INTEGER,
  response_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_attempt_ts ON attempt_log(ts);
CREATE INDEX IF NOT EXISTS idx_attempt_day ON attempt_log(day);
CREATE INDEX IF NOT EXISTS idx_attempt_subject_ts ON attempt_log(subject, ts);
CREATE INDEX IF NOT EXISTS idx_attempt_card ON attempt_log(card_id);

-- Gauntlet high-stakes speed runs & answers
CREATE TABLE gauntlet_runs (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  mode TEXT NOT NULL,          -- 'timed' | 'survival'
  config TEXT NOT NULL,
  rated INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL,
  answered INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  wrong INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  best_streak INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  end_reason TEXT NOT NULL,
  ratings_before TEXT,
  ratings_after TEXT,
  subject_breakdown TEXT
);

CREATE TABLE gauntlet_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  card_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  chosen INTEGER,
  answer_index INTEGER NOT NULL,
  outcome TEXT NOT NULL,       -- 'correct' | 'wrong' | 'skipped' | 'timeout'
  time_ms INTEGER NOT NULL,
  par_ms INTEGER NOT NULL,
  points INTEGER NOT NULL,
  streak_after INTEGER NOT NULL,
  choices TEXT,
  answered_at INTEGER NOT NULL
);

-- Gauntlet Elo-style subject ratings
CREATE TABLE gauntlet_ratings (
  subject TEXT PRIMARY KEY,    -- 'MATH' | 'GEAS' | 'ELECS' | 'EST'
  rating REAL NOT NULL,
  answers INTEGER NOT NULL DEFAULT 0,
  peak REAL,
  updated_at INTEGER NOT NULL
);

-- Flagged questions excluded from Gauntlet pool
CREATE TABLE gauntlet_flagged_cards (
  card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  reason TEXT,
  flagged_at INTEGER NOT NULL
);

-- Allowed cards (whitelist for cards reinserted into Gauntlet pool)
CREATE TABLE gauntlet_allowed_cards (
  card_id TEXT PRIMARY KEY,
  allowed_at INTEGER NOT NULL
);

-- Daily review Elo bonus tracking
CREATE TABLE gauntlet_daily_review_elo (
  subject TEXT NOT NULL,       -- 'MATH' | 'GEAS' | 'ELECS' | 'EST'
  date TEXT NOT NULL,          -- YYYY-MM-DD
  gained REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, date)
);

CREATE INDEX IF NOT EXISTS idx_gauntlet_runs_started ON gauntlet_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_gauntlet_answers_run ON gauntlet_answers(run_id, seq);
CREATE INDEX IF NOT EXISTS idx_gauntlet_answers_card ON gauntlet_answers(card_id);
CREATE INDEX IF NOT EXISTS idx_gauntlet_flagged_card ON gauntlet_flagged_cards(card_id);
CREATE INDEX IF NOT EXISTS idx_gauntlet_allowed_card ON gauntlet_allowed_cards(card_id);
```

---

## 📂 Project Structure

```text
ecengine/
├── electron/                    # Electron Backend Process
│   ├── main.ts                  # App lifecycle, window management, zoom, hotkeys
│   ├── preload.ts               # contextBridge IPC API exposure
│   ├── db/                      # SQLite connection, schema bootstrap, migrations (v1–v18)
│   └── ipc/                     # Modular IPC handlers (DB, Deck, Analytics, AI, Print, Config, TTS, Export)
├── src/                         # React Frontend (Renderer)
│   ├── assets/                  # Brand assets, icons, bundled fonts (Rajdhani, JetBrains Mono, Orbitron)
│   ├── components/              # Modular UI Components
│   │   ├── ui/                  # Tooltip (auto-flipping), GetContextDropdown (split-button), OperationProgressModal, TosTopicPicker, VolumeControl, FolderPanel, Toast, TOSTracker
│   │   ├── gauntlet/            # GauntletHome, GauntletSetup, GauntletTopicModal, GauntletRanksModal, GauntletRankUpModal, GauntletFaqModal, GauntletRecordsModal, GauntletWeakAreasModal, GauntletBackdrop
│   │   ├── mcq/                 # MCQCard, LearnMode, TestMode, BookmarkedCardsModal
│   │   ├── flashcard/           # FlashcardSession, FlashcardDeckBrowser, StudyCard
│   │   ├── deck/                # CardForms, DeckCard, AIDescriptionButton, AdvancedFiltersPopover
│   │   ├── study/               # StudyHeader, StudySessionStats
│   │   ├── dashboard/           # ReviewHeatmap, SessionHistory, ExamCountdown, SubjectEloChart
│   │   ├── stats/demos/         # Data Analytics suites (TosCoverageMatrixDemo, TosCardSearchDemo, TosCardInspectorModal, GauntletTopicAccuracyDemo, GauntletSpeedParDemo, GauntletEloTrajectoryDemo, GauntletCoverageDensityDemo, GauntletEnduranceStreakDemo, GauntletExcludedQuestionsDemo, Statistical EDA demos)
│   │   ├── toc/                 # SubjectCard, Table of Specifications data, tosItems, tosRows
│   │   └── layout/              # AppShell, custom TitleBar, navigation sidebar
│   ├── hooks/                   # Business logic (SM-2, timer, TTS, useGauntletMusic, sound volume, import)
│   ├── lib/                     # LaTeX rendering, subject classifier, audio synthesis, gauntlet scoring/Elo, tosData
│   │   └── stats/               # In-house statistical analysis suite (ANOVA, Chi-Square, descriptive, distributions, inference)
│   ├── pages/                   # Main views (Dashboard, Gauntlet, Lab, LooksFam, FlashcardLearn, Formulas, PrintView, TOSChecklist, Settings)
│   ├── services/                # db.service.ts (SQLite data access), aiSummary.service.ts (Groq summaries)
│   ├── store/                   # Zustand stores (useSessionStore, useGauntletStore, useChecklistStore, useDataLabStore)
│   └── styles/                  # Tailwind theme tokens, CSS variables (--tier-*), KaTeX customizations
├── content/                     # Seed JSON deck files
├── scripts/                     # Seeding (seed-db.ts) & TOS classifier (classify_database_tos.py)
├── package.json                 # Dependencies and build configuration
├── tailwind.config.ts           # Semantic design tokens and container queries
└── electron.vite.config.ts      # Vite configuration for React and Electron
```

---

## 🛠 Getting Started & Development

### Prerequisites
* **Node.js**: `v20.x` or `v22.x` LTS recommended (Active LTS baseline for native module compatibility with `better-sqlite3` and `sharp`)
* **npm** (comes with Node.js)
* **C++ Build Tools**:
  * **Windows**: `npm install --global --production windows-build-tools` or Visual Studio C++ build tools (required for native `better-sqlite3` compilation)
  * **Linux**: `build-essential`, `python3`
  * **macOS**: Xcode Command Line Tools (`xcode-select --install`)

---

### Installation & Database Seeding

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vtajaros/ECEngine.git
   cd ecengine
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Compile and seed the database**:
   > ⚠️ **Note on ABI Targets**: Seeding runs via system Node.js, while the app runs via Electron's bundled Node.js. Follow this sequence:
   ```bash
   # Rebuild native sqlite bindings for system Node.js
   npm rebuild better-sqlite3

   # Seed content/ JSON decks into ecengine.sqlite
   npm run seed

   # Rebuild native sqlite bindings for Electron
   npx electron-rebuild -f
   ```

4. **Launch development mode**:
   ```bash
   npm run dev
   ```

---

### 🔊 Linux TTS Setup (Optional)

On Windows and macOS, ECEngine uses the operating system's built-in Web Speech API with zero configuration. On Linux, fast, high-quality neural voice synthesis is powered by [Piper](https://github.com/rhasspy/piper) and ALSA (`aplay`).

#### 1. Install Piper & Audio Tools by Distro

Choose the method that matches your Linux distribution:

<details open>
<summary><b>Ubuntu / Debian / Linux Mint / Pop!_OS / Zorin OS</b></summary>

```bash
# 1. Install audio utility dependencies
sudo apt update && sudo apt install -y alsa-utils wget tar

# 2. Download and install precompiled Piper binary
wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz
tar -xzf piper_linux_x86_64.tar.gz
sudo cp -r piper/* /usr/local/
rm -rf piper piper_linux_x86_64.tar.gz
```

*Alternative via pipx:*
```bash
sudo apt install -y pipx alsa-utils
pipx install piper-tts
pipx ensurepath
```
</details>

<details open>
<summary><b>Fedora / RHEL / Nobara / Rocky Linux / AlmaLinux</b></summary>

```bash
# 1. Install audio utility dependencies
sudo dnf install -y alsa-utils wget tar

# 2. Download and install precompiled Piper binary
wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz
tar -xzf piper_linux_x86_64.tar.gz
sudo cp -r piper/* /usr/local/
rm -rf piper piper_linux_x86_64.tar.gz
```

*Alternative via pipx:*
```bash
sudo dnf install -y pipx alsa-utils
pipx install piper-tts
pipx ensurepath
```
</details>

<details open>
<summary><b>Arch Linux / Manjaro / EndeavourOS</b></summary>

```bash
# Install via AUR helper (yay or paru)
yay -S piper-tts-bin alsa-utils
# or: paru -S piper-tts-bin alsa-utils
```
</details>

<details>
<summary><b>openSUSE (Tumbleweed / Leap)</b></summary>

```bash
# 1. Install audio utility dependencies
sudo zypper install -y alsa-utils wget tar

# 2. Download and install precompiled Piper binary
wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz
tar -xzf piper_linux_x86_64.tar.gz
sudo cp -r piper/* /usr/local/
rm -rf piper piper_linux_x86_64.tar.gz
```
</details>

<details>
<summary><b>Universal (Any Distro via Python pipx)</b></summary>

```bash
# Install pipx from your system package manager, then:
pipx install piper-tts
pipx ensurepath
```
</details>

---

#### 2. Download ONNX Voice Models

Piper requires an `.onnx` voice model and its matching `.onnx.json` configuration file. ECEngine automatically scans `~/.local/share/piper-voices/` on startup.

Run the following commands to create the directory and download the recommended natural voice (**Ryan - Medium**):

```bash
mkdir -p ~/.local/share/piper-voices && cd ~/.local/share/piper-voices

# Download Ryan Medium (recommended)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json
```

> 💡 **Want other voices?** Browse additional English and international voices on the [Piper HuggingFace Voice Library](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US) (e.g. `amy`, `lessac`, `danny`, `bryce`). Simply download both the `.onnx` and `.onnx.json` files into `~/.local/share/piper-voices/`.

---

#### 3. Configuration & Verification

* **Automatic Detection**: If you downloaded the voice model into `~/.local/share/piper-voices/`, ECEngine detects and selects it automatically upon startup.
* **Manual Model Selection**: You can also browse for any `.onnx` file in **Settings** → **Sound & Feedback** → **Reading Voice (Piper TTS)** → **Browse**.
* **Quick CLI Verification**: Test your installation directly in the terminal:
  ```bash
  echo "ECEngine neural text-to-speech is ready." | piper --model ~/.local/share/piper-voices/en_US-ryan-medium.onnx --output_file - | aplay
  ```

---

### 💻 Developer Command Reference

| Command | Description |
|---|---|
| `npm run dev` | Launch Electron app in development mode with Hot Module Replacement (HMR) |
| `npm run build` | Compile TypeScript and bundle renderer & main process assets |
| `npm run preview` | Preview production build locally |
| `npm run package` | Generate distributable installers (`.exe`, `.AppImage`, `.dmg`) via `electron-builder` |
| `npm run seed` | Parse `content/` JSON files and populate `ecengine.sqlite` |
| `npm run test` | Run test suite with Vitest |

---

## 📐 Key Design Principles

1. **Strict Offline First**: No external servers are required for core features. All decks, progress, and history remain on the user's local disk.
2. **Unified Cyberpunk Typography**:
   * **Orbitron**: Display headers, page titles, hero text, and alert banners.
   * **Rajdhani**: Primary application UI, navigation, buttons, badges, MCQ cards, flashcards, and Test Paper View.
   * **JetBrains Mono**: All monospace data, numbers, charts, table reviews, code editors, AI explanations, and choice prefixes (`[A]`, `[B]`, `[C]`, `[D]`). *(Note: Replaced legacy IBM Plex Mono)*.
3. **No Arbitrary Hex Colors**: UI components must use established CSS variables in `src/styles/theme.css` and Tailwind semantic classes (`bg-surface`, `border-border-base`, `text-accent`, etc.).
4. **Separated Service Boundary**: React components query database operations through `src/services/db.service.ts` rather than invoking raw Electron IPCs directly.
5. **Resilient KaTeX Rendering**: KaTeX math blocks are sanitized and normalized safely without running through DOMPurify SVG-corrupting filters.

---

<div align="center">
  <i>Engineered for our future Electronics Engineers & Electronics Technicians.</i>
</div>
