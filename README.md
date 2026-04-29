# ⚡ ECEngine

> Electronics Engineering Board Exam Review Platform — Philippines

**Theme:** Cyberpunk Black & Neon Green  
**Stack:** Electron + React + TypeScript + SQLite + Tailwind CSS + Framer Motion  

ECEngine is a modern, high-performance desktop application designed specifically for Electronics Engineering (ECE) students preparing for their board exams. It features a robust offline SQLite database, advanced learning algorithms, and a sleek, developer-inspired aesthetic.

## ✨ Key Features

* **High-Tech User Interface:** A meticulously crafted cyberpunk theme utilizing `#0D0D0D` backgrounds and `#00FF41` neon green accents, styled with Tailwind CSS and animated smoothly via Framer Motion.
* **Intelligent Learn Mode:** A partitioned learning engine that groups questions into manageable chunks. It tracks performance (Correct, Missed, IDK) and forces retries on missed questions before advancing, ensuring true mastery.
* **Bulk Deck Importer:** Easily paste raw Q/A text formats to instantly generate flashcard decks. The built-in parser automatically detects questions, choices, and answers, while flagging syntax errors.
* **Question Inspector:** A dynamic UI panel that allows users to thoroughly review parsed MCQ data before saving a deck. Features active state tracking, smooth slide-in animations, and correct answer highlighting.
* **Advanced Math Rendering:** Fully integrated KaTeX support throughout the application. LaTeX formulas embedded within questions or choices render natively and beautifully on the fly.
* **100% Offline & Private:** Built on Electron with a local SQLite database, meaning your study materials, progress, and statistics never leave your device.

## 🚀 Quick Start

```bash
npm install
npm run seed      # Load preloaded ECE content into SQLite
npm run dev       # Launch Electron app (desktop)
```

## 📦 Build

```bash
npm run build     # Build Electron app
npm run package   # Package as .exe/.dmg/.AppImage
```

## 📚 Content Management

ECE content lives in `/content/**/*.json`. See `/content/README.md` for schema docs.  
To manually add MCQs/flashcards via code: edit the JSON files, then run `npm run seed`.
Alternatively, use the in-app **Add Decks** GUI to seamlessly import and organize topics across Mathematics, General Engineering & Applied Sciences (GEAS), Electronics Engineering (ELECS), and Electronics Systems & Technologies (EST).

## 🏗️ Architecture

See `ECEngine_Architecture.md` for the full architecture brief and database schemas.
