const fs = require('fs');
const path = require('path');
const file = path.join('src', 'pages', 'AddDeck.tsx');
let content = fs.readFileSync(file, 'utf8');

const labelStart = content.indexOf('const Label: React.FC');
const cardRowStart = content.indexOf('const CardRow: React.FC');
if (labelStart === -1 || cardRowStart === -1) {
  console.error("Missing markers");
  process.exit(1);
}

let beforeLabel = content.slice(0, labelStart);
let formsBlock = content.slice(labelStart, cardRowStart);
let afterForms = content.slice(cardRowStart);

// Exact string removal of CardRowProps from formsBlock
// Using exact match ignoring whitespace
const parts = formsBlock.split('interface CardRowProps');
let cardRowPropsStr = '';
if (parts.length > 1) {
  const endIdx = parts[1].indexOf('}') + 1;
  cardRowPropsStr = 'interface CardRowProps' + parts[1].slice(0, endIdx) + '\n\n';
  formsBlock = parts[0] + parts[1].slice(endIdx).trimStart();
} else {
  console.log("Warning: CardRowProps not found in formsBlock");
}

formsBlock = formsBlock
  .replace('const MCQForm:', 'export const MCQForm:')
  .replace('const FlashcardForm:', 'export const FlashcardForm:')
  .replace('const FormulaForm:', 'export const FormulaForm:');

const cardFormsCode = `import React, { useState, useEffect } from 'react'
import { X, ImageIcon } from 'lucide-react'
import { renderMath } from '../../lib/latex'
import 'mathlive'
import type { MathfieldElement } from 'mathlive'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement>, MathfieldElement
      > & { [key: string]: any }
    }
  }
}

export interface FormulaEdit {
  name: string
  latex: string
  description: string
  variables: string
}

export interface MCQEdit {
  question: string
  choices: [string, string, string, string]
  answer: number
  explanation: string
  imagePath?: string
  solutionImagePath?: string
}

export interface FlashcardEdit {
  front: string
  back: string
  imagePath?: string
}

` + formsBlock;

const outPath = path.join('src', 'components', 'deck');
if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });
fs.writeFileSync(path.join(outPath, 'CardForms.tsx'), cardFormsCode);

// AddDeck.tsx
let newAddDeckContent = beforeLabel + cardRowPropsStr + afterForms;

// Remove interfaces from AddDeck
newAddDeckContent = newAddDeckContent.replace(/interface FormulaEdit\s*\{[\s\S]*?\}\r?\n/g, '');
newAddDeckContent = newAddDeckContent.replace(/interface MCQEdit\s*\{[\s\S]*?\}\r?\n/g, '');
newAddDeckContent = newAddDeckContent.replace(/interface FlashcardEdit\s*\{[\s\S]*?\}\r?\n/g, '');

// Prepend the import to AddDeck
const importStmt = `import { MCQForm, FlashcardForm, FormulaForm, MCQEdit, FlashcardEdit, FormulaEdit } from '../components/deck/CardForms'\n`;
newAddDeckContent = newAddDeckContent.replace(/import React/, importStmt + 'import React');

fs.writeFileSync(file, newAddDeckContent);
console.log('Successfully refactored AddDeck.tsx and regenerated CardForms.tsx');
