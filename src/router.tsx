import React, { lazy, Suspense } from 'react'
import { createHashRouter, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

const ImportBackup = lazy(() => import('./pages/ImportBackup'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const TableOfContents = lazy(() => import('./pages/TableOfContents'))
const LooksFamStudy = lazy(() => import('./pages/LooksFamStudy'))
const FlashcardLearn = lazy(() => import('./pages/FlashcardLearn'))
const Formulas       = lazy(() => import('./pages/Formulas'))
const Lab            = lazy(() => import('./pages/Lab'))
const AddDeck        = lazy(() => import('./pages/AddDeck'))
const EditDeck       = lazy(() => import('./pages/EditDeck'))
const Settings       = lazy(() => import('./pages/Settings'))
const PrintView      = lazy(() => import('./pages/PrintView'))
const TOSChecklist   = lazy(() => import('./pages/TOSChecklist'))
const Gauntlet       = lazy(() => import('./pages/Gauntlet'))


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
        element: <ErrorBoundary><Lazy><LooksFamStudy /></Lazy></ErrorBoundary>
      },
      {
        path: 'gauntlet',
        element: <ErrorBoundary><Lazy><Gauntlet /></Lazy></ErrorBoundary>
      },
      {
        path: 'flashcards',
        element: <ErrorBoundary><Lazy><FlashcardLearn /></Lazy></ErrorBoundary>
      },
      {
        path: 'formulas',
        element: <ErrorBoundary><Lazy><Formulas /></Lazy></ErrorBoundary>
      },
      {
        path: 'lab',
        element: <ErrorBoundary><Lazy><Lab /></Lazy></ErrorBoundary>
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
