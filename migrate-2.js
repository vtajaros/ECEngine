const fs = require('fs');
const path = require('path');
const file = path.join('src', 'pages', 'AddDeck.tsx');
let content = fs.readFileSync(file, 'utf8');

const cardRowStart = content.indexOf('interface CardRowProps');
const mainComponentStart = content.indexOf('/*  Main Component');
// find the previous line's dash comment
const endMarker = content.lastIndexOf('/* ------------------------------------------------------------------ */', mainComponentStart);

if (cardRowStart === -1 || endMarker === -1) {
  console.error("Missing markers", { cardRowStart, endMarker, mainComponentStart });
  process.exit(1);
}

let beforeEditor = content.slice(0, cardRowStart);
let editorBlock = content.slice(cardRowStart, endMarker);
let afterEditor = content.slice(endMarker);

// Rename SortableQuestionRow to CardEditor
editorBlock = editorBlock.replace('const SortableQuestionRow: React.FC<CardRowProps> = (props) => {', 'export const CardEditor: React.FC<CardRowProps> = (props) => {');
// Make CardRow exported too, just in case
editorBlock = editorBlock.replace('const CardRow: React.FC', 'export const CardRow: React.FC');

// Extract EditCard
const editCardRegex = /interface EditCard\s*\{[\s\S]*?\}\r?\n/;
const match = beforeEditor.match(editCardRegex);
let editCardStr = '';
if (match) {
  editCardStr = 'export ' + match[0];
  beforeEditor = beforeEditor.replace(editCardRegex, '');
} else {
  console.error("Missing EditCard interface");
}

const cardEditorCode = `import React, { useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { GripVertical, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MCQEdit, FormulaEdit, FlashcardEdit, MCQForm, FlashcardForm, FormulaForm } from './CardForms'

${editCardStr}
${editorBlock}`;

const outPath = path.join('src', 'components', 'deck');
if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });
fs.writeFileSync(path.join(outPath, 'CardEditor.tsx'), cardEditorCode);

// AddDeck.tsx modifications
let newAddDeckContent = beforeEditor + afterEditor;

// Prepend the import to AddDeck
const importStmt = `import { CardEditor, EditCard } from '../components/deck/CardEditor'\n`;
newAddDeckContent = newAddDeckContent.replace(/import React/, importStmt + 'import React');

// Replace SortableQuestionRow usages with CardEditor
newAddDeckContent = newAddDeckContent.replace(/<SortableQuestionRow/g, '<CardEditor');

fs.writeFileSync(file, newAddDeckContent);
console.log('Successfully refactored phase 2');
