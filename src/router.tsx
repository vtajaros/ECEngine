import React, { lazy, Suspense } from 'react'
import { createHashRouter, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

const ImportBackup = lazy(() => import('./pages/ImportBackup'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const TableOfContents = lazy(() => import('./pages/TableOfContents'))
const FlashcardStudy = lazy(() => import('./pages/FlashcardStudy'))
const FlashcardViewer = lazy(() => import('./pages/FlashcardViewer'))
const Formulas       = lazy(() => import('./pages/Formulas'))
const AddDeck        = lazy(() => import('./pages/AddDeck'))
const EditDeck       = lazy(() => import('./pages/EditDeck'))
const Settings       = lazy(() => import('./pages/Settings'))
const PrintView      = lazy(() => import('./pages/PrintView'))
const TOSChecklist   = lazy(() => import('./pages/TOSChecklist'))


function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontSize: 14, color: '#888'
      }}>
        Loading...
      </div>
    }>
      {children}
    </Suspense>
  )
}

export const router = createHashRouter([
  {
    path: '/print',
    element: (
      <ErrorBoundary>
        <Lazy><PrintView /></Lazy>
      </ErrorBoundary>
    ),
  },
  {
    path: '/',
    element: <ErrorBoundary><AppShell /></ErrorBoundary>,
    children: [
      {
        path: '',
        element: <ErrorBoundary><Lazy><Dashboard /></Lazy></ErrorBoundary>
      },
      {
        path: 'topics',
        element: <ErrorBoundary><Lazy><TableOfContents /></Lazy></ErrorBoundary>
      },
      {
        path: 'study',
        element: <ErrorBoundary><Lazy><FlashcardStudy /></Lazy></ErrorBoundary>
      },
      {
        path: 'flashcards',
        element: <ErrorBoundary><Lazy><FlashcardViewer /></Lazy></ErrorBoundary>
      },
      {
        path: 'formulas',
        element: <ErrorBoundary><Lazy><Formulas /></Lazy></ErrorBoundary>
      },
      {
        path: 'add-decks',
        element: (
          <ErrorBoundary>
            <Lazy><AddDeck /></Lazy>
          </ErrorBoundary>
        )
      },
      {
        path: 'edit-deck/:deckId',
        element: (
          <ErrorBoundary>
            <Lazy><EditDeck /></Lazy>
          </ErrorBoundary>
        )
      },
      {
        path: 'settings',
        element: (
          <ErrorBoundary>
            <Lazy><Settings /></Lazy>
          </ErrorBoundary>
        )
      },
      {
        path: 'checklist',
        element: <ErrorBoundary><Lazy><TOSChecklist /></Lazy></ErrorBoundary>
      },
      {
        path: 'import',
        element: <ErrorBoundary><Lazy><ImportBackup /></Lazy></ErrorBoundary>
      },
    ]
  }
])
