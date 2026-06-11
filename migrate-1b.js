const fs = require('fs');
const path = require('path');
const file = path.join('src', 'pages', 'AddDeck.tsx');
let content = fs.readFileSync(file, 'utf8');

const importModalStart = content.indexOf('function ImportModal');
const endMarker = content.indexOf('/* ------------------------------------------------------------------ */', importModalStart);

if (importModalStart === -1 || endMarker === -1) {
  console.error("Missing markers");
  process.exit(1);
}

let beforeModals = content.slice(0, importModalStart);
let modalsBlock = content.slice(importModalStart, endMarker);
let afterModals = content.slice(endMarker);

// Modify to export the components
modalsBlock = modalsBlock
  .replace('function ImportModal', 'export function ImportModal')
  .replace('function ImportFlashcardsModal', 'export function ImportFlashcardsModal');

const importModalsCode = `import React, { useState, useEffect } from 'react'
import { X, Upload, AlertCircle, Check, AlertTriangle, RotateCcw, Plus } from 'lucide-react'
import { parseImportedMCQs, parseImportedFlashcards } from '../../lib/parser'
import { detectQuizletFormat, tryConvertQuizlet } from '../../lib/quizletParser'

` + modalsBlock;

const outPath = path.join('src', 'components', 'deck');
if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });
fs.writeFileSync(path.join(outPath, 'ImportModals.tsx'), importModalsCode);

// AddDeck.tsx
let newAddDeckContent = beforeModals + afterModals;

// Prepend the import to AddDeck
const importStmt = `import { ImportModal, ImportFlashcardsModal } from '../components/deck/ImportModals'\n`;
newAddDeckContent = newAddDeckContent.replace(/import React/, importStmt + 'import React');

fs.writeFileSync(file, newAddDeckContent);
console.log('Successfully refactored phase 1B');
