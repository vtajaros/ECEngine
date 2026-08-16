import { RouterProvider } from 'react-router-dom'
import { router } from './router'

import { useEffect } from 'react'

export default function App() {
  useEffect(() => {
    const updateKatexScale = () => {
      const scale = localStorage.getItem('ecengine:katex-scale') || '1.1'
      document.documentElement.style.setProperty('--katex-scale', `${scale}em`)
    }
    
    const updateKatexBold = () => {
      const isBold = localStorage.getItem('ecengine:katex-bold') === 'true'
      if (isBold) {
        document.body.classList.add('katex-bold-mode')
      } else {
        document.body.classList.remove('katex-bold-mode')
      }
    }

    // Init on mount
    updateKatexScale()
    updateKatexBold()

    // Listen for changes from Settings
    window.addEventListener('ecengine:katex-scale-changed', updateKatexScale)
    window.addEventListener('ecengine:katex-bold-changed', updateKatexBold)
    return () => {
      window.removeEventListener('ecengine:katex-scale-changed', updateKatexScale)
      window.removeEventListener('ecengine:katex-bold-changed', updateKatexBold)
    }
  }, [])

  return <RouterProvider router={router} />
}
