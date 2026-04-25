import { createHashRouter } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import TableOfContents from './pages/TableOfContents'
import FlashcardStudy from './pages/FlashcardStudy'
import FormulaViewer from './pages/FormulaViewer'
import ExamMode from './pages/ExamMode'
import ImportContent from './pages/ImportContent'
import Statistics from './pages/Statistics'
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
      { path: 'exam',        element: <ExamMode /> },
      { path: 'import',      element: <ImportContent /> },
      { path: 'stats',       element: <Statistics /> },
      { path: 'settings',    element: <Settings /> },
    ]
  }
])
