import { createHashRouter } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import TableOfContents from './pages/TableOfContents'
import FlashcardStudy from './pages/FlashcardStudy'
import FlashcardViewer from './pages/FlashcardViewer'
import Formulas from './pages/Formulas'
import AddDeck from './pages/AddDeck'
import EditDeck from './pages/EditDeck'
import Settings from './pages/Settings'
import ExamMode from './pages/ExamMode'

import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

export const router = createHashRouter([
  {
    path: '/',
    element: <ErrorBoundary><AppShell /></ErrorBoundary>,
    children: [
      { path: '',            element: <ErrorBoundary><Dashboard /></ErrorBoundary> },
      { path: 'topics',      element: <ErrorBoundary><TableOfContents /></ErrorBoundary> },
      { path: 'study',       element: <ErrorBoundary><FlashcardStudy /></ErrorBoundary> },
      { path: 'flashcards',  element: <ErrorBoundary><FlashcardViewer /></ErrorBoundary> },
      { path: 'formulas',    element: <ErrorBoundary><Formulas /></ErrorBoundary> },
      { path: 'exam',        element: <ErrorBoundary><ExamMode /></ErrorBoundary> },
      { path: 'add-decks',          element: <ErrorBoundary><AddDeck /></ErrorBoundary> },
      { path: 'edit-deck/:deckId', element: <ErrorBoundary><EditDeck /></ErrorBoundary> },
      { path: 'settings',          element: <ErrorBoundary><Settings /></ErrorBoundary> },
    ]
  }
])

