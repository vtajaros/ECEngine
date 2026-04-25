# ⚡ ECEngine

> Electronics Engineering Board Exam Review App — Philippines

**Theme:** Razer-inspired Black & Neon Green
**Stack:** Electron + React + TypeScript + SQLite + Tailwind CSS

## Quick Start

```bash
npm install
npm run seed      # Load preloaded ECE content into SQLite
npm run dev       # Launch Electron app (desktop)
npm run dev:web   # Launch web version at localhost:5173
```

## Build

```bash
npm run build     # Build Electron app
npm run package   # Package as .exe/.dmg/.AppImage
npm run build:web # Build web SPA for deployment
```

## Content

ECE content lives in `/content/**/*.json`. See `/content/README.md` for schema docs.
To add MCQs/flashcards: edit the JSON files, then run `npm run seed`.

## Architecture

See `ECEngine_Architecture.md` for the full architecture brief.
