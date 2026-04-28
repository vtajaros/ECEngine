import { createHashRouter } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import TableOfContents from './pages/TableOfContents'
import FlashcardStudy from './pages/FlashcardStudy'
import FormulaViewer from './pages/FormulaViewer'
import ImportContent from './pages/ImportContent'
import Settings from './pages/Settings'

import { AppShell } from './components/layout/AppShell'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { path: '',            element: <Dashboard /> },
      { path: 'topics',      element: <TableOfContents /> },
      { path: 'flashcards',  element: <FlashcardStudy /> },
      { path: 'formulas',    element: <FormulaViewer /> },
      { path: 'import',      element: <ImportContent /> },
      { path: 'settings',    element: <Settings /> },
    ]
  }
])
