import { RouterProvider } from 'react-router-dom'
import { router } from './router'

import { useEffect } from 'react'
import './store/useChecklistStore'
import { useDataLabStore } from './store/useDataLabStore'
import { useDashboardStore } from './store/useDashboardStore'

export default function App() {
  useEffect(() => {
    // Preload Data Lab analytics and Dashboard stats on app mount
    useDataLabStore.getState().preloadAll()
    useDashboardStore.getState().preloadAll()

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

    // Sync from persistent config to handle restarts reliably
    window.electron.config.getSettings().then(settings => {
      let changed = false
      if (settings.katexScale !== undefined && settings.katexScale.toString() !== localStorage.getItem('ecengine:katex-scale')) {
        localStorage.setItem('ecengine:katex-scale', settings.katexScale.toString())
        changed = true
      }
      if (settings.katexBold !== undefined && (settings.katexBold ? 'true' : 'false') !== localStorage.getItem('ecengine:katex-bold')) {
        localStorage.setItem('ecengine:katex-bold', settings.katexBold ? 'true' : 'false')
        changed = true
      }
      
      let otherSettingsChanged = false
      if (settings.sidebarCollapsed !== undefined && (settings.sidebarCollapsed ? 'true' : 'false') !== localStorage.getItem('ecengine:sidebar-collapsed')) {
        localStorage.setItem('ecengine:sidebar-collapsed', settings.sidebarCollapsed ? 'true' : 'false')
        otherSettingsChanged = true
      }

      if (changed) {
        updateKatexScale()
        updateKatexBold()
      }
      if (otherSettingsChanged) {
        window.dispatchEvent(new Event('ecengine:settings-changed'))
      }
    }).catch(console.error)

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
